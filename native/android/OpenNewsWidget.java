package io.opennews.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class OpenNewsWidget extends AppWidgetProvider {
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int widgetId, Bundle options) {
        onUpdate(context, manager, new int[] {widgetId});
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        String raw = context.getSharedPreferences("opennews-widget", Context.MODE_PRIVATE).getString("stories", "[]");
        JSONArray stories;
        try {
            stories = new JSONArray(raw);
        } catch (JSONException ignored) {
            stories = new JSONArray();
        }
        JSONObject lead = stories.optJSONObject(0);
        JSONObject next = stories.optJSONObject(1);
        PendingIntent open = PendingIntent.getActivity(context, 0,
            new Intent(context, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        for (int widgetId : widgetIds) {
            int height = manager.getAppWidgetOptions(widgetId).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.opennews_widget);
            views.setTextViewText(R.id.opennews_widget_headlines, lead == null
                ? "Top-Themen für deinen Startbildschirm" : lead.optString("title"));
            views.setTextViewText(R.id.opennews_widget_source, lead == null
                ? "Öffne OpenNews, um Meldungen zu laden." : lead.optString("source"));
            boolean hasPhoto = lead != null && height >= 168;
            views.setViewVisibility(R.id.opennews_widget_image, hasPhoto ? View.VISIBLE : View.GONE);
            if (hasPhoto) views.setImageViewResource(R.id.opennews_widget_image, illustration(lead.optString("category")));
            boolean hasNext = next != null && height >= 228;
            views.setViewVisibility(R.id.opennews_widget_divider, hasNext ? View.VISIBLE : View.GONE);
            views.setViewVisibility(R.id.opennews_widget_next, hasNext ? View.VISIBLE : View.GONE);
            if (hasNext) views.setTextViewText(R.id.opennews_widget_next, next.optString("title"));
            views.setOnClickPendingIntent(R.id.opennews_widget_root, open);
            manager.updateAppWidget(widgetId, views);
        }
    }

    private int illustration(String category) {
        switch (category) {
            case "Politik": return R.drawable.widget_politik;
            case "Europa": return R.drawable.widget_europa;
            case "Technologie": return R.drawable.widget_technologie;
            case "Wissenschaft": return R.drawable.widget_wissenschaft;
            default: return R.drawable.widget_wirtschaft;
        }
    }
}
