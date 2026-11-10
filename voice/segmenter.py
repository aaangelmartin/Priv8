"""Split a token template into ordered voice segments (voz mixta).

The model answers with a template that holds tokens instead of data:

    «Entre tus tres cuentas tienes ‹SUMA_1›.»

The segmenter turns it into the "segmento de voz" contract drafted in
docs/arquitectura.html:

    {"utterance":"u18","session":"s2","segments":[
      {"voice":"cloud","text":"Entre tus tres cuentas tienes"},
      {"voice":"local","token":"‹SUMA_1›","say_as":"currency"}]}

- cloud segments go to ElevenLabs, but only after the final block (leak
  check). They never contain a token or a real value.
- local segments carry the token and, once rendered on the trusted side, the
  spoken text of the real value. They go to the device's TextToSpeech.
- a cloud segment that fails the leak check does not leave: it is demoted to
  the local voice (``blocked: "fuga"``) and an audit event is emitted.

Text between two tokens that is only punctuation or spaces is dropped, so the
player does not switch voices for a lone comma (each switch costs a gap).
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

from .leak_check import LeakCheck, PatternLeakCheck
from .tokens import TOKEN_RE, Token
from .verbalize import verbalize

Voice = Literal["cloud", "local"]

# say_as per token type. Unknown types are read as plain text by the local voice.
SAY_AS: Mapping[str, str] = {
    "IMPORTE": "currency",
    "SUMA": "currency",
    "IBAN": "characters",
    "DNI": "characters",
    "NIE": "characters",
    "CIF": "characters",
    "TEL": "characters",
    "CODIGO": "characters",
    "FACTURA": "characters",
    "PERSONA": "name",
    "PROVEEDOR": "name",
    "EMAIL": "text",
    "MOVIMIENTO": "text",
    "RESPUESTA": "text",
}

# Renders a token to the words the local voice says. Runs in the trusted zone.
Render = Callable[[Token, str], str]
# Receives audit events (kind "blocked", reason "fuga"). Never gets real values.
AuditSink = Callable[[dict[str, Any]], None]

# Text between tokens that is only punctuation or spaces is not worth a voice.
_SPEAKABLE_RE = re.compile(r"\w", re.UNICODE)


class LeakBlocked(Exception):
    """Raised when a cloud segment would leave with a sensitive pattern."""

    def __init__(self, kinds: Iterable[str]):
        self.kinds = sorted(set(kinds))
        super().__init__(f"cloud text blocked: {', '.join(self.kinds)}")


@dataclass
class Segment:
    voice: Voice
    text: str | None = None          # cloud: the sentence; local: rendered real value
    token: str | None = None         # local: the token it stands for
    say_as: str | None = None        # local: how to read it
    blocked: str | None = None       # "fuga" when a cloud sentence was demoted

    def to_contract(self, *, include_local_text: bool = True) -> dict[str, Any]:
        """Contract form. include_local_text=False gives the audit view: tokens only."""
        out: dict[str, Any] = {"voice": self.voice}
        if self.token is not None:
            out["token"] = self.token
        if self.say_as is not None:
            out["say_as"] = self.say_as
        if self.blocked is not None:
            out["blocked"] = self.blocked
        if self.text is not None and (self.voice == "cloud" or include_local_text):
            out["text"] = self.text
        return out


@dataclass
class Utterance:
    utterance: str
    session: str
    segments: list[Segment] = field(default_factory=list)

    @property
    def cloud_texts(self) -> list[str]:
        return [s.text for s in self.segments if s.voice == "cloud" and s.text]

    def to_contract(self, *, include_local_text: bool = True) -> dict[str, Any]:
        """What the core sends to the device (trusted zone, local text included).

        With include_local_text=False it is safe for the audit log and the
        console: cloud sentences and tokens only.
        """
        return {
            "utterance": self.utterance,
            "session": self.session,
            "segments": [s.to_contract(include_local_text=include_local_text)
                         for s in self.segments],
        }


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _clean_cloud(text: str) -> str:
    """Also drop punctuation left at the start by the token before: '. ¿Lo confirmas?'."""
    return _clean(text).lstrip(".,;:… ")


def segment(
    template: str,
    render: Render,
    *,
    utterance: str,
    session: str,
    leak_check: LeakCheck | None = None,
    audit: AuditSink | None = None,
    say_as: Mapping[str, str] = SAY_AS,
) -> Utterance:
    """Turn a token template into ordered voice segments.

    render(token, say_as) returns the words the local voice says for the
    token's real value; it runs in the trusted zone (core + vault).
    leak_check guards every cloud sentence (default: PatternLeakCheck()).
    audit receives one event per demoted sentence, without real values.
    """
    check = leak_check if leak_check is not None else PatternLeakCheck()
    raw: list[Segment] = []
    pos = 0

    def add_cloud(text: str) -> None:
        text = _clean_cloud(text)
        if not _SPEAKABLE_RE.search(text):
            return
        findings = check.check(text)
        if not findings:
            raw.append(Segment(voice="cloud", text=text))
            return
        kinds = sorted({f.kind for f in findings})
        raw.append(Segment(voice="local", text=text, blocked="fuga"))
        if audit is not None:
            audit({
                "kind": "blocked",
                "reason": "fuga",
                "session": session,
                "utterance": utterance,
                "target": "elevenlabs",
                "findings": kinds,
            })

    for m in TOKEN_RE.finditer(template):
        add_cloud(template[pos:m.start()])
        token = Token(raw=m.group(0), kind=m.group(1), n=int(m.group(2)), label=m.group(3))
        how = say_as.get(token.kind, "text")
        raw.append(Segment(voice="local", token=token.raw, say_as=how,
                           text=_clean(render(token, how))))
        pos = m.end()
    add_cloud(template[pos:])

    return Utterance(utterance=utterance, session=session, segments=raw)


class VaultRenderer:
    """Default render: look the token up in a token → value table and verbalize it.

    The table is the session's vault (it lives in core/); here it is any
    mapping keyed by the token, with or without its label. An unknown token
    is never guessed: it raises KeyError.
    """

    def __init__(self, table: Mapping[str, str]):
        self._table = table

    def __call__(self, token: Token, say_as: str) -> str:
        value = self._table.get(token.raw, self._table.get(token.key))
        if value is None:
            raise KeyError(f"unknown token {token.raw}")
        return verbalize(value, say_as)
