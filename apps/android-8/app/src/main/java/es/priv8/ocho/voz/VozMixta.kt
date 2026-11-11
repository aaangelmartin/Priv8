package es.priv8.ocho.voz

import android.content.Context
import android.os.Bundle
import android.util.Log
import es.priv8.ocho.Frase
import es.priv8.ocho.Nivel
import es.priv8.ocho.SalidaTts
import es.priv8.ocho.confirm.LocalValues
import es.priv8.ocho.confirm.Verbalizer
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * 8 says what the core sends in a `voice` message over the bridge
 * (bridge.schema.json v1.1, the utterance per voice.schema.json), with
 * [MixedVoicePlayer]:
 *
 * - a local token is rendered here: its value comes from `render_values`
 *   ([LocalValues], sent by the core just before) and [Verbalizer] spells it
 *   out («quince mil cuatrocientos sesenta y dos euros con cincuenta y ocho»);
 * - a cloud sentence would be ElevenLabs PCM relayed by the core. The core
 *   does not stream it yet, so it is read by the local voice too: the demo
 *   always speaks. It carries no data, so nothing changes for privacy.
 * - a token without a value is not spoken (never a guess); the subtitle
 *   shows the token itself.
 *
 * When the sentence ends, `voice.done` goes back with the gaps between
 * voices, and the core records it as voice_out. 8's «hablar» follows the
 * level: [SalidaTts] for the local voice, [Nivel.salidaRms] of the PCM for the
 * cloud one, sent to [ojos] while app 8 is open.
 *
 * Neither the sentence nor the values are ever logged.
 */
class VozMixta(context: Context, private val send: (JSONObject) -> Boolean) : AutoCloseable {

    private val salida = SalidaTts(context) { nivel -> ojos?.invoke(nivel) }

    private val player = MixedVoicePlayer(context, object : MixedVoicePlayer.Listener {
        override fun ttsParams(params: Bundle) = salida.parametros(params)

        override fun onSegmentStart(utteranceId: String, index: Int, voice: Voice) {
            if (voice == Voice.LOCAL) salida.inicio()
        }

        override fun onLocalWord(utteranceId: String, index: Int, start: Int, end: Int) = salida.palabra(start, end)

        override fun onSegmentEnd(utteranceId: String, index: Int, voice: Voice) {
            if (voice == Voice.LOCAL) salida.fin()
        }

        override fun onLevel(utteranceId: String, rms: Float) {
            ojos?.invoke(Nivel.salidaRms(rms))
        }

        override fun onUtteranceDone(report: GapReport) {
            done(report.utteranceId, true, report)
        }

        override fun onError(utteranceId: String?, index: Int, message: String) {
            Log.w(TAG, "voice ${utteranceId ?: "-"}: segment $index failed (${message.substringBefore(':')})")
            salida.fin()
            if (utteranceId != null) done(utteranceId, false, null)
        }
    })

    /** Plays a `voice` message from the bridge. False if it does not follow the contract. */
    fun play(msg: JSONObject): Boolean {
        val frase = Frase.parse(msg) ?: return false
        val (segments, missing) = segmentos(frase) { LocalValues.get(frase.session, it) }
        Log.i(TAG, "voice ${frase.utterance}: ${segments.size} segments, missing=$missing")
        if (segments.isEmpty()) {
            done(frase.utterance, false, null)
            return true
        }
        player.play(frase.utterance, segments)
        return true
    }

    private fun done(utterance: String, ok: Boolean, report: GapReport?) {
        val msg = JSONObject().put("type", "voice.done").put("utterance", utterance).put("ok", ok)
        if (report != null && report.voiceSwitches.isNotEmpty()) {
            msg.put("gap_ms", JSONObject().put("max", report.maxMs.roundToInt()).put("mean", report.meanMs.roundToInt()))
        }
        val sent = send(msg)
        Log.i(TAG, "voice.done $utterance: ok=$ok${if (sent) "" else " (NOT SENT: bridge down)"}")
    }

    override fun close() {
        player.close()
        salida.fin()
    }

    companion object {
        private const val TAG = "Priv8Voz"

        /** Where 8's «hablar» level goes: OjosView.voz while app 8 is open, else nowhere. */
        @Volatile var ojos: ((Float) -> Unit)? = null

        /**
         * The segments to play for [frase]: every one read by the local voice for now
         * (see the class comment), with each token rendered from [valueOf] and spelled
         * out. Returns them and the number of tokens without a value, which are skipped.
         */
        fun segmentos(frase: Frase, valueOf: (String) -> String?): Pair<List<VoiceSegment.Local>, Int> {
            var missing = 0
            val out = frase.segments.mapNotNull { s ->
                when {
                    s.token != null -> {
                        val value = valueOf(s.token)
                        if (value == null) {
                            missing++
                            null
                        } else {
                            VoiceSegment.Local(Verbalizer.say(value, s.sayAs))
                        }
                    }
                    !s.text.isNullOrBlank() -> VoiceSegment.Local(s.text)
                    else -> null
                }
            }
            return out to missing
        }
    }
}
