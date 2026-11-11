package es.priv8.ocho

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.SpeechRecognizer
import android.util.Log
import es.priv8.ocho.confirm.ConfirmActivity

/**
 * Dictation (issue #47): 8 listens to a task, on the device only. The audio
 * never leaves the phone: only SpeechRecognizer.createOnDeviceSpeechRecognizer,
 * with the same es-ES request as spoken confirmations. Without an on-device
 * recognizer there is no dictation, never a fallback to a cloud one.
 *
 * What is heard is never logged: it may carry data.
 */
class Dictador(
    private val context: Context,
    private val onParcial: (String) -> Unit,
    private val onTarea: (String) -> Unit,
    private val onAviso: (String) -> Unit,
) {
    private var recognizer: SpeechRecognizer? = null
    /** Stopped by the person: the recognizer's error after cancel() is not a failure. */
    private var parado = false
    var escuchando = false
        private set

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

    fun escuchar() {
        if (escuchando) return
        noDisponible()?.let { Log.i(TAG, "dictado off: $it"); onAviso(it); return }
        val rec = recognizer ?: SpeechRecognizer.createOnDeviceSpeechRecognizer(context).also {
            it.setRecognitionListener(listener)
            recognizer = it
        }
        escuchando = true
        parado = false
        Log.i(TAG, "dictado: listening on-device")
        onParcial("Te escucho…")
        rec.startListening(ConfirmActivity.recognizerIntent())
    }

    fun parar() {
        if (!escuchando) return
        escuchando = false
        parado = true
        recognizer?.cancel()
        onAviso("Vale, dejo de escuchar.")
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
        override fun onRmsChanged(rmsdB: Float) {}
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
                onAviso("No te he entendido. Toca a 8 y repítelo.")
            } else {
                Log.i(TAG, "dictado: task ready (${tarea.length} chars)")
                onTarea(tarea)
            }
        }

        override fun onError(error: Int) {
            escuchando = false
            if (parado) return
            Log.i(TAG, "dictado: recognizer error $error")
            onAviso(
                when {
                    error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT ->
                        "No te he oído. Toca a 8 y vuelve a probar."
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
