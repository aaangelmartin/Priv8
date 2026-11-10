"""Auditoría: registro encadenado por hashes (audit.schema.json).

Versión mínima para #8: cadena sha256 en memoria. #13 añade la firma ed25519,
el JSONL en disco, `priv8 audit verify` y el envío a la consola.
"""

from __future__ import annotations

import hashlib
import json
import threading
from datetime import datetime, timezone
from typing import Any

GENESIS = "sha256:" + "0" * 64
INPUT_FIELDS = frozenset({
    "session", "kind", "reason", "app", "screen", "model_saw", "tokens",
    "confirm", "approved_by", "counts", "detail", "ms",
})


def canonical(event: dict[str, Any]) -> bytes:
    body = {k: v for k, v in event.items() if k not in ("hash", "sig")}
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


class Audit:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []
        self._lock = threading.Lock()

    def record(self, event: dict[str, Any]) -> dict[str, Any]:
        # Los opcionales a None se omiten (el esquema los quiere como texto o ausentes).
        event = {k: v for k, v in event.items()
                 if v is not None or k in ("model_saw", "approved_by", "screen")}
        extra = set(event) - INPUT_FIELDS
        if extra:
            raise ValueError(f"campos no admitidos en record: {sorted(extra)}")
        with self._lock:
            prev = self.events[-1]["hash"] if self.events else GENESIS
            stored = {
                "seq": len(self.events),
                "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                "model_saw": None, "tokens": [], "approved_by": None,
                "ms": {"core": None, "adapter": None, "model": None},
                **event,
                "prev": prev,
            }
            stored["hash"] = "sha256:" + hashlib.sha256(prev.encode() + canonical(stored)).hexdigest()
            stored["sig"] = "ed25519:AA=="  # #13: firma real
            self.events.append(stored)
            return stored
