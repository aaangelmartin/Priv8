package es.priv8.ocho

/**
 * What the person asked 8 out loud (issue #47), from the recognizer's
 * hypotheses. Pure logic, so it can be tested off the device.
 *
 * The text is the task, in the person's words. It may carry data («pasa
 * 200 € a Marta»), so it is never logged and, when the task message exists,
 * it goes to the core (which tokenizes it), never straight to the model.
 */
object Dictado {

    /** Longest task kept; a recognizer that runs on is cut here. */
    const val MAX = 200

    /** The task: the first hypothesis with words in it, tidied. Null if none. */
    fun tarea(hypotheses: List<String>): String? {
        val h = hypotheses.firstOrNull { it.any(Char::isLetterOrDigit) } ?: return null
        val t = h.trim().replace(Regex("""\s+"""), " ").take(MAX).trimEnd()
        // Capital on the first letter, also after «¿» or «¡».
        val i = t.indexOfFirst(Char::isLetter)
        return if (i < 0) t else t.substring(0, i) + t[i].uppercaseChar() + t.substring(i + 1)
    }
}
