package es.priv8.ocho.confirm

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import es.priv8.ocho.OjosView
import es.priv8.ocho.SalidaTts
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Locale

/**
 * Minimal confirmation screen. Self-contained on purpose: the app UI (#39)
 * and the design (#36) will restyle it; the flow and the contract live in
 * [ConfirmFlow].
 *
 * Voice stays on the device:
 *  - TextToSpeech es-ES with an embedded voice (no network synthesis), so the
 *    spoken values are never sent to a cloud service;
 *  - SpeechRecognizer on-device only. If the device has no on-device
 *    recognizer, no microphone permission, or no es-ES model, 8 says so on
 *    screen and the buttons are the way to answer.
 * Values are never logged.
 */
class ConfirmActivity : Activity(), ConfirmFlow.Screen {

    private val main = Handler(Looper.getMainLooper())
    private var request: ConfirmRequest? = null
    private var rendered: Rendered? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var ttsFailed = false
    private var answered = false
    /** The summary was said (or could not be): time to listen. */
    private var spoken = false
    private var recognizer: SpeechRecognizer? = null
    private var listening = false
    private var voiceErrors = 0
    private var closed = false

    /** 8 while it asks: «hablar» follows the TextToSpeech output and «escuchar» the microphone (#42). */
    private lateinit var ojos: OjosView
    private lateinit var salida: SalidaTts
    private lateinit var summary: TextView
    private lateinit var status: TextView
    private lateinit var countdown: TextView
    private lateinit var confirm: Button
    private lateinit var cancel: Button
    private var startedAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildLayout())
        salida = SalidaTts(this) { ojos.voz(it) }
        tts = TextToSpeech(this, ::onTtsInit)
        ConfirmFlow.attach(this)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        ConfirmFlow.attach(this)
    }

    override fun onDestroy() {
        ConfirmFlow.detach(this)
        main.removeCallbacksAndMessages(null)
        recognizer?.destroy()
        tts?.shutdown()
        salida.fin()
        ojos.destroy()
        super.onDestroy()
    }

    // ---- ConfirmFlow.Screen ------------------------------------------------

    override fun show(request: ConfirmRequest) {
        this.request = request
        answered = false
        spoken = false
        val r = Renderer.render(request.segments) { LocalValues.get(request.session, it) }
        rendered = r
        summary.text = r.screen
        ojos.cara("esperar")
        confirm.isEnabled = r.missing == 0
        startedAt = SystemClock.elapsedRealtime()
        tick()
        Log.i(TAG, "show ${request.id}: segments=${request.segments.size} missing=${r.missing} channels=${request.channels.joinToString(",")}")
        if (r.missing > 0) {
            status.text = "Faltan datos de esta operación: no la puedo mostrar entera. Cancélala o revísala en tu banco."
        }
        speakSummary()
    }

    override fun close() {
        if (closed) return
        closed = true
        stopListening()
        tts?.stop()
        finish()
    }

    // ---- answer ------------------------------------------------------------

    private fun answer(ok: Boolean, via: String) {
        val r = request ?: return
        if (answered) return
        if (ok && (rendered?.missing ?: 1) > 0) return
        answered = true
        stopListening()
        tts?.stop()
        salida.fin()
        ojos.cara(if (ok) "asentir" else "negar")
        status.text = if (ok) "Confirmado." else "Cancelado."
        confirm.isEnabled = false
        cancel.isEnabled = false
        ConfirmFlow.answer(r.id, ok, via)
    }

    private fun tick() {
        val r = request ?: return
        val left = r.expiresS - ((SystemClock.elapsedRealtime() - startedAt) / 1000).toInt()
        countdown.text = if (left > 0) "Se cancela sola en ${left / 60}:${"%02d".format(left % 60)}" else ""
        main.removeCallbacks(ticker)
        if (left > 0) main.postDelayed(ticker, 1000)
    }

    private val ticker = Runnable { tick() }

    // ---- voice out (TextToSpeech, on the device) ---------------------------

    private fun onTtsInit(code: Int) {
        val engine = tts ?: return
        if (code != TextToSpeech.SUCCESS) {
            voiceOff("No hay voz local disponible.")
            return
        }
        val spain = Locale("es", "ES")
        val lang = engine.setLanguage(spain)
        if (lang == TextToSpeech.LANG_MISSING_DATA || lang == TextToSpeech.LANG_NOT_SUPPORTED) {
            voiceOff("No hay voz local en español.")
            return
        }
        // Only an embedded voice: the summary has real values and must not
        // reach a network synthesizer.
        val embedded = engine.voices.orEmpty()
            .filter { it.locale.language == "es" && it.locale.country == "ES" && !it.isNetworkConnectionRequired }
            .maxByOrNull { it.quality }
        if (embedded == null) {
            voiceOff("No hay voz local en español sin red.")
            return
        }
        engine.voice = embedded
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) = salida.inicio()
            override fun onRangeStart(id: String?, start: Int, end: Int, frame: Int) = salida.palabra(start, end)
            override fun onStop(id: String?, interrupted: Boolean) = salida.fin()
            override fun onDone(id: String?) {
                salida.fin()
                main.post { if (id == request?.id) onSpoken() }
            }
            @Deprecated("Deprecated in Java")
            override fun onError(id: String?) {
                salida.fin()
                main.post { if (id == request?.id) onSpoken() }
            }
        })
        ttsReady = true
        Log.i(TAG, "tts ready: voice=${embedded.name} network=false")
        speakSummary()
    }

    private fun speakSummary() {
        val r = request ?: return
        val text = rendered?.spoken ?: return
        if ("voz" !in r.channels) {
            onSpoken()
            return
        }
        if (ttsFailed) {
            onSpoken()
            return
        }
        if (!ttsReady) return
        val params = Bundle().apply {
            putString(TextToSpeech.Engine.KEY_FEATURE_NETWORK_SYNTHESIS, "false")
            putString(TextToSpeech.Engine.KEY_FEATURE_EMBEDDED_SYNTHESIS, "true")
            salida.parametros(this)
        }
        stopListening()
        val rc = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, params, r.id)
        Log.i(TAG, "tts speak ${r.id}: ${text.length} chars -> ${if (rc == TextToSpeech.SUCCESS) "ok" else "error"}")
        if (rc != TextToSpeech.SUCCESS) {
            onSpoken()
        } else {
            // Some devices (the headless emulator among them) never report
            // the end of an utterance; do not wait for it forever.
            main.postDelayed({ if (!spoken) onSpoken() }, SPEECH_GRACE_MS + SPEECH_MS_PER_CHAR * text.length)
        }
    }

    private fun voiceOff(why: String) {
        ttsFailed = true
        Log.i(TAG, "tts off: $why")
        status.text = "$why Responde con los botones."
        onSpoken()
    }

    // ---- voice in (SpeechRecognizer, on-device only) -----------------------

    private fun onSpoken() {
        if (closed || answered || spoken || request == null) return
        spoken = true
        if ((rendered?.missing ?: 0) > 0) return
        val why = recognizerUnavailable()
        if (why != null) {
            Log.i(TAG, "voice answer off: $why")
            status.text = "$why Responde con los botones."
            return
        }
        startListening()
    }

    /** Why 8 cannot listen on this device, or null if it can. */
    private fun recognizerUnavailable(): String? {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            return "Sin permiso de micrófono."
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || !SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
            return "Este dispositivo no reconoce la voz sin red."
        }
        return null
    }

    private fun startListening() {
        if (closed || listening) return
        val rec = recognizer ?: SpeechRecognizer.createOnDeviceSpeechRecognizer(this).also {
            it.setRecognitionListener(listener)
            recognizer = it
        }
        listening = true
        Log.i(TAG, "voice: listening on-device for «confirmo» / «cancela»")
        status.text = "Te escucho: di «confirmo» o «cancela»."
        rec.startListening(recognizerIntent())
    }

    private fun stopListening() {
        if (!listening) return
        listening = false
        recognizer?.cancel()
    }

    private fun heard(bundle: Bundle?, final: Boolean) {
        val hypotheses = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
        when (VoiceAnswer.classify(hypotheses)) {
            VoiceAnswer.Answer.CONFIRM -> answer(true, "voz")
            VoiceAnswer.Answer.CANCEL -> answer(false, "voz")
            null -> if (final) {
                // Never log what was heard: it may repeat the values.
                Log.i(TAG, "voice: no answer in ${hypotheses.size} hypotheses, listening again")
                listening = false
                main.postDelayed({ startListening() }, RESTART_MS)
            }
        }
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) = ojos.microfono(rmsdB)
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}
        override fun onPartialResults(partialResults: Bundle?) = heard(partialResults, final = false)
        override fun onResults(results: Bundle?) {
            voiceErrors = 0
            heard(results, final = true)
        }

        override fun onError(error: Int) {
            listening = false
            if (closed) return
            val transient = error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
            if (!transient) voiceErrors++
            Log.i(TAG, "voice: recognizer error $error${if (transient) " (silence)" else ""}")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                (error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE || error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED)
            ) {
                // The on-device recognizer has no es-ES model. MainActivity
                // offers the download; never in the middle of a confirmation.
                Log.i(TAG, "voice: es-ES on-device model missing")
                status.text = "Falta el reconocimiento de voz en español en el dispositivo. Responde con los botones."
                return
            }
            if (voiceErrors >= MAX_VOICE_ERRORS) {
                status.text = "No puedo escucharte en este dispositivo. Responde con los botones."
                return
            }
            main.postDelayed({ startListening() }, RESTART_MS)
        }
    }

    // ---- layout (placeholder look; #36 and #39 restyle it) -----------------

    private fun buildLayout(): View {
        val pad = dp(24)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, dp(64), pad, pad)
            setBackgroundColor(NIEBLA)
        }
        ojos = OjosView(this)
        root.addView(ojos, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(OJOS_DP)).apply {
            bottomMargin = dp(16)
        })
        root.addView(TextView(this).apply {
            text = "8 necesita tu confirmación"
            textSize = 16f
            setTextColor(PIZARRA)
        })
        summary = TextView(this).apply {
            textSize = 26f
            setTextColor(NOCHE)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(16), 0, dp(16))
        }
        root.addView(summary)
        status = TextView(this).apply {
            textSize = 16f
            setTextColor(PIZARRA)
        }
        root.addView(status)
        countdown = TextView(this).apply {
            textSize = 14f
            setTextColor(PIZARRA)
            setPadding(0, dp(8), 0, dp(24))
        }
        root.addView(countdown)
        confirm = button("Confirmar", COBALTO, Color.WHITE) { answer(true, "pantalla") }
        cancel = button("Cancelar", Color.WHITE, COBALTO) { answer(false, "pantalla") }
        root.addView(confirm)
        root.addView(cancel)
        return root
    }

    private fun button(label: String, bg: Int, fg: Int, onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 18f
        setTextColor(fg)
        gravity = Gravity.CENTER
        background = GradientDrawable().apply {
            cornerRadius = dp(12).toFloat()
            setColor(bg)
            setStroke(dp(2), COBALTO)
        }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56)).apply {
            topMargin = dp(12)
        }
        setOnClickListener { onClick() }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    companion object {
        /** Request for the on-device recognizer, es-ES. Also used to ask for the model download. */
        fun recognizerIntent(): Intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES")
            .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)

        private const val TAG = "Priv8Confirm"
        private const val RESTART_MS = 400L
        private const val MAX_VOICE_ERRORS = 3
        private const val SPEECH_GRACE_MS = 1_500L
        private const val SPEECH_MS_PER_CHAR = 90L
        private const val OJOS_DP = 160
        // Brand (brand/tokens.css).
        private val COBALTO = Color.parseColor("#2D45D6")
        private val NOCHE = Color.parseColor("#0B1B33")
        private val NIEBLA = Color.parseColor("#EEF2F8")
        private val PIZARRA = Color.parseColor("#5A6478")
    }
}
