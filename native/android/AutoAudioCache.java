package io.opennews.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

final class AutoAudioCache {
    private static final String DIR_NAME = "auto-audio";
    private static final long MAX_CACHE_BYTES = 50L * 1024L * 1024L;
    private static final long MAX_SINGLE_FILE_BYTES = 12L * 1024L * 1024L;
    private static final int MAX_PREBUFFER_EPISODES = 4;
    private static final int CONNECT_TIMEOUT_MS = 7000;
    private static final int READ_TIMEOUT_MS = 15000;
    private static final int MAX_REDIRECTS = 3;

    private AutoAudioCache() {}

    static boolean isOnUnmeteredNetwork(Context context) {
        ConnectivityManager cm = context.getSystemService(ConnectivityManager.class);
        if (cm == null) return false;
        Network active = cm.getActiveNetwork();
        if (active == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(active);
        return caps != null
            && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);
    }

    static File getCachedFile(Context context, String audioUrl) {
        if (context == null || audioUrl == null || !audioUrl.startsWith("https://")) return null;
        File dir = new File(context.getCacheDir(), DIR_NAME);
        File file = new File(dir, hashUrl(audioUrl) + ".audio");
        if (file.isFile() && file.length() > 1024L) {
            return file;
        }
        return null;
    }

    static int getCachedCount(Context context) {
        File dir = new File(context.getCacheDir(), DIR_NAME);
        File[] files = dir.listFiles((d, name) -> name.endsWith(".audio"));
        return files != null ? files.length : 0;
    }

    static synchronized void prebufferTopUpdates(Context context, List<AutoAudioStore.EpisodeEntry> episodes) {
        if (context == null || episodes == null || episodes.isEmpty()) return;
        if (!isOnUnmeteredNetwork(context)) return;

        File dir = new File(context.getCacheDir(), DIR_NAME);
        if (!dir.exists()) dir.mkdirs();

        int count = 0;
        for (AutoAudioStore.EpisodeEntry ep : episodes) {
            if (count >= MAX_PREBUFFER_EPISODES) break;
            if (ep == null || !ep.audioUrl.startsWith("https://")) continue;
            count++;
            File target = new File(dir, hashUrl(ep.audioUrl) + ".audio");
            if (target.isFile() && target.length() > 1024L) {
                target.setLastModified(System.currentTimeMillis());
                continue;
            }
            if (!isOnUnmeteredNetwork(context)) break;
            downloadHttpsToFile(ep.audioUrl, target);
        }
        evictIfNeeded(dir);
    }

    private static void downloadHttpsToFile(String rawUrl, File target) {
        String current = rawUrl;
        File tmp = new File(target.getParentFile(), target.getName() + ".tmp");
        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
            if (current == null || !current.startsWith("https://")) return;
            HttpURLConnection conn = null;
            try {
                URL url = new URL(current);
                if (!AutoFeedFetcher.isPublicHost(url.getHost())) return;
                conn = (HttpURLConnection) url.openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(READ_TIMEOUT_MS);
                conn.setRequestProperty("User-Agent", "OpenNews-AndroidAuto/1.0");
                int code = conn.getResponseCode();
                if (code >= 300 && code < 400) {
                    String location = conn.getHeaderField("Location");
                    if (location == null || location.isEmpty()) return;
                    current = new URL(url, location).toString();
                    continue;
                }
                if (code < 200 || code >= 300) return;

                long contentLength = conn.getContentLengthLong();
                if (contentLength > MAX_SINGLE_FILE_BYTES) return;

                try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[16384];
                    long total = 0L;
                    int read;
                    while ((read = in.read(buf)) != -1) {
                        total += read;
                        if (total > MAX_SINGLE_FILE_BYTES) {
                            tmp.delete();
                            return;
                        }
                        out.write(buf, 0, read);
                    }
                    out.flush();
                }
                if (tmp.length() > 1024L) {
                    if (!tmp.renameTo(target) && tmp.exists()) {
                        tmp.delete();
                    }
                } else if (tmp.exists()) {
                    tmp.delete();
                }
                return;
            } catch (Exception ignored) {
                if (tmp.exists()) tmp.delete();
                return;
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
    }

    private static void evictIfNeeded(File dir) {
        File[] files = dir.listFiles((d, name) -> name.endsWith(".audio"));
        if (files == null || files.length == 0) return;
        long total = 0L;
        for (File f : files) total += f.length();
        if (total <= MAX_CACHE_BYTES) return;

        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        for (File f : files) {
            if (total <= MAX_CACHE_BYTES) break;
            long len = f.length();
            if (f.delete()) {
                total -= len;
            }
        }
    }

    private static String hashUrl(String url) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(url.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 16 && i < digest.length; i++) {
                sb.append(String.format("%02x", digest[i]));
            }
            return sb.toString();
        } catch (Exception ignored) {
            return Integer.toHexString(url.hashCode());
        }
    }
}
