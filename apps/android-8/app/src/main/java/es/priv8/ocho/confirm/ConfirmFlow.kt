package es.priv8.ocho.confirm

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONObject

/**
 * Confirmation flow on the device (confirm.schema.json).
 *
 * The core sends a confirm_request; 8 shows it with [ConfirmActivity], says
 * it with the local voice and waits for «confirmo», «cancela» or a button.
 * Exactly one approval_result goes back per request:
 *  - ok true, via voz|pantalla, by persona;
 *  - ok false, reason cancelado, via voz|pantalla, by persona;
 *  - ok false, reason caducado, via sistema, by sistema, after expires_s.
 *
 * One request at a time, in arrival order. State lives on the main thread.
 * Results go through [sender] (the bridge); values are never logged.
 */
object ConfirmFlow {

    /** UI side of the flow: shows the active request and closes when it ends. */
    interface Screen {
        fun show(request: ConfirmRequest)
        fun close()
    }

    private const val TAG = "Priv8Confirm"
    private val main = Handler(Looper.getMainLooper())
    private val queue = ArrayDeque<ConfirmRequest>()
    private var app: Context? = null
    private var sender: ((JSONObject) -> Boolean)? = null
    private var screen: Screen? = null
    private var timeout: Runnable? = null

    /** The request on screen, or null. Main thread. */
    var active: ConfirmRequest? = null
        private set

    /** True while a confirmation is open. Safe from any thread. */
    @Volatile var isActive: Boolean = false
        private set

    fun init(context: Context, send: (JSONObject) -> Boolean) {
        main.post {
            app = context.applicationContext
            sender = send
        }
    }

    /** From the bridge, any thread. */
    fun submit(request: ConfirmRequest) = main.post {
        if (active?.id == request.id || queue.any { it.id == request.id }) {
            Log.w(TAG, "confirm ${request.id}: already pending, ignored")
            return@post
        }
        queue.addLast(request)
        Log.i(TAG, "confirm ${request.id}: queued (kind=${request.kind}, expires_s=${request.expiresS}, segments=${request.segments.size})")
        if (active == null) next()
    }

    /** From the screen: the person answered. */
    fun answer(id: String, ok: Boolean, via: String) = main.post {
        if (active?.id != id) return@post
        val result = JSONObject().put("type", "approval_result").put("id", id)
            .put("ok", ok).put("via", via).put("by", "persona")
        if (!ok) result.put("reason", "cancelado")
        finish(result)
    }

    fun attach(s: Screen) = main.post {
        screen = s
        active?.let(s::show) ?: s.close()
    }

    fun detach(s: Screen) = main.post { if (screen === s) screen = null }

    private fun next() {
        val request = queue.removeFirstOrNull() ?: return
        active = request
        isActive = true
        val expire = Runnable {
            if (active?.id != request.id) return@Runnable
            Log.i(TAG, "confirm ${request.id}: no answer in ${request.expiresS} s")
            finish(
                JSONObject().put("type", "approval_result").put("id", request.id)
                    .put("ok", false).put("via", "sistema").put("by", "sistema").put("reason", "caducado"),
            )
        }
        timeout = expire
        main.postDelayed(expire, request.expiresS * 1000L)
        val s = screen
        if (s != null) {
            s.show(request)
        } else {
            val ctx = app ?: return
            ctx.startActivity(
                Intent(ctx, ConfirmActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION),
            )
        }
    }

    private fun finish(result: JSONObject) {
        timeout?.let(main::removeCallbacks)
        timeout = null
        active = null
        isActive = false
        val sent = sender?.invoke(result) == true
        val reason = result.optString("reason").ifEmpty { "-" }
        Log.i(TAG, "approval_result ${result.getString("id")}: ok=${result.getBoolean("ok")} via=${result.getString("via")} reason=$reason${if (sent) "" else " (NOT SENT: bridge down)"}")
        if (queue.isEmpty()) screen?.close() else next()
    }
}
