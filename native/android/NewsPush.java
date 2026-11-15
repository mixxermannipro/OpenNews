package io.opennews.app;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
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

@CapacitorPlugin(name = "NewsPush", permissions = {
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class NewsPush extends Plugin {
    private static final String TOPICS = "topics";
    private Task<Void> pending = Tasks.forResult(null);

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
        preferences.edit().putBoolean("enabled", enabled && permitted)
            .putStringSet("desired", desired)
            .putBoolean("breakingOnly", call.getBoolean("breakingOnly", true))
            .putString("categories", call.getArray("topics", new JSArray()).toString())
            .putString("from", call.getString("from", "00:00"))
            .putString("until", call.getString("until", "23:59")).apply();
        if (FirebaseApp.getApps(getContext()).isEmpty()) {
            call.resolve(new JSObject().put("status", enabled && !permitted ? "denied" : "unconfigured"));
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
                if (!task.isSuccessful()) call.reject("Push-Anmeldung fehlgeschlagen.", task.getException());
                else call.resolve(new JSObject().put("status", enabled && !permitted ? "denied" : "ready"));
            });
        }
    }

    @PluginMethod
    public void test(PluginCall call) {
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            call.reject("Android hat Benachrichtigungen gesperrt.");
            return;
        }
        NewsMessagingService.show(getContext(), "opennews-test", "OpenNews-Test", "Android-Benachrichtigungen sind erlaubt.");
        call.resolve();
    }
}
