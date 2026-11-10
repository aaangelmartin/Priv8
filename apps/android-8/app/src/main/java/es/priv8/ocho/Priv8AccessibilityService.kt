package es.priv8.ocho

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/**
 * Minimal accessibility service: on every window change it dumps the active
 * window's node tree as compact JSON to logcat (tag [TAG]).
 *
 * Probe for issue #26. It logs raw screen content, so it must only run on the
 * emulator with simulated data; the real adapter tokenises before anything
 * leaves the device.
 */
class Priv8AccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG, """{"event":"connected"}""")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val type = event.eventType
        if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            type != AccessibilityEvent.TYPE_WINDOWS_CHANGED
        ) {
            return
        }
        val root = rootInActiveWindow ?: return
        val dump = JSONObject()
            .put("event", AccessibilityEvent.eventTypeToString(type))
            .put("package", event.packageName?.toString())
            .put("root", nodeToJson(root, 0))
        // logcat truncates long lines (about 4 KB), so split into numbered chunks.
        val chunks = dump.toString().chunked(CHUNK)
        chunks.forEachIndexed { i, part -> Log.d(TAG, "[${i + 1}/${chunks.size}] $part") }
    }

    override fun onInterrupt() {
        Log.i(TAG, """{"event":"interrupt"}""")
    }

    private fun nodeToJson(node: AccessibilityNodeInfo, depth: Int): JSONObject {
        val bounds = Rect().also { node.getBoundsInScreen(it) }
        val json = JSONObject()
            .put("cls", node.className?.toString())
            .put("bounds", JSONArray(listOf(bounds.left, bounds.top, bounds.right, bounds.bottom)))
        node.viewIdResourceName?.let { json.put("id", it) }
        node.text?.let { json.put("text", it.toString()) }
        node.contentDescription?.let { json.put("desc", it.toString()) }
        if (node.isPassword) json.put("password", true)
        if (depth < MAX_DEPTH && node.childCount > 0) {
            val children = JSONArray()
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { children.put(nodeToJson(it, depth + 1)) }
            }
            json.put("children", children)
        }
        return json
    }

    companion object {
        const val TAG = "Priv8A11y"
        private const val CHUNK = 3000
        private const val MAX_DEPTH = 40
    }
}
