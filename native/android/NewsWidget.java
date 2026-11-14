package io.opennews.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NewsWidget")
public class NewsWidget extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        JSArray stories = call.getArray("stories", new JSArray());
        Context context = getContext();
        context.getSharedPreferences("opennews-widget", Context.MODE_PRIVATE)
            .edit().putString("stories", stories.toString()).apply();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, OpenNewsWidget.class));
        new OpenNewsWidget().onUpdate(context, manager, ids);
        call.resolve();
    }
}
