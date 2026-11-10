from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from fakes import SEED, build_fake_core

MCP_DIR = Path(__file__).resolve().parents[1]
REPLAY = MCP_DIR / "replays" / "registrar_factura.json"


@pytest.fixture
def world():
    """(Core bundle, FakeCore) over a fresh fake screen."""
    return build_fake_core()


def seed_leaks(payload: object) -> list[str]:
    """Seed keys whose real value appears in a payload (spaces ignored)."""
    flat = re.sub(r"\s+", "", json.dumps(payload, ensure_ascii=False, default=str)).lower()
    return [k for k, v in SEED.items() if re.sub(r"\s+", "", v).lower() in flat]
