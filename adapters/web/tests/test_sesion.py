"""Sesión recordada de Alba Core (#137) sin abrir un navegador: perfil, login y espera.

    uv run pytest adapters/web/tests/test_sesion.py
"""

from __future__ import annotations

from pathlib import Path

from adapters.web.adapter import DEFAULT_PROFILE, WebAdapter, on_login_screen, profile_dir


def test_perfil_por_defecto_en_el_repo_y_fuera_de_git():
    assert profile_dir({}) == DEFAULT_PROFILE
    assert DEFAULT_PROFILE.parts[-2:] == (".priv8", "chromium")
    root = DEFAULT_PROFILE.parents[1]
    assert ".priv8/" in (root / ".gitignore").read_text(encoding="utf-8").splitlines()


def test_perfil_configurable_o_apagado(tmp_path):
    assert profile_dir({"PRIV8_WEB_PROFILE": str(tmp_path)}) == tmp_path
    for off in ("off", "OFF", "0", "no"):
        assert profile_dir({"PRIV8_WEB_PROFILE": off}) is None


def test_pantalla_de_login():
    assert on_login_screen("http://127.0.0.1:5173/login")
    assert on_login_screen("http://127.0.0.1:5173/login/")
    assert not on_login_screen("http://127.0.0.1:5173/facturas/alta")
    assert not on_login_screen("http://127.0.0.1:5173/proveedores/7?login=1")
    assert not on_login_screen("about:blank")


class FakePage:
    def __init__(self, urls: list[str]) -> None:
        self.urls = list(urls)  # una URL por consulta; la última se queda
        self.front = 0

    @property
    def url(self) -> str:
        return self.urls.pop(0) if len(self.urls) > 1 else self.urls[0]

    def wait_for_selector(self, sel: str, timeout: int) -> None:
        pass

    def bring_to_front(self) -> None:
        self.front += 1


def _adapter(page: FakePage) -> WebAdapter:
    w = object.__new__(WebAdapter)  # sin hilo ni Chromium
    w.app, w._timeout = "inbox", 10
    w._call = lambda fn: fn()
    w._page = lambda app: page
    return w


def test_sesion_abierta_no_espera_a_nadie():
    page = FakePage(["http://127.0.0.1:5173/facturas/alta"])
    w = _adapter(page)
    assert w.logged_in("alba-core")
    assert w.wait_until_logged_in("alba-core", timeout_s=0.01)


def test_sin_sesion_espera_a_la_persona(monkeypatch):
    import time
    monkeypatch.setattr(time, "sleep", lambda s: None)
    page = FakePage(["http://x/login", "http://x/login", "http://x/facturas/alta"])
    w = _adapter(page)
    assert w.wait_until_logged_in("alba-core", timeout_s=5)
    assert page.front >= 2  # el login al frente mientras espera, después la app activa


def test_sesion_caducada_cae_en_la_espera_de_hoy(monkeypatch):
    import time
    monkeypatch.setattr(time, "sleep", lambda s: None)
    w = _adapter(FakePage(["http://x/login"]))
    assert not w.logged_in("alba-core")
    assert not w.wait_until_logged_in("alba-core", timeout_s=0.01)


class FakeChromium:
    def __init__(self, persistent_fails: bool = False) -> None:
        self.persistent_fails = persistent_fails
        self.calls: list[tuple[str, dict]] = []

    def launch_persistent_context(self, user_data_dir: str, **kw):
        self.calls.append(("persistent", {"dir": user_data_dir, **kw}))
        if self.persistent_fails:
            raise RuntimeError("perfil en uso")
        return "ctx-persistente"

    def launch(self, **kw):
        self.calls.append(("launch", kw))
        chromium = self

        class Browser:
            def new_context(self, **opts):
                chromium.calls.append(("new_context", opts))
                return "ctx-efimero"
        return Browser()


def _open(profile: Path | None, chromium: FakeChromium) -> tuple[WebAdapter, object]:
    w = object.__new__(WebAdapter)
    w.profile = profile
    w._pw = type("PW", (), {"chromium": chromium})()
    return w, w._open_context(headless=True, slow_mo_ms=0)


def test_con_perfil_abre_contexto_persistente(tmp_path):
    chromium = FakeChromium()
    prof = tmp_path / "chromium"
    w, ctx = _open(prof, chromium)
    assert ctx == "ctx-persistente" and w._browser is None
    assert chromium.calls[0][0] == "persistent" and chromium.calls[0][1]["dir"] == str(prof)
    assert chromium.calls[0][1]["locale"] == "es-ES"
    assert prof.is_dir()


def test_perfil_en_uso_cae_en_contexto_efimero(tmp_path, capsys):
    chromium = FakeChromium(persistent_fails=True)
    w, ctx = _open(tmp_path / "chromium", chromium)
    assert ctx == "ctx-efimero" and w.profile is None
    assert [c[0] for c in chromium.calls] == ["persistent", "launch", "new_context"]
    assert "sesión sin recordar" in capsys.readouterr().err


def test_sin_perfil_como_hasta_ahora():
    chromium = FakeChromium()
    _, ctx = _open(None, chromium)
    assert ctx == "ctx-efimero"
    assert [c[0] for c in chromium.calls] == ["launch", "new_context"]
