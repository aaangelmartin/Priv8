"""Dictado en el portátil con Whisper en local (issue #47, opción B).

El reconocedor de voz del emulador no funciona, así que la app 8 en el emulador
manda dictation_start por el canal de eventos y el núcleo:

1. graba el micrófono del portátil hasta que la persona calla (máximo unos segundos),
2. lo transcribe aquí mismo con faster-whisper (español, modelo small por defecto),
3. devuelve dictation con el texto a la app 8 (solo por el canal local) y
4. encola la tarea con core.submit_task, que la audita sin el texto.

El audio no sale nunca del portátil: no hay reconocedor en la nube. Lo único que
baja de internet es el modelo, una vez, a la caché local de Hugging Face. Lo oído
no se escribe en los logs: puede llevar datos («pasa 200 € a Marta»).

Dependencias opcionales (make dictado-install): faster-whisper y sounddevice.
Sin ellas el resto del repositorio funciona y dictate() responde no_disponible.

    python -m voice.dictado prueba.wav     transcribe un WAV
    python -m voice.dictado --mic          graba el micro y transcribe
    python -m voice.dictado --download     baja el modelo a la caché

PRIV8_WHISPER_MODEL cambia el modelo (tiny, base, small...).
"""

from __future__ import annotations

import logging
import math
import os
import re
import sys
import threading
import wave
from array import array
from collections.abc import Callable, Sequence
from typing import Any

log = logging.getLogger("priv8.dictado")

RATE = 16_000            # Whisper trabaja a 16 kHz mono
MAX_S = 7.0              # una orden, no un dictado largo
SILENCE_S = 1.2          # silencio tras la voz que da la orden por terminada
CHUNK_S = 0.1
SPEECH_RMS = 0.015       # umbral de voz en float [-1, 1]
MAX_CHARS = 200          # como Dictado.MAX de la app 8
LANG = "es"
# Vocabulario de la demo: ayuda a Whisper con «bróker» o «Brezo» sin inventar nada.
PROMPT = "¿Cuánto tengo entre mis bancos? Pasa 200 € al bróker. Banca Alcor, Brezo Banco, Nimbo Bróker."

os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")


def model_name() -> str:
    return os.environ.get("PRIV8_WHISPER_MODEL", "small")


def missing() -> str | None:
    """Qué falta para dictar en el portátil, o None si está todo."""
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return "falta faster-whisper (make dictado-install)"
    return None


# ---- texto ----

def clean(text: str) -> str:
    """El texto de Whisper como tarea: espacios, longitud y mayúscula (también tras ¿ o ¡)."""
    t = re.sub(r"\s+", " ", text or "").strip()
    if not any(c.isalnum() for c in t):
        return ""
    t = t[:MAX_CHARS].rstrip()
    i = next((k for k, c in enumerate(t) if c.isalpha()), -1)
    return t if i < 0 else t[:i] + t[i].upper() + t[i + 1:]


# ---- audio ----

def rms(chunk: Sequence[float]) -> float:
    return math.sqrt(sum(x * x for x in chunk) / len(chunk)) if len(chunk) else 0.0


def should_stop(levels: Sequence[float], chunk_s: float = CHUNK_S, max_s: float = MAX_S,
                silence_s: float = SILENCE_S, threshold: float = SPEECH_RMS) -> bool:
    """Con los niveles (RMS) de los trozos grabados hasta ahora: ¿se para ya?

    Para al llegar a max_s, o tras silence_s de silencio cuando ya hubo voz."""
    if len(levels) * chunk_s >= max_s:
        return True
    spoke = [i for i, v in enumerate(levels) if v >= threshold]
    if not spoke:
        return False
    return (len(levels) - 1 - spoke[-1]) * chunk_s >= silence_s


def load_wav(path: str) -> list[float]:
    """WAV PCM 16 bits mono a 16 kHz como muestras float en [-1, 1]."""
    with wave.open(path, "rb") as w:
        if w.getsampwidth() != 2 or w.getnchannels() != 1 or w.getframerate() != RATE:
            raise ValueError(f"{path}: hace falta PCM 16 bits mono a {RATE} Hz")
        pcm = array("h", w.readframes(w.getnframes()))
    if sys.byteorder == "big":
        pcm.byteswap()
    return [x / 32768.0 for x in pcm]


def record_mic(max_s: float = MAX_S) -> Any:
    """Graba el micrófono del portátil hasta que la persona calla. Devuelve float32 a 16 kHz."""
    import numpy as np
    import sounddevice as sd

    block = int(RATE * CHUNK_S)
    chunks: list[Any] = []
    levels: list[float] = []
    with sd.InputStream(samplerate=RATE, channels=1, dtype="float32", blocksize=block) as stream:
        while True:
            data, _ = stream.read(block)
            mono = data[:, 0].copy()
            chunks.append(mono)
            levels.append(float(np.sqrt(np.mean(mono * mono))))
            if should_stop(levels, max_s=max_s):
                break
    log.info("dictado: %.1f s grabados", len(chunks) * CHUNK_S)
    return np.concatenate(chunks) if chunks else np.zeros(0, dtype="float32")


# ---- Whisper ----

_model: Any = None
_model_lock = threading.Lock()


def load_model(local_only: bool = False) -> Any:
    """El modelo, una vez por proceso. CPU e int8: va bien en un portátil."""
    global _model
    with _model_lock:
        if _model is None:
            from faster_whisper import WhisperModel
            _model = WhisperModel(model_name(), device="cpu", compute_type="int8",
                                  local_files_only=local_only)
        return _model


def transcribe(audio: Any) -> str:
    """Audio (ruta a un WAV o muestras float a 16 kHz) a texto, en español y en local."""
    import numpy as np
    if isinstance(audio, str):  # sin PyAV: su decodificador no va con av 19
        audio = load_wav(audio)
    if isinstance(audio, list):
        audio = np.asarray(audio, dtype="float32")
    segments, _ = load_model().transcribe(audio, language=LANG, beam_size=5, vad_filter=True,
                                          initial_prompt=PROMPT, condition_on_previous_text=False)
    return " ".join(s.text.strip() for s in segments)


# ---- dictation_start ----

_busy = threading.Lock()


def dictate(session: str, *, record: Callable[[], Any] = record_mic,
            recognize: Callable[[Any], str] = transcribe,
            publish: Callable[[dict[str, Any]], None] | None = None,
            submit: Callable[..., Any] | None = None,
            check: Callable[[], str | None] = missing) -> str:
    """Una orden dictada en el portátil. Manda dictation a la app 8 y encola la tarea.

    Devuelve el texto ('' si no hubo). Si ya hay un dictado en curso, no hace nada."""
    if publish is None or submit is None:
        import core
        from core import events
        publish = publish or events.publish
        submit = submit or core.submit_task

    def reply(text: str, error: str | None = None) -> None:
        msg: dict[str, Any] = {"type": "dictation", "session": session, "text": text}
        if error:
            msg["error"] = error
        publish(msg)

    if not _busy.acquire(blocking=False):
        log.info("dictado: ya hay uno en curso")
        return ""
    try:
        why = check()
        if why:
            log.info("dictado off: %s", why)
            reply("", "no_disponible")
            return ""
        try:
            text = clean(recognize(record()))
        except Exception as exc:  # noqa: BLE001 - sin micro, sin modelo...: se dice, no se cae
            log.info("dictado: falló %s", type(exc).__name__)
            reply("", "no_disponible")
            return ""
        if not text:
            log.info("dictado: no se entendió nada")
            reply("", "sin_voz")
            return ""
        log.info("dictado: tarea lista (%d caracteres)", len(text))
        reply(text)
        submit(session, text, via="dictado")
        return text
    finally:
        _busy.release()


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if argv[0] == "--download":
        load_model()
        print(f"modelo {model_name()} en la caché local")
        return 0
    audio = record_mic() if argv[0] == "--mic" else argv[0]
    print(clean(transcribe(audio)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
