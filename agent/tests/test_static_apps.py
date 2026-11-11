"""agent/static_apps.py: the static builds of the three demo apps for the priv8-mcp bundle (#157)."""

import socket
import urllib.error
import urllib.request

import pytest

from agent import static_apps


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture
def apps(tmp_path):
    for folder in ("erp-sim", "inbox-sim", "console"):
        d = tmp_path / folder
        (d / "assets").mkdir(parents=True)
        (d / "index.html").write_text(f"<div id=root>{folder}</div>")
        (d / "assets" / "app.js").write_text("ok")
    return tmp_path


def get(url: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, ""


def test_serves_files_and_client_routes(apps):
    env = {"PRIV8_ALBA_PORT": str(free_port()), "PRIV8_INBOX_PORT": str(free_port()),
           "PRIV8_CONSOLE_PORT": str(free_port())}
    started = static_apps.serve(apps, env=env)
    assert all(new for _, new in started.values())
    inbox = f"http://127.0.0.1:{env['PRIV8_INBOX_PORT']}"
    assert get(f"{inbox}/assets/app.js") == (200, "ok")
    assert get(f"{inbox}/correo/9") == (200, "<div id=root>inbox-sim</div>")  # SPA fallback
    assert get(f"{inbox}/assets/missing.js")[0] == 404  # a missing file is not the app
    assert get(f"{inbox}/assets/")[0] == 404  # no directory listing
    alba = f"http://127.0.0.1:{env['PRIV8_ALBA_PORT']}"
    assert get(f"{alba}/facturas/alta") == (200, "<div id=root>erp-sim</div>")


def test_reuses_a_port_that_already_answers(apps):
    with socket.socket() as busy:
        busy.bind(("127.0.0.1", 0))
        busy.listen()
        env = {"PRIV8_ALBA_PORT": str(busy.getsockname()[1]), "PRIV8_INBOX_PORT": str(free_port()),
               "PRIV8_CONSOLE_PORT": str(free_port())}
        started = static_apps.serve(apps, env=env)
    assert started["alba-core"][1] is False
    assert started["inbox"][1] is True


def test_console_url_follows_the_events_port():
    assert static_apps.console_url({"PRIV8_CONSOLE_PORT": "5313"}) == "http://127.0.0.1:5313/"
    assert static_apps.console_url({"PRIV8_CONSOLE_PORT": "5313", "PRIV8_EVENTS_PORT": "8791"}) == \
        "http://127.0.0.1:5313/?ws=ws://127.0.0.1:8791/events"
