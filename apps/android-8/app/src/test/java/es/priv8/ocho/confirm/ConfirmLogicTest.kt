package es.priv8.ocho.confirm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VerbalizerTest {
    @Test fun amounts() {
        assertEquals("doscientos euros", Verbalizer.amount("200,00 €"))
        assertEquals("doscientos euros", Verbalizer.amount("200.00"))
        assertEquals("mil doscientos treinta y cuatro euros con cincuenta y seis", Verbalizer.amount("1.234,56 €"))
        assertEquals("veintiún euros", Verbalizer.amount("21 €"))
        assertEquals("un euro", Verbalizer.amount("1"))
        assertEquals("cincuenta céntimos", Verbalizer.amount("0,50 €"))
        assertEquals("un millón de euros", Verbalizer.amount("1.000.000 €"))
        assertEquals("menos cien euros", Verbalizer.amount("-100 €"))
        assertEquals("tres mil cuatrocientos doce euros con cincuenta y ocho", Verbalizer.amount("3.412,58 €"))
    }

    @Test fun sayAs() {
        assertEquals("E S nueve uno, dos uno cero cero", Verbalizer.say("ES91 2100", "iban"))
        assertEquals("Nimbo Bróker", Verbalizer.say("Nimbo Bróker", "name"))
        // Not an amount: read as it is rather than failing.
        assertEquals("abc", Verbalizer.say("abc", "currency"))
    }
}

class RendererTest {
    private val summary = listOf(
        Segment("local", null, "‹IMPORTE_1›", "currency"),
        Segment("cloud", "a tu cuenta de", null, null),
        Segment("local", null, "‹PROVEEDOR_1·propio›", "name"),
        Segment("cloud", "¿Lo confirmas?", null, null),
    )

    @Test fun rendersScreenAndSpeech() {
        val values = mapOf("‹IMPORTE_1›" to "200,00 €", "‹PROVEEDOR_1·propio›" to "Nimbo Bróker")
        val r = Renderer.render(summary) { values[it] }
        assertEquals("200,00 € a tu cuenta de Nimbo Bróker. ¿Lo confirmas?", r.screen)
        assertEquals("Doscientos euros a tu cuenta de Nimbo Bróker. ¿Lo confirmas?", r.spoken)
        assertEquals(0, r.missing)
    }

    @Test fun fullStopAfterAValueIsKept() {
        // core.say: «Entre tus tres bancos tienes ‹SUMA_1›. Te he preparado…» comes as three segments.
        val said = listOf(
            Segment("cloud", "Entre tus tres bancos tienes", null, null),
            Segment("local", null, "‹SUMA_1›", "currency"),
            Segment("cloud", "Te he preparado la transferencia.", null, null),
        )
        val r = Renderer.render(said) { "17.977,98 €" }
        assertEquals("Entre tus tres bancos tienes 17.977,98 €. Te he preparado la transferencia.", r.screen)
        // Lowercase after a value continues the sentence.
        assertEquals("200,00 € a tu cuenta de Nimbo Bróker. ¿Lo confirmas?",
            Renderer.render(summary) { mapOf("‹IMPORTE_1›" to "200,00 €", "‹PROVEEDOR_1·propio›" to "Nimbo Bróker")[it] }.screen)
    }

    @Test fun missingValueIsCounted() {
        val r = Renderer.render(summary) { null }
        assertEquals(2, r.missing)
        assertEquals("‹IMPORTE_1› a tu cuenta de ‹PROVEEDOR_1·propio›. ¿Lo confirmas?", r.screen)
    }
}

class VoiceAnswerTest {
    @Test fun classifies() {
        assertEquals(VoiceAnswer.Answer.CONFIRM, VoiceAnswer.classify(listOf("Confirmo")))
        assertEquals(VoiceAnswer.Answer.CONFIRM, VoiceAnswer.classify(listOf("sí, confírmalo")))
        assertEquals(VoiceAnswer.Answer.CANCEL, VoiceAnswer.classify(listOf("cancela")))
        assertEquals(VoiceAnswer.Answer.CANCEL, VoiceAnswer.classify(listOf("no confirmo")))
        assertEquals(VoiceAnswer.Answer.CANCEL, VoiceAnswer.classify(listOf("No")))
        assertNull(VoiceAnswer.classify(listOf("¿cuánto era?")))
        assertNull(VoiceAnswer.classify(emptyList()))
    }
}
