package io.opennews.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class WidgetSettingsActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setResult(RESULT_CANCELED);
        int id = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        AppWidgetProviderInfo widget = AppWidgetManager.getInstance(this).getAppWidgetInfo(id);
        if (widget == null || !OpenNewsWidget.class.getName().equals(widget.provider.getClassName())) {
            finish();
            return;
        }

        SharedPreferences store = OpenNewsWidget.store(this);
        Map<String, String> topics = new LinkedHashMap<>();
        Map<String, String> sources = new LinkedHashMap<>();
        topics.put("", "Alle Themen");
        sources.put("", "Alle Quellen");
        JSONObject snapshot = OpenNewsWidget.readSnapshot(this);
        for (String key : OpenNewsWidget.SECTIONS) {
            JSONArray articles = snapshot.optJSONArray(key);
            for (int i = 0; articles != null && i < articles.length(); i++) {
                JSONObject article = articles.optJSONObject(i);
                if (article == null) continue;
                String topic = article.optString("category");
                String source = article.optString("sourceId");
                if (!topic.isEmpty()) topics.put(topic, topic);
                if (!source.isEmpty()) sources.put(source, article.optString("sourceName", source));
            }
        }

        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int inset = Math.round(20 * getResources().getDisplayMetrics().density);
        content.setPadding(inset, inset, inset, inset);
        scroll.addView(content);
        setContentView(scroll);
        setTitle("OpenNews-Widget");

        Spinner section = option(content, "Ansicht", OpenNewsWidget.LABELS, store.getInt("section-" + id, 0));
        List<String> topicKeys = new ArrayList<>(topics.keySet());
        Spinner topic = option(content, "Thema", topics.values().toArray(new String[0]),
            Math.max(0, topicKeys.indexOf(store.getString("topic-" + id, ""))));
        List<String> sourceKeys = new ArrayList<>(sources.keySet());
        Spinner source = option(content, "Quelle", sources.values().toArray(new String[0]),
            Math.max(0, sourceKeys.indexOf(store.getString("source-" + id, ""))));
        Button save = new Button(this);
        save.setText("Speichern");
        content.addView(save);
        save.setOnClickListener(view -> {
            store.edit().putInt("section-" + id, section.getSelectedItemPosition())
                .putString("topic-" + id, topicKeys.get(topic.getSelectedItemPosition()))
                .putString("source-" + id, sourceKeys.get(source.getSelectedItemPosition()))
                .remove("page-" + id).apply();
            new OpenNewsWidget().onUpdate(this, AppWidgetManager.getInstance(this), new int[]{id});
            setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id));
            finish();
        });
    }

    private Spinner option(LinearLayout parent, String label, String[] choices, int selected) {
        TextView title = new TextView(this);
        title.setText(label);
        parent.addView(title);
        Spinner input = new Spinner(this);
        input.setId(android.view.View.generateViewId());
        title.setLabelFor(input.getId());
        input.setMinimumHeight(Math.round(48 * getResources().getDisplayMetrics().density));
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, choices);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        input.setAdapter(adapter);
        input.setSelection(selected);
        parent.addView(input);
        return input;
    }
}
