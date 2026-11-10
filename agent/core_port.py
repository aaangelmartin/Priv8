"""The thin interface between the MCP server / agent loop and the Priv8 core.

The real core (`core/`, issues #4-#14) is not written yet. Everything in `agent/`
talks to it only through the Protocol classes below, which follow contracts v1
in `docs/contracts/` (PR #58): tools.schema.json, observation.schema.json and
audit.schema.json. An adapter around `core/` implements these Protocols and is
passed to `build_server()` / `run_agent()` instead of `fakes.FakeCore`.

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

# docs/contracts/token.md: ‹TIPO_n·etiqueta›
TOKEN_RE = re.compile(r"‹([A-Z]+)_(\d+)(?:·([a-z]+))?›")

ActOp = Literal["tap", "type", "key", "scroll", "open_app", "back", "send", "call"]
OracleOp = Literal["sum", "compare", "matches"]
# docs/contracts/tools.schema.json#/$defs/denied, shared with audit.schema.json
DenyReason = Literal["fuga", "destino", "rojo", "presupuesto", "sin_regla",
                     "token_desconocido", "caducado", "cancelado"]
AuditKind = Literal[
    "observe_sent", "act", "held", "approval", "oracle", "blocked",
    "voice_out", "call", "paused", "task",
]

JSON = dict[str, Any]

# Keys a caller may pass to AuditPort.record (audit.schema.json minus what the log adds).
AUDIT_INPUT_FIELDS = frozenset({
    "session", "kind", "reason", "app", "screen", "model_saw", "tokens",
    "confirm", "approved_by", "counts", "detail", "ms",
})
NO_SESSION = "sin_sesion"  # session id for events about calls that carried none


@runtime_checkable
class ScreenPort(Protocol):
    def observe(self, session: str) -> JSON:
        """Tokenized screen: observation.schema.json, or {"denied": ...}.

        {"session", "app", "screen", "seq", "paused", "elements": [{"id", "role",
        "label", "text", "cls", "tokens", "actions"}], "budget_left"}.
        Red elements arrive with text = None.
        """
        ...


@runtime_checkable
class ActPort(Protocol):
    def act(self, session: str, op: ActOp, target: str | None = None, text: str | None = None,
            direction: str | None = None) -> JSON:
        """Run one action (tools.schema.json act_input). `text` holds tokens or green text only.

        act_result: {"ok": True} | {"held": {"confirm": "c3"}}
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
        """Append one event and return it as stored (audit.schema.json).

        The caller gives session, kind and any of reason, app, screen,
        model_saw, tokens, confirm, approved_by, counts, detail, ms; the audit
        adds seq, ts, prev, hash and sig. No other keys.

        One owner per event, so nothing appears twice in the log:
        - The core records its own work on each call: observe_sent, act, held,
          approval, oracle, and blocked for the denials it decides.
        - The MCP server (agent/server.py) records only blocked events the core
          never sees: unknown tool, invalid input, a real value in the input,
          and a core result held back by the server's final block.
        - The agent loop (agent/agent.py) records task events (start, each
          model step with ms.model, end, errors) and blocked for a request to
          Claude held back by the final block.
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
