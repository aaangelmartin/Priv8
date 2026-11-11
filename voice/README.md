# Voz mixta, llamadas y dictado (`voice/`)

8 habla con dos voces: ElevenLabs lee las frases sin datos y la voz local (TextToSpeech en el móvil, Web Speech en la consola) lee cifras y nombres, así que un valor real nunca llega a la voz en la nube. Aquí están también la llamada al banco en nombre de la persona (#24) y el dictado con Whisper en el portátil (#47).

```
modelo       «Entre tus tres cuentas tienes ‹SUMA_1›.»
                     │
segmentador          ├─ nube   "Entre tus tres cuentas tienes"  → bloqueo final → ElevenLabs → PCM → móvil
                     └─ local  ‹SUMA_1› - currency              → bóveda + verbalizar → "cuatro mil ochocientos
                                                                   setenta y tres euros" → TextToSpeech
```

## Qué hay

| Archivo | Qué hace |
|---|---|
| `tokens.py` | Gramática de tokens de `docs/contracts/token.md`: `‹TIPO_n-etiqueta›` |
| `segmenter.py` | Plantilla y función de render → segmentos ordenados con la forma de `voice.schema.json` |
| `leak_check.py` | Bloqueo final de las frases para la nube: puerto `LeakCheck` y `PatternLeakCheck` por defecto |
| `verbalize.py` | Lectura en español para la voz local: importes, números, IBAN y códigos |
| `elevenlabs_client.py` | TTS en streaming con el SDK oficial de ElevenLabs, con bloqueo final antes de cada petición |
| `ivr_alcor.py` | Línea telefónica simulada de Banca Alcor (menú por DTMF, espera, gestor) |
| `bank_call.py` | `BankCall`: el lado de 8 en la llamada al banco (#24) |
| `call.py` | Llamada de verificación al proveedor, al teléfono de la ficha (#23) |
| `dictado.py` | Dictado local con faster-whisper para el emulador (#47) |
| `requirements.txt` | Dependencias fijadas para usar la voz fuera de `uv` (SDK de ElevenLabs) |
| `tests/` | pytest |

En el móvil, `apps/android-8/app/src/main/java/es/priv8/ocho/voz/MixedVoicePlayer.kt` reproduce los segmentos y mide el hueco entre voces; `VozMixta.kt` le pasa los mensajes `voice` del núcleo.

## Uso

```bash
make llamada-banco                                              # objetivo: hablar con un gestor
make llamada-banco OBJETIVO="No reconozco un cargo" VOZ=texto   # la línea pide el PIN: se pasa a la persona
make linea-alcor                                                # la línea como servicio en :8711
PRIV8_IVR_URL=http://127.0.0.1:8711 make llamada-banco          # la misma llamada por HTTP
make dictado-install                                            # una vez: extra dictado y modelo small
make dictado                                                    # dicta una vez desde el micrófono
make dictado FILE=frase.wav                                     # transcribe un WAV mono de 16 kHz
```

Para probar una voz real con clave: copiar `voice/.env.example` a `voice/.env`, rellenarlo, cargarlo en el entorno y llamar a `CloudVoice.from_env().stream_text("Entre tus tres cuentas tienes")`.

## Pruebas

```bash
uv run pytest voice/tests
```

Desde la raíz del repositorio (también entra en `make test`). Los tests de contrato leen `docs/contracts/`. El cliente de ElevenLabs se importa solo cuando se usa: los tests inyectan un cliente falso y ninguno llama a la API real. El test de dictado con el modelo real se salta si el modelo no está en la caché.

## Detalles

**Segmentador.** `segment(template, render, utterance=..., session=..., leak_check=..., audit=...)` devuelve un `Utterance` cuyo `to_contract()` valida contra `docs/contracts/voice.schema.json`.

- Cada token es un segmento local. `say_as` sale del tipo: `IMPORTE`, `SUMA` → `currency`; `IBAN` → `iban`; `TEL` → `phone`; `DNI`, `NIE`, `CIF`, `FACTURA`, `CODIGO` → `digits`; `PERSONA`, `PROVEEDOR` → `name`; el resto → `text`.
- `render(token, say_as)` corre en la zona de confianza. `VaultRenderer(table)` busca el token (con o sin etiqueta) y lo verbaliza; un token desconocido lanza un error, nunca se adivina. Lo dicho queda en `Segment.spoken` y no aparece en la forma del contrato, que es segura para el canal de eventos y la auditoría.
- **Bloqueo final.** Cada frase para la nube pasa por el control de fugas. Si una falla, no sale nada a la nube: la frase entera se lee en local, se marca `Utterance.blocked` y la auditoría recibe `{"kind":"blocked","reason":"fuga","target":"elevenlabs","findings":[...]}` con el tipo de hallazgo, nunca el valor.

**Control de fugas.** `LeakCheck` es un puerto (`check(text) -> list[Finding]`); el detector canónico es el del núcleo. `PatternLeakCheck(known_values=...)` rechaza IBAN con mod-97 válido, DNI y NIE con la letra correcta, tarjetas que pasan Luhn, importes en cifras o en palabras, cualquier dígito, `‹` o `›`, y los valores de la bóveda de la sesión (sin distinguir mayúsculas, tildes ni puntuación, por palabras enteras). `CloudVoice` repite el control antes de cada petición.

**ElevenLabs.** `CloudVoice.from_env()` lee `ELEVENLABS_API_KEY` y `ELEVENLABS_VOICE_ID` (ver `.env.example`) y, si se dan, el modelo (`eleven_flash_v2_5`), el formato (`pcm_24000`, que el móvil escribe directo en un `AudioTrack`) y el idioma (`es`). Usa `elevenlabs==2.77.0`. `stream_utterance(u)` da `(índice de segmento, trozo)` de los segmentos de la nube. `previous_text` y `next_text` no se mandan nunca, porque el texto vecino suele ser un dato.

**Hueco entre voces.** En cada cambio de voz dentro de una frase, el tiempo entre el final del audio de un segmento y el inicio del siguiente, en ms, medido en el móvil con `SystemClock.elapsedRealtimeNanos()`. `MixedVoicePlayer` lo informa con `Listener.onGap` y, por frase, un `GapReport` con el máximo y la media. La cifra de la demo es el máximo sobre las frases de la demo, con la media al lado. Aún sin medir: necesita el reproductor en el emulador con una clave real.

**Llamar al banco (#24).** Reglas en código y tests (`voice/tests/test_bank_call.py`):

- Primero el aviso: lo primero que 8 manda a la línea es `AVISO` («le llama Ocho, un asistente de inteligencia artificial, en nombre de un cliente...»). Cuando contesta una persona, 8 se presenta otra vez y pasa la llamada.
- Lo rojo y la identidad son de la persona: 8 solo pulsa una tecla ofrecida en el menú que acaba de oír (`_pulsa`) y solo dice sus frases fijas (`FRASES`). Si la línea pide PIN, código, clave, tarjeta o documento, 8 pasa la llamada (`blocked` - `rojo` en la auditoría).
- El objetivo de la persona y cada mensaje de la línea pasan por `core.tokenize_text` antes de que 8 decida; `BankCall.modelo_vio` guarda lo que recibió el navegador.
- Auditoría con `core.record`, tipo `call`, para inicio, aviso, cada tecla, espera y traspaso.

| | Por defecto (sin claves) | Con claves |
|---|---|---|
| Línea | `LineaLocal` o `LineaHttp` (`PRIV8_IVR_URL`) | `PRIV8_LLAMADA_REAL=1` + `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER_ID`, `PRIV8_BANCO_TEL`: `LiveBankCall` (ElevenLabs sobre Twilio, sin probar) |
| Elección en el menú | `NavegadorLocal`, por palabras clave | `PRIV8_LLAMADA_NAVEGADOR=claude` + `ANTHROPIC_API_KEY`: `NavegadorClaude`, solo texto con tokens |
| Voz de 8 | `VOZ=auto`: voz del sistema (`say`, `espeak`); `VOZ=texto` sin voz | `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` |

**Dictado (#47).** El reconocedor del emulador no funciona, así que la app 8 manda `dictation_start` por el canal de eventos y el núcleo transcribe el micrófono del portátil con Whisper en local (hasta 1,2 s de silencio, 7 s como mucho; faster-whisper small, `es`, CPU int8). En un Android real lo hace el reconocedor del dispositivo y la app manda `task_request`. El audio no sale nunca del móvil ni del portátil; solo el modelo se descarga. `PRIV8_WHISPER_MODEL=base` usa uno más pequeño. Lo oído no se registra: la auditoría guarda un `task` con los tokens y la longitud. Sin el extra, `dictation_start` responde `{"type":"dictation","text":"","error":"no_disponible"}`.
