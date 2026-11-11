"""Interfaz de adaptador - contrato v1 (docs/contracts/README.md).

El adaptador web (Camino 2) la implementa en Python con Playwright. El de
Android (Camino 3) vive al otro lado del puente WebSocket
(docs/contracts/bridge.schema.json) y el núcleo lo envuelve en una clase que
cumple esta misma interfaz.

Todo lo que pasa por aquí lleva valores reales y nunca sale de la zona de
confianza.
"""

from __future__ import annotations

from typing import Any, Literal, Protocol, TypedDict, runtime_checkable

# docs/contracts/snapshot.schema.json
RawSnapshot = dict[str, Any]

Op = Literal["tap", "type", "key", "scroll", "open_app", "back", "send", "call"]


class RealAction(TypedDict, total=False):
    """Acción con los tokens ya rehidratados por el ejecutor."""

    op: Op  # obligatorio
    target: str  # id del elemento del último snapshot
    text: str  # valor real para type; tecla para key; app para open_app
    direction: Literal["up", "down", "left", "right"]


class Result(TypedDict, total=False):
    ok: bool  # obligatorio
    error: Literal["target_no_encontrado", "no_permitido", "timeout", "otro"]


@runtime_checkable
class Adapter(Protocol):
    def snapshot(self) -> RawSnapshot:
        """Pantalla actual con valores reales (snapshot.schema.json)."""
        ...

    def perform(self, action: RealAction) -> Result:
        """Ejecuta la acción en la pantalla. Recibe el valor ya rehidratado."""
        ...
