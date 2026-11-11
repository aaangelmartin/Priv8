package es.priv8.ocho

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import es.priv8.ocho.confirm.ConfirmActivity
import java.io.File

/**
 * Dictation (issue #47): 8 listens to a task, on the device only. The audio
 * never leaves the phone: only SpeechRecognizer.createOnDeviceSpeechRecognizer,
 * with the same es-ES request as spoken confirmations. Without an on-device
 * recognizer the laptop dictates with local Whisper ([alPortatil]), never a
 * cloud recognizer.
 *
 * What is heard is never logged: it may carry data.
 */
class Dictador(
    private val context: Context,
    private val onParcial: (String) -> Unit,
    private val onTarea: (String) -> Unit,
    private val onAviso: (String) -> Unit,
    /**
     * The phone cannot recognise speech (no on-device recognizer, no es-ES,
     * recognizer error): hand the dictation to the laptop's Whisper (#47).
     * True if the laptop took it; false shows the notice instead.
     */
    private val alPortatil: () -> Boolean = { false },
    /** Microphone level while listening (SpeechRecognizer rmsdB), for 8's eyes (#42). */
    private val onNivel: (Float) -> Unit = {},
    /** Listening started or ended, for the microphone button. */
    private val onEscuchando: (Boolean) -> Unit = {},
) {
    private var recognizer: SpeechRecognizer? = null
    /** Stopped by the person: the recognizer's error after cancel() is not a failure. */
    private var parado = false
    var escuchando = false
        private set(v) {
            if (field != v) { field = v; onEscuchando(v) }
        }

    /** Why 8 cannot listen on this device, or null if it can. */
    fun noDisponible(): String? {
        if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            return "Sin permiso de micrófono."
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || !SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
            return "Este móvil no reconoce la voz sin red. Escribe la tarea."
        }
        return null
    }

    fun escuchar(audio: File? = null) {
        if (escuchando) return
        noDisponible()?.let {
            Log.i(TAG, "dictado off on the phone: $it")
            if (!alPortatil()) onAviso(it)
            return
        }
        // A fresh recognizer for every task: the recognition service can restart
        // between two taps, and a reused one then fails with ERROR_CLIENT forever.
        recognizer?.destroy()
        val rec = SpeechRecognizer.createOnDeviceSpeechRecognizer(context).also {
            it.setRecognitionListener(listener)
            recognizer = it
        }
        escuchando = true
        parado = false
        Log.i(TAG, "dictado: listening on-device")
        val intent = ConfirmActivity.recognizerIntent()
        if (audio != null && BuildConfig.DEBUG && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Debug only: raw PCM 16-bit 16 kHz mono instead of the microphone,
            // to tell a bad emulator microphone from a bad recognizer.
            // Through a pipe: the recognition service may not open app files itself.
            val (leer, escribir) = ParcelFileDescriptor.createPipe()
            Thread {
                try {
                    val n = ParcelFileDescriptor.AutoCloseOutputStream(escribir).use { out -> audio.inputStream().use { inp ->
                        // At the pace of a microphone: 100 ms of 16 kHz 16-bit mono at a time.
                        val buf = ByteArray(3_200); var total = 0L
                        while (true) { val r = inp.read(buf); if (r < 0) break; out.write(buf, 0, r); total += r; Thread.sleep(100) }
                        total
                    } }
                    Log.i(TAG, "dictado: debug audio sent ($n bytes)")
                } catch (e: java.io.IOException) {
                    Log.i(TAG, "dictado: debug audio failed: ${e.javaClass.simpleName}")
                }
            }.start()
            intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, leer)
                .putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING, android.media.AudioFormat.ENCODING_PCM_16BIT)
                .putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE, 16_000)
                .putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT, 1)
            Log.i(TAG, "dictado: debug audio from a file")
        }
        rec.startListening(intent)
    }

    fun parar() {
        if (!escuchando) return
        escuchando = false
        parado = true
        recognizer?.cancel()
    }

    fun destroy() {
        escuchando = false
        recognizer?.destroy()
        recognizer = null
    }

    private fun hipotesis(b: Bundle?) = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) = onNivel(rmsdB)
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}

        override fun onPartialResults(partialResults: Bundle?) {
            Dictado.tarea(hipotesis(partialResults))?.let(onParcial)
        }

        override fun onResults(results: Bundle?) {
            escuchando = false
            val tarea = Dictado.tarea(hipotesis(results))
            if (tarea == null) {
                Log.i(TAG, "dictado: nothing understood")
                onAviso("No te he entendido. Vuelve a probar o escríbelo.")
            } else {
                Log.i(TAG, "dictado: task ready (${tarea.length} chars)")
                onTarea(tarea)
            }
        }

        override fun onError(error: Int) {
            escuchando = false
            if (parado) return
            Log.i(TAG, "dictado: recognizer error $error")
            val noOido = error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
            // The phone cannot recognise (not "it heard nothing"): the laptop's Whisper takes over.
            if (!noOido && alPortatil()) return
            onAviso(
                when {
                    error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT ->
                        "No te he oído. Vuelve a probar o escríbelo."
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                        (error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE || error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED) ->
                        "Falta el reconocimiento de voz en español en el móvil."
                    else -> "No puedo escucharte ahora. Escribe la tarea."
                },
            )
        }
    }

    private companion object {
        const val TAG = "Priv8Dictado"
    }
}
