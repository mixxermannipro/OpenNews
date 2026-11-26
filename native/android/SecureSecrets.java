package io.opennews.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.regex.Pattern;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureSecrets")
public class SecureSecrets extends Plugin {
    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "opennews_api_secrets_v1";
    private static final String PREF_NAME = "opennews-secure-secrets";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final Pattern SAFE_KEY = Pattern.compile("^[a-zA-Z0-9._-]{1,64}$");
    private static final Object LOCK = new Object();

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key", "");
        if (!SAFE_KEY.matcher(key).matches()) {
            call.reject("Ungültiger Schlüsselname.");
            return;
        }
        synchronized (LOCK) {
            JSObject result = new JSObject();
            result.put("value", readSecret(getContext(), key));
            call.resolve(result);
        }
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key", "");
        String value = call.getString("value", "");
        if (!SAFE_KEY.matcher(key).matches()) {
            call.reject("Ungültiger Schlüsselname.");
            return;
        }
        if (value.isEmpty()) {
            synchronized (LOCK) {
                prefs(getContext()).edit().remove(key).apply();
            }
            call.resolve();
            return;
        }
        synchronized (LOCK) {
            if (!writeSecret(getContext(), key, value)) {
                call.reject("Schlüssel konnte nicht im Android Keystore gespeichert werden.");
                return;
            }
            call.resolve();
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key", "");
        if (!SAFE_KEY.matcher(key).matches()) {
            call.reject("Ungültiger Schlüsselname.");
            return;
        }
        synchronized (LOCK) {
            prefs(getContext()).edit().remove(key).apply();
            call.resolve();
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    private static SecretKey getOrCreateKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE_PROVIDER);
        ks.load(null);
        KeyStore.Entry entry = ks.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER);
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build();
        generator.init(spec);
        return generator.generateKey();
    }

    private static boolean writeSecret(Context context, String key, String value) {
        try {
            SecretKey secretKey = getOrCreateKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);
            byte[] iv = cipher.getIV();
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            String encoded = Base64.encodeToString(iv, Base64.NO_WRAP)
                + ":"
                + Base64.encodeToString(encrypted, Base64.NO_WRAP);
            prefs(context).edit().putString(key, encoded).apply();
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String readSecret(Context context, String key) {
        String stored = prefs(context).getString(key, null);
        if (stored == null || !stored.contains(":")) return null;
        try {
            int sep = stored.indexOf(':');
            byte[] iv = Base64.decode(stored.substring(0, sep), Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(stored.substring(sep + 1), Base64.NO_WRAP);
            SecretKey secretKey = getOrCreateKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] plain = cipher.doFinal(encrypted);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return null;
        }
    }
}
