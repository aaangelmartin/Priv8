package es.priv8.ocho

import android.accessibilityservice.AccessibilityService
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.drawable.Drawable
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowManager
import es.priv8.ocho.confirm.ConfirmFlow
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * 8's cursor on the phone (#135): whoever looks at the emulator sees 8 move, tap and type.
 *
 * A TYPE_ACCESSIBILITY_OVERLAY window from the accessibility service (no extra permission),
 * added once, not focusable and not touchable: taps and gestures go through it, it never
 * becomes the active window, and its view is hidden from accessibility, so it is never part
 * of the snapshot. It only draws: the 8 eyes gliding to the node, a ripple on tap and a cobalt
 * ring around the field being typed in. Hidden during every pause ([CursorMotion.visible]).
 *
 * Every public method can be called from any thread; drawing happens on the main thread.
 */
class CursorOverlay(private val service: AccessibilityService) {

    private val main = Handler(Looper.getMainLooper())
    private val density = service.resources.displayMetrics.density
    private var view: CursorView? = null
    @Volatile private var shown = true

    /** Adds the overlay window. Main thread (onServiceConnected). False if the system refuses it. */
    fun attach(): Boolean {
        if (view != null) return true
        val v = CursorView(service)
        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        )
        lp.title = "Priv8 cursor"
        return try {
            (service.getSystemService(Context.WINDOW_SERVICE) as WindowManager).addView(v, lp)
            view = v
            true
        } catch (e: RuntimeException) {
            Log.w(Priv8AccessibilityService.TAG, "cursor overlay not added: ${e.javaClass.simpleName}")
            false
        }
    }

    fun detach() {
        val v = view ?: return
        view = null
        main.post {
            try {
                (service.getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(v)
            } catch (_: RuntimeException) {
            }
        }
    }

    /** Shows or hides the cursor (pauses, confirmations, 8's own screens). */
    fun setVisible(visible: Boolean) {
        if (visible == shown) return
        shown = visible
        main.post { view?.setShown(visible) }
    }

    /**
     * Glides the cursor to the centre of [bounds] (screen pixels) and waits for it to arrive,
     * so the tap or the typing happens under the cursor. With [ring] it outlines the field.
     * Returns at once when the cursor is hidden or there is no overlay. Worker thread.
     */
    fun glideTo(bounds: Rect, ring: Boolean): Boolean {
        val v = view ?: return false
        if (!shown || bounds.isEmpty || ConfirmFlow.isActive) return false
        val x = bounds.exactCenterX()
        val y = bounds.exactCenterY()
        val arrived = CountDownLatch(1)
        main.post { v.glide(x, y, if (ring) RectF(bounds) else null) { arrived.countDown() } }
        arrived.await(CursorMotion.GLIDE_MAX_MS + 300, TimeUnit.MILLISECONDS)
        return true
    }

    fun ripple() {
        main.post { view?.ripple() }
    }

    fun clearRing() {
        main.post { view?.ring(null) }
    }

    /** Draws the cursor; screen coordinates are mapped to the view with its location on screen. */
    private inner class CursorView(context: Context) : View(context) {
        private val eyes: Drawable = context.getDrawable(R.drawable.cursor_8)!!.mutate()
        private val w = eyes.intrinsicWidth
        private val h = eyes.intrinsicHeight
        private var cx = Float.NaN
        private var cy = Float.NaN
        private var alphaNow = 0f
        private var press = 1f
        private var rippleT = -1f
        private var ringRect: RectF? = null
        private var glideAnim: ValueAnimator? = null
        private val hideLater = Runnable { fade(0f) }
        private val loc = IntArray(2)
        private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 2.5f * density
            color = COBALT
        }
        private val haloPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 6f * density
            color = Color.argb(46, 45, 69, 214)
        }
        private val rippleFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        private val rippleStroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 2f * density
        }

        init {
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            isFocusable = false
            isClickable = false
        }

        fun setShown(visible: Boolean) {
            if (!visible) {
                glideAnim?.cancel()
                ringRect = null
                rippleT = -1f
                removeCallbacks(hideLater)
                alphaNow = 0f
                invalidate()
            }
        }

        /** Starts the glide and calls [arrived] at the end. */
        fun glide(x: Float, y: Float, ring: RectF?, arrived: () -> Unit) {
            removeCallbacks(hideLater)
            glideAnim?.cancel()
            ringRect = null
            if (cx.isNaN()) { // first appearance: from the bottom centre, like a hand coming in
                cx = width / 2f
                cy = height * 0.85f
            }
            val fx = cx
            val fy = cy
            val ms = CursorMotion.glideMs(x - fx, y - fy, density)
            alphaNow = 1f
            glideAnim = ValueAnimator.ofFloat(0f, 1f).apply {
                duration = ms
                addUpdateListener {
                    val e = CursorMotion.ease(it.animatedValue as Float)
                    cx = fx + (x - fx) * e
                    cy = fy + (y - fy) * e
                    invalidate()
                }
                addListener(object : android.animation.AnimatorListenerAdapter() {
                    private var done = false
                    private fun finish() {
                        if (done) return
                        done = true
                        cx = x
                        cy = y
                        ringRect = ring
                        invalidate()
                        postDelayed(hideLater, IDLE_MS)
                        arrived()
                    }
                    override fun onAnimationEnd(a: android.animation.Animator) = finish()
                    override fun onAnimationCancel(a: android.animation.Animator) = finish()
                })
                start()
            }
        }

        fun ripple() {
            ValueAnimator.ofFloat(0f, 1f).apply {
                duration = CursorMotion.RIPPLE_MS
                addUpdateListener {
                    rippleT = it.animatedValue as Float
                    // A short press of the eyes at the start of the ripple.
                    press = 1f - 0.14f * kotlin.math.sin(Math.PI.toFloat() * minOf(1f, rippleT / 0.35f))
                    invalidate()
                }
                addListener(object : android.animation.AnimatorListenerAdapter() {
                    override fun onAnimationEnd(a: android.animation.Animator) {
                        rippleT = -1f
                        press = 1f
                        invalidate()
                    }
                })
                start()
            }
        }

        fun ring(r: RectF?) {
            ringRect = r
            invalidate()
        }

        private fun fade(to: Float) {
            ValueAnimator.ofFloat(alphaNow, to).apply {
                duration = 250
                addUpdateListener {
                    alphaNow = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
        }

        override fun onDraw(canvas: Canvas) {
            if (alphaNow <= 0f || cx.isNaN()) return
            getLocationOnScreen(loc)
            canvas.save()
            canvas.translate(-loc[0].toFloat(), -loc[1].toFloat())
            val a = (alphaNow * 255).toInt()
            ringRect?.let { r ->
                val pad = 3f * density
                val rr = RectF(r.left - pad, r.top - pad, r.right + pad, r.bottom + pad)
                haloPaint.alpha = (a * 0.18f).toInt()
                ringPaint.alpha = a
                canvas.drawRoundRect(rr, 8f * density, 8f * density, haloPaint)
                canvas.drawRoundRect(rr, 8f * density, 8f * density, ringPaint)
            }
            if (rippleT >= 0f) {
                val radius = (8f + 26f * rippleT) * density
                val fadeOut = 1f - rippleT
                rippleFill.color = Color.argb((36 * fadeOut).toInt(), 45, 69, 214)
                rippleStroke.color = Color.argb((255 * fadeOut).toInt(), 45, 69, 214)
                canvas.drawCircle(cx, cy, radius, rippleFill)
                canvas.drawCircle(cx, cy, radius, rippleStroke)
            }
            canvas.save()
            canvas.scale(press, press, cx, cy)
            eyes.setBounds((cx - w / 2f).toInt(), (cy - h / 2f).toInt(), (cx + w / 2f).toInt(), (cy + h / 2f).toInt())
            eyes.alpha = a
            eyes.draw(canvas)
            canvas.restore()
            canvas.restore()
        }
    }

    companion object {
        private const val COBALT = 0xFF2D45D6.toInt()
        /** With nothing to do for this long, the cursor fades out and leaves the screen to the person. */
        private const val IDLE_MS = 4_000L
    }
}
