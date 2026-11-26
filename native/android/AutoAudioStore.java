package io.opennews.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class AutoAudioStore {
    private static final String PREF_NAME = "opennews-auto";
    private static final String KEY_MODE = "mode";
    private static final String KEY_AUTOPLAY = "autoplayQueue";
    private static final String KEY_SHOW_RADIO = "showLiveRadio";
    private static final String KEY_DIRECT_REFRESH = "directFeedRefresh";
    private static final String KEY_LANGUAGE = "language";
    private static final String KEY_FEEDS = "feedsJson";
    private static final String KEY_RADIO_FAVS = "radioFavsJson";
    private static final String KEY_QUEUE = "queueJson";
    private static final String KEY_POSITIONS = "positionsJson";
    private static final String KEY_CACHED_EPISODES = "cachedEpisodesJson";
    private static final String KEY_LAST_REFRESH = "lastRefreshAt";
    private static final String KEY_LAST_PLAYED = "lastPlayedJson";

    static final String MODE_ALL_AUDIO = "all_audio";
    static final String MODE_SUBSCRIBED_ONLY = "subscribed_only";
    static final long CACHE_TTL_MS = 15L * 60L * 1000L;
    private static final int MAX_POSITIONS = 120;
    private static final int MAX_QUEUE = 40;

    static final class FeedEntry {
        final String id;
        final String name;
        final String url;
        final String language;
        final boolean subscribed;
        final boolean newsUpdate;

        FeedEntry(String id, String name, String url, String language, boolean subscribed, boolean newsUpdate) {
            this.id = id;
            this.name = name;
            this.url = url;
            this.language = language;
            this.subscribed = subscribed;
            this.newsUpdate = newsUpdate;
        }
    }

    static final class EpisodeEntry {
        final String mediaId;
        final String feedId;
        final String feedName;
        final String title;
        final String summary;
        final String audioUrl;
        final String artworkUrl;
        final long publishedMs;
        final int durationSec;
        final boolean newsUpdate;

        EpisodeEntry(
            String mediaId,
            String feedId,
            String feedName,
            String title,
            String summary,
            String audioUrl,
            String artworkUrl,
            long publishedMs,
            int durationSec,
            boolean newsUpdate
        ) {
            this.mediaId = mediaId;
            this.feedId = feedId;
            this.feedName = feedName;
            this.title = title;
            this.summary = summary;
            this.audioUrl = audioUrl;
            this.artworkUrl = artworkUrl;
            this.publishedMs = publishedMs;
            this.durationSec = durationSec;
            this.newsUpdate = newsUpdate;
        }

        JSONObject toJson() throws JSONException {
            JSONObject obj = new JSONObject();
            obj.put("mediaId", mediaId);
            obj.put("feedId", feedId);
            obj.put("feedName", feedName);
            obj.put("title", title);
            obj.put("summary", summary);
            obj.put("audioUrl", audioUrl);
            obj.put("artworkUrl", artworkUrl);
            obj.put("publishedMs", publishedMs);
            obj.put("durationSec", durationSec);
            obj.put("newsUpdate", newsUpdate);
            return obj;
        }

        static EpisodeEntry fromJson(JSONObject obj) {
            if (obj == null) return null;
            String audioUrl = obj.optString("audioUrl");
            String title = obj.optString("title");
            if (!audioUrl.startsWith("https://") || title.isEmpty()) return null;
            String feedId = obj.optString("feedId");
            String mediaId = obj.optString("mediaId");
            if (mediaId.isEmpty()) {
                mediaId = "ep:" + feedId + ":" + Integer.toHexString(audioUrl.hashCode());
            }
            return new EpisodeEntry(
                mediaId,
                feedId,
                obj.optString("feedName"),
                title,
                obj.optString("summary"),
                audioUrl,
                obj.optString("artworkUrl"),
                obj.optLong("publishedMs", 0L),
                obj.optInt("durationSec", 0),
                obj.optBoolean("newsUpdate", false)
            );
        }
    }

    private final SharedPreferences prefs;

    AutoAudioStore(Context context) {
        this.prefs = context.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    synchronized String getMode() {
        String mode = prefs.getString(KEY_MODE, MODE_ALL_AUDIO);
        return MODE_SUBSCRIBED_ONLY.equals(mode) ? MODE_SUBSCRIBED_ONLY : MODE_ALL_AUDIO;
    }

    synchronized boolean isAutoplayQueue() {
        return prefs.getBoolean(KEY_AUTOPLAY, true);
    }

    synchronized boolean isShowLiveRadio() {
        return prefs.getBoolean(KEY_SHOW_RADIO, true);
    }

    synchronized boolean isDirectFeedRefresh() {
        return prefs.getBoolean(KEY_DIRECT_REFRESH, true);
    }

    synchronized String getLanguage() {
        String stored = prefs.getString(KEY_LANGUAGE, "");
        if (stored != null && !stored.isEmpty()) return stored;
        return Locale.getDefault().getLanguage();
    }

    synchronized long getLastRefreshAt() {
        return prefs.getLong(KEY_LAST_REFRESH, 0L);
    }

    synchronized boolean isCacheStale() {
        long last = getLastRefreshAt();
        return last <= 0L || (System.currentTimeMillis() - last) > CACHE_TTL_MS;
    }

    synchronized void applySyncPayload(JSONObject payload) {
        if (payload == null) return;
        SharedPreferences.Editor editor = prefs.edit();
        JSONObject settings = payload.optJSONObject("settings");
        if (settings != null) {
            String mode = settings.optString("mode", MODE_ALL_AUDIO);
            editor.putString(KEY_MODE, MODE_SUBSCRIBED_ONLY.equals(mode) ? MODE_SUBSCRIBED_ONLY : MODE_ALL_AUDIO);
            editor.putBoolean(KEY_AUTOPLAY, settings.optBoolean("autoplayQueue", true));
            editor.putBoolean(KEY_SHOW_RADIO, settings.optBoolean("showLiveRadio", true));
            editor.putBoolean(KEY_DIRECT_REFRESH, settings.optBoolean("directFeedRefresh", true));
        }
        String language = payload.optString("language");
        if (!language.isEmpty()) editor.putString(KEY_LANGUAGE, language);

        JSONArray feeds = payload.optJSONArray("feeds");
        if (feeds != null) editor.putString(KEY_FEEDS, feeds.toString());

        JSONArray favs = payload.optJSONArray("radioFavorites");
        if (favs != null) editor.putString(KEY_RADIO_FAVS, favs.toString());

        JSONArray queue = payload.optJSONArray("queue");
        if (queue != null) editor.putString(KEY_QUEUE, queue.toString());

        JSONObject incomingPositions = payload.optJSONObject("positions");
        if (incomingPositions != null) {
            JSONObject merged = readJsonObject(prefs.getString(KEY_POSITIONS, "{}"));
            Iterator<String> keys = incomingPositions.keys();
            while (keys.hasNext()) {
                String url = keys.next();
                JSONObject pos = incomingPositions.optJSONObject(url);
                if (pos == null) continue;
                JSONObject existing = merged.optJSONObject(url);
                long incomingUpdated = pos.optLong("updatedAt", 0L);
                long existingUpdated = existing != null ? existing.optLong("updatedAt", 0L) : 0L;
                if (existing == null || incomingUpdated >= existingUpdated) {
                    try {
                        merged.put(url, pos);
                    } catch (JSONException ignored) {}
                }
            }
            editor.putString(KEY_POSITIONS, prunePositions(merged).toString());
        }
        editor.apply();
    }

    synchronized List<FeedEntry> getActiveFeeds() {
        String mode = getMode();
        String lang = getLanguage();
        Map<String, FeedEntry> syncedById = new LinkedHashMap<>();
        JSONArray syncedArr = readJsonArray(prefs.getString(KEY_FEEDS, "[]"));
        for (int i = 0; i < syncedArr.length(); i++) {
            JSONObject obj = syncedArr.optJSONObject(i);
            if (obj == null) continue;
            String id = obj.optString("id");
            String name = obj.optString("name");
            String url = obj.optString("url");
            if (id.isEmpty() || name.isEmpty() || !url.startsWith("https://")) continue;
            boolean subscribed = obj.optBoolean("subscribed", false);
            boolean newsUpdate = obj.optBoolean("newsUpdate", AutoAudioCatalog.isNewsUpdateFeed(id, name, url));
            syncedById.put(id, new FeedEntry(id, name, url, obj.optString("language", "de"), subscribed, newsUpdate));
        }

        List<FeedEntry> result = new ArrayList<>();
        Set<String> added = new HashSet<>();

        // Subscribed feeds from the app come first
        for (FeedEntry entry : syncedById.values()) {
            if (entry.subscribed) {
                result.add(entry);
                added.add(entry.id);
            }
        }

        if (MODE_ALL_AUDIO.equals(mode)) {
            for (AutoAudioCatalog.FeedSpec spec : AutoAudioCatalog.BUILTIN_FEEDS) {
                if (added.add(spec.id)) {
                    result.add(new FeedEntry(spec.id, spec.name, spec.url, spec.language, false, spec.newsUpdate));
                }
            }
        } else if (result.isEmpty()) {
            // Even in subscribed_only mode, keep user's language news updates if nothing subscribed yet
            for (AutoAudioCatalog.FeedSpec spec : AutoAudioCatalog.BUILTIN_FEEDS) {
                if (spec.newsUpdate && (spec.language.equalsIgnoreCase(lang) || "de".equalsIgnoreCase(spec.language))) {
                    if (added.add(spec.id)) {
                        result.add(new FeedEntry(spec.id, spec.name, spec.url, spec.language, false, true));
                    }
                }
            }
        }

        return result;
    }

    synchronized List<String> getRadioFavoriteIds() {
        JSONArray arr = readJsonArray(prefs.getString(KEY_RADIO_FAVS, "[]"));
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            String id = arr.optString(i);
            if (!id.isEmpty()) ids.add(id);
        }
        return ids;
    }

    synchronized List<EpisodeEntry> getQueueEpisodes() {
        JSONArray arr = readJsonArray(prefs.getString(KEY_QUEUE, "[]"));
        List<EpisodeEntry> list = new ArrayList<>();
        for (int i = 0; i < arr.length() && list.size() < MAX_QUEUE; i++) {
            EpisodeEntry ep = EpisodeEntry.fromJson(arr.optJSONObject(i));
            if (ep != null) list.add(ep);
        }
        return list;
    }

    synchronized Map<String, List<EpisodeEntry>> getCachedEpisodesByFeed() {
        JSONObject root = readJsonObject(prefs.getString(KEY_CACHED_EPISODES, "{}"));
        Map<String, List<EpisodeEntry>> map = new HashMap<>();
        Iterator<String> keys = root.keys();
        while (keys.hasNext()) {
            String feedId = keys.next();
            JSONArray arr = root.optJSONArray(feedId);
            if (arr == null) continue;
            List<EpisodeEntry> list = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                EpisodeEntry ep = EpisodeEntry.fromJson(arr.optJSONObject(i));
                if (ep != null) list.add(ep);
            }
            map.put(feedId, list);
        }
        return map;
    }

    synchronized List<EpisodeEntry> getCachedFeedEpisodes(String feedId) {
        List<EpisodeEntry> list = getCachedEpisodesByFeed().get(feedId);
        return list != null ? list : Collections.emptyList();
    }

    synchronized List<EpisodeEntry> getRecentUpdateEpisodes() {
        Map<String, List<EpisodeEntry>> byFeed = getCachedEpisodesByFeed();
        List<EpisodeEntry> updates = new ArrayList<>();
        Set<String> seenUrls = new HashSet<>();
        for (List<EpisodeEntry> feedEpisodes : byFeed.values()) {
            for (EpisodeEntry ep : feedEpisodes) {
                if (ep.newsUpdate && seenUrls.add(ep.audioUrl)) {
                    updates.add(ep);
                }
            }
        }
        Collections.sort(updates, new Comparator<EpisodeEntry>() {
            @Override
            public int compare(EpisodeEntry a, EpisodeEntry b) {
                return Long.compare(b.publishedMs, a.publishedMs);
            }
        });
        return updates;
    }

    synchronized List<EpisodeEntry> getPlayAllUpdatesPlaylist() {
        List<FeedEntry> feeds = getActiveFeeds();
        Map<String, List<EpisodeEntry>> byFeed = getCachedEpisodesByFeed();
        List<EpisodeEntry> playlist = new ArrayList<>();
        for (FeedEntry feed : feeds) {
            if (!feed.newsUpdate) continue;
            List<EpisodeEntry> eps = byFeed.get(feed.id);
            if (eps != null && !eps.isEmpty()) {
                playlist.add(eps.get(0));
            }
        }
        return playlist;
    }

    synchronized EpisodeEntry findEpisodeByMediaId(String mediaId) {
        if (mediaId == null || mediaId.isEmpty()) return null;
        for (EpisodeEntry ep : getQueueEpisodes()) {
            if (mediaId.equals(ep.mediaId)) return ep;
        }
        for (List<EpisodeEntry> list : getCachedEpisodesByFeed().values()) {
            for (EpisodeEntry ep : list) {
                if (mediaId.equals(ep.mediaId)) return ep;
            }
        }
        EpisodeEntry last = getLastPlayedEpisode();
        if (last != null && mediaId.equals(last.mediaId)) return last;
        return null;
    }

    synchronized void saveFetchedFeedEpisodes(Map<String, List<EpisodeEntry>> fetched) {
        if (fetched == null || fetched.isEmpty()) return;
        JSONObject root = readJsonObject(prefs.getString(KEY_CACHED_EPISODES, "{}"));
        for (Map.Entry<String, List<EpisodeEntry>> entry : fetched.entrySet()) {
            JSONArray arr = new JSONArray();
            for (EpisodeEntry ep : entry.getValue()) {
                try {
                    arr.put(ep.toJson());
                } catch (JSONException ignored) {}
            }
            try {
                root.put(entry.getKey(), arr);
            } catch (JSONException ignored) {}
        }
        prefs.edit()
            .putString(KEY_CACHED_EPISODES, root.toString())
            .putLong(KEY_LAST_REFRESH, System.currentTimeMillis())
            .apply();
    }

    synchronized void touchLastRefreshAt() {
        prefs.edit().putLong(KEY_LAST_REFRESH, System.currentTimeMillis()).apply();
    }

    synchronized long getPlaybackPositionMs(String audioUrl) {
        if (audioUrl == null || audioUrl.isEmpty()) return 0L;
        JSONObject positions = readJsonObject(prefs.getString(KEY_POSITIONS, "{}"));
        JSONObject entry = positions.optJSONObject(audioUrl);
        if (entry == null) return 0L;
        long sec = entry.optLong("seconds", 0L);
        long dur = entry.optLong("duration", 0L);
        if (dur > 0 && sec >= dur - 8) return 0L;
        return Math.max(0L, sec * 1000L);
    }

    synchronized void savePlaybackPosition(String audioUrl, long positionMs, long durationMs) {
        if (audioUrl == null || audioUrl.isEmpty() || positionMs < 3000L) return;
        long sec = positionMs / 1000L;
        long dur = durationMs > 0 ? durationMs / 1000L : 0L;
        JSONObject positions = readJsonObject(prefs.getString(KEY_POSITIONS, "{}"));
        try {
            if (dur > 0 && sec >= dur - 8) {
                positions.remove(audioUrl);
            } else {
                JSONObject entry = new JSONObject();
                entry.put("seconds", sec);
                entry.put("duration", dur);
                entry.put("updatedAt", System.currentTimeMillis());
                positions.put(audioUrl, entry);
            }
        } catch (JSONException ignored) {}
        prefs.edit().putString(KEY_POSITIONS, prunePositions(positions).toString()).apply();
    }

    synchronized void clearPlaybackPosition(String audioUrl) {
        if (audioUrl == null || audioUrl.isEmpty()) return;
        JSONObject positions = readJsonObject(prefs.getString(KEY_POSITIONS, "{}"));
        if (positions.has(audioUrl)) {
            positions.remove(audioUrl);
            prefs.edit().putString(KEY_POSITIONS, positions.toString()).apply();
        }
    }

    synchronized void saveLastPlayed(String mediaId, EpisodeEntry episode) {
        JSONObject obj = new JSONObject();
        try {
            obj.put("mediaId", mediaId);
            if (episode != null) {
                obj.put("episode", episode.toJson());
            }
            obj.put("updatedAt", System.currentTimeMillis());
        } catch (JSONException ignored) {}
        prefs.edit().putString(KEY_LAST_PLAYED, obj.toString()).apply();
    }

    synchronized String getLastPlayedMediaId() {
        JSONObject obj = readJsonObject(prefs.getString(KEY_LAST_PLAYED, "{}"));
        return obj.optString("mediaId", "");
    }

    synchronized EpisodeEntry getLastPlayedEpisode() {
        JSONObject obj = readJsonObject(prefs.getString(KEY_LAST_PLAYED, "{}"));
        return EpisodeEntry.fromJson(obj.optJSONObject("episode"));
    }

    synchronized JSONObject getStatusJson() {
        JSONObject status = new JSONObject();
        try {
            int episodeCount = 0;
            for (List<EpisodeEntry> list : getCachedEpisodesByFeed().values()) {
                episodeCount += list.size();
            }
            status.put("mode", getMode());
            status.put("activeFeeds", getActiveFeeds().size());
            status.put("cachedEpisodes", episodeCount);
            status.put("radioStations", AutoAudioCatalog.RADIO_STATIONS.size());
            status.put("queueCount", getQueueEpisodes().size());
            status.put("lastRefreshAt", getLastRefreshAt());
        } catch (JSONException ignored) {}
        return status;
    }

    private static JSONObject prunePositions(JSONObject obj) {
        if (obj.length() <= MAX_POSITIONS) return obj;
        List<Map.Entry<String, Long>> list = new ArrayList<>();
        Iterator<String> keys = obj.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            JSONObject val = obj.optJSONObject(k);
            list.add(new java.util.AbstractMap.SimpleEntry<>(k, val != null ? val.optLong("updatedAt", 0L) : 0L));
        }
        Collections.sort(list, new Comparator<Map.Entry<String, Long>>() {
            @Override
            public int compare(Map.Entry<String, Long> a, Map.Entry<String, Long> b) {
                return Long.compare(b.getValue(), a.getValue());
            }
        });
        JSONObject pruned = new JSONObject();
        for (int i = 0; i < Math.min(MAX_POSITIONS, list.size()); i++) {
            String k = list.get(i).getKey();
            try {
                pruned.put(k, obj.opt(k));
            } catch (JSONException ignored) {}
        }
        return pruned;
    }

    private static JSONArray readJsonArray(String raw) {
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static JSONObject readJsonObject(String raw) {
        try {
            return new JSONObject(raw);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }
}
