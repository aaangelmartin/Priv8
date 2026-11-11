package es.priv8.ocho.chat

import es.priv8.ocho.chat.Progreso.Efecto
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Audit lines to progress lines (#163). They never quote model_saw or detail. */
class ProgresoTest {

    private fun ev(kind: String, vararg f: Pair<String, Any>) =
        JSONObject().put("kind", kind).also { o -> f.forEach { o.put(it.first, it.second) } }

    private fun paso(kind: String, vararg f: Pair<String, Any>) = (Progreso.de(ev(kind, *f)) as Efecto.Paso).texto

    @Test fun namesTheDemoBanks() {
        assertEquals("Banca Alcor", Progreso.app("es.priv8.banks.alcor"))
        assertEquals("Brezo Banco", Progreso.app("brezo-banco"))
        assertEquals("Nimbo Bróker", Progreso.app("es.priv8.banks.nimbo"))
        assertNull(Progreso.app("alba-core"))
    }

    @Test fun readingAScreen() {
        assertEquals("Leyendo el saldo en Banca Alcor", paso("observe_sent", "app" to "es.priv8.banks.alcor", "screen" to "inicio"))
        assertEquals("Leyendo los movimientos en Nimbo Bróker", paso("observe_sent", "app" to "es.priv8.banks.nimbo", "screen" to "movimientos"))
        assertEquals("Preparando la transferencia en Brezo Banco", paso("observe_sent", "app" to "es.priv8.banks.brezo", "screen" to "transferencia"))
        assertEquals("Leyendo la pantalla", paso("observe_sent", "app" to "otra", "screen" to "x"))
    }

    @Test fun actingAndChecking() {
        assertEquals("Abriendo Brezo Banco", paso("act", "model_saw" to "act open_app es.priv8.banks.brezo"))
        assertEquals("Escribiendo los datos", paso("act", "model_saw" to "act type n3 ‹IMPORTE_4›"))
        assertNull(Progreso.de(ev("act", "model_saw" to "act tap n9")))
        assertEquals("Comprobando sin ver la cifra", paso("oracle", "detail" to "tramo 1000-5000"))
        assertEquals("Esperando tu confirmación", paso("held"))
    }

    @Test fun looksAwayWhileThePersonAuthenticates() {
        assertEquals("Pon tu clave o el código. Miro a otro lado", paso("paused", "detail" to "autenticacion"))
        assertEquals("Pon tu huella. Miro a otro lado", paso("paused", "detail" to "dialogo_sistema"))
        assertNull(Progreso.de(ev("paused", "detail" to "confirmacion")))
    }

    @Test fun blocksAreCards() {
        val asesoria = JSONObject(File("../../../docs/contracts/examples/events.audit-asesoria.json").readText()).getJSONObject("event")
        val b = Progreso.de(asesoria) as Efecto.Bloqueo
        assertEquals(Progreso.Tono.AVISO, b.tono)
        assertEquals(Progreso.Tono.BLOQUEO, (Progreso.de(ev("blocked", "reason" to "destino")) as Efecto.Bloqueo).tono)
        assertTrue(Progreso.de(ev("blocked", "reason" to "rojo")) is Efecto.Bloqueo)
        assertTrue(Progreso.de(ev("blocked", "reason" to "sin_regla")) is Efecto.Paso)
        assertNull(Progreso.de(ev("blocked", "reason" to "cancelado"))) // the card says it
    }

    @Test fun neverQuotesWhatTheModelSaw() {
        val secret = "‹IBAN_2-correo› ES91 2100 0418 4502 0005 1332"
        for (kind in listOf("observe_sent", "act", "oracle", "held", "paused", "call", "blocked", "approval")) {
            when (val e = Progreso.de(ev(kind, "model_saw" to secret, "detail" to secret, "reason" to "fuga"))) {
                is Efecto.Paso -> assertTrue(!e.texto.contains("ES91") && !e.texto.contains("‹"))
                is Efecto.Bloqueo -> assertTrue(!e.texto.contains("ES91") && !e.texto.contains("‹"))
                else -> Unit
            }
        }
    }

    @Test fun voiceOutChangesNothing() {
        assertNull(Progreso.de(ev("voice_out")))
        assertTrue(Progreso.de(ev("task")) === Efecto.Tarea)
    }
}
