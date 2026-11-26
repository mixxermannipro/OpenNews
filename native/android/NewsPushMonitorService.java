package io.opennews.app;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class NewsPushMonitorService extends JobService {
    static final int JOB_ID = 4110;
    private static final int DEFAULT_INTERVAL_MINUTES = 30;
    private static final int MAX_SEEN_IDS = 250;
    private static final long MAX_ARTICLE_AGE_MS = 3L * 60L * 60L * 1000L;
    private static final int MAX_NOTIFICATIONS_PER_RUN = 2;

    private final AtomicBoolean cancelled = new AtomicBoolean(false);
    private volatile ExecutorService runner;

    static int clampIntervalMinutes(int minutes) {
        return minutes >= 45 ? 60 : 30;
    }

    static void sync(Context context) {
        if (context == null) return;
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler == null) return;
        SharedPreferences prefs = NewsMessagingService.preferences(context);
        boolean enabled = prefs.getBoolean("enabled", false);
        if (!enabled) {
            scheduler.cancel(JOB_ID);
            prefs.edit().remove("scheduledIntervalMinutes").apply();
            return;
        }
        int interval = clampIntervalMinutes(prefs.getInt("intervalMinutes", DEFAULT_INTERVAL_MINUTES));
        int current = prefs.getInt("scheduledIntervalMinutes", -1);
        if (current == interval && scheduler.getPendingJob(JOB_ID) != null) {
            return;
        }
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(context, NewsPushMonitorService.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPeriodic(interval * 60_000L)
            .setPersisted(true)
            .build();
        if (scheduler.schedule(job) == JobScheduler.RESULT_SUCCESS) {
            prefs.edit().putInt("scheduledIntervalMinutes", interval).apply();
        }
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        final Context appContext = getApplicationContext();
        try {
            SharedPreferences prefs = NewsMessagingService.preferences(this);
            if (!prefs.getBoolean("enabled", false)) {
                jobFinished(params, false);
                return false;
            }
            String nowHHmm = new SimpleDateFormat("HH:mm", Locale.ROOT).format(new Date());
            String from = prefs.getString("from", "00:00");
            String until = prefs.getString("until", "23:59");
            if (!NewsMessagingService.isWithinActiveWindow(from, until, nowHHmm)) {
                jobFinished(params, false);
                return false;
            }

            cancelled.set(false);
            ExecutorService executor = Executors.newSingleThreadExecutor();
            runner = executor;
            executor.execute(() -> {
                try {
                    runCheck(appContext, cancelled);
                } catch (Throwable error) {
                    NativeDiagnostics.record(appContext, "push_monitor", error);
                } finally {
                    jobFinished(params, false);
                    executor.shutdown();
                }
            });
            return true;
        } catch (Throwable error) {
            NativeDiagnostics.record(appContext, "push_monitor_start", error);
            jobFinished(params, false);
            return false;
        }
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        cancelled.set(true);
        ExecutorService executor = runner;
        if (executor != null) executor.shutdownNow();
        return true;
    }

    static void runCheck(Context context, AtomicBoolean cancelledFlag) {
        SharedPreferences prefs = NewsMessagingService.preferences(context);
        SharedPreferences widgetStore = OpenNewsWidget.store(context);
        JSONArray feeds = parseJsonArray(prefs.getString("feeds", ""));
        if (feeds.length() == 0) {
            feeds = WidgetRefreshService.readFeeds(widgetStore);
        }
        if (feeds.length() == 0) return;

        List<String> muted = WidgetRefreshService.readMutedKeywords(widgetStore);
        List<String> pushMuted = parseStringList(prefs.getString("mutedKeywords", "[]"));
        if (!pushMuted.isEmpty()) {
            List<String> mergedMuted = new ArrayList<>(muted);
            mergedMuted.addAll(pushMuted);
            muted = mergedMuted;
        }

        List<JSONObject> fetched = WidgetRefreshService.fetchFeedsOnce(widgetStore, feeds, muted, cancelledFlag);
        if (cancelledFlag != null && cancelledFlag.get() || fetched.isEmpty()) return;

        fetched.sort(Comparator.comparingLong((JSONObject o) -> WidgetRefreshService.parseIsoMillis(o.optString("publishedAt"))).reversed());

        boolean seeded = prefs.getBoolean("monitorSeeded", false);
        JSONArray seenArray = parseJsonArray(prefs.getString("seenIds", "[]"));
        Set<String> seenSet = new HashSet<>();
        List<String> seenOrder = new ArrayList<>();
        for (int i = 0; i < seenArray.length(); i++) {
            String key = seenArray.optString(i);
            if (!key.isEmpty() && seenSet.add(key)) {
                seenOrder.add(key);
            }
        }

        boolean breakingOnly = prefs.getBoolean("breakingOnly", true);
        Set<String> allowedTopics = new HashSet<>(parseStringList(prefs.getString("categories", "[]")));
        long nowMs = System.currentTimeMillis();
        int sentCount = 0;

        for (JSONObject article : fetched) {
            String id = article.optString("id");
            if (id.isEmpty()) id = article.optString("link");
            if (id.isEmpty() || seenSet.contains(id)) continue;

            seenSet.add(id);
            seenOrder.add(id);

            if (!seeded) continue;

            long publishedMs = WidgetRefreshService.parseIsoMillis(article.optString("publishedAt"));
            long ageMs = nowMs - publishedMs;
            if (publishedMs <= 0 || ageMs < -300_000L || ageMs > MAX_ARTICLE_AGE_MS) continue;

            String title = article.optString("title");
            String summary = article.optString("summary");
            String sourceName = article.optString("sourceName", "OpenNews");
            String category = article.optString("category");
            boolean isBreaking = article.optBoolean("isBreaking") || NewsMessagingService.isBreakingTitle(title);

            if (breakingOnly && !isBreaking) continue;
            if (!breakingOnly && !allowedTopics.isEmpty() && !allowedTopics.contains(category)) continue;

            if (sentCount < MAX_NOTIFICATIONS_PER_RUN) {
                String imageUrl = article.optString("imageUrl");
                if (!imageUrl.isEmpty()) {
                    WidgetImageCache.downloadThumbnailSync(context, imageUrl);
                }
                NewsMessagingService.showRich(
                    context,
                    id,
                    title,
                    summary,
                    sourceName,
                    article.optString("link"),
                    imageUrl,
                    isBreaking
                );
                sentCount++;
            }
        }

        if (seenOrder.size() > MAX_SEEN_IDS) {
            seenOrder = seenOrder.subList(seenOrder.size() - MAX_SEEN_IDS, seenOrder.size());
        }
        prefs.edit()
            .putBoolean("monitorSeeded", true)
            .putString("seenIds", new JSONArray(seenOrder).toString())
            .putLong("lastCheckedAt", nowMs)
            .apply();
    }

    private static JSONArray parseJsonArray(String raw) {
        if (raw == null || raw.isEmpty()) return new JSONArray();
        try {
            return new JSONArray(raw);
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private static List<String> parseStringList(String raw) {
        List<String> list = new ArrayList<>();
        JSONArray arr = parseJsonArray(raw);
        for (int i = 0; i < arr.length(); i++) {
            String value = arr.optString(i).trim();
            if (!value.isEmpty()) list.add(value);
        }
        return list;
    }
}
