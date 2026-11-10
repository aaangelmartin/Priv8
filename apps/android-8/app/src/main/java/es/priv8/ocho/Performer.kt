package es.priv8.ocho

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Runs a `perform` from the bridge (docs/contracts/bridge.schema.json) on the
 * node addressed by id in the last snapshot.
 *
 * `text` is the real value, already rehydrated by the core's executor. It is
 * never logged.
 */
class Performer(
    private val service: AccessibilityService,
    private val nodeFor: (String) -> AccessibilityNodeInfo?,
    private val findScrollable: () -> AccessibilityNodeInfo?,
) {

    /** Outcome per the contract: ok, or one of the error codes of `result.error`. */
    sealed class Outcome {
        object Ok : Outcome()
        data class Error(val code: String) : Outcome()
    }

    fun perform(op: String, target: String?, text: String?, direction: String?): Outcome = when (op) {
        "tap" -> tap(target)
        "type" -> type(target, text)
        "back" -> global(AccessibilityService.GLOBAL_ACTION_BACK)
        "open_app" -> openApp(text)
        "scroll" -> scroll(target, direction ?: "down")
        "key" -> key(text)
        // send and call are carried out by other adapters (voice, telephony), not on screen.
        else -> NOT_ALLOWED
    }

    private fun resolve(target: String?): AccessibilityNodeInfo? {
        val node = target?.let(nodeFor) ?: return null
        // refresh() is false when the view is gone: the id is from a stale snapshot.
        return if (node.refresh()) node else null
    }

    private fun tap(target: String?): Outcome {
        val node = resolve(target) ?: return NOT_FOUND
        if (!node.isEnabled) return NOT_ALLOWED
        var n: AccessibilityNodeInfo? = node
        while (n != null) {
            if (n.isClickable && n.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return Outcome.Ok
            n = n.parent
        }
        // Nothing clickable in the chain: tap the centre of the element.
        val r = Rect().also { node.getBoundsInScreen(it) }
        return if (gestureTap(r.exactCenterX(), r.exactCenterY())) Outcome.Ok else OTHER
    }

    private fun type(target: String?, text: String?): Outcome {
        if (text == null) return OTHER
        val node = resolve(target) ?: return NOT_FOUND
        // Rojo: the user types passwords and OTP; 8 never does (PSD2).
        if (RojoField.isRojo(node)) return NOT_ALLOWED
        val field = if (node.isEditable) node else findEditable(node) ?: return NOT_ALLOWED
        if (RojoField.isRojo(field)) return NOT_ALLOWED
        field.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return if (field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) Outcome.Ok else OTHER
    }

    private fun openApp(pkg: String?): Outcome {
        if (pkg.isNullOrBlank()) return OTHER
        val intent = service.packageManager.getLaunchIntentForPackage(pkg) ?: return NOT_FOUND
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
        return try {
            service.startActivity(intent)
            Outcome.Ok
        } catch (e: RuntimeException) {
            NOT_ALLOWED
        }
    }

    private fun scroll(target: String?, direction: String): Outcome {
        val start = if (target != null) resolve(target) ?: return NOT_FOUND else findScrollable() ?: return NOT_FOUND
        var n: AccessibilityNodeInfo? = start
        while (n != null && !n.isScrollable) n = n.parent
        val node = n ?: return NOT_ALLOWED
        val directional = when (direction) {
            "up" -> AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_UP
            "down" -> AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_DOWN
            "left" -> AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_LEFT
            else -> AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_RIGHT
        }
        if (node.actionList.any { it.id == directional.id } && node.performAction(directional.id)) return Outcome.Ok
        val fallback = if (direction == "down" || direction == "right") {
            AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
        } else {
            AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
        }
        // false here usually means the list is already at that end.
        return if (node.performAction(fallback)) Outcome.Ok else OTHER
    }

    private fun key(name: String?): Outcome = when (name?.lowercase()) {
        "back" -> global(AccessibilityService.GLOBAL_ACTION_BACK)
        "home" -> global(AccessibilityService.GLOBAL_ACTION_HOME)
        "enter" -> {
            val focused = service.rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            if (focused == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                NOT_FOUND
            } else if (focused.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id)) {
                Outcome.Ok
            } else {
                OTHER
            }
        }
        else -> NOT_ALLOWED
    }

    private fun global(action: Int): Outcome =
        if (service.performGlobalAction(action)) Outcome.Ok else OTHER

    private fun findEditable(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        for (i in 0 until node.childCount) {
            val c = node.getChild(i) ?: continue
            if (c.isEditable) return c
            findEditable(c)?.let { return it }
        }
        return null
    }

    private fun gestureTap(x: Float, y: Float): Boolean {
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, TAP_MS))
            .build()
        val done = CountDownLatch(1)
        var completed = false
        val callback = object : AccessibilityService.GestureResultCallback() {
            override fun onCompleted(g: GestureDescription?) { completed = true; done.countDown() }
            override fun onCancelled(g: GestureDescription?) { done.countDown() }
        }
        if (!service.dispatchGesture(gesture, callback, null)) return false
        done.await(GESTURE_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        return completed
    }

    companion object {
        private const val TAP_MS = 50L
        private const val GESTURE_TIMEOUT_MS = 2000L
        val NOT_FOUND = Outcome.Error("target_no_encontrado")
        val NOT_ALLOWED = Outcome.Error("no_permitido")
        val OTHER = Outcome.Error("otro")
        val TIMEOUT = Outcome.Error("timeout")
    }
}
