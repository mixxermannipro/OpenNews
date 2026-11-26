package io.opennews.app;

import android.Manifest;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Collections;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "NewsPush", permissions = {
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class NewsPush extends Plugin {
    static final String EXTRA_TOKEN = "io.opennews.app.PUSH_TOKEN";
    static final String EXTRA_NOTIFICATION_PAYLOAD = "io.opennews.app.PUSH_PAYLOAD";
    private static final String TOPICS = "topics";
    private Task<Void> pending = Tasks.forResult(null);

    static synchronized String launchToken(Context context) {
        SharedPreferences prefs = NewsMessagingService.preferences(context);
        String token = prefs.getString("launch-token", null);
        if (token == null) {
            token = UUID.randomUUID().toString();
            prefs.edit().putString("launch-token", token).apply();
        }
        return token;
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33) {
            PermissionState state = getPermissionState("notifications");
            if (state == PermissionState.PROMPT || state == PermissionState.PROMPT_WITH_RATIONALE) {
                requestPermissionForAlias("notifications", call, "permissionResult");
                return;
            }
        }
        checkAccess(call);
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        checkAccess(call);
    }

    @PluginMethod
    public void checkAccess(PluginCall call) {
        boolean allowed = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        call.resolve(new JSObject().put("allowed", allowed));
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String packageName = getContext().getPackageName();
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, packageName));
                call.resolve();
                return;
            } catch (ActivityNotFoundException | SecurityException ignored) {
                // Some Android versions only expose the application details page.
            }
        }
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", packageName, null)));
            call.resolve();
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("Android-Einstellungen konnten nicht geöffnet werden.", error);
        }
    }

    @PluginMethod
    public void configure(PluginCall call) {
        applySettings(call);
    }

    private void applySettings(PluginCall call) {
        var preferences = NewsMessagingService.preferences(getContext());
        boolean enabled = call.getBoolean("enabled", false);
        boolean permitted = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        Set<String> desired = new HashSet<>();
        JSArray sources = call.getArray("sources", new JSArray());
        if (enabled && permitted) {
            for (int i = 0; i < sources.length(); i++) {
                String id = sources.optString(i);
                if (id.matches("[a-zA-Z0-9_-]{1,80}")) desired.add("opennews_" + id);
            }
        }
        JSArray feeds = call.getArray("feeds", null);
        JSArray muted = call.getArray("mutedKeywords", null);
        int intervalMinutes = NewsPushMonitorService.clampIntervalMinutes(call.getInt("intervalMinutes", 30));

        SharedPreferences.Editor editor = preferences.edit()
            .putBoolean("enabled", enabled && permitted)
            .putStringSet("desired", desired)
            .putBoolean("breakingOnly", call.getBoolean("breakingOnly", true))
            .putString("categories", call.getArray("topics", new JSArray()).toString())
            .putString("from", call.getString("from", "00:00"))
            .putString("until", call.getString("until", "23:59"))
            .putInt("intervalMinutes", intervalMinutes);
        if (feeds != null) {
            editor.putString("feeds", feeds.toString());
        }
        if (muted != null) {
            editor.putString("mutedKeywords", muted.toString());
        }
        editor.apply();

        if (enabled && permitted) {
            NewsMessagingService.ensureChannels(getContext().getSystemService(NotificationManager.class));
        }
        NewsPushMonitorService.sync(getContext());

        long lastCheckedAt = preferences.getLong("lastCheckedAt", 0L);
        if (FirebaseApp.getApps(getContext()).isEmpty()) {
            JSObject result = new JSObject()
                .put("status", enabled && !permitted ? "denied" : "ready")
                .put("mode", "local");
            if (lastCheckedAt > 0) result.put("lastCheckedAt", lastCheckedAt);
            call.resolve(result);
            return;
        }
        synchronized (this) {
            pending = pending.continueWithTask(ignored -> {
                Set<String> previous = new HashSet<>(preferences.getStringSet(TOPICS, Collections.emptySet()));
                Set<String> target = new HashSet<>(preferences.getStringSet("desired", Collections.emptySet()));
                FirebaseMessaging messaging = FirebaseMessaging.getInstance();
                messaging.setAutoInitEnabled(!target.isEmpty());
                ArrayList<Task<Void>> changes = new ArrayList<>();
                for (String topic : previous) {
                    if (!target.contains(topic)) changes.add(messaging.unsubscribeFromTopic(topic));
                }
                for (String topic : target) {
                    if (!previous.contains(topic)) changes.add(messaging.subscribeToTopic(topic));
                }
                return Tasks.whenAll(changes).onSuccessTask(unused -> {
                    preferences.edit().putStringSet(TOPICS, target).apply();
                    return Tasks.forResult(null);
                });
            });
            pending.addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    JSObject fallback = new JSObject()
                        .put("status", enabled && !permitted ? "denied" : "ready")
                        .put("mode", "local");
                    if (lastCheckedAt > 0) fallback.put("lastCheckedAt", lastCheckedAt);
                    call.resolve(fallback);
                } else {
                    JSObject result = new JSObject()
                        .put("status", enabled && !permitted ? "denied" : "ready")
                        .put("mode", "fcm+local");
                    if (lastCheckedAt > 0) result.put("lastCheckedAt", lastCheckedAt);
                    call.resolve(result);
                }
            });
        }
    }

    @PluginMethod
    public void getLaunchNotification(PluginCall call) {
        call.resolve(consume(getActivity().getIntent()));
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        JSObject data = consume(intent);
        if (data.length() > 0) notifyListeners("openNotification", data, true);
    }

    private JSObject consume(Intent intent) {
        JSObject data = new JSObject();
        SharedPreferences prefs = NewsMessagingService.preferences(getContext());
        String pendingRaw = prefs.getString("pendingSaves", "[]");
        if (!"[]".equals(pendingRaw) && !pendingRaw.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(pendingRaw);
                if (arr.length() > 0) {
                    data.put("pendingSaves", arr);
                }
            } catch (Exception ignored) {}
            prefs.edit().remove("pendingSaves").apply();
        }
        if (intent == null) return data;
        String token = intent.getStringExtra(EXTRA_TOKEN);
        intent.removeExtra(EXTRA_TOKEN);
        if (!launchToken(getContext()).equals(token)) return data;
        String rawPayload = intent.getStringExtra(EXTRA_NOTIFICATION_PAYLOAD);
        intent.removeExtra(EXTRA_NOTIFICATION_PAYLOAD);
        if (rawPayload != null && !rawPayload.isEmpty()) {
            try {
                data.put("article", new JSONObject(rawPayload));
            } catch (Exception ignored) {}
        }
        return data;
    }

    @PluginMethod
    public void test(PluginCall call) {
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            call.reject("Android hat Benachrichtigungen gesperrt.");
            return;
        }
        NewsMessagingService.showRich(
            getContext(),
            "opennews-test",
            "OpenNews-Eilmeldung (Test)",
            "So erscheinen wichtige Meldungen mit Aktionen auf deinem Gerät.",
            "OpenNews",
            "https://opennews.app/",
            null,
            true
        );
        call.resolve();
    }
}
