package io.opennews.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class NewsMessagingService extends FirebaseMessagingService {
    static final String CHANNEL_BREAKING = "opennews_breaking";
    static final String CHANNEL_NEWS = "opennews_news";
    static final int NOTIFICATION_ID = 1;

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("opennews_push", Context.MODE_PRIVATE);
    }

    static boolean isBreakingTitle(String title) {
        if (title == null || title.isEmpty()) return false;
        String lower = title.toLowerCase(Locale.ROOT);
        return lower.startsWith("eilmeldung")
            || lower.contains("eilmeldung:")
            || lower.startsWith("breaking")
            || lower.contains("breaking news")
            || lower.contains("+++")
            || lower.startsWith("liveblog:")
            || lower.startsWith("flash:")
            || lower.startsWith("urgent:");
    }

    static boolean isWithinActiveWindow(String from, String until, String nowHHmm) {
        String safeFrom = (from == null || from.isEmpty()) ? "00:00" : from;
        String safeUntil = (until == null || until.isEmpty()) ? "23:59" : until;
        String safeNow = (nowHHmm == null || nowHHmm.isEmpty()) ? "12:00" : nowHHmm;
        boolean afterStart = safeNow.compareTo(safeFrom) >= 0;
        boolean beforeEnd = safeNow.compareTo(safeUntil) <= 0;
        return safeFrom.compareTo(safeUntil) <= 0
            ? (afterStart && beforeEnd)
            : (afterStart || beforeEnd);
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        var data = message.getData();
        String source = data.get("source");
        String title = data.get("title");
        String id = data.get("id");
        if (source == null || title == null || id == null) return;
        var preferences = preferences(this);
        if (!preferences.getBoolean("enabled", false)
            || !preferences.getStringSet("desired", Collections.emptySet()).contains("opennews_" + source)) return;
        boolean breaking = "true".equals(data.get("breaking")) || isBreakingTitle(title);
        if (preferences.getBoolean("breakingOnly", true)) {
            if (!breaking) return;
        } else {
            try {
                JSONArray categories = new JSONArray(preferences.getString("categories", "[]"));
                boolean matches = categories.length() == 0;
                for (int i = 0; i < categories.length(); i++) {
                    matches |= categories.getString(i).equals(data.get("category"));
                }
                if (!matches) return;
            } catch (JSONException exception) {
                return;
            }
        }
        String now = new SimpleDateFormat("HH:mm", Locale.ROOT).format(new Date());
        if (!isWithinActiveWindow(preferences.getString("from", "00:00"), preferences.getString("until", "23:59"), now)) {
            return;
        }
        String imageUrl = data.get("imageUrl");
        if (imageUrl != null && !imageUrl.isEmpty()) {
            WidgetImageCache.downloadThumbnailSync(this, imageUrl);
        }
        showRich(
            this,
            id,
            title,
            data.get("summary"),
            data.getOrDefault("sourceName", "OpenNews"),
            data.get("link"),
            imageUrl,
            breaking
        );
    }

    static void ensureChannels(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < 26 || manager == null) return;
        NotificationChannel breakingChannel = new NotificationChannel(
            CHANNEL_BREAKING,
            "Eilmeldungen",
            NotificationManager.IMPORTANCE_HIGH
        );
        breakingChannel.setDescription("Wichtige Eilmeldungen und aktuelle Krisennachrichten");
        breakingChannel.enableVibration(true);
        manager.createNotificationChannel(breakingChannel);

        NotificationChannel newsChannel = new NotificationChannel(
            CHANNEL_NEWS,
            "Neue Meldungen",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        newsChannel.setDescription("Ausgewählte neue Nachrichten aus deinen abonnierten Quellen");
        manager.createNotificationChannel(newsChannel);
    }

    static void show(Context context, String id, String title, String source) {
        showRich(context, id, title, null, source, null, null, isBreakingTitle(title));
    }

    static void showRich(
        Context context,
        String id,
        String title,
        String summary,
        String source,
        String link,
        String imageUrl,
        boolean breaking
    ) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || !manager.areNotificationsEnabled()) return;
        ensureChannels(manager);

        String channel = breaking ? CHANNEL_BREAKING : CHANNEL_NEWS;
        String safeTitle = (title == null || title.isEmpty()) ? "OpenNews" : title;
        String safeSource = (source == null || source.isEmpty()) ? "OpenNews" : source;
        String safeSummary = (summary != null && !summary.isEmpty() && !summary.equalsIgnoreCase(safeTitle)) ? summary : "";
        String token = NewsPush.launchToken(context);

        JSONObject payload = new JSONObject();
        try {
            payload.put("id", id);
            payload.put("title", safeTitle);
            payload.put("summary", safeSummary);
            payload.put("sourceName", safeSource);
            if (link != null && !link.isEmpty()) payload.put("link", link);
            if (imageUrl != null && !imageUrl.isEmpty()) payload.put("imageUrl", imageUrl);
            payload.put("isBreaking", breaking);
        } catch (JSONException ignored) {}

        int requestCode = id != null ? id.hashCode() : 0;
        Intent open = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(NewsPush.EXTRA_TOKEN, token)
            .putExtra(NewsPush.EXTRA_NOTIFICATION_PAYLOAD, payload.toString());
        PendingIntent tap = PendingIntent.getActivity(
            context,
            requestCode,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_opennews)
            .setContentTitle(safeTitle)
            .setContentText(safeSummary.isEmpty() ? safeSource : safeSource + " · " + safeSummary)
            .setSubText(safeSource)
            .setContentIntent(tap)
            .setGroup("opennews_alerts")
            .setPriority(breaking ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(breaking ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_MESSAGE)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true);

        Bitmap thumb = (imageUrl != null && !imageUrl.isEmpty())
            ? WidgetImageCache.loadCachedBitmap(context, imageUrl)
            : null;
        if (thumb != null) {
            builder.setLargeIcon(thumb)
                .setStyle(new NotificationCompat.BigPictureStyle()
                    .bigPicture(thumb)
                    .bigLargeIcon((Bitmap) null)
                    .setSummaryText(safeSummary.isEmpty() ? safeSource : safeSummary));
        } else {
            builder.setStyle(new NotificationCompat.BigTextStyle()
                .bigText(safeSummary.isEmpty() ? safeTitle : safeSummary));
        }

        if (id != null && !id.isEmpty()) {
            Intent saveIntent = new Intent(context, NotificationActionReceiver.class)
                .setAction(NotificationActionReceiver.ACTION_SAVE)
                .putExtra(NewsPush.EXTRA_TOKEN, token)
                .putExtra(NotificationActionReceiver.EXTRA_NOTIF_ID, id)
                .putExtra(NotificationActionReceiver.EXTRA_ARTICLE_ID, id)
                .putExtra(NotificationActionReceiver.EXTRA_TITLE, safeTitle)
                .putExtra(NotificationActionReceiver.EXTRA_SUMMARY, safeSummary)
                .putExtra(NotificationActionReceiver.EXTRA_SOURCE, safeSource)
                .putExtra(NotificationActionReceiver.EXTRA_LINK, link != null ? link : "")
                .putExtra(NotificationActionReceiver.EXTRA_IMAGE, imageUrl != null ? imageUrl : "");
            PendingIntent savePending = PendingIntent.getBroadcast(
                context,
                requestCode + 1,
                saveIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            builder.addAction(0, "Merken", savePending);
        }

        if (link != null && (link.startsWith("https://") || link.startsWith("http://"))) {
            Intent sendIntent = new Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_SUBJECT, safeTitle)
                .putExtra(Intent.EXTRA_TEXT, safeTitle + "\n" + link);
            Intent chooser = Intent.createChooser(sendIntent, "Artikel teilen")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent sharePending = PendingIntent.getActivity(
                context,
                requestCode + 2,
                chooser,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            builder.addAction(0, "Teilen", sharePending);
        }

        manager.notify(id, NOTIFICATION_ID, builder.build());
    }
}
