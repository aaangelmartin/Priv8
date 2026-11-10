"""Auditoría firmada: JSONL encadenado por hashes (audit.schema.json).

Cada línea lleva prev (hash de la anterior), hash = sha256(prev + línea
canónica sin hash ni sig) y sig = firma ed25519 del hash con la clave local
del núcleo. Una línea alterada, quitada o reordenada rompe la cadena.

    python -m core.audit verify audit/priv8.jsonl [--pub clave.pub]

Clave: PRIV8_AUDIT_KEY (por defecto audit/priv8.key); se crea si no existe y
su pública queda al lado (.pub). Registro: PRIV8_AUDIT (por defecto
audit/priv8.jsonl); PRIV8_AUDIT=off deja la auditoría solo en memoria.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

GENESIS = "sha256:" + "0" * 64
INPUT_FIELDS = frozenset({
    "session", "kind", "reason", "app", "screen", "model_saw", "tokens",
    "confirm", "approved_by", "counts", "detail", "ms",
})
ROOT = Path(__file__).resolve().parent.parent


def canonical(event: dict[str, Any]) -> bytes:
    body = {k: v for k, v in event.items() if k not in ("hash", "sig")}
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def chain_hash(prev: str, event: dict[str, Any]) -> str:
    return "sha256:" + hashlib.sha256(prev.encode() + canonical(event)).hexdigest()


def load_or_create_key(path: Path) -> Ed25519PrivateKey:
    if path.exists():
        key = serialization.load_pem_private_key(path.read_bytes(), password=None)
        assert isinstance(key, Ed25519PrivateKey)
        return key
    key = Ed25519PrivateKey.generate()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                       serialization.NoEncryption()))
    path.with_suffix(".pub").write_bytes(key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
    return key


class Audit:
    def __init__(self, path: str | Path | None = None, key: Ed25519PrivateKey | None = None):
        self.events: list[dict[str, Any]] = []
        self._lock = threading.Lock()
        self.path = Path(path) if path else None
        self.key = key or Ed25519PrivateKey.generate()
        if self.path and self.path.exists():  # continúa la cadena de una ejecución anterior
            lines = self.path.read_text(encoding="utf-8").splitlines()
            if lines:
                last = json.loads(lines[-1])
                self._prev, self._seq = last["hash"], last["seq"] + 1
                return
        self._prev, self._seq = GENESIS, 0

    @classmethod
    def from_env(cls) -> Audit:
        where = os.environ.get("PRIV8_AUDIT", str(ROOT / "audit" / "priv8.jsonl"))
        key = load_or_create_key(Path(os.environ.get("PRIV8_AUDIT_KEY", str(ROOT / "audit" / "priv8.key"))))
        if where.lower() == "off":
            return cls(None, key)
        Path(where).parent.mkdir(parents=True, exist_ok=True)
        return cls(where, key)

    @property
    def public_key(self) -> Ed25519PublicKey:
        return self.key.public_key()

    def record(self, event: dict[str, Any]) -> dict[str, Any]:
        # Los opcionales a None se omiten (el esquema los quiere como texto o ausentes).
        event = {k: v for k, v in event.items()
                 if v is not None or k in ("model_saw", "approved_by", "screen")}
        extra = set(event) - INPUT_FIELDS
        if extra:
            raise ValueError(f"campos no admitidos en record: {sorted(extra)}")
        if "session" not in event or "kind" not in event:
            raise ValueError("record necesita session y kind")
        with self._lock:
            stored = {
                "seq": self._seq,
                "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                "model_saw": None, "tokens": [], "approved_by": None,
                "ms": {"core": None, "adapter": None, "model": None},
                **event,
                "prev": self._prev,
            }
            stored["hash"] = chain_hash(self._prev, stored)
            stored["sig"] = "ed25519:" + base64.b64encode(self.key.sign(stored["hash"].encode())).decode()
            if self.path:
                with self.path.open("a", encoding="utf-8") as f:
                    f.write(json.dumps(stored, ensure_ascii=False, separators=(",", ":")) + "\n")
            self.events.append(stored)
            self._prev, self._seq = stored["hash"], self._seq + 1
            return stored


def verify(lines: list[str], pub: Ed25519PublicKey | None = None) -> list[str]:
    """Errores de la cadena; lista vacía si todo cuadra."""
    errors, prev, seq = [], GENESIS, 0
    for i, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            ev = json.loads(line)
        except ValueError:
            errors.append(f"línea {i}: no es JSON")
            continue
        if ev.get("seq") != seq:
            errors.append(f"línea {i}: seq {ev.get('seq')} donde tocaba {seq}")
        if ev.get("prev") != prev:
            errors.append(f"línea {i}: prev no enlaza con la línea anterior")
        if chain_hash(ev.get("prev", ""), ev) != ev.get("hash"):
            errors.append(f"línea {i}: el hash no corresponde al contenido (línea alterada)")
        if pub is not None:
            try:
                sig = base64.b64decode(ev.get("sig", "").removeprefix("ed25519:"))
                pub.verify(sig, ev.get("hash", "").encode())
            except (InvalidSignature, ValueError):
                errors.append(f"línea {i}: firma no válida")
        prev, seq = ev.get("hash"), (ev.get("seq") or 0) + 1
    return errors


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[0] != "verify":
        print("uso: python -m core.audit verify FICHERO.jsonl [--pub CLAVE.pub]")
        return 2
    path = Path(argv[1])
    pub = None
    pub_path = Path(argv[argv.index("--pub") + 1]) if "--pub" in argv else path.with_name("priv8.pub")
    if pub_path.exists():
        pub = serialization.load_pem_public_key(pub_path.read_bytes())
    errors = verify(path.read_text(encoding="utf-8").splitlines(), pub)
    n = sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.strip())
    if errors:
        print("\n".join(errors))
        print(f"MAL: {len(errors)} problemas en {n} líneas")
        return 1
    print(f"OK: {n} líneas encadenadas" + (" y firmadas" if pub else " (sin clave pública: firma sin comprobar)"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
