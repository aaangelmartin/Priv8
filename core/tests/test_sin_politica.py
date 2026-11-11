"""Pantalla sin política (#148): el núcleo vuelve a una pantalla conocida o dice cómo volver."""

import importlib
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FACTURA = json.loads((ROOT / "docs" / "contracts" / "examples" / "snapshot.web-factura.json")
                     .read_text(encoding="utf-8"))
MUERTA = {"source": "web", "app": "alba-core", "screen": None, "url": "about:blank", "seq": 0,
          "focus": None, "system_dialog": None, "elements": []}


class Web:
    """Adaptador falso: empieza en una página sin política; open_app la lleva al alta."""

    apps = {"alba-core": "http://alba", "inbox": "http://correo"}

    def __init__(self, recovers: bool):
        self.raw, self.recovers, self.performed = dict(MUERTA), recovers, []

    def snapshot(self):
        return json.loads(json.dumps(self.raw))

    def perform(self, action):
        self.performed.append(action)
        if action["op"] == "open_app":
            self.raw = json.loads(json.dumps(FACTURA))
        return {"ok": True}


class Recovering(Web):
    def recover(self):
        if not self.recovers:
            return False
        self.raw = json.loads(json.dumps(FACTURA))
        return True


@pytest.fixture
def core():
    import core as c
    return importlib.reload(c)


def test_observe_se_recupera_solo(core):
    web = Recovering(recovers=True)
    core.connect("s1", web)
    obs = core.observe("s1")
    assert obs.get("screen") == "factura.alta", obs
    details = [e.get("detail") for e in core.AUDIT.events]
    assert "pantalla sin política: vuelta a la pantalla de inicio" in details


def test_sin_recuperar_dice_como_volver(core):
    for web in (Web(recovers=False), Recovering(recovers=False)):
        core.connect("s1", web)
        obs = core.observe("s1")
        assert obs == {"denied": "sin_regla", "detail": "No hay política para esta pantalla. "
                       "Vuelve con act open_app alba-core o act open_app inbox."}
        assert "·" not in obs["detail"]


def test_open_app_funciona_sin_pantalla_observada(core):
    web = Web(recovers=False)
    core.connect("s1", web)
    assert "denied" in core.observe("s1")
    # El resto de acciones siguen pidiendo observar antes; open_app es la salida.
    assert core.act("s1", "back")["detail"] == "observa la pantalla antes de actuar"
    assert core.act("s1", "open_app", text="alba-core") == {"ok": True}
    assert web.performed == [{"op": "open_app", "text": "alba-core"}]
    assert core.observe("s1")["screen"] == "factura.alta"


def test_raiz_de_las_apps_tiene_politica(core):
    """"/" pinta el alta en Alba Core y la bandeja en el correo: no es una pantalla muerta."""
    alta = dict(FACTURA, url="http://127.0.0.1:5173/")
    assert core.policies().screen_for(alta).id == "factura.alta"
    bandeja = {"source": "web", "app": "inbox", "url": "http://127.0.0.1:5174/", "elements": []}
    assert core.policies().screen_for(bandeja).id == "bandeja"
    assert core.policies().screen_for(dict(bandeja, url="http://127.0.0.1:5174/enviados")) is None
