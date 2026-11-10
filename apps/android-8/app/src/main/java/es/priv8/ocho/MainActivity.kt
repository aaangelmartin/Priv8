package es.priv8.ocho

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.SpeechRecognizer
import android.util.Log
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.widget.FrameLayout
import es.priv8.ocho.confirm.ConfirmActivity
import org.json.JSONObject

/**
 * App 8: the eyes full screen, moved by the core's events (issue #39).
 * The app screens (conversation, "no puedo") come with the design of issue #36;
 * spoken confirmations are ConfirmActivity.
 */
class MainActivity : Activity() {

    private lateinit var ojos: OjosView
    private lateinit var subtitulo: Subtitulo
    private lateinit var events: EventsClient

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        ojos = OjosView(this)
        subtitulo = Subtitulo(this)
        setContentView(
            FrameLayout(this).apply {
                addView(ojos, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
                addView(subtitulo, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM))
            },
        )
        events = EventsClient(
            url = BuildConfig.EVENTS_URL,
            onEvent = { type, json ->
                ojos.evento(json)
                // What 8 says, with the values rendered on the device (#40).
                if (type == "voice") Frase.parse(JSONObject(json))?.let(subtitulo::mostrar)
            },
            onConnection = { ojos.conexion(it) },
        )
        // Spoken confirmations listen for «confirmo» / «cancela». Without the
        // permission the confirmation screen falls back to its buttons.
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
        } else {
            offerSpeechModel()
        }
    }

    override fun onStart() {
        super.onStart()
        events.start()
    }

    override fun onStop() {
        events.stop()
        super.onStop()
    }

    override fun onDestroy() {
        subtitulo.ocultar()
        ojos.destroy()
        super.onDestroy()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        if (requestCode == REQUEST_MIC && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) offerSpeechModel()
    }

    /**
     * Asks the system for the es-ES on-device recognition model, here at
     * setup and not in the middle of a confirmation. The model comes down;
     * no audio goes up. If it is already there, nothing is shown.
     */
    private fun offerSpeechModel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (!SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) return
        val recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
        val intent = ConfirmActivity.recognizerIntent()
        recognizer.checkRecognitionSupport(intent, mainExecutor, object : RecognitionSupportCallback {
            override fun onSupportResult(support: RecognitionSupport) {
                val installed = support.installedOnDeviceLanguages.any { it.equals("es-ES", ignoreCase = true) }
                if (installed) {
                    Log.i(TAG, "speech: es-ES on-device model installed")
                } else {
                    recognizer.triggerModelDownload(intent)
                    Log.i(TAG, "speech: es-ES on-device model missing, download requested")
                }
                window.decorView.postDelayed({ recognizer.destroy() }, 5_000)
            }

            override fun onError(error: Int) {
                Log.i(TAG, "speech: cannot check on-device support (error $error)")
                recognizer.destroy()
            }
        })
    }

    private companion object {
        const val TAG = "Priv8Confirm"
        const val REQUEST_MIC = 1
    }
}
