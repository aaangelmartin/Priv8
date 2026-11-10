package es.priv8.ocho

import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/**
 * Why the agent must wait on the current window («mira a otro lado»).
 *
 * [reason] uses the values of `paused` in observation.schema.json
 * (autenticacion, dialogo_sistema, confirmacion); [detail] is what goes in the
 * bridge event (clave or otp for focus_password, biometria or permiso for
 * system_dialog).
 *
 * While paused, a snapshot carries nothing from the window: no texts, no
 * labels, no ids of other elements. Only what the core needs to set
 * `paused` itself from snapshot.schema.json fields:
 *  - autenticacion: one element, the focused rojo field (`password: true`,
 *    `text: null`), and `focus` pointing at it;
 *  - dialogo_sistema: `system_dialog` set and no elements;
 *  - confirmacion: 8's own screen, `screen: "confirmacion"` and no elements.
 * 8's own app in front outside a confirmation ([OWN_APP]) is redacted the
 * same way (no elements), and performs on it are refused, so the agent can
 * never tap 8's Confirmar button.
 */
data class Pause(val reason: String, val detail: String?) {

    fun snapshot(root: AccessibilityNodeInfo?, seq: Int): JSONObject {
        val app = root?.packageName?.toString() ?: SnapshotBuilder.UNKNOWN_APP
        val raw = JSONObject()
            .put("source", "android")
            .put("app", app)
            .put("seq", seq)
            .put("system_dialog", if (reason == DIALOG) detail else JSONObject.NULL)
        val elements = JSONArray()
        when (reason) {
            AUTH -> {
                raw.put("screen", root?.let { screenOf(it) } ?: JSONObject.NULL)
                elements.put(
                    JSONObject()
                        .put("id", FIELD_ID)
                        .put("role", "textbox")
                        .put("label", JSONObject.NULL)
                        .put("text", JSONObject.NULL)
                        .put("password", true),
                )
                raw.put("focus", FIELD_ID)
            }
            CONFIRM -> raw.put("screen", "confirmacion").put("focus", JSONObject.NULL)
            OWN -> raw.put("screen", JSONObject.NULL).put("focus", JSONObject.NULL)
            else -> raw.put("screen", JSONObject.NULL).put("focus", JSONObject.NULL)
        }
        return raw.put("elements", elements)
    }

    /** The screen name (a view id such as screen_login) is interface, not data. */
    private fun screenOf(node: AccessibilityNodeInfo, depth: Int = 0): String? {
        SnapshotBuilder.screenName(node.viewIdResourceName)?.let { return it }
        if (depth >= 8) return null
        for (i in 0 until node.childCount) {
            node.getChild(i)?.let { c -> screenOf(c, depth + 1)?.let { return it } }
        }
        return null
    }

    companion object {
        const val AUTH = "autenticacion"
        const val DIALOG = "dialogo_sistema"
        const val CONFIRM = "confirmacion"
        /** 8's own app in front, not confirming: not a pause of the contract, but nothing of it goes out either. */
        const val OWN = "app_propia"
        /** detail of the focus_password event sent when the rojo field loses the focus. */
        const val END = "fin"
        private const val FIELD_ID = "n1"

        val CONFIRMATION = Pause(CONFIRM, null)
        val OWN_APP = Pause(OWN, null)
        /**
         * A window 8 cannot read: rootInActiveWindow is null. On Android 14
         * the permission dialog is one (its views are hidden from services
         * that are not accessibility tools). The safe default is to treat it
         * as a system dialog: the agent waits and nothing is sent.
         */
        val HIDDEN = Pause(DIALOG, "oculta")
        fun dialog(kind: String) = Pause(DIALOG, kind)
        fun authentication(kind: RojoField.Kind) = Pause(AUTH, kind.detail)
    }
}
