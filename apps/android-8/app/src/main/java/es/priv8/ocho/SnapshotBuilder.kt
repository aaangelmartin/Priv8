package es.priv8.ocho

import android.graphics.Rect
import android.os.Build
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/**
 * Maps the accessibility node tree of the active window to a raw snapshot
 * (docs/contracts/snapshot.schema.json, contract v1).
 *
 * The snapshot carries real values and never leaves the trust zone: it only
 * goes over the bridge to the core on the laptop. Password fields are marked
 * `password: true` (always rojo) and their content is masked here as well, so
 * a password never leaves the device even in the raw snapshot.
 */
class SnapshotBuilder {

    /** Result of a walk: the JSON for the bridge and the nodes by element id, for perform. */
    class Built(val raw: JSONObject, val nodes: Map<String, AccessibilityNodeInfo>, val app: String)

    fun build(root: AccessibilityNodeInfo, seq: Int, systemDialog: String?): Built {
        val app = root.packageName?.toString() ?: UNKNOWN_APP
        val elements = JSONArray()
        val nodes = LinkedHashMap<String, AccessibilityNodeInfo>()
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        var focusId: String? = null
        var screen: String? = null

        fun walk(node: AccessibilityNodeInfo, parentId: String?, depth: Int) {
            if (!node.isVisibleToUser) return
            var ownId = parentId
            if (isRelevant(node)) {
                val id = "n${nodes.size + 1}"
                nodes[id] = node
                elements.put(toElement(node, id, parentId, app))
                if (focused != null && node == focused) focusId = id
                ownId = id
            }
            if (screen == null) screen = screenName(node.viewIdResourceName)
            if (depth >= MAX_DEPTH) return
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { walk(it, ownId, depth + 1) }
            }
        }
        walk(root, null, 0)

        val raw = JSONObject()
            .put("source", "android")
            .put("app", app)
            .put("screen", screen ?: JSONObject.NULL)
            .put("seq", seq)
            .put("focus", focusId ?: JSONObject.NULL)
            .put("system_dialog", systemDialog ?: JSONObject.NULL)
            .put("elements", elements)
        return Built(raw, nodes, app)
    }

    /** Skips pure layout containers: keeps nodes with content, an id, or something to do. */
    private fun isRelevant(node: AccessibilityNodeInfo): Boolean =
        !node.text.isNullOrEmpty() ||
            !node.contentDescription.isNullOrEmpty() ||
            !hint(node).isNullOrEmpty() ||
            node.isClickable || node.isEditable || node.isCheckable || node.isScrollable ||
            node.isPassword ||
            (node.viewIdResourceName != null && !isSystemDecor(node.viewIdResourceName))

    private fun toElement(node: AccessibilityNodeInfo, id: String, parentId: String?, app: String): JSONObject {
        val el = JSONObject()
            .put("id", id)
            .put("role", role(node))
        val showingHint = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && node.isShowingHintText
        val label = node.contentDescription?.toString()?.takeIf { it.isNotEmpty() }
            ?: node.labeledBy?.text?.toString()?.takeIf { it.isNotEmpty() }
            ?: hint(node)?.takeIf { it.isNotEmpty() }
        el.put("label", label ?: JSONObject.NULL)
        val text = if (showingHint) null else node.text?.toString()
        when {
            node.isPassword -> {
                el.put("password", true)
                // Never ship the real password, not even in the raw snapshot.
                el.put("text", if (text.isNullOrEmpty()) JSONObject.NULL else MASK.repeat(text.length))
            }
            else -> el.put("text", text ?: JSONObject.NULL)
        }
        node.viewIdResourceName?.let { el.put("sel", selector(it, app)) }
        val r = Rect().also { node.getBoundsInScreen(it) }
        el.put("bounds", JSONArray(listOf(r.left, r.top, r.right, r.bottom)))
        el.put("enabled", node.isEnabled)
        el.put("parent", parentId ?: JSONObject.NULL)
        val ops = ops(node)
        if (ops.isNotEmpty()) el.put("actions", JSONArray(ops))
        return el
    }

    companion object {
        const val UNKNOWN_APP = "desconocida"
        private const val MAX_DEPTH = 60
        private const val MASK = "•"
        private val SCREEN_ID = Regex("""(?:^|[:/])screen_([A-Za-z0-9_.-]+)$""")

        fun hint(node: AccessibilityNodeInfo): String? =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) node.hintText?.toString() else null

        /** `es.priv8.banks.alcor:id/saldo` → `id/saldo`; ids of other packages keep their prefix. */
        fun selector(viewId: String, app: String): String =
            if (viewId.startsWith("$app:")) viewId.removePrefix("$app:") else viewId

        /** A root view named `screen_<name>` gives the screen name (Banca Alcor convention). */
        fun screenName(viewId: String?): String? =
            viewId?.let { SCREEN_ID.find(it)?.groupValues?.get(1) }

        private fun isSystemDecor(viewId: String): Boolean =
            viewId.startsWith("android:id/") || viewId.endsWith(":id/action_bar_root")

        fun role(node: AccessibilityNodeInfo): String {
            val cls = node.className?.toString().orEmpty()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && node.isHeading) return "heading"
            return when {
                node.isEditable || cls.endsWith("EditText") -> "textbox"
                cls.endsWith("CheckBox") -> "checkbox"
                cls.endsWith("RadioButton") -> "radio"
                cls.endsWith("Switch") || cls.endsWith("ToggleButton") -> "switch"
                cls.endsWith("Spinner") -> "select"
                cls.endsWith("Button") -> "button"
                cls.endsWith("ImageView") -> if (node.isClickable) "button" else "image"
                cls.endsWith("ListView") || cls.endsWith("RecyclerView") || cls.endsWith("GridView") -> "list"
                cls.endsWith("TabWidget") -> "list"
                cls.endsWith("ScrollView") -> "other"
                node.collectionItemInfo != null -> "listitem"
                node.isClickable -> "button"
                cls.endsWith("TextView") -> "text"
                else -> "other"
            }
        }

        /** Operations from common.schema.json#/$defs/op that this node supports. */
        fun ops(node: AccessibilityNodeInfo): List<String> {
            val ops = mutableListOf<String>()
            val ids = node.actionList.map { it.id }.toSet()
            if (node.isClickable || AccessibilityNodeInfo.ACTION_CLICK in ids) ops += "tap"
            if (!node.isPassword && (node.isEditable || AccessibilityNodeInfo.ACTION_SET_TEXT in ids)) ops += "type"
            if (node.isScrollable ||
                AccessibilityNodeInfo.ACTION_SCROLL_FORWARD in ids ||
                AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD in ids
            ) {
                ops += "scroll"
            }
            return ops
        }
    }
}
