package io.opennews.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

public class NotificationActionReceiver extends BroadcastReceiver {
    static final String ACTION_SAVE = "io.opennews.app.NOTIF_SAVE";
    static final String EXTRA_NOTIF_ID = "notifId";
    static final String EXTRA_ARTICLE_ID = "articleId";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_SUMMARY = "summary";
    static final String EXTRA_SOURCE = "source";
    static final String EXTRA_LINK = "link";
    static final String EXTRA_IMAGE = "image";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String token = intent.getStringExtra(NewsPush.EXTRA_TOKEN);
        if (!NewsPush.launchToken(context).equals(token)) return;
        if (!ACTION_SAVE.equals(intent.getAction())) return;

        String tag = intent.getStringExtra(EXTRA_NOTIF_ID);
        String articleId = intent.getStringExtra(EXTRA_ARTICLE_ID);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null && tag != null) {
            manager.cancel(tag, NewsMessagingService.NOTIFICATION_ID);
        }
        if (articleId == null || articleId.isEmpty()) return;

        try {
            SharedPreferences prefs = NewsMessagingService.preferences(context);
            JSONArray pending = new JSONArray(prefs.getString("pendingSaves", "[]"));
            JSONObject item = new JSONObject();
            item.put("id", articleId);
            item.put("title", intent.getStringExtra(EXTRA_TITLE));
            item.put("summary", intent.getStringExtra(EXTRA_SUMMARY));
            item.put("sourceName", intent.getStringExtra(EXTRA_SOURCE));
            item.put("link", intent.getStringExtra(EXTRA_LINK));
            item.put("imageUrl", intent.getStringExtra(EXTRA_IMAGE));
            pending.put(item);
            prefs.edit().putString("pendingSaves", pending.toString()).apply();
        } catch (Exception ignored) {
            // Ignore malformed notification save payload
        }
    }
}
