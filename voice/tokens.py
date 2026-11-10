"""Token grammar of Priv8 CUA, as drafted in docs/arquitectura.html.

    token    = "‹" TIPO "_" n [ "·" etiqueta ] "›"
    regex    = ‹([A-Z]+)_(\\d+)(?:·([a-z]+))?›

This module only parses tokens out of a template. It never resolves them:
the token → value table lives in the local vault (core/), not here.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

TOKEN_RE = re.compile(r"‹([A-Z]+)_(\d+)(?:·([a-z]+))?›")

# Any guillemet left in a cloud sentence means a token was malformed or
# half-written. The leak check refuses it rather than guessing.
TOKEN_FRAGMENT_RE = re.compile(r"[‹›]")


@dataclass(frozen=True)
class Token:
    raw: str
    kind: str
    n: int
    label: str | None = None

    @property
    def key(self) -> str:
        """Token without its label: ‹IMPORTE_3›. The vault is keyed by it."""
        return f"‹{self.kind}_{self.n}›"


def parse_token(raw: str) -> Token:
    m = TOKEN_RE.fullmatch(raw)
    if not m:
        raise ValueError(f"not a Priv8 token: {raw!r}")
    return Token(raw=raw, kind=m.group(1), n=int(m.group(2)), label=m.group(3))
