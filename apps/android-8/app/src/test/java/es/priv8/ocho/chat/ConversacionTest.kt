package es.priv8.ocho.chat

import es.priv8.ocho.chat.Conversacion.Estado
import es.priv8.ocho.chat.Conversacion.Fase
import es.priv8.ocho.chat.Conversacion.Item
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The conversation of app 8 (#163): the reducer, against the contract examples. */
class ConversacionTest {

    private fun example(name: String) = JSONObject(File("../../../docs/contracts/examples/$name").readText())

    /** The examples use session s2; the app's is b2c. */
    private fun enSesion(msg: JSONObject, s: String = "b2c"): JSONObject {
        msg.optJSONObject("event")?.put("session", s)
        msg.optJSONObject("utterance")?.put("session", s)
        if (msg.has("session")) msg.put("session", s)
        return msg
    }

    private var seq = 0
    private fun audit(kind: String, session: String = "b2c", vararg extra: Pair<String, Any>): JSONObject {
        val ev = JSONObject().put("kind", kind).put("session", session).put("seq", seq).put("hash", "sha256:h${seq++}")
        extra.forEach { ev.put(it.first, it.second) }
        return JSONObject().put("type", "audit").put("event", ev)
    }

    private val inicio = Conversacion("b2c").conexion(true)

    private fun Conversacion.pasos() = items.filterIsInstance<Item.Pasos>()
    private fun Conversacion.lineas() = pasos().flatMap { it.lineas.map { l -> l.texto } }

    @Test fun startsIdleWithTheGreeting() {
        val c = Conversacion("b2c")
        assertEquals(Fase.REPOSO, c.fase)
        assertEquals(Conversacion.SALUDO, (c.items.single() as Item.Ocho).texto)
        assertEquals(3, Conversacion.SUGERENCIAS.size)
    }

    @Test fun aTypedTaskIsThePersonsBubbleAndStartsTheWork() {
        val c = inicio.pedida("  ¿Cuánto tengo entre mis bancos?  ", enviada = true)
        val p = c.items.last() as Item.Persona
        assertEquals("¿Cuánto tengo entre mis bancos?", p.texto)
        assertTrue(p.enviada)
        assertEquals(Fase.TRABAJANDO, c.fase)
        assertSame(inicio, inicio.pedida("   ", enviada = true))
    }

    @Test fun offlineTasksWaitAndGoOutOnReconnect() {
        val c = Conversacion("b2c").conexion(false).pedida("Pasa 200 € al bróker", enviada = false)
        assertEquals(Fase.SIN_CONEXION, c.fase)
        assertEquals(listOf("Pasa 200 € al bróker"), c.porEnviar)
        val d = c.conexion(true).enviadas()
        assertTrue(d.porEnviar.isEmpty())
        assertEquals(Fase.TRABAJANDO, d.fase)
    }

    @Test fun progressLinesFromTheAuditGroupedAndDeduplicated() {
        var c = inicio.pedida("¿Cuánto tengo entre mis bancos?", enviada = true)
        c = c.evento(audit("task"))
        c = c.evento(audit("act", extra = arrayOf("model_saw" to "act open_app es.priv8.banks.brezo")))
        c = c.evento(audit("observe_sent", extra = arrayOf("app" to "es.priv8.banks.brezo", "screen" to "inicio")))
        c = c.evento(audit("observe_sent", extra = arrayOf("app" to "es.priv8.banks.brezo", "screen" to "inicio")))
        c = c.evento(audit("act", extra = arrayOf("model_saw" to "act tap n4")))
        c = c.evento(audit("oracle"))
        assertEquals(1, c.pasos().size)
        assertEquals(
            listOf("Me pongo con ello", "Abriendo Brezo Banco", "Leyendo el saldo en Brezo Banco", "Comprobando sin ver la cifra"),
            c.lineas(),
        )
        assertEquals("Comprobando sin ver la cifra", c.ultimoPaso)
        assertEquals(Fase.TRABAJANDO, c.fase)
    }

    @Test fun theSameAuditLineTwiceIsAppliedOnce() {
        val line = audit("oracle")
        val c = inicio.evento(line)
        assertSame(c, c.evento(JSONObject(line.toString())))
    }

    @Test fun eventsOfAnotherSessionAreIgnored() {
        val b2b = audit("observe_sent", session = "s1", "app" to "alba-core", "screen" to "factura.alta")
        assertSame(inicio, inicio.evento(b2b))
        assertSame(inicio, inicio.evento(example("events.voice.json"))) // session s2
    }

    @Test fun eightsAnswerEndsTheTask() {
        var c = inicio.pedida("¿Cuánto tengo entre mis bancos?", enviada = true).evento(audit("oracle"))
        c = c.evento(enSesion(example("events.voice.json")))
        val o = c.items.last() as Item.Ocho
        assertEquals(listOf("‹SUMA_1›"), o.frase!!.tokens) // tokens only: the value is drawn on the phone
        assertFalse(c.pasos().single().activo)
        assertNull(c.ultimoPaso)
        assertEquals(Fase.LISTO, c.fase)
        assertSame(c, c.evento(enSesion(example("events.voice.json"))))
    }

    @Test fun aProgressLineAfterAnAnswerStartsANewGroup() {
        var c = inicio.evento(audit("oracle")).evento(enSesion(example("events.voice.json")))
        c = c.evento(audit("paused", extra = arrayOf("detail" to "autenticacion")))
        assertEquals(2, c.pasos().size)
        assertTrue(c.pasos().last().activo)
        assertEquals(Fase.TRABAJANDO, c.fase)
    }

    @Test fun confirmationCardWaitsAndClosesWithTheResult() {
        var c = inicio.evento(audit("held", extra = arrayOf("confirm" to "c3")))
        c = c.evento(enSesion(example("events.confirm-request.json")))
        val card = c.items.last() as Item.Confirmacion
        assertEquals("c3", card.request.id)
        assertEquals(Estado.PENDIENTE, card.estado)
        assertEquals(Fase.ESPERANDO, c.fase)
        assertEquals("Esperando tu confirmación", c.lineas().last())
        // The core re-sends it after a reconnect: still one card.
        assertEquals(c.items.size, c.evento(enSesion(example("events.confirm-request.json"))).items.size)

        val ok = c.evento(example("confirm.approval-ok.json").put("id", "c3"))
        assertEquals(Estado.CONFIRMADA, (ok.items.last() as Item.Confirmacion).estado)
        assertEquals(Fase.TRABAJANDO, ok.copy(trabajando = true).fase)

        val caducada = c.evento(example("confirm.approval-caducado.json").put("id", "c3"))
        assertEquals(Estado.CADUCADA, (caducada.items.last() as Item.Confirmacion).estado)
    }

    @Test fun theCardAnsweredOnThePhone() {
        val c = inicio.evento(enSesion(example("events.confirm-request.json")))
        assertEquals(Estado.CANCELADA, (c.respondida("c3", ok = false).items.last() as Item.Confirmacion).estado)
        assertEquals(Estado.CONFIRMADA, (c.respondida("c3", ok = true).items.last() as Item.Confirmacion).estado)
        assertSame(c, c.respondida("c9", ok = true))
    }

    @Test fun adviceRefusalIsACardAndItsSentence() {
        var c = inicio.pedida("¿En qué fondo invierto?", enviada = true)
        c = c.evento(enSesion(example("events.audit-asesoria.json")))
        val b = c.items.last() as Item.Bloqueo
        assertEquals("asesoria", b.motivo)
        assertEquals("No puedo asesorarte", b.titulo)
        c = c.evento(enSesion(example("events.voice-no-puedo.json")))
        assertEquals(Fase.LISTO, c.fase)
    }

    @Test fun laptopDictationIsThePersonsBubble() {
        val c = inicio.evento(enSesion(example("events.dictation.json")))
        val p = c.items.last() as Item.Persona
        assertTrue(p.enviada)
        assertEquals(Fase.TRABAJANDO, c.fase)
        assertSame(inicio, inicio.evento(enSesion(example("events.dictation-sin-voz.json"))))
    }

    @Test fun losingTheCoreStopsTheWorkCalmly() {
        val c = inicio.pedida("Pasa 200 € al bróker", enviada = true).evento(audit("task")).conexion(false)
        assertEquals(Fase.SIN_CONEXION, c.fase)
        assertFalse(c.trabajando)
        assertFalse(c.pasos().single().activo)
        assertEquals(Fase.REPOSO, Conversacion("b2c").conexion(false).conexion(true).fase)
    }

    @Test fun aNoteFromThePhone() {
        val c = inicio.nota("No te he oído. Vuelve a probar o escríbelo.")
        assertEquals("No te he oído. Vuelve a probar o escríbelo.", (c.items.last() as Item.Nota).texto)
    }

    @Test fun itemIdsAreUnique() {
        var c = inicio
        repeat(3) { c = c.pedida("Hola $it", enviada = true).evento(audit("task")).evento(audit("blocked", extra = arrayOf("reason" to "rojo"))) }
        assertEquals(c.items.size, c.items.map { it.id }.toSet().size)
    }
}
