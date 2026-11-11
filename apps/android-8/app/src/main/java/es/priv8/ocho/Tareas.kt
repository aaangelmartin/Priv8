package es.priv8.ocho

import org.json.JSONObject

/**
 * Who turns the voice into text (#47). Both keep the audio local:
 * [MOVIL] the phone's on-device recognizer, then `task_request` with the text;
 * [PORTATIL] `dictation_start`, and the core transcribes the laptop microphone
 * with Whisper (the emulator's recognizer does not work).
 */
enum class Via { MOVIL, PORTATIL }

/**
 * The task messages of the events channel (events.schema.json v1.2). Pure
 * logic, tested off the device. The task text may carry data: it only travels
 * on the local events channel to the core, which tokenizes it, and is never logged.
 */
object Tareas {

    /** `auto` (default), `movil` or `portatil`: from `-Ppriv8.dictado` or `--es dictado`. */
    fun via(ajuste: String?, emulador: Boolean): Via = when (ajuste?.lowercase()) {
        "movil", "móvil" -> Via.MOVIL
        "portatil", "portátil" -> Via.PORTATIL
        else -> if (emulador) Via.PORTATIL else Via.MOVIL
    }

    /** Android Studio's emulator, from the Build fields. */
    fun esEmulador(fingerprint: String, model: String, product: String, hardware: String): Boolean =
        fingerprint.startsWith("generic") || fingerprint.contains("emulator") ||
            fingerprint.contains("sdk_gphone") || model.contains("Emulator") ||
            model.contains("Android SDK built for") || product.startsWith("sdk") ||
            product.contains("sdk_gphone") || hardware == "goldfish" || hardware == "ranchu"

    fun taskRequest(session: String, text: String): JSONObject =
        JSONObject().put("type", "task_request").put("session", session).put("text", text)

    fun dictationStart(session: String): JSONObject =
        JSONObject().put("type", "dictation_start").put("session", session)

    /** What the laptop dictation answered: the task, or a notice for the person. */
    data class Respuesta(val tarea: String?, val aviso: String?)

    /** A `dictation` message for [session], or null if it is something else. */
    fun dictation(msg: JSONObject, session: String): Respuesta? {
        if (msg.optString("type") != "dictation" || msg.optString("session") != session) return null
        val tarea = Dictado.tarea(listOf(msg.optString("text")))
        return when {
            tarea != null && !msg.has("error") -> Respuesta(tarea, null)
            msg.optString("error") == "no_disponible" ->
                Respuesta(null, "El portátil no puede escucharte ahora. Escribe la tarea.")
            else -> Respuesta(null, "No te he oído. Vuelve a probar o escríbelo.")
        }
    }
}
