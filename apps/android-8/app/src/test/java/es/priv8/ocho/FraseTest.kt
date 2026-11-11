package es.priv8.ocho

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File

/** Local renderer (#40) against the v1 contract examples. */
class FraseTest {
    private fun example(name: String) = JSONObject(File("../../../docs/contracts/examples/$name").readText())

    private val suma = Frase.parse(example("events.voice.json"))!!

    @Test fun parsesTheContractExample() {
        assertEquals("u18", suma.utterance)
        assertEquals("s2", suma.session)
        assertEquals(listOf("‹SUMA_1›"), suma.tokens)
    }

    @Test fun rendersTheRealValueOnTheDevice() {
        val r = suma.render { if (it == "‹SUMA_1›") "5.912,30 €" else null }
        assertEquals("Entre tus tres cuentas tienes 5.912,30 €", r.screen)
        assertEquals("Entre tus tres cuentas tienes cinco mil novecientos doce euros con treinta", r.spoken)
        assertEquals(0, r.missing)
    }

    @Test fun withoutTheValueShowsTheTokenNotAGuess() {
        val r = suma.render { null }
        assertEquals("Entre tus tres cuentas tienes ‹SUMA_1›", r.screen)
        assertEquals(1, r.missing)
    }

    @Test fun rejectsATokenForTheCloudVoice() {
        val bad = JSONObject(
            """{"type":"voice","utterance":{"utterance":"u1","session":"s2","segments":[{"voice":"cloud","token":"‹SUMA_1›"}]}}""",
        )
        assertNull(Frase.parse(bad))
    }

    @Test fun rejectsOtherMessagesAndBrokenOnes() {
        assertNull(Frase.parse(example("events.audit.json")))
        assertNull(Frase.parse(JSONObject("""{"type":"voice","utterance":{"utterance":"x","session":"s2","segments":[]}}""")))
        assertNotNull(Frase.parse(JSONObject("""{"type":"voice","utterance":{"utterance":"u2","session":"s2","segments":[{"voice":"local","text":"Hecho"}]}}""")))
    }
}
