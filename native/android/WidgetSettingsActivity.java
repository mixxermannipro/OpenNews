package io.opennews.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.Switch;
import android.widget.TextView;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class WidgetSettingsActivity extends Activity {
    private Context labels;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setResult(RESULT_CANCELED);
        int id = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        AppWidgetManager manager = AppWidgetManager.getInstance(this);
        if (!OpenNewsWidget.ownsWidget(manager, id)) {
            finish();
            return;
        }

        SharedPreferences store = OpenNewsWidget.store(this);
        JSONObject snapshot = OpenNewsWidget.readSnapshot(this);
        WidgetFeed feed = new WidgetFeed(this, snapshot, id);
        labels = feed.context;
        String savedTopic = store.getString("topic-" + id, "");
        String savedSource = store.getString("source-" + id, "");
        Map<String, String> topics = new LinkedHashMap<>();
        Map<String, String> sources = new LinkedHashMap<>();
        topics.put("", labels.getString(R.string.widget_all_topics));
        sources.put("", labels.getString(R.string.widget_all_sources));
        Map<String, String> discoveredTopics = new LinkedHashMap<>();
        Map<String, String> discoveredSources = new LinkedHashMap<>();
        for (String key : OpenNewsWidget.SECTIONS) {
            JSONArray articles = snapshot.optJSONArray(key);
            for (int i = 0; articles != null && i < articles.length(); i++) {
                JSONObject article = articles.optJSONObject(i);
                if (article == null) continue;
                String topic = article.optString("category");
                String source = article.optString("sourceId");
                if (!topic.isEmpty()) discoveredTopics.put(topic, topic);
                if (!source.isEmpty()) discoveredSources.put(source, article.optString("sourceName", source));
            }
        }
        JSONArray subscribedFeeds = WidgetRefreshService.readFeeds(store);
        for (int i = 0; i < subscribedFeeds.length(); i++) {
            JSONObject subscribed = subscribedFeeds.optJSONObject(i);
            if (subscribed == null) continue;
            String topic = subscribed.optString("category");
            String source = subscribed.optString("id");
            if (!topic.isEmpty() && !discoveredTopics.containsKey(topic)) discoveredTopics.put(topic, topic);
            if (!source.isEmpty() && !discoveredSources.containsKey(source)) {
                discoveredSources.put(source, subscribed.optString("name", source));
            }
        }
        List<Map.Entry<String, String>> sortedTopics = new ArrayList<>(discoveredTopics.entrySet());
        sortedTopics.sort((a, b) -> a.getValue().compareToIgnoreCase(b.getValue()));
        for (Map.Entry<String, String> entry : sortedTopics) topics.put(entry.getKey(), entry.getValue());

        List<Map.Entry<String, String>> sortedSources = new ArrayList<>(discoveredSources.entrySet());
        sortedSources.sort((a, b) -> a.getValue().compareToIgnoreCase(b.getValue()));
        for (Map.Entry<String, String> entry : sortedSources) sources.put(entry.getKey(), entry.getValue());

        if (!topics.containsKey(savedTopic)) topics.put(savedTopic, savedTopic);
        if (!sources.containsKey(savedSource)) sources.put(savedSource, savedSource);

        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int inset = dp(20);
        content.setPadding(inset, inset, inset, inset);
        ViewCompat.setOnApplyWindowInsetsListener(scroll, (view, insets) -> {
            var bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        scroll.addView(content);
        setContentView(scroll);

        heading(content, R.string.widget_settings, 25);
        Spinner section = option(content, R.id.widget_pref_section, R.string.widget_view,
            names(OpenNewsWidget.SECTION_LABELS), feed.section);
        List<String> topicKeys = new ArrayList<>(topics.keySet());
        Spinner topic = option(content, R.id.widget_pref_topic, R.string.widget_topic,
            topics.values().toArray(new String[0]), topicKeys.indexOf(savedTopic));
        List<String> sourceKeys = new ArrayList<>(sources.keySet());
        Spinner source = option(content, R.id.widget_pref_source, R.string.widget_source,
            sources.values().toArray(new String[0]), sourceKeys.indexOf(savedSource));

        heading(content, R.string.widget_appearance, 20);
        Spinner density = option(content, R.id.widget_pref_density, R.string.widget_layout,
            names(R.string.widget_auto, R.string.widget_compact, R.string.widget_magazine), feed.density);
        Spinner theme = option(content, R.id.widget_pref_theme, R.string.widget_theme,
            names(R.string.widget_system, R.string.widget_light, R.string.widget_dark),
            WidgetFeed.choice(store, "theme-", id, 3));
        Switch images = toggle(content, R.id.widget_pref_images, R.string.widget_images, feed.images);
        Switch summaries = toggle(content, R.id.widget_pref_summaries, R.string.widget_summaries, feed.summaries);
        Switch metadata = toggle(content, R.id.widget_pref_metadata, R.string.widget_metadata, feed.metadata);

        heading(content, R.string.widget_refresh_section, 20);
        TextView refreshStatus = new TextView(this);
        refreshStatus.setTextSize(13);
        refreshStatus.setPadding(0, 0, 0, dp(8));
        updateRefreshStatusLabel(refreshStatus, store);
        content.addView(refreshStatus);

        Spinner refreshInterval = option(content, R.id.widget_pref_refresh, R.string.widget_refresh_interval,
            names(WidgetRefreshService.INTERVAL_LABELS), WidgetRefreshService.intervalIndex(store, id));

        if (subscribedFeeds.length() > 0) {
            Button refreshNowBtn = button(content, R.string.widget_refresh_now);
            refreshNowBtn.setOnClickListener(view -> {
                refreshNowBtn.setEnabled(false);
                refreshNowBtn.setText(labels.getText(R.string.widget_refreshing));
                WidgetRefreshService.refreshNowAsync(this, () -> {
                    if (isFinishing() || isDestroyed()) return;
                    refreshNowBtn.setEnabled(true);
                    refreshNowBtn.setText(labels.getText(R.string.widget_refresh_now));
                    updateRefreshStatusLabel(refreshStatus, store);
                });
            });
        }

        Button save = button(content, R.string.widget_save_settings);
        save.setOnClickListener(view -> {
            if (!OpenNewsWidget.ownsWidget(manager, id)) {
                finish();
                return;
            }
            int selectedSection = section.getSelectedItemPosition();
            String selectedTopic = topicKeys.get(topic.getSelectedItemPosition());
            String selectedSource = sourceKeys.get(source.getSelectedItemPosition());
            int refreshPos = refreshInterval.getSelectedItemPosition();
            int selectedMinutes = refreshPos >= 0 && refreshPos < WidgetRefreshService.INTERVAL_MINUTES.length
                ? WidgetRefreshService.INTERVAL_MINUTES[refreshPos]
                : WidgetRefreshService.DEFAULT_INTERVAL_MINUTES;
            boolean filterChanged = selectedSection != feed.section
                || !savedTopic.equals(selectedTopic) || !savedSource.equals(selectedSource);
            store.edit().putInt("section-" + id, selectedSection)
                .putString("topic-" + id, selectedTopic)
                .putString("source-" + id, selectedSource)
                .putInt("density-" + id, density.getSelectedItemPosition())
                .putInt("theme-" + id, theme.getSelectedItemPosition())
                .putBoolean("images-" + id, images.isChecked())
                .putBoolean("summaries-" + id, summaries.isChecked())
                .putBoolean("metadata-" + id, metadata.isChecked())
                .putInt(WidgetRefreshService.PREF_REFRESH + id, selectedMinutes)
                .apply();
            WidgetRefreshService.sync(this);
            new OpenNewsWidget().updateWidgets(this, manager, new int[]{id}, filterChanged);
            setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id));
            finish();
        });

        // The compact widget has room for settings only; keep both shortcuts available here.
        if (Intent.ACTION_VIEW.equals(getIntent().getAction())) {
            button(content, R.string.widget_refresh).setOnClickListener(view -> open(feed, "refresh"));
            button(content, R.string.widget_discover).setOnClickListener(view -> open(feed, "discover"));
        }
    }

    private void updateRefreshStatusLabel(TextView target, SharedPreferences store) {
        long lastMs = store.getLong(WidgetRefreshService.PREF_LAST_REFRESH, 0L);
        if (lastMs > 0L) {
            String formatted = OpenNewsWidget.formatUpdatedTimestamp(labels, lastMs);
            target.setText(labels.getString(R.string.widget_last_updated, formatted));
        } else {
            target.setText(labels.getText(R.string.widget_never_updated));
        }
    }

    private void open(WidgetFeed feed, String action) {
        try {
            OpenNewsWidget.openApp(feed, action, false).send();
            finish();
        } catch (android.app.PendingIntent.CanceledException ignored) {}
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private String[] names(int... ids) {
        String[] names = new String[ids.length];
        for (int i = 0; i < ids.length; i++) names[i] = labels.getString(ids[i]);
        return names;
    }

    private void heading(LinearLayout parent, int text, int size) {
        TextView heading = new TextView(this);
        heading.setText(labels.getText(text));
        heading.setTextSize(size);
        heading.setTypeface(android.graphics.Typeface.create("sans-serif-medium", 0));
        heading.setPadding(0, dp(12), 0, dp(8));
        ViewCompat.setAccessibilityHeading(heading, true);
        parent.addView(heading);
    }

    private Spinner option(LinearLayout parent, int id, int label, String[] choices, int selected) {
        TextView title = new TextView(this);
        title.setText(labels.getText(label));
        title.setLabelFor(id);
        parent.addView(title);
        Spinner input = new Spinner(this);
        input.setId(id);
        input.setMinimumHeight(dp(48));
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, choices);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        input.setAdapter(adapter);
        input.setSelection(selected);
        parent.addView(input, new LinearLayout.LayoutParams(-1, -2));
        return input;
    }

    private Switch toggle(LinearLayout parent, int id, int label, boolean checked) {
        Switch input = new Switch(this);
        input.setId(id);
        input.setText(labels.getText(label));
        input.setMinHeight(dp(48));
        input.setChecked(checked);
        parent.addView(input, new LinearLayout.LayoutParams(-1, -2));
        return input;
    }

    private Button button(LinearLayout parent, int label) {
        Button button = new Button(this);
        button.setText(labels.getText(label));
        button.setMinHeight(dp(48));
        parent.addView(button, new LinearLayout.LayoutParams(-1, -2));
        return button;
    }
}
