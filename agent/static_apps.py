"""The three demo web apps (Alba Core, the mailbox and the audit console) from their static
builds, for the priv8-mcp bundle (#157): nobody needs Node to try Priv8.

    python -m agent.static_apps apps/            # serve the three builds, Ctrl-C stops them
    python -m agent.static_apps apps/ --open     # and open the console in the browser

`apps/` holds `erp-sim/`, `inbox-sim/` and `console/`, each one the `dist/` of its Vite app.
Each app gets its own port on 127.0.0.1 only (PRIV8_ALBA_PORT, PRIV8_INBOX_PORT and
PRIV8_CONSOLE_PORT, by default 5173, 5174 and 5175, the same as `make web`). A port that
already answers is left alone: the running app is reused, so `make web` or another copy
keeps working.

The apps route on the client (/bandeja, /correo/m1, /facturas/alta): a path that is not a
file gets the app's index.html. There is no directory listing.
"""

from __future__ import annotations

import argparse
import os
import socket
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"

# (name, folder under the apps dir, port variable, default port)
APPS: tuple[tuple[str, str, str, int], ...] = (
    ("alba-core", "erp-sim", "PRIV8_ALBA_PORT", 5173),
    ("inbox", "inbox-sim", "PRIV8_INBOX_PORT", 5174),
    ("console", "console", "PRIV8_CONSOLE_PORT", 5175),
)


def port_of(var: str, default: int, env: dict[str, str] | None = None) -> int:
    raw = (os.environ if env is None else env).get(var, "").strip()
    return int(raw) if raw else default


def is_up(port: int, host: str = HOST, timeout: float = 0.3) -> bool:
    """Something already listens on host:port."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


class SpaHandler(SimpleHTTPRequestHandler):
    """Static files of one Vite build, with index.html for client-side routes."""

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - quiet: stdout is MCP's
        pass

    def list_directory(self, path: str):  # noqa: ANN201 - no listings
        self.send_error(404)
        return None

    def end_headers(self) -> None:
        # index.html changes with each bundle; the hashed assets can be cached.
        if not self.path.startswith("/assets/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):  # noqa: ANN201
        path = self.translate_path(self.path)
        last = self.path.split("?", 1)[0].split("#", 1)[0].rstrip("/").rsplit("/", 1)[-1]
        if not os.path.exists(path) and "." not in last:
            self.path = "/index.html"  # a client-side route: the app decides
        return super().send_head()


def serve(apps_dir: str | Path, *, env: dict[str, str] | None = None) -> dict[str, tuple[int, bool]]:
    """Start a server thread for each app whose port is free. Returns {name: (port, started)};
    `started` is False when the port already answered and that app was reused."""
    root = Path(apps_dir).resolve()
    out: dict[str, tuple[int, bool]] = {}
    for name, folder, var, default in APPS:
        port = port_of(var, default, env)
        if is_up(port):
            out[name] = (port, False)
            continue
        directory = root / folder
        if not (directory / "index.html").is_file():
            raise FileNotFoundError(f"falta la build de {name} en {directory}")
        httpd = ThreadingHTTPServer((HOST, port), partial(SpaHandler, directory=str(directory)))
        httpd.daemon_threads = True
        threading.Thread(target=httpd.serve_forever, name=f"priv8-static-{name}", daemon=True).start()
        out[name] = (port, True)
    return out


def console_url(env: dict[str, str] | None = None) -> str:
    """PRIV8_CONSOLE_URL, or the console on its port (with ?ws= when the events port moved)."""
    e = os.environ if env is None else env
    if e.get("PRIV8_CONSOLE_URL"):
        return e["PRIV8_CONSOLE_URL"]
    url = f"http://{HOST}:{port_of('PRIV8_CONSOLE_PORT', 5175, e)}/"
    events = port_of("PRIV8_EVENTS_PORT", 8700, e)
    return url if events == 8700 else f"{url}?ws=ws://{HOST}:{events}/events"


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Serve the static builds of Alba Core, the mailbox and the console")
    p.add_argument("apps_dir", help="folder with erp-sim/, inbox-sim/ and console/")
    p.add_argument("--open", action="store_true", help="open the console in the browser")
    a = p.parse_args(argv)
    try:
        started = serve(a.apps_dir)
    except (FileNotFoundError, OSError) as e:
        sys.exit(f"priv8: {e}")
    for name, (port, new) in started.items():
        print(f"priv8: {name} en http://{HOST}:{port}/" + ("" if new else " (ya estaba en marcha)"), file=sys.stderr)
    if a.open:
        webbrowser.open(console_url())
    if not any(new for _, new in started.values()):
        print("priv8: las tres apps ya estaban en marcha", file=sys.stderr)
        return
    print("priv8: Ctrl-C para parar", file=sys.stderr)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
