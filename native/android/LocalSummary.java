package io.opennews.app;

import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.genai.common.FeatureStatus;
import com.google.mlkit.genai.summarization.Summarization;
import com.google.mlkit.genai.summarization.SummarizationRequest;
import com.google.mlkit.genai.summarization.Summarizer;
import com.google.mlkit.genai.summarization.SummarizerOptions;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "LocalSummary")
public class LocalSummary extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    private Summarizer createSummarizer() {
        return Summarization.getClient(SummarizerOptions.builder(getContext())
            .setInputType(SummarizerOptions.InputType.ARTICLE)
            .setOutputType(SummarizerOptions.OutputType.ONE_BULLET)
            .setLanguage(SummarizerOptions.Language.ENGLISH)
            .build());
    }

    @PluginMethod
    public void availability(PluginCall call) {
        worker.execute(() -> {
            int status = FeatureStatus.UNAVAILABLE;
            Summarizer summarizer = null;
            try {
                if (Build.VERSION.SDK_INT >= 26) {
                    summarizer = createSummarizer();
                    status = summarizer.checkFeatureStatus().get();
                }
            } catch (Exception | LinkageError ignored) {
                // Availability also covers devices without a compatible AICore service.
            } finally {
                if (summarizer != null) summarizer.close();
            }
            call.resolve(new JSObject().put("supported", status != FeatureStatus.UNAVAILABLE));
        });
    }

    @PluginMethod
    public void summarize(PluginCall call) {
        String text = call.getString("text", "");
        if (Build.VERSION.SDK_INT < 26 || text.length() <= 400 || text.length() > 6000) {
            call.reject("Für das lokale Modell wird ein längerer englischer Artikel benötigt.");
            return;
        }
        worker.execute(() -> {
            Summarizer summarizer = null;
            try {
                summarizer = createSummarizer();
                if (summarizer.checkFeatureStatus().get() == FeatureStatus.UNAVAILABLE) {
                    call.reject("Das lokale Modell ist auf diesem Gerät nicht verfügbar.");
                    return;
                }
                String summary = summarizer.runInference(SummarizationRequest.builder(text).build()).get().getSummary();
                call.resolve(new JSObject().put("summary", summary));
            } catch (Exception | LinkageError error) {
                call.reject("Die lokale Zusammenfassung konnte nicht erstellt werden.");
            } finally {
                if (summarizer != null) summarizer.close();
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        worker.shutdownNow();
    }
}
