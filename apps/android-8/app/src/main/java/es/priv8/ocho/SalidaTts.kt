package es.priv8.ocho

import android.content.Context
import android.media.AudioManager
import android.media.audiofx.Visualizer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.util.Log

/**
 * Level of what TextToSpeech is saying, for 8's «hablar» (issue #42).
 *
 * The utterance plays on an audio session of our own
 * ([parametros] -> KEY_PARAM_SESSION_ID), and a [Visualizer] on that session
 * measures its RMS. Visualizer needs RECORD_AUDIO (the app already asks for
 * it for spoken confirmations); it reads only loudness, never the audio.
 * If it cannot be created, or measures nothing (an engine that ignores the
 * session, an emulator without audio), the level comes from an
 * [Envolvente] driven by the words TextToSpeech reports ([palabra]).
 *
 * [enviar] gets one level per frame (about 30 Hz) on the main thread while
 * speaking. All methods are safe from any thread.
 */
class SalidaTts(context: Context, private val enviar: (Float) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private val sesion: Int = context.getSystemService(AudioManager::class.java)
        ?.generateAudioSessionId() ?: AudioManager.ERROR
    private var visualizer: Visualizer? = null
    /** The Visualizer measured real sound in this utterance: the envelope is not needed. */
    private var oido = false
    private var hablando = false
    private val envolvente = Envolvente()
    private val medida = Visualizer.MeasurementPeakRms()

    /** Adds the audio session to the TextToSpeech.speak() params. */
    fun parametros(params: Bundle) {
        if (sesion > 0) params.putInt(TextToSpeech.Engine.KEY_PARAM_SESSION_ID, sesion)
    }

    /** UtteranceProgressListener.onStart. */
    fun inicio() {
        main.post {
            if (hablando) return@post
            hablando = true
            oido = false
            envolvente.reiniciar()
            abrir()
            main.removeCallbacks(tick)
            main.post(tick)
        }
    }

    /** UtteranceProgressListener.onRangeStart: a word of [start, end) characters. */
    fun palabra(start: Int, end: Int) {
        main.post { if (hablando) envolvente.palabra(end - start) }
    }

    /** onDone, onError, onStop or tts.stop(). */
    fun fin() {
        main.post {
            hablando = false
            main.removeCallbacks(tick)
            cerrar()
            enviar(0f)
        }
    }

    private val tick = object : Runnable {
        override fun run() {
            if (!hablando) return
            val medido = medir()
            if (medido != null && medido > 0f) oido = true
            val nivel = if (oido) medido ?: 0f else maxOf(medido ?: 0f, envolvente.paso())
            enviar(nivel)
            main.postDelayed(this, FRAME_MS)
        }
    }

    private fun abrir() {
        if (visualizer != null || sesion <= 0) return
        visualizer = try {
            Visualizer(sesion).apply {
                measurementMode = Visualizer.MEASUREMENT_MODE_PEAK_RMS
                enabled = true
            }
        } catch (e: RuntimeException) {
            // No RECORD_AUDIO, or no Visualizer on this device: the envelope stays.
            Log.i(TAG, "tts level: no Visualizer (${e.javaClass.simpleName}), word envelope instead")
            null
        }
    }

    private fun medir(): Float? {
        val v = visualizer ?: return null
        return try {
            if (v.getMeasurementPeakRms(medida) == Visualizer.SUCCESS) Nivel.salidaDbfs(medida.mRms / 100f) else null
        } catch (e: IllegalStateException) {
            null
        }
    }

    private fun cerrar() {
        visualizer?.let { runCatching { it.enabled = false; it.release() } }
        visualizer = null
    }

    private companion object {
        const val TAG = "Priv8Voz"
        const val FRAME_MS = 33L
    }
}
