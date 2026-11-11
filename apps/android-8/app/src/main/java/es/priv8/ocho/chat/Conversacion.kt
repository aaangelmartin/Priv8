package es.priv8.ocho.chat

import es.priv8.ocho.Frase
import es.priv8.ocho.confirm.ConfirmRequest
import org.json.JSONObject

/**
 * The conversation with 8 on the phone: what the person asked, what 8 is
 * doing and what it answered. An immutable state and a reducer, pure logic
 * tested off the device; [es.priv8.ocho.chat.ChatView] draws it.
 *
 * It only keeps what the events channel and the person give it:
 *  - 8's sentences as [Frase] (tokens). The values are put in when they are
 *    drawn, from [es.priv8.ocho.confirm.LocalValues], so they live in one
 *    place only, in memory;
 *  - confirmations as [ConfirmRequest] (tokens too);
 *  - progress from audit lines, through [Progreso], never their text.
 * Events of another session (the B2B demo on the same core) are ignored.
 * Nothing here is logged.
 */
data class Conversacion(
    val session: String,
    val items: List<Item> = listOf(Item.Ocho(SALUDO_ID, frase = null, texto = SALUDO)),
    /** null until the first connection attempt ends. */
    val conectado: Boolean? = null,
    val trabajando: Boolean = false,
    /** Keys of the messages already applied: a reconnect may deliver one twice. */
    private val vistos: List<String> = emptyList(),
    private val n: Int = 0,
) {
    sealed class Item {
        abstract val id: String

        /** What the person asked. [enviada] false: waiting for the connection. */
        data class Persona(override val id: String, val texto: String, val enviada: Boolean) : Item()

        /** 8 speaking: a [frase] from the core, or a fixed [texto] of the app itself. */
        data class Ocho(override val id: String, val frase: Frase?, val texto: String?) : Item()

        /** What 8 is doing for one task, line by line. */
        data class Pasos(override val id: String, val lineas: List<Progreso.Efecto.Paso>, val activo: Boolean) : Item()

        data class Bloqueo(override val id: String, val motivo: String, val titulo: String, val texto: String, val tono: Progreso.Tono) : Item()

        data class Confirmacion(override val id: String, val request: ConfirmRequest, val estado: Estado) : Item()

        /** A notice from the phone (dictation, connection), not from 8. */
        data class Nota(override val id: String, val texto: String) : Item()
    }

    enum class Estado { PENDIENTE, CONFIRMADA, CANCELADA, CADUCADA }

    enum class Fase { SIN_CONEXION, REPOSO, TRABAJANDO, ESPERANDO, LISTO }

    val fase: Fase
        get() = when {
            conectado == false -> Fase.SIN_CONEXION
            items.any { it is Item.Confirmacion && it.estado == Estado.PENDIENTE } -> Fase.ESPERANDO
            trabajando -> Fase.TRABAJANDO
            items.any { it is Item.Ocho && it.frase != null } -> Fase.LISTO
            else -> Fase.REPOSO
        }

    /** The line the header shows while 8 works: the last progress line. */
    val ultimoPaso: String?
        get() = (items.lastOrNull { it is Item.Pasos } as Item.Pasos?)?.takeIf { it.activo }?.lineas?.lastOrNull()?.texto

    /** The confirmation still waiting for an answer, if any. */
    val pendiente: Item.Confirmacion?
        get() = items.lastOrNull { it is Item.Confirmacion && it.estado == Estado.PENDIENTE } as Item.Confirmacion?

    /** Tasks typed or dictated while there was no connection. */
    val porEnviar: List<String>
        get() = items.filterIsInstance<Item.Persona>().filter { !it.enviada }.map { it.texto }

    // ---- the person ---------------------------------------------------

    /** The person asked [texto]; [enviada] says whether the task_request went out. */
    fun pedida(texto: String, enviada: Boolean): Conversacion {
        val t = texto.trim()
        if (t.isEmpty()) return this
        return mas(Item.Persona(id("p"), t, enviada)).copy(trabajando = enviada || trabajando)
    }

    /** The tasks kept offline went out after the reconnect. */
    fun enviadas(): Conversacion {
        if (porEnviar.isEmpty()) return this
        return copy(
            items = items.map { if (it is Item.Persona && !it.enviada) it.copy(enviada = true) else it },
            trabajando = true,
        )
    }

    /** The person answered a confirmation card (the result goes out as approval_result). */
    fun respondida(cid: String, ok: Boolean): Conversacion = cerrarConfirmacion(cid, if (ok) Estado.CONFIRMADA else Estado.CANCELADA)

    /** A notice from the phone itself: what the dictation could not do. */
    fun nota(texto: String): Conversacion = mas(Item.Nota(id("n"), texto))

    // ---- the connection -----------------------------------------------

    fun conexion(conectado: Boolean): Conversacion {
        if (this.conectado == conectado) return this
        if (conectado) return copy(conectado = true)
        // The core is gone: the task in progress is lost with it.
        return copy(conectado = false, trabajando = false, items = items.map { if (it is Item.Pasos) it.copy(activo = false) else it })
    }

    // ---- the core's events --------------------------------------------

    /** One message of the events channel (events.schema.json). */
    fun evento(msg: JSONObject): Conversacion = when (msg.optString("type")) {
        "audit" -> msg.optJSONObject("event")?.let(::auditoria) ?: this
        "voice" -> voz(msg)
        "confirm_request" -> confirmacion(msg)
        "approval_result" -> resultado(msg)
        "dictation" -> dictado(msg)
        else -> this // screen, frame: never used here
    }

    private fun auditoria(ev: JSONObject): Conversacion {
        if (ev.optString("session") != session) return this
        val key = "a:" + (ev.optString("hash").ifEmpty { ev.optString("seq") })
        if (key in vistos) return this
        val c = visto(key)
        return when (val e = Progreso.de(ev)) {
            null -> c
            Progreso.Efecto.Tarea -> c.paso(Progreso.Efecto.Paso("Me pongo con ello")).copy(trabajando = true)
            is Progreso.Efecto.Paso -> c.paso(e)
            is Progreso.Efecto.Bloqueo -> c.mas(Item.Bloqueo(c.id("b"), e.motivo, e.titulo, e.texto, e.tono))
        }
    }

    private fun voz(msg: JSONObject): Conversacion {
        val frase = Frase.parse(msg) ?: return this
        if (frase.session != session) return this
        val key = "v:$msg"
        if (key in vistos) return this
        // 8 answers at the end of a task: the work is done.
        return visto(key).cerrarPasos().mas(Item.Ocho(id("o"), frase, null)).copy(trabajando = false)
    }

    private fun confirmacion(msg: JSONObject): Conversacion {
        val r = ConfirmRequest.parse(msg) ?: return this
        if (r.session != session) return this
        val key = "c:${r.fingerprint}"
        if (key in vistos) return this
        // A re-send of the one already on screen is the same card.
        if (items.any { it is Item.Confirmacion && it.request.fingerprint == r.fingerprint }) return visto(key)
        return visto(key).mas(Item.Confirmacion(id("c"), r, Estado.PENDIENTE))
    }

    private fun resultado(msg: JSONObject): Conversacion {
        val cid = msg.optString("id")
        val estado = when {
            msg.optBoolean("ok") -> Estado.CONFIRMADA
            msg.optString("reason") == "caducado" -> Estado.CADUCADA
            else -> Estado.CANCELADA
        }
        return cerrarConfirmacion(cid, estado)
    }

    private fun dictado(msg: JSONObject): Conversacion {
        if (msg.optString("session") != session) return this
        if (msg.has("error")) return this // the notice comes from Tareas.dictation
        val texto = msg.optString("text").trim()
        if (texto.isEmpty()) return this
        // The core queued it already: nothing to send.
        return mas(Item.Persona(id("p"), texto, enviada = true)).copy(trabajando = true)
    }

    // ---- helpers -------------------------------------------------------

    private fun cerrarConfirmacion(cid: String, estado: Estado): Conversacion {
        val i = items.indexOfLast { it is Item.Confirmacion && it.request.id == cid && it.estado == Estado.PENDIENTE }
        if (i < 0) return this
        val card = items[i] as Item.Confirmacion
        return copy(items = items.toMutableList().also { it[i] = card.copy(estado = estado) })
    }

    /** A progress line: into the open group if it is the last item, else a new group. */
    private fun paso(p: Progreso.Efecto.Paso): Conversacion {
        val last = items.lastOrNull()
        if (last is Item.Pasos && last.activo) {
            if (last.lineas.lastOrNull()?.texto == p.texto) return this
            return copy(items = items.dropLast(1) + last.copy(lineas = last.lineas + p))
        }
        return mas(Item.Pasos(id("s"), listOf(p), activo = true))
    }

    private fun cerrarPasos() = copy(items = items.map { if (it is Item.Pasos && it.activo) it.copy(activo = false) else it })

    private fun mas(item: Item) = copy(items = items + item, n = n + 1)

    private fun id(prefijo: String) = "$prefijo$n"

    private fun visto(key: String) = copy(vistos = (vistos + key).takeLast(MAX_VISTOS))

    companion object {
        const val SALUDO_ID = "hola"
        const val SALUDO = "Hola, soy 8. Te ayudo con tus bancos sin ver tus datos: las cifras se quedan en este móvil."
        private const val MAX_VISTOS = 200

        /** Suggestions for the B2C demo. */
        val SUGERENCIAS = listOf(
            "¿Cuánto tengo entre mis bancos?",
            "Pasa 200 € al bróker",
            "¿Qué movimientos tengo esta semana?",
        )
    }
}
