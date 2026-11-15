package io.opennews.app;

import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

@CapacitorPlugin(name = "BriefingSpeech")
public class BriefingSpeech extends Plugin {
    private TextToSpeech engine;
    private boolean ready;
    private PluginCall pending;
    private String pendingText;
    private boolean paused;
    private int position;
    private int utteranceStart;
    private int sequence;
    private String utteranceId;

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text.isBlank() || text.length() > TextToSpeech.getMaxSpeechInputLength()) {
            call.reject("Ungültiger Vorlesetext.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            stopPending();
            pending = call;
            pendingText = text;
            if (ready) {
                startSpeech();
            } else if (engine == null) {
                engine = new TextToSpeech(getContext(), status -> getActivity().runOnUiThread(() -> {
                    if (engine == null) return;
                    if (status != TextToSpeech.SUCCESS || engine.setLanguage(Locale.GERMANY) < 0) {
                        if (pending != null) pending.reject("Deutsche Systemstimme fehlt.");
                        pending = null;
                        engine.shutdown();
                        engine = null;
                        return;
                    }
                    ready = true;
                    engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override public void onStart(String id) {}
                        @Override public void onRangeStart(String id, int start, int end, int frame) {
                            getActivity().runOnUiThread(() -> {
                                if (id.equals(utteranceId)) position = utteranceStart + start;
                            });
                        }
                        @Override public void onDone(String id) { finish(id, false); }
                        @Override public void onError(String id) { finish(id, true); }
                    });
                    startSpeech();
                }));
            }
        });
    }

    private void startSpeech() {
        if (pending == null || paused || !ready) return;
        utteranceStart = position;
        utteranceId = "briefing-" + (++sequence);
        if (engine.speak(pendingText.substring(position), TextToSpeech.QUEUE_FLUSH, null, utteranceId) == TextToSpeech.ERROR) {
            pending.reject("Vorlesen konnte nicht gestartet werden.");
            pending = null;
        }
    }

    private void finish(String id, boolean failed) {
        getActivity().runOnUiThread(() -> {
            if (pending == null || !id.equals(utteranceId)) return;
            if (failed) pending.reject("Wiedergabe fehlgeschlagen.");
            else pending.resolve();
            pending = null;
        });
    }

    private void stopPending() {
        utteranceId = null;
        position = 0;
        paused = false;
        if (engine != null) engine.stop();
        if (pending != null) pending.resolve();
        pending = null;
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            stopPending();
            call.resolve();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pending == null) {
                call.reject("Keine laufende Wiedergabe.");
                return;
            }
            paused = true;
            utteranceId = null;
            if (ready) engine.stop();
            call.resolve();
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (paused) {
                paused = false;
                startSpeech();
            }
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        stopPending();
        if (engine != null) engine.shutdown();
        engine = null;
        ready = false;
    }
}
