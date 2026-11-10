package es.priv8.ocho

import android.os.Handler
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * WebSocket client to the core on the laptop (docs/contracts/bridge.schema.json).
 *
 * The device connects as the client to [url] (ws://127.0.0.1:8765 through
 * `adb reverse tcp:8765 tcp:8765`), sends `hello` and then answers requests.
 * If the connection drops or cannot be opened it retries with exponential
 * backoff, from [MIN_BACKOFF_MS] to [MAX_BACKOFF_MS].
 *
 * Messages carry real values, so they are never logged: only types, ids and
 * error codes.
 */
class BridgeClient(
    private val url: String,
    private val device: String,
    /** Thread where messages are handled; it may block (settle, gestures). */
    private val worker: Handler,
    private val onMessage: (JSONObject) -> Unit,
) {
    private val http = OkHttpClient.Builder()
        .pingInterval(PING_S, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    @Volatile private var socket: WebSocket? = null
    @Volatile private var stopped = false
    /** The last socket opened; events from older ones are ignored. */
    private var latest: WebSocket? = null
    private var backoff = MIN_BACKOFF_MS
    private var attempt = 0

    val connected: Boolean get() = socket != null

    fun start() {
        stopped = false
        worker.post { connect() }
    }

    fun stop() {
        stopped = true
        worker.removeCallbacksAndMessages(RECONNECT)
        socket?.close(1000, "stop")
        socket = null
        http.dispatcher.executorService.shutdown()
    }

    /** Sends a message if connected. Returns false when it was dropped. */
    fun send(msg: JSONObject): Boolean {
        val ws = socket ?: return false
        return ws.send(msg.toString())
    }

    private fun connect() {
        if (stopped) return
        attempt++
        val myAttempt = attempt
        Log.i(TAG, "bridge: connecting to $url (attempt $myAttempt)")
        latest = http.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                worker.post {
                    if (webSocket !== latest) return@post
                    socket = webSocket
                    backoff = MIN_BACKOFF_MS
                    Log.i(TAG, "bridge: connected")
                    webSocket.send(
                        JSONObject().put("type", "hello").put("device", device).put("version", VERSION).toString(),
                    )
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val msg = try {
                    JSONObject(text)
                } catch (e: org.json.JSONException) {
                    Log.w(TAG, "bridge: message is not JSON, ignored")
                    return
                }
                worker.post { onMessage(msg) }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                lost(webSocket, "closed ($code)")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                lost(webSocket, t.javaClass.simpleName)
            }
        })
    }

    private fun lost(webSocket: WebSocket, why: String) {
        worker.post {
            if (webSocket !== latest) return@post
            socket = null
            if (stopped) return@post
            Log.i(TAG, "bridge: disconnected: $why; retry in ${backoff} ms")
            worker.postAtTime({ connect() }, RECONNECT, android.os.SystemClock.uptimeMillis() + backoff)
            backoff = (backoff * 2).coerceAtMost(MAX_BACKOFF_MS)
        }
    }

    companion object {
        private const val TAG = Priv8AccessibilityService.TAG
        const val VERSION = 1
        private const val MIN_BACKOFF_MS = 1_000L
        private const val MAX_BACKOFF_MS = 30_000L
        private const val PING_S = 15L
        private val RECONNECT = Any()
    }
}
