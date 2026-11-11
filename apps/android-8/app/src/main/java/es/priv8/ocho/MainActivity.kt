package es.priv8.ocho

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.SpeechRecognizer
import android.util.Log
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.widget.FrameLayout
import es.priv8.ocho.confirm.ConfirmActivity
import org.json.JSONObject
import java.io.File

/**
 * App 8: the eyes full screen, moved by the core's events (issue #39).
 * The app screens (conversation, "no puedo") come with the design of issue #36;
 * spoken confirmations are ConfirmActivity. Touching the eyes dictates a
 * task (#47), on the device only.
 */
class MainActivity : Activity() {

    private lateinit var ojos: OjosView
    private lateinit var subtitulo: Subtitulo
    private lateinit var events: EventsClient
    private lateinit var dictador: Dictador

    /**
     * The last dictated task, ready to send. Not sent yet: no message carries
     * a task from the phone to the core (issue #47, contract pending).
     */
    private var tareaLista: String? = null

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
        dictador = Dictador(
            context = this,
            onParcial = { subtitulo.mostrarTexto(it) },
            onTarea = { tarea ->
                tareaLista = tarea
                subtitulo.mostrarTexto("«$tarea»")
                Log.i(TAG_DICTADO, "task ready, not sent: no task message in the contract yet (#47)")
            },
            onAviso = { subtitulo.mostrarTexto(it, AVISO_MS) },
        )
        val toque = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onSingleTapUp(e: MotionEvent): Boolean {
                if (dictador.escuchando) dictador.parar() else dictador.escuchar()
                return false
            }
        })
        // The eyes keep their touches; the tap is only watched.
        ojos.setOnTouchListener { _, e -> toque.onTouchEvent(e); false }
        dictarSiSePide(intent)

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
        // A dictation still listening would compete with the spoken confirmation's recognizer.
        dictador.parar()
        events.stop()
        super.onStop()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        dictarSiSePide(intent)
    }

    /** For the emulator: `adb shell am start --activity-single-top -n es.priv8.ocho/.MainActivity --ez dictar true`. */
    private fun dictarSiSePide(intent: Intent?) {
        // Debug only: in a release build no other app can make 8 start listening.
        if (!BuildConfig.DEBUG || intent?.getBooleanExtra(EXTRA_DICTAR, false) != true) return
        // Debug only: `--es audio prueba.pcm` reads files/prueba.pcm instead of the microphone.
        val audio = intent.getStringExtra("audio")?.takeIf { BuildConfig.DEBUG }
            ?.let { File(getExternalFilesDir(null), File(it).name) }?.takeIf { it.isFile }
        window.decorView.post { dictador.escuchar(audio) }
    }

    override fun onDestroy() {
        dictador.destroy()
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
        const val TAG_DICTADO = "Priv8Dictado"
        const val EXTRA_DICTAR = "dictar"
        const val AVISO_MS = 4_000L
    }
}
