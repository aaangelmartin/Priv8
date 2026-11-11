"""Canal de eventos del proceso (events.schema.json).

Publica audit, screen, voice y confirm_request a quien se suscriba: el
WebSocket de la consola (:8700, #13), el puente Android y la app 8. Un
suscriptor que falla no rompe al resto ni al núcleo.

Los fotogramas de la pantalla real (#147) van por un canal aparte
(subscribe_frames / publish_frame): llevan píxeles con valores reales, así que
nunca pasan por publish(), ni por la auditoría, ni por el puente, ni por la app
8. Solo los reciben los clientes del WebSocket que los piden (la consola), y
los adaptadores solo los generan mientras hay alguno (frame_watchers()).
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


_frame_listeners: list[Listener] = []
_last_frames: dict[str, dict[str, Any]] = {}  # último fotograma de cada sesión, para quien llega tarde


def subscribe_frames(fn: Listener) -> Callable[[], None]:
    """Fotogramas de la pantalla real. Al suscribirse recibe el último de cada sesión
    (una página quieta no manda fotogramas nuevos)."""
    with _lock:
        _frame_listeners.append(fn)
        last = list(_last_frames.values())
    for msg in last:
        try:
            fn(msg)
        except Exception:  # noqa: BLE001
            pass

    def unsubscribe() -> None:
        with _lock:
            if fn in _frame_listeners:
                _frame_listeners.remove(fn)
    return unsubscribe


def publish_frame(msg: dict[str, Any]) -> None:
    with _lock:
        if isinstance(msg.get("session"), str):
            _last_frames[msg["session"]] = msg
        targets = list(_frame_listeners)
    for fn in targets:
        try:
            fn(msg)
        except Exception:  # noqa: BLE001
            pass


def frame_watchers() -> int:
    """Clientes que miran la pantalla real ahora: sin ninguno, los adaptadores no capturan."""
    with _lock:
        return len(_frame_listeners)


def count() -> int:
    """Suscriptores conectados (el puente espera a que la app 8 se conecte antes de hablar)."""
    with _lock:
        return len(_listeners)


def clear() -> None:
    with _lock:
        _listeners.clear()
        _frame_listeners.clear()
        _last_frames.clear()
