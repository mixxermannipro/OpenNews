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
                        @Override public void onDone(String id) { finish(id, false); }
                        @Override public void onError(String id) { finish(id, true); }
                    });
                    startSpeech();
                }));
            }
        });
    }

    private void startSpeech() {
        if (pending == null) return;
        if (engine.speak(pendingText, TextToSpeech.QUEUE_FLUSH, null, pending.getCallbackId()) == TextToSpeech.ERROR) {
            pending.reject("Vorlesen konnte nicht gestartet werden.");
            pending = null;
        }
    }

    private void finish(String id, boolean failed) {
        getActivity().runOnUiThread(() -> {
            if (pending == null || !pending.getCallbackId().equals(id)) return;
            if (failed) pending.reject("Wiedergabe fehlgeschlagen.");
            else pending.resolve();
            pending = null;
        });
    }

    private void stopPending() {
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

    @Override
    protected void handleOnDestroy() {
        stopPending();
        if (engine != null) engine.shutdown();
        engine = null;
        ready = false;
    }
}
