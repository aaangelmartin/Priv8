package es.priv8.ocho.chat

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.BackgroundColorSpan
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.text.style.TypefaceSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import es.priv8.ocho.Frase
import es.priv8.ocho.confirm.LocalValues
import es.priv8.ocho.confirm.Renderer

/**
 * Draws a [Conversacion]: the person's bubbles in cobalt on the right, 8's in
 * white on the left with the tight corner towards 8 (like the audit console's
 * chat), progress lines centred, block cards and confirmation cards.
 *
 * Values are put into 8's sentences and the confirmation summaries here, at
 * draw time, from [LocalValues] (in memory, sent by the core over the bridge).
 * A sentence whose values have not arrived yet shows the token and is drawn
 * again a few times, never with a guessed value. Nothing is logged.
 */
class ChatView(context: Context, private val onRespuesta: (Conversacion.Item.Confirmacion, Boolean) -> Unit) : ScrollView(context) {

    private val main = Handler(Looper.getMainLooper())
    private val lista = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(16), dp(16), dp(12))
    }
    private val vistas = LinkedHashMap<String, Pair<Conversacion.Item, View>>()
    private var actual: Conversacion? = null
    private var reintentos = 0

    private val sora: Typeface = try {
        val t = Typeface.createFromAsset(context.assets, "ocho/fonts/Sora.ttf")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) Typeface.create(t, 600, false) else t
    } catch (e: RuntimeException) {
        Typeface.DEFAULT_BOLD
    }

    init {
        isFillViewport = true
        setBackgroundColor(Marca.NIEBLA)
        addView(lista)
    }

    fun mostrar(c: Conversacion) {
        val antes = vistas.size
        actual = c
        val ids = c.items.map { it.id }.toSet()
        vistas.keys.filter { it !in ids }.forEach { id -> vistas.remove(id)?.let { lista.removeView(it.second) } }
        var cambio = false
        c.items.forEachIndexed { i, item ->
            val previo = vistas[item.id]
            if (previo != null && previo.first == item) return@forEachIndexed
            val v = crear(item)
            if (previo != null) {
                val pos = lista.indexOfChild(previo.second)
                lista.removeView(previo.second)
                lista.addView(v, pos)
            } else {
                lista.addView(v, i.coerceAtMost(lista.childCount))
            }
            vistas[item.id] = item to v
            cambio = true
        }
        if (cambio || vistas.size != antes) main.post { fullScroll(View.FOCUS_DOWN) }
        // Values may arrive over the bridge a moment after the event: draw again.
        main.removeCallbacks(repintar)
        reintentos = REINTENTOS
        if (faltan(c)) main.postDelayed(repintar, REINTENTO_MS)
    }

    private val repintar = object : Runnable {
        override fun run() {
            val c = actual ?: return
            c.items.filter { it is Conversacion.Item.Ocho || it is Conversacion.Item.Confirmacion }.forEach { item ->
                val v = vistas[item.id]?.second ?: return@forEach
                val nueva = crear(item)
                val pos = lista.indexOfChild(v)
                lista.removeView(v)
                lista.addView(nueva, pos)
                vistas[item.id] = item to nueva
            }
            if (--reintentos > 0 && faltan(c)) main.postDelayed(this, REINTENTO_MS)
        }
    }

    private fun faltan(c: Conversacion) = c.items.any {
        when (it) {
            is Conversacion.Item.Ocho -> it.frase?.render { t -> LocalValues.get(it.frase.session, t) }?.missing ?: 0 > 0
            is Conversacion.Item.Confirmacion ->
                it.estado == Conversacion.Estado.PENDIENTE &&
                    Renderer.render(it.request.segments) { t -> LocalValues.get(it.request.session, t) }.missing > 0
            else -> false
        }
    }

    fun destroy() = main.removeCallbacksAndMessages(null)

    // ---- items ---------------------------------------------------------

    private fun crear(item: Conversacion.Item): View = when (item) {
        is Conversacion.Item.Persona -> persona(item)
        is Conversacion.Item.Ocho -> ocho(item)
        is Conversacion.Item.Pasos -> pasos(item)
        is Conversacion.Item.Bloqueo -> bloqueo(item)
        is Conversacion.Item.Confirmacion -> confirmacion(item)
        is Conversacion.Item.Nota -> nota(item.texto)
    }

    private fun persona(p: Conversacion.Item.Persona): View {
        val col = columna(Gravity.END)
        col.addView(burbuja(p.texto, Marca.COBALTO, Color.WHITE, ladoOcho = false))
        if (!p.enviada) col.addView(meta("Se envía al volver la conexión"))
        col.contentDescription = "Tú: ${p.texto}" + if (p.enviada) "" else ". Se envía al volver la conexión."
        col.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
        hideChildren(col)
        return fila(col, Gravity.END)
    }

    private fun ocho(o: Conversacion.Item.Ocho): View {
        val (texto, dicho) = if (o.frase != null) frase(o.frase) else (o.texto.orEmpty() to o.texto.orEmpty())
        val col = columna(Gravity.START)
        col.addView(TextView(context).apply {
            text = "8"
            typeface = sora
            setTextColor(Marca.COBALTO)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setPadding(dp(6), 0, 0, dp(4))
        })
        col.addView(burbuja(texto, Color.WHITE, Marca.NOCHE, ladoOcho = true))
        col.contentDescription = "8: $dicho"
        col.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
        hideChildren(col)
        return fila(col, Gravity.START)
    }

    /** 8's sentence with the real values in, each value marked. Returns (screen, spoken). */
    private fun frase(f: Frase): Pair<CharSequence, String> {
        val r = f.render { LocalValues.get(f.session, it) }
        val s = SpannableStringBuilder(r.screen)
        var desde = 0
        for (tok in f.segments.mapNotNull { it.token }) {
            val shown = LocalValues.get(f.session, tok) ?: tok
            val i = r.screen.indexOf(shown, desde)
            if (i < 0) continue
            val end = i + shown.length
            s.setSpan(BackgroundColorSpan(Marca.TOKEN_BG), i, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            s.setSpan(ForegroundColorSpan(Marca.TOKEN_FG), i, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            s.setSpan(StyleSpan(Typeface.BOLD), i, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            if (shown == tok) s.setSpan(TypefaceSpan("monospace"), i, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            desde = end
        }
        return s to r.spoken
    }

    private fun pasos(p: Conversacion.Item.Pasos): View {
        val col = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dp(6), 0, dp(10))
        }
        val visibles = p.lineas.takeLast(MAX_LINEAS)
        val ocultas = p.lineas.size - visibles.size
        if (ocultas > 0) col.addView(linea("y $ocultas pasos antes", Progreso.Tono.NORMAL, ultima = false, activo = false))
        visibles.forEachIndexed { i, l ->
            col.addView(linea(l.texto, l.tono, ultima = i == visibles.lastIndex, activo = p.activo))
        }
        col.contentDescription = if (p.activo) "8 está trabajando: ${visibles.last().texto}" else "Pasos de 8: " + p.lineas.joinToString(". ") { it.texto }
        col.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
        hideChildren(col)
        return col.apply { layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT) }
    }

    private fun linea(texto: String, tono: Progreso.Tono, ultima: Boolean, activo: Boolean): View {
        val color = when (tono) {
            Progreso.Tono.BIEN -> Marca.SEGURO_TEXTO
            Progreso.Tono.AVISO -> Marca.AVISO_TEXTO
            Progreso.Tono.BLOQUEO -> Marca.BLOQUEO_TEXTO
            Progreso.Tono.PAUSA -> Marca.COBALTO
            Progreso.Tono.NORMAL -> Marca.PIZARRA
        }
        val punto = when (tono) {
            Progreso.Tono.BIEN -> Marca.SEGURO
            Progreso.Tono.AVISO -> Marca.AVISO
            Progreso.Tono.BLOQUEO -> Marca.BLOQUEO
            else -> if (ultima && activo) Marca.COBALTO else Marca.LINEA
        }
        return LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8), dp(3), dp(8), dp(3))
            addView(View(context).apply {
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(punto) }
            }, LinearLayout.LayoutParams(dp(7), dp(7)).apply { rightMargin = dp(8) })
            addView(TextView(context).apply {
                text = texto
                typeface = Typeface.MONOSPACE
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                setTextColor(color)
                if (ultima && activo) setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
            })
        }
    }

    private fun bloqueo(b: Conversacion.Item.Bloqueo): View {
        val (fondo, borde, texto) = when (b.tono) {
            Progreso.Tono.AVISO -> Triple(Marca.AVISO_SUAVE, Marca.AVISO, Marca.AVISO_TEXTO)
            else -> Triple(Marca.BLOQUEO_SUAVE, Marca.BLOQUEO, Marca.BLOQUEO_TEXTO)
        }
        val card = tarjeta(fondo, borde)
        card.addView(etiqueta(b.titulo.uppercase(), texto))
        card.addView(cuerpo(b.texto, Marca.NOCHE))
        card.contentDescription = "${b.titulo}. ${b.texto}"
        card.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
        hideChildren(card)
        return card
    }

    private fun confirmacion(c: Conversacion.Item.Confirmacion): View {
        val r = Renderer.render(c.request.segments) { LocalValues.get(c.request.session, it) }
        val card = tarjeta(Color.WHITE, Marca.COBALTO)
        card.addView(etiqueta("8 NECESITA TU CONFIRMACIÓN", Marca.COBALTO))
        card.addView(TextView(context).apply {
            text = r.screen
            typeface = sora
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
            setTextColor(Marca.NOCHE)
            setPadding(0, dp(6), 0, dp(10))
            contentDescription = r.spoken
        })
        when (c.estado) {
            Conversacion.Estado.PENDIENTE -> {
                if (r.missing > 0) {
                    card.addView(cuerpo("Faltan datos de esta operación. Cancélala o revísala en tu banco.", Marca.AVISO_TEXTO))
                }
                card.addView(cuerpo("Puedes decir «confirmo» o «cancela», o tocar aquí.", Marca.PIZARRA))
                val botones = LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    setPadding(0, dp(12), 0, 0)
                }
                val cancelar = boton("Cancelar", Color.WHITE, Marca.COBALTO) { onRespuesta(c, false) }
                val confirmar = boton("Confirmar", Marca.COBALTO, Color.WHITE) { onRespuesta(c, true) }.apply {
                    isEnabled = r.missing == 0
                    alpha = if (isEnabled) 1f else 0.4f
                }
                botones.addView(cancelar, LinearLayout.LayoutParams(0, dp(52), 1f).apply { rightMargin = dp(10) })
                botones.addView(confirmar, LinearLayout.LayoutParams(0, dp(52), 1f))
                card.addView(botones)
            }
            Conversacion.Estado.CONFIRMADA -> card.addView(estado("Confirmado", Marca.SEGURO_TEXTO, Marca.SEGURO_SUAVE))
            Conversacion.Estado.CANCELADA -> card.addView(estado("Cancelado", Marca.BLOQUEO_TEXTO, Marca.BLOQUEO_SUAVE))
            Conversacion.Estado.CADUCADA -> card.addView(estado("Caducado: no se ha hecho", Marca.AVISO_TEXTO, Marca.AVISO_SUAVE))
        }
        return card
    }

    // ---- pieces --------------------------------------------------------

    private fun fila(hijo: View, gravedad: Int): View {
        return LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = gravedad
            setPadding(0, dp(4), 0, dp(4))
            addView(hijo, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
    }

    private fun columna(gravedad: Int) = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = gravedad
    }

    private fun burbuja(texto: CharSequence, fondo: Int, tinta: Int, ladoOcho: Boolean) = TextView(context).apply {
        text = texto
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
        setTextColor(tinta)
        setLineSpacing(0f, 1.25f)
        setPadding(dp(15), dp(11), dp(15), dp(11))
        maxWidth = (resources.displayMetrics.widthPixels * 0.8f).toInt()
        val r = dp(20).toFloat()
        val tight = dp(6).toFloat()
        background = GradientDrawable().apply {
            setColor(fondo)
            // tl, tr, br, bl: the tight corner points at whoever speaks.
            cornerRadii = if (ladoOcho) floatArrayOf(r, r, r, r, r, r, tight, tight) else floatArrayOf(r, r, r, r, tight, tight, r, r)
        }
        if (ladoOcho && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) elevation = dp(1).toFloat()
    }

    private fun meta(texto: String) = TextView(context).apply {
        text = texto
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        setTextColor(Marca.PIZARRA)
        setPadding(dp(4), dp(4), dp(4), 0)
    }

    private fun nota(texto: String) = TextView(context).apply {
        text = texto
        gravity = Gravity.CENTER
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        setTextColor(Marca.PIZARRA)
        setPadding(dp(12), dp(6), dp(12), dp(6))
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    }

    private fun tarjeta(fondo: Int, borde: Int) = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(18), dp(16), dp(18), dp(16))
        background = GradientDrawable().apply {
            setColor(fondo)
            cornerRadius = dp(20).toFloat()
            setStroke(dp(1), borde)
        }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(6)
            bottomMargin = dp(10)
        }
    }

    private fun etiqueta(texto: String, color: Int) = TextView(context).apply {
        text = texto
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        letterSpacing = 0.1f
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        setTextColor(color)
    }

    private fun cuerpo(texto: String, color: Int) = TextView(context).apply {
        text = texto
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        setTextColor(color)
        setLineSpacing(0f, 1.2f)
        setPadding(0, dp(4), 0, 0)
    }

    private fun estado(texto: String, tinta: Int, fondo: Int) = TextView(context).apply {
        text = texto
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        setTextColor(tinta)
        setPadding(dp(14), dp(8), dp(14), dp(8))
        background = GradientDrawable().apply { setColor(fondo); cornerRadius = dp(999).toFloat() }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(6)
        }
    }

    private fun boton(texto: String, fondo: Int, tinta: Int, onClick: () -> Unit) = Button(context).apply {
        text = texto
        isAllCaps = false
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
        typeface = sora
        setTextColor(tinta)
        stateListAnimator = null
        background = GradientDrawable().apply {
            cornerRadius = dp(999).toFloat()
            setColor(fondo)
            setStroke(dp(2), Marca.COBALTO)
        }
        setOnClickListener { onClick() }
    }

    private fun hideChildren(v: LinearLayout) {
        for (i in 0 until v.childCount) v.getChildAt(i).importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private companion object {
        const val REINTENTOS = 8
        const val REINTENTO_MS = 250L
        const val MAX_LINEAS = 5
    }
}

/** Brand colours (brand/tokens.css). */
object Marca {
    val COBALTO = Color.parseColor("#2D45D6")
    val NOCHE = Color.parseColor("#0B1B33")
    val NIEBLA = Color.parseColor("#EEF2F8")
    val PIZARRA = Color.parseColor("#5A6478")
    val LINEA = Color.parseColor("#D6DCE8")
    val TOKEN_BG = Color.parseColor("#E4E9FD")
    val TOKEN_FG = Color.parseColor("#2236B5")
    val SEGURO = Color.parseColor("#1F8A5B")
    val AVISO = Color.parseColor("#A86400")
    val BLOQUEO = Color.parseColor("#C23A2E")
    val SEGURO_SUAVE = Color.parseColor("#DFF2E7")
    val AVISO_SUAVE = Color.parseColor("#FCEFD9")
    val BLOQUEO_SUAVE = Color.parseColor("#FBE5E3")
    val SEGURO_TEXTO = Color.parseColor("#18734C")
    val AVISO_TEXTO = Color.parseColor("#8A5200")
    val BLOQUEO_TEXTO = Color.parseColor("#A83228")
}
