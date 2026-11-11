"""Llamar al banco por ti (#24): 8 llama, se presenta como IA, pasa el menú y cede la llamada.

    uv run python -m voice.bank_call --objetivo "quiero hablar con un gestor"
    make llamada-banco OBJETIVO="bloquear la tarjeta"

Reglas
- Lo primero que dice 8 en la línea es que es un asistente de IA que llama en nombre
  de un cliente. Antes de eso no pulsa nada.
- 8 solo pulsa teclas del menú que acaba de oír. Nunca marca ni dice PIN, OTP, claves,
  la tarjeta completa ni el DNI: si la línea los pide, cede la llamada a la persona en
  ese momento. La identificación con el banco la hace siempre la persona.
- Cuando contesta una persona del banco, 8 se presenta otra vez, le pasa la llamada a
  su cliente y se retira.
- El objetivo de la persona y todo lo que dice la línea pasan por el detector del núcleo
  (core.tokenize_text) antes de que 8 decida: lo que va al modelo lleva tokens. Las
  frases de 8 en la línea son fijas y sin datos, así que pueden ir a la voz en la nube.
- Auditoría con core.record, kind "call" (y "blocked" con reason "rojo"), sin valores.

Modos
- Por defecto: la línea simulada de Banca Alcor (voice/ivr_alcor.py), dentro del proceso
  o por HTTP con --linea http://127.0.0.1:8711. Navegador por palabras clave, local.
- PRIV8_LLAMADA_NAVEGADOR=claude y ANTHROPIC_API_KEY: Claude elige la tecla, con el
  texto ya tokenizado y tras el bloqueo final (core.check).
- PRIV8_LLAMADA_REAL=1 y ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID,
  ELEVENLABS_PHONE_NUMBER_ID, PRIV8_BANCO_TEL: llamada real por ElevenLabs y Twilio.
  SIN PROBAR: no hay clave todavía. Todo el HTTP está en LiveBankCall.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.request
import wave
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol

import core
from core import tokens as T

from . import ivr_alcor

BANCO = "Banca Alcor"
API = "https://api.elevenlabs.io"
LIVE_VARS = ("ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID", "ELEVENLABS_PHONE_NUMBER_ID", "PRIV8_BANCO_TEL")

# Las frases de 8 en la línea: fijas, sin datos y sin cifras (la voz en la nube no lee cifras).
AVISO = (f"Hola, le llama Ocho, un asistente de inteligencia artificial, en nombre de un "
         f"cliente de {BANCO}. No daré datos de mi cliente: si hace falta identificarle, se lo paso.")
CEDER_HUMANO = ("Buenas. Le habla Ocho, un asistente de inteligencia artificial que llama en "
                "nombre de su cliente. Le paso con su cliente ahora; la identificación la hará "
                "con ustedes directamente. Gracias.")
CEDER_DATO = ("Ese dato solo lo puede dar mi cliente, así que le paso la llamada ahora. "
              "Mi cliente se identificará con ustedes directamente.")
CEDER_SIN_OPCION = "No encuentro la opción que busca mi cliente, así que le paso la llamada ahora."
FRASES = (AVISO, CEDER_HUMANO, CEDER_DATO, CEDER_SIN_OPCION)

MAX_PASOS = 20


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.casefold())
    return "".join(c for c in s if not unicodedata.combining(c))


# ---- lo que oye 8 ----

OPCION_RE = [re.compile(r"\bpara ([^.]+?),? pulse (\d)\b"), re.compile(r"\bpulse (\d),? para ([^.]+)")]
# Datos que la línea pide y que 8 nunca da: rojos, o la identificación de la persona.
PIDE_ROJO_RE = re.compile(
    r"\b(pin|clave|contrasena|codigo|otp|sms|cvv|cvc|digitos de (?:su|la) tarjeta|"
    r"numero (?:completo )?de (?:su|la) tarjeta|firma electronica)\b")
PIDE_IDENTIDAD_RE = re.compile(
    r"\b(dni|nie|pasaporte|documento de identidad|fecha de nacimiento|numero de cliente)\b")
VERBO_PIDE_RE = re.compile(r"\b(marque|diga|digame|introduzca|indique|facilite|teclee|confirme)\b")
HUMANO_RE = re.compile(r"\b(al habla|le atiende|en que puedo ayudarle|soy el gestor|soy la gestora)\b")
ESPERA_RE = re.compile(r"\b(espere|en espera|musica|no cuelgue|ocupados)\b")


@dataclass
class Oido:
    """Lo que 8 entiende de lo que dijo la línea (sobre el texto ya tokenizado)."""

    tipo: str  # menu | pide_rojo | pide_identidad | humano | espera | silencio | otro
    opciones: list[tuple[str, str]] = field(default_factory=list)  # (tecla, etiqueta)
    pide: str | None = None


def entender(texto_tokens: str) -> Oido:
    n = _norm(texto_tokens)
    if not n.strip():
        return Oido("silencio")
    if VERBO_PIDE_RE.search(n):
        m = PIDE_ROJO_RE.search(n)
        if m:
            return Oido("pide_rojo", pide=m.group(1))
        m = PIDE_IDENTIDAD_RE.search(n)
        if m:
            return Oido("pide_identidad", pide=m.group(1))
    opciones: list[tuple[str, str]] = []
    for m in OPCION_RE[0].finditer(n):
        opciones.append((m.group(2), m.group(1).strip()))
    for m in OPCION_RE[1].finditer(n):
        if m.group(1) not in {t for t, _ in opciones}:
            opciones.append((m.group(1), m.group(2).strip()))
    if opciones:
        return Oido("menu", opciones=opciones)
    if HUMANO_RE.search(n):
        return Oido("humano")
    if ESPERA_RE.search(n):
        return Oido("espera")
    return Oido("otro")


# ---- a dónde quiere ir la persona ----

INTENCIONES: dict[str, dict[str, list[str]]] = {
    # objetivo: palabras en lo que pide la persona; ruta: palabras que buscar en las opciones.
    "bloquear_tarjeta": {"objetivo": ["bloque", "robad", "robo", "perdi", "perdida", "anular", "cancelar la tarjeta"],
                         "ruta": ["tarjeta", "bloque", "robo", "perdida"]},
    "consultar_cargo": {"objetivo": ["cargo", "cobro", "no reconozco", "cobrado"],
                        "ruta": ["tarjeta", "cargo", "consultar"]},
    "estado_transferencia": {"objetivo": ["estado de", "no ha llegado", "no llega", "donde esta"],
                             "ruta": ["transferencia", "estado"]},
    "transferencia": {"objetivo": ["transferencia", "transferir", "enviar dinero", "pasar dinero"],
                      "ruta": ["transferencia", "nueva", "hacer"]},
    "gestor": {"objetivo": ["gestor", "persona", "hablar con", "agente", "alguien"],
               "ruta": ["gestor", "agente", "persona", "hablar"]},
}


def intencion(objetivo_tokens: str) -> str:
    n = _norm(objetivo_tokens)
    for nombre, d in INTENCIONES.items():
        if any(_norm(k) in n for k in d["objetivo"]):
            return nombre
    return "gestor"  # sin objetivo claro (o con un dato rojo): que lo atienda una persona


class Navegador(Protocol):
    def elegir(self, objetivo_tokens: str, intencion: str, oido_tokens: str,
               opciones: list[tuple[str, str]]) -> str | None: ...


class NavegadorLocal:
    """Elige la tecla por palabras clave. Sin red: el modo de la demo."""

    nombre = "local"

    def elegir(self, objetivo_tokens: str, intencion: str, oido_tokens: str,
               opciones: list[tuple[str, str]]) -> str | None:
        ruta = INTENCIONES[intencion]["ruta"]
        puntos = [(sum(k in _norm(et) for k in ruta), -i, t)
                  for i, (t, et) in enumerate(opciones) if "volver" not in _norm(et)]
        mejor = max(puntos, default=None)
        if mejor and mejor[0] > 0:
            return mejor[2]
        for t, et in opciones:  # nada encaja: mejor una persona
            if any(k in _norm(et) for k in INTENCIONES["gestor"]["ruta"]):
                return t
        return None


class NavegadorClaude:
    """Claude elige la tecla. Solo recibe texto tokenizado, tras el bloqueo final."""

    nombre = "claude"
    SYSTEM = ("Eres 8, un asistente que navega el menú telefónico de un banco en nombre de su "
              "cliente. Recibes el objetivo del cliente y lo último que dijo el menú, con los datos "
              "cambiados por tokens. Responde solo con la tecla (una cifra) de la opción que lleva "
              "al objetivo, o con la palabra NINGUNA si ninguna sirve. Nunca marques datos.")

    def __init__(self, client: Any = None, model: str | None = None) -> None:
        if client is None:
            import anthropic

            client = anthropic.Anthropic()
        if model is None:
            from agent.agent import MODEL as model  # el mismo modelo que el agente
        self.client, self.model, self.local = client, model, NavegadorLocal()

    def elegir(self, objetivo_tokens: str, intencion: str, oido_tokens: str,
               opciones: list[tuple[str, str]]) -> str | None:
        user = f"Objetivo del cliente: {objetivo_tokens}\nMenú: {oido_tokens}"
        if not core.check(user)["allowed"]:  # bloqueo final: si algo se escapó, no sale
            return self.local.elegir(objetivo_tokens, intencion, oido_tokens, opciones)
        r = self.client.messages.create(model=self.model, max_tokens=16, system=self.SYSTEM,
                                        messages=[{"role": "user", "content": user}])
        txt = "".join(getattr(b, "text", "") for b in r.content).strip()
        validas = {t for t, _ in opciones}
        return txt if txt in validas else (None if "NINGUNA" in txt.upper() else
                                           self.local.elegir(objetivo_tokens, intencion, oido_tokens, opciones))


# ---- la línea ----

class Linea(Protocol):
    def marcar(self, numero: str) -> str: ...
    def decir(self, texto: str) -> str: ...
    def pulsar(self, tecla: str) -> str: ...
    def esperar(self) -> str: ...
    def ceder(self, a: str) -> str: ...
    def colgar(self) -> None: ...


class LineaLocal:
    """La línea simulada de Banca Alcor dentro del mismo proceso."""

    simulada = True

    def __init__(self) -> None:
        self.llamada = ivr_alcor.Centralita().nueva()

    def marcar(self, numero: str) -> str:
        return self.llamada.inicio()

    def decir(self, texto: str) -> str:
        return self.llamada.voz(texto)

    def pulsar(self, tecla: str) -> str:
        return self.llamada.tecla(tecla)

    def esperar(self) -> str:
        return self.llamada.esperar()

    def ceder(self, a: str) -> str:
        return self.llamada.ceder(a)

    def colgar(self) -> None:
        self.llamada.colgar()


class LineaHttp:
    """La línea simulada servida por `python -m voice.ivr_alcor`."""

    simulada = True

    def __init__(self, base: str) -> None:
        self.base, self.id = base.rstrip("/"), None

    def _post(self, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        r = urllib.request.Request(self.base + path, method="POST",
                                   data=json.dumps(body or {}).encode(),
                                   headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(r, timeout=10) as resp:  # noqa: S310 (localhost)
            return json.loads(resp.read())

    def marcar(self, numero: str) -> str:
        out = self._post("/llamadas", {"numero": numero})
        self.id = out["id"]
        return out["texto"]

    def decir(self, texto: str) -> str:
        return self._post(f"/llamadas/{self.id}/voz", {"texto": texto})["texto"]

    def pulsar(self, tecla: str) -> str:
        return self._post(f"/llamadas/{self.id}/tecla", {"tecla": tecla})["texto"]

    def esperar(self) -> str:
        return self._post(f"/llamadas/{self.id}/esperar")["texto"]

    def ceder(self, a: str) -> str:
        return self._post(f"/llamadas/{self.id}/ceder", {"a": a})["texto"]

    def colgar(self) -> None:
        self._post(f"/llamadas/{self.id}/colgar")


# ---- la voz de 8 en la línea ----

class Voz(Protocol):
    nombre: str
    def hablar(self, texto: str) -> None: ...


class VozTexto:
    nombre = "texto"

    def hablar(self, texto: str) -> None:
        pass


class VozLocal:
    """La voz del sistema (say en macOS, espeak en Linux)."""

    nombre = "local"

    def __init__(self) -> None:
        self.cmd = (["say", "-v", "Mónica"] if shutil.which("say")
                    else ["espeak", "-v", "es"] if shutil.which("espeak") else None)

    def hablar(self, texto: str) -> None:
        if self.cmd:
            subprocess.run([*self.cmd, texto], check=False, capture_output=True)


class VozNube:
    """ElevenLabs (voice/elevenlabs_client.py). Solo frases sin datos: CloudVoice vuelve a
    pasar el bloqueo final antes de cada petición."""

    nombre = "elevenlabs"

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        from .elevenlabs_client import CloudVoice

        self.cloud = CloudVoice.from_env(env)

    def hablar(self, texto: str) -> None:
        pcm = b"".join(self.cloud.stream_text(texto))
        player = shutil.which("afplay") or shutil.which("aplay")
        if not player or not pcm:
            return
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            with wave.open(f, "wb") as w:  # pcm_24000: 16 bits, mono, 24 kHz
                w.setnchannels(1), w.setsampwidth(2), w.setframerate(24000)
                w.writeframes(pcm)
        subprocess.run([player, f.name], check=False, capture_output=True)
        os.unlink(f.name)


def voz_por_defecto(nombre: str = "auto", env: Mapping[str, str] | None = None) -> Voz:
    env = os.environ if env is None else env
    if nombre == "auto":
        nombre = "elevenlabs" if env.get("ELEVENLABS_API_KEY") and env.get("ELEVENLABS_VOICE_ID") else "local"
    if nombre == "elevenlabs":
        return VozNube(env)
    if nombre == "local":
        return VozLocal()
    return VozTexto()


# ---- la llamada ----

@dataclass
class Paso:
    quien: str  # linea | 8
    texto: str  # lo que se dijo (en la línea; zona de confianza)
    modelo: str | None = None  # lo que vio el modelo de eso, con tokens
    accion: str | None = None  # aviso | tecla N | espera | ceder | colgar


class BankCall:
    """Una llamada de 8 al banco. `run()` devuelve el resultado y deja en `pasos` la
    transcripción y en `modelo_vio` todo lo que se le pasó al navegador.

    Quien monta el proceso llama antes a core.trust(known()) (como main), para que el
    detector reconozca también los nombres y datos de la persona que no tienen patrón."""

    def __init__(self, objetivo: str, session: str, *, linea: Linea | None = None,
                 navegador: Navegador | None = None, voz: Voz | None = None,
                 numero: str = ivr_alcor.NUMERO, eco: bool = False) -> None:
        self.objetivo, self.session, self.numero = objetivo, session, numero
        self.linea = linea or LineaLocal()
        self.navegador = navegador or NavegadorLocal()
        self.voz = voz or VozTexto()
        self.eco = eco
        self.pasos: list[Paso] = []
        self.modelo_vio: list[str] = []
        self.dicho: list[str] = []  # todo lo que 8 dijo o marcó en la línea

    # -- auditoría, sin valores --
    def _audit(self, detail: str, model_saw: str | None = None, kind: str = "call",
               reason: str | None = None) -> None:
        core.record({"session": self.session, "kind": kind, "reason": reason, "detail": detail,
                     "model_saw": model_saw, "tokens": T.find(model_saw or ""),
                     "ms": {"core": None, "adapter": None, "model": None}})

    def _print(self, p: Paso) -> None:
        if not self.eco:
            return
        if p.quien == "linea":
            print(f"  línea   {p.texto}")
            if p.modelo is not None and p.modelo != p.texto:
                print(f"  8 ve    {p.modelo}")
        else:
            print(f"  8       {p.texto}" if p.texto else f"  8       [{p.accion}]")

    def _oye(self, texto: str) -> Oido:
        if not texto:
            return Oido("silencio")
        tok = core.tokenize_text(self.session, texto, origen="tercero")
        self.modelo_vio.append(tok)
        p = Paso("linea", texto, tok)
        self.pasos.append(p)
        self._print(p)
        return entender(tok)

    def _dice(self, frase: str, accion: str) -> str:
        assert frase in FRASES, "8 solo dice sus frases fijas en la línea"
        self.dicho.append(frase)
        p = Paso("8", frase, accion=accion)
        self.pasos.append(p)
        self._print(p)
        self.voz.hablar(frase)
        return self.linea.decir(frase)

    def _pulsa(self, tecla: str, opciones: list[tuple[str, str]]) -> str:
        if not (len(tecla) == 1 and tecla.isdigit() and tecla in {t for t, _ in opciones}):
            raise ValueError("8 solo pulsa una tecla del menú que acaba de oír")
        self.dicho.append(tecla)
        etiqueta = dict(opciones)[tecla]
        p = Paso("8", "", accion=f"tecla {tecla} · {etiqueta}")
        self.pasos.append(p)
        self._print(p)
        self._audit(f"menú: tecla {tecla} · {etiqueta}", model_saw=f"tecla {tecla}")
        return self.linea.pulsar(tecla)

    def _ceder(self, motivo: str, frase: str) -> dict[str, Any]:
        self._dice(frase, "ceder")
        self.linea.ceder("titular")
        p = Paso("8", "", accion="cede la llamada a la persona y se retira")
        self.pasos.append(p)
        self._print(p)
        self._audit(f"cedida a la persona · {motivo}")
        return {"ok": True, "cedida": True, "motivo": motivo}

    def run(self) -> dict[str, Any]:
        objetivo_tok = core.tokenize_text(self.session, self.objetivo, origen="titular")
        self.modelo_vio.append(objetivo_tok)
        intent = intencion(objetivo_tok)
        if self.eco:
            print(f"  8 ve    objetivo: {objetivo_tok} → {intent}")
        self._audit(f"inicio · {BANCO} {self.numero} · {intent} · "
                    f"{'simulada' if getattr(self.linea, 'simulada', False) else 'real'} · "
                    f"navegador {getattr(self.navegador, 'nombre', '?')} · voz {getattr(self.voz, 'nombre', '?')}",
                    model_saw=f"llamar al banco: {objetivo_tok}")
        if objetivo_tok.startswith("[la persona dijo"):
            self._audit("el objetivo traía un dato que nunca sale: no se usa", kind="blocked", reason="rojo")

        oido = self._oye(self.linea.marcar(self.numero))
        # Lo primero que hace 8 en la línea: decir que es una IA. Antes no pulsa nada.
        respuesta = self._dice(AVISO, "aviso")
        self._audit("aviso: 8 se presenta como asistente de IA que llama en nombre del cliente")
        if respuesta:
            oido = self._oye(respuesta)

        res: dict[str, Any] | None = None
        for _ in range(MAX_PASOS):
            if oido.tipo in ("pide_rojo", "pide_identidad"):
                self._audit(f"la línea pide un dato ({oido.pide}): 8 no lo da",
                            kind="blocked", reason="rojo")
                res = self._ceder("dato rojo" if oido.tipo == "pide_rojo" else "identificación", CEDER_DATO)
                break
            if oido.tipo == "humano":
                self._audit("contesta una persona del banco")
                res = self._ceder("contesta una persona", CEDER_HUMANO)
                break
            if oido.tipo == "menu":
                tecla = self.navegador.elegir(objetivo_tok, intent, self.modelo_vio[-1], oido.opciones)
                if tecla is None:
                    res = self._ceder("sin opción", CEDER_SIN_OPCION)
                    break
                oido = self._oye(self._pulsa(tecla, oido.opciones))
                continue
            if oido.tipo == "espera":
                self._audit("en espera")
            p = Paso("8", "", accion="espera")
            self.pasos.append(p)
            self._print(p)
            oido = self._oye(self.linea.esperar())
        if res is None:
            self.linea.colgar()
            self._audit("fin sin ceder: demasiados pasos")
            res = {"ok": False, "cedida": False, "motivo": "demasiados pasos"}
        res["intencion"] = intent
        return res


# ---- llamada real (SIN PROBAR) ----

class LiveBankCall:
    """Llamada real con ElevenLabs Conversational AI sobre Twilio. SIN PROBAR: no hay clave.
    La forma de los endpoints es la de voice/call.py (#23) y está por verificar.

    El agente de ElevenLabs (ELEVENLABS_AGENT_ID) se configura en su panel con las
    herramientas de sistema de teclado (DTMF) y de transferencia a un número; el número
    de la persona se pone allí, no sale de aquí. Desde aquí solo sale el número del banco
    (kind "call") y frases sin datos: la intención, no el objetivo literal."""

    def __init__(self, objetivo: str, session: str, env: Mapping[str, str] | None = None) -> None:
        self.objetivo, self.session = objetivo, session
        self.env = os.environ if env is None else env

    @staticmethod
    def enabled(env: Mapping[str, str] | None = None) -> bool:
        env = os.environ if env is None else env
        return env.get("PRIV8_LLAMADA_REAL") == "1" and all(env.get(k) for k in LIVE_VARS)

    def prompt(self, intent: str) -> str:
        return (f"Eres Ocho, un asistente de inteligencia artificial que llama a {BANCO} en nombre "
                f"de su cliente. Objetivo: {intent.replace('_', ' ')}. Navega el menú con el teclado. "
                "Nunca marques ni digas PIN, códigos, claves, números de tarjeta ni documentos: si te "
                "los piden, o cuando conteste una persona, di que la pasas con tu cliente y "
                "transfiere la llamada. No des ningún otro dato.")

    def run(self) -> dict[str, Any]:
        objetivo_tok = core.tokenize_text(self.session, self.objetivo, origen="titular")
        intent = intencion(objetivo_tok)
        prompt = self.prompt(intent)
        if not core.check(prompt + AVISO)["allowed"]:
            raise RuntimeError("bloqueo final: el prompt de la llamada lleva datos")
        numero = self.env["PRIV8_BANCO_TEL"]
        core.record({"session": self.session, "kind": "call", "model_saw": f"llamar al banco: {objetivo_tok}",
                     "tokens": T.find(objetivo_tok), "detail": f"inicio · {numero} · {intent} · live"})
        hdr = {"xi-api-key": self.env["ELEVENLABS_API_KEY"], "Content-Type": "application/json"}

        def req(method: str, path: str, body: dict | None = None) -> dict[str, Any]:
            r = urllib.request.Request(API + path, method=method, headers=hdr,
                                       data=json.dumps(body).encode() if body else None)
            with urllib.request.urlopen(r, timeout=30) as resp:  # noqa: S310
                return json.loads(resp.read())

        out = req("POST", "/v1/convai/twilio/outbound-call", {
            "agent_id": self.env["ELEVENLABS_AGENT_ID"],
            "agent_phone_number_id": self.env["ELEVENLABS_PHONE_NUMBER_ID"],
            "to_number": numero,
            "conversation_initiation_client_data": {"conversation_config_override": {
                "agent": {"first_message": AVISO, "prompt": {"prompt": prompt}}}},
        })
        cid = out["conversation_id"]
        for _ in range(120):
            conv = req("GET", f"/v1/convai/conversations/{cid}")
            if conv.get("status") in ("done", "failed"):
                transcript = " ".join(f"{t['role']}: {t.get('message') or ''}"
                                      for t in conv.get("transcript", []))
                tok = core.tokenize_text(self.session, transcript, origen="tercero")
                core.record({"session": self.session, "kind": "call", "model_saw": None,
                             "detail": f"fin · {conv.get('status')}"})
                return {"ok": conv.get("status") == "done", "transcript_tokens": tok, "intencion": intent}
            time.sleep(5)
        raise TimeoutError("la llamada no terminó")


# ---- CLI ----

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="8 llama al banco por ti (Banca Alcor simulada)")
    ap.add_argument("--objetivo", default="Quiero hablar con un gestor")
    ap.add_argument("--linea", default=os.environ.get("PRIV8_IVR_URL"),
                    help="URL de la línea simulada (python -m voice.ivr_alcor); sin ella, en proceso")
    ap.add_argument("--voz", default=os.environ.get("PRIV8_LLAMADA_VOZ", "auto"),
                    choices=["auto", "texto", "local", "elevenlabs"])
    ap.add_argument("--session", default="llamada-banco")
    args = ap.parse_args(argv)

    from data.check_seed import known

    core.trust(known())
    if LiveBankCall.enabled():
        res = LiveBankCall(args.objetivo, args.session).run()
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return 0 if res["ok"] else 1

    nav: Navegador = NavegadorLocal()
    if os.environ.get("PRIV8_LLAMADA_NAVEGADOR") == "claude" and os.environ.get("ANTHROPIC_API_KEY"):
        nav = NavegadorClaude()
    linea: Linea = LineaHttp(args.linea) if args.linea else LineaLocal()
    print(f"8 llama a {BANCO} ({ivr_alcor.NUMERO}, línea simulada) · objetivo: {args.objetivo}")
    call = BankCall(args.objetivo, args.session, linea=linea, navegador=nav,
                    voz=voz_por_defecto(args.voz), eco=True)
    res = call.run()
    print(f"\nResultado: {'cedida a la persona' if res['cedida'] else 'sin ceder'} · {res['motivo']}"
          f" · intención {res['intencion']}")
    print("Auditoría (sin valores):")
    for e in core.AUDIT.events:
        if e["session"] == args.session:
            print(f"  {e['seq']:>3} {e['kind']:<8} {e.get('reason') or '':<5} {e.get('detail') or ''}")
    return 0 if res["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
