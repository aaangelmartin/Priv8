"""Confirmación humana obligatoria (confirm.schema.json).

Transferir, invertir, firmar, enviar y llamar quedan retenidos: act devuelve
{"held": {"confirm": "c3"}} y se publica un confirm_request con el resumen en
voz mixta (frases sin datos para la nube, tokens para la voz local). La acción
solo se ejecuta cuando llega un approval_result con ok de la persona antes de
expires_s. Si dice que no, cancelado; si pasa el tiempo, caducado.
La autenticación del banco (SCA) la hace siempre la persona después.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from . import tokens as T
from .policies import Rule
from .session import Session

EXPIRES_S = 300

PHRASES = {
    "transferir": ("Voy a transferir", "¿Lo confirmas?"),
    "invertir": ("Voy a dar la orden de inversión", "¿Lo confirmas?"),
    "firmar": ("Voy a registrar", "¿Lo confirmas?"),
    "enviar": ("Voy a enviar el mensaje", "¿Lo envío?"),
    "llamar": ("Voy a llamar", "¿Llamo?"),
}
SAY_AS = {"IMPORTE": "currency", "SUMA": "currency", "PERSONA": "name", "PROVEEDOR": "name",
          "IBAN": "iban", "TEL": "phone", "DNI": "digits", "NIE": "digits", "CIF": "digits"}
CONNECT = {"IMPORTE": "por", "PERSONA": "a", "PROVEEDOR": "a", "IBAN": "en la cuenta",
           "TEL": "al número", "FACTURA": "la factura", "EMAIL": "a"}
# En transferir, el importe va justo después de «Voy a transferir».
NO_CONNECT_FIRST = {"transferir", "invertir"}


@dataclass
class Pending:
    request: dict[str, Any]
    session: Session
    action: dict[str, Any]  # con tokens; se rehidrata al aprobar
    created: float
    done: bool = False
    extra: dict[str, Any] = field(default_factory=dict)


class Confirmations:
    def __init__(self, publish: Callable[[dict], None], record: Callable[[dict], dict],
                 clock: Callable[[], float] = time.monotonic):
        self._publish = publish
        self._record = record
        self.clock = clock
        self._pending: dict[str, Pending] = {}
        self._count = 0
        self._lock = threading.Lock()

    # ---- hueco del ejecutor ----
    def hook(self, sess: Session, op: str, el: dict | None, rule: Rule | None,
             text: str | None) -> dict[str, Any] | None:
        kind = "llamar" if op == "call" else (rule.critica if rule else None)
        if kind is None or op not in {"tap", "send", "call", "type"}:
            return None
        if op == "type" and kind != "llamar":
            return None  # escribir en un campo no es la acción crítica; pulsar el botón sí
        action = {"op": op}
        if el is not None:
            action["target"] = el["id"]
            if el.get("label"):
                action["label"] = el["label"]
        if text:
            action["text"] = text
        summary = self._summary(sess, kind, rule, text)  # lee la pantalla: fuera del candado
        with self._lock:
            for p in self._pending.values():  # misma acción ya retenida: misma petición
                if not p.done and p.session is sess and p.action == action:
                    return {"held": {"confirm": p.request["id"]}}
            self._count += 1
            cid = f"c{self._count}"
            req = {
                "type": "confirm_request", "id": cid, "session": sess.id, "kind": kind,
                "action": {k: v for k, v in action.items() if k in ("op", "target", "label", "text")},
                "summary": summary,
                "channels": ["voz", "pantalla"],
                "sca": "persona" if kind in ("transferir", "invertir") else None,
                "expires_s": EXPIRES_S,
            }
            self._pending[cid] = Pending(req, sess, action, self.clock())
        self._publish(req)
        return {"held": {"confirm": cid}}

    def _summary(self, sess: Session, kind: str, rule: Rule | None, text: str | None) -> list[dict]:
        toks: list[str] = []
        if rule and rule.resumen and sess.last_screen is not None:
            # Lo que la persona aprueba es lo que hay ahora en pantalla, no lo que escribió el agente.
            elements = _current_elements(sess)
            for sel in rule.resumen:
                for el in elements:
                    if el.get("sel") == sel:
                        toks += _tokens_of(sess, el)
        toks += T.find(text or "")
        lead, ask = PHRASES[kind]
        segs: list[dict] = [{"voice": "cloud", "text": lead}]
        for i, tok in enumerate(dict.fromkeys(toks)):
            tipo = T.parse(tok).tipo
            if i == 0 and kind in NO_CONNECT_FIRST and tipo == "IMPORTE":
                pass
            elif CONNECT.get(tipo):
                segs.append({"voice": "cloud", "text": CONNECT[tipo]})
            seg = {"voice": "local", "token": tok}
            if tipo in SAY_AS:
                seg["say_as"] = SAY_AS[tipo]
            segs.append(seg)
        segs.append({"voice": "cloud", "text": ask})
        return segs

    # ---- respuesta de la persona ----
    def approve(self, result: dict[str, Any], perform: Callable[[Pending], dict]) -> dict[str, Any]:
        cid = result.get("id")
        with self._lock:
            p = self._pending.get(cid)
            if p is None or p.done:
                return {"denied": "cancelado", "detail": f"no hay confirmación pendiente {cid}"}
            expired = self.clock() - p.created > p.request["expires_s"]
            p.done = True
        if expired:
            return self._close(p, False, "sistema", "sistema", "caducado")
        if not result.get("ok") or result.get("by") != "persona":
            return self._close(p, False, result.get("via", "voz"), "persona", "cancelado")
        self._close(p, True, result.get("via", "voz"), "persona", None)
        return perform(p)

    def expire_due(self) -> list[str]:
        """Caduca lo que haya pasado de plazo. Devuelve los ids caducados."""
        now = self.clock()
        due = []
        with self._lock:
            for p in self._pending.values():
                if not p.done and now - p.created > p.request["expires_s"]:
                    p.done = True
                    due.append(p)
        for p in due:
            self._close(p, False, "sistema", "sistema", "caducado")
        return [p.request["id"] for p in due]

    def _close(self, p: Pending, ok: bool, via: str, by: str, reason: str | None) -> dict[str, Any]:
        res = {"type": "approval_result", "id": p.request["id"], "ok": ok, "via": via, "by": by}
        if reason:
            res["reason"] = reason
        self._publish(res)
        self._record({"session": p.session.id, "kind": "approval", "confirm": p.request["id"],
                      "approved_by": "persona" if ok else None,
                      "detail": "aprobada" if ok else reason})
        return {"ok": True} if ok else {"denied": reason, "detail": f"confirmación {reason}"}

    def pending(self, session: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            return [p.request for p in self._pending.values()
                    if not p.done and (session is None or p.session.id == session)]


def _current_elements(sess: Session) -> list[dict]:
    """La pantalla tal como está ahora. Si no se puede leer, la última observada."""
    raw = None
    if sess.adapter is not None:
        try:
            raw = sess.adapter.snapshot()
        except Exception:  # noqa: BLE001 - sin lectura nueva, la última que hay
            raw = None
    return (raw or sess.last_raw or {}).get("elements", [])


def _tokens_of(sess: Session, el: dict) -> list[str]:
    """Tokens del valor que muestra el elemento, con la regla de su pantalla. Un valor
    nuevo entra en la bóveda (mismo valor, mismo token): así se dice lo que hay de verdad."""
    from .screen import _apply_rule

    text = T.neutralize(el.get("text") or "")
    if not text.strip():
        return []
    rule = sess.last_screen.rule_for(el) if sess.last_screen else None
    if rule is not None and rule.cls == "ambar":
        return T.find(_apply_rule(text, rule, sess.vault, sess.last_screen.origen))
    return [e.token for e in sess.vault.entries() if e.value and e.value in text]
