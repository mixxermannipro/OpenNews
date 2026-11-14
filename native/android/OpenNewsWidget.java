package io.opennews.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.text.format.DateUtils;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.ArrayList;
import java.util.List;

public class OpenNewsWidget extends AppWidgetProvider {
    private static final String NEXT = "io.opennews.app.WIDGET_NEXT";
    private static final String PICK = "io.opennews.app.WIDGET_PICK";
    private static final int[] TAB_IDS = {R.id.widget_tab_0, R.id.widget_tab_1, R.id.widget_tab_2};
    private static final int[] TOPIC_IDS = {R.id.widget_topic_0, R.id.widget_topic_1, R.id.widget_topic_2};
    private static final int[] SAVE_IDS = {R.id.widget_save_0, R.id.widget_save_1, R.id.widget_save_2};
    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("EEEE, d. MMMM", Locale.GERMAN);
    static final String[] SECTIONS = {"today", "personal", "latest"};
    static final String[] LABELS = {"Heute", "Für dich", "Neueste"};

    static SharedPreferences store(Context context) {
        return context.getSharedPreferences(NewsWidget.STORE, Context.MODE_PRIVATE);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        boolean picking = PICK.equals(intent.getAction());
        if (!picking && !NEXT.equals(intent.getAction())) return;
        int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return;
        SharedPreferences preferences = store(context);
        SharedPreferences.Editor edit = preferences.edit();
        if (picking) {
            int section = intent.getIntExtra("section", 0);
            if (section < 0 || section >= SECTIONS.length) return;
            edit.putInt("section-" + id, section).putInt("page-" + id, 0);
        } else {
            edit.putInt("page-" + id, preferences.getInt("page-" + id, 0) + 1);
        }
        edit.apply();
        onUpdate(context, AppWidgetManager.getInstance(context), new int[] {id});
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        SharedPreferences.Editor edit = store(context).edit();
        for (int id : ids) {
            for (String key : new String[]{"page-", "section-", "topic-", "source-"}) edit.remove(key + id);
        }
        edit.apply();
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        onUpdate(context, manager, new int[] {id});
    }

    static JSONObject readSnapshot(Context context) {
        try {
            return new JSONObject(store(context).getString("snapshot", "{}"));
        } catch (JSONException ignored) {
            return new JSONObject();
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        JSONObject snapshot = readSnapshot(context);
        SharedPreferences preferences = store(context);
        for (int id : ids) {
            int section = Math.max(0, Math.min(SECTIONS.length - 1, preferences.getInt("section-" + id, 0)));
            String topic = preferences.getString("topic-" + id, "");
            String source = preferences.getString("source-" + id, "");
            JSONArray data = snapshot.optJSONArray(SECTIONS[section]);
            List<JSONObject> stories = new ArrayList<>();
            for (int i = 0; data != null && i < data.length(); i++) {
                JSONObject article = data.optJSONObject(i);
                if (article == null) continue;
                if (!topic.isEmpty() && !topic.equals(article.optString("category"))) continue;
                if (!source.isEmpty() && !source.equals(article.optString("sourceId"))) continue;
                stories.add(article);
            }

            Bundle dimensions = manager.getAppWidgetOptions(id);
            int width = dimensions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
            int height = dimensions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
            float fontScale = Math.max(1, context.getResources().getConfiguration().fontScale);
            boolean agenda = width >= 248 && height >= 340 * fontScale;
            int count = height >= 340 * fontScale ? 3 : height >= 245 * fontScale ? 2 : 1;
            boolean hasPhoto = width >= 185 && height >= 185 * fontScale;
            int pages = Math.max(1, (stories.size() + count - 1) / count);
            int page = Math.floorMod(preferences.getInt("page-" + id, 0), pages);
            int first = page * count;

            RemoteViews views = new RemoteViews(context.getPackageName(), agenda ? R.layout.opennews_widget_agenda : R.layout.opennews_widget);
            views.setTextViewText(R.id.opennews_widget_section, LABELS[section]);
            views.setContentDescription(R.id.opennews_widget_section, LABELS[section] + " · Widget einstellen");
            if (agenda) configureAgenda(context, views, id, section);
            int[] rows = {R.id.opennews_widget_lead, R.id.opennews_widget_second, R.id.opennews_widget_third};
            int[] titles = {R.id.opennews_widget_headlines, R.id.opennews_widget_next, R.id.opennews_widget_third_title};
            int[] meta = {R.id.opennews_widget_source, R.id.opennews_widget_next_source, R.id.opennews_widget_third_source};
            for (int slot = 0; slot < rows.length; slot++) {
                JSONObject article = slot < count && first + slot < stories.size() ? stories.get(first + slot) : null;
                views.setViewVisibility(rows[slot], article != null || slot == 0 ? View.VISIBLE : View.GONE);
                if (article == null && slot > 0) continue;
                if (agenda) bindAgendaArticle(context, views, id, slot, article, height >= 430 * fontScale);
                views.setTextViewText(titles[slot], article == null ? "Keine Meldungen" : article.optString("title"));
                views.setTextViewText(meta[slot], article == null
                    ? snapshot.length() == 0 ? "OpenNews laden" : "Auswahl prüfen"
                    : metadata(article));
                views.setOnClickPendingIntent(rows[slot], openApp(context, id, slot, article, article == null ? "refresh" : "article"));
            }
            views.setViewVisibility(R.id.opennews_widget_image, hasPhoto && !stories.isEmpty() ? View.VISIBLE : View.GONE);
            if (agenda) {
                views.setViewVisibility(R.id.widget_discover, View.VISIBLE);
                views.setOnClickPendingIntent(R.id.widget_discover, openApp(context, id, 10, null, "discover"));
            }
            if (hasPhoto && !stories.isEmpty()) {
                views.setImageViewResource(R.id.opennews_widget_image, illustration(stories.get(first).optString("category")));
            }

            Intent next = new Intent(context, OpenNewsWidget.class).setAction(NEXT)
                .setData(Uri.parse("opennews://widget/" + id + "/next"))
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
            views.setViewVisibility(R.id.opennews_widget_forward, pages > 1 ? View.VISIBLE : View.GONE);
            views.setViewVisibility(R.id.opennews_widget_refresh, pages > 1 && width < 168 ? View.GONE : View.VISIBLE);
            views.setOnClickPendingIntent(R.id.opennews_widget_forward,
                PendingIntent.getBroadcast(context, 0, next, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
            views.setOnClickPendingIntent(R.id.opennews_widget_refresh, openApp(context, id, 9, null, "refresh"));
            Intent setup = new Intent(context, WidgetSettingsActivity.class)
                .setData(Uri.parse("opennews://widget/" + id + "/settings"))
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
            views.setOnClickPendingIntent(R.id.opennews_widget_section,
                PendingIntent.getActivity(context, 0, setup, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
            manager.updateAppWidget(id, views);
        }
    }

    private void configureAgenda(Context context, RemoteViews views, int id, int section) {
        views.setTextViewText(R.id.widget_date, LocalDate.now().format(DAY_LABEL));
        for (int i = 0; i < TAB_IDS.length; i++) {
            boolean active = i == section;
            views.setInt(TAB_IDS[i], "setBackgroundResource", active ? R.drawable.opennews_widget_selected : 0);
            views.setTextColor(TAB_IDS[i], context.getColor(active ? R.color.widget_surface : R.color.widget_ink));
            views.setContentDescription(TAB_IDS[i], active ? LABELS[i] + ", ausgewählt" : LABELS[i]);
            Intent pick = new Intent(context, OpenNewsWidget.class).setAction(PICK)
                .setData(Uri.parse("opennews://widget/" + id + "/select/" + i))
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).putExtra("section", i);
            views.setOnClickPendingIntent(TAB_IDS[i],
                PendingIntent.getBroadcast(context, 0, pick, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        views.setTextViewText(R.id.opennews_widget_forward, "›");
        views.setTextViewText(R.id.opennews_widget_refresh, "↻");
    }

    private void bindAgendaArticle(Context context, RemoteViews views, int id, int slot, JSONObject article, boolean showSummary) {
        views.setViewVisibility(SAVE_IDS[slot], article == null ? View.GONE : View.VISIBLE);
        views.setTextViewText(TOPIC_IDS[slot], article == null ? "" : article.optString("category"));
        if (slot == 0) {
            String summary = article == null ? "" : article.optString("summary");
            views.setViewVisibility(R.id.widget_summary, showSummary && !summary.trim().isEmpty() ? View.VISIBLE : View.GONE);
            views.setTextViewText(R.id.widget_summary, summary);
        }
        if (article == null) return;
        if (slot > 0) {
            views.setImageViewResource(slot == 1 ? R.id.widget_thumb_1 : R.id.widget_thumb_2, illustration(article.optString("category")));
        }
        views.setTextViewText(SAVE_IDS[slot], "☆");
        views.setOnClickPendingIntent(SAVE_IDS[slot], openApp(context, id, slot, article, "save"));
    }

    private PendingIntent openApp(Context context, int id, int slot, JSONObject article, String action) {
        String path = article == null ? action : action + "/" + Uri.encode(article.optString("id"));
        Intent open = new Intent(context, MainActivity.class).setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("opennews://widget/" + id + "/" + slot + "/" + path))
            .putExtra(NewsWidget.REFRESH, "refresh".equals(action))
            .putExtra(NewsWidget.ACTION, action);
        if (article != null) open.putExtra(NewsWidget.ARTICLE, article.optString("id"));
        return PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private String metadata(JSONObject article) {
        String source = article.optString("sourceName");
        try {
            long published = Instant.parse(article.optString("publishedAt")).toEpochMilli();
            long now = System.currentTimeMillis();
            String time = DateUtils.getRelativeTimeSpanString(published, now, DateUtils.MINUTE_IN_MILLIS).toString();
            return source + " · " + time + (now - published >= DateUtils.DAY_IN_MILLIS ? " · älterer Stand" : "");
        } catch (RuntimeException ignored) {
            return source;
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
