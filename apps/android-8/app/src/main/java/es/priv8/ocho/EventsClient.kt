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
 * it retries with exponential backoff from 1 to 30 s, like [BridgeClient].
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
        socket = null
    }

    /** Sends a message to the core (only `approval_result` is allowed by the contract). */
    fun send(json: JSONObject): Boolean = socket?.send(json.toString()) ?: false

    private fun connect() {
        if (stopped) return
        Log.i(TAG, "events: connecting to $url")
        latest = http.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                main.post {
                    if (webSocket !== latest) return@post
                    socket = webSocket
                    backoff = MIN_BACKOFF_MS
                    Log.i(TAG, "events: connected")
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
                main.post { if (webSocket === latest) onEvent(type, text) }
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
        private const val MAX_BACKOFF_MS = 30_000L
        private const val PING_S = 15L
        private val RECONNECT = Any()
    }
}
