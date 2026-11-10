package es.priv8.ocho

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.SpeechRecognizer
import android.util.Log
import android.widget.TextView
import es.priv8.ocho.confirm.ConfirmActivity

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
        // Spoken confirmations listen for «confirmo» / «cancela». Without the
        // permission the confirmation screen falls back to its buttons.
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
        } else {
            offerSpeechModel()
        }
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
        recognizer.triggerModelDownload(ConfirmActivity.recognizerIntent())
        Log.i(TAG, "speech: es-ES on-device model download requested")
        window.decorView.postDelayed({ recognizer.destroy() }, 5_000)
    }

    private companion object {
        const val TAG = "Priv8Confirm"
        const val REQUEST_MIC = 1
    }
}
