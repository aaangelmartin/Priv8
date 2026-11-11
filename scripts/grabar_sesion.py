"""Graba una sesión B2B real para reproducirla en la consola (#170).

    uv run python scripts/grabar_sesion.py --env-file .env      # make grabar-sesion

La web de la demo (demo.priv8.es) no tiene agente, núcleo ni API. Este script ejecuta una
vez el stack real y guarda todo lo que recibe la consola, para que `?feed=sesion-b2b` lo
reproduzca tal cual:

1. Arranca Alba Core y el correo en puertos libres (por defecto 5193 y 5194, con la sesión de
   la demo abierta) y el agente real (`python -m agent.agent --web`, Chromium con ventana) con
   el núcleo de eventos en PRIV8_EVENTS_PORT (8792). Nunca toca 5173-5175, 8700, 5301 ni 5303:
   ahí puede estar la demo en directo.
2. Se conecta al canal como la consola (`?frames=1`) y pide, como lo haría una persona en el
   chat, «Registra la factura de Suministros Lumen». Cuando 8 pide confirmación, la aprueba a
   los pocos segundos (approval_result, via pantalla). Al terminar, pide «Contesta al proveedor
   que la factura está registrada» y espera a que acabe.
3. Guarda cada mensaje con su segundo (`at`): screen, audit, voice, confirm_request,
   approval_result, el eco de task_request y los fotogramas de la vista de 8; y aparte los de
   la ventana real de Chromium (con los valores ficticios del seed, el cursor de 8 y sus
   bocadillos), que llegan por el mismo canal como fotogramas con vista "real".

Sale en apps/console/public/sesion-b2b.json y apps/console/public/sesion-b2b/ (JPEG). Los
fotogramas repetidos se quitan y se limita el ritmo (--fps). Nada del .env entra en la
grabación: al final se comprueba que ningún valor suyo aparece en lo escrito.

Gasta API: dos encargos con PRIV8_MODEL (Haiku en la demo), con los límites de gasto del agente.

Un caso del catálogo (#187, data/casos.json): `--caso b2b-iban` graba solo su pedido en
apps/console/public/<feed>.json y comprueba lo que pide el caso. Si el caso tiene `replay`
y el archivo existe, usa esas respuestas grabadas (sin API); si no, va en vivo y las guarda
ahí para la próxima vez. `make grabar-casos` graba todos (scripts/grabar_casos.py).
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "apps" / "console" / "public"
NOMBRE = "sesion-b2b"
PROTEGIDOS = {5173, 5174, 5175, 8700, 8701, 5301, 5302, 5303}
ENCARGOS = ["Registra la factura de Suministros Lumen",
            "Contesta al proveedor que la factura está registrada"]
SESION = "b2b"
CASO: dict[str, Any] | None = None  # --caso: un caso del catálogo (data/casos.json, #187)
APRUEBA_S = 4.0          # lo que tarda «la persona» en leer la confirmación y aprobarla
HUECO_MAX_S = 6.0        # un silencio más largo se acorta a esto en la reproducción
ANCHO = 1100             # ancho de los JPEG publicados
CALIDAD = 7              # ffmpeg -q:v (2 mejor, 31 peor); 7 es una calidad JPEG de unos 70


def log(m: str) -> None:
    print(f"[grabar] {m}", file=sys.stderr, flush=True)


def libre(port: int) -> bool:
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def leer_env(path: Path | None) -> dict[str, str]:
    """Variables de un .env (KEY=valor, sin comillas obligatorias). Nunca se imprimen."""
    if path is None:
        return {}
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        if v:
            out[k.strip()] = v
    return out


def servir_app(app: str, port: int, extra: dict[str, str]) -> subprocess.Popen:
    cwd = ROOT / "apps" / app
    if not (cwd / "node_modules").exists():
        sys.exit(f"Faltan las dependencias de apps/{app}: make web-install")
    proc = subprocess.Popen(["pnpm", "exec", "vite", "--port", str(port), "--strictPort", "--host", "127.0.0.1"],
                            cwd=cwd, env={**os.environ, **extra}, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(150):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1)
            return proc
        except OSError:
            if proc.poll() is not None:
                sys.exit(f"apps/{app} no arranca en :{port}")
            time.sleep(0.2)
    sys.exit(f"apps/{app} no responde en :{port}")


def parar(proc: subprocess.Popen | None) -> None:
    if proc is None or proc.poll() is not None:
        return
    try:
        os.killpg(proc.pid, signal.SIGINT)
        proc.wait(timeout=15)
    except Exception:  # noqa: BLE001
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except Exception:  # noqa: BLE001
            pass


# ------------------------------------------------------------------ grabación en vivo

class Grabacion:
    def __init__(self, tmp: Path, movil: bool = False) -> None:
        self.tmp = tmp
        self.movil = movil  # Android: todos los fotogramas son la pantalla real del móvil
        self.msgs: list[tuple[float, dict[str, Any]]] = []   # (hora, mensaje) sin fotogramas
        self.vista: list[tuple[float, Path, dict[str, Any]]] = []  # fotogramas de la vista de 8
        self.reales: list[tuple[float, Path, dict[str, Any]]] = []  # los de la ventana real
        self.terminados = 0
        self.aprobadas: set[str] = set()

    def guardar(self, m: dict[str, Any]) -> None:
        t = time.time()
        if m.get("type") == "frame":
            img = m.get("img")
            if not isinstance(img, str):
                return
            real = m.get("vista") == "real" or self.movil
            f = self.tmp / "vista" / f"{'r' if real else 'v'}{int(t * 1000)}.jpg"
            f.write_bytes(base64.b64decode(img))
            if real:
                self.reales.append((t, f, {"app": m.get("app"), "w": m.get("w"), "h": m.get("h")}))
            else:
                self.vista.append((t, f, {k: v for k, v in m.items() if k != "img"}))
            return
        self.msgs.append((t, m))


async def grabar(port: int, rec: Grabacion, agente: subprocess.Popen, fin_s: float, *,
                 con_replay: bool = False) -> None:
    import websockets

    url = f"ws://127.0.0.1:{port}/events?frames=1"
    for _ in range(240):  # Chromium, el núcleo y el canal tardan unos segundos
        if agente.poll() is not None:
            sys.exit("El agente ha terminado antes de abrir el canal de eventos (mira su salida arriba)")
        try:
            ws = await websockets.connect(url, max_size=None)
            break
        except OSError:
            await asyncio.sleep(0.5)
    else:
        sys.exit(f"El canal de eventos no responde en :{port}")
    log("conectado al canal; empieza la grabación")

    async def enviar(msg: dict[str, Any]) -> None:
        await ws.send(json.dumps(msg, ensure_ascii=False))
        rec.guardar(msg)  # la consola también se queda con lo que manda: el encargo y la aprobación

    async def aprobar(cid: str) -> None:
        await asyncio.sleep(APRUEBA_S)
        if cid in rec.aprobadas:
            return
        rec.aprobadas.add(cid)
        log(f"apruebo {cid}")
        await enviar({"type": "approval_result", "id": cid, "ok": True, "via": "pantalla", "by": "persona"})

    async def recibir() -> None:
        async for raw in ws:
            try:
                m = json.loads(raw)
            except ValueError:
                continue
            if not isinstance(m, dict):
                continue
            rec.guardar(m)
            if m.get("type") == "confirm_request" and isinstance(m.get("id"), str):
                asyncio.create_task(aprobar(m["id"]))

    lector = asyncio.create_task(recibir())
    if con_replay:
        # Con respuestas grabadas el agente empieza solo (--replay --task): el pedido entra en la
        # grabación como lo habría escrito la persona, y se espera a que el agente acabe.
        rec.guardar({"type": "task_request", "session": SESION, "text": ENCARGOS[0]})
        limite = time.monotonic() + 420
        while agente.poll() is None and time.monotonic() < limite:
            await asyncio.sleep(0.25)
        await asyncio.sleep(fin_s)
        lector.cancel()
        await ws.close()
        return
    await asyncio.sleep(2.5)  # la primera pantalla y unos fotogramas antes del primer encargo
    for i, texto in enumerate(ENCARGOS):
        antes = rec.terminados
        log(f"encargo {i + 1}: {texto}")
        await enviar({"type": "task_request", "session": SESION, "text": texto})
        limite = time.monotonic() + 420
        while rec.terminados == antes:
            if agente.poll() is not None:
                sys.exit("El agente ha terminado a mitad de la grabación")
            if time.monotonic() > limite:
                sys.exit("El encargo no termina en 7 minutos")
            await asyncio.sleep(0.25)
        await asyncio.sleep(3.0 if i + 1 < len(ENCARGOS) else fin_s)
    lector.cancel()
    await ws.close()


def seguir_agente(agente: subprocess.Popen, rec: Grabacion, gasto: list[str]) -> None:
    """Lee la salida del agente: cada «esperando el siguiente encargo» es un encargo terminado."""
    assert agente.stderr is not None
    for line in agente.stderr:
        line = line.rstrip()
        if not line:
            continue
        print(f"  agente | {line[:220]}", file=sys.stderr, flush=True)
        m = re.search(r"gasto=([\d.]+)", line)
        if m:
            gasto.append(m.group(1))
        if "esperando el siguiente encargo" in line:
            rec.terminados += 1


def revisar(rec: Grabacion) -> str | None:
    """¿Es el flujo ensayado? Con un caso del catálogo, lo que pide el caso (casos_comun.falta)."""
    if CASO is not None:
        from casos_comun import falta
        return falta([m for _, m in rec.msgs], CASO.get("comprueba", []))
    return revisar_b2b(rec)


def revisar_b2b(rec: Grabacion) -> str | None:
    """¿Es el flujo ensayado? Cada encargo deja una acción retenida (registrar, enviar) que se
    aprueba y se ejecuta, y 8 no acaba diciendo que no lo ha hecho. None si lo es; si no, por qué."""
    tramos: list[list[dict[str, Any]]] = []
    for _, m in rec.msgs:
        if m.get("type") == "task_request":
            tramos.append([])
        elif tramos:
            tramos[-1].append(m)
    if len(tramos) != len(ENCARGOS):
        return f"{len(tramos)} encargos grabados de {len(ENCARGOS)}"
    for n, msgs in enumerate(tramos, 1):
        if not any(m.get("type") == "confirm_request" for m in msgs):
            return f"el encargo {n} no pide confirmación"
        aprobadas = [m["event"] for m in msgs if m.get("type") == "audit" and m["event"].get("kind") == "approval"
                     and m["event"].get("approved_by")]
        if not aprobadas:
            return f"el encargo {n} no tiene la aprobación en el registro"
        finales = [m["event"].get("model_saw") or "" for m in msgs if m.get("type") == "audit"
                   and m["event"].get("kind") == "task" and "end_turn" in (m["event"].get("detail") or "")]
        if any(re.match(r"\s*no (he|puedo|se ha)", f, re.I) or "no coincide" in f for f in finales):
            return f"en el encargo {n}, 8 dice que no lo ha hecho o que algo no cuadra"
        auditoria = [m["event"] for m in msgs if m.get("type") == "audit"]
        if any(e.get("kind") == "blocked" and e.get("reason") == "presupuesto" for e in auditoria):
            return f"en el encargo {n}, el oráculo se queda sin preguntas"
        for e in auditoria:
            if e.get("kind") != "oracle":
                continue
            toks = re.findall(r"‹[^›]+›", e.get("model_saw") or "")
            if len(toks) >= 2 and len(set(toks)) == 1:
                return f"en el encargo {n}, 8 compara un dato consigo mismo"
            if re.search(r"no coincide|menor|mayor", e.get("detail") or ""):
                return f"en el encargo {n}, el importe no cuadra en el oráculo"
    return None


# ------------------------------------------------------------------ montaje

def jpeg(src: Path, dst: Path) -> None:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", f"scale='min({ANCHO},iw)':-2",
                    "-q:v", str(CALIDAD), str(dst)], check=True)


def elegir(frames: list[tuple[float, Path, Any]], fps: float) -> list[tuple[float, Path, Any]]:
    """Sin repetidos y como mucho `fps` por segundo; el último de cada ráfaga se queda (es lo que se ve)."""
    out: list[tuple[float, Path, Any]] = []
    ultimo = None
    for t, f, meta in frames:
        h = hashlib.sha1(f.read_bytes()).hexdigest()
        if h == ultimo:
            continue
        ultimo = h
        if out and t - out[-1][0] < 1 / fps:
            out[-1] = (out[-1][0], f, meta)  # gana el más nuevo, a la hora del hueco
            continue
        out.append((t, f, meta))
    return out


def reloj(horas: list[float], t0: float) -> Any:
    """Hora real -> segundo de la reproducción, con los silencios largos acortados a HUECO_MAX_S."""
    puntos = sorted(set(h for h in horas if h >= t0))
    mapa: list[tuple[float, float]] = []
    prev_h, prev_a = t0, 0.0
    for h in puntos:
        a = prev_a + min(h - prev_h, HUECO_MAX_S)
        mapa.append((h, a))
        prev_h, prev_a = h, a
    import bisect
    hs = [h for h, _ in mapa]

    def at(h: float) -> float:
        if h <= t0 or not mapa:
            return 0.0
        i = bisect.bisect_right(hs, h) - 1
        if i < 0:
            return min(h - t0, HUECO_MAX_S)
        bh, ba = mapa[i]
        return round(ba + min(h - bh, HUECO_MAX_S), 3)
    return at


def montar(rec: Grabacion, fps: float, info: dict[str, Any]) -> dict[str, Any]:
    out_dir = PUBLIC / NOMBRE
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    vista = elegir(rec.vista, fps)
    reales = elegir(rec.reales, fps)

    primero = next((t for t, m in rec.msgs if m.get("type") == "task_request"), rec.msgs[0][0] if rec.msgs else 0)
    t0 = primero - 2.0
    horas = [t for t, _ in rec.msgs] + [t for t, _, _ in vista] + [t for t, _, _ in reales]
    at = reloj(horas, t0)

    def desde_t0(frames: list) -> list:  # de antes de empezar, solo el último fotograma
        antes = [x for x in frames if x[0] < t0]
        return antes[-1:] + [x for x in frames if x[0] >= t0]
    vista, reales = desde_t0(vista), desde_t0(reales)

    eventos: list[dict[str, Any]] = []
    # Lo que ya estaba antes de empezar (la pantalla inicial, un fotograma) entra en el segundo 0.
    for t, m in rec.msgs:
        eventos.append({"at": at(t), "msg": m})
    for n, (t, f, meta) in enumerate(vista, 1):
        name = f"v{n:04d}.jpg"
        jpeg(f, out_dir / name)
        eventos.append({"at": at(t), "msg": {**meta, "src": f"{NOMBRE}/{name}"}})
    pantalla_real = []
    for n, (t, f, meta) in enumerate(reales, 1):
        name = f"r{n:04d}.jpg"
        jpeg(f, out_dir / name)
        pantalla_real.append({"at": at(t), "src": f"{NOMBRE}/{name}", **meta})
    eventos.sort(key=lambda e: e["at"])
    duracion = max([e["at"] for e in eventos] + [r["at"] for r in pantalla_real] + [0]) + 3.0
    return {"formato": "priv8-sesion/1", "nombre": NOMBRE, **info, "duracion": round(duracion, 2),
            "eventos": eventos, "real": pantalla_real}


def sin_secretos(env: dict[str, str]) -> None:
    """Ningún valor del .env (claves, ids de voz) en lo que se publica."""
    textos = [(PUBLIC / f"{NOMBRE}.json").read_bytes()]
    valores = [v for k, v in env.items() if len(v) >= 8 and not k.startswith("PRIV8_")]
    patrones = [re.compile(rb"sk-ant-[A-Za-z0-9_-]{10,}")]
    for t in textos:
        for v in valores:
            if v.encode() in t:
                sys.exit("La grabación contiene un valor del .env: no se publica (borra apps/console/public/sesion-b2b*)")
        for p in patrones:
            if p.search(t):
                sys.exit("La grabación contiene algo con forma de clave de API: no se publica")
    log("sin secretos del .env en la grabación")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--env-file", type=Path, default=ROOT / ".env",
                    help="variables del agente (ANTHROPIC_API_KEY, PRIV8_MODEL); por defecto .env")
    ap.add_argument("--alba-port", type=int, default=5193)
    ap.add_argument("--inbox-port", type=int, default=5194)
    ap.add_argument("--events-port", type=int, default=8792)
    ap.add_argument("--fps", type=float, default=5.0, help="fotogramas por segundo como mucho, en cada pantalla")
    ap.add_argument("--intentos", type=int, default=6,
                    help="el modelo no siempre sigue el flujo ensayado: se repite hasta que lo sigue")
    ap.add_argument("--caso", help="un caso B2B de data/casos.json (por ejemplo b2b-iban)")
    a = ap.parse_args()

    global CASO, NOMBRE, ENCARGOS
    replay: Path | None = None
    record: Path | None = None
    if a.caso:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from casos_comun import caso as buscar
        CASO = buscar(a.caso)
        if CASO["vertical"] != "b2b":
            sys.exit(f"{a.caso} es B2C: scripts/grabar_movil.py")
        NOMBRE, ENCARGOS = CASO["feed"], [CASO["pedido"]]
        if CASO.get("replay"):
            ruta = ROOT / CASO["replay"]
            replay, record = (ruta, None) if ruta.exists() else (None, ruta)

    puertos = [a.alba_port, a.inbox_port, a.events_port]
    if PROTEGIDOS & set(puertos):
        sys.exit(f"Puertos reservados para la demo en directo: {sorted(PROTEGIDOS & set(puertos))}")
    ocupados = [p for p in puertos if not libre(p)]
    if ocupados:
        sys.exit(f"Puertos ocupados: {ocupados}")
    if not shutil.which("ffmpeg"):
        sys.exit("Falta ffmpeg (brew install ffmpeg)")
    env_file = a.env_file if a.env_file and a.env_file.exists() else None
    dotenv = leer_env(env_file)
    if replay is None and "ANTHROPIC_API_KEY" not in dotenv and "ANTHROPIC_API_KEY" not in os.environ:
        sys.exit("Falta ANTHROPIC_API_KEY (--env-file)")
    if replay is not None:
        log(f"respuestas grabadas de {replay.relative_to(ROOT)}: sin API")
        dotenv = {}

    import threading

    apps: list[subprocess.Popen] = []
    gastos: list[float] = []
    rec: Grabacion | None = None
    tmp: Path | None = None
    try:
        apps.append(servir_app("erp-sim", a.alba_port, {"VITE_ALBA_SESION": "admin.alba"}))
        apps.append(servir_app("inbox-sim", a.inbox_port, {}))
        log(f"Alba Core en :{a.alba_port}, correo en :{a.inbox_port}")
        for intento in range(1, a.intentos + 1):
            if tmp is not None:
                shutil.rmtree(tmp, ignore_errors=True)
            tmp = Path(tempfile.mkdtemp(prefix="priv8-sesion-"))
            (tmp / "vista").mkdir()
            rec = Grabacion(tmp)
            gasto: list[str] = []
            env = {**os.environ, **dotenv,
                   "PRIV8_CORE": "real", "PRIV8_AUDIT": "off", "PRIV8_WEB_PROFILE": "off",
                   "PRIV8_EVENTS_PORT": str(a.events_port),
                   "PRIV8_ALBA_URL": f"http://127.0.0.1:{a.alba_port}",
                   "PRIV8_INBOX_URL": f"http://127.0.0.1:{a.inbox_port}",
                   "PRIV8_REAL_FRAMES": "1", "PYTHONUNBUFFERED": "1"}
            log(f"intento {intento} de {a.intentos}")
            cmd = ["uv", "run", "python", "-m", "agent.agent", "--web"]
            if replay is not None:
                cmd += ["--replay", str(replay), "--task", ENCARGOS[0]]
            elif record is not None:
                record.parent.mkdir(parents=True, exist_ok=True)
                cmd += ["--record", str(record)]
            agente = subprocess.Popen(cmd, cwd=ROOT, env=env,
                                      stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
                                      start_new_session=True)
            try:
                threading.Thread(target=seguir_agente, args=(agente, rec, gasto), daemon=True).start()
                asyncio.run(grabar(a.events_port, rec, agente, fin_s=4.0, con_replay=replay is not None))
            finally:
                parar(agente)
            if gasto:
                gastos.append(float(gasto[-1]))
            fallo = revisar(rec)
            if fallo is None:
                break
            log(f"el flujo no es el ensayado: {fallo}")
            for _ in range(60):  # el canal del agente anterior se cierra
                if libre(a.events_port):
                    break
                time.sleep(0.5)
        else:
            sys.exit(f"Ningún intento ha seguido el flujo ensayado: no se escribe nada (gasto {sum(gastos):.4f} $)")
    finally:
        for p in apps:
            parar(p)
    assert rec is not None and tmp is not None

    info = {"grabada": time.strftime("%Y-%m-%d"), "modelo": dotenv.get("PRIV8_MODEL") or os.environ.get("PRIV8_MODEL"),
            "encargos": ENCARGOS}
    if CASO is not None:
        info.update(caso=CASO["id"], vertical="b2b", titulo=CASO["titulo"], provisional=False,
                    fuente="Alba Core y el correo reales, agente " + ("con respuestas grabadas" if replay else "en vivo"))
    sesion = montar(rec, a.fps, info)
    texto = json.dumps(sesion, ensure_ascii=False, separators=(",", ":"))
    # Sin punto medio en lo publicado (norma de la marca): el separador de los textos del núcleo
    # se ve « | » en la consola, y en los tokens antiguos va el guion.
    texto = texto.replace(" · ", " | ").replace("·", "-")
    (PUBLIC / f"{NOMBRE}.json").write_text(texto + "\n", encoding="utf-8")
    shutil.rmtree(tmp, ignore_errors=True)
    sin_secretos(dotenv)
    total = sum(f.stat().st_size for f in (PUBLIC / NOMBRE).iterdir()) + (PUBLIC / f"{NOMBRE}.json").stat().st_size
    nv = sum(1 for e in sesion["eventos"] if e["msg"].get("type") == "frame")
    log(f"{sesion['duracion']:.0f} s, {len(sesion['eventos']) - nv} mensajes, {nv} fotogramas de la vista de 8, "
        f"{len(sesion['real'])} de la ventana real, {total / 1e6:.1f} MB, gasto del agente {sum(gastos):.4f} $")
    return 0


if __name__ == "__main__":
    sys.exit(main())
