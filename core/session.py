"""Estado de cada sesión en el proceso: bóveda, adaptador y última pantalla."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any

from .adapter import Adapter
from .policies import Screen
from .vault import Vault

DEFAULT_BUDGET = 30  # preguntas al oráculo por sesión


@dataclass
class Session:
    id: str
    vault: Vault
    adapter: Adapter | None = None
    last_raw: dict[str, Any] | None = None
    last_screen: Screen | None = None
    last_paused: str | None = None
    last_obs: dict[str, Any] | None = None  # última observación enviada (para los fotogramas, #147)
    budget_left: int = DEFAULT_BUDGET
    extra: dict[str, Any] = field(default_factory=dict)  # para #10, #11 y #12

    def element(self, element_id: str) -> dict[str, Any] | None:
        for el in (self.last_raw or {}).get("elements", []):
            if el.get("id") == element_id:
                return el
        return None


class Sessions:
    def __init__(self, store):
        self._store = store
        self._sessions: dict[str, Session] = {}
        self._lock = threading.Lock()

    def get(self, session_id: str) -> Session:
        with self._lock:
            s = self._sessions.get(session_id)
            if s is None:
                s = Session(session_id, self._store.get(session_id))
                self._sessions[session_id] = s
            return s

    def ids(self) -> list[str]:
        with self._lock:
            return list(self._sessions)
