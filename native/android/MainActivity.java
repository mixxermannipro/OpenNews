package io.opennews.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle state) {
        registerPlugin(ArticleShare.class);
        registerPlugin(LocalTranslation.class);
        registerPlugin(LocalSummary.class);
        registerPlugin(NewsPush.class);
        registerPlugin(NewsWidget.class);
        registerPlugin(BriefingSpeech.class);
        super.onCreate(state);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView view = getBridge() == null ? null : getBridge().getWebView();
                if (view == null) {
                    fallBack();
                    return;
                }
                view.evaluateJavascript(
                    "Boolean(window.history.state?.openNews) && (window.history.back(), true)",
                    handled -> {
                        if (!"true".equals(handled)) fallBack();
                    }
                );
            }

            private void fallBack() {
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    @CapacitorPlugin(name = "ArticleShare")
    public static class ArticleShare extends Plugin {
        @PluginMethod
        public void share(PluginCall call) {
            String title = call.getString("title", "");
            String url = call.getString("url", "");
            if (url.isEmpty()) {
                call.reject("Artikel-Link fehlt");
                return;
            }
            getActivity().runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND)
                    .setType("text/plain")
                    .putExtra(Intent.EXTRA_SUBJECT, title)
                    .putExtra(Intent.EXTRA_TEXT, url);
                try {
                    getActivity().startActivity(Intent.createChooser(send, null));
                    call.resolve();
                } catch (RuntimeException error) {
                    call.reject("Teilen gerade nicht möglich", error);
                }
            });
        }
    }
}
