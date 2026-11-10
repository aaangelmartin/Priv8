// Priv8 · voz mixta en Android.
//
// Self-contained source, to be moved into apps/android-8/ once that project is
// on main. It depends only on the Android SDK (minSdk 26) and the Kotlin
// standard library.
//
// Plays an ordered list of voice segments:
//   - cloud: raw PCM from ElevenLabs (pcm_24000, 16-bit LE mono), streamed by
//     the laptop core over the bridge, into an AudioTrack;
//   - local: text with the real figures and names, through TextToSpeech (es-ES).
// Segments are chained back to back and the gap between voices is measured.

package ai.priv8.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue

enum class Voice { CLOUD, LOCAL }

/** One entry of the "segmento de voz" contract, already resolved on the device side. */
sealed class VoiceSegment {
    abstract val voice: Voice

    /** A data-free sentence, synthesized by ElevenLabs and streamed as PCM. */
    class Cloud(val audio: PcmSource) : VoiceSegment() {
        override val voice = Voice.CLOUD
    }

    /** Spoken by the device: rendered figures, names, or a cloud sentence the final block stopped. */
    class Local(val text: String) : VoiceSegment() {
        override val voice = Voice.LOCAL
    }
}

/** 16-bit little-endian mono PCM. read() blocks for the next chunk and returns null at the end. */
interface PcmSource {
    val sampleRate: Int
    fun read(): ByteArray?
}

/** Fed by the bridge as chunks arrive from the core: push(), then end() or fail(). */
class QueuePcmSource(override val sampleRate: Int = 24_000) : PcmSource {
    private val queue = LinkedBlockingQueue<ByteArray>()
    @Volatile private var error: Throwable? = null

    fun push(chunk: ByteArray) {
        if (chunk.isNotEmpty()) queue.put(chunk)
    }

    fun end() = queue.put(END)

    fun fail(cause: Throwable) {
        error = cause
        queue.put(END)
    }

    override fun read(): ByteArray? {
        val chunk = queue.take()
        if (chunk === END) {
            error?.let { throw it }
            return null
        }
        return chunk
    }

    private companion object {
        val END = ByteArray(0)
    }
}

/** Whole clip already in memory (replay mode, tests). */
class ByteArrayPcmSource(
    private val pcm: ByteArray,
    override val sampleRate: Int = 24_000,
    private val chunkBytes: Int = 4_800,
) : PcmSource {
    private var offset = 0

    override fun read(): ByteArray? {
        if (offset >= pcm.size) return null
        val end = minOf(offset + chunkBytes, pcm.size)
        return pcm.copyOfRange(offset, end).also { offset = end }
    }
}

/** Silence between the end of one segment and the start of the next. Negative = overlap. */
data class Transition(
    val fromIndex: Int,
    val toIndex: Int,
    val from: Voice,
    val to: Voice,
    val gapMs: Double,
)

data class GapReport(val utteranceId: String, val transitions: List<Transition>) {
    /** Only the switches between voices, which is what the demo metric reports. */
    val voiceSwitches: List<Transition> get() = transitions.filter { it.from != it.to }
    val maxMs: Double get() = voiceSwitches.maxOfOrNull { it.gapMs } ?: 0.0
    val meanMs: Double get() = voiceSwitches.map { it.gapMs }.average().takeUnless { it.isNaN() } ?: 0.0
}

class MixedVoicePlayer(
    context: Context,
    private val listener: Listener,
) : AutoCloseable {

    interface Listener {
        /** Audio of segment [index] became audible (as far as the platform reports it). */
        fun onSegmentStart(utteranceId: String, index: Int, voice: Voice) {}
        /** The gap before a segment is known. Drive the eyes' "hablar" state from these. */
        fun onGap(utteranceId: String, transition: Transition) {}
        fun onUtteranceDone(report: GapReport) {}
        fun onError(utteranceId: String?, index: Int, message: String) {}
    }

    private val thread = HandlerThread("p8-voice").apply { start() }
    private val handler = Handler(thread.looper)
    private val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANT)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    // Everything below is touched only on [thread].
    private var ttsReady = false
    private var ttsFailed = false
    private var pending: Run? = null
    private var run: Run? = null

    /** Plays [segments] in order, interrupting whatever was playing. */
    fun play(utteranceId: String, segments: List<VoiceSegment>) {
        handler.post {
            stopInternal()
            val needsTts = segments.any { it is VoiceSegment.Local }
            if (needsTts && ttsFailed) {
                listener.onError(utteranceId, -1, "TextToSpeech es-ES is not available")
                return@post
            }
            val r = Run(utteranceId, segments)
            run = r
            if (ttsReady || !needsTts) advance(r) else pending = r
        }
    }

    fun stop() {
        handler.post { stopInternal() }
    }

    override fun close() {
        handler.post {
            stopInternal()
            tts.shutdown()
            thread.quitSafely()
        }
    }

    // --- TextToSpeech ------------------------------------------------------

    private fun onTtsInit(status: Int) {
        if (status != TextToSpeech.SUCCESS) {
            fail("TextToSpeech init failed: $status")
            return
        }
        val lang = tts.setLanguage(Locale.forLanguageTag("es-ES"))
        if (lang == TextToSpeech.LANG_MISSING_DATA || lang == TextToSpeech.LANG_NOT_SUPPORTED) {
            fail("TextToSpeech has no es-ES voice: $lang")
            return
        }
        tts.setAudioAttributes(attributes)
        tts.setOnUtteranceProgressListener(progress)
        ttsReady = true
        // The first speak() binds the engine and is slow; pay that cost now, silently.
        tts.speak(" ", TextToSpeech.QUEUE_FLUSH,
            Bundle().apply { putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 0f) }, WARM_UP)
        pending?.let { r ->
            pending = null
            if (r === run) advance(r)
        }
    }

    private fun fail(message: String) {
        ttsFailed = true
        val r = pending ?: run
        pending = null
        listener.onError(r?.id, r?.index ?: -1, message)
    }

    // Callbacks arrive on a TTS binder thread: take the timestamp there, act on [thread].
    private val progress = object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {
            val now = SystemClock.elapsedRealtimeNanos()
            handler.post { withLocal(utteranceId) { r, i -> r.tentativeStartNs[i] = now } }
        }

        override fun onRangeStart(utteranceId: String?, start: Int, end: Int, frame: Int) {
            val now = SystemClock.elapsedRealtimeNanos()
            handler.post {
                withLocal(utteranceId) { r, i -> if (r.startNs[i] < 0) markStart(r, i, now) }
            }
        }

        override fun onDone(utteranceId: String?) {
            val now = SystemClock.elapsedRealtimeNanos()
            handler.post {
                withLocal(utteranceId) { r, i ->
                    if (r.startNs[i] < 0) markStart(r, i, r.tentativeStartNs[i].takeIf { it >= 0 } ?: now)
                    r.endNs[i] = now
                    advance(r)
                }
            }
        }

        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) = onError(utteranceId, TextToSpeech.ERROR)

        override fun onError(utteranceId: String?, errorCode: Int) {
            handler.post {
                withLocal(utteranceId) { r, i ->
                    listener.onError(r.id, i, "TextToSpeech error $errorCode")
                    stopInternal()
                }
            }
        }

        override fun onStop(utteranceId: String?, interrupted: Boolean) {}
    }

    // Declared after [progress]: onTtsInit may run on [thread] as soon as the engine binds.
    private val tts: TextToSpeech = TextToSpeech(context.applicationContext) { status ->
        handler.post { onTtsInit(status) }
    }

    private inline fun withLocal(utteranceId: String?, block: (Run, Int) -> Unit) {
        val r = run ?: return
        if (r.cancelled || utteranceId == null || utteranceId == WARM_UP) return
        val i = utteranceId.substringAfterLast('#').toIntOrNull() ?: return
        if (utteranceId != r.key(i) || i != r.index) return
        block(r, i)
    }

    // --- sequencing --------------------------------------------------------

    private class Run(val id: String, val segments: List<VoiceSegment>) {
        var index = -1
        var cancelled = false
        val startNs = LongArray(segments.size) { -1L }
        val tentativeStartNs = LongArray(segments.size) { -1L }
        val endNs = LongArray(segments.size) { -1L }
        val tracks = arrayOfNulls<CloudTrack>(segments.size)
        val transitions = mutableListOf<Transition>()
        fun key(i: Int) = "$id#$i"
    }

    private fun advance(r: Run) {
        if (r !== run || r.cancelled) return
        r.index += 1
        val i = r.index
        if (i == r.segments.size) {
            run = null
            val report = GapReport(r.id, r.transitions.toList())
            Log.i(TAG, "utterance ${r.id}: ${report.voiceSwitches.size} voice switches, " +
                "max ${"%.0f".format(report.maxMs)} ms, mean ${"%.0f".format(report.meanMs)} ms")
            listener.onUtteranceDone(report)
            return
        }
        // Buffer the next cloud clip while this segment plays, so it starts with play() alone.
        prime(r, i + 1)
        when (val seg = r.segments[i]) {
            is VoiceSegment.Cloud -> {
                val track = prime(r, i)!!
                track.play()
                handler.post { pollCloud(r, i) }
            }
            is VoiceSegment.Local ->
                tts.speak(seg.text, TextToSpeech.QUEUE_FLUSH, Bundle(), r.key(i))
        }
    }

    private fun prime(r: Run, i: Int): CloudTrack? {
        val seg = r.segments.getOrNull(i) as? VoiceSegment.Cloud ?: return null
        return r.tracks[i] ?: CloudTrack(seg.audio, attributes).also {
            r.tracks[i] = it
            it.startFeeding()
        }
    }

    /** Cloud start and end come from the playback head: start when it moves, end when it passes the last real frame. */
    private fun pollCloud(r: Run, i: Int) {
        if (r !== run || r.cancelled || r.index != i) return
        val track = r.tracks[i] ?: return
        track.failure?.let {
            listener.onError(r.id, i, "cloud audio failed: ${it.message}")
            stopInternal()
            return
        }
        val now = SystemClock.elapsedRealtimeNanos()
        val head = track.headFrames()
        if (r.startNs[i] < 0 && head > 0) markStart(r, i, now)
        if (track.feedingDone && head >= track.framesWritten) {
            if (r.startNs[i] < 0) markStart(r, i, now)
            r.endNs[i] = now
            track.release() // cuts the silence padding
            r.tracks[i] = null
            advance(r)
            return
        }
        handler.postDelayed({ pollCloud(r, i) }, POLL_MS)
    }

    private fun markStart(r: Run, i: Int, ns: Long) {
        r.startNs[i] = ns
        listener.onSegmentStart(r.id, i, r.segments[i].voice)
        if (i > 0 && r.endNs[i - 1] >= 0) {
            val t = Transition(i - 1, i, r.segments[i - 1].voice, r.segments[i].voice,
                (ns - r.endNs[i - 1]) / 1_000_000.0)
            r.transitions += t
            listener.onGap(r.id, t)
        }
    }

    private fun stopInternal() {
        pending = null
        val r = run ?: return
        r.cancelled = true
        run = null
        tts.stop()
        r.tracks.forEachIndexed { i, t ->
            t?.release()
            r.tracks[i] = null
        }
    }

    /**
     * One AudioTrack per cloud clip. A feeder thread owns the track: it writes
     * the PCM as it arrives (before play() too, which primes the buffer), pads
     * with one buffer of silence so a clip shorter than the start threshold
     * still plays, then waits for release() and releases the track itself.
     */
    private class CloudTrack(private val source: PcmSource, attributes: AudioAttributes) {
        private val bufferBytes: Int
        private val track: AudioTrack
        private val releaseLatch = CountDownLatch(1)
        private val feeder = Thread(::feed, "p8-voice-feed").apply { isDaemon = true }

        /** Real audio frames written, without the padding. */
        @Volatile var framesWritten = 0L
            private set
        @Volatile var feedingDone = false
            private set
        @Volatile var failure: Throwable? = null
            private set
        @Volatile private var released = false

        init {
            val min = AudioTrack.getMinBufferSize(
                source.sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
            bufferBytes = maxOf(min, source.sampleRate / 10 * BYTES_PER_FRAME) // >= 100 ms
            track = AudioTrack.Builder()
                .setAudioAttributes(attributes)
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(source.sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build())
                .setTransferMode(AudioTrack.MODE_STREAM)
                .setBufferSizeInBytes(bufferBytes)
                .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                .build()
        }

        fun startFeeding() = feeder.start()

        fun play() = track.play()

        fun headFrames(): Long = track.playbackHeadPosition.toLong() and 0xFFFF_FFFFL

        fun release() {
            if (released) return
            released = true
            runCatching {
                track.pause()
                track.flush()
            }
            releaseLatch.countDown()
            feeder.interrupt() // unblocks source.read()
        }

        private fun feed() {
            var carry: Byte? = null // 16-bit frames: keep an odd trailing byte for the next chunk
            try {
                while (!released) {
                    val chunk = source.read() ?: break
                    val data = carry?.let { byteArrayOf(it) + chunk } ?: chunk
                    val even = data.size - data.size % BYTES_PER_FRAME
                    carry = if (even < data.size) data[data.size - 1] else null
                    writeFully(data, even)
                    framesWritten += even / BYTES_PER_FRAME
                }
                feedingDone = true
                writeFully(ByteArray(bufferBytes), bufferBytes)
                releaseLatch.await()
            } catch (e: InterruptedException) {
                // release() while waiting for audio: nothing to report
            } catch (t: Throwable) {
                if (!released) failure = t
            } finally {
                track.release()
            }
        }

        /** Non-blocking writes, so release() never waits on a full buffer. */
        private fun writeFully(data: ByteArray, size: Int) {
            var off = 0
            while (off < size && !released) {
                val n = track.write(data, off, size - off, AudioTrack.WRITE_NON_BLOCKING)
                if (n < 0) throw IllegalStateException("AudioTrack.write error $n")
                off += n
                if (n == 0) Thread.sleep(WRITE_RETRY_MS)
            }
        }
    }

    private companion object {
        const val TAG = "P8Voice"
        const val WARM_UP = "p8-warm-up"
        const val POLL_MS = 5L
        const val WRITE_RETRY_MS = 5L
        const val BYTES_PER_FRAME = 2
    }
}
