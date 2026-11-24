package io.opennews.app;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Xml;

import org.json.JSONArray;
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
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class WidgetRefreshService extends JobService {
    static final int JOB_ID = 4109;
    static final int DEFAULT_INTERVAL_MINUTES = 30;
    static final int[] INTERVAL_MINUTES = {0, 15, 30, 60, 120, 240};
    static final int[] INTERVAL_LABELS = {
        R.string.widget_refresh_off,
        R.string.widget_refresh_15m,
        R.string.widget_refresh_30m,
        R.string.widget_refresh_1h,
        R.string.widget_refresh_2h,
        R.string.widget_refresh_4h,
    };

    static final String PREF_REFRESH = "refresh-";
    static final String PREF_FEEDS = "feeds";
    static final String PREF_LAST_REFRESH = "last-bg-refresh";
    static final String PREF_SCHEDULED_INTERVAL = "scheduled-interval";

    private static final int MAX_FEEDS = 25;
    private static final int MAX_ITEMS_PER_FEED = 8;
    private static final int MAX_SECTION_ITEMS = 24;
    private static final int MAX_BODY_BYTES = 1024 * 1024;
    private static final int CONNECT_TIMEOUT_MS = 7000;
    private static final int READ_TIMEOUT_MS = 9000;
    private static final int MAX_REDIRECTS = 3;

    private static final Pattern HTML_TAG = Pattern.compile("<[^>]*>");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern NUMERIC_ENTITY = Pattern.compile("&#(x?[0-9a-fA-F]+);");

    private final AtomicBoolean cancelled = new AtomicBoolean(false);
    private volatile ExecutorService runner;

    static int intervalMinutes(SharedPreferences store, int widgetId) {
        int saved = store.getInt(PREF_REFRESH + widgetId, DEFAULT_INTERVAL_MINUTES);
        for (int candidate : INTERVAL_MINUTES) {
            if (candidate == saved) return saved;
        }
        return DEFAULT_INTERVAL_MINUTES;
    }

    static int intervalIndex(SharedPreferences store, int widgetId) {
        int minutes = intervalMinutes(store, widgetId);
        for (int i = 0; i < INTERVAL_MINUTES.length; i++) {
            if (INTERVAL_MINUTES[i] == minutes) return i;
        }
        return 2; // 30 minutes default
    }

    static void sync(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, OpenNewsWidget.class));
        SharedPreferences store = OpenNewsWidget.store(context);
        int shortestMinutes = 0;
        for (int id : ids) {
            int minutes = intervalMinutes(store, id);
            if (minutes > 0 && (shortestMinutes == 0 || minutes < shortestMinutes)) {
                shortestMinutes = minutes;
            }
        }
        if (ids.length == 0 || shortestMinutes <= 0) {
            cancel(context);
            return;
        }
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler == null) return;
        int scheduled = store.getInt(PREF_SCHEDULED_INTERVAL, 0);
        if (scheduled == shortestMinutes && scheduler.getPendingJob(JOB_ID) != null) {
            return;
        }
        long periodMs = Math.max(JobInfo.getMinPeriodMillis(), shortestMinutes * 60_000L);
        long flexMs = Math.max(JobInfo.getMinFlexMillis(), Math.min(periodMs / 4L, 15 * 60_000L));
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(context, WidgetRefreshService.class))
            .setPeriodic(periodMs, flexMs)
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPersisted(true)
            .setBackoffCriteria(5 * 60_000L, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
            .build();
        if (scheduler.schedule(job) == JobScheduler.RESULT_SUCCESS) {
            store.edit().putInt(PREF_SCHEDULED_INTERVAL, shortestMinutes).apply();
        }
    }

    static void cancel(Context context) {
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler != null) scheduler.cancel(JOB_ID);
        OpenNewsWidget.store(context).edit().remove(PREF_SCHEDULED_INTERVAL).apply();
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        Context appContext = getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(appContext);
        int[] ids = manager.getAppWidgetIds(new ComponentName(appContext, OpenNewsWidget.class));
        if (ids.length == 0) {
            cancel(appContext);
            return false;
        }
        SharedPreferences store = OpenNewsWidget.store(appContext);
        JSONArray feeds = readFeeds(store);
        if (feeds.length() == 0) {
            return false;
        }

        cancelled.set(false);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        runner = executor;
        executor.execute(() -> {
            try {
                boolean updated = refreshFeeds(appContext, store, feeds);
                if (updated && !cancelled.get()) {
                    new Handler(Looper.getMainLooper()).post(() -> {
                        AppWidgetManager wm = AppWidgetManager.getInstance(appContext);
                        int[] activeIds = wm.getAppWidgetIds(new ComponentName(appContext, OpenNewsWidget.class));
                        new OpenNewsWidget().updateWidgets(appContext, wm, activeIds, false);
                    });
                }
            } finally {
                jobFinished(params, false);
                executor.shutdown();
            }
        });
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        cancelled.set(true);
        ExecutorService executor = runner;
        if (executor != null) executor.shutdownNow();
        return true;
    }

    private static JSONArray readFeeds(SharedPreferences store) {
        try {
            return new JSONArray(store.getString(PREF_FEEDS, "[]"));
        } catch (JSONException ignored) {
            return new JSONArray();
        }
    }

    private boolean refreshFeeds(Context context, SharedPreferences store, JSONArray feeds) {
        int count = Math.min(feeds.length(), MAX_FEEDS);
        List<JSONObject> feedList = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            JSONObject feed = feeds.optJSONObject(i);
            if (feed != null && !feed.optString("url").isEmpty()) {
                feedList.add(feed);
            }
        }
        if (feedList.isEmpty()) return false;

        ExecutorService pool = Executors.newFixedThreadPool(Math.min(4, feedList.size()));
        List<Future<List<JSONObject>>> futures = new ArrayList<>(feedList.size());
        for (JSONObject feed : feedList) {
            futures.add(pool.submit(() -> fetchAndParseFeed(feed)));
        }

        List<JSONObject> fetched = new ArrayList<>();
        for (Future<List<JSONObject>> future : futures) {
            if (cancelled.get()) break;
            try {
                List<JSONObject> items = future.get(15, TimeUnit.SECONDS);
                if (items != null) fetched.addAll(items);
            } catch (Exception ignored) {
                // Skip individual failing feeds so healthy feeds still update the widget.
            }
        }
        pool.shutdownNow();

        if (cancelled.get() || fetched.isEmpty()) return false;

        JSONObject existing = OpenNewsWidget.readSnapshot(context);
        JSONObject merged = mergeIntoSnapshot(existing, fetched, System.currentTimeMillis());
        store.edit()
            .putString("snapshot", merged.toString())
            .putLong(PREF_LAST_REFRESH, System.currentTimeMillis())
            .apply();
        return true;
    }

    private List<JSONObject> fetchAndParseFeed(JSONObject source) {
        if (cancelled.get()) return Collections.emptyList();
        String rawUrl = source.optString("url");
        String body = fetchPublicUrl(rawUrl);
        if (body == null || body.isEmpty() || cancelled.get()) return Collections.emptyList();
        String trimmed = body.trim();
        if (trimmed.startsWith("{")) {
            return parseJsonFeed(trimmed, source);
        }
        return parseXmlFeed(trimmed, source);
    }

    private String fetchPublicUrl(String initialUrl) {
        String current = initialUrl;
        for (int hops = 0; hops <= MAX_REDIRECTS; hops++) {
            if (cancelled.get()) return null;
            HttpURLConnection conn = null;
            try {
                URL url = new URL(current);
                String protocol = url.getProtocol().toLowerCase(Locale.ROOT);
                if (!"https".equals(protocol) && !"http".equals(protocol)) return null;
                if (!isPublicHost(url.getHost())) return null;

                conn = (HttpURLConnection) url.openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(READ_TIMEOUT_MS);
                conn.setRequestProperty("User-Agent", "OpenNews-Widget/1.0");
                conn.setRequestProperty("Accept", "application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, application/json;q=0.9, */*;q=0.1");

                int status = conn.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = conn.getHeaderField("Location");
                    if (location == null || location.isEmpty()) return null;
                    current = new URL(url, location).toString();
                    continue;
                }
                if (status < 200 || status >= 300) return null;

                try (InputStream in = conn.getInputStream()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buffer = new byte[8192];
                    int read;
                    int total = 0;
                    while ((read = in.read(buffer)) != -1) {
                        if (cancelled.get()) return null;
                        total += read;
                        if (total > MAX_BODY_BYTES) break;
                        out.write(buffer, 0, read);
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

    static List<JSONObject> parseJsonFeed(String json, JSONObject source) {
        List<JSONObject> results = new ArrayList<>();
        try {
            JSONObject root = new JSONObject(json);
            JSONArray items = root.optJSONArray("items");
            if (items == null) return results;
            for (int i = 0; i < items.length() && results.size() < MAX_ITEMS_PER_FEED; i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                String title = cleanText(item.optString("title"));
                String link = item.optString("url");
                if (link.isEmpty()) link = item.optString("external_url");
                String id = item.optString("id");
                String summary = cleanText(item.optString("summary"));
                if (summary.isEmpty()) summary = cleanText(item.optString("content_text"));
                if (summary.isEmpty()) summary = cleanText(item.optString("content_html"));
                String dateStr = item.optString("date_published");
                if (dateStr.isEmpty()) dateStr = item.optString("date_modified");
                JSONObject article = buildArticle(source, id, title, summary, link, dateStr);
                if (article != null) results.add(article);
            }
        } catch (Exception ignored) {
            // Invalid JSON feed
        }
        return results;
    }

    static List<JSONObject> parseXmlFeed(String xml, JSONObject source) {
        List<JSONObject> results = new ArrayList<>();
        try {
            XmlPullParser parser = Xml.newPullParser();
            parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false);
            parser.setInput(new StringReader(xml));

            boolean inEntry = false;
            String title = "", link = "", id = "", summary = "", published = "";
            String currentTag = null;

            int event = parser.getEventType();
            while (event != XmlPullParser.END_DOCUMENT && results.size() < MAX_ITEMS_PER_FEED) {
                if (event == XmlPullParser.START_TAG) {
                    String name = localName(parser.getName());
                    if ("item".equals(name) || "entry".equals(name)) {
                        inEntry = true;
                        title = ""; link = ""; id = ""; summary = ""; published = "";
                        currentTag = null;
                    } else if (inEntry) {
                        currentTag = name;
                        if ("link".equals(name)) {
                            String href = parser.getAttributeValue(null, "href");
                            String rel = parser.getAttributeValue(null, "rel");
                            if (href != null && !href.isEmpty() && (rel == null || "alternate".equals(rel) || link.isEmpty())) {
                                link = href.trim();
                            }
                        }
                    }
                } else if (event == XmlPullParser.TEXT && inEntry && currentTag != null) {
                    String text = parser.getText();
                    if (text != null) {
                        switch (currentTag) {
                            case "title":
                                title += text;
                                break;
                            case "link":
                                if (link.isEmpty()) link += text;
                                break;
                            case "guid":
                            case "id":
                                id += text;
                                break;
                            case "description":
                            case "summary":
                            case "encoded":
                            case "content":
                                if (summary.length() < 800) summary += text;
                                break;
                            case "pubdate":
                            case "published":
                            case "updated":
                            case "date":
                                if (published.isEmpty()) published = text.trim();
                                break;
                            default:
                                break;
                        }
                    }
                } else if (event == XmlPullParser.END_TAG) {
                    String name = localName(parser.getName());
                    if ("item".equals(name) || "entry".equals(name)) {
                        if (inEntry) {
                            JSONObject article = buildArticle(source, id.trim(), cleanText(title), cleanText(summary), link.trim(), published.trim());
                            if (article != null) results.add(article);
                        }
                        inEntry = false;
                        currentTag = null;
                    } else if (inEntry && name.equals(currentTag)) {
                        currentTag = null;
                    }
                }
                event = parser.next();
            }
        } catch (Exception ignored) {
            // Malformed XML
        }
        return results;
    }

    private static String localName(String raw) {
        if (raw == null) return "";
        int colon = raw.indexOf(':');
        return (colon >= 0 ? raw.substring(colon + 1) : raw).toLowerCase(Locale.ROOT);
    }

    private static JSONObject buildArticle(JSONObject source, String rawId, String title, String summary, String link, String rawDate) {
        if (title.isEmpty()) return null;
        if (link.isEmpty()) link = source.optString("url");
        String sourceId = source.optString("id");
        String articleId = !rawId.isEmpty() ? rawId : (sourceId + ":" + (!link.isEmpty() ? link : title));
        if (summary.length() > 400) summary = summary.substring(0, 400).trim();
        long publishedMs = parseDateMillis(rawDate);
        String isoDate = formatIsoUtc(publishedMs > 0 ? publishedMs : System.currentTimeMillis());

        try {
            JSONObject obj = new JSONObject();
            obj.put("id", articleId);
            obj.put("sourceId", sourceId);
            obj.put("sourceName", source.optString("name", sourceId));
            obj.put("sourceShortCode", source.optString("shortCode", sourceId.length() >= 2 ? sourceId.substring(0, 2).toUpperCase(Locale.ROOT) : "ON"));
            obj.put("sourceColor", source.optString("accentColor", "#23262e"));
            obj.put("title", title);
            obj.put("summary", summary);
            obj.put("paragraphs", new JSONArray());
            obj.put("link", link);
            obj.put("category", source.optString("category", "Politik"));
            obj.put("publishedAt", isoDate);
            obj.put("readingTimeMin", 2);
            obj.put("keywords", new JSONArray());
            return obj;
        } catch (JSONException ignored) {
            return null;
        }
    }

    static JSONObject mergeIntoSnapshot(JSONObject existing, List<JSONObject> fetched, long nowMs) {
        Set<String> savedIds = new HashSet<>();
        Map<String, JSONObject> existingByKey = new HashMap<>();
        List<JSONObject> existingPersonal = new ArrayList<>();

        for (String section : OpenNewsWidget.SECTIONS) {
            JSONArray arr = existing.optJSONArray(section);
            if (arr == null) continue;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject item = arr.optJSONObject(i);
                if (item == null) continue;
                String id = item.optString("id");
                if (item.optBoolean("widgetSaved") && !id.isEmpty()) savedIds.add(id);
                String key = dedupeKey(item);
                if (!key.isEmpty() && !existingByKey.containsKey(key)) {
                    existingByKey.put(key, item);
                }
                if ("personal".equals(section)) existingPersonal.add(item);
            }
        }

        // Combine fetched (taking precedence for freshness) and existing articles
        Map<String, JSONObject> pool = new HashMap<>(existingByKey);
        for (JSONObject item : fetched) {
            String key = dedupeKey(item);
            if (key.isEmpty()) continue;
            String id = item.optString("id");
            JSONObject prior = existingByKey.get(key);
            if (prior != null && prior.optBoolean("widgetSaved")) {
                try { item.put("widgetSaved", true); } catch (JSONException ignored) {}
            } else if (savedIds.contains(id)) {
                try { item.put("widgetSaved", true); } catch (JSONException ignored) {}
            }
            pool.put(key, item);
        }

        List<JSONObject> all = new ArrayList<>(pool.values());
        all.sort((a, b) -> Long.compare(parseIsoMillis(b.optString("publishedAt")), parseIsoMillis(a.optString("publishedAt"))));

        Calendar midnight = Calendar.getInstance();
        midnight.setTimeInMillis(nowMs);
        midnight.set(Calendar.HOUR_OF_DAY, 0);
        midnight.set(Calendar.MINUTE, 0);
        midnight.set(Calendar.SECOND, 0);
        midnight.set(Calendar.MILLISECOND, 0);
        long todayStartMs = midnight.getTimeInMillis();

        JSONArray latestArr = new JSONArray();
        JSONArray todayArr = new JSONArray();
        for (JSONObject item : all) {
            if (latestArr.length() < MAX_SECTION_ITEMS) latestArr.put(item);
            long ts = parseIsoMillis(item.optString("publishedAt"));
            if (ts >= todayStartMs && todayArr.length() < MAX_SECTION_ITEMS) {
                todayArr.put(item);
            }
        }
        if (todayArr.length() == 0) {
            for (int i = 0; i < latestArr.length(); i++) {
                todayArr.put(latestArr.optJSONObject(i));
            }
        }

        // Keep fresh fetched items at the top of personal, followed by prior personalized stories
        JSONArray personalArr = new JSONArray();
        Set<String> seenPersonal = new HashSet<>();
        for (JSONObject item : all) {
            if (personalArr.length() >= MAX_SECTION_ITEMS) break;
            String key = dedupeKey(item);
            if (!existingByKey.containsKey(key) && seenPersonal.add(key)) {
                personalArr.put(item);
            }
        }
        for (JSONObject item : existingPersonal) {
            if (personalArr.length() >= MAX_SECTION_ITEMS) break;
            String key = dedupeKey(item);
            if (seenPersonal.add(key)) {
                JSONObject fresh = pool.get(key);
                personalArr.put(fresh != null ? fresh : item);
            }
        }
        for (JSONObject item : all) {
            if (personalArr.length() >= MAX_SECTION_ITEMS) break;
            String key = dedupeKey(item);
            if (seenPersonal.add(key)) personalArr.put(item);
        }

        JSONObject next = new JSONObject();
        try {
            next.put("today", todayArr);
            next.put("personal", personalArr);
            next.put("latest", latestArr);
            String language = existing.optString("language");
            if (!language.isEmpty()) next.put("language", language);
            String theme = existing.optString("theme");
            if (!theme.isEmpty()) next.put("theme", theme);
        } catch (JSONException ignored) {}
        return next;
    }

    private static String dedupeKey(JSONObject item) {
        String link = item.optString("link").trim();
        if (!link.isEmpty()) return "url:" + link;
        String id = item.optString("id").trim();
        return id.isEmpty() ? "" : "id:" + id;
    }

    static String cleanText(String raw) {
        if (raw == null || raw.isEmpty()) return "";
        String noTags = HTML_TAG.matcher(raw).replaceAll(" ");
        String decoded = decodeEntities(noTags);
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
            .replace("&mdash;", "—");
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

    static long parseDateMillis(String raw) {
        if (raw == null || raw.isEmpty()) return 0;
        String cleaned = raw.trim().replaceFirst("\\.\\d+(?=Z|[+-])", "");
        String[] patterns = {
            "yyyy-MM-dd'T'HH:mm:ssXXX",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd HH:mm:ssXXX",
            "yyyy-MM-dd HH:mm:ss",
            "EEE, dd MMM yyyy HH:mm:ss Z",
            "EEE, d MMM yyyy HH:mm:ss Z",
            "EEE, dd MMM yyyy HH:mm:ss z",
            "EEE, d MMM yyyy HH:mm:ss z",
            "dd MMM yyyy HH:mm:ss Z",
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat fmt = new SimpleDateFormat(pattern, Locale.US);
                fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
                fmt.setLenient(false);
                Date parsed = fmt.parse(cleaned);
                if (parsed != null) return parsed.getTime();
            } catch (ParseException ignored) {}
        }
        return 0;
    }

    private static long parseIsoMillis(String iso) {
        long ms = parseDateMillis(iso);
        return ms > 0 ? ms : 0;
    }

    private static String formatIsoUtc(long millis) {
        SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.ROOT);
        iso.setTimeZone(TimeZone.getTimeZone("UTC"));
        return iso.format(new Date(millis));
    }
}
