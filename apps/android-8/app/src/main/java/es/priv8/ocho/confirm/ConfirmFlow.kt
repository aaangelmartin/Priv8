package es.priv8.ocho.confirm

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
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
 *
 * After each hello the core re-sends the pending confirm_request with the
 * same id (contracts v1.1). A request is the same only if session, id and
 * the hash of the whole request match ([ConfirmRequest.fingerprint]): ids
 * restart at c1 when the core restarts, so a reused id alone means nothing.
 *  - The same request on screen or queued is ignored.
 *  - The same request already answered gets the same approval_result again
 *    ([AnsweredCache]), so an answer lost while the bridge was down still
 *    arrives and the person is never asked twice.
 *  - A different request with a reused id is new: the stale one (from a
 *    previous core) is dropped without sending anything, since its id now
 *    belongs to the new request, and the person is asked.
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

    /** Answers already given, tied to the exact request. */
    private val answered = AnsweredCache(clock = SystemClock::elapsedRealtime)

    /** When each pending request arrived (elapsedRealtime), by fingerprint. */
    private val arrived = HashMap<String, Long>()

    /**
     * Every approval_result given on the phone (voice, ConfirmActivity's
     * buttons, the conversation's card, or expiry), so app 8's card follows it
     * even before the core echoes it on the events channel. Main thread.
     */
    var onResult: ((JSONObject) -> Unit)? = null

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

    /**
     * A new bridge connection, right after hello. The hello carries no core
     * instance id, so answers already delivered are forgotten (see
     * [AnsweredCache.onConnected]). Call it from the bridge thread before
     * handling that connection's messages: both go through the main looper
     * in order.
     */
    fun onConnected() {
        main.post {
            answered.onConnected()
            Log.i(TAG, "bridge connected: ${answered.size} answer(s) still owed to the core")
        }
    }

    /** From the bridge, any thread. */
    fun submit(request: ConfirmRequest) = main.post {
        answered.onSession(request.session)
        active?.let { a ->
            if (sameSlot(a, request)) {
                if (a.fingerprint == request.fingerprint) {
                    Log.w(TAG, "confirm ${request.id}: already on screen, ignored")
                    return@post
                }
                Log.w(TAG, "confirm ${request.id}: different request with the same id; the one on screen is stale, dropped")
                drop(a)
            }
        }
        if (queue.any { sameSlot(it, request) && it.fingerprint == request.fingerprint }) {
            Log.w(TAG, "confirm ${request.id}: already queued, ignored")
            return@post
        }
        if (queue.removeAll { sameSlot(it, request) }) {
            Log.w(TAG, "confirm ${request.id}: different request with the same id; the queued one is stale, dropped")
        }
        answered.lookup(request)?.let { result ->
            val sent = sender?.invoke(result) == true
            if (sent) answered.delivered(request)
            Log.i(TAG, "confirm ${request.id}: same request already answered, approval_result sent again${if (sent) "" else " (NOT SENT: bridge down)"}")
            return@post
        }
        arrived[request.fingerprint] = SystemClock.elapsedRealtime()
        queue.addLast(request)
        Log.i(TAG, "confirm ${request.id}: queued (kind=${request.kind}, expires_s=${request.expiresS}, segments=${request.segments.size})")
        if (active == null) next()
    }

    /** From the screen: the person answered [request], the one they saw. */
    fun answer(request: ConfirmRequest, ok: Boolean, via: String) = main.post {
        val a = active
        if (a == null || !sameSlot(a, request) || a.fingerprint != request.fingerprint) return@post
        val result = JSONObject().put("type", "approval_result").put("id", a.id)
            .put("ok", ok).put("via", via).put("by", "persona")
        if (!ok) result.put("reason", "cancelado")
        finish(a, result)
    }

    /**
     * From the conversation's card in app 8: answers the request on screen if
     * it is [session]/[id], the same way as ConfirmActivity's buttons (the
     * activity then closes). Main thread. False if it is not the active one.
     */
    fun answerFromChat(session: String, id: String, ok: Boolean): Boolean {
        val a = active ?: return false
        if (a.session != session || a.id != id) return false
        answer(a, ok, "pantalla")
        return true
    }

    fun attach(s: Screen) = main.post {
        screen = s
        active?.let(s::show) ?: s.close()
    }

    fun detach(s: Screen) = main.post { if (screen === s) screen = null }

    private fun sameSlot(a: ConfirmRequest, b: ConfirmRequest) = a.session == b.session && a.id == b.id

    private fun next() {
        val request = queue.removeFirstOrNull() ?: return
        active = request
        isActive = true
        val expire = Runnable {
            if (active !== request) return@Runnable
            Log.i(TAG, "confirm ${request.id}: no answer in ${request.expiresS} s")
            finish(
                request,
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

    /** Takes [request] off the screen without answering it (stale: its id belongs to a newer request). */
    private fun drop(request: ConfirmRequest) {
        timeout?.let(main::removeCallbacks)
        timeout = null
        active = null
        isActive = false
        arrived.remove(request.fingerprint)
    }

    private fun finish(request: ConfirmRequest, result: JSONObject) {
        timeout?.let(main::removeCallbacks)
        timeout = null
        active = null
        isActive = false
        val sent = sender?.invoke(result) == true
        val at = arrived.remove(request.fingerprint) ?: SystemClock.elapsedRealtime()
        answered.put(request, result, delivered = sent, receivedAt = at)
        onResult?.invoke(result)
        val reason = result.optString("reason").ifEmpty { "-" }
        Log.i(TAG, "approval_result ${request.id}: ok=${result.getBoolean("ok")} via=${result.getString("via")} reason=$reason${if (sent) "" else " (NOT SENT: bridge down)"}")
        if (queue.isEmpty()) screen?.close() else next()
    }
}
