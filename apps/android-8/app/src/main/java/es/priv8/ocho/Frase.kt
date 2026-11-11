package es.priv8.ocho

import es.priv8.ocho.confirm.Rendered
import es.priv8.ocho.confirm.Renderer
import es.priv8.ocho.confirm.Segment
import org.json.JSONObject

/**
 * One sentence 8 says (voice.schema.json), as it arrives in the `voice`
 * message of the event channel: tokens, never values. The local renderer
 * (issue #40) puts the real values in on the device, with the same [Renderer]
 * and [es.priv8.ocho.confirm.LocalValues] table that spoken confirmations use;
 * the core sends that table over the bridge with `render_values`.
 *
 * Neither the template nor the rendered text is ever logged.
 */
data class Frase(val utterance: String, val session: String, val segments: List<Segment>) {

    /** The sentence for the screen, with the values that the device has. */
    fun render(valueOf: (String) -> String?): Rendered = Renderer.render(segments, valueOf)

    /** Tokens of the sentence, in order and without repeats. */
    val tokens: List<String> get() = segments.mapNotNull { it.token }.distinct()

    companion object {
        private val UTTERANCE = Regex("^u[0-9]+$")
        private val SESSION = Regex("^[A-Za-z0-9_-]{1,64}$")
        private val SAY_AS = setOf("currency", "number", "digits", "name", "date", "phone", "iban", "text")

        /** Parses `{"type":"voice","utterance":{...}}`. Null if it does not follow the contract. */
        fun parse(msg: JSONObject): Frase? {
            if (msg.optString("type") != "voice") return null
            val u = msg.optJSONObject("utterance") ?: return null
            val id = u.optString("utterance").takeIf { UTTERANCE.matches(it) } ?: return null
            val session = u.optString("session").takeIf { SESSION.matches(it) } ?: return null
            val arr = u.optJSONArray("segments") ?: return null
            val segments = (0 until arr.length()).map { i ->
                val s = arr.optJSONObject(i) ?: return null
                val voice = s.optString("voice").takeIf { it == "cloud" || it == "local" } ?: return null
                val text = if (s.has("text")) s.getString("text") else null
                val token = if (s.has("token")) s.getString("token") else null
                if ((text == null) == (token == null)) return null
                if (voice == "cloud" && token != null) return null // a value must never be read by the cloud voice
                val sayAs = s.optString("say_as").ifEmpty { null }
                if (sayAs != null && sayAs !in SAY_AS) return null
                Segment(voice, text, token, sayAs)
            }
            if (segments.isEmpty()) return null
            return Frase(id, session, segments)
        }
    }
}
