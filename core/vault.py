"""Bóveda por sesión: token → valor real. Vive solo en la zona de confianza.

Mismo valor (normalizado) y misma sesión → mismo token. La etiqueta del token es
la de la primera aparición; la bóveda guarda todos los orígenes en los que se
ha visto el valor, que es lo que usa la procedencia (#10).

Lo rojo no entra nunca: no hay método para guardarlo y tokenize() rechaza los
tipos que no son de la gramática.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field

from . import tokens as T


@dataclass
class Entry:
    token: str
    tipo: str
    value: str  # valor real tal como apareció la primera vez
    norm: str
    origenes: set[str] = field(default_factory=set)


class Vault:
    def __init__(self, session: str):
        self.session = session
        self._by_token: dict[str, Entry] = {}
        self._by_value: dict[tuple[str, str], Entry] = {}
        self._count: dict[str, int] = {}
        self._lock = threading.Lock()

    def tokenize(self, tipo: str, value: str, origen: str | None = None,
                 rasgo_signo: bool = False) -> str:
        """Token para `value`. Si ya estaba en la sesión, el mismo, y suma el origen."""
        if tipo not in T.TIPOS:
            raise ValueError(f"tipo no tokenizable: {tipo}")
        if origen is not None and origen not in T.ORIGENES:
            raise ValueError(f"origen desconocido: {origen}")
        if not value or not value.strip():
            raise ValueError("valor vacío")
        norm = T.normalize(tipo, value)
        with self._lock:
            entry = self._by_value.get((tipo, norm))
            if entry is None:
                n = self._count.get(tipo, 0) + 1
                self._count[tipo] = n
                etiqueta = origen
                if rasgo_signo and tipo == "IMPORTE":
                    amount = T.parse_amount(value)
                    if amount is not None:
                        etiqueta = "negativo" if amount < 0 else "positivo"
                token = str(T.Token(tipo, n, etiqueta))
                entry = Entry(token, tipo, value.strip(), norm)
                self._by_value[(tipo, norm)] = entry
                self._by_token[token] = entry
            if origen:
                entry.origenes.add(origen)
            return entry.token

    def lookup(self, token: str) -> Entry | None:
        return self._by_token.get(token)

    def value(self, token: str) -> str | None:
        e = self._by_token.get(token)
        return e.value if e else None

    def __contains__(self, token: str) -> bool:
        return token in self._by_token

    def __len__(self) -> int:
        return len(self._by_token)

    def values(self) -> list[str]:
        """Valores reales guardados (para el bloqueo final, que los busca en lo que sale)."""
        return [e.value for e in self._by_token.values()]

    def entries(self) -> list[Entry]:
        return list(self._by_token.values())

    def render(self, text: str) -> str:
        """Sustituye los tokens conocidos por su valor. Los desconocidos se quedan como están.
        Solo para la zona de confianza (ejecutor, renderizador local, voz local)."""
        def sub(m):
            e = self._by_token.get(m.group(0))
            return e.value if e else m.group(0)
        return T.TOKEN_RE.sub(sub, text)

    def unknown_tokens(self, text: str) -> list[str]:
        """Tokens con forma válida que no están en esta sesión (el ejecutor no los escribe)."""
        return [t for t in T.find(text) if t not in self._by_token]


class VaultStore:
    """Una bóveda por sesión."""

    def __init__(self) -> None:
        self._vaults: dict[str, Vault] = {}
        self._lock = threading.Lock()

    def get(self, session: str) -> Vault:
        with self._lock:
            if session not in self._vaults:
                self._vaults[session] = Vault(session)
            return self._vaults[session]

    def all(self) -> list[Vault]:
        with self._lock:
            return list(self._vaults.values())

    def drop(self, session: str) -> None:
        with self._lock:
            self._vaults.pop(session, None)
