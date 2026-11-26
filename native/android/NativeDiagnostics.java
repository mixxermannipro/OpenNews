package io.opennews.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Local-only anonymized crash and failure counters for native Android services and widgets.
 * Stores error class + rounded hour timestamp without URLs, API keys, or user identifiers.
 */
final class NativeDiagnostics {
    static final String PREF_NAME = "opennews_native_diagnostics";
    static final String KEY_ENTRIES = "entries";
    static final int MAX_ENTRIES = 20;

    private NativeDiagnostics() {}

    static long roundToHourMs(long timestampMs) {
        if (timestampMs <= 0L) return 0L;
        return (timestampMs / 3_600_000L) * 3_600_000L;
    }

    static String formatErrorKey(String tag, Throwable error) {
        String cleanTag = (tag == null || tag.trim().isEmpty()) ? "native" : tag.trim().replaceAll("[^a-zA-Z0-9._-]", "_");
        String type = error != null ? error.getClass().getSimpleName() : "UnknownError";
        if (type == null || type.isEmpty()) type = "Throwable";
        return cleanTag + ":" + type;
    }

    static synchronized void record(Context context, String tag, Throwable error) {
        if (context == null) return;
        try {
            SharedPreferences prefs = context.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String key = formatErrorKey(tag, error);
            long hourMs = roundToHourMs(System.currentTimeMillis());
            JSONArray current;
            try {
                current = new JSONArray(prefs.getString(KEY_ENTRIES, "[]"));
            } catch (Exception ignored) {
                current = new JSONArray();
            }

            JSONArray updated = new JSONArray();
            boolean merged = false;
            for (int i = 0; i < current.length(); i++) {
                JSONObject item = current.optJSONObject(i);
                if (item == null) continue;
                if (!merged && key.equals(item.optString("key"))) {
                    JSONObject nextItem = new JSONObject();
                    nextItem.put("key", key);
                    nextItem.put("count", item.optInt("count", 0) + 1);
                    nextItem.put("hourMs", hourMs);
                    updated.put(nextItem);
                    merged = true;
                } else {
                    updated.put(item);
                }
            }
            if (!merged) {
                JSONObject nextItem = new JSONObject();
                nextItem.put("key", key);
                nextItem.put("count", 1);
                nextItem.put("hourMs", hourMs);
                updated.put(nextItem);
            }

            JSONArray bounded = updated;
            if (updated.length() > MAX_ENTRIES) {
                bounded = new JSONArray();
                for (int i = updated.length() - MAX_ENTRIES; i < updated.length(); i++) {
                    bounded.put(updated.get(i));
                }
            }
            prefs.edit().putString(KEY_ENTRIES, bounded.toString()).apply();
        } catch (Throwable ignored) {
            // Diagnostics recording must never crash the host component.
        }
    }
}
