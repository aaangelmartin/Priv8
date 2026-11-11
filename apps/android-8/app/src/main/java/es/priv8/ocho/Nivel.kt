package es.priv8.ocho

import kotlin.math.log10
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Voice level for 8's eyes (issue #42), from 0 (silence) to 1 (loud), so
 * «escuchar» follows the microphone and «hablar» the audio output. Pure
 * functions: no Android, unit-tested. Levels carry no content, only loudness.
 */
object Nivel {
    /** SpeechRecognizer.onRmsChanged: about -2 dB in silence, about 10 dB for loud speech. */
    const val MIC_SUELO_DB = -2f
    const val MIC_TECHO_DB = 10f

    /** Audio output in dBFS: below the floor is silence, at the ceiling a full syllable. */
    const val SALIDA_SUELO_DBFS = -50f
    const val SALIDA_TECHO_DBFS = -12f

    fun microfono(rmsdB: Float): Float = escala(rmsdB, MIC_SUELO_DB, MIC_TECHO_DB)

    fun salidaDbfs(dbfs: Float): Float = escala(dbfs, SALIDA_SUELO_DBFS, SALIDA_TECHO_DBFS)

    /** Linear RMS (1 = full scale) to the 0..1 level. */
    fun salidaRms(rms: Float): Float = if (rms.isNaN() || rms <= 0f) 0f else salidaDbfs(20f * log10(rms))

    /** Linear RMS (1 = full scale) of 16-bit little-endian mono PCM, [size] bytes from [offset]. */
    fun rmsPcm16(pcm: ByteArray, offset: Int = 0, size: Int = pcm.size - offset): Float {
        val n = size / 2
        if (n <= 0) return 0f
        var sum = 0.0
        var i = offset
        repeat(n) {
            val s = ((pcm[i + 1].toInt() shl 8) or (pcm[i].toInt() and 0xFF)).toShort().toInt()
            sum += s.toDouble() * s
            i += 2
        }
        return (sqrt(sum / n) / 32768.0).toFloat()
    }

    private fun escala(v: Float, suelo: Float, techo: Float): Float {
        if (v.isNaN()) return 0f
        return ((v - suelo) / (techo - suelo)).coerceIn(0f, 1f)
    }
}

/**
 * At most one level every [intervaloMs] (30 Hz by default), and the loudest
 * one seen in between, so a short syllable is not lost. Thread-safe.
 */
class Medidor(private val intervaloMs: Long = 33, private val reloj: () -> Long) {
    private var ultimo = Long.MIN_VALUE
    private var pico = 0f

    /** The level to send now, or null to wait. */
    @Synchronized fun ofrecer(nivel: Float): Float? {
        pico = maxOf(pico, nivel.coerceIn(0f, 1f))
        val ahora = reloj()
        if (ultimo != Long.MIN_VALUE && ahora - ultimo < intervaloMs) return null
        ultimo = ahora
        return pico.also { pico = 0f }
    }
}

/**
 * Speech envelope when the real output cannot be measured: each word
 * (TextToSpeech onRangeStart) is a pulse, louder for longer words, that
 * fades between words. Call [paso] once per frame (about 30 Hz).
 */
class Envolvente(private val caida: Float = 0.8f) {
    private var nivel = 0f

    fun palabra(letras: Int) {
        nivel = maxOf(nivel, 0.55f + 0.45f * min(1f, letras / 8f))
    }

    fun paso(): Float = nivel.also { nivel *= caida }

    fun reiniciar() { nivel = 0f }
}
