package io.opennews.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.CommandButton;
import androidx.media3.session.LibraryResult;
import androidx.media3.session.MediaLibraryService;
import androidx.media3.session.MediaSession;
import androidx.media3.session.SessionCommand;
import androidx.media3.session.SessionError;
import androidx.media3.session.SessionResult;

import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@OptIn(markerClass = UnstableApi.class)
public class OpenNewsAutoMediaService extends MediaLibraryService {
    static final String ROOT_ID = "root";
    static final String TAB_UPDATES = "tab_updates";
    static final String TAB_PODCASTS = "tab_podcasts";
    static final String TAB_RADIO = "tab_radio";
    static final String TAB_QUEUE = "tab_queue";
    static final String ACTION_PLAY_ALL_UPDATES = "action_play_all_updates";
    private static final String ACTION_REPLAY_15 = "io.opennews.app.AUTO_REPLAY_15";
    private static final String ACTION_FORWARD_15 = "io.opennews.app.AUTO_FORWARD_15";
    private static final String EXTRA_IS_LIVE = "io.opennews.app.EXTRA_IS_LIVE";
    private static final String KEY_CONTENT_STYLE_SUPPORTED = "android.media.browse.CONTENT_STYLE_SUPPORTED";
    private static final String KEY_CONTENT_STYLE_BROWSABLE = "android.media.browse.CONTENT_STYLE_BROWSABLE_HINT";
    private static final String KEY_CONTENT_STYLE_PLAYABLE = "android.media.browse.CONTENT_STYLE_PLAYABLE_HINT";
    private static final int CONTENT_STYLE_LIST = 1;
    private static final int CONTENT_STYLE_GRID = 2;

    private static volatile OpenNewsAutoMediaService activeInstance;

    private AutoAudioStore store;
    private ExoPlayer player;
    private MediaLibrarySession mediaSession;
    private CommandButton replay15Button;
    private CommandButton forward15Button;
    private final Map<String, List<String>> parentContextOrder = new HashMap<>();

    static void notifyLibraryChanged(Context context, String parentId) {
        OpenNewsAutoMediaService instance = activeInstance;
        if (instance != null && instance.mediaSession != null) {
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (instance.mediaSession != null) {
                        instance.mediaSession.notifyChildrenChanged(parentId, Integer.MAX_VALUE, null);
                    }
                }
            });
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        activeInstance = this;
        store = new AutoAudioStore(this);

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
            .build();

        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .setSeekBackIncrementMs(15_000L)
            .setSeekForwardIncrementMs(15_000L)
            .build();

        player.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (!isPlaying) {
                    persistCurrentPlayback();
                }
            }

            @Override
            public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
                persistCurrentPlayback();
                updateCustomTransportLayout(mediaItem);
                if (mediaItem != null) {
                    AutoAudioStore.EpisodeEntry ep = store.findEpisodeByMediaId(mediaItem.mediaId);
                    store.saveLastPlayed(mediaItem.mediaId, ep);
                }
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_ENDED) {
                    persistCurrentPlayback();
                }
            }
        });

        String lang = store.getLanguage();
        replay15Button = new CommandButton.Builder(CommandButton.ICON_SKIP_BACK_15)
            .setDisplayName(AutoAudioCatalog.label(lang, "replay15"))
            .setSessionCommand(new SessionCommand(ACTION_REPLAY_15, Bundle.EMPTY))
            .setIconResId(R.drawable.ic_auto_replay_15)
            .build();

        forward15Button = new CommandButton.Builder(CommandButton.ICON_SKIP_FORWARD_15)
            .setDisplayName(AutoAudioCatalog.label(lang, "forward15"))
            .setSessionCommand(new SessionCommand(ACTION_FORWARD_15, Bundle.EMPTY))
            .setIconResId(R.drawable.ic_auto_forward_15)
            .build();

        mediaSession = new MediaLibrarySession.Builder(this, player, new LibraryCallback())
            .build();
        mediaSession.setCustomLayout(ImmutableList.of(replay15Button, forward15Button));

        AutoFeedFetcher.refreshAsync(this, false);
    }

    @Nullable
    @Override
    public MediaLibrarySession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        if (player == null || !player.getPlayWhenReady() || player.getMediaItemCount() == 0) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        persistCurrentPlayback();
        activeInstance = null;
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }

    private void persistCurrentPlayback() {
        if (player == null || store == null) return;
        MediaItem current = player.getCurrentMediaItem();
        if (current == null || isLiveMediaItem(current)) return;
        String url = current.localConfiguration != null && current.localConfiguration.uri != null
            ? current.localConfiguration.uri.toString()
            : "";
        if (!url.isEmpty()) {
            store.savePlaybackPosition(url, player.getCurrentPosition(), player.getDuration());
        }
    }

    private boolean isLiveMediaItem(@Nullable MediaItem item) {
        if (item == null) return false;
        if (item.mediaId.startsWith("radio:")) return true;
        Bundle extras = item.mediaMetadata.extras;
        return extras != null && extras.getBoolean(EXTRA_IS_LIVE, false);
    }

    private void updateCustomTransportLayout(@Nullable MediaItem item) {
        if (mediaSession == null) return;
        if (isLiveMediaItem(item)) {
            mediaSession.setCustomLayout(ImmutableList.of());
        } else {
            mediaSession.setCustomLayout(ImmutableList.of(replay15Button, forward15Button));
        }
    }

    private Uri resUri(int drawableRes) {
        return Uri.parse("android.resource://" + getPackageName() + "/" + drawableRes);
    }

    private MediaItem buildBrowsableTab(String id, String title, int iconRes, int playableStyle, int browsableStyle) {
        Bundle extras = new Bundle();
        extras.putBoolean(KEY_CONTENT_STYLE_SUPPORTED, true);
        extras.putInt(KEY_CONTENT_STYLE_PLAYABLE, playableStyle);
        extras.putInt(KEY_CONTENT_STYLE_BROWSABLE, browsableStyle);

        MediaMetadata metadata = new MediaMetadata.Builder()
            .setTitle(title)
            .setArtworkUri(resUri(iconRes))
            .setIsBrowsable(true)
            .setIsPlayable(false)
            .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_PODCASTS)
            .setExtras(extras)
            .build();

        return new MediaItem.Builder()
            .setMediaId(id)
            .setMediaMetadata(metadata)
            .build();
    }

    private MediaItem buildEpisodeItem(AutoAudioStore.EpisodeEntry ep, boolean includeUri) {
        String lang = store.getLanguage();
        String subtitle = AutoAudioCatalog.formatEpisodeSubtitle(lang, ep.feedName, ep.publishedMs, ep.durationSec);
        Bundle extras = new Bundle();
        extras.putBoolean(EXTRA_IS_LIVE, false);

        MediaMetadata.Builder meta = new MediaMetadata.Builder()
            .setTitle(ep.title)
            .setArtist(ep.feedName)
            .setSubtitle(subtitle)
            .setAlbumTitle(ep.feedName)
            .setIsBrowsable(false)
            .setIsPlayable(true)
            .setMediaType(MediaMetadata.MEDIA_TYPE_PODCAST_EPISODE)
            .setExtras(extras);

        if (ep.artworkUrl != null && ep.artworkUrl.startsWith("https://")) {
            meta.setArtworkUri(Uri.parse(ep.artworkUrl));
        } else {
            meta.setArtworkUri(resUri(R.drawable.ic_auto_podcasts));
        }

        MediaItem.Builder builder = new MediaItem.Builder()
            .setMediaId(ep.mediaId)
            .setMediaMetadata(meta.build());
        if (includeUri) {
            builder.setUri(ep.audioUrl);
        }
        return builder.build();
    }

    private MediaItem buildRadioItem(AutoAudioCatalog.RadioSpec spec, boolean includeUri) {
        String lang = store.getLanguage();
        Bundle extras = new Bundle();
        extras.putBoolean(EXTRA_IS_LIVE, true);

        MediaMetadata metadata = new MediaMetadata.Builder()
            .setTitle(spec.name)
            .setArtist(AutoAudioCatalog.label(lang, "live") + " · " + spec.region)
            .setSubtitle(spec.subtitle)
            .setArtworkUri(resUri(R.drawable.ic_auto_radio))
            .setIsBrowsable(false)
            .setIsPlayable(true)
            .setMediaType(MediaMetadata.MEDIA_TYPE_RADIO_STATION)
            .setExtras(extras)
            .build();

        MediaItem.Builder builder = new MediaItem.Builder()
            .setMediaId("radio:" + spec.id)
            .setMediaMetadata(metadata);
        if (includeUri) {
            builder.setUri(spec.streamUrl);
        }
        return builder.build();
    }

    private List<AutoAudioCatalog.RadioSpec> getOrderedRadioStations() {
        final Set<String> favs = new HashSet<>(store.getRadioFavoriteIds());
        final String lang = store.getLanguage();
        List<AutoAudioCatalog.RadioSpec> list = new ArrayList<>(AutoAudioCatalog.RADIO_STATIONS);
        Collections.sort(list, new Comparator<AutoAudioCatalog.RadioSpec>() {
            private int score(AutoAudioCatalog.RadioSpec s) {
                int p = 0;
                if (favs.contains(s.id)) p += 1000;
                if (s.language.equalsIgnoreCase(lang)) p += 200;
                if ("DE".equals(s.region) || "AT".equals(s.region) || "CH".equals(s.region)) p += 40;
                if (s.newsCategory) p += 10;
                return p;
            }

            @Override
            public int compare(AutoAudioCatalog.RadioSpec a, AutoAudioCatalog.RadioSpec b) {
                return Integer.compare(score(b), score(a));
            }
        });
        return list;
    }

    private MediaItem resolvePlayableMediaItem(String mediaId) {
        if (mediaId == null || mediaId.isEmpty()) return null;
        if (mediaId.startsWith("radio:")) {
            AutoAudioCatalog.RadioSpec spec = AutoAudioCatalog.findRadio(mediaId.substring("radio:".length()));
            return spec != null ? buildRadioItem(spec, true) : null;
        }
        AutoAudioStore.EpisodeEntry ep = store.findEpisodeByMediaId(mediaId);
        if (ep != null) {
            return buildEpisodeItem(ep, true);
        }
        return null;
    }

    private final class LibraryCallback implements MediaLibrarySession.Callback {
        @Override
        @NonNull
        public MediaSession.ConnectionResult onConnect(
            @NonNull MediaSession session,
            @NonNull MediaSession.ControllerInfo controller
        ) {
            MediaSession.ConnectionResult base = MediaLibrarySession.Callback.super.onConnect(session, controller);
            SessionCommand replayCmd = new SessionCommand(ACTION_REPLAY_15, Bundle.EMPTY);
            SessionCommand forwardCmd = new SessionCommand(ACTION_FORWARD_15, Bundle.EMPTY);
            return new MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                .setAvailableSessionCommands(
                    base.availableSessionCommands.buildUpon()
                        .add(replayCmd)
                        .add(forwardCmd)
                        .build()
                )
                .setAvailablePlayerCommands(base.availablePlayerCommands)
                .setCustomLayout(isLiveMediaItem(player.getCurrentMediaItem())
                    ? ImmutableList.of()
                    : ImmutableList.of(replay15Button, forward15Button))
                .build();
        }

        @Override
        @NonNull
        public ListenableFuture<SessionResult> onCustomCommand(
            @NonNull MediaSession session,
            @NonNull MediaSession.ControllerInfo controller,
            @NonNull SessionCommand customCommand,
            @NonNull Bundle args
        ) {
            if (ACTION_REPLAY_15.equals(customCommand.customAction)) {
                if (!isLiveMediaItem(player.getCurrentMediaItem())) {
                    player.seekBack();
                }
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
            }
            if (ACTION_FORWARD_15.equals(customCommand.customAction)) {
                if (!isLiveMediaItem(player.getCurrentMediaItem())) {
                    player.seekForward();
                }
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
            }
            return MediaLibrarySession.Callback.super.onCustomCommand(session, controller, customCommand, args);
        }

        @Override
        @NonNull
        public ListenableFuture<LibraryResult<MediaItem>> onGetLibraryRoot(
            @NonNull MediaLibrarySession session,
            @NonNull MediaSession.ControllerInfo browser,
            @Nullable LibraryParams params
        ) {
            Bundle extras = new Bundle();
            extras.putBoolean(KEY_CONTENT_STYLE_SUPPORTED, true);
            extras.putInt(KEY_CONTENT_STYLE_BROWSABLE, CONTENT_STYLE_LIST);
            extras.putInt(KEY_CONTENT_STYLE_PLAYABLE, CONTENT_STYLE_LIST);

            MediaMetadata rootMeta = new MediaMetadata.Builder()
                .setTitle("OpenNews")
                .setIsBrowsable(true)
                .setIsPlayable(false)
                .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED)
                .setExtras(extras)
                .build();

            MediaItem root = new MediaItem.Builder()
                .setMediaId(ROOT_ID)
                .setMediaMetadata(rootMeta)
                .build();
            return Futures.immediateFuture(LibraryResult.ofItem(root, params));
        }

        @Override
        @NonNull
        public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetChildren(
            @NonNull MediaLibrarySession session,
            @NonNull MediaSession.ControllerInfo browser,
            @NonNull String parentId,
            int page,
            int pageSize,
            @Nullable LibraryParams params
        ) {
            String lang = store.getLanguage();
            List<MediaItem> children = new ArrayList<>();

            if (ROOT_ID.equals(parentId)) {
                children.add(buildBrowsableTab(
                    TAB_UPDATES,
                    AutoAudioCatalog.label(lang, "updates"),
                    R.drawable.ic_auto_updates,
                    CONTENT_STYLE_LIST,
                    CONTENT_STYLE_LIST
                ));
                children.add(buildBrowsableTab(
                    TAB_PODCASTS,
                    AutoAudioCatalog.label(lang, "podcasts"),
                    R.drawable.ic_auto_podcasts,
                    CONTENT_STYLE_LIST,
                    CONTENT_STYLE_GRID
                ));
                if (store.isShowLiveRadio()) {
                    children.add(buildBrowsableTab(
                        TAB_RADIO,
                        AutoAudioCatalog.label(lang, "radio"),
                        R.drawable.ic_auto_radio,
                        CONTENT_STYLE_LIST,
                        CONTENT_STYLE_LIST
                    ));
                }
                children.add(buildBrowsableTab(
                    TAB_QUEUE,
                    AutoAudioCatalog.label(lang, "queue"),
                    R.drawable.ic_auto_queue,
                    CONTENT_STYLE_LIST,
                    CONTENT_STYLE_LIST
                ));
                return Futures.immediateFuture(LibraryResult.ofItemList(children, params));
            }

            if (TAB_UPDATES.equals(parentId)) {
                AutoFeedFetcher.refreshAsync(OpenNewsAutoMediaService.this, false);
                List<AutoAudioStore.EpisodeEntry> updates = store.getRecentUpdateEpisodes();
                if (!updates.isEmpty()) {
                    MediaMetadata playAllMeta = new MediaMetadata.Builder()
                        .setTitle(AutoAudioCatalog.label(lang, "playAllTitle"))
                        .setSubtitle(AutoAudioCatalog.label(lang, "playAllSub"))
                        .setArtworkUri(resUri(R.drawable.ic_auto_play_all))
                        .setIsBrowsable(false)
                        .setIsPlayable(true)
                        .setMediaType(MediaMetadata.MEDIA_TYPE_PLAYLIST)
                        .build();
                    children.add(new MediaItem.Builder()
                        .setMediaId(ACTION_PLAY_ALL_UPDATES)
                        .setMediaMetadata(playAllMeta)
                        .build());

                    List<String> order = new ArrayList<>();
                    for (AutoAudioStore.EpisodeEntry ep : updates) {
                        children.add(buildEpisodeItem(ep, false));
                        order.add(ep.mediaId);
                    }
                    parentContextOrder.put(TAB_UPDATES, order);
                }
                return Futures.immediateFuture(LibraryResult.ofItemList(paginate(children, page, pageSize), params));
            }

            if (TAB_PODCASTS.equals(parentId)) {
                AutoFeedFetcher.refreshAsync(OpenNewsAutoMediaService.this, false);
                List<AutoAudioStore.FeedEntry> feeds = store.getActiveFeeds();
                for (AutoAudioStore.FeedEntry feed : feeds) {
                    Bundle extras = new Bundle();
                    extras.putBoolean(KEY_CONTENT_STYLE_SUPPORTED, true);
                    extras.putInt(KEY_CONTENT_STYLE_PLAYABLE, CONTENT_STYLE_LIST);
                    MediaMetadata meta = new MediaMetadata.Builder()
                        .setTitle(feed.name)
                        .setSubtitle(feed.language != null ? feed.language.toUpperCase(java.util.Locale.ROOT) : "")
                        .setArtworkUri(resUri(R.drawable.ic_auto_podcasts))
                        .setIsBrowsable(true)
                        .setIsPlayable(false)
                        .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_PODCASTS)
                        .setExtras(extras)
                        .build();
                    children.add(new MediaItem.Builder()
                        .setMediaId("podcast:" + feed.id)
                        .setMediaMetadata(meta)
                        .build());
                }
                return Futures.immediateFuture(LibraryResult.ofItemList(paginate(children, page, pageSize), params));
            }

            if (parentId.startsWith("podcast:")) {
                String feedId = parentId.substring("podcast:".length());
                List<AutoAudioStore.EpisodeEntry> eps = store.getCachedFeedEpisodes(feedId);
                if (eps.isEmpty()) {
                    for (AutoAudioStore.FeedEntry f : store.getActiveFeeds()) {
                        if (f.id.equals(feedId)) {
                            AutoFeedFetcher.refreshSingleFeedAsync(OpenNewsAutoMediaService.this, f);
                            break;
                        }
                    }
                }
                List<String> order = new ArrayList<>();
                for (AutoAudioStore.EpisodeEntry ep : eps) {
                    children.add(buildEpisodeItem(ep, false));
                    order.add(ep.mediaId);
                }
                parentContextOrder.put(parentId, order);
                return Futures.immediateFuture(LibraryResult.ofItemList(paginate(children, page, pageSize), params));
            }

            if (TAB_RADIO.equals(parentId)) {
                for (AutoAudioCatalog.RadioSpec spec : getOrderedRadioStations()) {
                    children.add(buildRadioItem(spec, false));
                }
                return Futures.immediateFuture(LibraryResult.ofItemList(paginate(children, page, pageSize), params));
            }

            if (TAB_QUEUE.equals(parentId)) {
                List<AutoAudioStore.EpisodeEntry> queue = store.getQueueEpisodes();
                List<String> order = new ArrayList<>();
                for (AutoAudioStore.EpisodeEntry ep : queue) {
                    children.add(buildEpisodeItem(ep, false));
                    order.add(ep.mediaId);
                }
                if (order.isEmpty()) {
                    AutoAudioStore.EpisodeEntry last = store.getLastPlayedEpisode();
                    if (last != null) {
                        children.add(buildEpisodeItem(last, false));
                        order.add(last.mediaId);
                    }
                }
                parentContextOrder.put(TAB_QUEUE, order);
                return Futures.immediateFuture(LibraryResult.ofItemList(paginate(children, page, pageSize), params));
            }

            return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE));
        }

        @Override
        @NonNull
        public ListenableFuture<LibraryResult<MediaItem>> onGetItem(
            @NonNull MediaLibrarySession session,
            @NonNull MediaSession.ControllerInfo browser,
            @NonNull String mediaId
        ) {
            MediaItem item = resolvePlayableMediaItem(mediaId);
            if (item != null) {
                return Futures.immediateFuture(LibraryResult.ofItem(item, null));
            }
            return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE));
        }

        @Override
        @NonNull
        public ListenableFuture<List<MediaItem>> onAddMediaItems(
            @NonNull MediaSession session,
            @NonNull MediaSession.ControllerInfo controller,
            @NonNull List<MediaItem> mediaItems
        ) {
            List<MediaItem> resolved = resolveRequestedItems(mediaItems);
            return Futures.immediateFuture(resolved);
        }

        @Override
        @NonNull
        public ListenableFuture<MediaSession.MediaItemsWithStartPosition> onSetMediaItems(
            @NonNull MediaSession session,
            @NonNull MediaSession.ControllerInfo controller,
            @NonNull List<MediaItem> mediaItems,
            int startIndex,
            long startPositionMs
        ) {
            List<MediaItem> resolved = resolveRequestedItems(mediaItems);
            if (resolved.isEmpty()) {
                return Futures.immediateFuture(
                    new MediaSession.MediaItemsWithStartPosition(resolved, C.INDEX_UNSET, C.TIME_UNSET)
                );
            }
            int safeIndex = (startIndex >= 0 && startIndex < resolved.size()) ? startIndex : 0;
            MediaItem first = resolved.get(safeIndex);
            long resumePos = startPositionMs;
            if (resumePos == C.TIME_UNSET && !isLiveMediaItem(first) && first.localConfiguration != null) {
                resumePos = store.getPlaybackPositionMs(first.localConfiguration.uri.toString());
            }
            updateCustomTransportLayout(first);
            return Futures.immediateFuture(
                new MediaSession.MediaItemsWithStartPosition(resolved, safeIndex, resumePos)
            );
        }

        @Override
        @NonNull
        public ListenableFuture<MediaSession.MediaItemsWithStartPosition> onPlaybackResumption(
            @NonNull MediaSession session,
            @NonNull MediaSession.ControllerInfo controller
        ) {
            String lastId = store.getLastPlayedMediaId();
            MediaItem item = resolvePlayableMediaItem(lastId);
            if (item == null) {
                List<AutoAudioStore.EpisodeEntry> updates = store.getRecentUpdateEpisodes();
                if (!updates.isEmpty()) {
                    item = buildEpisodeItem(updates.get(0), true);
                } else if (!AutoAudioCatalog.RADIO_STATIONS.isEmpty()) {
                    item = buildRadioItem(AutoAudioCatalog.RADIO_STATIONS.get(0), true);
                }
            }
            if (item == null) {
                return Futures.immediateFuture(
                    new MediaSession.MediaItemsWithStartPosition(Collections.<MediaItem>emptyList(), 0, 0L)
                );
            }
            long pos = (!isLiveMediaItem(item) && item.localConfiguration != null)
                ? store.getPlaybackPositionMs(item.localConfiguration.uri.toString())
                : 0L;
            updateCustomTransportLayout(item);
            return Futures.immediateFuture(
                new MediaSession.MediaItemsWithStartPosition(Collections.singletonList(item), 0, pos)
            );
        }

        @Override
        @NonNull
        public ListenableFuture<LibraryResult<Void>> onSearch(
            @NonNull MediaLibrarySession session,
            @NonNull MediaSession.ControllerInfo browser,
            @NonNull String query,
            @Nullable LibraryParams params
        ) {
            List<MediaItem> matches = performSearch(query);
            session.notifySearchResultChanged(browser, query, matches.size(), params);
            return Futures.immediateFuture(LibraryResult.ofVoid());
        }

        @Override
        @NonNull
        public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetSearchResult(
            @NonNull MediaLibrarySession session,
            @NonNull MediaSession.ControllerInfo browser,
            @NonNull String query,
            int page,
            int pageSize,
            @Nullable LibraryParams params
        ) {
            List<MediaItem> matches = performSearch(query);
            return Futures.immediateFuture(LibraryResult.ofItemList(paginate(matches, page, pageSize), params));
        }
    }

    private List<MediaItem> resolveRequestedItems(List<MediaItem> requested) {
        List<MediaItem> result = new ArrayList<>();
        if (requested == null || requested.isEmpty()) return result;

        if (requested.size() == 1) {
            String id = requested.get(0).mediaId;
            if (ACTION_PLAY_ALL_UPDATES.equals(id)) {
                List<AutoAudioStore.EpisodeEntry> playlist = store.getPlayAllUpdatesPlaylist();
                if (playlist.isEmpty()) {
                    playlist = store.getRecentUpdateEpisodes();
                }
                for (AutoAudioStore.EpisodeEntry ep : playlist) {
                    result.add(buildEpisodeItem(ep, true));
                }
                return result;
            }
            MediaItem single = resolvePlayableMediaItem(id);
            if (single != null) {
                result.add(single);
                if (!isLiveMediaItem(single) && store.isAutoplayQueue()) {
                    appendContextFollowers(id, result);
                }
            }
            return result;
        }

        for (MediaItem req : requested) {
            MediaItem item = resolvePlayableMediaItem(req.mediaId);
            if (item != null) result.add(item);
        }
        return result;
    }

    private void appendContextFollowers(String startedMediaId, List<MediaItem> target) {
        for (List<String> order : parentContextOrder.values()) {
            int idx = order.indexOf(startedMediaId);
            if (idx >= 0) {
                int added = 0;
                for (int i = idx + 1; i < order.size() && added < 10; i++) {
                    MediaItem next = resolvePlayableMediaItem(order.get(i));
                    if (next != null) {
                        target.add(next);
                        added++;
                    }
                }
                return;
            }
        }
    }

    private List<MediaItem> performSearch(String rawQuery) {
        String normalized = AutoAudioCatalog.normalizeSearch(rawQuery);
        List<MediaItem> results = new ArrayList<>();
        if (normalized.isEmpty()) return results;
        String[] tokens = normalized.split("\\s+");

        // 1. News Update episodes & podcasts matching query
        List<AutoAudioStore.EpisodeEntry> allEps = new ArrayList<>(store.getRecentUpdateEpisodes());
        for (List<AutoAudioStore.EpisodeEntry> feedEps : store.getCachedEpisodesByFeed().values()) {
            for (AutoAudioStore.EpisodeEntry ep : feedEps) {
                if (!ep.newsUpdate) allEps.add(ep);
            }
        }
        Set<String> seenIds = new HashSet<>();
        for (AutoAudioStore.EpisodeEntry ep : allEps) {
            String hay = AutoAudioCatalog.normalizeSearch(ep.feedName + " " + ep.title + " " + ep.summary);
            if (matchesAllTokens(hay, tokens) && seenIds.add(ep.mediaId)) {
                results.add(buildEpisodeItem(ep, false));
                if (results.size() >= 15) break;
            }
        }

        // 2. Live Radio stations matching query
        for (AutoAudioCatalog.RadioSpec spec : getOrderedRadioStations()) {
            String hay = AutoAudioCatalog.normalizeSearch(spec.name + " " + spec.shortCode + " " + spec.keywords + " " + spec.subtitle);
            if (matchesAllTokens(hay, tokens)) {
                results.add(buildRadioItem(spec, false));
            }
        }
        return results;
    }

    private static boolean matchesAllTokens(String haystack, String[] tokens) {
        for (String token : tokens) {
            if (!token.isEmpty() && !haystack.contains(token)) return false;
        }
        return true;
    }

    private static ImmutableList<MediaItem> paginate(List<MediaItem> list, int page, int pageSize) {
        if (list.isEmpty()) return ImmutableList.of();
        if (pageSize <= 0 || page < 0) return ImmutableList.copyOf(list);
        int from = Math.min(list.size(), page * pageSize);
        int to = Math.min(list.size(), from + pageSize);
        return ImmutableList.copyOf(list.subList(from, to));
    }
}
