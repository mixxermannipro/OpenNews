package io.opennews.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Collections;
import org.json.JSONArray;
import org.json.JSONException;

public class NewsMessagingService extends FirebaseMessagingService {
    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("opennews_push", Context.MODE_PRIVATE);
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
        if (preferences.getBoolean("breakingOnly", true)) {
            if (!"true".equals(data.get("breaking"))) return;
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
        String from = preferences.getString("from", "00:00");
        String until = preferences.getString("until", "23:59");
        boolean afterStart = now.compareTo(from) >= 0;
        boolean beforeEnd = now.compareTo(until) <= 0;
        if (from.compareTo(until) <= 0 ? !(afterStart && beforeEnd) : !(afterStart || beforeEnd)) return;
        show(this, id, title, data.getOrDefault("sourceName", "OpenNews"));
    }

    static void show(Context context, String id, String title, String source) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (!manager.areNotificationsEnabled()) return;
        String channel = "opennews_news";
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(channel, "Neue Meldungen", NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE);
        var notification = new NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_opennews)
            .setContentTitle(title)
            .setContentText(source)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(title))
            .setContentIntent(tap)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .build();
        manager.notify(id, 1, notification);
    }
}
