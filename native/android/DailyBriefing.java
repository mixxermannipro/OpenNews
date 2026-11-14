package io.opennews.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Calendar;

@CapacitorPlugin(name = "DailyBriefing", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class DailyBriefing extends Plugin {
    static final String ACTION = "io.opennews.app.DAILY_BRIEFING";
    private static final String STORE = "opennews-briefing";
    private static final String CHANNEL = "opennews-daily-briefing";

    @PluginMethod
    public void configure(PluginCall call) {
        if (Boolean.TRUE.equals(call.getBoolean("enabled")) && Build.VERSION.SDK_INT >= 33 &&
            getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionResult");
        } else {
            save(call);
        }
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("Android hat Benachrichtigungen nicht erlaubt.");
            return;
        }
        save(call);
    }

    private void save(PluginCall call) {
        String time = call.getString("time", "");
        if (!time.matches("([01][0-9]|2[0-3]):[0-5][0-9]")) {
            call.reject("Ungültige Uhrzeit.");
            return;
        }
        Context context = getContext();
        context.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit()
            .putString("time", time).putBoolean("enabled", Boolean.TRUE.equals(call.getBoolean("enabled"))).apply();
        schedule(context);
        call.resolve();
    }

    @PluginMethod
    public void updateHeadline(PluginCall call) {
        getContext().getSharedPreferences(STORE, Context.MODE_PRIVATE).edit()
            .putString("headline", call.getString("headline", "")).apply();
        call.resolve();
    }

    @PluginMethod
    public void getLaunch(PluginCall call) {
        call.resolve(new JSObject().put("open", consume(getActivity().getIntent())));
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (consume(intent)) notifyListeners("open", new JSObject(), true);
    }

    private boolean consume(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(ACTION, false)) return false;
        intent.removeExtra(ACTION);
        return true;
    }

    static void schedule(Context context) {
        var prefs = context.getSharedPreferences(STORE, Context.MODE_PRIVATE);
        var alarms = context.getSystemService(AlarmManager.class);
        var target = PendingIntent.getBroadcast(context, 106, new Intent(context, Receiver.class).setAction(ACTION),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        alarms.cancel(target);
        if (!prefs.getBoolean("enabled", false)) return;
        String time = prefs.getString("time", "07:30");
        var next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, Integer.parseInt(time.substring(0, 2)));
        next.set(Calendar.MINUTE, Integer.parseInt(time.substring(3, 5)));
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_YEAR, 1);
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), target);
    }

    public static class Receiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            var prefs = context.getSharedPreferences(STORE, Context.MODE_PRIVATE);
            if (!prefs.getBoolean("enabled", false)) return;
            schedule(context);
            if (!ACTION.equals(intent.getAction())) return;
            if (Build.VERSION.SDK_INT >= 33 &&
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
            var manager = context.getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
                new NotificationChannel(CHANNEL, "Tagesüberblick", NotificationManager.IMPORTANCE_DEFAULT));
            var launch = new Intent(context, MainActivity.class).putExtra(ACTION, true)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            var click = PendingIntent.getActivity(context, 106, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            String headline = prefs.getString("headline", "");
            manager.notify(106, new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_opennews).setContentTitle("Dein Tagesüberblick")
                .setContentText(headline.isBlank() ? "Öffne OpenNews für die aktuellen Schlagzeilen." : headline)
                .setContentIntent(click).setAutoCancel(true).build());
        }
    }
}
