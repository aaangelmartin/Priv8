package es.priv8.ocho.chat

import org.json.JSONObject

/**
 * From one audit line of the core (audit.schema.json) to what the person
 * reads in the conversation while 8 works: a short progress line, a block
 * card, or nothing. Pure logic, tested off the device.
 *
 * Audit lines carry tokens, never values, and these sentences never quote
 * `model_saw` or `detail`: they only use the kind, the app and the screen.
 */
object Progreso {

    /** What an audit line becomes in the conversation. */
    sealed class Efecto {
        /** A progress line in the current group. */
        data class Paso(val texto: String, val tono: Tono = Tono.NORMAL) : Efecto()
        /** A block or a refusal, shown as its own card. */
        data class Bloqueo(val motivo: String, val titulo: String, val texto: String, val tono: Tono) : Efecto()
        /** The task reached the core: a new group starts. */
        object Tarea : Efecto()
    }

    enum class Tono { NORMAL, PAUSA, BIEN, AVISO, BLOQUEO }

    private val APPS = listOf(
        "alcor" to "Banca Alcor",
        "brezo" to "Brezo Banco",
        "nimbo" to "Nimbo Bróker",
    )

    /** Display name of an app (package or policy id), or null if it is not one of the demo banks. */
    fun app(id: String?): String? {
        val s = id?.lowercase() ?: return null
        return APPS.firstOrNull { s.contains(it.first) }?.second
    }

    fun de(event: JSONObject): Efecto? {
        val app = app(event.optString("app").ifEmpty { null })
        return when (event.optString("kind")) {
            "task" -> Efecto.Tarea
            "observe_sent" -> Efecto.Paso(lectura(event.optString("screen"), app))
            "act" -> accion(event.optString("model_saw"))
            "oracle" -> Efecto.Paso("Comprobando sin ver la cifra")
            "held" -> Efecto.Paso("Esperando tu confirmación", Tono.PAUSA)
            "paused" -> when (event.optString("detail")) {
                "autenticacion" -> Efecto.Paso("Pon tu clave o el código. Miro a otro lado", Tono.PAUSA)
                "dialogo_sistema" -> Efecto.Paso("Pon tu huella. Miro a otro lado", Tono.PAUSA)
                else -> null // confirmación: ya la enseña su tarjeta
            }
            "approval" ->
                if (event.optString("approved_by") == "persona") Efecto.Paso("Confirmado. Sigo", Tono.BIEN) else null
            "call" -> Efecto.Paso("Llamando")
            "blocked" -> bloqueo(event.optString("reason"))
            else -> null // voice_out: ya lo cubre la burbuja de 8
        }
    }

    private fun lectura(screen: String, app: String?): String {
        val en = app?.let { " en $it" }.orEmpty()
        return when (screen) {
            "login" -> "Entrando${en}"
            "inicio" -> "Leyendo el saldo$en"
            "movimientos" -> "Leyendo los movimientos$en"
            "transferencia" -> "Preparando la transferencia$en"
            "revision" -> "Revisando la transferencia"
            "autenticacion" -> "Esperando el código del banco"
            "resultado" -> "Leyendo el resultado"
            else -> if (app != null) "Leyendo $app" else "Leyendo la pantalla"
        }
    }

    private fun accion(saw: String): Efecto? {
        val parts = saw.split(' ')
        return when (parts.getOrNull(1)) {
            "open_app" -> Efecto.Paso(app(parts.getOrNull(2))?.let { "Abriendo $it" } ?: "Abriendo la app")
            "type" -> Efecto.Paso("Escribiendo los datos")
            else -> null // tap, back, scroll, key: la siguiente lectura ya dice dónde está
        }
    }

    private fun bloqueo(reason: String): Efecto? = when (reason) {
        "asesoria" -> Efecto.Bloqueo(
            reason, "No puedo asesorarte",
            "8 hace trámites, no aconseja inversiones. Tu petición no ha llegado al modelo.", Tono.AVISO,
        )
        "rojo" -> Efecto.Bloqueo(
            reason, "Nunca sale",
            "Es una clave o un código. No lo miro y no sale del móvil.", Tono.BLOQUEO,
        )
        "destino" -> Efecto.Bloqueo(
            reason, "Pago parado",
            "La cuenta de destino venía de un mensaje, no de tu banco. No la uso.", Tono.BLOQUEO,
        )
        "fuga" -> Efecto.Bloqueo(
            reason, "Envío parado",
            "Un dato iba a salir sin tapar. No ha salido.", Tono.BLOQUEO,
        )
        "presupuesto" -> Efecto.Bloqueo(
            reason, "Sin más comprobaciones",
            "He hecho todas las preguntas que puedo sobre tus cifras en esta sesión.", Tono.AVISO,
        )
        "token_desconocido" -> Efecto.Paso("He parado un paso con un dato que no reconozco", Tono.AVISO)
        "sin_regla" -> Efecto.Paso("Esa pantalla no tiene permiso. Vuelvo a una conocida", Tono.AVISO)
        "adaptador" -> Efecto.Paso("Un paso no ha salido. Lo intento de otra forma", Tono.AVISO)
        else -> null // caducado, cancelado: lo dice la tarjeta de confirmación
    }
}
