# MixedVoicePlayer (Android)

`MixedVoicePlayer.kt` plays one utterance of mixed voice on the phone: cloud segments as PCM streamed from ElevenLabs, local segments through `android.speech.tts.TextToSpeech` in es-ES, back to back, measuring the gap at every switch.

It is a single self-contained source file. It lives here until `apps/android-8/` (branch `feat/android-skeleton`) is on main; then it moves to that app and this folder goes away.

## Requirements

- minSdk 26 (`UtteranceProgressListener.onRangeStart`, `AudioAttributes.USAGE_ASSISTANT`, `AudioTrack` performance mode).
- Only the Android SDK and the Kotlin standard library. No coroutines, no ExoPlayer.
- A TextToSpeech engine with a Spanish (es-ES) voice. The emulator images with Google Play ship Google's engine; install the Spanish voice data once in Settings, otherwise `onError` reports "no es-ES voice".

Checked by compiling the file with Kotlin 2.1.21 against `android.jar` of API 35 and 36: no errors and no warnings. Not run on a device yet.

## Integration

1. Copy the file into the app module (package `ai.priv8.voice`, or change the package line).
2. When a `voice` event arrives (`docs/contracts/voice.schema.json`, contracts v1), turn every segment into a `VoiceSegment`:
   - `{"voice":"cloud","text":...}` → `VoiceSegment.Cloud(QueuePcmSource(24_000))`. Push the PCM chunks that the core relays from ElevenLabs into it as they arrive and call `end()` after the last one (`fail(e)` on error). The phone never sends the text anywhere.
   - `{"voice":"local","token":...,"say_as":...}` → `VoiceSegment.Local(spoken)`, where `spoken` is the real value as the local voice must say it. The contract carries only the token: the app's local renderer resolves it, and the Spanish spelling-out (`"1.234,56 €"` → "mil doscientos treinta y cuatro euros con cincuenta y seis") is `voice/verbalize.py` on the core, so either the core sends `Segment.spoken` over the trusted bridge or the rules are ported to Kotlin. To be decided at integration.
   - `{"voice":"local","text":...}` → `VoiceSegment.Local(text)`: a sentence the final block kept on the device.
3. Call `player.play(utteranceId, segments)` as soon as the utterance arrives: the first cloud clip starts playing while its later chunks are still streaming.
4. Use `Listener.onSegmentStart` and `onGap` to drive 8's "hablar" state, and send `onUtteranceDone(report)` back to the core so it lands in the audit log as a `voice_out` event.

Bridge framing for the PCM is not in `bridge.schema.json` (contracts v1) yet. Proposal for `docs/contracts/`: one text frame `{"type":"voice.audio","utterance":"u18","index":0,"format":"pcm_24000"}`, then binary frames with the PCM, then `{"type":"voice.audio.end","utterance":"u18","index":0}`.

## How it chains the voices

- Each cloud clip has its own `AudioTrack` in streaming mode. While a segment plays, the next cloud clip is already being written into its track (primed), so it starts with `play()` alone.
- A short clip is padded with one buffer of silence so it crosses the track's start threshold. The end of the clip is the moment the playback head passes the last real frame; the track is paused and flushed there, so the padding is never heard.
- A local segment is spoken with `QUEUE_FLUSH` as soon as the previous segment ends. TextToSpeech is warmed up at init with a silent utterance, because the first `speak()` binds the engine and is slow.

## How the gap is measured

All timestamps are `SystemClock.elapsedRealtimeNanos()`.

| Event | Cloud segment | Local segment |
|---|---|---|
| start | first poll (every 5 ms) where `AudioTrack.playbackHeadPosition > 0` | first `onRangeStart`, or `onStart` if the engine does not report ranges |
| end | first poll where the head has passed the last real frame | `onDone` |

The gap of a transition `i → i+1` is `start(i+1) − end(i)` in milliseconds. `GapReport.voiceSwitches` keeps the cloud ↔ local transitions; `maxMs` and `meanMs` summarize them.

Limits of the measure: the cloud side is read from the playback head (about 5 ms resolution) and includes neither the device's output latency nor the time before the first chunk arrives, which is already buffered when the segment starts. The local side relies on what the TTS engine reports; `onRangeStart` and `onDone` can lead or lag the sound by a few tens of milliseconds depending on the engine. To check the number once on the demo device, record the speaker output and compare the silences with the report.

If the cloud → local gap is too long on the demo device (the engine's start latency), the fallback is to pre-render the local segments with `TextToSpeech.synthesizeToFile` while the cloud clip plays and play the WAV through an `AudioTrack` as well.
