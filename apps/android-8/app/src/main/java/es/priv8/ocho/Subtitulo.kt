package es.priv8.ocho

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.TextView
import es.priv8.ocho.confirm.LocalValues

/**
 * What 8 is saying, under the eyes, with the real values rendered on the
 * device (issue #40). Provisional look until the app design (#36): white Sora
 * on cobalt, centered.
 *
 * The values may arrive over the bridge (render_values) a moment after the
 * `voice` event, so a sentence with missing values is rendered again a few
 * times before giving up; until then the token itself is shown, never a guess.
 * The rendered text is shown only here: not logged, not sent.
 */
class Subtitulo(context: Context) : TextView(context) {

    private val main = Handler(Looper.getMainLooper())
    private var actual: Frase? = null

    init {
        setTextColor(Color.WHITE)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
        gravity = Gravity.CENTER
        val pad = (24 * resources.displayMetrics.density).toInt()
        setPadding(pad, pad, pad, pad * 2)
        typeface = try {
            val sora = Typeface.createFromAsset(context.assets, "ocho/fonts/Sora.ttf")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) Typeface.create(sora, 600, false) else sora
        } catch (e: RuntimeException) {
            Typeface.DEFAULT_BOLD
        }
        visibility = View.GONE
    }

    fun mostrar(frase: Frase) {
        main.removeCallbacksAndMessages(null)
        actual = frase
        pintar(frase, intentos = REINTENTOS)
    }

    fun ocultar() {
        main.removeCallbacksAndMessages(null)
        actual = null
        text = ""
        visibility = View.GONE
    }

    private fun pintar(frase: Frase, intentos: Int) {
        if (actual !== frase) return
        val r = frase.render { LocalValues.get(frase.session, it) }
        text = r.screen
        contentDescription = r.spoken
        visibility = View.VISIBLE
        if (r.missing > 0 && intentos > 0) {
            main.postDelayed({ pintar(frase, intentos - 1) }, REINTENTO_MS)
        } else {
            main.postDelayed({ if (actual === frase) ocultar() }, VISIBLE_MS)
        }
    }

    companion object {
        private const val REINTENTOS = 8
        private const val REINTENTO_MS = 250L
        private const val VISIBLE_MS = 10_000L
    }
}
