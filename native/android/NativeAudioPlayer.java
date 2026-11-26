package io.opennews.app;

import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;

import java.io.File;

@CapacitorPlugin(name = "NativeAudioPlayer")
public class NativeAudioPlayer extends Plugin {
    private static final String EXTRA_IS_LIVE = "io.opennews.app.EXTRA_IS_LIVE";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private ListenableFuture<MediaController> controllerFuture;
    private MediaController controller;
    private String activeUrl = "";
    private boolean tickerRunning = false;

    private final Runnable progressTicker = new Runnable() {
        @Override
        public void run() {
            if (!tickerRunning || controller == null) return;
            emitPlaybackState(false, false);
            if (controller.isPlaying()) {
                mainHandler.postDelayed(this, 1000L);
            } else {
                tickerRunning = false;
            }
        }
    };

    private final Player.Listener playerListener = new Player.Listener() {
        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            emitPlaybackState(false, false);
            if (isPlaying) {
                startTicker();
            } else {
                stopTicker();
            }
        }

        @Override
        public void onPlaybackStateChanged(int playbackState) {
            emitPlaybackState(playbackState == Player.STATE_ENDED, false);
            if (playbackState == Player.STATE_READY && controller != null && controller.isPlaying()) {
                startTicker();
            } else if (playbackState == Player.STATE_ENDED || playbackState == Player.STATE_IDLE) {
                stopTicker();
            }
        }

        @Override
        public void onPlayerError(@NonNull PlaybackException error) {
            stopTicker();
            emitPlaybackState(false, true);
        }
    };

    @PluginMethod
    public void play(PluginCall call) {
        final String url = call.getString("url", "");
        if (!url.startsWith("https://")) {
            call.reject("Nur HTTPS-Audioadressen sind erlaubt.");
            return;
        }
        final String title = call.getString("title", "OpenNews Audio");
        final String artist = call.getString("artist", "OpenNews");
        final String artworkUrl = call.getString("artworkUrl", "");
        final String stationId = call.getString("stationId", "");
        final boolean isLive = Boolean.TRUE.equals(call.getBoolean("isLive", false));
        final double initialSec = call.getDouble("initialSeconds", 0d);
        final float speed = isLive ? 1f : clampSpeed(call.getFloat("speed", 1f));

        withController(call, mc -> {
            activeUrl = url;
            Bundle extras = new Bundle();
            extras.putBoolean(EXTRA_IS_LIVE, isLive);
            extras.putString(OpenNewsAutoMediaService.EXTRA_AUDIO_URL, url);

            MediaMetadata.Builder meta = new MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .setIsBrowsable(false)
                .setIsPlayable(true)
                .setExtras(extras);

            if (!stationId.isEmpty() && AutoAudioCatalog.findRadio(stationId) != null) {
                meta.setArtworkUri(AutoArtworkProvider.stationUri(getContext().getPackageName(), stationId));
            } else if (!artworkUrl.isEmpty() && artworkUrl.startsWith("https://")) {
                meta.setArtworkUri(Uri.parse(artworkUrl));
            }

            File cached = !isLive ? AutoAudioCache.getCachedFile(getContext(), url) : null;
            Uri playbackUri = cached != null ? Uri.fromFile(cached) : Uri.parse(url);
            String mediaId = !stationId.isEmpty() ? ("radio:" + stationId) : url;

            MediaItem item = new MediaItem.Builder()
                .setMediaId(mediaId)
                .setUri(playbackUri)
                .setMediaMetadata(meta.build())
                .build();

            long startMs = !isLive && initialSec > 3d ? Math.round(initialSec * 1000d) : 0L;
            mc.setMediaItem(item, startMs);
            mc.setPlaybackSpeed(speed);
            mc.prepare();
            mc.play();
            call.resolve(buildStateJson(mc, false, false));
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        withController(call, mc -> {
            mc.pause();
            emitPlaybackState(false, false);
            call.resolve(buildStateJson(mc, false, false));
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        withController(call, mc -> {
            mc.play();
            emitPlaybackState(false, false);
            call.resolve(buildStateJson(mc, false, false));
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        withController(call, mc -> {
            stopTicker();
            mc.stop();
            mc.clearMediaItems();
            activeUrl = "";
            call.resolve();
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        final double sec = Math.max(0d, call.getDouble("seconds", 0d));
        withController(call, mc -> {
            mc.seekTo(Math.round(sec * 1000d));
            emitPlaybackState(false, false);
            call.resolve(buildStateJson(mc, false, false));
        });
    }

    @PluginMethod
    public void seekBy(PluginCall call) {
        final double deltaSec = call.getDouble("deltaSeconds", 0d);
        withController(call, mc -> {
            long dur = mc.getDuration();
            long target = mc.getCurrentPosition() + Math.round(deltaSec * 1000d);
            target = Math.max(0L, dur != C.TIME_UNSET && dur > 0L ? Math.min(dur, target) : target);
            mc.seekTo(target);
            emitPlaybackState(false, false);
            call.resolve(buildStateJson(mc, false, false));
        });
    }

    @PluginMethod
    public void setSpeed(PluginCall call) {
        final float speed = clampSpeed(call.getFloat("speed", 1f));
        withController(call, mc -> {
            mc.setPlaybackSpeed(speed);
            call.resolve(buildStateJson(mc, false, false));
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        withController(call, mc -> call.resolve(buildStateJson(mc, false, false)));
    }

    @Override
    protected void handleOnDestroy() {
        stopTicker();
        if (controller != null) {
            controller.removeListener(playerListener);
            controller = null;
        }
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
            controllerFuture = null;
        }
        super.handleOnDestroy();
    }

    private interface ControllerTask {
        void run(MediaController mc);
    }

    private void withController(PluginCall call, ControllerTask task) {
        mainHandler.post(() -> {
            if (controller != null && controller.isConnected()) {
                task.run(controller);
                return;
            }
            Context appContext = getContext().getApplicationContext();
            if (controllerFuture == null || controllerFuture.isCancelled()) {
                SessionToken token = new SessionToken(
                    appContext,
                    new ComponentName(appContext, OpenNewsAutoMediaService.class)
                );
                controllerFuture = new MediaController.Builder(appContext, token).buildAsync();
            }
            controllerFuture.addListener(() -> {
                try {
                    MediaController connected = controllerFuture.get();
                    if (controller != connected) {
                        if (controller != null) controller.removeListener(playerListener);
                        controller = connected;
                        controller.addListener(playerListener);
                    }
                    task.run(connected);
                } catch (Exception error) {
                    call.reject("Nativer Audio-Dienst konnte nicht verbunden werden.", error);
                }
            }, ContextCompat.getMainExecutor(appContext));
        });
    }

    private void startTicker() {
        if (tickerRunning) return;
        tickerRunning = true;
        mainHandler.postDelayed(progressTicker, 1000L);
    }

    private void stopTicker() {
        tickerRunning = false;
        mainHandler.removeCallbacks(progressTicker);
    }

    private void emitPlaybackState(boolean ended, boolean error) {
        if (controller == null) return;
        notifyListeners("playbackState", buildStateJson(controller, ended, error), false);
    }

    private JSObject buildStateJson(MediaController mc, boolean ended, boolean error) {
        JSObject obj = new JSObject();
        String itemUrl = activeUrl;
        MediaItem current = mc.getCurrentMediaItem();
        if (current != null && current.mediaMetadata.extras != null) {
            String remote = current.mediaMetadata.extras.getString(OpenNewsAutoMediaService.EXTRA_AUDIO_URL, "");
            if (!remote.isEmpty()) itemUrl = remote;
        }
        long durMs = mc.getDuration();
        long posMs = mc.getCurrentPosition();
        int state = mc.getPlaybackState();
        obj.put("url", itemUrl);
        obj.put("playing", mc.isPlaying());
        obj.put("buffering", state == Player.STATE_BUFFERING);
        obj.put("currentTime", posMs > 0L ? (posMs / 1000.0) : 0.0);
        obj.put("duration", durMs != C.TIME_UNSET && durMs > 0L ? (durMs / 1000.0) : 0.0);
        obj.put("ended", ended || state == Player.STATE_ENDED);
        obj.put("error", error);
        return obj;
    }

    private static float clampSpeed(float raw) {
        if (!Float.isFinite(raw)) return 1f;
        return Math.max(0.75f, Math.min(2.0f, raw));
    }
}
