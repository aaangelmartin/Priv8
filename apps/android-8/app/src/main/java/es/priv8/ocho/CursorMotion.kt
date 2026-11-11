package es.priv8.ocho

import kotlin.math.hypot
import kotlin.math.roundToLong

/**
 * Timing and visibility rules of 8's cursor on the phone (#135), without Android types so
 * they can be unit tested. [CursorOverlay] draws it.
 */
object CursorMotion {
    const val GLIDE_MIN_MS = 350L
    const val GLIDE_MAX_MS = 500L
    const val RIPPLE_MS = 520L
    /** Typing in steps: at most [TYPE_STEPS] partial texts, [TYPE_STEP_MS] apart. */
    const val TYPE_STEPS = 10
    const val TYPE_STEP_MS = 25L

    /** Glide time for a move of (dx, dy) pixels: 350 ms plus a little per dp, up to 500 ms. */
    fun glideMs(dx: Float, dy: Float, density: Float): Long {
        val dp = hypot(dx, dy) / density.coerceAtLeast(0.5f)
        return (GLIDE_MIN_MS + dp / 3f).roundToLong().coerceIn(GLIDE_MIN_MS, GLIDE_MAX_MS)
    }

    /** Ease in-out (cubic), the same feel as the web cursor's cubic-bezier(.45,0,.2,1). */
    fun ease(t: Float): Float {
        val x = t.coerceIn(0f, 1f)
        return if (x < 0.5f) 4f * x * x * x else 1f - (-2f * x + 2f).let { it * it * it } / 2f
    }

    /**
     * The cursor only shows while 8 works on another app's screen: never during a pause
     * (the person types a PIN or OTP, puts a finger, a system dialog), never on 8's own
     * screens or while a confirmation is open, so it can never sit over Confirmar.
     */
    fun visible(pauseReason: String?, confirming: Boolean): Boolean = pauseReason == null && !confirming

    /** The partial texts typed before the full one, so letters visibly appear. */
    fun typingSteps(text: String): List<String> {
        if (text.length <= 1) return emptyList()
        val steps = minOf(TYPE_STEPS, text.length - 1)
        return (1..steps).map { i -> text.substring(0, (text.length * i) / (steps + 1)) }
            .filter { it.isNotEmpty() }
            .distinct()
    }
}
