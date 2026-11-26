package io.opennews.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.os.Build;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

final class WidgetFeed {
    static final int COMPACT = 0, STANDARD = 1, EXPANDED = 2;
    static final int AUTO = 0, DENSE = 1, EDITORIAL = 2;
    static final int SYSTEM = 0, LIGHT = 1, DARK = 2;
    static final String[] SETTINGS = {"section-", "topic-", "source-", "density-", "theme-", "images-", "summaries-", "metadata-", WidgetRefreshService.PREF_REFRESH};

    final Context context;
    final int id, section, density;
    private final boolean followSystem, dark;
    final boolean filtered, hasSnapshot, images, summaries, metadata;

    enum Tone {
        INK(0xff1e2024, 0xfff6f5f3),
        MUTED(0xff555d66, 0xffb4bbc5),
        SELECTED(0xffffffff, 0xff191b20);

        final int light, dark;

        Tone(int light, int dark) {
            this.light = light;
            this.dark = dark;
        }
    }
    final List<JSONObject> stories = new ArrayList<>();

    WidgetFeed(Context base, JSONObject snapshot, int id) {
        this.id = id;
        Configuration config = new Configuration(base.getResources().getConfiguration());
        String language = snapshot.optString("language");
        if (!language.isEmpty()) config.setLocale(Locale.forLanguageTag(language));
        context = base.createConfigurationContext(config);
        SharedPreferences store = OpenNewsWidget.store(base);
        section = choice(store, "section-", id, OpenNewsWidget.SECTIONS.length);
        density = choice(store, "density-", id, 3);
        int theme = choice(store, "theme-", id, 3);
        String appTheme = snapshot.optString("theme");
        boolean systemDark = (config.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        boolean appDark = "dark".equals(appTheme) || (!"light".equals(appTheme) && systemDark);
        dark = theme == DARK || (theme == SYSTEM && appDark);
        followSystem = theme == SYSTEM && !"dark".equals(appTheme) && !"light".equals(appTheme);
        images = store.getBoolean("images-" + id, true);
        summaries = store.getBoolean("summaries-" + id, true);
        metadata = store.getBoolean("metadata-" + id, true);
        String topic = store.getString("topic-" + id, "");
        String source = store.getString("source-" + id, "");
        filtered = !topic.isEmpty() || !source.isEmpty();
        JSONArray articles = snapshot.optJSONArray(OpenNewsWidget.SECTIONS[section]);
        hasSnapshot = articles != null;
        Set<String> seen = new HashSet<>();
        List<String> muted = WidgetRefreshService.readMutedKeywords(store);
        for (int i = 0; articles != null && i < articles.length(); i++) {
            JSONObject article = articles.optJSONObject(i);
            String title = article != null ? article.optString("title") : "";
            if (article == null || title.isEmpty()) continue;
            if (!topic.isEmpty() && !topic.equals(article.optString("category"))) continue;
            if (!source.isEmpty() && !source.equals(article.optString("sourceId"))) continue;
            if (WidgetRefreshService.isMutedArticle(title, article.optString("summary"), muted)) continue;
            String key = article.optString("id");
            if (!key.isEmpty() && seen.add(key)) stories.add(article);
        }
    }

    static int choice(SharedPreferences store, String key, int id, int count) {
        int value = store.getInt(key + id, 0);
        return value >= 0 && value < count ? value : 0;
    }

    static int size(float width, float height, float fontScale) {
        if (width >= 264 * fontScale && height >= 236) return EXPANDED;
        if (width >= 188 * fontScale && height >= 144) return STANDARD;
        return COMPACT;
    }

    RemoteViews row(int index, int size, float fontScale) {
        JSONObject article = stories.get(index);
        boolean brief = size == COMPACT || density == DENSE;
        boolean lead = index == 0 && !brief && (density == EDITORIAL || size == EXPANDED);
        boolean wideLead = lead && size == EXPANDED;
        int illustration = illustration(article.optString("category"));
        boolean hasImage = images && !brief && illustration != 0;
        String summary = abbreviated(article.optString("summary"), 180);
        String title = abbreviated(article.optString("title"), 260);
        boolean showSummary = summaries && lead && !summary.equalsIgnoreCase(title) && usefulSummary(summary);
        RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.opennews_widget_article);
        row.setInt(R.id.widget_card, "setBackgroundResource", background(R.drawable.opennews_widget_card,
            R.drawable.opennews_widget_card_light, R.drawable.opennews_widget_card_dark));
        row.setTextViewText(R.id.widget_article_title, title);
        color(row, R.id.widget_article_title, "setTextColor", Tone.INK);
        row.setTextViewTextSize(R.id.widget_article_title, TypedValue.COMPLEX_UNIT_SP, wideLead ? 22 : lead ? 18 : brief ? 14 : 16);
        row.setInt(R.id.widget_article_title, "setMaxLines", brief && fontScale > 1.3f ? 1 : lead ? 3 : 2);
        row.setViewVisibility(R.id.widget_article_meta, metadata ? View.VISIBLE : View.GONE);
        if (metadata) {
            row.setTextViewText(R.id.widget_article_meta, metadata(article));
            color(row, R.id.widget_article_meta, "setTextColor", Tone.MUTED);
        }
        row.setViewVisibility(R.id.widget_article_summary, showSummary ? View.VISIBLE : View.GONE);
        if (showSummary) {
            row.setTextViewText(R.id.widget_article_summary, summary);
            color(row, R.id.widget_article_summary, "setTextColor", Tone.MUTED);
        }
        row.setViewVisibility(R.id.widget_article_hero, hasImage && wideLead ? View.VISIBLE : View.GONE);
        row.setViewVisibility(R.id.widget_article_thumb, hasImage && !wideLead ? View.VISIBLE : View.GONE);
        if (hasImage) row.setImageViewResource(wideLead ? R.id.widget_article_hero : R.id.widget_article_thumb,
            illustration);

        String articleId = article.optString("id");
        Intent open = new Intent().putExtra(NewsWidget.ARTICLE, articleId);
        row.setOnClickFillInIntent(R.id.widget_card, open);
        row.setViewVisibility(R.id.widget_article_save, size >= STANDARD ? View.VISIBLE : View.GONE);
        if (size >= STANDARD) {
            boolean saved = article.optBoolean("widgetSaved");
            row.setImageViewResource(R.id.widget_article_save, saved ? R.drawable.widget_bookmarked : R.drawable.widget_bookmark);
            color(row, R.id.widget_article_save, "setColorFilter", saved ? Tone.INK : Tone.MUTED);
            row.setContentDescription(R.id.widget_article_save, context.getString(
                saved ? R.string.widget_saved_article : R.string.widget_save_article, title));
            row.setOnClickFillInIntent(R.id.widget_article_save, new Intent(open).putExtra(NewsWidget.SAVE, !saved));
        }
        return row;
    }

    int background(int system, int light, int night) {
        return followSystem ? system : dark ? night : light;
    }

    void color(RemoteViews views, int id, String method, Tone tone) {
        if (followSystem && Build.VERSION.SDK_INT >= 31) {
            views.setColorInt(id, method, tone.light, tone.dark);
        } else {
            views.setInt(id, method, dark ? tone.dark : tone.light);
        }
    }

    private String metadata(JSONObject article) {
        String source = abbreviated(article.optString("sourceName"), 80);
        try {
            SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.ROOT);
            iso.setLenient(false);
            Date published = iso.parse(article.optString("publishedAt").replaceFirst("\\.\\d+(?=Z|[+-])", ""));
            if (published == null) return source;
            Calendar now = Calendar.getInstance();
            Calendar date = Calendar.getInstance();
            date.setTime(published);
            Locale locale = context.getResources().getConfiguration().getLocales().get(0);
            boolean today = now.get(Calendar.YEAR) == date.get(Calendar.YEAR)
                && now.get(Calendar.DAY_OF_YEAR) == date.get(Calendar.DAY_OF_YEAR);
            String time = today ? android.text.format.DateFormat.getTimeFormat(context).format(published)
                : new SimpleDateFormat("d MMM", locale).format(published);
            return source.isEmpty() ? time : source + " · " + time;
        } catch (ParseException ignored) {
            return source;
        }
    }

    private static boolean usefulSummary(String summary) {
        switch (summary.trim().toLowerCase(Locale.ROOT)) {
            case "":
            case "-":
            case "none":
            case "null":
                return false;
            default:
                return true;
        }
    }

    private static String abbreviated(String value, int max) {
        if (value.length() <= max) return value;
        int end = Character.isHighSurrogate(value.charAt(max - 1)) ? max - 1 : max;
        return value.substring(0, end).trim() + "…";
    }

    static long stableId(JSONObject article) {
        String key = article.optString("id");
        long hash = 0xcbf29ce484222325L;
        for (int i = 0; i < key.length(); i++) hash = (hash ^ key.charAt(i)) * 0x100000001b3L;
        return hash;
    }

    private static int illustration(String category) {
        switch (category) {
            case "Politik": return R.drawable.widget_politik;
            case "Europa": return R.drawable.widget_europa;
            case "Technologie": return R.drawable.widget_technologie;
            case "Wissenschaft": return R.drawable.widget_wissenschaft;
            case "Wirtschaft": return R.drawable.widget_wirtschaft;
            default: return 0;
        }
    }
}
