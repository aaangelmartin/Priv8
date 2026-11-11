"""Panel local de la demo en directo (#169).

Sirve apps/panel/dist en http://127.0.0.1:5170 y abre el navegador. Desde ahí, un botón prepara B2B
(scripts/demo_b2b.sh) y otro B2C (scripts/movil.sh y el agente en el emulador). Las dos usan el puerto
8700, así que preparar una para la otra. Ctrl-C (o cerrar la ventana del Terminal) lo para todo.

Los casos preparados (data/casos.json, #187) se piden con un clic: POST /api/caso manda el pedido a 8
como task_request por el canal de eventos (ws://127.0.0.1:8700/events), igual que la consola o la app.

Uso: doble clic en «Demo Priv8.command», o make panel. Biblioteca estándar y, para /api/caso,
el paquete websockets del proyecto (se ejecuta con uv run).
"""

from __future__ import annotations

import collections
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "apps" / "panel" / "dist"
CASOS = ROOT / "data" / "casos.json"
PORT = int(os.environ.get("PRIV8_PANEL_PORT", "5170"))
ANDROID_HOME = Path(os.environ.get("ANDROID_HOME", Path.home() / "Library/Android/sdk"))
ADB = ANDROID_HOME / "platform-tools" / "adb"

PUERTOS = {"alba": 5173, "correo": 5174, "consola": 5175, "agente": 8700, "puente": 8765}
NECESITA = {"b2b": ["alba", "correo", "consola", "agente"], "b2c": ["emulador", "puente", "consola", "agente"]}

log: collections.deque[str] = collections.deque(maxlen=200)
lock = threading.Lock()
estado = {"modo": None, "motivo": ""}
procs: dict[str, subprocess.Popen] = {}  # "demo" (b2b o b2c) y "consola"


listo_movil = threading.Event()  # 8 ya espera la tarea en el móvil


def apunta(linea: str) -> None:
    log.append(f"{time.strftime('%H:%M:%S')}  {linea.rstrip()}")
    if "dicta la tarea" in linea:
        listo_movil.set()


def escucha(port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def emulador() -> bool:
    if not ADB.exists():
        return False
    try:
        out = subprocess.run([str(ADB), "devices"], capture_output=True, text=True, timeout=3).stdout
    except (OSError, subprocess.TimeoutExpired):
        return False
    return any(l.startswith("emulator-") and l.endswith("device") for l in out.splitlines())


def quien_escucha(port: int) -> str:
    try:
        pids = subprocess.run(["lsof", "-ti", f"tcp:{port}", "-sTCP:LISTEN"], capture_output=True, text=True).stdout.split()
    except OSError:
        return ""
    return pids[0] if pids else ""


def tiene_clave() -> bool:
    """Solo mira si ANTHROPIC_API_KEY tiene valor en .env o en el entorno; nunca lo lee en voz alta."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return True
    env = ROOT / ".env"
    if not env.exists():
        return False
    for linea in env.read_text().splitlines():
        k, _, v = linea.partition("=")
        if k.strip() == "ANTHROPIC_API_KEY" and v.strip().strip("\"'"):
            return True
    return False


def lanza(nombre: str, cmd: list[str], env: dict | None = None) -> None:
    p = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                         start_new_session=True, env={**os.environ, "PYTHONUNBUFFERED": "1", **(env or {})})
    procs[nombre] = p

    def lee() -> None:
        assert p.stdout
        for linea in p.stdout:
            apunta(linea)
        code = p.wait()
        apunta(f"[{nombre}] terminado ({code})")
        with lock:
            if procs.get(nombre) is p and nombre == "demo" and estado["modo"]:
                estado["motivo"] = "El proceso se ha parado. Mira «Lo que va pasando»."
    threading.Thread(target=lee, daemon=True).start()


def para(nombre: str) -> None:
    p = procs.pop(nombre, None)
    if not p or p.poll() is not None:
        return
    for sig, espera in ((signal.SIGINT, 8), (signal.SIGTERM, 4), (signal.SIGKILL, 2)):
        try:
            os.killpg(p.pid, sig)
        except ProcessLookupError:
            return
        try:
            p.wait(espera)
            return
        except subprocess.TimeoutExpired:
            continue


def consola() -> None:
    """La consola sirve a las dos demos: se arranca una vez y se queda."""
    if escucha(PUERTOS["consola"]) or ("consola" in procs and procs["consola"].poll() is None):
        return
    if not (ROOT / "apps/console/node_modules").exists():
        apunta("faltan las dependencias de la consola: make web-install")
        return
    lanza("consola", ["bash", "-c", "cd apps/console && exec pnpm dev"])
    for _ in range(60):  # que esté arriba antes de seguir: demo_b2b.sh no arranca otra
        if escucha(PUERTOS["consola"]):
            return
        time.sleep(0.5)


def prepara(modo: str) -> None:
    with lock:
        para("demo")
        for _ in range(20):  # el agente anterior suelta el 8700
            if not escucha(PUERTOS["agente"]):
                break
            time.sleep(0.25)
        estado.update(modo=modo, motivo="")
    apunta(f"preparando {modo.upper()}")
    if escucha(PUERTOS["agente"]):
        with lock:
            estado["motivo"] = "El puerto 8700 sigue ocupado por otro agente. Páralo desde el aviso de arriba."
        return
    consola()
    env_file = "--env-file .env" if (ROOT / ".env").exists() else ""
    if modo == "b2b":
        lanza("demo", ["scripts/demo_b2b.sh"])
    else:
        # compila siempre: Gradle no repite nada si no hay cambios, y así nunca se instala una app vieja
        listo_movil.clear()
        lanza("demo", ["bash", "-c", f"scripts/movil.sh && exec uv run {env_file} python -m agent.agent --android"])
        threading.Thread(target=trae_priv8, daemon=True).start()


def trae_priv8() -> None:
    """Cuando 8 ya espera la tarea (tras comprobar que la persona entró en el banco), pone la app
    Priv8 delante en el emulador para dictarle."""
    p = procs.get("demo")
    for _ in range(1200):
        if procs.get("demo") is not p or (p and p.poll() is not None):
            return
        if listo_movil.is_set():
            time.sleep(1)
            subprocess.run([str(ADB), "shell", "am", "start", "-n", "es.priv8.ocho/.MainActivity"],
                           capture_output=True, timeout=10)
            apunta("app Priv8 delante en el emulador")
            return
        time.sleep(0.5)


def osa(script: str) -> bool:
    r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=15)
    if r.returncode:
        apunta(f"macOS no dejó mover la ventana: {r.stderr.strip()} (Ajustes, Privacidad, Accesibilidad: permite Terminal)")
    return r.returncode == 0


def abre_consola() -> None:
    """La consola en su propia ventana, sin barra del navegador, para llevarla a una pantalla."""
    url = f"http://127.0.0.1:{PUERTOS['consola']}"
    chrome = Path("/Applications/Google Chrome.app")
    if sys.platform == "darwin" and chrome.exists():
        subprocess.run(["open", "-na", str(chrome), "--args", f"--app={url}", "--new-window"], capture_output=True)
    else:
        webbrowser.open(url)


def ve_pantallas() -> None:
    """El Chromium de 8 (Alba Core y el correo) delante y a pantalla completa."""
    try:
        pid = subprocess.run(["pgrep", "-f", "ms-playwright/chromium-.*/Chromium"], capture_output=True,
                             text=True).stdout.split()[0]
    except IndexError:
        apunta("no encuentro el Chromium de 8: prepara B2B primero")
        return
    osa(f"""tell application "System Events" to tell (first process whose unix id is {pid})
  set frontmost to true
  set w to first window whose name contains "Chromium"
  perform action "AXRaise" of w
  set value of attribute "AXFullScreen" of w to true
end tell""")


def ve_movil() -> None:
    osa('tell application "System Events" to set frontmost of (first process whose name is "qemu-system-aarch64") to true')


def casos() -> list[dict]:
    return json.loads(CASOS.read_text())["casos"]


def busca_caso(cid: object, lista: list[dict] | None = None) -> dict | None:
    """El caso con ese id, solo si es un pedido (los que tienen pedido null, como el de sin protocolo,
    no se le piden a 8)."""
    if not isinstance(cid, str):
        return None
    for c in casos() if lista is None else lista:
        if c.get("id") == cid and isinstance(c.get("pedido"), str) and c.get("vertical") in ("b2b", "b2c"):
            return c
    return None


def valida_caso(cid: object, modo: str | None, agente: bool, lista: list[dict] | None = None) -> tuple[dict | None, str]:
    """(caso, "") si se puede pedir ahora; (None, motivo en español) si no."""
    caso = busca_caso(cid, lista)
    if not caso:
        return None, "Ese caso no existe o no es un pedido para 8."
    v = caso["vertical"]
    if modo != v:
        return None, f"«{caso['titulo']}» es de {v.upper()}: prepara {v.upper()} primero."
    if not agente:
        return None, "8 no está escuchando en el puerto 8700. Espera a que la demo esté lista."
    return caso, ""


def mensaje_caso(caso: dict) -> dict:
    return {"type": "task_request", "session": caso["vertical"], "text": caso["pedido"]}


def envia_tarea(msg: dict, port: int | None = None) -> None:
    """Un task_request por el canal de eventos del núcleo. Un cliente nativo no manda Origin, así que
    el núcleo lo acepta como el de la app 8."""
    from websockets.sync.client import connect

    with connect(f"ws://127.0.0.1:{port or PUERTOS['agente']}/events", open_timeout=3, close_timeout=1) as ws:
        ws.send(json.dumps(msg, ensure_ascii=False))


def pide_caso(cid: object) -> str:
    """Manda el caso a 8. Devuelve "" si salió, o el motivo si no."""
    caso, motivo = valida_caso(cid, estado["modo"], escucha(PUERTOS["agente"]))
    if not caso:
        return motivo
    try:
        envia_tarea(mensaje_caso(caso))
    except Exception as e:  # noqa: BLE001 - cualquier fallo del canal es el mismo aviso
        apunta(f"no se pudo enviar el pedido: {e}")
        return "No se pudo hablar con 8 por el puerto 8700. Mira «Lo que va pasando»."
    apunta(f"pedido enviado: {caso['titulo']}")
    return ""


ENFOCA = {"consola": abre_consola, "pantallas": ve_pantallas, "movil": ve_movil}


def fase(piezas: dict) -> str:
    modo = estado["modo"]
    if not modo:
        return "parado"
    if all(piezas.get(k) for k in NECESITA[modo]) and (modo == "b2b" or listo_movil.is_set()):
        return "listo"
    p = procs.get("demo")
    if estado["motivo"] or (p and p.poll() is not None):
        return "error"
    return "preparando"


def foto() -> dict:
    piezas = {k: escucha(port) for k, port in PUERTOS.items()}
    piezas["emulador"] = emulador()
    ajeno = ""
    p = procs.get("demo")
    if piezas["agente"] and not (p and p.poll() is None):
        pid = quien_escucha(PUERTOS["agente"])
        ajeno = f"pid {pid}" if pid else "otro proceso"
    return {"modo": estado["modo"], "fase": fase(piezas), "piezas": piezas, "motivo": estado["motivo"],
            "ocupado": ajeno, "clave": tiene_clave(), "log": list(log)[-80:]}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(DIST), **kw)

    def log_message(self, *a) -> None:  # sin ruido en el Terminal
        pass

    def _json(self, data: dict, code: int = 200) -> None:
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.startswith("/api/estado"):
            return self._json(foto())
        return super().do_GET()

    def do_POST(self) -> None:
        # solo desde esta página: el navegador manda Origin en los POST
        origin = self.headers.get("Origin", "")
        if origin and origin not in (f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}", "http://127.0.0.1:5171"):
            return self._json({"error": "origen"}, 403)
        accion = self.path.removeprefix("/api/")
        if accion == "caso":
            try:
                n = int(self.headers.get("Content-Length") or 0)
                cid = json.loads(self.rfile.read(min(n, 4096)) or b"{}").get("id")
            except (ValueError, AttributeError):
                cid = None
            motivo = pide_caso(cid)
            if motivo:
                return self._json({"error": motivo}, 409)
        elif accion in ("b2b", "b2c"):
            threading.Thread(target=prepara, args=(accion,), daemon=True).start()
            time.sleep(0.2)
        elif accion == "parar":
            with lock:
                para("demo")
                estado.update(modo=None, motivo="")
            apunta("parado")
        elif accion in ("consola", "pantallas", "movil"):
            threading.Thread(target=ENFOCA[accion], daemon=True).start()
        elif accion == "liberar":
            pid = quien_escucha(PUERTOS["agente"])
            if pid:
                os.kill(int(pid), signal.SIGINT)
                apunta(f"parado el agente que ocupaba el 8700 (pid {pid})")
                time.sleep(1)
        else:
            return self._json({"error": "acción desconocida"}, 404)
        return self._json(foto())


def main() -> None:
    if not (DIST / "index.html").exists():
        sys.exit("priv8: falta la build del panel: make panel (o cd apps/panel && pnpm install && pnpm build)")
    for herramienta in ("uv", "pnpm"):
        if not shutil.which(herramienta):
            apunta(f"aviso: no encuentro {herramienta} en el PATH")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        url = f"http://127.0.0.1:{PORT}"
        print(f"priv8: el panel ya está abierto en {url}")
        webbrowser.open(url)
        return
    url = f"http://127.0.0.1:{PORT}"
    print(f"priv8: panel de la demo en {url} (Ctrl-C o cierra esta ventana para pararlo todo)")
    if not os.environ.get("PRIV8_PANEL_NO_ABRIR"):
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()

    def sal(*_):
        print("\npriv8: parando la demo")
        para("demo")
        para("consola")
        os._exit(0)
    signal.signal(signal.SIGINT, sal)
    signal.signal(signal.SIGTERM, sal)
    signal.signal(signal.SIGHUP, sal)
    server.serve_forever()


if __name__ == "__main__":
    main()
