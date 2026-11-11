"""Graba los casos B2C en el emulador para reproducirlos en la consola (#187).

    uv run python scripts/grabar_movil.py                       # todos los casos B2C
    uv run python scripts/grabar_movil.py --caso b2c-broker     # uno
    make grabar-casos                                           # B2B y B2C de una vez

Como scripts/grabar_sesion.py, pero en el móvil:

1. Necesita el emulador listo: `scripts/movil.sh` (AVD priv8, las cuatro APK, el servicio de
   accesibilidad y `adb reverse` de 8765 y 8700). Los puertos 8700 y 8765 tienen que estar
   libres: no se graba con la demo en directo abierta.
2. Para cada caso de data/casos.json arranca el agente real en el emulador con el pedido
   (`python -m agent.agent --android --task ...`). Si el caso tiene `replay` y el archivo existe,
   con esas respuestas grabadas (sin API ni clave); si no, en vivo con el .env, y guarda las
   respuestas ahí (`--record`) para la próxima vez.
3. Se conecta al canal de eventos como la consola (`?frames=1`): el núcleo manda las
   capturas del móvil (adb screencap, del arnés, nunca del agente), que van a «Lo que ves
   tú», y la consola dibuja al lado lo que vio el modelo de cada elemento.
4. La persona hace lo suyo en el emulador, como en la demo: entra en el banco si lo pide,
   confirma por voz o en pantalla y pone el código del SMS (Banca Alcor: 482913).
   `--aprueba-sola` aprueba desde el canal a los pocos segundos, sin tocar el móvil.

Escribe apps/console/public/<feed>.json y apps/console/public/<feed>/ (JPEG), con el mismo
formato que la sesión B2B. Si un caso no pasa sus comprobaciones (el modelo no sigue el flujo),
lo repite (--intentos).
"""

from __future__ import annotations

import argparse
import asyncio
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import grabar_sesion as gs  # noqa: E402
from casos_comun import caso as buscar, falta, grabables  # noqa: E402

ROOT = HERE.parent
ANDROID_HOME = Path(os.environ.get("ANDROID_HOME", Path.home() / "Library/Android/sdk"))
ADB = shutil.which("adb") or str(ANDROID_HOME / "platform-tools" / "adb")
EVENTOS, PUENTE = 8700, 8765


def log(m: str) -> None:
    print(f"[grabar-movil] {m}", file=sys.stderr, flush=True)


def adb(*args: str) -> str:
    return subprocess.run([ADB, *args], capture_output=True, text=True, timeout=15).stdout


def emulador_listo() -> bool:
    try:
        return any(l.startswith("emulator-") and l.endswith("device") for l in adb("devices").splitlines())
    except (OSError, subprocess.TimeoutExpired):
        return False


async def grabar(rec: gs.Grabacion, agente: subprocess.Popen, pedido: str, aprueba_sola: bool) -> None:
    import json

    import websockets

    url = f"ws://127.0.0.1:{EVENTOS}/events?frames=1"
    for _ in range(600):  # el agente espera al móvil y a que la persona entre en el banco
        if agente.poll() is not None:
            sys.exit("El agente ha terminado antes de abrir el canal de eventos (mira su salida arriba)")
        try:
            ws = await websockets.connect(url, max_size=None)
            break
        except OSError:
            await asyncio.sleep(0.5)
    else:
        sys.exit(f"El canal de eventos no responde en :{EVENTOS}")
    log("conectado al canal; empieza la grabación")
    # Con --task el agente empieza solo: el pedido entra en la grabación como lo dijo la persona.
    rec.guardar({"type": "task_request", "session": "b2c", "text": pedido})

    async def aprobar(cid: str) -> None:
        await asyncio.sleep(gs.APRUEBA_S)
        if cid in rec.aprobadas:
            return
        rec.aprobadas.add(cid)
        msg = {"type": "approval_result", "id": cid, "ok": True, "via": "pantalla", "by": "persona"}
        await ws.send(json.dumps(msg))
        rec.guardar(msg)

    async def recibir() -> None:
        async for raw in ws:
            try:
                m = json.loads(raw)
            except ValueError:
                continue
            if isinstance(m, dict):
                rec.guardar(m)
                if aprueba_sola and m.get("type") == "confirm_request" and isinstance(m.get("id"), str):
                    asyncio.create_task(aprobar(m["id"]))

    lector = asyncio.create_task(recibir())
    limite = time.monotonic() + 600
    while agente.poll() is None:
        if time.monotonic() > limite:
            sys.exit("El caso no termina en 10 minutos")
        await asyncio.sleep(0.25)
    await asyncio.sleep(1.0)
    lector.cancel()
    await ws.close()


def uno(c: dict, a: argparse.Namespace, dotenv: dict[str, str]) -> None:
    ruta = ROOT / c["replay"] if c.get("replay") else None
    replay = ruta if ruta and ruta.exists() and not a.en_vivo else None
    if replay is None and "ANTHROPIC_API_KEY" not in dotenv and "ANTHROPIC_API_KEY" not in os.environ:
        sys.exit(f"{c['id']}: sin respuestas grabadas y sin ANTHROPIC_API_KEY (--env-file)")
    for intento in range(1, a.intentos + 1):
        for p in (EVENTOS, PUENTE):
            for _ in range(40):
                if gs.libre(p):
                    break
                time.sleep(0.5)
            else:
                sys.exit(f"El puerto {p} está ocupado: para la demo en directo antes de grabar")
        if c.get("en_login"):
            adb("shell", "am", "force-stop", "es.priv8.banks.alcor")  # que abra en la pantalla de entrada
        tmp = Path(tempfile.mkdtemp(prefix="priv8-movil-"))
        (tmp / "vista").mkdir()
        rec = gs.Grabacion(tmp, movil=True)
        cmd = ["uv", "run", "python", "-m", "agent.agent", "--android", "--task", c["pedido"]]
        if replay is not None:
            cmd += ["--replay", str(replay), "--no-simulated-persona"]
        elif ruta is not None:
            ruta.parent.mkdir(parents=True, exist_ok=True)
            cmd += ["--record", str(ruta)]
        if c.get("en_login"):
            cmd.append("--en-login")
        env = {**os.environ, **({} if replay else dotenv), "PRIV8_CORE": "real", "PRIV8_AUDIT": "off",
               "PRIV8_FRAMES": "1", "PYTHONUNBUFFERED": "1"}
        log(f"{c['id']}: intento {intento} de {a.intentos} ({'respuestas grabadas' if replay else 'en vivo'})")
        log(f"  pedido: {c['pedido']}")
        log("  en el emulador: entra en el banco si lo pide, confirma lo que 8 te pida y pon el código del SMS")
        agente = subprocess.Popen(cmd, cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                                  text=True, start_new_session=True)
        try:
            threading.Thread(target=gs.seguir_agente, args=(agente, rec, []), daemon=True).start()
            asyncio.run(grabar(rec, agente, c["pedido"], a.aprueba_sola))
        finally:
            gs.parar(agente)
        fallo = falta([m for _, m in rec.msgs], c.get("comprueba", []))
        if fallo is None:
            gs.NOMBRE = c["feed"]
            info = {"grabada": time.strftime("%Y-%m-%d"), "modelo": None if replay else dotenv.get("PRIV8_MODEL"),
                    "encargos": [c["pedido"]], "caso": c["id"], "vertical": "b2c", "titulo": c["titulo"],
                    "provisional": False,
                    "fuente": "emulador Android, agente " + ("con respuestas grabadas" if replay else "en vivo")}
            sesion = gs.montar(rec, a.fps, info)
            from casos_comun import pares_incoherentes
            fallo_pares = pares_incoherentes(sesion)
            if fallo_pares is not None:  # Android no tiene pares; nunca una vista de 8 suelta
                sys.exit(f"{c['id']}: los fotogramas no casan ({fallo_pares}); no se escribe nada")
            texto = __import__("json").dumps(sesion, ensure_ascii=False, separators=(",", ":"))
            texto = texto.replace(" · ", " | ").replace("·", "-")
            (gs.PUBLIC / f"{c['feed']}.json").write_text(texto + "\n", encoding="utf-8")
            gs.sin_secretos(dotenv)
            shutil.rmtree(tmp, ignore_errors=True)
            log(f"{c['id']}: {sesion['duracion']:.0f} s, {len(sesion['real'])} capturas del móvil")
            return
        shutil.rmtree(tmp, ignore_errors=True)
        log(f"{c['id']}: no es el flujo del caso ({fallo}); otra vez")
    sys.exit(f"{c['id']}: ningún intento ha seguido el flujo del caso; no se escribe nada")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--caso", action="append", help="un caso B2C de data/casos.json (se puede repetir)")
    ap.add_argument("--env-file", type=Path, default=ROOT / ".env")
    ap.add_argument("--fps", type=float, default=4.0)
    ap.add_argument("--intentos", type=int, default=3)
    ap.add_argument("--en-vivo", action="store_true",
                    help="con la API aunque haya respuestas grabadas, y las sobrescribe (si las grabadas no "
                         "siguen el flujo en el emulador)")
    ap.add_argument("--aprueba-sola", action="store_true",
                    help="aprueba cada confirmación desde el canal a los pocos segundos")
    a = ap.parse_args()
    if not emulador_listo():
        sys.exit("No hay ningún emulador listo: scripts/movil.sh (o make agent-android-replay una vez)")
    if not shutil.which("ffmpeg"):
        sys.exit("Falta ffmpeg (brew install ffmpeg)")
    dotenv = gs.leer_env(a.env_file if a.env_file and a.env_file.exists() else None)
    elegidos = [buscar(i) for i in a.caso] if a.caso else grabables("b2c")
    for c in elegidos:
        if c["vertical"] != "b2c":
            sys.exit(f"{c['id']} es B2B: scripts/grabar_sesion.py --caso {c['id']}")
        uno(c, a, dotenv)
    return 0


if __name__ == "__main__":
    sys.exit(main())
