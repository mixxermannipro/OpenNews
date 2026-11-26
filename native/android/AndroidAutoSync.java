package io.opennews.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "AndroidAutoSync")
public class AndroidAutoSync extends Plugin {
    @PluginMethod
    public void sync(PluginCall call) {
        try {
            JSONObject payload = new JSONObject(call.getData().toString());
            AutoAudioStore store = new AutoAudioStore(getContext());
            store.applySyncPayload(payload);
            OpenNewsAutoMediaService.notifyLibraryChanged(getContext(), OpenNewsAutoMediaService.ROOT_ID);
            OpenNewsAutoMediaService.notifyLibraryChanged(getContext(), OpenNewsAutoMediaService.TAB_UPDATES);
            OpenNewsAutoMediaService.notifyLibraryChanged(getContext(), OpenNewsAutoMediaService.TAB_PODCASTS);
            OpenNewsAutoMediaService.notifyLibraryChanged(getContext(), OpenNewsAutoMediaService.TAB_RADIO);
            OpenNewsAutoMediaService.notifyLibraryChanged(getContext(), OpenNewsAutoMediaService.TAB_QUEUE);
            call.resolve(new JSObject(store.getStatusJson().toString()));
        } catch (JSONException error) {
            call.reject("Android-Auto-Synchronisierung fehlgeschlagen", error);
        }
    }

    @PluginMethod
    public void refreshNow(PluginCall call) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                int episodes = AutoFeedFetcher.refreshBlocking(getContext(), true);
                try {
                    JSObject result = new JSObject(new AutoAudioStore(getContext()).getStatusJson().toString());
                    result.put("refreshedEpisodes", episodes);
                    call.resolve(result);
                } catch (JSONException error) {
                    call.reject("Status konnte nicht gelesen werden", error);
                }
            }
        }, "OpenNewsAutoManualRefresh").start();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            call.resolve(new JSObject(new AutoAudioStore(getContext()).getStatusJson().toString()));
        } catch (JSONException error) {
            call.reject("Status konnte nicht gelesen werden", error);
        }
    }
}
