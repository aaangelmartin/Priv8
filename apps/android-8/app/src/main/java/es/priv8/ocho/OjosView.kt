package es.priv8.ocho

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.IOException

/**
 * 8's eyes: a WebView with assets/ocho/app.html, which loads docs/ojos.html
 * (copied at build time, unchanged) and shows only the big 8.
 *
 * Everything is served from the APK under https://appassets.androidplatform.net/assets/.
 * The page never reaches the network: the Google Fonts request in ojos.html is
 * answered with the bundled Sora, and any other request gets a 403.
 */
@SuppressLint("SetJavaScriptEnabled", "ViewConstructor")
class OjosView(context: Context) : WebView(context) {

    private var ready = false
    private val queue = ArrayList<String>()

    init {
        setBackgroundColor(Color.parseColor("#2D45D6"))
        settings.javaScriptEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.mediaPlaybackRequiresUserGesture = true
        isVerticalScrollBarEnabled = false
        isHorizontalScrollBarEnabled = false
        overScrollMode = OVER_SCROLL_NEVER
        addJavascriptInterface(Bridge(), "OchoAndroid")
        webViewClient = Client()
        loadUrl("$ORIGIN/assets/ocho/app.html")
    }

    /** One message of the event channel (JSON text). */
    fun evento(json: String) = call("Ocho.evento(${JSONObject.quote(json)})")

    fun conexion(connected: Boolean) =
        call("Ocho.conexion(${JSONObject.quote(if (connected) "conectado" else "sin_conexion")})")

    private fun call(js: String) {
        if (!ready) { queue.add(js); return }
        evaluateJavascript("window.Ocho && $js", null)
    }

    private inner class Bridge {
        @JavascriptInterface
        fun debug(): Boolean = BuildConfig.DEBUG
    }

    private inner class Client : WebViewClient() {
        override fun onPageFinished(view: WebView, url: String) {
            if (!url.endsWith("/app.html")) return
            ready = true
            queue.forEach { evaluateJavascript("window.Ocho && $it", null) }
            queue.clear()
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = true

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
            val url = request.url
            return when {
                url.scheme == "https" && url.host == ASSET_HOST && url.path.orEmpty().startsWith("/assets/") ->
                    asset(url.path!!.removePrefix("/assets/"))
                url.host == "fonts.googleapis.com" -> text("text/css", SORA_CSS)
                else -> blocked()
            }
        }

        private fun asset(path: String): WebResourceResponse {
            if (path.contains("..")) return blocked()
            return try {
                WebResourceResponse(mime(path), if (mime(path).startsWith("text/") || path.endsWith(".js")) "utf-8" else null, context.assets.open(path))
            } catch (e: IOException) {
                WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
            }
        }
    }

    companion object {
        private const val ASSET_HOST = "appassets.androidplatform.net"
        private const val ORIGIN = "https://$ASSET_HOST"
        private val SORA_CSS = """
            @font-face { font-family: "Sora"; src: url("$ORIGIN/assets/ocho/fonts/Sora.ttf") format("truetype");
              font-weight: 100 800; font-style: normal; font-display: block; }
        """.trimIndent()

        private fun mime(path: String) = when (path.substringAfterLast('.').lowercase()) {
            "html" -> "text/html"
            "js" -> "application/javascript"
            "css" -> "text/css"
            "ttf" -> "font/ttf"
            "svg" -> "image/svg+xml"
            "json" -> "application/json"
            else -> "application/octet-stream"
        }

        private fun text(mime: String, body: String) =
            WebResourceResponse(mime, "utf-8", ByteArrayInputStream(body.toByteArray()))

        private fun blocked() =
            WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", emptyMap(), ByteArrayInputStream(ByteArray(0)))
    }
}
