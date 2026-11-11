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
 * task (#47): on a real phone with its on-device recognizer, then
 * `task_request`; on the emulator with the laptop's Whisper (`dictation_start`).
 * The audio never leaves the phone or the laptop.
 */
class MainActivity : Activity() {

    private lateinit var ojos: OjosView
    private lateinit var subtitulo: Subtitulo
    private lateinit var events: EventsClient
    private lateinit var dictador: Dictador

    /**
     * A task dictated on the phone that could not be sent yet (no connection
     * to the core). It goes out as `task_request` when the channel comes back.
     */
    private var tareaLista: String? = null

    /** Who dictates (#47): the phone's on-device recognizer, or the laptop's Whisper. */
    private var via = Via.MOVIL

    /** Waiting for the laptop's `dictation` after a `dictation_start`. */
    private var esperandoPortatil = false
    private val finEspera = Runnable { esperandoPortatil = false }

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
                if (type == "dictation") {
                    // The task in clear: subtitle only, never the eyes' WebView.
                    dictadoDelPortatil(JSONObject(json))
                } else {
                    ojos.evento(json)
                    // What 8 says, with the values rendered on the device (#40).
                    if (type == "voice") Frase.parse(JSONObject(json))?.let(subtitulo::mostrar)
                }
            },
            onConnection = { conectado ->
                ojos.conexion(conectado)
                if (conectado) tareaLista?.let(::enviarTarea)
            },
        )
        via = Tareas.via(BuildConfig.DICTADO, emulador())
        Log.i(TAG_DICTADO, "dictado via ${via.name.lowercase()}")
        dictador = Dictador(
            context = this,
            onParcial = { subtitulo.mostrarTexto(it) },
            onTarea = { tarea ->
                subtitulo.mostrarTexto("«$tarea»")
                enviarTarea(tarea)
            },
            onAviso = { subtitulo.mostrarTexto(it, AVISO_MS) },
            alPortatil = ::dictarEnPortatil,
        )
        val toque = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onSingleTapUp(e: MotionEvent): Boolean {
                dictar()
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

    /**
     * For the emulator: `adb shell am start --activity-single-top -n es.priv8.ocho/.MainActivity --ez dictar true`.
     * `--es dictado movil|portatil` chooses who dictates from then on.
     */
    private fun dictarSiSePide(intent: Intent?) {
        // Debug only: in a release build no other app can make 8 start listening or change who dictates.
        if (!BuildConfig.DEBUG) return
        intent?.getStringExtra(EXTRA_VIA)?.let {
            via = Tareas.via(it, emulador())
            Log.i(TAG_DICTADO, "dictado via ${via.name.lowercase()}")
        }
        if (intent?.getBooleanExtra(EXTRA_DICTAR, false) != true) return
        // Debug only: `--es audio prueba.pcm` reads files/prueba.pcm instead of the microphone.
        val audio = intent.getStringExtra("audio")?.takeIf { BuildConfig.DEBUG }
            ?.let { File(getExternalFilesDir(null), File(it).name) }?.takeIf { it.isFile }
        window.decorView.post { dictar(audio) }
    }

    /** A tap on the eyes: listen (or stop) on the phone, or ask the laptop to listen. */
    private fun dictar(audio: File? = null) {
        when {
            esperandoPortatil -> Unit // the laptop is already listening; it stops on silence
            dictador.escuchando -> dictador.parar()
            via == Via.PORTATIL && audio == null -> {
                if (!dictarEnPortatil()) subtitulo.mostrarTexto("Sin conexión con el portátil. Escribe la tarea.", AVISO_MS)
            }
            else -> dictador.escuchar(audio)
        }
    }

    /** `dictation_start`: the core records the laptop microphone and transcribes it with Whisper, locally. */
    private fun dictarEnPortatil(): Boolean {
        if (!events.send(Tareas.dictationStart(SESSION))) {
            Log.i(TAG_DICTADO, "dictado: no events channel for dictation_start")
            return false
        }
        esperandoPortatil = true
        Log.i(TAG_DICTADO, "dictado: listening on the laptop")
        subtitulo.mostrarTexto("Te escucho…", PORTATIL_MS)
        window.decorView.removeCallbacks(finEspera)
        window.decorView.postDelayed(finEspera, PORTATIL_MS)
        return true
    }

    /** The laptop's answer. The core already queued the task: nothing is sent back. */
    private fun dictadoDelPortatil(msg: JSONObject) {
        val r = Tareas.dictation(msg, SESSION) ?: return
        esperandoPortatil = false
        if (r.tarea != null) {
            Log.i(TAG_DICTADO, "dictado: laptop task (${r.tarea.length} chars)")
            subtitulo.mostrarTexto("«${r.tarea}»")
        } else {
            subtitulo.mostrarTexto(r.aviso ?: return, AVISO_MS)
        }
    }

    /** `task_request` to the core, which tokenizes the task before it reaches the model. */
    private fun enviarTarea(tarea: String) {
        if (events.send(Tareas.taskRequest(SESSION, tarea))) {
            tareaLista = null
            Log.i(TAG_DICTADO, "task sent (${tarea.length} chars)")
        } else {
            tareaLista = tarea
            Log.i(TAG_DICTADO, "task kept until the events channel is back (${tarea.length} chars)")
        }
    }

    private fun emulador() = Tareas.esEmulador(Build.FINGERPRINT, Build.MODEL, Build.PRODUCT, Build.HARDWARE)

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
        const val EXTRA_VIA = "dictado"
        const val AVISO_MS = 4_000L
        /** The laptop listens up to 7 s and Whisper takes a few more. */
        const val PORTATIL_MS = 15_000L
        val SESSION: String = BuildConfig.SESSION
    }
}
