package es.priv8.ocho

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

/** Placeholder launcher. The real app (8's eyes in a WebView, voice) comes later. */
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(
            TextView(this).apply {
                setText(R.string.main_text)
                textSize = 18f
                setPadding(48, 96, 48, 48)
            },
        )
    }
}
