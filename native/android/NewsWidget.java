package io.opennews.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "NewsWidget")
public class NewsWidget extends Plugin {
    static final String STORE = "opennews-widget";
    static final String TOKEN = "io.opennews.app.WIDGET_TOKEN";

    static synchronized String launchToken(Context context) {
        android.content.SharedPreferences preferences = OpenNewsWidget.store(context);
        String token = preferences.getString("launch-token", null);
        if (token == null) {
            token = java.util.UUID.randomUUID().toString();
            preferences.edit().putString("launch-token", token).apply();
        }
        return token;
    }

    static final String ARTICLE = "io.opennews.app.WIDGET_ARTICLE";
    static final String ACTION = "io.opennews.app.WIDGET_ACTION";
    static final String SECTION = "io.opennews.app.WIDGET_SECTION";
    static final String SAVE = "io.opennews.app.WIDGET_SAVE";
    static final String REFRESH = "io.opennews.app.WIDGET_REFRESH";

    @PluginMethod
    public void update(PluginCall call) {
        JSObject snapshot = new JSObject();
        for (String section : OpenNewsWidget.SECTIONS) {
            snapshot.put(section, call.getArray(section));
        }
        String language = call.getString("language");
        if (language != null) snapshot.put("language", language);
        String theme = call.getString("theme");
        if (theme != null) snapshot.put("theme", theme);
        String json = snapshot.toString();
        com.getcapacitor.JSArray feeds = call.getArray("feeds");
        String feedsJson = feeds != null ? feeds.toString() : null;
        getActivity().runOnUiThread(() -> {
            Context context = getContext();
            android.content.SharedPreferences store = OpenNewsWidget.store(context);
            android.content.SharedPreferences.Editor editor = store.edit();
            boolean snapshotChanged = !json.equals(store.getString("snapshot", ""));
            if (snapshotChanged) editor.putString("snapshot", json);
            if (feedsJson != null && !feedsJson.equals(store.getString(WidgetRefreshService.PREF_FEEDS, ""))) {
                editor.putString(WidgetRefreshService.PREF_FEEDS, feedsJson);
            }
            editor.apply();
            if (snapshotChanged) {
                AppWidgetManager manager = AppWidgetManager.getInstance(context);
                int[] ids = manager.getAppWidgetIds(new ComponentName(context, OpenNewsWidget.class));
                new OpenNewsWidget().onUpdate(context, manager, ids);
            } else {
                WidgetRefreshService.sync(context);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void getLaunchArticle(PluginCall call) {
        call.resolve(consume(getActivity().getIntent()));
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        JSObject data = consume(intent);
        if (data.length() > 0) notifyListeners("openStory", data, true);
    }

    private JSObject consume(Intent intent) {
        JSObject data = new JSObject();
        if (intent == null) return data;
        String token = intent.getStringExtra(TOKEN);
        intent.removeExtra(TOKEN);
        if (!launchToken(getContext()).equals(token)) return data;
        String action = intent.getStringExtra(ACTION);
        intent.removeExtra(ACTION);
        if ("discover".equals(action)) {
            data.put("discover", true);
            return data;
        }
        String article = intent.getStringExtra(ARTICLE);
        intent.removeExtra(ARTICLE);
        if (article != null) {
            JSONObject snapshot = OpenNewsWidget.readSnapshot(getContext());
            for (String section : OpenNewsWidget.SECTIONS) {
                JSONArray stories = snapshot.optJSONArray(section);
                for (int i = 0; stories != null && i < stories.length(); i++) {
                    JSONObject candidate = stories.optJSONObject(i);
                    if (candidate != null && article.equals(candidate.optString("id"))) {
                        candidate.remove("widgetSaved");
                        data.put("article", candidate);
                        if ("save".equals(action) || intent.getBooleanExtra(SAVE, false)) data.put("save", true);
                        return data;
                    }
                }
            }
        }
        if (intent.getBooleanExtra(REFRESH, false)) {
            data.put("refresh", true);
            String section = intent.getStringExtra(SECTION);
            if (section != null) data.put("section", section);
            intent.removeExtra(REFRESH);
        }
        return data;
    }
}
