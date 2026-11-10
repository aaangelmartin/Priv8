from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path

# Tests that load the real core never write the repo's audit log or key.
os.environ.setdefault("PRIV8_AUDIT", "off")
os.environ.setdefault("PRIV8_AUDIT_KEY", os.path.join(tempfile.mkdtemp(prefix="priv8-"), "priv8.key"))

import pytest

from agent.fakes import SEED, build_fake_core

AGENT_DIR = Path(__file__).resolve().parents[1]
REPLAY = AGENT_DIR / "replays" / "registrar_factura.json"


@pytest.fixture
def world():
    """(Core bundle, FakeCore) over a fresh fake screen."""
    return build_fake_core()


def seed_leaks(payload: object) -> list[str]:
    """Seed keys whose real value appears in a payload (spaces ignored)."""
    flat = re.sub(r"\s+", "", json.dumps(payload, ensure_ascii=False, default=str)).lower()
    return [k for k, v in SEED.items() if re.sub(r"\s+", "", v).lower() in flat]
