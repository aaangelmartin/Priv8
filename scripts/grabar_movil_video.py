"""Graba en vídeo los casos B2C en el emulador para el reproductor lado a lado de la web de la demo.

    uv run python scripts/grabar_movil_video.py                         # los cuatro casos B2C
    uv run python scripts/grabar_movil_video.py --caso b2c-broker       # uno

A la izquierda del reproductor va el vídeo real del emulador; a la derecha, «Lo que ve el
modelo»: el móvil redibujado con la observación tokenizada que recibió el modelo en cada paso,
sincronizada con el vídeo, y los subtítulos de lo que dice 8.

Para cada caso de data/casos.json:

1. Deja el móvil donde empieza el caso, con adb: los tres bancos vuelven al seed y a la sesión de
   la demo (`--ez reset true`, solo en depuración) y, en b2c-clave, Banca Alcor cierra la sesión
   («Salir») para quedarse en la pantalla de entrada.
2. Arranca el agente real (`python -m agent.agent --android`, núcleo real) con las tareas
   dictadas en el móvil: la persona hace el pedido en la app 8, como en la demo. El texto entra
   con el gancho de depuración de la app (`--es tarea`), porque `adb shell input text` no
   escribe tildes ni «¿».
3. Graba la pantalla del emulador (`adb shell screenrecord`) y el canal de eventos del núcleo
   (ws://127.0.0.1:8700/events): pantallas observadas (`observed` con tokens, `raw` con los
   valores y los `bounds`), registro, voz y confirmaciones, con la hora del portátil.
4. «La persona» la hace este script con adb, con pausas cortas: entra en el banco si lo pide
   (usuario y clave, letra a letra), confirma en la pantalla de 8 (botón Confirmar) y pone el
   código del SMS. El agente nunca escribe un secreto.
5. Sincroniza: el pedido (la app 8 aparece sobre el banco) es un cambio de pantalla con hora
   conocida en el portátil; se busca en el vídeo con el filtro de escenas de ffmpeg y la
   diferencia da el desfase entre la hora del portátil y el segundo del vídeo.
6. Recorta el vídeo (del pedido a lo último que dice 8), lo pasa a H.264 de 540 px sin audio y
   escribe en apps/demo-site/public/movil/ `<caso>.mp4`, `<caso>.jpg` (póster) y `<caso>.json`
   (formato priv8-movil/1, tiempos en segundos del vídeo). Del `raw` solo salen los `bounds`.

Antes de escribir comprueba el flujo del caso (casos_comun.falta) y que en el JSON no hay ningún
valor real del seed (salvo el pedido) ni nada del .env. Si un intento no sigue el flujo, repite.

Gasta API: el agente va en vivo con PRIV8_MODEL del .env (Haiku), con sus límites de gasto.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import shlex
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import grabar_sesion as gs  # noqa: E402
from casos_comun import caso as buscar, casos, falta  # noqa: E402

ROOT = HERE.parent
OUT = ROOT / "apps" / "demo-site" / "public" / "movil"
ANDROID_HOME = Path(os.environ.get("ANDROID_HOME", Path.home() / "Library/Android/sdk"))
ADB = shutil.which("adb") or str(ANDROID_HOME / "platform-tools" / "adb")
EVENTOS, PUENTE = 8700, 8765
OCHO = "es.priv8.ocho"
BANCOS = {"es.priv8.banks.alcor": "alcor", "es.priv8.banks.brezo": "brezo", "es.priv8.banks.nimbo": "nimbo"}
SEED = json.loads((ROOT / "data" / "seed.json").read_text(encoding="utf-8"))
REMOTO = "/sdcard/priv8-{}.mp4"
ANTES_S = 0.4      # segundos de vídeo antes del pedido
DESPUES_S = 2.0    # después de lo último que pasa


def log(m: str) -> None:
    print(f"[grabar-video] {m}", file=sys.stderr, flush=True)


def adb(*args: str, timeout: float = 20) -> str:
    return subprocess.run([ADB, *args], capture_output=True, text=True, timeout=timeout).stdout


def pausa(a: float = 0.6, b: float = 1.5) -> None:
    import random
    time.sleep(random.uniform(a, b))


# ------------------------------------------------------------------ el móvil

def foco() -> str:
    """La actividad delante (paquete/actividad), o ''."""
    out = adb("shell", "dumpsys", "window", timeout=10)
    m = re.search(r"mCurrentFocus=Window\{\S+ \S+ ([^}\s]+)\}", out)
    return m.group(1) if m else ""


def reset_ocho() -> None:
    """La app 8 desde cero (sin la conversación anterior). Parar la app para también su servicio
    de accesibilidad: se vuelve a activar como hace scripts/emu.sh."""
    servicio = f"{OCHO}/.Priv8AccessibilityService"
    adb("shell", "am", "force-stop", OCHO)
    adb("shell", "settings", "put", "secure", "enabled_accessibility_services", '""')
    time.sleep(0.8)
    adb("shell", "settings", "put", "secure", "enabled_accessibility_services", servicio)
    adb("shell", "settings", "put", "secure", "accessibility_enabled", "1")
    time.sleep(2.0)
    adb("shell", "am", "start", "-n", f"{OCHO}/.MainActivity")
    time.sleep(2.0)


def reset_bancos(salir_de: str | None = None) -> None:
    """Los tres bancos al seed, con la sesión de la demo abierta (solo depuración). Alcor delante."""
    for pkg in ["es.priv8.banks.brezo", "es.priv8.banks.nimbo", "es.priv8.banks.alcor"]:
        adb("shell", "am", "force-stop", pkg)
        adb("shell", "am", "start", "--activity-clear-task", "-n", f"{pkg}/es.priv8.banks.LoginActivity",
            "--ez", "reset", "true")
        time.sleep(1.2)
    if salir_de:  # el caso empieza con el banco en su pantalla de entrada
        for _ in range(10):
            if foco().endswith("HomeActivity"):
                break
            time.sleep(0.5)
        b = limites(salir_de, "btn_salir")
        if b is None:
            sys.exit(f"{salir_de}: no encuentro «Salir» para cerrar la sesión")
        tocar(b)
        for _ in range(10):
            if foco().endswith("LoginActivity"):
                return
            time.sleep(0.5)
        sys.exit(f"{salir_de}: no ha quedado en la pantalla de entrada")


def limites(pkg: str, rid: str, intentos: int = 4) -> tuple[int, int, int, int] | None:
    """bounds de un resource-id con uiautomator (las pantallas del banco están quietas)."""
    for _ in range(intentos):
        adb("shell", "rm", "-f", "/sdcard/priv8-ui.xml")
        adb("shell", "uiautomator", "dump", "/sdcard/priv8-ui.xml", timeout=25)
        xml = adb("shell", "cat", "/sdcard/priv8-ui.xml")
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            time.sleep(0.6)
            continue
        for n in root.iter("node"):
            if n.get("resource-id") == f"{pkg}:id/{rid}":
                x1, y1, x2, y2 = map(int, re.findall(r"\d+", n.get("bounds", "")))
                return x1, y1, x2, y2
        time.sleep(0.6)
    return None


def tocar(b: tuple[int, int, int, int]) -> None:
    adb("shell", "input", "tap", str((b[0] + b[2]) // 2), str((b[1] + b[3]) // 2))


def teclear(texto: str) -> None:
    """Letra a letra, como una persona (cada `input text` tarda unas décimas)."""
    for c in texto:
        adb("shell", "input", "text", shlex.quote(c))


def boton_confirmar() -> tuple[int, int] | None:
    """El botón Confirmar de la pantalla de 8 (cobalto lleno, a lo ancho). La pantalla se mueve
    (los ojos), así que uiautomator no la vuelca: se busca en una captura."""
    png = subprocess.run([ADB, "exec-out", "screencap", "-p"], capture_output=True, timeout=10).stdout
    if not png:
        return None
    w, h = 1080, 2400
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", "-", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         input=png, capture_output=True, timeout=20).stdout
    if len(raw) < w * h * 3:
        return None
    x = 150
    run = 0
    for y in range(300, h - 100):
        i = (y * w + x) * 3
        r, g, b = raw[i], raw[i + 1], raw[i + 2]
        if abs(r - 0x2D) < 24 and abs(g - 0x45) < 24 and abs(b - 0xD6) < 24:
            run += 1
        else:
            if 120 <= run <= 180:  # 56 dp de alto; los ojos (160 dp) son más altos
                return 540, y - run // 2
            run = 0
    return None


class Persona(threading.Thread):
    """La persona en el emulador: entra en el banco, confirma en la pantalla de 8 y pone el
    código del SMS. Mira la actividad delante cada pocas décimas."""

    def __init__(self, entra_ya: bool) -> None:
        super().__init__(daemon=True, name="persona")
        self.entra = threading.Event()
        if entra_ya:
            self.entra.set()
        self.parar = threading.Event()
        self.confirmar = threading.Event()  # hay un confirm_request en el móvil
        self.hechos: list[tuple[float, str, str]] = []  # (hora, tipo, texto)
        self.dentro: set[str] = set()
        self.codigos = 0

    def hito(self, tipo: str, texto: str) -> None:
        self.hechos.append((time.time(), tipo, texto))
        log(f"persona: {texto}")

    def run(self) -> None:
        while not self.parar.is_set():
            try:
                self.paso()
            except Exception as e:  # noqa: BLE001 - la persona sigue mirando
                log(f"persona: {type(e).__name__}: {e}")
            self.parar.wait(0.4)

    def paso(self) -> None:
        f = foco()
        pkg, _, act = f.partition("/")
        if pkg in BANCOS and act.endswith("LoginActivity") and self.entra.is_set() and pkg not in self.dentro:
            self.login(pkg)
        elif pkg in BANCOS and act.endswith("AuthActivity"):
            self.codigo(pkg)
        elif pkg == OCHO and act.endswith("ConfirmActivity") and self.confirmar.is_set():
            pausa(2.4, 3.0)  # lee y oye lo que 8 le pide
            p = boton_confirmar()
            if p is None:
                return
            adb("shell", "input", "tap", str(p[0]), str(p[1]))
            time.sleep(1.5)
            if foco().endswith("ConfirmActivity"):
                log(f"persona: el toque en {p} no ha cerrado la confirmación")
                return
            self.confirmar.clear()
            self.hito("aprobada", "La persona confirma en la pantalla de 8")

    def login(self, pkg: str) -> None:
        cred = SEED["bancos"][BANCOS[pkg]]
        pausa(1.0, 1.5)
        u, c, e = (limites(pkg, x) for x in ("usuario", "clave", "btn_entrar"))
        if None in (u, c, e):
            return
        nombre = cred["nombre"]
        self.hito("persona", f"La persona entra en {nombre} con su usuario y su clave")
        tocar(u)
        pausa(0.4, 0.7)
        teclear(cred["login"])
        pausa(0.5, 0.9)
        tocar(c)
        pausa(0.4, 0.7)
        teclear(cred["clave"])
        pausa(0.6, 1.0)
        tocar(e)
        self.dentro.add(pkg)

    def codigo(self, pkg: str) -> None:
        cred = SEED["bancos"][BANCOS[pkg]]
        pausa(1.0, 1.5)
        o, b = limites(pkg, "otp"), limites(pkg, "btn_confirmar_otp")
        if o is None or b is None:
            return
        self.hito("persona", "La persona pone el código del SMS")
        tocar(o)
        pausa(0.6, 1.0)
        teclear(cred["otp"])
        pausa(0.6, 1.0)
        tocar(b)
        self.codigos += 1
        for _ in range(20):  # hasta que el banco deja la pantalla del código
            if not foco().endswith("AuthActivity"):
                return
            time.sleep(0.5)


# ------------------------------------------------------------------ grabación

class Agente:
    def __init__(self, c: dict[str, Any], dotenv: dict[str, str]) -> None:
        cmd = ["uv", "run", "python", "-m", "agent.agent", "--android", "--no-simulated-persona"]
        if c.get("en_login"):
            cmd.append("--en-login")
        env = {**os.environ, **dotenv, "PRIV8_CORE": "real", "PRIV8_AUDIT": "off", "PRIV8_FRAMES": "1",
               "PYTHONUNBUFFERED": "1"}
        self.listo = threading.Event()   # espera la tarea dictada
        self.hecho = threading.Event()   # ha contestado y espera la siguiente
        self.empezado = threading.Event()  # ha recibido la tarea
        self.gasto = 0.0
        self.p = subprocess.Popen(cmd, cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                                  text=True, start_new_session=True)
        threading.Thread(target=self._leer, daemon=True).start()

    def _leer(self) -> None:
        assert self.p.stderr is not None
        for line in self.p.stderr:
            line = line.rstrip()
            if not line:
                continue
            print(f"  agente | {line[:200]}", file=sys.stderr, flush=True)
            if "dicta la tarea en el móvil" in line:
                self.listo.set()
            if re.match(r"\[\d+\] ", line) or "priv8: asesoría" in line or "asesor" in line.lower():
                self.empezado.set()
            m = re.search(r"gasto=([\d.]+)", line)
            if m:
                self.gasto = float(m.group(1))
            if "esperando la siguiente tarea dictada" in line:
                self.hecho.set()

    def parar(self) -> None:
        gs.parar(self.p)


async def escuchar(msgs: list[tuple[float, dict[str, Any]]], fin: threading.Event,
                   persona: Persona, caso: dict[str, Any]) -> None:
    import websockets

    for _ in range(240):
        try:
            ws = await websockets.connect(f"ws://127.0.0.1:{EVENTOS}/events", max_size=None)
            break
        except OSError:
            await asyncio.sleep(0.5)
    else:
        raise RuntimeError(f"el canal de eventos no responde en :{EVENTOS}")
    log("conectado al canal de eventos")
    try:
        while not fin.is_set():
            try:
                raw = await asyncio.wait_for(ws.recv(), 0.5)
            except asyncio.TimeoutError:
                continue
            except Exception:  # noqa: BLE001 - el agente se ha parado
                break
            try:
                m = json.loads(raw)
            except ValueError:
                continue
            if not isinstance(m, dict) or m.get("type") == "frame":
                continue
            msgs.append((time.time(), m))
            if m.get("type") == "confirm_request":
                persona.confirmar.set()
            if caso.get("en_login") and m.get("type") == "audit" and \
                    str((m.get("event") or {}).get("detail", "")).startswith("fin - paso"):
                persona.entra.set()  # 8 ha dejado la entrada a la persona
    finally:
        await ws.close()


def intento(c: dict[str, Any], dotenv: dict[str, str], tmp: Path) -> dict[str, Any] | None:
    for p in (EVENTOS, PUENTE):
        for _ in range(40):
            if gs.libre(p):
                break
            time.sleep(0.5)
        else:
            sys.exit(f"El puerto {p} está ocupado: para la demo en directo antes de grabar")
    log(f"{c['id']}: el móvil a su inicio")
    reset_ocho()
    reset_bancos("es.priv8.banks.alcor" if c.get("en_login") else None)
    adb("shell", "rm", "-f", REMOTO.format(c["id"]))

    persona = Persona(entra_ya=not c.get("en_login"))
    msgs: list[tuple[float, dict[str, Any]]] = []
    fin = threading.Event()
    agente = Agente(c, dotenv)
    oyente = threading.Thread(target=lambda: asyncio.run(escuchar(msgs, fin, persona, c)), daemon=True)
    oyente.start()
    grab: subprocess.Popen | None = None
    try:
        if not agente.listo.wait(180):
            log("el agente no llega a esperar la tarea")
            return None
        # La app 8 delante (sus ojos se mueven: screenrecord saca fotogramas seguidos desde el
        # principio) y su canal de eventos conectado.
        adb("shell", "am", "start", "--activity-single-top", "-n", f"{OCHO}/.MainActivity")
        time.sleep(2.5)
        grab = subprocess.Popen([ADB, "shell", "screenrecord", "--bit-rate", "6000000", "--time-limit", "180",
                                 REMOTO.format(c["id"])], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        h_grab = time.time()
        time.sleep(2.5)
        # Dos marcas para sincronizar: el banco delante (de la app 8, cobalto, al banco) y, 1,6 s
        # después, el pedido: la persona escribe en la app 8 (gancho de depuración, con tildes) y
        # la app vuelve delante con el pedido.
        inicio_app = "es.priv8.banks.alcor/es.priv8.banks.LoginActivity"
        adb("shell", "am", "start", "-n", inicio_app)
        h_marca1 = time.time()
        time.sleep(1.6)
        persona.start()
        pedir = f"am start --activity-single-top -n {OCHO}/.MainActivity --es tarea {shlex.quote(c['pedido'])}"
        adb("shell", pedir)
        h_marca = time.time()
        if not agente.empezado.wait(20):  # la app no ha mandado el pedido: otra vez, como haría la persona
            log("el pedido no llega al núcleo; se repite")
            adb("shell", pedir)
        if not agente.hecho.wait(200):
            log("el caso no termina en 200 s")
            return None
        if c.get("comprueba") and "pausa" in c["comprueba"]:
            for _ in range(60):  # la persona termina la autenticación del banco
                if persona.codigos or not foco().endswith(("AuthActivity", "ConfirmActivity")):
                    break
                time.sleep(0.5)
        time.sleep(DESPUES_S + 0.5)
    finally:
        persona.parar.set()
        fin.set()
        agente.parar()
        if grab is not None:
            adb("shell", "pkill", "-INT", "screenrecord")
            try:
                grab.wait(15)
            except subprocess.TimeoutExpired:
                grab.kill()
        oyente.join(5)
    time.sleep(1.5)
    crudo = tmp / f"{c['id']}-crudo.mp4"
    adb("pull", REMOTO.format(c["id"]), str(crudo), timeout=60)
    adb("shell", "rm", "-f", REMOTO.format(c["id"]))
    if not crudo.exists() or crudo.stat().st_size < 10_000:
        log("no hay vídeo")
        return None
    return {"msgs": msgs, "persona": persona.hechos, "h_grab": h_grab, "h_marca": h_marca, "h_marca1": h_marca1,
            "crudo": crudo, "gasto": agente.gasto}


# ------------------------------------------------------------------ sincronía y montaje

def escenas(video: Path, umbral: float = 0.05) -> list[float]:
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(video), "-vf",
                          f"scale=270:-2,select='gt(scene,{umbral})',showinfo", "-an", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return [float(x) for x in re.findall(r"pts_time:([\d.]+)", out)]


def desfase(r: dict[str, Any]) -> float:
    """Segundo del vídeo = hora del portátil + desfase. Hay dos marcas con hora conocida en el
    portátil: el banco aparece sobre la app 8 y, 1,6 s después, la app 8 vuelve con el pedido. Se
    buscan en el vídeo con el filtro de escenas: la primera pareja de cambios con esa separación."""
    esperado = r["h_marca1"] - r["h_grab"]
    hueco = r["h_marca"] - r["h_marca1"]
    cambios = escenas(r["crudo"])
    # el primer fotograma de cada racha de cambios (una transición son varios fotogramas)
    inicios = [t for i, t in enumerate(cambios) if i == 0 or t - cambios[i - 1] > 0.35]
    for a in inicios:
        if not (esperado - 3.0 <= a <= esperado + 2.0):
            continue
        for b in inicios:
            if abs((b - a) - hueco) <= 0.35:
                return ((a - r["h_marca1"]) + (b - r["h_marca"])) / 2
    raise RuntimeError(f"no encuentro las marcas en el vídeo (esperadas a {esperado:.1f} s y {hueco:.1f} s "
                       f"después; cambios en {[round(x, 2) for x in inicios[:12]]})")


def duracion_video(video: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                          str(video)], capture_output=True, text=True).stdout
    return float(out.strip() or 0)


def texto_segmentos(segs: list[dict[str, Any]]) -> str:
    return " ".join(s.get("text") or s.get("token") or "" for s in segs).strip()


def montar(c: dict[str, Any], r: dict[str, Any], dotenv: dict[str, str]) -> dict[str, Any]:
    off = desfase(r)
    v = lambda h: h + off  # noqa: E731 - hora del portátil -> segundo del vídeo crudo
    inicio = max(0.0, v(r["h_marca"]) - ANTES_S)
    msgs = r["msgs"]
    ultimos = [v(h) for h, _ in msgs] + [v(h) for h, _, _ in r["persona"]]
    fin_crudo = min(duracion_video(r["crudo"]), max(ultimos + [v(r["h_marca"])]) + DESPUES_S)
    t = lambda h: round(max(0.0, v(h) - inicio), 2)  # noqa: E731 - segundo del vídeo publicado

    pantallas = []
    for h, m in msgs:
        if m.get("type") != "screen":
            continue
        obs, raw = m.get("observed") or {}, m.get("raw") or {}
        caja = {e.get("id"): e.get("bounds") for e in raw.get("elements") or []}
        els = []
        for e in obs.get("elements") or []:
            rojo = e.get("cls") == "rojo"
            els.append({"id": e.get("id"), "role": e.get("role"), "text": None if rojo else e.get("text"),
                        "label": e.get("label"), "cls": e.get("cls"), "tokens": e.get("tokens") or [],
                        "bounds": caja.get(e.get("id")), "actions": e.get("actions") or []})
        pantallas.append({"t": t(h), "app": obs.get("app") or raw.get("app"), "screen": obs.get("screen"),
                          "paused": obs.get("paused"), "elementos": els})

    for h, m in msgs:  # una pausa antes de la política no publica pantalla: está en el registro
        ev = m.get("event") or {}
        if m.get("type") == "audit" and ev.get("kind") == "paused":
            pantallas.append({"t": t(h), "app": ev.get("app"), "screen": ev.get("screen"),
                              "paused": ev.get("detail"), "elementos": []})
    pantallas.sort(key=lambda x: x["t"])

    voz = []
    fin_voz: dict[str, float] = {}
    for h, m in msgs:
        ev = m.get("event") or {}
        if m.get("type") == "audit" and ev.get("kind") == "voice_out":
            u = str(ev.get("detail", "")).split(" | ")[0].strip()
            fin_voz.setdefault(u, h)
    for h, m in msgs:
        if m.get("type") == "voice":
            u = m.get("utterance") or {}
            segs = [{k: s[k] for k in ("voice", "text", "token", "say_as") if s.get(k) is not None}
                    for s in u.get("segments") or []]
            fh = fin_voz.get(u.get("utterance"))
            voz.append({"t": t(h), "fin": t(fh) if fh else round(t(h) + 4.0, 2), "segmentos": segs})

    hitos: list[dict[str, Any]] = [{"t": t(r["h_marca"]), "tipo": "pedido", "texto": c["pedido"]}]
    pausa_vista = False
    pausas: set[str] = set()
    for h, m in msgs:
        ev = m.get("event") or {}
        if m.get("type") == "audit" and ev.get("kind") == "oracle":
            n = len(re.findall(r"‹[^›]+›", ev.get("model_saw") or ""))
            op = {"sum": "suma", "compare": "compara", "matches": "coincidencia"}.get(
                (ev.get("model_saw") or "oracle x").split()[1], "cálculo")
            hitos.append({"t": t(h), "tipo": "oraculo", "texto": f"{op} de {n} importes, sin verlos"
                          if op == "suma" else f"{op} sin ver los datos"})
        elif m.get("type") == "audit" and ev.get("kind") == "blocked" and ev.get("reason") != "sin_regla":
            hitos.append({"t": t(h), "tipo": "bloqueo", "texto": {"asesoria": "asesoría: no llega al modelo"}.get(
                ev.get("reason"), str(ev.get("reason")))})
        elif m.get("type") == "confirm_request":
            hitos.append({"t": t(h), "tipo": "confirmacion",
                          "texto": "8 pide confirmación: " + texto_segmentos(m.get("summary") or [])})
            voz.append({"t": t(h), "fin": round(t(h) + 4.0, 2), "segmentos": [
                {k: s[k] for k in ("voice", "text", "token", "say_as") if s.get(k) is not None}
                for s in m.get("summary") or []]})
        elif (m.get("type") == "screen" and (m.get("observed") or {}).get("paused")) or \
                (m.get("type") == "audit" and ev.get("kind") == "paused"):
            motivo = (m.get("observed") or {}).get("paused") or ev.get("detail")
            if motivo not in pausas:
                pausas.add(motivo)
                pausa_vista = pausa_vista or motivo == "autenticacion"
                hitos.append({"t": t(h), "tipo": "pausa", "texto": {
                    "confirmacion": "8 no mira su propia confirmación: el modelo no recibe nada",
                    "autenticacion": "8 mira a otro lado mientras pones el código: el modelo no recibe nada",
                }.get(motivo, "8 mira a otro lado: el modelo no recibe nada")})
    for h, tipo, texto in r["persona"]:
        hitos.append({"t": t(h), "tipo": tipo, "texto": texto})
        if "código" in texto and not pausa_vista:  # la app 8 deja de leer en cuanto el campo rojo tiene el foco
            hitos.append({"t": t(h), "tipo": "pausa", "texto": "8 mira a otro lado mientras pones el código"})
    hitos.sort(key=lambda x: x["t"])
    voz.sort(key=lambda x: x["t"])

    d = {"formato": "priv8-movil/1", "caso": c["id"], "titulo": c["titulo"], "pedido": c["pedido"],
         "grabada": time.strftime("%Y-%m-%d"), "modelo": dotenv.get("PRIV8_MODEL"),
         "fuente": "emulador Android, núcleo real, agente en vivo",
         "video": f"movil/{c['id']}.mp4", "poster": f"movil/{c['id']}.jpg", "w": 1080, "h": 2400,
         "duracion": round(fin_crudo - inicio, 2), "desfase": {"metodo": "dos cambios de pantalla con hora conocida (filtro de escenas de ffmpeg)",
                                                                "s": round(off + r["h_grab"], 3)},
         "pantallas": pantallas, "voz": voz, "hitos": hitos}
    d["_corte"] = (inicio, fin_crudo)
    return d


def valores_reales() -> list[str]:
    """Todo dato real del seed que no puede salir en el JSON (identificadores, nombres, importes,
    usuarios, claves y códigos)."""
    sys.path.insert(0, str(ROOT / "data"))
    from check_seed import known

    vals = {v for _, v in known()}
    claves = {"titular", "login", "clave", "otp", "iban", "saldo", "numero", "cvv", "trampa_iban", "importe",
              "nombre"}

    def recorre(x: Any, k: str = "") -> None:
        if isinstance(x, dict):
            for kk, vv in x.items():
                recorre(vv, kk)
        elif isinstance(x, list):
            for vv in x:
                recorre(vv, k)
        elif isinstance(x, str) and k in claves:
            vals.add(x)
    recorre(SEED["bancos"])
    for b in SEED["bancos"].values():  # los nombres de los bancos son interfaz (verde)
        if isinstance(b, dict):
            vals.discard(b.get("nombre"))
    out = set()
    for v in vals:
        if not v or len(v) < 4:
            continue
        out.add(v)
        out.add(v.replace(" ", ""))
        if v.endswith(" €"):
            out.add(v[:-2])
    return sorted(out)


def comprobar(texto: str, pedido: str, dotenv: dict[str, str]) -> None:
    sin_pedido = texto.replace(json.dumps(pedido, ensure_ascii=False), '""')
    for v in valores_reales():
        if v in sin_pedido:
            sys.exit(f"El JSON lleva un valor real del seed ({len(v)} caracteres): no se publica")
    for k, v in dotenv.items():
        if len(v) >= 8 and not k.startswith("PRIV8_") and v in texto:
            sys.exit("El JSON lleva un valor del .env: no se publica")
    if re.search(r"sk-ant-[A-Za-z0-9_-]{10,}", texto):
        sys.exit("El JSON lleva algo con forma de clave de API: no se publica")


def poster_t(d: dict[str, Any]) -> float:
    orden = {"b2c-saldo": ["oraculo"], "b2c-broker": ["confirmacion"], "b2c-asesoria": ["bloqueo"],
             "b2c-clave": ["persona"]}.get(d["caso"], [])
    for tipo in orden:
        for h in d["hitos"]:
            if h["tipo"] == tipo:
                return min(d["duracion"] - 0.1, h["t"] + (2.5 if tipo != "persona" else -1.5))
    return d["duracion"] / 2


def publicar(c: dict[str, Any], r: dict[str, Any], dotenv: dict[str, str], cuadros: Path) -> dict[str, Any]:
    d = montar(c, r, dotenv)
    inicio, fin = d.pop("_corte")
    OUT.mkdir(parents=True, exist_ok=True)
    mp4 = OUT / f"{c['id']}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{inicio:.3f}", "-i", str(r["crudo"]),
                    "-t", f"{fin - inicio:.3f}", "-vf", "scale=540:-2", "-r", "30", "-c:v", "libx264",
                    "-crf", "28", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
                    str(mp4)], check=True)
    d["duracion"] = round(duracion_video(mp4), 2)
    pt = poster_t(d)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{pt:.2f}", "-i", str(mp4), "-frames:v", "1",
                    "-q:v", "5", str(OUT / f"{c['id']}.jpg")], check=True)
    cuadros.mkdir(parents=True, exist_ok=True)
    for n, x in enumerate([1.0, d["duracion"] * 0.3, d["duracion"] * 0.55, d["duracion"] * 0.8,
                           d["duracion"] - 0.5], 1):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{x:.2f}", "-i", str(mp4), "-frames:v", "1",
                        "-q:v", "5", str(cuadros / f"movil-{c['id']}-{n}.jpg")], check=True)
    texto = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    texto = texto.replace(" · ", " | ").replace("·", "-")  # sin punto medio en lo publicado
    comprobar(texto, c["pedido"], dotenv)
    (OUT / f"{c['id']}.json").write_text(texto + "\n", encoding="utf-8")
    log(f"{c['id']}: {d['duracion']:.1f} s, {mp4.stat().st_size / 1e6:.2f} MB, {len(d['pantallas'])} pantallas, "
        f"{len(d['voz'])} frases, {len(d['hitos'])} hitos, desfase {d['desfase']['s']} s")
    return d


def uno(c: dict[str, Any], a: argparse.Namespace, dotenv: dict[str, str]) -> float:
    gasto = 0.0
    for n in range(1, a.intentos + 1):
        log(f"{c['id']}: intento {n} de {a.intentos} - {c['pedido']}")
        tmp = Path(tempfile.mkdtemp(prefix="priv8-video-"))
        try:
            r = intento(c, dotenv, tmp)
            if r is None:
                continue
            gasto += r["gasto"]
            if a.depura:  # los mensajes del canal tal cual (llevan valores reales: solo local)
                a.depura.mkdir(parents=True, exist_ok=True)
                (a.depura / f"{c['id']}-{n}.json").write_text(json.dumps(
                    [{"h": h, "msg": m} for h, m in r["msgs"]], ensure_ascii=False), encoding="utf-8")
            fallo = falta([m for _, m in r["msgs"]], c.get("comprueba", []))
            if fallo is None and not any(m.get("type") == "voice" for _, m in r["msgs"]):
                fallo = "8 no dice nada en el móvil"
            if fallo is None and c["id"] == "b2c-broker" and not any("código" in x for _, _, x in r["persona"]):
                fallo = "la persona no llega a poner el código del SMS"
            if fallo is not None:
                log(f"{c['id']}: no es el flujo del caso ({fallo}); otra vez")
                continue
            try:
                publicar(c, r, dotenv, a.cuadros)
            except RuntimeError as e:
                log(f"{c['id']}: {e}; otra vez")
                continue
            log(f"{c['id']}: gasto {gasto:.4f} $ en {n} intento(s)")
            return gasto
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(f"{c['id']}: ningún intento ha seguido el flujo del caso (gasto {gasto:.4f} $)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--caso", action="append", help="un caso B2C de data/casos.json (se puede repetir)")
    ap.add_argument("--env-file", type=Path, default=ROOT / ".env")
    ap.add_argument("--intentos", type=int, default=3)
    ap.add_argument("--cuadros", type=Path, default=Path(tempfile.gettempdir()) / "priv8-movil-cuadros",
                    help="carpeta para unos fotogramas sueltos de cada vídeo (para revisarlo)")
    ap.add_argument("--depura", type=Path, help="guarda aquí los mensajes del canal de cada intento (con valores "
                                                 "reales del seed: nunca en el repositorio)")
    a = ap.parse_args()
    if not any(l.startswith("emulator-") and l.endswith("device") for l in adb("devices").splitlines()):
        sys.exit("No hay ningún emulador listo: scripts/movil.sh")
    if not shutil.which("ffmpeg"):
        sys.exit("Falta ffmpeg (brew install ffmpeg)")
    dotenv = gs.leer_env(a.env_file if a.env_file and a.env_file.exists() else None)
    if "ANTHROPIC_API_KEY" not in dotenv and "ANTHROPIC_API_KEY" not in os.environ:
        sys.exit("Falta ANTHROPIC_API_KEY (--env-file)")
    elegidos = [buscar(i) for i in a.caso] if a.caso else [c for c in casos("b2c") if c.get("pedido")]
    total = 0.0
    for c in elegidos:
        if c["vertical"] != "b2c":
            sys.exit(f"{c['id']} es B2B")
        total += uno(c, a, dotenv)
    log(f"gasto total del agente: {total:.4f} $")
    return 0


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(1))
    sys.exit(main())
