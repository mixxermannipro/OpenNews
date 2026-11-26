package io.opennews.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Xml;

import org.json.JSONException;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.StringReader;
import java.net.HttpURLConnection;
import java.net.InetAddress;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class AutoFeedFetcher {
    private static final String HTTP_CACHE_PREF = "opennews-auto-http-cache";
    private static final int MAX_HTTP_CACHE_ENTRIES = 60;
    private static final int CONNECT_TIMEOUT_MS = 7000;
    private static final int READ_TIMEOUT_MS = 9000;
    private static final int MAX_BODY_BYTES = 2 * 1024 * 1024;
    private static final int MAX_REDIRECTS = 3;
    private static final int MAX_UPDATE_ITEMS = 8;
    private static final int MAX_PODCAST_ITEMS = 15;
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]*>");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern NUMERIC_ENTITY = Pattern.compile("&#(x?[0-9a-fA-F]+);");
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
        final Context appContext = context.getApplicationContext();
        Thread worker = new Thread(new Runnable() {
            @Override
            public void run() {
                FetchOutcome outcome = fetchFeedWithCache(appContext, feed);
                if (!outcome.episodes.isEmpty()) {
                    Map<String, List<AutoAudioStore.EpisodeEntry>> map = new HashMap<>();
                    map.put(feed.id, outcome.episodes);
                    new AutoAudioStore(appContext).saveFetchedFeedEpisodes(map);
                    OpenNewsAutoMediaService.notifyLibraryChanged(appContext, "podcast:" + feed.id);
                    OpenNewsAutoMediaService.notifyLibraryChanged(appContext, OpenNewsAutoMediaService.TAB_UPDATES);
                }
            }
        }, "OpenNewsAutoSingleFeed");
        worker.start();
    }

    static int refreshBlocking(Context context, boolean force) {
        Context appContext = context.getApplicationContext();
        AutoAudioStore store = new AutoAudioStore(appContext);
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
        Map<String, Future<FetchOutcome>> futures = new HashMap<>();
        try {
            for (final AutoAudioStore.FeedEntry feed : prioritized) {
                futures.put(feed.id, pool.submit(new Callable<FetchOutcome>() {
                    @Override
                    public FetchOutcome call() {
                        return fetchFeedWithCache(appContext, feed);
                    }
                }));
            }
            Map<String, List<AutoAudioStore.EpisodeEntry>> collected = new HashMap<>();
            int totalEpisodes = 0;
            boolean anyReachable = false;
            for (Map.Entry<String, Future<FetchOutcome>> entry : futures.entrySet()) {
                try {
                    FetchOutcome outcome = entry.getValue().get(14, TimeUnit.SECONDS);
                    if (outcome == null) continue;
                    if (outcome.notModified) {
                        anyReachable = true;
                    } else if (!outcome.episodes.isEmpty()) {
                        anyReachable = true;
                        collected.put(entry.getKey(), outcome.episodes);
                        totalEpisodes += outcome.episodes.size();
                    }
                } catch (Exception ignored) {}
            }
            if (!collected.isEmpty()) {
                store.saveFetchedFeedEpisodes(collected);
                OpenNewsAutoMediaService.notifyLibraryChanged(appContext, OpenNewsAutoMediaService.TAB_UPDATES);
                OpenNewsAutoMediaService.notifyLibraryChanged(appContext, OpenNewsAutoMediaService.TAB_PODCASTS);
            } else if (anyReachable) {
                store.touchLastRefreshAt();
            }
            return totalEpisodes;
        } finally {
            pool.shutdownNow();
        }
    }

    private static final class FetchOutcome {
        final List<AutoAudioStore.EpisodeEntry> episodes;
        final boolean notModified;

        FetchOutcome(List<AutoAudioStore.EpisodeEntry> episodes, boolean notModified) {
            this.episodes = episodes;
            this.notModified = notModified;
        }
    }

    static List<AutoAudioStore.EpisodeEntry> fetchFeed(AutoAudioStore.FeedEntry feed) {
        if (feed == null || !feed.url.startsWith("https://")) return new ArrayList<>();
        FetchOutcome outcome = downloadAndParse(null, feed);
        return outcome.episodes;
    }

    private static FetchOutcome fetchFeedWithCache(Context context, AutoAudioStore.FeedEntry feed) {
        if (feed == null || !feed.url.startsWith("https://")) {
            return new FetchOutcome(new ArrayList<>(), false);
        }
        return downloadAndParse(context, feed);
    }

    private static FetchOutcome downloadAndParse(Context context, AutoAudioStore.FeedEntry feed) {
        SharedPreferences httpCache = context != null
            ? context.getSharedPreferences(HTTP_CACHE_PREF, Context.MODE_PRIVATE)
            : null;
        String cachedEtag = "";
        String cachedLastModified = "";
        if (httpCache != null) {
            try {
                JSONObject cacheMeta = new JSONObject(httpCache.getString(feed.url, "{}"));
                cachedEtag = cacheMeta.optString("etag");
                cachedLastModified = cacheMeta.optString("lastModified");
            } catch (JSONException ignored) {}
        }

        String current = feed.url;
        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
            if (current == null || !current.startsWith("https://")) {
                return new FetchOutcome(new ArrayList<>(), false);
            }
            HttpURLConnection conn = null;
            try {
                URL url = new URL(current);
                if (!isPublicHost(url.getHost())) {
                    return new FetchOutcome(new ArrayList<>(), false);
                }
                conn = (HttpURLConnection) url.openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(READ_TIMEOUT_MS);
                conn.setRequestProperty("User-Agent", "OpenNews-AndroidAuto/1.0");
                conn.setRequestProperty("Accept", "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5");
                if (redirect == 0 && !cachedEtag.isEmpty()) {
                    conn.setRequestProperty("If-None-Match", cachedEtag);
                }
                if (redirect == 0 && !cachedLastModified.isEmpty()) {
                    conn.setRequestProperty("If-Modified-Since", cachedLastModified);
                }

                int code = conn.getResponseCode();
                if (code == HttpURLConnection.HTTP_NOT_MODIFIED) {
                    return new FetchOutcome(new ArrayList<>(), true);
                }
                if (code >= 300 && code < 400) {
                    String location = conn.getHeaderField("Location");
                    if (location == null || location.isEmpty()) {
                        return new FetchOutcome(new ArrayList<>(), false);
                    }
                    URL resolved = new URL(url, location);
                    current = resolved.toString();
                    continue;
                }
                if (code < 200 || code >= 300) {
                    return new FetchOutcome(new ArrayList<>(), false);
                }

                String nextEtag = conn.getHeaderField("ETag");
                String nextLastModified = conn.getHeaderField("Last-Modified");
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
                    String xml = out.toString(StandardCharsets.UTF_8.name());
                    List<AutoAudioStore.EpisodeEntry> parsed = parsePodcastXml(feed, xml);
                    if (httpCache != null && !parsed.isEmpty() && ((nextEtag != null && !nextEtag.isEmpty()) || (nextLastModified != null && !nextLastModified.isEmpty()))) {
                        saveHttpCacheEntry(httpCache, feed.url, nextEtag, nextLastModified);
                    }
                    return new FetchOutcome(parsed, false);
                }
            } catch (Exception ignored) {
                return new FetchOutcome(new ArrayList<>(), false);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
        return new FetchOutcome(new ArrayList<>(), false);
    }

    private static synchronized void saveHttpCacheEntry(SharedPreferences cache, String url, String etag, String lastModified) {
        try {
            if (cache.getAll().size() >= MAX_HTTP_CACHE_ENTRIES && !cache.contains(url)) {
                cache.edit().clear().apply();
            }
            JSONObject obj = new JSONObject();
            if (etag != null && !etag.isEmpty()) obj.put("etag", etag);
            if (lastModified != null && !lastModified.isEmpty()) obj.put("lastModified", lastModified);
            cache.edit().putString(url, obj.toString()).apply();
        } catch (JSONException ignored) {}
    }

    private static boolean isPublicHost(String host) {
        if (host == null || host.isEmpty()) return false;
        String lower = host.toLowerCase(Locale.ROOT);
        if ("localhost".equals(lower) || lower.endsWith(".local") || lower.endsWith(".internal")) return false;
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            if (addresses.length == 0) return false;
            for (InetAddress addr : addresses) {
                if (addr.isAnyLocalAddress() || addr.isLoopbackAddress() || addr.isLinkLocalAddress()
                    || addr.isSiteLocalAddress() || addr.isMulticastAddress()) {
                    return false;
                }
            }
            return true;
        } catch (Exception ignored) {
            return false;
        }
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
        String decoded = decodeEntities(noHtml);
        return WHITESPACE.matcher(decoded).replaceAll(" ").trim();
    }

    private static String decodeEntities(String input) {
        String result = input
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")
            .replace("&#39;", "'")
            .replace("&nbsp;", " ")
            .replace("&ndash;", "–")
            .replace("&mdash;", "—")
            .replace("&hellip;", "…")
            .replace("&bdquo;", "„")
            .replace("&ldquo;", "“")
            .replace("&rdquo;", "”")
            .replace("&lsquo;", "‘")
            .replace("&rsquo;", "’")
            .replace("&laquo;", "«")
            .replace("&raquo;", "»")
            .replace("&euro;", "€")
            .replace("&auml;", "ä")
            .replace("&ouml;", "ö")
            .replace("&uuml;", "ü")
            .replace("&Auml;", "Ä")
            .replace("&Ouml;", "Ö")
            .replace("&Uuml;", "Ü")
            .replace("&szlig;", "ß");
        if (!result.contains("&#")) return result;
        Matcher matcher = NUMERIC_ENTITY.matcher(result);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String token = matcher.group(1);
            try {
                int code = token.startsWith("x") || token.startsWith("X")
                    ? Integer.parseInt(token.substring(1), 16)
                    : Integer.parseInt(token, 10);
                if (Character.isValidCodePoint(code)) {
                    matcher.appendReplacement(sb, Matcher.quoteReplacement(new String(Character.toChars(code))));
                    continue;
                }
            } catch (NumberFormatException ignored) {}
            matcher.appendReplacement(sb, Matcher.quoteReplacement(matcher.group(0)));
        }
        matcher.appendTail(sb);
        return sb.toString();
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
