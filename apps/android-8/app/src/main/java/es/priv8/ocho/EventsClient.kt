package es.priv8.ocho

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONException
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Client of the core's event channel (docs/contracts/events.schema.json):
 * ws://127.0.0.1:8700/events through `adb reverse tcp:8700 tcp:8700`.
 *
 * It hands every message to [onEvent] on the main thread, except `screen`,
 * which carries the real screen for the console's split view and is dropped
 * here so it never reaches the app's UI or WebView. If the connection drops
 * it retries with exponential backoff from 1 to 4 s, like [BridgeClient], so the
 * eyes come back within seconds of the core starting.
 *
 * The app keeps it open while it is in the background, so the conversation
 * records what 8 does in the banks. [refresh] opens a second connection and
 * closes the first once the new one is up (make before break): the core's
 * bridge waits for a new subscriber when it brings the app to the front
 * before 8 speaks (adapters/android/bridge.py `say`), and no message is lost
 * in between.
 *
 * Messages are never logged, only their type.
 */
class EventsClient(
    private val url: String,
    /** Raw JSON text of one message (never `screen`). */
    private val onEvent: (type: String, json: String) -> Unit,
    /** true when connected, false when the connection is lost. */
    private val onConnection: (Boolean) -> Unit,
) {
    private val main = Handler(Looper.getMainLooper())
    private val http = OkHttpClient.Builder()
        .pingInterval(PING_S, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    @Volatile private var socket: WebSocket? = null
    @Volatile private var stopped = true
    private var latest: WebSocket? = null
    private var backoff = MIN_BACKOFF_MS

    fun start() {
        if (!stopped) return
        stopped = false
        main.post { connect() }
    }

    fun stop() {
        stopped = true
        main.removeCallbacksAndMessages(RECONNECT)
        socket?.close(1000, "stop")
        latest?.takeIf { it !== socket }?.cancel()
        socket = null
    }

    /**
     * A fresh connection, opened before the current one closes. Without a
     * connection it does nothing: the reconnect loop is already at work.
     */
    fun refresh() {
        if (stopped || socket == null) return
        main.post { if (!stopped && socket != null && latest === socket) connect() }
    }

    /** Sends a message to the core: `approval_result`, `task_request` or `dictation_start` (contract v1.2). */
    fun send(json: JSONObject): Boolean = socket?.send(json.toString()) ?: false

    private fun connect() {
        if (stopped) return
        Log.i(TAG, "events: connecting to $url")
        latest = http.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                main.post {
                    if (webSocket !== latest) return@post
                    val previous = socket
                    socket = webSocket
                    backoff = MIN_BACKOFF_MS
                    if (previous != null && previous !== webSocket) {
                        previous.close(1000, "refresh")
                        Log.i(TAG, "events: refreshed")
                    } else {
                        Log.i(TAG, "events: connected")
                    }
                    onConnection(true)
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val type = try {
                    JSONObject(text).optString("type")
                } catch (e: JSONException) {
                    Log.w(TAG, "events: message is not JSON, ignored")
                    return
                }
                if (type == "screen") return
                main.post { if (webSocket === socket) onEvent(type, text) }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = lost(webSocket, "closed ($code)")

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) =
                lost(webSocket, t.javaClass.simpleName)
        })
    }

    private fun lost(webSocket: WebSocket, why: String) {
        main.post {
            if (webSocket !== latest) return@post
            val open = socket
            if (open != null && open !== webSocket) {
                // A refresh that failed: the previous connection is still up.
                latest = open
                Log.i(TAG, "events: refresh failed: $why; kept the open connection")
                return@post
            }
            socket = null
            if (stopped) return@post
            onConnection(false) // also when it never connected: the eyes show "sin conexión"
            Log.i(TAG, "events: disconnected: $why; retry in $backoff ms")
            main.postAtTime({ connect() }, RECONNECT, SystemClock.uptimeMillis() + backoff)
            backoff = (backoff * 2).coerceAtMost(MAX_BACKOFF_MS)
        }
    }

    companion object {
        private const val TAG = "Priv8Ocho"
        private const val MIN_BACKOFF_MS = 1_000L
        private const val MAX_BACKOFF_MS = 4_000L // local port: cheap to retry, quick to come back
        private const val PING_S = 15L
        private val RECONNECT = Any()
    }
}
