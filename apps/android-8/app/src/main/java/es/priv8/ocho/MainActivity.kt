package es.priv8.ocho

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.SpeechRecognizer
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.Log
import android.util.TypedValue
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import es.priv8.ocho.chat.ChatView
import es.priv8.ocho.chat.Conversacion
import es.priv8.ocho.chat.Marca
import es.priv8.ocho.confirm.ConfirmActivity
import es.priv8.ocho.confirm.ConfirmFlow
import es.priv8.ocho.voz.VozMixta
import org.json.JSONObject
import java.io.File

/**
 * App 8 (#163): an assistant you can talk or write to. 8's eyes as a compact
 * header that still reacts to the core's events (#39), the conversation under
 * it ([ChatView]) and a composer with a text field, send and the microphone.
 *
 * - Typed, dictated or suggested tasks go to the core as `task_request` on
 *   the events channel; the core tokenizes them before they reach the model.
 *   Dictation (#47): on a real phone the on-device recognizer, on the
 *   emulator the laptop's Whisper (`dictation_start`). The audio never leaves
 *   the phone or the laptop.
 * - 8's answers (`voice`) are drawn with the real values put in on the
 *   phone and are still spoken by the accessibility service (mixed voice).
 * - Confirmations: ConfirmActivity still asks out loud, and the request is
 *   also a card in the conversation with Confirmar and Cancelar.
 * The events channel stays open while the app is in the background, so the
 * conversation records what 8 does in the banks.
 */
class MainActivity : Activity() {

    private lateinit var ojos: OjosView
    private lateinit var chat: ChatView
    private lateinit var estado: TextView
    private lateinit var aviso: TextView
    private lateinit var sugerencias: View
    private lateinit var campo: EditText
    private lateinit var micro: ImageButton
    private lateinit var enviar: ImageButton
    private lateinit var events: EventsClient
    private lateinit var dictador: Dictador

    private var conv: Conversacion
        get() = guardada ?: Conversacion(SESSION).also { guardada = it }
        set(v) { guardada = v; pintar() }

    /** Who dictates (#47): the phone's on-device recognizer, or the laptop's Whisper. */
    private var via = Via.MOVIL

    /** Waiting for the laptop's `dictation` after a `dictation_start`. */
    private var esperandoPortatil = false
        set(v) { field = v; pintar() }
    private val finEspera = Runnable { esperandoPortatil = false }

    /** A short notice in the header (dictation, a send that failed), in place of the phase. */
    private var avisoBreve: String? = null
    private val finAviso = Runnable { avisoBreve = null; pintar() }

    private var empezado = false

    private val alResultado: (JSONObject) -> Unit = { result -> conv = conv.evento(result) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(construir())
        events = EventsClient(
            url = BuildConfig.EVENTS_URL,
            onEvent = { type, json ->
                val msg = JSONObject(json)
                // The task in clear (laptop dictation) goes to the conversation only, never to the eyes' WebView.
                if (type == "dictation") dictadoDelPortatil(msg) else ojos.evento(json)
                conv = conv.evento(msg)
            },
            onConnection = { conectado ->
                ojos.conexion(conectado)
                conv = conv.conexion(conectado)
                if (conectado) enviarPendientes()
            },
        )
        via = Tareas.via(BuildConfig.DICTADO, emulador())
        Log.i(TAG_DICTADO, "dictado via ${via.name.lowercase()}")
        dictador = Dictador(
            context = this,
            onParcial = { if (dictador.escuchando) { campo.setText(it); campo.setSelection(campo.length()) } },
            onTarea = { tarea ->
                campo.setText("")
                pedir(tarea)
            },
            onAviso = { conv = conv.nota(it) },
            alPortatil = ::dictarEnPortatil,
            onNivel = { ojos.microfono(it) },
            onEscuchando = { pintar() },
        )
        val toque = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onSingleTapUp(e: MotionEvent): Boolean {
                dictar()
                return false
            }
        })
        // The eyes keep their touches; the tap is only watched. Tapping 8 still dictates.
        ojos.setOnTouchListener { _, e -> toque.onTouchEvent(e); false }
        // An answer given on ConfirmActivity (voice or buttons) closes the card too.
        ConfirmFlow.onResult = alResultado
        pintar()
        porIntent(intent)

        // Spoken confirmations and dictation listen on the device. Without the
        // permission the confirmation falls back to its buttons and the card.
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
        } else {
            offerSpeechModel()
        }
    }

    override fun onStart() {
        super.onStart()
        if (!empezado) {
            empezado = true
            events.start()
        } else {
            // Back in front (the bridge brings the app up before 8 speaks): a fresh subscriber.
            events.refresh()
        }
        // «hablar» follows the level of what 8 says (#42), played by the service.
        VozMixta.ojos = { nivel -> ojos.voz(nivel) }
    }

    override fun onStop() {
        // A dictation still listening would compete with the spoken confirmation's recognizer.
        dictador.parar()
        VozMixta.ojos = null
        super.onStop()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        porIntent(intent)
    }

    override fun onDestroy() {
        if (ConfirmFlow.onResult === alResultado) ConfirmFlow.onResult = null
        events.stop()
        dictador.destroy()
        chat.destroy()
        ojos.destroy()
        window.decorView.removeCallbacks(finEspera)
        window.decorView.removeCallbacks(finAviso)
        super.onDestroy()
    }

    // ---- layout --------------------------------------------------------

    private fun construir(): View {
        val sora = try {
            val t = Typeface.createFromAsset(assets, "ocho/fonts/Sora.ttf")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) Typeface.create(t, 600, false) else t
        } catch (e: RuntimeException) {
            Typeface.DEFAULT_BOLD
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Marca.NIEBLA)
        }

        // Header: 8's eyes, compact, and what 8 is doing.
        val cabecera = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Marca.COBALTO)
            setPadding(0, dp(4), 0, dp(14))
        }
        ojos = OjosView(this).apply {
            // Decorative for TalkBack: the microphone button does the same.
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        }
        cabecera.addView(ojos, LinearLayout.LayoutParams(MATCH_PARENT, dp(OJOS_DP)))
        estado = TextView(this).apply {
            typeface = sora
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(dp(20), 0, dp(20), 0)
            maxLines = 2
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        cabecera.addView(estado, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        root.addView(cabecera, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        aviso = TextView(this).apply {
            text = "Sin conexión con Priv8 en el portátil. Lo vuelvo a intentar solo; lo que escribas sale al volver."
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setTextColor(Marca.AVISO_TEXTO)
            setBackgroundColor(Marca.AVISO_SUAVE)
            setPadding(dp(16), dp(10), dp(16), dp(10))
            visibility = View.GONE
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        root.addView(aviso, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        chat = ChatView(this, ::responder)
        root.addView(chat, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))

        // Suggestions for the B2C demo.
        val chips = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(12), dp(4), dp(12), dp(8))
        }
        Conversacion.SUGERENCIAS.forEach { s ->
            chips.addView(Button(this).apply {
                text = s
                isAllCaps = false
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                setTextColor(Marca.COBALTO)
                stateListAnimator = null
                minHeight = dp(48)
                minimumHeight = dp(48)
                setPadding(dp(16), 0, dp(16), 0)
                background = GradientDrawable().apply {
                    cornerRadius = dp(999).toFloat()
                    setColor(Color.WHITE)
                    setStroke(dp(1), Marca.LINEA)
                }
                contentDescription = "Sugerencia: $s"
                setOnClickListener { pedir(s) }
            }, LinearLayout.LayoutParams(WRAP_CONTENT, dp(48)).apply { rightMargin = dp(8) })
        }
        sugerencias = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(chips)
        }
        root.addView(sugerencias, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        // Composer: text field, microphone and send.
        val composer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.WHITE)
            setPadding(dp(12), dp(10), dp(12), dp(12))
        }
        campo = EditText(this).apply {
            hint = "Escribe a 8"
            setHintTextColor(Marca.PIZARRA)
            setTextColor(Marca.NOCHE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            // What the person writes may carry data: the keyboard must not learn it.
            imeOptions = EditorInfo.IME_ACTION_SEND or EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
            maxLines = 4
            setHorizontallyScrolling(false)
            minHeight = dp(52)
            setPadding(dp(18), dp(10), dp(18), dp(10))
            background = GradientDrawable().apply {
                cornerRadius = dp(26).toFloat()
                setColor(Marca.NIEBLA)
            }
            contentDescription = "Escribe a 8"
            setOnEditorActionListener { _, action, _ ->
                if (action == EditorInfo.IME_ACTION_SEND) { enviarCampo(); true } else false
            }
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                override fun afterTextChanged(s: Editable?) = pintarComposer()
            })
        }
        composer.addView(campo, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply { rightMargin = dp(8) })
        micro = ImageButton(this).apply {
            setImageResource(R.drawable.ic_micro)
            scaleType = android.widget.ImageView.ScaleType.CENTER
            setOnClickListener { dictar() }
        }
        composer.addView(micro, LinearLayout.LayoutParams(dp(52), dp(52)).apply { rightMargin = dp(8) })
        enviar = ImageButton(this).apply {
            setImageResource(R.drawable.ic_enviar)
            scaleType = android.widget.ImageView.ScaleType.CENTER
            contentDescription = "Enviar a 8"
            background = circulo(Marca.COBALTO, null)
            setOnClickListener { enviarCampo() }
        }
        composer.addView(enviar, LinearLayout.LayoutParams(dp(52), dp(52)))
        root.addView(composer, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        return root
    }

    private fun circulo(fondo: Int, borde: Int?) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(fondo)
        if (borde != null) setStroke(dp(2), borde)
    }

    /** The whole screen from [conv] and the dictation state. */
    private fun pintar() {
        if (!::chat.isInitialized) return
        val c = conv
        chat.mostrar(c)
        val escuchando = (::dictador.isInitialized && dictador.escuchando) || esperandoPortatil
        estado.text = avisoBreve ?: when {
            escuchando -> "Te escucho"
            c.fase == Conversacion.Fase.SIN_CONEXION -> "Sin conexión"
            c.fase == Conversacion.Fase.ESPERANDO -> "Esperando tu confirmación"
            c.fase == Conversacion.Fase.TRABAJANDO -> c.ultimoPaso ?: "Trabajando"
            c.conectado == null -> "Conectando"
            else -> "Escribe o habla con 8"
        }
        aviso.visibility = if (c.fase == Conversacion.Fase.SIN_CONEXION) View.VISIBLE else View.GONE
        sugerencias.visibility = when (c.fase) {
            Conversacion.Fase.REPOSO, Conversacion.Fase.LISTO, Conversacion.Fase.SIN_CONEXION -> if (escuchando) View.GONE else View.VISIBLE
            else -> View.GONE
        }
        pintarComposer()
    }

    private fun pintarComposer() {
        if (!::micro.isInitialized) return
        val escuchando = (::dictador.isInitialized && dictador.escuchando) || esperandoPortatil
        micro.background = if (escuchando) circulo(Marca.COBALTO, null) else circulo(Color.WHITE, Marca.COBALTO)
        micro.imageTintList = ColorStateList.valueOf(if (escuchando) Color.WHITE else Marca.COBALTO)
        micro.contentDescription = if (escuchando) "Dejar de escuchar" else "Hablar con 8"
        val hay = campo.text.isNotBlank()
        enviar.isEnabled = hay
        enviar.alpha = if (hay) 1f else 0.4f
        campo.hint = if (escuchando) "Te escucho…" else "Escribe a 8"
    }

    private fun aviso(texto: String) {
        avisoBreve = texto
        pintar()
        window.decorView.removeCallbacks(finAviso)
        window.decorView.postDelayed(finAviso, AVISO_MS)
    }

    // ---- tasks ---------------------------------------------------------

    private fun enviarCampo() {
        val t = campo.text.toString().trim()
        if (t.isEmpty()) return
        if (dictador.escuchando) dictador.parar()
        campo.setText("")
        pedir(t)
    }

    /** `task_request` to the core, which tokenizes the task before it reaches the model. */
    private fun pedir(tarea: String) {
        val t = Dictado.tarea(listOf(tarea)) ?: return
        val enviada = events.send(Tareas.taskRequest(SESSION, t))
        Log.i(TAG_DICTADO, if (enviada) "task sent (${t.length} chars)" else "task kept until the events channel is back (${t.length} chars)")
        conv = conv.pedida(t, enviada)
    }

    /** Tasks written while there was no connection go out when it comes back. */
    private fun enviarPendientes() {
        val pendientes = conv.porEnviar
        if (pendientes.isEmpty()) return
        if (pendientes.all { events.send(Tareas.taskRequest(SESSION, it)) }) {
            Log.i(TAG_DICTADO, "${pendientes.size} kept task(s) sent")
            conv = conv.enviadas()
        }
    }

    // ---- confirmation card -------------------------------------------

    /**
     * Confirmar / Cancelar on the card. The request on screen (ConfirmActivity)
     * is answered through [ConfirmFlow], the same approval_result path as its
     * buttons, and the activity closes. A request the phone did not get over
     * the bridge is answered on the events channel (events.schema.json).
     */
    private fun responder(card: Conversacion.Item.Confirmacion, ok: Boolean) {
        val r = card.request
        if (!ConfirmFlow.answerFromChat(r.session, r.id, ok)) {
            val msg = JSONObject().put("type", "approval_result").put("id", r.id)
                .put("ok", ok).put("via", "pantalla").put("by", "persona")
            if (!ok) msg.put("reason", "cancelado")
            if (!events.send(msg)) {
                aviso("Sin conexión: tu respuesta no ha salido")
                return
            }
        }
        Log.i(TAG_CONFIRM, "card ${r.id}: ok=$ok")
        conv = conv.respondida(r.id, ok)
    }

    // ---- dictation -----------------------------------------------------

    /**
     * Debug only. `--ez dictar true` starts a dictation; `--es dictado movil|portatil`
     * chooses who dictates from then on; `--es tarea "…"` sends a typed task.
     */
    private fun porIntent(intent: Intent?) {
        // In a release build no other app can make 8 listen, change who dictates or send a task.
        if (!BuildConfig.DEBUG) return
        intent?.getStringExtra(EXTRA_VIA)?.let {
            via = Tareas.via(it, emulador())
            Log.i(TAG_DICTADO, "dictado via ${via.name.lowercase()}")
        }
        intent?.getStringExtra(EXTRA_TAREA)?.let { t -> window.decorView.post { pedir(t) } }
        if (intent?.getBooleanExtra(EXTRA_DICTAR, false) != true) return
        // Debug only: `--es audio prueba.pcm` reads files/prueba.pcm instead of the microphone.
        val audio = intent.getStringExtra("audio")
            ?.let { File(getExternalFilesDir(null), File(it).name) }?.takeIf { it.isFile }
        window.decorView.post { dictar(audio) }
    }

    /** The microphone (or a tap on the eyes): listen (or stop) on the phone, or ask the laptop to listen. */
    private fun dictar(audio: File? = null) {
        when {
            esperandoPortatil -> Unit // the laptop is already listening; it stops on silence
            dictador.escuchando -> dictador.parar()
            via == Via.PORTATIL && audio == null -> {
                if (!dictarEnPortatil()) aviso("Sin conexión con el portátil. Escribe la tarea")
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
        Log.i(TAG_DICTADO, "dictado: listening on the laptop")
        esperandoPortatil = true
        window.decorView.removeCallbacks(finEspera)
        window.decorView.postDelayed(finEspera, PORTATIL_MS)
        return true
    }

    /** The laptop's answer. The core already queued the task: [Conversacion] shows it, nothing is sent back. */
    private fun dictadoDelPortatil(msg: JSONObject) {
        val r = Tareas.dictation(msg, SESSION) ?: return
        window.decorView.removeCallbacks(finEspera)
        esperandoPortatil = false
        if (r.tarea != null) {
            Log.i(TAG_DICTADO, "dictado: laptop task (${r.tarea.length} chars)")
        } else {
            r.aviso?.let { conv = conv.nota(it) }
        }
    }

    private fun emulador() = Tareas.esEmulador(Build.FINGERPRINT, Build.MODEL, Build.PRODUCT, Build.HARDWARE)

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
                    Log.i(TAG_CONFIRM, "speech: es-ES on-device model installed")
                } else {
                    recognizer.triggerModelDownload(intent)
                    Log.i(TAG_CONFIRM, "speech: es-ES on-device model missing, download requested")
                }
                window.decorView.postDelayed({ recognizer.destroy() }, 5_000)
            }

            override fun onError(error: Int) {
                Log.i(TAG_CONFIRM, "speech: cannot check on-device support (error $error)")
                recognizer.destroy()
            }
        })
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private companion object {
        const val TAG_CONFIRM = "Priv8Confirm"
        const val REQUEST_MIC = 1
        const val TAG_DICTADO = "Priv8Dictado"
        const val EXTRA_DICTAR = "dictar"
        const val EXTRA_VIA = "dictado"
        const val EXTRA_TAREA = "tarea"
        const val AVISO_MS = 4_000L
        const val OJOS_DP = 132
        /** The laptop listens up to 7 s and Whisper takes a few more. */
        const val PORTATIL_MS = 15_000L
        val SESSION: String = BuildConfig.SESSION

        /**
         * The conversation of this process, so a recreated activity (rotation,
         * theme change) keeps it. Memory only: never written to disk.
         */
        var guardada: Conversacion? = null
    }
}
