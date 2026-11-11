"""8 executes, it does not advise (issue #43).

Investment advice is a regulated service (MiFID II). When the person asks 8 to
choose for them (what fund, whether to buy, how much to put in), the agent loop
stops before calling Claude: the request never reaches the model, 8 says one
fixed sentence and the face shows «no puedo».

The check is a small deterministic classifier over the task text. It looks for
requests for an opinion or a choice, not for investment words: «invierte 200 €
en el fondo X que he elegido» is an order and runs, «¿en qué fondo lo meto?»
is a request for advice and does not. The system prompt keeps its own line
("Ejecutas, no aconsejas") as a second barrier for what this misses.

The text it reads may carry tokens (‹IMPORTE_1›); they do not affect the rules.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

# The fixed sentence. No data, so it goes whole to the cloud voice.
FRASE = "Eso sería asesorarte y no puedo hacerlo. Si eliges tú el fondo, lo preparo."

# Something one invests in, or money to invest.
_PRODUCTO = (r"(fondos?|acciones|accion|valores|valor|etfs?|indexados?|bonos?|letras|criptos?\w*|bitcoin"
             r"|depositos?|plan(es)? de pensiones|productos?|carteras?|inversion(es)?)")
_CONTEXTO = re.compile(r"\b" + _PRODUCTO + r"\b|\binvert\w*|\binvier\w*|\bbolsa\b|\bbroker\b|\bdinero\b"
                       r"|\bahorros?\b|\bcompr(o|a|ar|as|e|es|aria)\b|\bvend(o|e|er|es|eria)\b")
# Investing, buying or selling, in the first person or the infinitive. Not «pongo» or
# «transfiero»: «¿cuánto pongo en la transferencia?» is not about investing.
_METER = r"(invierto|invertir|invertirlo|meto|meter|meterlo|compro|comprar|vendo|vender)"

# Asking for a choice or an opinion: advice whatever the context.
_SIEMPRE = [
    re.compile(r"\ben (que|cual|cuales) " + _PRODUCTO + r"\b"),                       # ¿en qué fondo lo meto?
    re.compile(r"\b(que|cual|cuales) " + _PRODUCTO + r" (me )?(recomiend|aconsej|elij|escoj|compr|cojo"
               r"|es mejor|son mejores|me conviene|conviene|va mejor|renta)"),           # ¿qué fondo compro?
    re.compile(r"\b(el|la|los|las) mejor(es)? " + _PRODUCTO + r"\b"),                  # el mejor fondo
    re.compile(r"\bcuanto (deberia |debo |tengo que |me conviene |conviene )?" + _METER + r"\b"),  # ¿cuánto invierto?
    re.compile(r"\b(deberia|debo|me conviene|conviene|seria buena idea|es buena idea) " + _METER + r"\b"),
    re.compile(r"\bdonde (deberia |me conviene )?" + _METER + r"\b"),                 # ¿dónde invierto?
]
# Advice only when the sentence is about investing or money.
_CON_CONTEXTO = [
    # Second person only: «el fondo que me aconsejó mi gestor» is the person's own choice.
    re.compile(r"\b(recomiendas|recomendarias|recomiendame|recomiendes|aconsejas|aconsejarias|aconsejame"
               r"|aconsejes)\b|\b(dame|dime|necesito|quiero) (un |una |tu )?(consejo|recomendacion|opinion)\b"),
    re.compile(r"\b(merece|vale) la pena\b"),
    re.compile(r"\b(es (un )?buen momento|va(n)? a (subir|bajar)|subira(n)?|bajara(n)?)\b"),
    re.compile(r"\bque (harias|haces|opinas|piensas)\b|\btu que harias\b"),
    re.compile(r"\bque hago con\b"),
]
# «¿Invierto en…?», «¿Compro…?»: the person asks whether, in the first person.
_PREGUNTA_SI = re.compile(r"^(y )?(si )?(lo |la |los |las |le )?" + _METER + r"\b")


def _normaliza(texto: str) -> str:
    sin_tildes = "".join(c for c in unicodedata.normalize("NFD", texto.lower())
                         if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^\w‹›-]+", " ", sin_tildes)).strip()


def _frases(texto: str) -> list[str]:
    """The sentences and questions of a text, as written."""
    trozos = re.split(r"(?<=[.?!])\s+|¿", texto)
    return [t for t in trozos if t.strip()]


def es_asesoria(texto: str) -> bool:
    """True if the text asks 8 to advise (choose a product, whether or how much to invest)."""
    if not texto or not texto.strip():
        return False
    plano = _normaliza(texto)
    if any(p.search(plano) for p in _SIEMPRE):
        return True
    if _CONTEXTO.search(plano) and any(p.search(plano) for p in _CON_CONTEXTO):
        return True
    # A first-person question about buying or investing: «¿Invierto en el fondo X?».
    for trozo in _frases(texto):
        if "?" in trozo and _PREGUNTA_SI.search(_normaliza(trozo)):
            return True
    return False


def declinar(core: Any, session: str) -> str:
    """Say the fixed sentence and record the block. Nothing goes to the model.

    Order on the event channel: first the `voice` (8 speaks), then the `audit`
    blocked with reason asesoria, whose face («no puedo», `rechazar`) is the one
    that stays on the app. With the fake core there is no voice port: only the audit.
    """
    voice = getattr(core, "voice", None)
    if voice is not None:
        voice.say(session, FRASE)
    core.audit.record({"session": session, "kind": "blocked", "reason": "asesoria", "model_saw": None,
                       "detail": "8 ejecuta, no asesora - la petición no llega al modelo"})
    return FRASE
