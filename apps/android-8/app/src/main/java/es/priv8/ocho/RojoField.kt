package es.priv8.ocho

import android.text.InputType
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Input fields of the rojo class (never sale): passwords, PIN and one-time
 * codes. The person types them; 8 never reads or writes them, and while one
 * has the focus the agent is paused ("mira a otro lado").
 *
 * A field is rojo when Android says so (`isPassword`), when its input type is
 * a password variation (`textPassword`, `numberPassword`, ...), or, for
 * editable fields only, when its id, hint or label names a secret (otp, pin,
 * clave, contraseña, código...). The last rule is the device-side stand-in
 * for a policy hint: it catches OTP boxes drawn as plain number fields.
 */
object RojoField {

    /** What kind of secret it is, sent as the `detail` of focus_password. */
    enum class Kind(val detail: String) { CLAVE("clave"), OTP("otp") }

    fun isRojo(node: AccessibilityNodeInfo): Boolean = kind(node) != null

    fun kind(node: AccessibilityNodeInfo): Kind? {
        val variation = node.inputType and (InputType.TYPE_MASK_CLASS or InputType.TYPE_MASK_VARIATION)
        val words = describe(node)
        if (variation == NUMBER_PASSWORD) return Kind.OTP
        if (node.isPassword || variation in TEXT_PASSWORDS) {
            return if (OTP_WORDS.containsMatchIn(words)) Kind.OTP else Kind.CLAVE
        }
        if (!node.isEditable) return null
        return when {
            OTP_WORDS.containsMatchIn(words) -> Kind.OTP
            SECRET_WORDS.containsMatchIn(words) -> Kind.CLAVE
            else -> null
        }
    }

    /** Id, hint and label in lower case. Never the field's content. */
    private fun describe(node: AccessibilityNodeInfo): String = listOfNotNull(
        node.viewIdResourceName?.substringAfterLast('/'),
        SnapshotBuilder.hint(node),
        node.contentDescription?.toString(),
        node.labeledBy?.text?.toString(),
    ).joinToString(" ").lowercase()

    private const val NUMBER_PASSWORD = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
    private val TEXT_PASSWORDS = setOf(
        InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD,
        InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD,
        InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
    )
    private val OTP_WORDS = Regex("""\botp\b|\bsms\b|c[oó]digo|code|token|un solo uso|one.?time|\bcvv\b|\bcvc\b""")
    private val SECRET_WORDS = Regex("""\bpin\b|clave|contrase[nñ]a|password|passcode|firma""")
}
