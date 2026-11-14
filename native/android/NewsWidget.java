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
    static final String ARTICLE = "io.opennews.app.WIDGET_ARTICLE";
    static final String ACTION = "io.opennews.app.WIDGET_ACTION";
    static final String REFRESH = "io.opennews.app.WIDGET_REFRESH";

    @PluginMethod
    public void update(PluginCall call) {
        JSObject snapshot = new JSObject();
        for (String section : OpenNewsWidget.SECTIONS) {
            snapshot.put(section, call.getArray(section));
        }
        Context context = getContext();
        context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
            .edit().putString("snapshot", snapshot.toString()).apply();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, OpenNewsWidget.class));
        new OpenNewsWidget().onUpdate(context, manager, ids);
        call.resolve();
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
                        data.put("article", candidate);
                        if ("save".equals(action)) data.put("save", true);
                        return data;
                    }
                }
            }
        }
        if (intent.getBooleanExtra(REFRESH, false)) {
            data.put("refresh", true);
            intent.removeExtra(REFRESH);
        }
        return data;
    }
}
