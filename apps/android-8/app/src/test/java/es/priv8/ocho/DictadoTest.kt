package es.priv8.ocho

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DictadoTest {

    @Test fun takesTheFirstHypothesis() =
        assertEquals("¿Cuánto tengo entre mis bancos?", Dictado.tarea(listOf("¿cuánto tengo entre mis bancos?", "cuanto tengo")))

    @Test fun skipsEmptyHypotheses() =
        assertEquals("Pasa 200 € al bróker", Dictado.tarea(listOf("", "  ", "pasa 200 € al bróker")))

    @Test fun tidiesSpaces() =
        assertEquals("Cuánto tengo", Dictado.tarea(listOf("  cuánto    tengo  ")))

    @Test fun nothingUnderstood() {
        assertNull(Dictado.tarea(emptyList()))
        assertNull(Dictado.tarea(listOf("", "…", " ? ")))
    }

    @Test fun cutsALongTask() {
        val t = Dictado.tarea(listOf("palabra ".repeat(100)))!!
        assertEquals(true, t.length <= Dictado.MAX)
        assertEquals(false, t.endsWith(" "))
    }
}
