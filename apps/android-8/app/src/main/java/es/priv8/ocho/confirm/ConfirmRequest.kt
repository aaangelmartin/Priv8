package es.priv8.ocho.confirm

import org.json.JSONObject

/** One segment of the summary (voice.schema.json#/$defs/segment). */
data class Segment(val voice: String, val text: String?, val token: String?, val sayAs: String?)

/**
 * A confirmation request (confirm.schema.json#/$defs/request). The summary
 * carries tokens, not values: the values come from [LocalValues] and are
 * rendered on the device.
 */
data class ConfirmRequest(
    val id: String,
    val session: String,
    val kind: String,
    val segments: List<Segment>,
    val channels: Set<String>,
    val sca: String?,
    val expiresS: Int,
    /** SHA-256 (hex) of the whole canonical confirm_request: tells a true re-send from a new request with a reused id. */
    val fingerprint: String,
) {
    companion object {
        private val ID = Regex("^c[0-9]+$")
        private val SESSION = Regex("^[A-Za-z0-9_-]{1,64}$")
        private val KINDS = setOf("transferir", "invertir", "firmar", "enviar", "llamar")
        const val DEFAULT_EXPIRES_S = 300

        /** Parses and checks the fields 8 relies on. Null if the message does not follow the contract. */
        fun parse(msg: JSONObject): ConfirmRequest? {
            if (msg.optString("type") != "confirm_request") return null
            val id = msg.optString("id").takeIf { ID.matches(it) } ?: return null
            val session = msg.optString("session").takeIf { SESSION.matches(it) } ?: return null
            val kind = msg.optString("kind").takeIf { it in KINDS } ?: return null
            val summary = msg.optJSONArray("summary") ?: return null
            val segments = (0 until summary.length()).map { i ->
                val s = summary.optJSONObject(i) ?: return null
                val voice = s.optString("voice").takeIf { it == "cloud" || it == "local" } ?: return null
                val text = if (s.has("text")) s.getString("text") else null
                val token = if (s.has("token")) s.getString("token") else null
                if ((text == null) == (token == null)) return null
                if (voice == "cloud" && token != null) return null
                Segment(voice, text, token, s.optString("say_as").ifEmpty { null })
            }
            if (segments.isEmpty()) return null
            val ch = msg.optJSONArray("channels") ?: return null
            val channels = (0 until ch.length()).map { ch.optString(it) }.toSet()
            if (channels.isEmpty() || !channels.all { it == "voz" || it == "pantalla" }) return null
            val sca = if (msg.isNull("sca")) null else msg.optString("sca")
            val expires = msg.optInt("expires_s", DEFAULT_EXPIRES_S).takeIf { it >= 1 } ?: return null
            return ConfirmRequest(id, session, kind, segments, channels, sca, expires, fingerprint(msg))
        }

        /**
         * SHA-256 of [msg] in canonical form: object keys sorted at every
         * level, no whitespace. Covers every field, including `action`, so
         * two requests match only if the core sent the very same request.
         */
        fun fingerprint(msg: JSONObject): String {
            val bytes = java.security.MessageDigest.getInstance("SHA-256")
                .digest(canonical(msg).toByteArray(Charsets.UTF_8))
            return bytes.joinToString("") { "%02x".format(it) }
        }

        internal fun canonical(v: Any?): String = when (v) {
            null, JSONObject.NULL -> "null"
            is JSONObject -> v.keys().asSequence().toList().sorted()
                .joinToString(",", "{", "}") { JSONObject.quote(it) + ":" + canonical(v.opt(it)) }
            is org.json.JSONArray -> (0 until v.length()).joinToString(",", "[", "]") { canonical(v.opt(it)) }
            is String -> JSONObject.quote(v)
            is Number -> JSONObject.numberToString(v)
            else -> v.toString()
        }
    }
}

/**
 * The summary with the real values in: [screen] for the screen
 * («200,00 € a tu cuenta de Nimbo Bróker. ¿Lo confirmas?») and [spoken] for
 * TextToSpeech, with amounts spelled out («Doscientos euros a tu cuenta de
 * Nimbo Bróker. ¿Lo confirmas?»). [missing] counts tokens without a value:
 * if any, the person cannot check what they approve, so 8 does not offer
 * Confirmar.
 */
data class Rendered(val screen: String, val spoken: String, val missing: Int)

object Renderer {

    fun render(segments: List<Segment>, valueOf: (String) -> String?): Rendered {
        val screen = mutableListOf<String>()
        val spoken = mutableListOf<String>()
        var missing = 0
        var afterToken = false
        for (s in segments) {
            if (s.token == null) {
                val text = s.text.orEmpty().trim()
                // The segmenter drops the full stop after a token («‹SUMA_1›. Te he…» gives
                // a token and then «Te he…»): a capital right after a value starts a sentence.
                if (afterToken && text.firstOrNull()?.isUpperCase() == true) {
                    closeLast(screen)
                    closeLast(spoken)
                }
                screen += text
                spoken += text
                afterToken = false
                continue
            }
            afterToken = true
            val value = valueOf(s.token)
            if (value == null) {
                missing++
                screen += s.token
                spoken += "un dato que no tengo"
            } else {
                screen += value
                spoken += Verbalizer.say(value, s.sayAs)
            }
        }
        return Rendered(sentence(screen), sentence(spoken), missing)
    }

    private fun closeLast(pieces: MutableList<String>) {
        val last = pieces.lastOrNull() ?: return
        if (last.isNotEmpty() && last.last() !in ".,;:?!…") pieces[pieces.size - 1] = "$last."
    }

    /** Joins the pieces with spaces, closes a sentence before «¿» or «¡», and capitalizes the start. */
    fun sentence(pieces: List<String>): String {
        val out = StringBuilder()
        for (p in pieces.filter { it.isNotEmpty() }) {
            if (out.isNotEmpty()) {
                if ((p.startsWith("¿") || p.startsWith("¡")) && out.last() !in ".,;:?!") out.append('.')
                out.append(' ')
            }
            out.append(p)
        }
        return out.toString().replaceFirstChar { it.uppercaseChar() }
    }
}

/**
 * Token → value table for the sessions the core shares with the device.
 * In memory only: never written to disk, never logged, gone when the process
 * dies. The core sends it over the bridge (render_values, bridge.schema.json
 * v1.1), which is inside the trust zone.
 */
object LocalValues {
    private val bySession = HashMap<String, Map<String, String>>()

    @Synchronized fun put(session: String, values: Map<String, String>) {
        bySession[session] = (bySession[session].orEmpty() + values)
    }

    @Synchronized fun get(session: String, token: String): String? = bySession[session]?.get(token)

    @Synchronized fun count(session: String): Int = bySession[session]?.size ?: 0
}
