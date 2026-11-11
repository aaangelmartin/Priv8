"""Canal de eventos del proceso (events.schema.json).

Publica audit, screen, voice y confirm_request a quien se suscriba: el
WebSocket de la consola (:8700, #13), el puente Android y la app 8. Un
suscriptor que falla no rompe al resto ni al núcleo.
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from typing import Any

Listener = Callable[[dict[str, Any]], None]

_listeners: list[Listener] = []
_lock = threading.Lock()


def subscribe(fn: Listener) -> Callable[[], None]:
    with _lock:
        _listeners.append(fn)

    def unsubscribe() -> None:
        with _lock:
            if fn in _listeners:
                _listeners.remove(fn)
    return unsubscribe


def publish(msg: dict[str, Any]) -> None:
    with _lock:
        targets = list(_listeners)
    for fn in targets:
        try:
            fn(msg)
        except Exception:  # noqa: BLE001 - un cliente roto no para el núcleo
            pass


def count() -> int:
    """Suscriptores conectados (el puente espera a que la app 8 se conecte antes de hablar)."""
    with _lock:
        return len(_listeners)


def clear() -> None:
    with _lock:
        _listeners.clear()
