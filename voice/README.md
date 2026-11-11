# Voz mixta

8 speaks with two voices. ElevenLabs reads the sentences without data; the local voice (TextToSpeech on the phone, Web Speech in the console) reads the figures and the names. A real value never reaches the cloud voice.

```
model    «Entre tus tres cuentas tienes ‹SUMA_1›.»
                 │
segmenter        ├─ cloud  "Entre tus tres cuentas tienes"   → final block → ElevenLabs → PCM → phone
                 └─ local  ‹SUMA_1› · currency               → vault + verbalize → "cuatro mil ochocientos
                                                               setenta y tres euros" → TextToSpeech
```

## Pieces

| File | What it does |
|---|---|
| `tokens.py` | Token grammar from `docs/contracts/token.md`: `‹TIPO_n·etiqueta›` |
| `segmenter.py` | Template + render function → ordered segments in the `voice.schema.json` form |
| `leak_check.py` | Final block for cloud sentences. `LeakCheck` port and a default `PatternLeakCheck` |
| `verbalize.py` | Spanish spelling-out for the local voice: amounts, numbers, IBAN and codes |
| `elevenlabs_client.py` | Streaming TTS with the official ElevenLabs SDK, final block before every request |
| `android/MixedVoicePlayer.kt` | Plays the segments on the phone and measures the gap between voices ([README](android/README.md)) |

### Segmenter

`segment(template, render, utterance=..., session=..., leak_check=..., audit=...)` returns an `Utterance` whose `to_contract()` validates against `docs/contracts/voice.schema.json`:

```json
{"utterance":"u18","session":"s2","segments":[
  {"voice":"cloud","text":"Entre tus tres cuentas tienes"},
  {"voice":"local","token":"‹SUMA_1›","say_as":"currency"}]}
```

- Each token becomes a local segment; `say_as` comes from its type (`IMPORTE`, `SUMA` → `currency`; `IBAN` → `iban`; `TEL` → `phone`; `DNI`, `NIE`, `CIF`, `FACTURA`, `CODIGO` → `digits`; `PERSONA`, `PROVEEDOR` → `name`; the rest → `text`).
- `render(token, say_as)` runs in the trusted zone and returns what the local voice says. `VaultRenderer(table)` looks the token up (with or without its label) and verbalizes it. An unknown token raises; it is never guessed. The result is kept in `Segment.spoken` and never appears in the contract form, so that form is safe for the events channel and the audit log.
- Text between tokens that is only punctuation is dropped, and leftover punctuation at the start of a cloud sentence is trimmed (`". ¿Lo confirmas?"` → `"¿Lo confirmas?"`).
- **Final block.** Every cloud sentence goes through the leak check. If any one fails, nothing goes to the cloud: the whole sentence is read locally (cloud text becomes `{"voice":"local","text":...}`), `Utterance.blocked` is set and the audit sink gets `{"kind":"blocked","reason":"fuga","target":"elevenlabs","findings":[...]}` with the kinds of finding, never the values.

### Leak check

`LeakCheck` is a port: anything with `check(text) -> list[Finding]`. The canonical detector belongs to the core (issue "Bloqueo final en toda salida"); when it lands, wrap it and pass it in. Until then `PatternLeakCheck(known_values=...)` refuses:

- IBAN with a valid mod-97, DNI and NIE with the right letter, card numbers that pass Luhn;
- amounts in figures (`1.234,56 €`, `200€`, `3.412,58`) or in words (`doscientos euros`);
- any digit at all: figures are the local voice's job;
- `‹` or `›`, even in a broken token;
- the session's vault values, ignoring case, accents and punctuation, on whole words (so "Ana" does not fire inside "mañana"); values with digits are also matched without separators.

`CloudVoice` runs the check again right before each request, so a sentence that did not come through the segmenter cannot leave either.

### ElevenLabs

`CloudVoice.from_env()` reads `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` (see `.env.example`), and optionally the model (`eleven_flash_v2_5`, the lowest latency), the output format (`pcm_24000`, raw PCM the phone writes straight into an `AudioTrack`) and the language (`es`). It calls `client.text_to_speech.stream(voice_id, text=..., model_id=..., output_format=..., language_code=...)` from `elevenlabs==2.77.0` and yields the audio chunks. `stream_utterance(u)` yields `(segment index, chunk)` for the cloud segments, ready to relay to the phone.

`previous_text` and `next_text` are never sent, because the neighbouring text is usually a local segment, that is, data. There is no API key yet: the tests inject a fake client and nothing calls the live API.

## Run the tests

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r voice/requirements.txt
.venv/bin/python -m pytest voice
```

From the repository root. The contract tests read `docs/contracts/`. With contracts v1.1 they also check that an utterance, its `render_values`, the PCM framing and `voice.done` validate as bridge messages; with v1 that test is skipped.

To try a real voice once there is a key: copy `voice/.env.example` to `voice/.env`, fill it in, load it into the environment and call `CloudVoice.from_env().stream_text("Entre tus tres cuentas tienes")`.

## Gap between voices, for the demo

**Definition.** For every switch between voices inside one utterance (cloud → local or local → cloud), the gap is the time from the end of one segment's audio to the start of the next segment's audio, in milliseconds, measured on the phone with `SystemClock.elapsedRealtimeNanos()`:

- cloud start: the `AudioTrack` playback head moves; cloud end: the head passes the last real frame;
- local start: the first `onRangeStart` of the utterance (or `onStart`); local end: `onDone`.

`MixedVoicePlayer` reports each transition through `Listener.onGap` and, per utterance, a `GapReport` with the maximum and the mean over the voice switches. The figure for the demo is the **maximum gap over the demo utterances** (the sum across accounts and the transfer confirmation), with the mean beside it. The details and limits of the measure are in [android/README.md](android/README.md#how-the-gap-is-measured).

Not measured yet: it needs the player running on the emulator with a real ElevenLabs key.

## Dictation on the laptop (issue #47)

The emulator's speech recognizer does not work, so the app 8 on the emulator sends `dictation_start` over the events channel and the core transcribes the laptop microphone with Whisper, locally (`dictado.py`). On a real Android the phone's on-device recognizer does it and the app sends `task_request` with the text. No cloud recognizer in either path: the audio never leaves the phone or the laptop.

```
app 8 ─ dictation_start ─▶ core.server ─ microphone (until 1.2 s of silence, 7 s max)
                                        ─ faster-whisper small, es, CPU int8, local
                           ◀─ dictation {"text": "¿Cuánto tengo entre mis bancos?"}   (subtitle)
                              core.submit_task ─▶ core.next_task(session) ─▶ agent
```

- `make dictado-install` once: installs the optional `dictado` extra (`faster-whisper`, `sounddevice`, `numpy`) and downloads the model to the Hugging Face cache. Only the model comes from the internet. `PRIV8_WHISPER_MODEL=base` for a smaller one.
- `make dictado` records the microphone once and prints the text (macOS asks for microphone permission for the terminal the first time). `make dictado FILE=frase.wav` transcribes a 16 kHz mono WAV.
- What was heard is never logged; the audit keeps a `task` event with the tokens and the length of the task.
- Without the extra, `dictation_start` answers `{"type":"dictation","text":"","error":"no_disponible"}` and everything else works.
- Tests (`voice/tests/test_dictado.py`) use a WAV made with `say -v Monica`; the one with the real model is skipped if the model is not in the cache.
