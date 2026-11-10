"""The thin interface between the MCP server / agent loop and the Priv8 core.

The real core (`core/`, issues #4-#14) is not written yet. Everything in `mcp/`
talks to it only through the Protocol classes below, built on the draft
contracts in `docs/arquitectura.html`. When the official contracts land in
`docs/contracts/` (#4), an adapter around `core/` implements these Protocols
and is passed to `build_server()` / `run_agent()` instead of `fakes.FakeCore`.

Every payload here is a plain JSON-compatible dict, so a contract change is a
change of keys, not of types.

Zones:
- Everything returned by `ScreenPort.observe`, `ActPort.act` and
  `OraclePort.oracle` is model-bound: tokens and green text only.
- Real values never cross this interface. They live behind it, in the vault,
  the executor and the adapter.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal, Protocol, runtime_checkable

# Draft grammar: ‹TIPO_n·etiqueta›  (docs/arquitectura.html, "Gramática del token")
TOKEN_RE = re.compile(r"‹([A-Z]+)_(\d+)(?:·([a-z]+))?›")

ActOp = Literal["tap", "type", "key", "scroll", "open_app", "back", "send", "call"]
OracleOp = Literal["sum", "compare", "matches"]
DenyReason = Literal["fuga", "destino", "rojo", "presupuesto", "sin_regla"]
AuditKind = Literal[
    "observe_sent", "act", "held", "approval", "oracle", "blocked",
    "voice_out", "call", "paused", "task",
]

JSON = dict[str, Any]


@runtime_checkable
class ScreenPort(Protocol):
    def observe(self, session: str) -> JSON:
        """Tokenized tree of the current screen.

        Draft shape: {"screen", "app", "paused", "elements": [{"id", "role",
        "label", "value"|"text", "cls", "actions"}], "budget_left"}.
        Red elements arrive with value/text = None.
        """
        ...


@runtime_checkable
class ActPort(Protocol):
    def act(self, session: str, op: ActOp, target: str | None = None, text: str | None = None) -> JSON:
        """Run one action. `text` holds tokens or green text only.

        Draft outputs: {"ok": True} | {"held": {"confirm": "c3"}}
        | {"denied": DenyReason, "detail": str}.
        The executor rehydrates tokens locally before the adapter writes.
        """
        ...


@runtime_checkable
class OraclePort(Protocol):
    def oracle(self, session: str, op: OracleOp, args: list[str]) -> JSON:
        """Compute without revealing.

        sum -> {"result": "‹SUMA_n›", "tramo": "1.000–10.000", "budget_left": n}
        compare -> {"result": "igual"|"mayor"|"menor", "budget_left": n}
        matches -> {"result": "coincide"|"no coincide", "budget_left": n}
        Over budget -> {"denied": "presupuesto"}.
        """
        ...


@dataclass(frozen=True)
class LeakVerdict:
    ok: bool
    reason: DenyReason | None = None
    # Kinds of pattern that matched (e.g. "IBAN", "vault"), never the values.
    matched: tuple[str, ...] = ()


@runtime_checkable
class LeakCheckPort(Protocol):
    def check(self, payload: str) -> LeakVerdict:
        """Final block: inspect a serialized payload about to leave the trust zone."""
        ...


@runtime_checkable
class AuditPort(Protocol):
    def record(self, event: JSON) -> JSON:
        """Append one event and return it as stored (with seq, ts, prev, hash).

        Draft fields: session, kind, reason, model_saw, tokens, approved_by, ms.
        """
        ...


@dataclass
class Core:
    """The five ports the MCP layer needs, bundled. Nothing else is reachable."""

    screen: ScreenPort
    actor: ActPort
    oracle: OraclePort
    leak: LeakCheckPort
    audit: AuditPort


def tokens_in(text: str) -> list[str]:
    """All tokens in a string, in order, as full token strings."""
    return [m.group(0) for m in TOKEN_RE.finditer(text)]
