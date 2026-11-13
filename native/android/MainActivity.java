package io.opennews.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle state) {
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
}
