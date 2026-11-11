package es.priv8.ocho

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NivelTest {
    private val e = 1e-4f

    @Test fun microphoneRmsDbToLevel() {
        assertEquals(0f, Nivel.microfono(-2f), e)
        assertEquals(0f, Nivel.microfono(-10f), e) // below the floor: silence
        assertEquals(0.5f, Nivel.microfono(4f), e)
        assertEquals(1f, Nivel.microfono(10f), e)
        assertEquals(1f, Nivel.microfono(25f), e) // clipped
        assertEquals(0f, Nivel.microfono(Float.NaN), e)
    }

    @Test fun outputDbfsToLevel() {
        assertEquals(0f, Nivel.salidaDbfs(-96f), e) // Visualizer silence (-9600 mB)
        assertEquals(0f, Nivel.salidaDbfs(-50f), e)
        assertEquals(0.5f, Nivel.salidaDbfs(-31f), e)
        assertEquals(1f, Nivel.salidaDbfs(0f), e)
    }

    @Test fun linearRmsToLevel() {
        assertEquals(0f, Nivel.salidaRms(0f), e)
        assertEquals(0f, Nivel.salidaRms(-1f), e)
        assertEquals(0f, Nivel.salidaRms(Float.NaN), e)
        assertEquals(1f, Nivel.salidaRms(1f), e)
        // -31 dBFS is half way.
        assertEquals(0.5f, Nivel.salidaRms(Math.pow(10.0, -31.0 / 20).toFloat()), 1e-3f)
    }

    @Test fun pcm16Rms() {
        assertEquals(0f, Nivel.rmsPcm16(ByteArray(480)), e)
        assertEquals(0f, Nivel.rmsPcm16(ByteArray(1)), e) // no full sample
        // Square wave at +-16384 (little endian): RMS 0.5 of full scale.
        val sq = ByteArray(400) { i -> if (i % 2 == 0) 0x00 else if ((i / 2) % 2 == 0) 0x40 else 0xC0.toByte() }
        assertEquals(0.5f, Nivel.rmsPcm16(sq), e)
        // Only the window asked for: the second half is silence.
        val half = sq.copyOf(800)
        assertEquals(0f, Nivel.rmsPcm16(half, 400, 400), e)
        // Full negative scale.
        val min = ByteArray(4) { i -> if (i % 2 == 0) 0x00 else 0x80.toByte() }
        assertEquals(1f, Nivel.rmsPcm16(min), e)
    }

    @Test fun throttlesTo30HzKeepingThePeak() {
        var now = 0L
        val m = Medidor(intervaloMs = 33) { now }
        assertEquals(0.2f, m.ofrecer(0.2f)!!, e) // first one goes at once
        now = 10; assertNull(m.ofrecer(0.9f))
        now = 20; assertNull(m.ofrecer(0.1f))
        now = 33; assertEquals(0.9f, m.ofrecer(0.3f)!!, e) // the syllable in between is not lost
        now = 66; assertEquals(0.4f, m.ofrecer(0.4f)!!, e)
        now = 70; assertNull(m.ofrecer(2f))
        now = 100; assertEquals(1f, m.ofrecer(0f)!!, e) // clipped to 1
    }

    @Test fun throttleSendsAtMost30PerSecond() {
        var now = 0L
        val m = Medidor { now }
        var sent = 0
        for (t in 0 until 1000 step 5) { now = t.toLong(); if (m.ofrecer(0.5f) != null) sent++ }
        assertTrue("sent $sent", sent in 29..31)
    }

    @Test fun wordEnvelope() {
        val env = Envolvente(caida = 0.5f)
        assertEquals(0f, env.paso(), e)
        env.palabra(8)
        assertEquals(1f, env.paso(), e)
        assertEquals(0.5f, env.paso(), e) // fades between words
        env.palabra(0)
        assertEquals(0.55f, env.paso(), e) // a short word is still audible
        env.reiniciar()
        assertEquals(0f, env.paso(), e)
    }
}
