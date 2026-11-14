package io.opennews.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class OpenNewsWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        String headlines = context.getSharedPreferences("opennews-widget", Context.MODE_PRIVATE)
            .getString("headlines", "");
        for (int widgetId : widgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.opennews_widget);
            views.setTextViewText(R.id.opennews_widget_headlines, headlines.isEmpty()
                ? "Öffne OpenNews, um die Top-Themen zu laden." : headlines);
            PendingIntent open = PendingIntent.getActivity(context, 0,
                new Intent(context, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.opennews_widget_root, open);
            manager.updateAppWidget(widgetId, views);
        }
    }
}
