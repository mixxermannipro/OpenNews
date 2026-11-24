package io.opennews.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;

import io.opennews.app.WidgetFeed.Tone;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class OpenNewsWidget extends AppWidgetProvider {
    private static final String PICK = "io.opennews.app.WIDGET_PICK";
    static final String[] SECTIONS = {"today", "personal", "latest"};
    static final int[] SECTION_LABELS = {R.string.widget_today, R.string.widget_personal, R.string.widget_latest};
    private static final int[] TABS = {R.id.widget_tab_0, R.id.widget_tab_1, R.id.widget_tab_2};

    static SharedPreferences store(Context context) {
        return context.getSharedPreferences(NewsWidget.STORE, Context.MODE_PRIVATE);
    }

    static JSONObject readSnapshot(Context context) {
        try {
            return new JSONObject(store(context).getString("snapshot", "{}"));
        } catch (JSONException ignored) {
            return new JSONObject();
        }
    }

    static boolean ownsWidget(AppWidgetManager manager, int id) {
        AppWidgetProviderInfo info = manager.getAppWidgetInfo(id);
        return info != null && OpenNewsWidget.class.getName().equals(info.provider.getClassName());
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (!PICK.equals(intent.getAction())) return;
        int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        int section = intent.getIntExtra("section", -1);
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (section < 0 || section >= SECTIONS.length || !ownsWidget(manager, id)) return;
        SharedPreferences preferences = store(context);
        if (WidgetFeed.choice(preferences, "section-", id, SECTIONS.length) == section) return;
        preferences.edit().putInt("section-" + id, section).apply();
        updateWidgets(context, manager, new int[]{id}, true);
    }

    @Override
    public void onEnabled(Context context) {
        WidgetRefreshService.sync(context);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetRefreshService.cancel(context);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        SharedPreferences.Editor editor = store(context).edit();
        for (int id : ids) {
            for (String key : WidgetFeed.SETTINGS) editor.remove(key + id);
            editor.remove("page-" + id);
        }
        editor.apply();
        WidgetRefreshService.sync(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        onUpdate(context, manager, new int[]{id});
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        updateWidgets(context, manager, ids, false);
        WidgetRefreshService.sync(context);
    }

    void updateWidgets(Context context, AppWidgetManager manager, int[] ids, boolean resetScroll) {
        if (ids.length == 0) return;
        JSONObject snapshot = readSnapshot(context);
        for (int id : ids) {
            WidgetFeed feed = new WidgetFeed(context, snapshot, id);
            float fontScale = Math.max(1f, context.getResources().getConfiguration().fontScale);
            RemoteViews views = Build.VERSION.SDK_INT >= 31
                ? responsiveViews(feed, fontScale, resetScroll)
                : legacyViews(feed, fontScale, manager.getAppWidgetOptions(id), resetScroll);
            manager.updateAppWidget(id, views);
            if (Build.VERSION.SDK_INT < 31) manager.notifyAppWidgetViewDataChanged(id, R.id.widget_list);
        }
    }

    @android.annotation.TargetApi(31)
    private RemoteViews responsiveViews(WidgetFeed feed, float fontScale, boolean resetScroll) {
        Map<SizeF, RemoteViews> layouts = new LinkedHashMap<>();
        layouts.put(new SizeF(112, 108), buildViews(feed, WidgetFeed.COMPACT, fontScale, resetScroll));
        layouts.put(new SizeF(188 * fontScale, 144), buildViews(feed, WidgetFeed.STANDARD, fontScale, resetScroll));
        layouts.put(new SizeF(264 * fontScale, 236), buildViews(feed, WidgetFeed.EXPANDED, fontScale, resetScroll));
        return new RemoteViews(layouts);
    }

    private RemoteViews legacyViews(WidgetFeed feed, float fontScale, Bundle options, boolean resetScroll) {
        int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        int maxWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, minWidth);
        int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        int maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, minHeight);
        int portrait = WidgetFeed.size(minWidth, maxHeight, fontScale);
        int landscape = WidgetFeed.size(maxWidth, minHeight, fontScale);
        RemoteViews port = buildViews(feed, portrait, fontScale, resetScroll);
        return portrait == landscape ? port : new RemoteViews(buildViews(feed, landscape, fontScale, resetScroll), port);
    }

    private RemoteViews buildViews(WidgetFeed feed, int size, float fontScale, boolean resetScroll) {
        Context context = feed.context;
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.opennews_widget);
        views.setInt(R.id.widget_root, "setBackgroundResource", feed.background(R.drawable.opennews_widget_surface,
            R.drawable.opennews_widget_surface_light, R.drawable.opennews_widget_surface_dark));
        views.setTextViewText(R.id.widget_heading, size >= WidgetFeed.EXPANDED
            ? "OpenNews" : context.getText(SECTION_LABELS[feed.section]));
        feed.color(views, R.id.widget_heading, "setTextColor", Tone.INK);
        views.setContentDescription(R.id.widget_settings, context.getString(R.string.widget_settings));
        feed.color(views, R.id.widget_settings, "setColorFilter", Tone.INK);
        feed.color(views, R.id.widget_refresh, "setColorFilter", Tone.INK);
        feed.color(views, R.id.widget_discover, "setColorFilter", Tone.INK);
        views.setContentDescription(R.id.widget_refresh, context.getString(R.string.widget_refresh));
        views.setContentDescription(R.id.widget_discover, context.getString(R.string.widget_discover));

        Intent settings = new Intent(context, WidgetSettingsActivity.class).setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("opennews://widget/" + feed.id + "/settings"))
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, feed.id);
        PendingIntent configure = PendingIntent.getActivity(context, 0, settings,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        views.setOnClickPendingIntent(R.id.widget_settings, configure);
        views.setOnClickPendingIntent(R.id.widget_heading, configure);
        views.setOnClickPendingIntent(R.id.widget_refresh, openApp(feed, "refresh", false));
        views.setOnClickPendingIntent(R.id.widget_discover, openApp(feed, "discover", false));
        views.setViewVisibility(R.id.widget_refresh, size >= WidgetFeed.STANDARD ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_discover, size >= WidgetFeed.EXPANDED ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_tabs, size >= WidgetFeed.EXPANDED ? View.VISIBLE : View.GONE);
        if (size >= WidgetFeed.EXPANDED) bindTabs(feed, views);

        boolean hasSnapshot = feed.hasSnapshot;
        views.setTextViewText(R.id.widget_empty, context.getText(!hasSnapshot ? R.string.widget_load
            : feed.filtered ? R.string.widget_no_matches : R.string.widget_no_stories));
        feed.color(views, R.id.widget_empty, "setTextColor", Tone.INK);
        views.setOnClickPendingIntent(R.id.widget_empty, feed.filtered && hasSnapshot
            ? configure : openApp(feed, "refresh", false));
        views.setEmptyView(R.id.widget_list, R.id.widget_empty);
        views.setPendingIntentTemplate(R.id.widget_list, openApp(feed, "article", true));
        if (Build.VERSION.SDK_INT >= 31) {
            views.setRemoteAdapter(R.id.widget_list, collection(feed, size, fontScale));
        } else {
            Intent adapter = new Intent(context, WidgetFeedService.class)
                .setData(Uri.parse("opennews://widget/" + feed.id + "/feed/" + feed.section + "/" + size))
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, feed.id)
                .putExtra("size", size);
            views.setRemoteAdapter(R.id.widget_list, adapter);
        }
        if (resetScroll) views.setScrollPosition(R.id.widget_list, 0);
        return views;
    }

    @android.annotation.TargetApi(31)
    private RemoteViews.RemoteCollectionItems collection(WidgetFeed feed, int size, float fontScale) {
        RemoteViews.RemoteCollectionItems.Builder items = new RemoteViews.RemoteCollectionItems.Builder()
            .setHasStableIds(true).setViewTypeCount(1);
        List<JSONObject> stories = feed.stories;
        for (int i = 0; i < stories.size(); i++) {
            items.addItem(WidgetFeed.stableId(stories.get(i)), feed.row(i, size, fontScale));
        }
        return items.build();
    }

    private void bindTabs(WidgetFeed feed, RemoteViews views) {
        Context context = feed.context;
        for (int i = 0; i < TABS.length; i++) {
            boolean selected = i == feed.section;
            String label = context.getString(SECTION_LABELS[i]);
            views.setTextViewText(TABS[i], label);
            views.setInt(TABS[i], "setBackgroundResource", selected
                ? feed.background(R.drawable.opennews_widget_selected, R.drawable.opennews_widget_tab_light,
                    R.drawable.opennews_widget_tab_dark)
                : android.R.drawable.list_selector_background);
            feed.color(views, TABS[i], "setTextColor", selected ? Tone.SELECTED : Tone.MUTED);
            views.setContentDescription(TABS[i], selected
                ? context.getString(R.string.widget_selected, label) : label);
            Intent pick = new Intent(context, OpenNewsWidget.class).setAction(PICK)
                .setData(Uri.parse("opennews://widget/" + feed.id + "/select/" + i))
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, feed.id).putExtra("section", i);
            views.setOnClickPendingIntent(TABS[i], PendingIntent.getBroadcast(context, 0, pick,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
    }

    static PendingIntent openApp(WidgetFeed feed, String action, boolean template) {
        Context context = feed.context;
        Intent intent = new Intent(context, MainActivity.class).setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("opennews://widget/" + feed.id + "/" + action))
            .putExtra(NewsWidget.REFRESH, "refresh".equals(action))
            .putExtra(NewsWidget.ACTION, action)
            .putExtra(NewsWidget.SECTION, SECTIONS[feed.section])
            .putExtra(NewsWidget.TOKEN, NewsWidget.launchToken(context));
        int flags = template ? (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0)
            : PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(context, 0, intent, flags | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
