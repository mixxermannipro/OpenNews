package io.opennews.app;

import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

public class WidgetFeedService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        int size = intent.getIntExtra("size", WidgetFeed.COMPACT);
        return new RemoteViewsFactory() {
            private volatile WidgetFeed feed;

            @Override public void onCreate() {}
            @Override public void onDestroy() {}

            @Override
            public void onDataSetChanged() {
                feed = new WidgetFeed(WidgetFeedService.this, OpenNewsWidget.readSnapshot(WidgetFeedService.this), id);
            }

            @Override public int getCount() { return feed == null ? 0 : feed.stories.size(); }

            @Override
            public RemoteViews getViewAt(int position) {
                WidgetFeed current = feed;
                if (current == null || position < 0 || position >= current.stories.size()) return null;
                return current.row(position, size, getResources().getConfiguration().fontScale);
            }

            @Override public RemoteViews getLoadingView() { return null; }
            @Override public int getViewTypeCount() { return 1; }

            @Override
            public long getItemId(int position) {
                WidgetFeed current = feed;
                if (current == null || position < 0 || position >= current.stories.size()) return position;
                return WidgetFeed.stableId(current.stories.get(position));
            }

            @Override public boolean hasStableIds() { return true; }
        };
    }
}
