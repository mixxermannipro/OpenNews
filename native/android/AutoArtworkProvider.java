package io.opennews.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.List;

public final class AutoArtworkProvider extends ContentProvider {
    private static final int SIZE_PX = 256;

    static Uri stationUri(String packageName, String stationId) {
        return Uri.parse("content://" + packageName + ".autoartwork/radio/" + stationId);
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Nullable
    @Override
    public ParcelFileDescriptor openFile(@NonNull Uri uri, @NonNull String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) {
            throw new FileNotFoundException("Read-only artwork provider");
        }
        Context context = getContext();
        if (context == null) throw new FileNotFoundException("Context unavailable");
        List<String> segments = uri.getPathSegments();
        if (segments.size() != 2 || !"radio".equals(segments.get(0))) {
            throw new FileNotFoundException("Unknown artwork path");
        }
        String stationId = segments.get(1);
        AutoAudioCatalog.RadioSpec spec = AutoAudioCatalog.findRadio(stationId);
        if (spec == null) {
            throw new FileNotFoundException("Unknown station");
        }

        File artDir = new File(context.getCacheDir(), "auto-art");
        if (!artDir.exists()) artDir.mkdirs();
        File target = new File(artDir, spec.id + ".png");
        if (!target.exists() || target.length() < 64) {
            renderStationBadge(spec, target);
        }
        if (!target.exists()) {
            throw new FileNotFoundException("Could not generate artwork");
        }
        return ParcelFileDescriptor.open(target, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    private static synchronized void renderStationBadge(AutoAudioCatalog.RadioSpec spec, File outFile) {
        if (outFile.exists() && outFile.length() >= 64) return;
        Bitmap bitmap = Bitmap.createBitmap(SIZE_PX, SIZE_PX, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        int baseColor = parseSafeColor(spec.accentColor);
        int darkColor = blendDark(baseColor, 0.34f);

        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setShader(new LinearGradient(0f, 0f, SIZE_PX, SIZE_PX, baseColor, darkColor, Shader.TileMode.CLAMP));
        canvas.drawRoundRect(new RectF(0, 0, SIZE_PX, SIZE_PX), 36f, 36f, bgPaint);

        // Region pill top-left
        Paint pillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        pillPaint.setColor(0x38FFFFFF);
        canvas.drawRoundRect(new RectF(22f, 22f, 84f, 54f), 14f, 14f, pillPaint);

        Paint regionPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        regionPaint.setColor(Color.WHITE);
        regionPaint.setTextSize(20f);
        regionPaint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        regionPaint.setTextAlign(Paint.Align.CENTER);
        canvas.drawText(spec.region, 53f, 45f, regionPaint);

        // Center station shortCode
        Paint codePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        codePaint.setColor(Color.WHITE);
        codePaint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        codePaint.setTextAlign(Paint.Align.CENTER);
        codePaint.setTextSize(spec.shortCode.length() >= 4 ? 64f : 78f);
        Paint.FontMetrics fm = codePaint.getFontMetrics();
        float centerY = (SIZE_PX / 2f) - (fm.ascent + fm.descent) / 2f - 6f;
        canvas.drawText(spec.shortCode, SIZE_PX / 2f, centerY, codePaint);

        // LIVE pill bottom-center
        Paint liveBg = new Paint(Paint.ANTI_ALIAS_FLAG);
        liveBg.setColor(0xFFDC2626);
        canvas.drawRoundRect(new RectF(78f, SIZE_PX - 54f, SIZE_PX - 78f, SIZE_PX - 22f), 16f, 16f, liveBg);

        Paint liveText = new Paint(Paint.ANTI_ALIAS_FLAG);
        liveText.setColor(Color.WHITE);
        liveText.setTextSize(18f);
        liveText.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        liveText.setTextAlign(Paint.Align.CENTER);
        canvas.drawText("LIVE", SIZE_PX / 2f, SIZE_PX - 31f, liveText);

        File tmp = new File(outFile.getParentFile(), outFile.getName() + ".tmp");
        try (FileOutputStream fos = new FileOutputStream(tmp)) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 95, fos);
            fos.flush();
            if (tmp.renameTo(outFile) && outFile.exists()) return;
        } catch (IOException ignored) {
            if (tmp.exists()) tmp.delete();
        } finally {
            bitmap.recycle();
        }
    }

    private static int parseSafeColor(String hex) {
        try {
            return Color.parseColor(hex);
        } catch (Exception ignored) {
            return 0xFF1D4ED8;
        }
    }

    private static int blendDark(int color, float amount) {
        int r = Math.round(Color.red(color) * (1f - amount));
        int g = Math.round(Color.green(color) * (1f - amount));
        int b = Math.round(Color.blue(color) * (1f - amount));
        return Color.rgb(Math.max(0, r), Math.max(0, g), Math.max(0, b));
    }

    @Nullable
    @Override
    public String getType(@NonNull Uri uri) {
        return "image/png";
    }

    @Nullable
    @Override
    public Cursor query(@NonNull Uri uri, @Nullable String[] p, @Nullable String s, @Nullable String[] sa, @Nullable String so) {
        return null;
    }

    @Nullable
    @Override
    public Uri insert(@NonNull Uri uri, @Nullable ContentValues values) {
        return null;
    }

    @Override
    public int delete(@NonNull Uri uri, @Nullable String s, @Nullable String[] sa) {
        return 0;
    }

    @Override
    public int update(@NonNull Uri uri, @Nullable ContentValues v, @Nullable String s, @Nullable String[] sa) {
        return 0;
    }
}
