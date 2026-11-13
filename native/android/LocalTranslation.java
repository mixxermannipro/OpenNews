package io.opennews.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "LocalTranslation")
public class LocalTranslation extends Plugin {
    @PluginMethod
    public void translate(PluginCall call) {
        JSArray texts = call.getArray("texts");
        if (texts == null || texts.length() > 150) {
            call.reject("Zu viele Textabschnitte.");
            return;
        }
        Translator translator = Translation.getClient(new TranslatorOptions.Builder()
            .setSourceLanguage(TranslateLanguage.ENGLISH)
            .setTargetLanguage(TranslateLanguage.GERMAN)
            .build());
        translator.downloadModelIfNeeded(new DownloadConditions.Builder().requireWifi().build())
            .onSuccessTask(ignored -> {
                List<Task<String>> translations = new ArrayList<>();
                for (int i = 0; i < texts.length(); i++) {
                    String text = texts.optString(i);
                    translations.add(text.trim().isEmpty() ? Tasks.forResult(text) : translator.translate(text));
                }
                return Tasks.whenAllSuccess(translations);
            })
            .addOnCompleteListener(task -> {
                translator.close();
                if (!task.isSuccessful()) {
                    call.reject("Das Übersetzungsmodell ist noch nicht verfügbar.", task.getException());
                    return;
                }
                JSObject result = new JSObject();
                result.put("texts", new JSArray(task.getResult()));
                call.resolve(result);
            });
    }
}
