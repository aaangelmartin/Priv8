"""Token grammar of Priv8 CUA (docs/contracts/token.md, contracts v1).

    token    = "‹" TIPO "_" n [ "-" etiqueta ] "›"
    regex    = ‹([A-Z]+)_(\\d+)(?:-([a-z]+))?›

This module only parses tokens out of a template. It never resolves them:
the token → value table lives in the local vault (core/), not here.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Delimiters written as escapes, as docs/contracts/token.md asks:
# U+2039 ‹ and U+203A ›.
TOKEN_RE = re.compile("\u2039([A-Z]+)_(\\d+)(?:-([a-z]+))?\u203a")

# Any guillemet left in a cloud sentence means a token was malformed or
# half-written. The leak check refuses it rather than guessing.
TOKEN_FRAGMENT_RE = re.compile("[\u2039\u203a]")


@dataclass(frozen=True)
class Token:
    raw: str
    kind: str
    n: int
    label: str | None = None

    @property
    def key(self) -> str:
        """Token without its label: ‹IMPORTE_3›. The vault is keyed by it."""
        return f"\u2039{self.kind}_{self.n}\u203a"


def parse_token(raw: str) -> Token:
    m = TOKEN_RE.fullmatch(raw)
    if not m:
        raise ValueError(f"not a Priv8 token: {raw!r}")
    return Token(raw=raw, kind=m.group(1), n=int(m.group(2)), label=m.group(3))
