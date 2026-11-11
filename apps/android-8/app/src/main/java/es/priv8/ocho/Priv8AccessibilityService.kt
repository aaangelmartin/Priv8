package es.priv8.ocho

import android.accessibilityservice.AccessibilityService
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject
import es.priv8.ocho.confirm.ConfirmFlow
import es.priv8.ocho.confirm.ConfirmRequest
import es.priv8.ocho.confirm.LocalValues
import es.priv8.ocho.voz.VozMixta

/**
 * 8's Android adapter: reads the active window as a raw snapshot, runs
 * performs on it and talks to the core over the bridge
 * (docs/contracts/bridge.schema.json).
 *
 * Logcat (tag [TAG]) only gets message types, element ids, counts and error
 * codes, never screen content or the values the core sends. A raw dump of
 * the node tree exists for debugging but is off unless the APK is built with
 * `-Ppriv8.a11yDump=true`.
 */
class Priv8AccessibilityService : AccessibilityService() {

    private lateinit var worker: Handler
    private lateinit var workerThread: HandlerThread
    private val main = Handler(Looper.getMainLooper())
    private lateinit var bridge: BridgeClient
    private lateinit var performer: Performer
    private val builder = SnapshotBuilder()

    // Touched from the main thread (events) and read from the worker.
    @Volatile private var lastChangeAt = 0L
    @Volatile private var lastWindowPackage: String? = null
    @Volatile private var lastPerformAt = 0L

    // Worker thread only.
    private var seq = 0
    private var lastNodes: Map<String, AccessibilityNodeInfo> = emptyMap()
    private var reportedApp: String? = null
    private var reportedScreen: String? = null
    /** Current pause, as last reported to the core with events. */
    private var pause: Pause? = null
    /** Plays the core's `voice` messages (8's answers) and sends voice.done. */
    private var voz: VozMixta? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        workerThread = HandlerThread("priv8-bridge").also { it.start() }
        worker = Handler(workerThread.looper)
        performer = Performer(this, { id -> lastNodes[id] }, ::firstScrollable)
        bridge = BridgeClient(BuildConfig.BRIDGE_URL, deviceName(), worker, ::onBridgeMessage, ConfirmFlow::onConnected)
        bridge.start()
        ConfirmFlow.init(this) { bridge.send(it) }
        voz = VozMixta(this) { bridge.send(it) }
        Log.i(TAG, "service connected")
    }

    override fun onDestroy() {
        voz?.close()
        voz = null
        if (::bridge.isInitialized) bridge.stop()
        if (::workerThread.isInitialized) workerThread.quitSafely()
        super.onDestroy()
    }

    override fun onInterrupt() {
        Log.i(TAG, "interrupt")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                lastChangeAt = SystemClock.uptimeMillis()
                // The keyboard and the status bar also raise this event, but
                // never become the active window: do not wait for them.
                event.packageName?.toString()
                    ?.takeIf { it != imePackage() && it != SYSTEM_UI }
                    ?.let { lastWindowPackage = it }
                // Report screen and app changes once the window has settled.
                main.removeCallbacks(settledCheck)
                main.postDelayed(settledCheck, SETTLE_MS)
            }
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_WINDOWS_CHANGED -> {
                lastChangeAt = SystemClock.uptimeMillis()
            }
            AccessibilityEvent.TYPE_VIEW_FOCUSED -> {
                // Pause as soon as a rojo field takes the focus, before the
                // first key; and resume as soon as it leaves.
                worker.post { checkPause() }
            }
        }
        if (BuildConfig.A11Y_DUMP && event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            rootInActiveWindow?.let { debugDump(it) }
        }
    }

    private val settledCheck = Runnable { worker.post { reportChanges() } }

    // ---- bridge ---------------------------------------------------------

    private fun onBridgeMessage(msg: JSONObject) {
        val type = msg.optString("type")
        val id = msg.optString("id")
        when (type) {
            "snapshot.request" -> {
                val raw = snapshot()
                bridge.send(JSONObject().put("type", "snapshot").put("id", id).put("raw", raw))
                val paused = pause?.let { " paused=${it.reason}" } ?: ""
                Log.i(TAG, "snapshot $id: seq=${raw.getInt("seq")} app=${raw.getString("app")} elements=${raw.getJSONArray("elements").length()}$paused")
            }
            "perform" -> {
                val op = msg.optString("op")
                val target = msg.optString("target").ifEmpty { null }
                val text = if (msg.has("text")) msg.getString("text") else null
                val direction = msg.optString("direction").ifEmpty { null }
                // While the person authenticates, a system dialog is open or
                // 8 is asking for a confirmation, the agent does not touch
                // the screen: nothing it could tap there is its business.
                val held = rootInActiveWindow?.let(::currentPause)
                val outcome = if (held != null) Performer.NOT_ALLOWED else performWithTimeout(op, target, text, direction)
                lastPerformAt = SystemClock.uptimeMillis()
                val result = JSONObject().put("type", "result").put("id", id)
                when (outcome) {
                    is Performer.Outcome.Ok -> result.put("ok", true)
                    is Performer.Outcome.Error -> result.put("ok", false).put("error", outcome.code)
                }
                bridge.send(result)
                // Never log `text`: it is the rehydrated real value.
                val why = held?.let { " (paused: ${it.reason})" } ?: ""
                Log.i(TAG, "perform $id: op=$op target=${target ?: "-"} -> ${if (outcome is Performer.Outcome.Error) outcome.code else "ok"}$why")
            }
            "confirm_request" -> {
                // confirm.schema.json#/$defs/request over the bridge (contracts
                // v1.1). Values are rendered on the device.
                val request = ConfirmRequest.parse(msg)
                if (request == null) Log.w(TAG, "confirm_request: does not follow confirm.schema.json, ignored")
                else ConfirmFlow.submit(request)
            }
            "render_values" -> {
                // Token -> value table for a session (bridge.schema.json v1.1),
                // so the device can render a summary. Never logged.
                val session = msg.optString("session")
                val values = msg.optJSONObject("values")
                if (session.isEmpty() || values == null) {
                    Log.w(TAG, "render_values: missing session or values, ignored")
                } else {
                    LocalValues.put(session, values.keys().asSequence().associateWith { values.getString(it) })
                    Log.i(TAG, "render_values: session=$session tokens=${values.length()}")
                }
            }
            "voice" -> {
                // What 8 says (bridge.schema.json v1.1): the core sent render_values just before.
                if (voz?.play(msg) != true) Log.w(TAG, "voice: does not follow voice.schema.json, ignored")
            }
            else -> Log.w(TAG, "bridge: unexpected message type '$type', ignored")
        }
    }

    private fun performWithTimeout(op: String, target: String?, text: String?, direction: String?): Performer.Outcome {
        // Accessibility calls are IPC and can hang on a frozen app; bound them.
        var outcome: Performer.Outcome = Performer.TIMEOUT
        val t = Thread {
            outcome = try {
                performer.perform(op, target, text, direction)
            } catch (e: RuntimeException) {
                Log.w(TAG, "perform failed: ${e.javaClass.simpleName}")
                Performer.OTHER
            }
        }
        t.start()
        t.join(PERFORM_TIMEOUT_MS)
        return if (t.isAlive) Performer.TIMEOUT else outcome
    }

    private fun sendEvent(kind: String, app: String?, detail: String?) {
        val ev = JSONObject().put("type", "event").put("kind", kind)
        app?.let { ev.put("app", it) }
        detail?.let { ev.put("detail", it) }
        if (bridge.send(ev)) Log.i(TAG, "event $kind")
    }

    // ---- snapshot -------------------------------------------------------

    /**
     * Waits for the window to settle, then reads it: no window or content
     * change for [SETTLE_MS]. Right after a perform the screen has not reacted
     * yet, so it waits up to [REACT_MAX_MS] for a first change; and right
     * after TYPE_WINDOW_STATE_CHANGED the active window can still be the
     * previous one, so it also waits for its package to match that event.
     * Gives up after [SETTLE_MAX_MS] and reads whatever is there.
     */
    private fun settledRoot(): AccessibilityNodeInfo? {
        val start = SystemClock.uptimeMillis()
        val deadline = start + SETTLE_MAX_MS
        while (true) {
            val now = SystemClock.uptimeMillis()
            val performAt = lastPerformAt
            val changeAt = lastChangeAt
            val reacting = performAt > 0 && changeAt < performAt && now - performAt < REACT_MAX_MS
            val quiet = !reacting && now - maxOf(changeAt, performAt) >= SETTLE_MS
            val root = if (quiet) rootInActiveWindow else null
            val matches = root != null &&
                (lastWindowPackage == null || root.packageName?.toString() == lastWindowPackage)
            if (matches || now >= deadline) return root ?: rootInActiveWindow
            Thread.sleep(POLL_MS)
        }
    }

    private fun snapshot(): JSONObject {
        val root = settledRoot()
        seq++
        if (root == null) {
            lastNodes = emptyMap()
            updatePause(Pause.HIDDEN, null)
            return Pause.HIDDEN.snapshot(null, seq)
        }
        val paused = currentPause(root)
        updatePause(paused, root.packageName?.toString())
        if (paused != null) {
            // Nothing from this window goes out: only what the core needs to
            // know that the agent must wait.
            lastNodes = emptyMap()
            return paused.snapshot(root, seq)
        }
        val built = builder.build(root, seq, null)
        lastNodes = built.nodes
        return built.raw
    }

    // ---- pause («mira a otro lado») ---------------------------------------

    /**
     * Why the agent must wait on this window, or null. A system dialog
     * (biometric prompt, permission) first; then 8's own confirmation screen,
     * which shows real values; then a rojo field with the input focus.
     */
    private fun currentPause(root: AccessibilityNodeInfo): Pause? {
        systemDialog(root)?.let { return Pause.dialog(it) }
        if (root.packageName?.toString() == packageName) return if (ConfirmFlow.isActive) Pause.CONFIRMATION else Pause.OWN_APP
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return null
        val kind = RojoField.kind(focused) ?: return null
        return Pause.authentication(kind)
    }

    /** Re-reads the active window and reports a change of pause. Worker thread. */
    private fun checkPause() {
        val root = rootInActiveWindow ?: return
        updatePause(currentPause(root), root.packageName?.toString())
    }

    /**
     * Reports pause changes with the bridge events of the contract:
     * focus_password (detail clave|otp) when a rojo field takes the focus and
     * focus_left when it loses it; system_dialog (detail
     * biometria|permiso|oculta) and system_dialog_closed (contracts v1.1). The core turns them
     * into observe paused and the app 8 into «mirar a otro lado».
     */
    private fun updatePause(next: Pause?, app: String?) {
        val prev = pause
        if (next == prev) return
        pause = next
        if (prev?.reason == Pause.AUTH && next != prev) sendEvent("focus_left", app, null)
        if (prev?.reason == Pause.DIALOG && next != prev) sendEvent("system_dialog_closed", app, null)
        when (next?.reason) {
            Pause.AUTH -> sendEvent("focus_password", app, next.detail)
            Pause.DIALOG -> sendEvent("system_dialog", app, next.detail)
        }
        Log.i(TAG, "pause: ${prev?.reason ?: "-"} -> ${next?.reason ?: "-"}")
    }

    /** Sends app_changed, screen_changed and system_dialog(_closed) once per change. */
    private fun reportChanges() {
        val root = settledRoot()
        if (root == null) {
            updatePause(Pause.HIDDEN, null)
            return
        }
        val app = root.packageName?.toString() ?: return
        updatePause(currentPause(root), app)
        if (pause?.reason == Pause.DIALOG) return
        val screen = findScreen(root)
        if (app != reportedApp) {
            sendEvent("app_changed", app, null)
            reportedApp = app
            reportedScreen = screen
            sendEvent("screen_changed", app, screen)
        } else if (screen != reportedScreen) {
            reportedScreen = screen
            sendEvent("screen_changed", app, screen)
        }
    }

    private fun findScreen(node: AccessibilityNodeInfo, depth: Int = 0): String? {
        SnapshotBuilder.screenName(node.viewIdResourceName)?.let { return it }
        if (depth >= 8) return null
        for (i in 0 until node.childCount) {
            node.getChild(i)?.let { c -> findScreen(c, depth + 1)?.let { return it } }
        }
        return null
    }

    /** System dialogs that pause the agent: permissions and biometric prompts. */
    private fun systemDialog(root: AccessibilityNodeInfo): String? {
        val pkg = root.packageName?.toString() ?: return null
        return when {
            pkg.endsWith(".permissioncontroller") -> "permiso"
            pkg == SYSTEM_UI && hasBiometricPrompt(root) -> "biometria"
            else -> null
        }
    }

    private fun hasBiometricPrompt(root: AccessibilityNodeInfo): Boolean =
        root.findAccessibilityNodeInfosByViewId("com.android.systemui:id/biometric_icon").isNotEmpty() ||
            root.findAccessibilityNodeInfosByViewId("com.android.systemui:id/biometric_scrollview").isNotEmpty()

    private fun firstScrollable(): AccessibilityNodeInfo? {
        fun find(n: AccessibilityNodeInfo): AccessibilityNodeInfo? {
            if (n.isScrollable && n.isVisibleToUser) return n
            for (i in 0 until n.childCount) n.getChild(i)?.let { c -> find(c)?.let { return it } }
            return null
        }
        return rootInActiveWindow?.let(::find)
    }

    private fun imePackage(): String? =
        android.provider.Settings.Secure.getString(contentResolver, android.provider.Settings.Secure.DEFAULT_INPUT_METHOD)
            ?.substringBefore('/')

    private fun deviceName(): String = "${Build.MODEL} (API ${Build.VERSION.SDK_INT})"

    // ---- debug ----------------------------------------------------------

    /** Raw tree dump with screen content. Only in builds with -Ppriv8.a11yDump=true. */
    private fun debugDump(root: AccessibilityNodeInfo) {
        if (currentPause(root) != null) return
        val built = builder.build(root, -1, null)
        val chunks = built.raw.toString().chunked(CHUNK)
        chunks.forEachIndexed { i, part -> Log.d(TAG, "dump [${i + 1}/${chunks.size}] $part") }
    }

    companion object {
        const val TAG = "Priv8A11y"
        private const val SYSTEM_UI = "com.android.systemui"
        private const val SETTLE_MS = 300L
        private const val SETTLE_MAX_MS = 3_000L
        private const val REACT_MAX_MS = 1_000L
        private const val POLL_MS = 50L
        private const val PERFORM_TIMEOUT_MS = 5_000L
        private const val CHUNK = 3000
    }
}
