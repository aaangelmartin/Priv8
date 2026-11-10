package es.priv8.ocho.confirm

import java.text.Normalizer

/**
 * What the person said, from the recognizer's hypotheses. «confirmo» (or
 * confirmar, confirma, sí confirmo) approves; «cancela» (cancelar, cancelo,
 * anula, para, no) or any negation cancels. A negation wins: «no confirmo»
 * cancels. Anything else is no answer and 8 keeps listening.
 */
object VoiceAnswer {
    enum class Answer { CONFIRM, CANCEL }

    private val CANCEL = Regex("""\b(cancel\w*|anul\w*|para|no)\b""")
    private val CONFIRM = Regex("""\b(confirm\w*)\b""")

    fun classify(hypotheses: List<String>): Answer? {
        // The first hypothesis is the most likely one; look at it first.
        for (h in hypotheses) {
            val t = normalize(h)
            if (CANCEL.containsMatchIn(t)) return Answer.CANCEL
            if (CONFIRM.containsMatchIn(t)) return Answer.CONFIRM
        }
        return null
    }

    private fun normalize(s: String): String =
        Normalizer.normalize(s.lowercase(), Normalizer.Form.NFD).replace(Regex("""\p{Mn}+"""), "")
}
