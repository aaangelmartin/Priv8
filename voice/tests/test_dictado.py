"""Dictado en el portátil (#47, opción B): Whisper en local, sin micro ni modelo en CI.

El audio de prueba sale de la voz del Mac (say -v Monica) a un WAV de 16 kHz.
El test con el modelo real se salta si faster-whisper o el modelo no están.
"""

import json
import math
import shutil
import subprocess
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from voice import dictado

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "docs" / "contracts"
FRASE = "¿cuánto tengo entre mis bancos?"


def events_validator():
    base = "https://priv8.dev/contracts/"
    reg = Registry().with_resources(
        (base + p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
        for p in CONTRACTS.glob("*.schema.json"))
    return Draft202012Validator({"$ref": base + "events.schema.json"}, registry=reg)


@pytest.fixture(scope="module")
def wav(tmp_path_factory):
    if not (shutil.which("say") and shutil.which("afconvert")):
        pytest.skip("hace falta la voz de macOS (say, afconvert)")
    d = tmp_path_factory.mktemp("dictado")
    aiff, out = d / "frase.aiff", d / "frase.wav"
    subprocess.run(["say", "-v", "Monica", "-o", str(aiff), FRASE], check=True)
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", str(aiff), str(out)], check=True)
    return out


# ---- texto y silencio ----

def test_clean_deja_la_tarea_lista():
    assert dictado.clean("  ¿cuánto   tengo entre mis bancos? ") == "¿Cuánto tengo entre mis bancos?"
    assert dictado.clean(" … ") == ""
    assert len(dictado.clean("palabra " * 100)) <= dictado.MAX_CHARS


def test_para_tras_el_silencio_o_al_maximo():
    voz, nada = 0.1, 0.0
    assert not dictado.should_stop([nada] * 20)                 # aún no ha hablado
    assert not dictado.should_stop([voz] * 5 + [nada] * 5)      # pausa corta
    assert dictado.should_stop([voz] * 5 + [nada] * 13)         # 1,2 s de silencio
    assert dictado.should_stop([nada] * int(dictado.MAX_S / dictado.CHUNK_S))


def test_wav_de_say(wav):
    audio = dictado.load_wav(str(wav))
    assert 1.0 < len(audio) / dictado.RATE < 6.0
    block = int(dictado.RATE * dictado.CHUNK_S)
    levels = [dictado.rms(audio[i:i + block]) for i in range(0, len(audio), block)]
    assert max(levels) >= dictado.SPEECH_RMS
    assert all(-1.0 <= x <= 1.0 for x in audio[:1000]) and not math.isnan(levels[0])


# ---- dictation_start de punta a punta, con dobles ----

def run(text=None, *, error=None, check=lambda: None):
    sent, tasks = [], []

    def recognize(_audio):
        if error:
            raise error
        return text

    out = dictado.dictate("b2c", record=lambda: [0.0], recognize=recognize, publish=sent.append,
                          submit=lambda s, t, via: tasks.append((s, t, via)), check=check)
    return out, sent, tasks


def test_dictado_manda_el_texto_y_encola_la_tarea():
    out, sent, tasks = run(" ¿cuánto tengo entre mis bancos?")
    assert out == "¿Cuánto tengo entre mis bancos?"
    assert sent == [{"type": "dictation", "session": "b2c", "text": out}]
    assert tasks == [("b2c", out, "dictado")]
    assert events_validator().is_valid(sent[0])


def test_sin_voz_no_encola():
    out, sent, tasks = run("  ")
    assert (out, tasks) == ("", [])
    assert sent == [{"type": "dictation", "session": "b2c", "text": "", "error": "sin_voz"}]
    assert events_validator().is_valid(sent[0])


def test_sin_whisper_o_sin_micro_lo_dice():
    _, sent, tasks = run(check=lambda: "falta faster-whisper")
    assert sent[0]["error"] == "no_disponible" and not tasks
    _, sent, tasks = run(error=OSError("sin micrófono"))
    assert sent[0]["error"] == "no_disponible" and not tasks


# ---- con el modelo real ----

def test_whisper_real_entiende_la_frase(wav):
    pytest.importorskip("faster_whisper")
    try:
        dictado.load_model(local_only=True)
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"modelo {dictado.model_name()} no está en la caché (make dictado-install): {type(exc).__name__}")
    text = dictado.clean(dictado.transcribe(str(wav))).lower()
    assert "tengo" in text and "bancos" in text, text
