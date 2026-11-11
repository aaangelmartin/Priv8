"""Grabaciones provisionales de los casos de la demo (#187), sin emulador, sin API y sin navegador.

    uv run python scripts/casos_provisionales.py            # make casos-provisionales
    uv run python scripts/casos_provisionales.py b2c-broker # uno

Mientras no haya una grabación real de un caso (make grabar-casos), la web de la demo
reproduce esta. Mismo formato que scripts/grabar_sesion.py (`priv8-sesion/1`), con
`provisional: true` y `fuente`:

- B2C: el núcleo real, el puente Android real (adapters/android/bridge.py, en un puerto libre)
  y el móvil falso (adapters/android/fake_phone.py), que da las pantallas de Banca Alcor,
  Brezo Banco y Nimbo Bróker con los ids del AVD. El bucle del agente es el de verdad con
  las respuestas grabadas de agent/replays/casos/. El móvil falso confirma por voz y tarda
  en poner el código del banco, así que se ve a 8 mirando a otro lado. Sin fotogramas: la
  consola dibuja el móvil con lo que ves tú y con lo que ve el modelo.
- B2B con escena: la escena de la factura de core/scenes.py y las respuestas de
  core/replays/casos/. Sin fotogramas: la consola dibuja las dos ventanas.
- B2B recortado de una sesión real (`desde`): el tramo n de esa grabación (cada
  task_request empieza un tramo), con sus fotogramas reales. No es provisional.

Cada caso se ejecuta en su propio proceso (tokens y bóveda desde cero). El ritmo de la
reproducción sale del tipo de cada mensaje, no del reloj: en memoria todo pasa en
milisegundos. Escribe apps/console/public/<feed>.json. Al final comprueba que ninguna
petición al modelo llevaba un valor real.
"""

from __future__ import annotations

import copy
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
PUBLIC = ROOT / "apps" / "console" / "public"
CASOS = ROOT / "data" / "casos.json"

# Lo que espera la reproducción antes de cada mensaje, según su tipo (s).
PAUSA = {"screen": 1.2, "observe_sent": 0.35, "act": 0.9, "oracle": 1.2, "blocked": 1.4, "held": 0.4,
         "confirm_request": 0.8, "approval_result": 4.0, "approval": 0.3, "task": 0.9, "voice": 1.2,
         "task_request": 0.0, "paused": 0.6, "render_values": 0.0}
PAUSA_CODIGO = 4.5  # lo que tarda la persona en poner el código del banco mientras 8 mira a otro lado


def log(m: str) -> None:
    print(f"[casos] {m}", file=sys.stderr, flush=True)


def casos() -> list[dict[str, Any]]:
    return json.loads(CASOS.read_text(encoding="utf-8"))["casos"]


def libre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _paso(m: dict[str, Any]) -> str:
    return m["event"]["kind"] if m.get("type") == "audit" else m.get("type", "")


def cronometrar(msgs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    t, out, en_pausa = 1.0, [], False
    for m in msgs:
        k = _paso(m)
        t += PAUSA.get(k, 0.6)
        if k == "screen":
            pausa = bool((m.get("observed") or {}).get("paused"))
            if en_pausa and not pausa:
                t += PAUSA_CODIGO
            en_pausa = pausa
        if k == "voice":  # que dé tiempo a oír la frase
            texto = " ".join(s.get("text") or s.get("token") or "" for s in m["utterance"].get("segments", []))
            out.append({"at": round(t, 2), "msg": m})
            t += min(6.0, 1.0 + len(texto) / 18)
            continue
        out.append({"at": round(t, 2), "msg": m})
    return out


# ------------------------------------------------------------------ un caso, en su proceso

def _correr(caso: dict[str, Any], session: str, model: Any, montar: Any) -> list[dict[str, Any]]:
    import anyio
    from mcp import Client

    import core
    from agent.agent import expand_task, run_agent
    from agent.core_adapter import build_real_core, tokenize_task
    from agent.server import build_server
    from core import events

    msgs: list[dict[str, Any]] = []
    stop = events.subscribe(lambda m: msgs.append(copy.deepcopy(m)))
    limpieza = montar()
    try:
        pedido = caso["pedido"]
        msgs.append({"type": "task_request", "session": session, "text": pedido})  # lo que escribe la persona
        core.submit_task(session, pedido, via="app")
        texto = core.next_task(session, 1)
        task = tokenize_task(session, expand_task(texto))
        agent_core = build_real_core()

        async def run() -> Any:
            async with Client(build_server(agent_core)) as client:
                return await run_agent(client, model, agent_core, task, session=session,
                                       log=lambda *_: None)
        result = anyio.run(run)
        for _ in range(50):  # lo retenido que aún espera a la persona simulada
            if not core.pending(session):
                break
            time.sleep(0.1)
        if result.status == "done" and result.final_text:
            core.say(session, result.final_text)
            time.sleep(0.4)
        # Los valores locales de lo que dice 8 (la suma del oráculo no está en ninguna pantalla), como
        # los recibe el móvil para la voz local: la consola los enseña en los subtítulos.
        vault = core.SESSIONS.get(session).vault
        toks = {sg["token"] for m in msgs if m.get("type") == "voice"
                for sg in m["utterance"].get("segments", []) if sg.get("token")}
        vals = {t: vault.value(t) for t in sorted(toks) if vault.value(t)}
        if vals:
            i = next(i for i, m in enumerate(msgs) if m.get("type") == "voice")
            msgs.insert(i, {"type": "render_values", "session": session, "values": vals})
        log(f"{caso['id']}: {result.status} en {result.steps} pasos")
        leaks = [r for r in model.requests if not core.check(json.dumps(r, ensure_ascii=False))["allowed"]]
        if leaks:
            sys.exit(f"{caso['id']}: {len(leaks)} peticiones al modelo con valores reales")
        if result.status not in ("done", "asesoria"):
            sys.exit(f"{caso['id']}: el encargo no termina ({result.status})")
    finally:
        stop()
        limpieza()
    return msgs


def uno_b2c(caso: dict[str, Any]) -> list[dict[str, Any]]:
    import core
    from adapters.android.bridge import AndroidBridge
    from adapters.android.fake_phone import FakePhone
    from agent.agent import ReplayModel
    from agent.core_adapter import mount_android

    p = caso["provisional"]
    session = "b2c"

    def montar() -> Any:
        port = libre()
        bridge = AndroidBridge(session, port=port, core=core, log=lambda *_: None).start()
        phone = FakePhone(f"ws://127.0.0.1:{port}", answer="ok", answer_delay=0.2,
                          page=p.get("movil", "inicio"), otp_pause=1).start()

        def espera_persona() -> None:  # la persona confirma por voz antes de la siguiente lectura
            for _ in range(60):
                if not core.pending(session):
                    return
                time.sleep(0.05)
        mount_android(session, start_app=None, events=False, bridge=bridge, device_timeout=10)
        bridge.before_snapshot = espera_persona

        def limpieza() -> None:
            phone.stop()
            bridge.stop()
        return limpieza

    return _correr(caso, session, ReplayModel(ROOT / p["replay"]), montar)


def uno_escena(caso: dict[str, Any]) -> list[dict[str, Any]]:
    import core
    from agent.agent import ReplayModel
    from core.scenes import SCENES

    p = caso["provisional"]
    session = p["escena"]

    def montar() -> Any:
        scene = SCENES[p["escena"]]()

        def aprueba() -> None:
            for req in core.pending(session):
                core.approve({"type": "approval_result", "id": req["id"], "ok": True, "via": "pantalla", "by": "persona"})
        scene.before_snapshot = aprueba
        core.connect(session, scene)
        return lambda: None

    return _correr(caso, session, ReplayModel(ROOT / p["replay"]), montar)


def recorte(caso: dict[str, Any]) -> dict[str, Any] | None:
    """El tramo n de una sesión real grabada: desde su task_request hasta el siguiente. Lo que ya
    se veía antes (el último fotograma de cada vista y las pantallas leídas, que dan los valores
    locales de los tokens) entra en el segundo 0."""
    p = caso["provisional"]
    src = PUBLIC / f"{p['desde']}.json"
    if not src.exists():
        log(f"{caso['id']}: falta {src.name}; no se recorta")
        return None
    d = json.loads(src.read_text(encoding="utf-8"))
    ev = d["eventos"]
    cortes = [e["at"] for e in ev if e["msg"].get("type") == "task_request"]
    n = p["tramo"]
    if len(cortes) < n:
        log(f"{caso['id']}: {src.name} no tiene el tramo {n}")
        return None
    t0 = cortes[n - 1] - 2.0
    t1 = cortes[n] - 0.5 if n < len(cortes) else d["duracion"] + 1
    antes = [e for e in ev if e["at"] < t0]
    previo: list[dict[str, Any]] = []
    if n > 1:
        ultimo_v = [e for e in antes if e["msg"].get("type") == "frame"][-1:]
        pantallas = [e for e in antes if e["msg"].get("type") == "screen"]
        previo = [{"at": 0.0, "msg": e["msg"]} for e in pantallas + ultimo_v]
    dentro = [{"at": round(e["at"] - t0, 3), "msg": e["msg"]} for e in ev if t0 <= e["at"] < t1]
    reales = d.get("real", [])
    r_antes = [r for r in reales if r["at"] < t0][-1:]
    real = [{**r, "at": 0.0} for r in r_antes] + [{**r, "at": round(r["at"] - t0, 3)} for r in reales if t0 <= r["at"] < t1]
    dur = max([e["at"] for e in dentro] + [r["at"] for r in real] + [0]) + 3.0
    return {"formato": "priv8-sesion/1", "nombre": caso["feed"], "caso": caso["id"], "vertical": caso["vertical"],
            "titulo": caso["titulo"], "provisional": False, "fuente": f"recorte del tramo {n} de {p['desde']}",
            "grabada": d.get("grabada"), "modelo": d.get("modelo"), "encargos": [caso["pedido"]],
            "duracion": round(dur, 2), "eventos": previo + dentro, "real": real}


def escribir(caso: dict[str, Any], sesion: dict[str, Any]) -> None:
    texto = json.dumps(sesion, ensure_ascii=False, separators=(",", ":"))
    texto = texto.replace(" · ", " | ").replace("·", "-")  # sin punto medio en lo publicado
    (PUBLIC / f"{caso['feed']}.json").write_text(texto + "\n", encoding="utf-8")
    log(f"{caso['feed']}.json: {sesion['duracion']:.0f} s, {len(sesion['eventos'])} mensajes"
        f"{' (provisional)' if sesion.get('provisional') else ''}")


def real_existe(caso: dict[str, Any]) -> bool:
    f = PUBLIC / f"{caso['feed']}.json"
    if not f.exists():
        return False
    try:
        return json.loads(f.read_text(encoding="utf-8")).get("provisional") is False and "recorte" not in json.loads(
            f.read_text(encoding="utf-8")).get("fuente", "")
    except ValueError:
        return False


def main(argv: list[str]) -> int:
    todos = [c for c in casos() if c.get("provisional")]
    if argv and argv[0] == "--uno":  # el hijo: un caso, mensajes al archivo argv[2]
        caso = next(c for c in todos if c["id"] == argv[1])
        msgs = uno_b2c(caso) if caso["vertical"] == "b2c" else uno_escena(caso)
        Path(argv[2]).write_text(json.dumps(msgs, ensure_ascii=False), encoding="utf-8")
        sys.stderr.flush()
        os._exit(0)  # hilos del puente y del móvil falso
    forzar = "--forzar" in argv
    ids = [a for a in argv if not a.startswith("--")]
    elegidos = [c for c in todos if not ids or c["id"] in ids]
    for caso in elegidos:
        if real_existe(caso) and not forzar:
            log(f"{caso['id']}: ya hay una grabación real; no se toca (--forzar para sobrescribirla)")
            continue
        if "desde" in caso["provisional"]:
            s = recorte(caso)
            if s:
                escribir(caso, s)
            continue
        env = {**os.environ, "PRIV8_CORE": "real", "PRIV8_AUDIT": "off", "PRIV8_FRAMES": "0", "PYTHONUNBUFFERED": "1"}
        import tempfile
        salida = Path(tempfile.mkstemp(prefix="priv8-caso-", suffix=".json")[1])
        r = subprocess.run([sys.executable, __file__, "--uno", caso["id"], str(salida)], cwd=ROOT, env=env,
                           capture_output=True, text=True, timeout=180)
        sys.stderr.write("".join(l + "\n" for l in r.stderr.splitlines() if l.startswith("[casos]")))
        if r.returncode:
            sys.stderr.write(r.stderr[-3000:])
            sys.exit(f"{caso['id']}: falló")
        eventos = cronometrar(json.loads(salida.read_text(encoding="utf-8")))
        salida.unlink(missing_ok=True)
        dur = (eventos[-1]["at"] if eventos else 0) + 3.0
        fuente = ("núcleo real, puente Android y móvil falso (adapters/android/fake_phone.py), respuestas grabadas"
                  if caso["vertical"] == "b2c" else "núcleo real y escena de core/scenes.py, respuestas grabadas")
        escribir(caso, {"formato": "priv8-sesion/1", "nombre": caso["feed"], "caso": caso["id"],
                        "vertical": caso["vertical"], "titulo": caso["titulo"], "provisional": True,
                        "fuente": fuente, "grabada": time.strftime("%Y-%m-%d"), "modelo": None,
                        "encargos": [caso["pedido"]], "duracion": round(dur, 2), "eventos": eventos, "real": []})
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
