"""Verification call (#23): 8 phones the supplier at the number on the master record.

Only the ficha number may be dialled (never the one from the email). The call
opens with an AI disclosure and a recording notice, asks the challenge
question, and the transcript is tokenized before the model sees it. The
answer is compared locally in the vault (no oracle budget is spent); no value is
returned. The phone number is the only value that leaves (audit kind "call").

Modes
- dry-run (default, when ELEVENLABS_* are not all set): simulated transcript.
- live: ElevenLabs Conversational AI outbound call over Twilio. UNTESTED: no
  key yet. All the HTTP lives in `_live_call` and the endpoint shape there
  is from memory of the docs and must be verified.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.request
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Callable

import core

SEED = Path(__file__).resolve().parent.parent / "data" / "seed.json"
LIVE_VARS = ("ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID", "ELEVENLABS_PHONE_NUMBER_ID")
API = "https://api.elevenlabs.io"
INVOICE_RE = re.compile(r"\bF-\d{4}-\d{3,6}\b")
FACTURA_TOKEN_RE = re.compile(r"‹FACTURA_\d+[^›]*›")


class WrongNumber(ValueError):
    pass


def _digits(n: str) -> str:
    d = re.sub(r"\D", "", n)
    return d[2:] if d.startswith("34") and len(d) == 11 else d


def seed_verificacion() -> dict[str, str]:
    v = json.loads(SEED.read_text(encoding="utf-8"))["verificacion"]
    return {"numero": v["telefono_ficha"], "pregunta": v["pregunta"], "respuesta": v["respuesta"]}


class VerificationCall:
    def __init__(self, numero: str, pregunta: str, respuesta_esperada: str, session: str, *,
                 ficha: str | None = None, env: Mapping[str, str] | None = None,
                 dry_answer: str = "F-2026-0371") -> None:
        ficha = ficha or seed_verificacion()["numero"]
        if _digits(numero) != _digits(ficha):
            raise WrongNumber("solo se llama al teléfono de la ficha")
        self.numero, self.pregunta, self.session = numero, pregunta, session
        self._esperada = respuesta_esperada
        self._env = os.environ if env is None else env
        self._dry_answer = dry_answer

    @property
    def live(self) -> bool:
        return all(self._env.get(k) for k in LIVE_VARS)

    def opening(self) -> str:
        return ("Le llama 8, un asistente de IA de Talleres Norte. La llamada se graba para "
                "verificar un dato. ¿Puede atenderme un momento? " + self.pregunta)

    def _dry_call(self) -> str:
        return (f"Proveedor: Sí, dígame. Asistente: {self.pregunta} "
                f"Proveedor: Es la {self._dry_answer}. Y no, no hemos cambiado de banco.")

    def _live_call(self) -> str:  # UNVERIFIED endpoint shape; isolated on purpose
        hdr = {"xi-api-key": self._env["ELEVENLABS_API_KEY"], "Content-Type": "application/json"}

        def req(method: str, path: str, body: dict | None = None) -> dict[str, Any]:
            r = urllib.request.Request(API + path, method=method, headers=hdr,
                                       data=json.dumps(body).encode() if body else None)
            with urllib.request.urlopen(r, timeout=30) as resp:  # noqa: S310
                return json.loads(resp.read())

        out = req("POST", "/v1/convai/twilio/outbound-call", {
            "agent_id": self._env["ELEVENLABS_AGENT_ID"],
            "agent_phone_number_id": self._env["ELEVENLABS_PHONE_NUMBER_ID"],
            "to_number": "+34" + _digits(self.numero),
            "conversation_initiation_client_data": {"conversation_config_override": {
                "agent": {"first_message": self.opening()}}},
        })
        cid = out["conversation_id"]
        for _ in range(60):
            conv = req("GET", f"/v1/convai/conversations/{cid}")
            if conv.get("status") in ("done", "failed"):
                return " ".join(f"{t['role']}: {t.get('message') or ''}"
                                for t in conv.get("transcript", []))
            time.sleep(5)
        raise TimeoutError("la llamada no terminó")

    def _tokenize(self, text: str) -> str:
        vault = core.SESSIONS.get(self.session).vault
        text = INVOICE_RE.sub(lambda m: vault.tokenize("FACTURA", m.group(0), "tercero"), text)
        return core.tokenize_text(self.session, text, origen="tercero")

    def run(self) -> dict[str, Any]:
        t0 = time.perf_counter()
        core.record({"session": self.session, "kind": "call",
                     "model_saw": "llamada de verificación a la ficha del proveedor",
                     "tokens": [], "detail": f"{self.numero} · {'live' if self.live else 'dry-run'}",
                     "ms": {"core": int((time.perf_counter() - t0) * 1000), "adapter": None, "model": None}})
        transcript = self._live_call() if self.live else self._dry_call()
        tokens_text = self._tokenize(transcript)
        expected = core.SESSIONS.get(self.session).vault.tokenize("FACTURA", self._esperada, "maestro")
        verificado = False
        for tok in FACTURA_TOKEN_RE.findall(tokens_text):
            if tok == expected:  # mismo valor normalizado en la sesión → mismo token
                verificado = True
                break
        return {"ok": True, "verificado": verificado, "transcript_tokens": tokens_text}


def make_on_call(session: str, *, pregunta: str | None = None,
                 respuesta: str | None = None) -> Callable[[str], bool]:
    seed = seed_verificacion()

    def on_call(numero: str) -> bool:
        try:
            call = VerificationCall(numero, pregunta or seed["pregunta"],
                                    respuesta or seed["respuesta"], session)
        except WrongNumber:
            return False
        res = call.run()
        return bool(res["ok"] and res["verificado"])

    return on_call
