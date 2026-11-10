"""In-memory fake of the Priv8 core, enough to run «registrar factura» end to end.

Stands in for `core/` (issues #4-#14) until it exists. It follows contracts v1
(`docs/contracts/`, PR #58) and implements the Protocols in `core_port.py`:
the adapter returns snapshot.schema.json, observe returns
observation.schema.json, act and oracle return tools.schema.json results, and
the audit log writes audit.schema.json lines.

It is deliberately small: one site (Alba Core), one screen with an invoice
form, a vault, a destination policy, an oracle with a budget, an executor that
rehydrates tokens, a confirmation that auto-approves, a leak check and a
hash-chained audit log. Nothing here is the real detector: the fake vault is
pre-loaded with the seed values, as a site policy plus the vault match would.

All data is invented.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from core_port import AUDIT_INPUT_FIELDS, JSON, TOKEN_RE, Core, LeakVerdict, tokens_in

# ---------------------------------------------------------------- seed data

# Invented and valid (IBAN mod-97, CIF control digit). Shared with the tests,
# which assert none of these ever reaches a model-bound payload.
SEED: dict[str, str] = {
    "proveedor": "Suministros Lumen S.L.",
    "cif": "B84127638",
    "factura": "F-2026-0457",
    "email": "facturacion@suministroslumen.es",
    "importe_correo": "1452.30 EUR",
    "importe_pedido": "1.452,30 €",
    "iban_maestro": "ES91 2100 0418 4502 0005 1332",
    "iban_correo": "ES38 0081 0216 1100 0123 4567",
    "clave": "Lumen-2026!",
}

# seed key -> (TIPO, etiqueta), in vault order (fixes the token numbers).
SEED_TYPES: dict[str, tuple[str, str | None]] = {
    "proveedor": ("PROVEEDOR", "correo"),
    "cif": ("CIF", "tercero"),
    "factura": ("FACTURA", "correo"),
    "email": ("EMAIL", "correo"),
    "importe_correo": ("IMPORTE", "positivo"),
    "importe_pedido": ("IMPORTE", "positivo"),
    "iban_maestro": ("IBAN", "maestro"),
    "iban_correo": ("IBAN", "correo"),
}


# ---------------------------------------------------------------- vault

class FakeVault:
    """token <-> value, stable per session. Red data never enters."""

    def __init__(self) -> None:
        self._by_value: dict[tuple[str, str], str] = {}
        self._by_token: dict[str, str] = {}
        self._counters: dict[str, int] = {}

    def tokenize(self, value: str, tipo: str, etiqueta: str | None = None) -> str:
        key = (tipo, value)
        if key in self._by_value:
            return self._by_value[key]
        n = self._counters.get(tipo, 0) + 1
        self._counters[tipo] = n
        token = f"‹{tipo}_{n}·{etiqueta}›" if etiqueta else f"‹{tipo}_{n}›"
        self._by_value[key] = token
        self._by_token[token] = value
        return token

    def token_for(self, value: str) -> str | None:
        for (_, v), token in self._by_value.items():
            if v == value:
                return token
        return None

    def value(self, token: str) -> str | None:
        return self._by_token.get(token)

    def values(self) -> list[str]:
        return list(self._by_token.values())


# ---------------------------------------------------------------- adapter

@dataclass
class Field:
    id: str
    label: str
    field: str  # policy name, e.g. "pago.iban"
    value: str = ""
    password: bool = False


class FakeAdapter:
    """Fake Alba Core screen. Holds real values: never leaves the trust zone.

    Implements the core/adapter.py interface (PR #58): snapshot() returns
    snapshot.schema.json; perform(RealAction) returns Result.
    """

    def __init__(self) -> None:
        self.screen = "factura.alta"
        self.seq = 0
        self.performed: list[JSON] = []
        self.fields: dict[str, Field] = {
            "e6": Field("e6", "Proveedor", "factura.proveedor"),
            "e7": Field("e7", "CIF", "factura.cif"),
            "e8": Field("e8", "Nº de factura", "factura.numero"),
            "e9": Field("e9", "Importe", "factura.importe"),
            "e10": Field("e10", "IBAN de pago", "pago.iban", value=SEED["iban_maestro"]),
            "e12": Field("e12", "Clave de firma", "firma.clave", password=True),
        }
        self.registered: dict[str, str] | None = None
        self.error: str | None = None

    def snapshot(self) -> JSON:
        s = SEED
        self.seq += 1
        if self.screen == "factura.registrada":
            reg = self.registered or {}
            elements = [
                _el("e1", "heading", None, "Factura registrada"),
                _el("e2", "text", None, f"Factura {reg.get('factura.numero', '')} de {reg.get('factura.proveedor', '')}"),
                _el("e3", "text", None, f"Importe {reg.get('factura.importe', '')}, pago a {reg.get('pago.iban', '')}"),
                _el("e4", "button", "Volver al listado", "Volver al listado", actions=["tap"]),
            ]
        else:
            elements = [
                _el("e1", "heading", None, "Alta de factura de proveedor"),
                _el("e2", "text", "Correo recibido", f"De: {s['email']}"),
                _el("e3", "text", None, f"Factura {s['factura']} de {s['proveedor']}, CIF {s['cif']}"),
                _el("e4", "text", None, f"Importe: {s['importe_correo']}"),
                _el("e5", "text", None, f"Nueva cuenta para el pago: {s['iban_correo']}"),
                *[
                    {"id": f.id, "role": "textbox", "label": f.label,
                     "text": ("••••" if f.value else "") if f.password else f.value,
                     **({"password": True} if f.password else {}),
                     "sel": "#" + f.field.replace(".", "-"), "actions": ["type"]}
                    for f in self.fields.values()
                ],
                _el("e11", "text", "Pedido PO-311", f"Importe del pedido: {s['importe_pedido']}"),
                _el("e13", "button", "Registrar", "Registrar", actions=["tap"]),
            ]
            if self.error:
                elements.append(_el("e14", "text", "Aviso", self.error))
        return {"source": "web", "app": "alba-core", "screen": self.screen,
                "url": "http://127.0.0.1:5173/facturas/alta", "seq": self.seq,
                "focus": None, "system_dialog": None, "elements": elements}

    def perform(self, action: JSON) -> JSON:
        """Receives the action with real values, already rehydrated."""
        self.performed.append(dict(action))
        op, target, text = action["op"], action.get("target"), action.get("text")
        if op == "type" and target in self.fields:
            self.fields[target].value = text or ""
            return {"ok": True}
        if op == "tap" and target == "e13" and self.screen == "factura.alta":
            missing = [f.label for f in self.fields.values() if not f.password and not f.value]
            if missing:
                self.error = "Faltan campos: " + ", ".join(missing)
                return {"ok": True}  # the tap worked; the page shows the error
            self.registered = {f.field: f.value for f in self.fields.values() if not f.password}
            self.screen = "factura.registrada"
            self.error = None
            return {"ok": True}
        if op == "tap" and target == "e4" and self.screen == "factura.registrada":
            return {"ok": True}
        if op in ("scroll", "key", "back"):
            return {"ok": True}
        return {"ok": False, "error": "target_no_encontrado"}


def _el(id_: str, role: str, label: str | None, text: str | None, actions: list[str] | None = None) -> JSON:
    el: JSON = {"id": id_, "role": role, "label": label, "text": text}
    if actions:
        el["actions"] = actions
    return el


# ---------------------------------------------------------------- policy

# Site policy for alba-core (stand-in for policies/alba-core.yaml, #7).
# field -> (accepted TIPO, accepted etiquetas or None for any)
FIELD_RULES: dict[str, tuple[str, set[str] | None]] = {
    "factura.proveedor": ("PROVEEDOR", None),
    "factura.cif": ("CIF", None),
    "factura.numero": ("FACTURA", None),
    "factura.importe": ("IMPORTE", None),
    "pago.iban": ("IBAN", {"maestro"}),
}
CRITICAL = {("tap", "e13"): "enviar"}  # needs human confirmation
KNOWN_SCREENS = {"factura.alta", "factura.registrada"}
TRAMOS = [(Decimal(100), "0–100"), (Decimal(1000), "100–1.000"), (Decimal(10000), "1.000–10.000")]


# ---------------------------------------------------------------- leak check

_IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}(?:[ ]?[0-9A-Z]{4}){3,7}(?:[ ]?[0-9A-Z]{1,3})?\b")
_DNI_RE = re.compile(r"\b\d{8}[A-Z]\b")
_CARD_RE = re.compile(r"\b(?:\d[ -]?){13,19}\b")


def _iban_ok(raw: str) -> bool:
    s = raw.replace(" ", "")
    n = "".join(str(int(c, 36)) for c in s[4:] + s[:4])
    return int(n) % 97 == 1


def _luhn_ok(raw: str) -> bool:
    digits = [int(c) for c in raw if c.isdigit()]
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return total % 10 == 0


def _norm(s: str) -> str:
    return re.sub(r"\s+", "", s).lower()


class FakeLeakCheck:
    """Final block: validated patterns plus exact vault values."""

    def __init__(self, vault: FakeVault, red_values: list[str] | None = None) -> None:
        self.vault = vault
        self.red_values = red_values or []

    def check(self, payload: str) -> LeakVerdict:
        hits: list[str] = []
        if any(_iban_ok(m.group(0)) for m in _IBAN_RE.finditer(payload)):
            hits.append("IBAN")
        dni_letters = "TRWAGMYFPDXBNJZSQVHLCKE"
        if any(dni_letters[int(m.group(0)[:8]) % 23] == m.group(0)[8] for m in _DNI_RE.finditer(payload)):
            hits.append("DNI")
        if any(_luhn_ok(m.group(0)) for m in _CARD_RE.finditer(payload)):
            hits.append("TARJETA")
        flat = _norm(payload)
        if any(len(_norm(v)) >= 6 and _norm(v) in flat for v in self.vault.values()):
            hits.append("vault")
        if any(_norm(v) in flat for v in self.red_values):
            hits.append("rojo")
        return LeakVerdict(ok=not hits, reason=None if not hits else "fuga", matched=tuple(hits))


# ---------------------------------------------------------------- audit

GENESIS = "sha256:" + "0" * 64
# The fake cannot sign: a fixed placeholder that matches the schema's pattern.
FAKE_SIG = "ed25519:" + base64.b64encode(b"priv8-fake-unsigned").decode()


def _canonical(obj: JSON) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


class FakeAudit:
    """audit.schema.json lines, hash-chained: hash = sha256(prev + canonical line
    without hash and sig). Unsigned (see FAKE_SIG)."""

    def __init__(self) -> None:
        self.events: list[JSON] = []

    def record(self, event: JSON) -> JSON:
        extra = set(event) - AUDIT_INPUT_FIELDS
        if extra:
            raise ValueError(f"audit fields outside audit.schema.json: {sorted(extra)}")
        ms = {"core": None, "adapter": None, "model": None, **(event.get("ms") or {})}
        stored: JSON = {k: v for k, v in event.items() if v is not None and k != "ms"}
        stored.update({
            "seq": len(self.events),
            "ts": datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "model_saw": event.get("model_saw"),
            "tokens": list(event.get("tokens") or []),
            "approved_by": event.get("approved_by"),
            "ms": ms,
            "prev": self.events[-1]["hash"] if self.events else GENESIS,
        })
        stored["hash"] = "sha256:" + hashlib.sha256((stored["prev"] + _canonical(stored)).encode()).hexdigest()
        stored["sig"] = FAKE_SIG
        self.events.append(stored)
        return stored

    def verify(self) -> bool:
        prev = GENESIS
        for ev in self.events:
            body = {k: v for k, v in ev.items() if k not in ("hash", "sig")}
            if body["prev"] != prev:
                return False
            if ev["hash"] != "sha256:" + hashlib.sha256((prev + _canonical(body)).encode()).hexdigest():
                return False
            prev = ev["hash"]
        return True


# ---------------------------------------------------------------- core

def _amount(value: str) -> Decimal | None:
    s = re.sub(r"[^\d,.\-]", "", value)
    if "," in s:  # Spanish format 1.452,30
        s = s.replace(".", "").replace(",", ".")
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def _denied(reason: str, detail: str) -> JSON:
    return {"denied": reason, "detail": detail}


@dataclass
class FakeCore:
    """Screen, actor and oracle ports over the fake adapter and vault."""

    vault: FakeVault = field(default_factory=FakeVault)
    adapter: FakeAdapter = field(default_factory=FakeAdapter)
    audit: FakeAudit = field(default_factory=FakeAudit)
    auto_approve: bool = True
    oracle_budget: int = 30
    _confirm_n: int = 0
    _pending: str | None = None

    def __post_init__(self) -> None:
        for key, (tipo, etiqueta) in SEED_TYPES.items():
            self.vault.tokenize(SEED[key], tipo, etiqueta)

    # -- observe: adapter.snapshot() -> policy -> tokenizer -> (final block in the server)
    def observe(self, session: str) -> JSON:
        raw = self.adapter.snapshot()
        if raw["screen"] not in KNOWN_SCREENS:
            return _denied("sin_regla", "No hay política para esta pantalla")
        out = []
        for el in raw["elements"]:
            item: JSON = {"id": el["id"], "role": el["role"]}
            if el.get("label") is not None:
                item["label"] = el["label"]
            if el.get("password"):
                item.update(text=None, cls="rojo")
            else:
                text = el.get("text")
                tokenized = self._tokenize_text(text) if text else text
                item.update(text=tokenized, cls="ambar" if tokenized != text else "verde")
                toks = list(dict.fromkeys(tokens_in(f"{item.get('label') or ''} {tokenized or ''}")))
                if toks:
                    item["tokens"] = toks
            if el.get("actions"):
                item["actions"] = el["actions"]
            out.append(item)
        return {"session": session, "app": raw["app"], "screen": raw["screen"], "seq": raw["seq"],
                "paused": "confirmacion" if self._pending else None,
                "elements": out, "budget_left": self.oracle_budget}

    def _tokenize_text(self, text: str) -> str:
        # token.md rule 5: real text that imitates a token is defused first.
        text = text.replace("‹", "<").replace("›", ">")
        for value in sorted(self.vault.values(), key=len, reverse=True):
            if value and value in text:
                text = text.replace(value, self.vault.token_for(value) or value)
        return text

    # -- act: policy -> provenance -> confirmation -> executor -> adapter.perform()
    def act(self, session: str, op: str, target: str | None = None, text: str | None = None,
            direction: str | None = None) -> JSON:
        fields = self.adapter.fields
        if self._pending:
            return _denied("sin_regla", f"hay una confirmación pendiente ({self._pending})")
        if target in fields and fields[target].password:
            return _denied("rojo", "campo rojo: lo escribe la persona")
        real_text = text
        if op == "type":
            if target not in fields:
                return _denied("sin_regla", f"{target} no es un campo escribible")
            rule = FIELD_RULES.get(fields[target].field)
            if rule is None:
                return _denied("sin_regla", f"sin regla para {fields[target].field}")
            tipo, etiquetas = rule
            toks = list(TOKEN_RE.finditer(text or ""))
            if len(toks) != 1 or toks[0].group(0) != (text or "").strip():
                return _denied("destino", f"{fields[target].field} solo acepta un token {tipo}")
            m = toks[0]
            if self.vault.value(m.group(0)) is None:
                return _denied("token_desconocido", "token desconocido: no se escribe")
            if m.group(1) != tipo or (etiquetas is not None and m.group(3) not in etiquetas):
                origen = m.group(3) or "sin etiqueta"
                return _denied("destino", f"{m.group(1)} de origen {origen} no entra en {fields[target].field}")
            real_text = self.vault.value(m.group(0))
        elif text and TOKEN_RE.search(text):
            unknown = [t for t in tokens_in(text) if self.vault.value(t) is None]
            if unknown:
                return _denied("token_desconocido", "token desconocido: no se escribe")
            real_text = TOKEN_RE.sub(lambda mm: self.vault.value(mm.group(0)) or "", text)

        action: JSON = {"op": op}
        if target is not None:
            action["target"] = target
        if real_text is not None:
            action["text"] = real_text
        if direction is not None:
            action["direction"] = direction

        if (op, target or "") in CRITICAL:
            self._confirm_n += 1
            confirm_id = f"c{self._confirm_n}"
            self.audit.record({"session": session, "kind": "held", "confirm": confirm_id, "app": "alba-core",
                               "screen": self.adapter.screen, "model_saw": f"act {op} {target}",
                               "detail": CRITICAL[(op, target or "")]})
            if self.auto_approve:
                self.audit.record({"session": session, "kind": "approval", "confirm": confirm_id,
                                   "approved_by": "persona", "detail": "pantalla"})
                self.adapter.perform(action)
            else:
                self._pending = confirm_id
            return {"held": {"confirm": confirm_id}}
        result = self.adapter.perform(action)
        if not result.get("ok"):
            return _denied("sin_regla", f"no se pudo hacer {op} en {target}")
        return {"ok": True}

    # -- oracle: budget -> vault -> answer by ranges or a new token
    def oracle(self, session: str, op: str, args: list[str]) -> JSON:
        if self.oracle_budget <= 0:
            return _denied("presupuesto", "sin presupuesto de oráculo en esta sesión")
        values = [self.vault.value(a) for a in args]
        if any(v is None for v in values):
            return _denied("token_desconocido", "token desconocido")
        self.oracle_budget -= 1
        if op == "sum":
            amounts = [_amount(v) for v in values]  # type: ignore[arg-type]
            if any(a is None for a in amounts):
                return _denied("sin_regla", "sum solo admite importes")
            total = sum(amounts)  # type: ignore[arg-type]
            token = self.vault.tokenize(f"{total:.2f}", "SUMA")
            tramo = next((t for lim, t in TRAMOS if total < lim), "más de 10.000")
            return {"result": token, "tramo": tramo, "budget_left": self.oracle_budget}
        if len(values) != 2:
            return _denied("sin_regla", f"{op} usa exactamente dos tokens")
        a, b = values
        if op == "compare":
            x, y = _amount(a), _amount(b)  # type: ignore[arg-type]
            if x is None or y is None:
                return _denied("sin_regla", "compare solo admite importes")
            res = "igual" if x == y else ("mayor" if x > y else "menor")
            return {"result": res, "budget_left": self.oracle_budget}
        if TOKEN_RE.fullmatch(args[0]).group(1) != TOKEN_RE.fullmatch(args[1]).group(1):  # type: ignore[union-attr]
            return _denied("sin_regla", "matches compara dos tokens del mismo tipo")
        same = _norm(a) == _norm(b)  # type: ignore[arg-type]
        return {"result": "coincide" if same else "no coincide", "budget_left": self.oracle_budget}


def build_fake_core(**kwargs: Any) -> tuple[Core, FakeCore]:
    """A `Core` bundle over one `FakeCore`. The second item is for tests only."""
    fake = FakeCore(**kwargs)
    leak = FakeLeakCheck(fake.vault, red_values=[SEED["clave"]])
    return Core(screen=fake, actor=fake, oracle=fake, leak=leak, audit=fake.audit), fake


__all__ = ["SEED", "FakeCore", "FakeVault", "FakeAdapter", "FakeLeakCheck", "FakeAudit", "build_fake_core"]
