package io.opennews.app;

import android.content.Context;
import android.util.Xml;

import org.xmlpull.v1.XmlPullParser;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.StringReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

final class AutoFeedFetcher {
    private static final int CONNECT_TIMEOUT_MS = 7000;
    private static final int READ_TIMEOUT_MS = 9000;
    private static final int MAX_BODY_BYTES = 2 * 1024 * 1024;
    private static final int MAX_REDIRECTS = 3;
    private static final int MAX_UPDATE_ITEMS = 8;
    private static final int MAX_PODCAST_ITEMS = 15;
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]*>");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final AtomicBoolean REFRESH_IN_FLIGHT = new AtomicBoolean(false);

    private AutoFeedFetcher() {}

    static void refreshAsync(final Context context, final boolean force) {
        final AutoAudioStore store = new AutoAudioStore(context);
        if (!force && (!store.isDirectFeedRefresh() || !store.isCacheStale())) {
            return;
        }
        if (!REFRESH_IN_FLIGHT.compareAndSet(false, true)) {
            return;
        }
        Thread worker = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    refreshBlocking(context, force);
                } finally {
                    REFRESH_IN_FLIGHT.set(false);
                }
            }
        }, "OpenNewsAutoRefresh");
        worker.start();
    }

    static void refreshSingleFeedAsync(final Context context, final AutoAudioStore.FeedEntry feed) {
        if (feed == null || !feed.url.startsWith("https://")) return;
        Thread worker = new Thread(new Runnable() {
            @Override
            public void run() {
                List<AutoAudioStore.EpisodeEntry> eps = fetchFeed(feed);
                if (!eps.isEmpty()) {
                    Map<String, List<AutoAudioStore.EpisodeEntry>> map = new HashMap<>();
                    map.put(feed.id, eps);
                    new AutoAudioStore(context).saveFetchedFeedEpisodes(map);
                    OpenNewsAutoMediaService.notifyLibraryChanged(context, "podcast:" + feed.id);
                    OpenNewsAutoMediaService.notifyLibraryChanged(context, OpenNewsAutoMediaService.TAB_UPDATES);
                }
            }
        }, "OpenNewsAutoSingleFeed");
        worker.start();
    }

    static int refreshBlocking(Context context, boolean force) {
        AutoAudioStore store = new AutoAudioStore(context);
        if (!force && !store.isDirectFeedRefresh()) return 0;
        List<AutoAudioStore.FeedEntry> feeds = store.getActiveFeeds();
        if (feeds.isEmpty()) return 0;

        // Prioritize news update feeds first so Tagesschau 20 Uhr / 100s / DLF are always fresh
        List<AutoAudioStore.FeedEntry> prioritized = new ArrayList<>();
        for (AutoAudioStore.FeedEntry f : feeds) {
            if (f.newsUpdate) prioritized.add(f);
        }
        for (AutoAudioStore.FeedEntry f : feeds) {
            if (!f.newsUpdate && prioritized.size() < 24) prioritized.add(f);
        }

        ExecutorService pool = Executors.newFixedThreadPool(4);
        Map<String, Future<List<AutoAudioStore.EpisodeEntry>>> futures = new HashMap<>();
        try {
            for (final AutoAudioStore.FeedEntry feed : prioritized) {
                futures.put(feed.id, pool.submit(new Callable<List<AutoAudioStore.EpisodeEntry>>() {
                    @Override
                    public List<AutoAudioStore.EpisodeEntry> call() {
                        return fetchFeed(feed);
                    }
                }));
            }
            Map<String, List<AutoAudioStore.EpisodeEntry>> collected = new HashMap<>();
            int totalEpisodes = 0;
            for (Map.Entry<String, Future<List<AutoAudioStore.EpisodeEntry>>> entry : futures.entrySet()) {
                try {
                    List<AutoAudioStore.EpisodeEntry> list = entry.getValue().get(14, TimeUnit.SECONDS);
                    if (list != null && !list.isEmpty()) {
                        collected.put(entry.getKey(), list);
                        totalEpisodes += list.size();
                    }
                } catch (Exception ignored) {}
            }
            if (!collected.isEmpty()) {
                store.saveFetchedFeedEpisodes(collected);
                OpenNewsAutoMediaService.notifyLibraryChanged(context, OpenNewsAutoMediaService.TAB_UPDATES);
                OpenNewsAutoMediaService.notifyLibraryChanged(context, OpenNewsAutoMediaService.TAB_PODCASTS);
            }
            return totalEpisodes;
        } finally {
            pool.shutdownNow();
        }
    }

    static List<AutoAudioStore.EpisodeEntry> fetchFeed(AutoAudioStore.FeedEntry feed) {
        if (feed == null || !feed.url.startsWith("https://")) return new ArrayList<>();
        String xml = downloadHttpsText(feed.url);
        if (xml == null || xml.isEmpty()) return new ArrayList<>();
        return parsePodcastXml(feed, xml);
    }

    private static String downloadHttpsText(String rawUrl) {
        String current = rawUrl;
        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
            if (current == null || !current.startsWith("https://")) return null;
            HttpURLConnection conn = null;
            try {
                URL url = new URL(current);
                conn = (HttpURLConnection) url.openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(READ_TIMEOUT_MS);
                conn.setRequestProperty("User-Agent", "OpenNews-AndroidAuto/1.0");
                conn.setRequestProperty("Accept", "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5");

                int code = conn.getResponseCode();
                if (code >= 300 && code < 400) {
                    String location = conn.getHeaderField("Location");
                    if (location == null || location.isEmpty()) return null;
                    URL resolved = new URL(url, location);
                    current = resolved.toString();
                    continue;
                }
                if (code < 200 || code >= 300) return null;

                try (InputStream in = conn.getInputStream()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int total = 0;
                    int read;
                    while ((read = in.read(buf)) != -1) {
                        total += read;
                        if (total > MAX_BODY_BYTES) break;
                        out.write(buf, 0, read);
                    }
                    return out.toString(StandardCharsets.UTF_8.name());
                }
            } catch (Exception ignored) {
                return null;
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
        return null;
    }

    static List<AutoAudioStore.EpisodeEntry> parsePodcastXml(AutoAudioStore.FeedEntry feed, String xml) {
        List<AutoAudioStore.EpisodeEntry> episodes = new ArrayList<>();
        int maxItems = feed.newsUpdate ? MAX_UPDATE_ITEMS : MAX_PODCAST_ITEMS;
        try {
            XmlPullParser parser = Xml.newPullParser();
            parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false);
            parser.setInput(new StringReader(xml));

            String channelImage = "";
            boolean inItem = false;
            boolean inChannelImage = false;
            String title = "";
            String summary = "";
            String pubDate = "";
            String audioUrl = "";
            String itemImage = "";
            String durationRaw = "";

            int event = parser.getEventType();
            while (event != XmlPullParser.END_DOCUMENT && episodes.size() < maxItems) {
                String tag = parser.getName();
                String lowerTag = tag != null ? tag.toLowerCase(Locale.ROOT) : "";
                if (event == XmlPullParser.START_TAG) {
                    if ("item".equals(lowerTag) || "entry".equals(lowerTag)) {
                        inItem = true;
                        title = "";
                        summary = "";
                        pubDate = "";
                        audioUrl = "";
                        itemImage = "";
                        durationRaw = "";
                    } else if (!inItem && "image".equals(lowerTag)) {
                        inChannelImage = true;
                    } else if (!inItem && ("itunes:image".equals(lowerTag))) {
                        String href = parser.getAttributeValue(null, "href");
                        if (href != null && href.startsWith("https://")) channelImage = href;
                    } else if (inItem) {
                        if ("enclosure".equals(lowerTag)) {
                            String url = parser.getAttributeValue(null, "url");
                            String type = parser.getAttributeValue(null, "type");
                            if (isPlayableAudioUrl(url, type)) {
                                audioUrl = url;
                            }
                        } else if ("link".equals(lowerTag)) {
                            String rel = parser.getAttributeValue(null, "rel");
                            String href = parser.getAttributeValue(null, "href");
                            String type = parser.getAttributeValue(null, "type");
                            if ("enclosure".equals(rel) && isPlayableAudioUrl(href, type) && audioUrl.isEmpty()) {
                                audioUrl = href;
                            }
                        } else if ("itunes:image".equals(lowerTag) || "media:thumbnail".equals(lowerTag)) {
                            String href = parser.getAttributeValue(null, "href");
                            if (href == null) href = parser.getAttributeValue(null, "url");
                            if (href != null && href.startsWith("https://") && itemImage.isEmpty()) {
                                itemImage = href;
                            }
                        } else if ("title".equals(lowerTag)) {
                            title = cleanText(safeNextText(parser));
                        } else if ("description".equals(lowerTag) || "itunes:summary".equals(lowerTag) || "summary".equals(lowerTag)) {
                            String txt = cleanText(safeNextText(parser));
                            if (summary.isEmpty() && !txt.isEmpty()) summary = txt;
                        } else if ("pubdate".equals(lowerTag) || "published".equals(lowerTag) || "updated".equals(lowerTag)) {
                            if (pubDate.isEmpty()) pubDate = cleanText(safeNextText(parser));
                        } else if ("itunes:duration".equals(lowerTag)) {
                            durationRaw = cleanText(safeNextText(parser));
                        }
                    } else if (inChannelImage && "url".equals(lowerTag)) {
                        String url = cleanText(safeNextText(parser));
                        if (url.startsWith("https://") && channelImage.isEmpty()) channelImage = url;
                    }
                } else if (event == XmlPullParser.END_TAG) {
                    if (!inItem && "image".equals(lowerTag)) {
                        inChannelImage = false;
                    } else if (inItem && ("item".equals(lowerTag) || "entry".equals(lowerTag))) {
                        inItem = false;
                        if (!title.isEmpty() && audioUrl.startsWith("https://")) {
                            String art = itemImage.isEmpty() ? channelImage : itemImage;
                            long pubMs = parseDateMs(pubDate);
                            int durSec = parseDurationSec(durationRaw);
                            String mediaId = "ep:" + feed.id + ":" + Integer.toHexString(audioUrl.hashCode());
                            episodes.add(new AutoAudioStore.EpisodeEntry(
                                mediaId,
                                feed.id,
                                feed.name,
                                title,
                                summary,
                                audioUrl,
                                art,
                                pubMs,
                                durSec,
                                feed.newsUpdate
                            ));
                        }
                    }
                }
                event = parser.next();
            }
        } catch (Exception ignored) {}
        return episodes;
    }

    private static String safeNextText(XmlPullParser parser) {
        try {
            return parser.nextText();
        } catch (Exception e) {
            return "";
        }
    }

    private static boolean isPlayableAudioUrl(String url, String type) {
        if (url == null || !url.startsWith("https://")) return false;
        String lowerType = type != null ? type.toLowerCase(Locale.ROOT) : "";
        if (lowerType.startsWith("audio/")) return true;
        if (lowerType.startsWith("video/") || lowerType.startsWith("image/")) return false;
        String lowerUrl = url.toLowerCase(Locale.ROOT);
        return lowerUrl.contains(".mp3") || lowerUrl.contains(".m4a") || lowerUrl.contains(".aac") || lowerUrl.contains(".ogg");
    }

    private static String cleanText(String raw) {
        if (raw == null || raw.isEmpty()) return "";
        String noHtml = HTML_TAG.matcher(raw).replaceAll(" ");
        return WHITESPACE.matcher(noHtml).replaceAll(" ").trim();
    }

    private static long parseDateMs(String raw) {
        if (raw == null || raw.isEmpty()) return 0L;
        String[] patterns = {
            "EEE, dd MMM yyyy HH:mm:ss Z",
            "EEE, dd MMM yyyy HH:mm:ss zzz",
            "dd MMM yyyy HH:mm:ss Z",
            "yyyy-MM-dd'T'HH:mm:ssXXX",
            "yyyy-MM-dd'T'HH:mm:ss'Z'"
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat fmt = new SimpleDateFormat(pattern, Locale.US);
                fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date d = fmt.parse(raw);
                if (d != null) return d.getTime();
            } catch (ParseException ignored) {}
        }
        return 0L;
    }

    private static int parseDurationSec(String raw) {
        if (raw == null || raw.isEmpty()) return 0;
        String trimmed = raw.trim();
        try {
            if (trimmed.contains(":")) {
                String[] parts = trimmed.split(":");
                int total = 0;
                for (String p : parts) {
                    total = total * 60 + Integer.parseInt(p.trim());
                }
                return Math.max(0, total);
            }
            return Math.max(0, (int) Float.parseFloat(trimmed));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
