package app.mixorder.discdjrobot;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Rect;

/**
 * Detects the DiscDJ "currently loaded" playlist row inside a bitmap crop
 * of the full playlist zone.
 *
 * DiscDJ highlights the loaded row with a saturated blue background. We
 * scan each row of the bitmap and count pixels whose HSV falls inside a
 * wide "DiscDJ blue" band (hue 200..232°, saturation ≥ 0.35, value in
 * [0.30, 0.92]). Rows with a blue-pixel ratio above BLUE_ROW_MIN_RATIO
 * are considered candidates. The longest contiguous run of candidate rows
 * wins — its bounding rectangle is returned.
 *
 * Returns null when no plausible blue row is found — the caller should
 * surface a "recalibrate the playlist zone" error to the user rather than
 * OCR-ing an arbitrary line.
 */
public final class PlaylistRowDetector {

    /** Fraction of pixels in a row that must look blue for it to count. */
    private static final float BLUE_ROW_MIN_RATIO = 0.25f;
    /** A candidate band shorter than this (in bitmap pixels) is ignored. */
    private static final int MIN_ROW_HEIGHT_PX = 12;
    /** A candidate band taller than this fraction of the zone is ignored (probably a background panel). */
    private static final float MAX_ROW_HEIGHT_FRAC = 0.6f;
    /** Small horizontal padding trimmed from left/right of the bitmap before scanning to skip scrollbars. */
    private static final float H_PAD_FRAC = 0.02f;

    public static class Result {
        /** Bounding rect of the active row IN BITMAP COORDINATES. Null when no row detected. */
        public final Rect rowRect;
        /** Ratio of blue pixels averaged over the winning band (0..1). */
        public final float blueRatio;

        public Result(Rect rowRect, float blueRatio) {
            this.rowRect = rowRect;
            this.blueRatio = blueRatio;
        }
    }

    private PlaylistRowDetector() { /* static only */ }

    public static Result findActiveRow(Bitmap zone) {
        if (zone == null) return new Result(null, 0f);
        int w = zone.getWidth();
        int h = zone.getHeight();
        if (w < 8 || h < 8) return new Result(null, 0f);

        int leftPad = Math.round(w * H_PAD_FRAC);
        int rightPad = w - leftPad;
        int scanW = Math.max(1, rightPad - leftPad);

        float[] ratios = new float[h];
        int[] row = new int[scanW];
        float[] hsv = new float[3];

        for (int y = 0; y < h; y++) {
            zone.getPixels(row, 0, scanW, leftPad, y, scanW, 1);
            int blue = 0;
            for (int i = 0; i < scanW; i++) {
                int c = row[i];
                if (isDiscDJBlue(c, hsv)) blue++;
            }
            ratios[y] = blue / (float) scanW;
        }

        int bestStart = -1, bestEnd = -1;
        float bestScore = 0f;
        int runStart = -1;
        float runScore = 0f;
        int runLen = 0;
        int maxRunLen = Math.round(h * MAX_ROW_HEIGHT_FRAC);

        for (int y = 0; y < h; y++) {
            if (ratios[y] >= BLUE_ROW_MIN_RATIO) {
                if (runStart < 0) { runStart = y; runScore = 0f; runLen = 0; }
                runScore += ratios[y];
                runLen++;
            } else {
                if (runStart >= 0) {
                    tryPromote(runStart, y - 1, runLen, runScore, maxRunLen);
                    if (runLen >= MIN_ROW_HEIGHT_PX && runLen <= maxRunLen && runScore > bestScore) {
                        bestScore = runScore;
                        bestStart = runStart;
                        bestEnd = y - 1;
                    }
                    runStart = -1;
                }
            }
        }
        if (runStart >= 0 && runLen >= MIN_ROW_HEIGHT_PX && runLen <= maxRunLen && runScore > bestScore) {
            bestScore = runScore;
            bestStart = runStart;
            bestEnd = h - 1;
        }

        if (bestStart < 0) return new Result(null, 0f);
        int len = bestEnd - bestStart + 1;
        float avgRatio = bestScore / Math.max(1, len);
        // Slight vertical padding to catch descenders / anti-aliasing.
        int top = Math.max(0, bestStart - 2);
        int bot = Math.min(h, bestEnd + 3);
        return new Result(new Rect(0, top, w, bot), avgRatio);
    }

    /** Placeholder for future scoring tweaks. */
    private static void tryPromote(int start, int end, int len, float score, int maxRunLen) { /* no-op */ }

    /**
     * Wide-tolerance test for the DiscDJ selected-row blue. Accepts
     * saturated blue-ish hues at mid-to-low brightness so it survives
     * skin variations and screen filters.
     */
    private static boolean isDiscDJBlue(int color, float[] hsvOut) {
        int a = (color >>> 24) & 0xFF;
        if (a < 128) return false;
        Color.colorToHSV(color, hsvOut);
        float h = hsvOut[0]; // 0..360
        float s = hsvOut[1]; // 0..1
        float v = hsvOut[2]; // 0..1
        if (s < 0.35f) return false;
        if (v < 0.30f || v > 0.92f) return false;
        return h >= 200f && h <= 232f;
    }
}
