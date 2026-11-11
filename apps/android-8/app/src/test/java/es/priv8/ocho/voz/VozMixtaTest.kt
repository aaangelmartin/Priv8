package es.priv8.ocho.voz

import es.priv8.ocho.Frase
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/** What 8 says for a `voice` message: the token rendered and spelled out on the device. */
class VozMixtaTest {
    private fun example(name: String) = JSONObject(File("../../../docs/contracts/examples/$name").readText())

    private val suma = Frase.parse(example("events.voice.json"))!!

    @Test fun readsTheSentenceAndSpellsTheValueLocally() {
        val (segments, missing) = VozMixta.segmentos(suma) { if (it == "‹SUMA_1›") "15.462,58 €" else null }
        assertEquals(0, missing)
        assertEquals(
            listOf("Entre tus tres cuentas tienes", "quince mil cuatrocientos sesenta y dos euros con cincuenta y ocho"),
            segments.map { it.text },
        )
        assertEquals(listOf(Voice.LOCAL, Voice.LOCAL), segments.map { it.voice })
    }

    @Test fun aTokenWithoutValueIsNotSpoken() {
        val (segments, missing) = VozMixta.segmentos(suma) { null }
        assertEquals(1, missing)
        assertEquals(listOf("Entre tus tres cuentas tienes"), segments.map { it.text })
    }

    @Test fun aFixedSentenceIsReadAsIs() {
        val frase = Frase.parse(
            JSONObject(
                """{"type":"voice","utterance":{"utterance":"u2","session":"b2c","segments":[""" +
                    """{"voice":"cloud","text":"Eso sería asesorarte y no puedo hacerlo."}]}}""",
            ),
        )!!
        val (segments, missing) = VozMixta.segmentos(frase) { null }
        assertEquals(0, missing)
        assertEquals(listOf("Eso sería asesorarte y no puedo hacerlo."), segments.map { it.text })
    }
}
