package io.opennews.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

final class WidgetImageCache {
    private static final String CACHE_DIR = "widget-thumbs";
    private static final int MAX_FILES = 40;
    private static final int MAX_DIM_PX = 360;
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private static final int CONNECT_TIMEOUT_MS = 5000;
    private static final int READ_TIMEOUT_MS = 7000;
    private static final int MAX_REDIRECTS = 2;

    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean PREFETCH_RUNNING = new AtomicBoolean(false);

    private WidgetImageCache() {}

    private static File cacheDir(Context context) {
        File dir = new File(context.getApplicationContext().getCacheDir(), CACHE_DIR);
        if (!dir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }
        return dir;
    }

    private static String keyForUrl(String imageUrl) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(imageUrl.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(32);
            for (int i = 0; i < 16 && i < digest.length; i++) {
                sb.append(String.format(Locale.ROOT, "%02x", digest[i] & 0xff));
            }
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(imageUrl.hashCode());
        }
    }

    static File cachedFile(Context context, String imageUrl) {
        if (context == null || imageUrl == null || imageUrl.isEmpty()) return null;
        File file = new File(cacheDir(context), keyForUrl(imageUrl) + ".jpg");
        return (file.exists() && file.length() > 0) ? file : null;
    }

    static Bitmap loadCachedBitmap(Context context, String imageUrl) {
        File file = cachedFile(context, imageUrl);
        if (file == null) return null;
        try {
            //noinspection ResultOfMethodCallIgnored
            file.setLastModified(System.currentTimeMillis());
            return BitmapFactory.decodeFile(file.getAbsolutePath());
        } catch (Exception ignored) {
            return null;
        }
    }

    static File downloadThumbnailSync(Context context, String imageUrl) {
        if (context == null || !WidgetRefreshService.isSafeWebUrl(imageUrl)) return null;
        File existing = cachedFile(context, imageUrl);
        if (existing != null) return existing;

        byte[] raw = fetchImageBytes(imageUrl);
        if (raw == null || raw.length == 0) return null;

        Bitmap scaled = decodeScaledBitmap(raw);
        if (scaled == null) return null;

        File dir = cacheDir(context);
        File target = new File(dir, keyForUrl(imageUrl) + ".jpg");
        File tmp = new File(dir, keyForUrl(imageUrl) + ".tmp");
        try (FileOutputStream fos = new FileOutputStream(tmp)) {
            scaled.compress(Bitmap.CompressFormat.JPEG, 82, fos);
            fos.flush();
            if (tmp.renameTo(target)) {
                evictOldFiles(dir);
                return target;
            }
        } catch (Exception ignored) {
            // Best-effort thumbnail caching
        } finally {
            scaled.recycle();
            if (tmp.exists()) {
                //noinspection ResultOfMethodCallIgnored
                tmp.delete();
            }
        }
        return null;
    }

    static void prefetchAsync(Context context, JSONObject snapshot, Runnable onNewThumbnails) {
        if (context == null || snapshot == null) return;
        final Set<String> urls = new LinkedHashSet<>();
        for (String section : OpenNewsWidget.SECTIONS) {
            JSONArray arr = snapshot.optJSONArray(section);
            if (arr == null) continue;
            for (int i = 0; i < arr.length() && urls.size() < 12; i++) {
                JSONObject item = arr.optJSONObject(i);
                if (item == null) continue;
                String url = item.optString("imageUrl");
                if (!url.isEmpty() && cachedFile(context, url) == null && WidgetRefreshService.isSafeWebUrl(url)) {
                    urls.add(url);
                }
            }
        }
        if (urls.isEmpty()) return;
        if (!PREFETCH_RUNNING.compareAndSet(false, true)) return;

        final Context appContext = context.getApplicationContext();
        EXECUTOR.execute(() -> {
            boolean anyAdded = false;
            try {
                for (String url : urls) {
                    if (downloadThumbnailSync(appContext, url) != null) {
                        anyAdded = true;
                    }
                }
            } finally {
                PREFETCH_RUNNING.set(false);
            }
            if (anyAdded && onNewThumbnails != null) {
                MAIN_HANDLER.post(onNewThumbnails);
            }
        });
    }

    private static byte[] fetchImageBytes(String rawUrl) {
        String current = rawUrl;
        for (int hops = 0; hops <= MAX_REDIRECTS; hops++) {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(current);
                if (!WidgetRefreshService.isSafeWebUrl(current) || !WidgetRefreshService.isPublicHost(url.getHost())) {
                    return null;
                }
                conn = (HttpURLConnection) url.openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(READ_TIMEOUT_MS);
                conn.setRequestProperty("User-Agent", "OpenNews-Widget/1.0");
                conn.setRequestProperty("Accept", "image/webp,image/jpeg,image/png,image/*;q=0.8,*/*;q=0.1");

                int status = conn.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = conn.getHeaderField("Location");
                    if (location == null || location.isEmpty()) return null;
                    current = new URL(url, location).toString();
                    continue;
                }
                if (status < 200 || status >= 300) return null;
                String ctype = conn.getContentType();
                if (ctype != null && !ctype.toLowerCase(Locale.ROOT).startsWith("image/")) {
                    return null;
                }
                try (InputStream in = conn.getInputStream()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int read;
                    int total = 0;
                    while ((read = in.read(buf)) != -1) {
                        total += read;
                        if (total > MAX_BYTES) return null;
                        out.write(buf, 0, read);
                    }
                    return out.toByteArray();
                }
            } catch (Exception ignored) {
                return null;
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
        return null;
    }

    private static Bitmap decodeScaledBitmap(byte[] raw) {
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(raw, 0, raw.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

            int sample = 1;
            while ((bounds.outWidth / sample) > MAX_DIM_PX * 2 || (bounds.outHeight / sample) > MAX_DIM_PX * 2) {
                sample *= 2;
            }

            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = sample;
            Bitmap decoded = BitmapFactory.decodeByteArray(raw, 0, raw.length, opts);
            if (decoded == null) return null;

            int w = decoded.getWidth();
            int h = decoded.getHeight();
            if (w <= MAX_DIM_PX && h <= MAX_DIM_PX) {
                return decoded;
            }
            float scale = Math.min((float) MAX_DIM_PX / w, (float) MAX_DIM_PX / h);
            int targetW = Math.max(1, Math.round(w * scale));
            int targetH = Math.max(1, Math.round(h * scale));
            Bitmap scaled = Bitmap.createScaledBitmap(decoded, targetW, targetH, true);
            if (scaled != decoded) decoded.recycle();
            return scaled;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static void evictOldFiles(File dir) {
        File[] files = dir.listFiles();
        if (files == null || files.length <= MAX_FILES) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        int toDelete = files.length - MAX_FILES;
        for (int i = 0; i < toDelete; i++) {
            //noinspection ResultOfMethodCallIgnored
            files[i].delete();
        }
    }
}
