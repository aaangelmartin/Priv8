package es.priv8.ocho

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Task messages of the events channel v1.2 (#47), as in docs/contracts/examples. */
class TareasTest {

    private fun JSONObject.campos(): Map<String, Any> = keys().asSequence().associateWith { get(it) }

    @Test fun emulatorDictatesOnTheLaptop() {
        assertEquals(Via.PORTATIL, Tareas.via("auto", emulador = true))
        assertEquals(Via.MOVIL, Tareas.via("auto", emulador = false))
        assertEquals(Via.MOVIL, Tareas.via(null, emulador = false))
        assertEquals(Via.PORTATIL, Tareas.via("portatil", emulador = false))
        assertEquals(Via.MOVIL, Tareas.via("movil", emulador = true))
    }

    @Test fun recognisesTheEmulator() {
        assertTrue(Tareas.esEmulador("google/sdk_gphone64_arm64/emu64a:14/UE1A/123:userdebug/dev-keys",
            "sdk_gphone64_arm64", "sdk_gphone64_arm64", "ranchu"))
        assertFalse(Tareas.esEmulador("google/husky/husky:14/AP2A/123:user/release-keys",
            "Pixel 8 Pro", "husky", "husky"))
    }

    @Test fun taskRequestAsInTheContract() {
        val m = Tareas.taskRequest("b2c", "¿Cuánto tengo entre mis bancos?")
        assertEquals(mapOf("type" to "task_request", "session" to "b2c", "text" to "¿Cuánto tengo entre mis bancos?"), m.campos())
    }

    @Test fun dictationStartAsInTheContract() =
        assertEquals(mapOf("type" to "dictation_start", "session" to "b2c"), Tareas.dictationStart("b2c").campos())

    @Test fun showsWhatTheLaptopHeard() {
        val r = Tareas.dictation(JSONObject("""{"type":"dictation","session":"b2c","text":"¿cuánto tengo entre mis bancos?"}"""), "b2c")
        assertEquals("¿Cuánto tengo entre mis bancos?", r?.tarea)
        assertNull(r?.aviso)
    }

    @Test fun laptopErrorsBecomeNotices() {
        val sinVoz = Tareas.dictation(JSONObject("""{"type":"dictation","session":"b2c","text":"","error":"sin_voz"}"""), "b2c")!!
        assertNull(sinVoz.tarea)
        assertTrue(sinVoz.aviso!!.startsWith("No te he oído"))
        val off = Tareas.dictation(JSONObject("""{"type":"dictation","session":"b2c","text":"","error":"no_disponible"}"""), "b2c")!!
        assertTrue(off.aviso!!.startsWith("El portátil no puede"))
    }

    @Test fun ignoresOtherSessionsAndMessages() {
        assertNull(Tareas.dictation(JSONObject("""{"type":"dictation","session":"b2b","text":"hola"}"""), "b2c"))
        assertNull(Tareas.dictation(JSONObject("""{"type":"voice","utterance":{}}"""), "b2c"))
    }
}
