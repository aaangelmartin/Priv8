"""A fake phone for the bridge: app 8's accessibility service without an emulator.

It connects to the core's bridge (ws://127.0.0.1:8765) as the client, says
hello and answers like apps/android-8 does: snapshots of Banca Alcor with the
same ids, selectors and texts the real app gives on the AVD `priv8` (captured
with bridge_dev_server.py on 11 Nov 2026), results for each perform, and an
approval_result for each confirm_request. Like the real service, a paused
snapshot (8's confirmation, a password field) makes it forget the ids of the
screen, and a perform on an id it does not have returns target_no_encontrado.

Every message it gets is validated against bridge.schema.json; the invalid
ones are kept in `invalid`. Simulated data only. For tests and replays.
"""

from __future__ import annotations

import asyncio
import json
import threading
from pathlib import Path
from typing import Any

from websockets.asyncio.client import connect

from adapters.android.bridge_dev_server import load_validator

CONTRACTS = Path(__file__).resolve().parents[2] / "docs" / "contracts"
ALCOR = "es.priv8.banks.alcor"
OCHO = "es.priv8.ocho"
LAUNCHER = "com.google.android.apps.nexuslauncher"
NIMBO = ("Lucía Ferrer · Nimbo Bróker", "ES08 9300 0001 0522 0033 4455")


def _el(i: int, role: str, sel: str | None, text: str | None = None, label: str | None = None,
        parent: int | None = 1, actions: list[str] | None = None, **kw: Any) -> dict[str, Any]:
    e: dict[str, Any] = {"id": f"n{i}", "role": role, "label": label, "text": text,
                         "enabled": True, "parent": f"n{parent}" if parent else None}
    if sel is not None:
        e["sel"] = sel
    if actions:
        e["actions"] = actions
    e.update(kw)
    return e


class FakePhone:
    """Banca Alcor and app 8 behind the bridge, in a background thread."""

    def __init__(self, url: str = "ws://127.0.0.1:8765", *, answer: str | None = "ok",
                 answer_delay: float = 0.2, page: str = "inicio", app: str = ALCOR) -> None:
        self.url = url
        self.answer = answer  # "ok", "no", or None (nobody answers)
        self.answer_delay = answer_delay
        self.validator = load_validator(CONTRACTS)
        self.app, self.page = app, page
        self.form = {"iban": "", "beneficiario": "", "importe": "", "concepto": ""}
        self.seq = 0
        self.ids: set[str] = set()  # ids of the last snapshot, as the real service keeps them
        self.confirming: str | None = None  # id of the confirm_request on screen
        self.received: list[dict[str, Any]] = []  # every message from the core, in order
        self.invalid: list[dict[str, Any]] = []
        self.values: dict[str, str] = {}  # render_values, as LocalValues
        self.performed: list[dict[str, Any]] = []
        self.transfers: list[dict[str, str]] = []
        self.answered: dict[str, dict[str, Any]] = {}
        self._ws: Any = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._connected = threading.Event()
        self._stop: asyncio.Event | None = None

    # ------------------------------------------------------------------ lifecycle

    def start(self, timeout: float = 10) -> FakePhone:
        self._thread = threading.Thread(target=lambda: asyncio.run(self._main()), daemon=True)
        self._thread.start()
        if not self._connected.wait(timeout):
            raise RuntimeError(f"the fake phone could not connect to {self.url}")
        return self

    def stop(self) -> None:
        if self._loop is not None and self._stop is not None:
            self._loop.call_soon_threadsafe(self._stop.set)
        if self._thread is not None:
            self._thread.join(5)

    def reconnect(self) -> None:
        """Drop the connection and connect again (a new hello), as after a network hiccup."""
        assert self._loop is not None
        self._connected.clear()
        asyncio.run_coroutine_threadsafe(self._ws.close(), self._loop).result(5)
        if not self._connected.wait(10):
            raise RuntimeError("the fake phone did not reconnect")

    async def _main(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._stop = asyncio.Event()
        while not self._stop.is_set():
            try:
                async with connect(self.url) as ws:
                    self._ws = ws
                    await ws.send(json.dumps({"type": "hello", "device": "fake (API 34)", "version": 1}))
                    self._connected.set()
                    reader = asyncio.create_task(self._read(ws))
                    stop = asyncio.create_task(self._stop.wait())
                    await asyncio.wait({reader, stop}, return_when=asyncio.FIRST_COMPLETED)
                    reader.cancel()
                    stop.cancel()
            except OSError:
                await asyncio.sleep(0.2)

    async def _read(self, ws: Any) -> None:
        try:
            async for frame in ws:
                msg = json.loads(frame)
                self.received.append(msg)
                if not self.validator.is_valid(msg):
                    self.invalid.append(msg)
                    continue
                await self._handle(ws, msg)
        except Exception:  # noqa: BLE001 - connection closed
            pass

    async def _handle(self, ws: Any, msg: dict[str, Any]) -> None:
        kind = msg["type"]
        if kind == "snapshot.request":
            await ws.send(json.dumps({"type": "snapshot", "id": msg["id"], "raw": self.snapshot()},
                                     ensure_ascii=False))
        elif kind == "perform":
            ok, error = self.perform(msg)
            out: dict[str, Any] = {"type": "result", "id": msg["id"], "ok": ok}
            if not ok:
                out["error"] = error
            await ws.send(json.dumps(out))
        elif kind == "render_values":
            self.values.update(msg["values"])
        elif kind == "confirm_request":
            if msg["id"] in self.answered:  # already answered: same approval_result again
                await ws.send(json.dumps(self.answered[msg["id"]]))
            elif self.answer is not None:
                self.confirming = msg["id"]
                asyncio.get_running_loop().call_later(
                    self.answer_delay, lambda: asyncio.ensure_future(self._approve(ws, msg)))
            else:
                self.confirming = msg["id"]
        elif kind == "voice":
            u = msg["utterance"]["utterance"]
            await ws.send(json.dumps({"type": "voice.done", "utterance": u, "ok": True,
                                      "gap_ms": {"max": 120, "mean": 80}}))

    async def _approve(self, ws: Any, req: dict[str, Any]) -> None:
        # The person hears the summary with the values rendered here; with a missing value
        # the real app does not offer Confirmar.
        missing = [s["token"] for s in req["summary"] if s.get("token") and s["token"] not in self.values]
        ok = self.answer == "ok" and not missing
        res: dict[str, Any] = {"type": "approval_result", "id": req["id"], "ok": ok, "via": "voz", "by": "persona"}
        if not ok:
            res["reason"] = "cancelado"
        self.answered[req["id"]] = res
        self.confirming = None
        await ws.send(json.dumps(res))

    # ------------------------------------------------------------------ the phone

    def snapshot(self) -> dict[str, Any]:
        self.seq += 1
        base = {"source": "android", "seq": self.seq, "focus": None, "system_dialog": None}
        if self.confirming:
            self.ids = set()
            return {**base, "app": OCHO, "screen": "confirmacion", "elements": []}
        if self.app == OCHO:
            self.ids = set()
            return {**base, "app": OCHO, "screen": None, "elements": []}
        if self.app != ALCOR:
            self.ids = set()
            return {**base, "app": self.app, "screen": None, "elements": []}
        if self.page == "autenticacion":
            # The person types the OTP and confirms while 8 looks away.
            self.page = "resultado"
            self.transfers.append(dict(self.form))
        els = getattr(self, f"_{self.page}")()
        self.ids = {e["id"] for e in els}
        return {**base, "app": ALCOR, "screen": self.page, "elements": els}

    def perform(self, msg: dict[str, Any]) -> tuple[bool, str | None]:
        self.performed.append({k: v for k, v in msg.items() if k != "type"})
        op, t, text = msg["op"], msg.get("target"), msg.get("text", "")
        if self.confirming or self.app == OCHO and op != "open_app":
            return False, "no_permitido"
        if op == "open_app":
            if text not in (ALCOR, OCHO):
                return False, "target_no_encontrado"
            self.app = text
            return True, None
        if t is not None and t not in self.ids:
            return False, "target_no_encontrado"
        p = self.page
        if p == "inicio" and op == "tap" and t == "n17":
            self.page = "transferencia"
        elif p == "transferencia" and op == "tap" and t == "n8":
            self.form.update(iban=NIMBO[1], beneficiario=NIMBO[0])
        elif p == "transferencia" and op == "type" and t in ("n18", "n20", "n22", "n24"):
            self.form[{"n18": "iban", "n20": "beneficiario", "n22": "importe", "n24": "concepto"}[t]] = text
        elif p == "transferencia" and op == "scroll":
            pass
        elif p == "transferencia" and op == "tap" and t == "n25":
            self.page = "revision"
        elif p == "revision" and op == "tap" and t == "n17":
            self.page = "autenticacion"
        elif p == "revision" and op == "tap" and t == "n18":
            self.page = "transferencia"
        elif p == "resultado" and op == "tap" and t == "n14":
            self.page = "inicio"
        else:
            return False, "no_permitido"
        return True, None

    def _eur(self) -> str:
        raw = self.form["importe"].replace("€", "").strip()
        try:
            n = float(raw.replace(".", "").replace(",", "."))
        except ValueError:
            return raw
        return f"{n:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")

    # Screens of Banca Alcor as the AVD gives them (ids in preorder, only what is visible).
    def _inicio(self) -> list[dict[str, Any]]:
        return [_el(1, "other", "id/screen_inicio", parent=None),
                _el(2, "heading", "id/banco_nombre", "Banca Alcor"),
                _el(3, "button", "id/btn_salir", "Salir", "Cerrar la sesión", actions=["tap"]),
                _el(4, "heading", "id/saludo", "Hola, Lucía Ferrer"),
                _el(5, "text", "id/saldo_total_label", "Saldo total"),
                _el(6, "text", "id/saldo_total", "15.462,58 €"),
                _el(7, "heading", "id/cuentas_titulo", "Tus cuentas"),
                _el(8, "other", "id/lista_cuentas"),
                _el(9, "button", "id/cuenta", None, "Ver movimientos de Cuenta nómina", 8, ["tap"]),
                _el(10, "text", "id/cuenta_alias", "Cuenta nómina", parent=9),
                _el(11, "text", "id/cuenta_saldo", "3.412,58 €", parent=9),
                _el(12, "text", "id/cuenta_iban", "ES43 9100 0001 5740 1234 5678", parent=9),
                _el(13, "button", "id/cuenta", None, "Ver movimientos de Cuenta ahorro", 8, ["tap"]),
                _el(14, "text", "id/cuenta_alias", "Cuenta ahorro", parent=13),
                _el(15, "text", "id/cuenta_saldo", "12.050,00 €", parent=13),
                _el(16, "text", "id/cuenta_iban", "ES66 9100 0001 5140 8765 4321", parent=13),
                _el(17, "button", "id/btn_transferir", "Hacer una transferencia", actions=["tap"]),
                _el(18, "button", "id/btn_movimientos", "Ver movimientos", actions=["tap"])]

    def _transferencia(self) -> list[dict[str, Any]]:
        f = self.form
        return [_el(1, "other", "id/screen_transferencia", parent=None),
                _el(2, "button", "id/btn_volver", "Volver", "Volver a la pantalla anterior", actions=["tap"]),
                _el(3, "heading", "id/titulo", "Nueva transferencia"),
                _el(4, "other", None, actions=["scroll"]),
                _el(5, "button", "id/btn_cambiar_origen", "Cambiar cuenta", parent=4, actions=["tap"]),
                _el(6, "heading", "id/contactos_titulo", "Contactos guardados", parent=4),
                _el(7, "other", "id/lista_contactos", parent=4),
                _el(8, "button", "id/contacto", parent=7, actions=["tap"]),
                _el(9, "text", "id/contacto_nombre", NIMBO[0], parent=8),
                _el(10, "text", "id/contacto_iban", NIMBO[1], parent=8),
                _el(11, "button", "id/contacto", parent=7, actions=["tap"]),
                _el(12, "text", "id/contacto_nombre", "Lucía Ferrer · Brezo Banco", parent=11),
                _el(13, "text", "id/contacto_iban", "ES89 9200 0003 7855 0066 7788", parent=11),
                _el(14, "button", "id/contacto", parent=7, actions=["tap"]),
                _el(15, "text", "id/contacto_nombre", "Marta Ruiz Gil", parent=14),
                _el(16, "text", "id/contacto_iban", "ES48 9100 0004 9633 0099 8877", parent=14),
                _el(17, "text", "id/iban_destino_label", "IBAN de destino", parent=4),
                _el(18, "textbox", "id/iban_destino", f["iban"] or None, "IBAN de destino", 4, ["tap", "type"]),
                _el(19, "text", "id/beneficiario_label", "Beneficiario", parent=4),
                _el(20, "textbox", "id/beneficiario", f["beneficiario"] or None, "Beneficiario", 4, ["tap", "type"]),
                _el(21, "text", "id/importe_label", "Importe", parent=4),
                _el(22, "textbox", "id/importe", f["importe"] or None, "Importe", 4, ["tap", "type"]),
                _el(23, "text", "id/concepto_label", "Concepto", parent=4),
                _el(24, "textbox", "id/concepto", f["concepto"] or None, "Concepto", 4, ["tap", "type"]),
                _el(25, "button", "id/btn_continuar", "Continuar", parent=4, actions=["tap"])]

    def _revision(self) -> list[dict[str, Any]]:
        f = self.form
        return [_el(1, "other", "id/screen_revision", parent=None),
                _el(2, "button", "id/btn_volver", "Volver", "Volver a la pantalla anterior", actions=["tap"]),
                _el(3, "heading", "id/titulo", "Revisa la transferencia"),
                _el(4, "text", "id/rev_importe_label", "Importe"),
                _el(5, "text", "id/rev_importe", self._eur()),
                _el(6, "text", "id/rev_beneficiario_label", "Beneficiario"),
                _el(7, "text", "id/rev_beneficiario", f["beneficiario"]),
                _el(8, "text", "id/rev_iban_destino_label", "IBAN de destino"),
                _el(9, "text", "id/rev_iban_destino", f["iban"]),
                _el(10, "text", "id/rev_origen_label", "Desde"),
                _el(11, "text", "id/rev_origen_alias", "Cuenta nómina"),
                _el(12, "text", "id/rev_origen_iban", "ES43 9100 0001 5740 1234 5678"),
                _el(13, "text", "id/rev_concepto_label", "Concepto"),
                _el(14, "text", "id/rev_concepto", f["concepto"] or "Sin concepto"),
                _el(15, "text", "id/rev_comision_label", "Comisión"),
                _el(16, "text", "id/rev_comision", "Sin comisión"),
                _el(17, "button", "id/btn_enviar", "Enviar transferencia", actions=["tap"]),
                _el(18, "button", "id/btn_cancelar", "Cancelar", actions=["tap"])]

    def _resultado(self) -> list[dict[str, Any]]:
        f = self.form
        return [_el(1, "other", "id/screen_resultado", parent=None),
                _el(2, "heading", "id/titulo", "Transferencia enviada"),
                _el(3, "text", "id/res_texto", "El dinero llegará hoy."),
                _el(4, "text", "id/res_importe_label", "Importe"),
                _el(5, "text", "id/res_importe", self._eur()),
                _el(6, "text", "id/res_beneficiario_label", "Beneficiario"),
                _el(7, "text", "id/res_beneficiario", f["beneficiario"]),
                _el(8, "text", "id/res_iban_destino_label", "IBAN de destino"),
                _el(9, "text", "id/res_iban_destino", f["iban"]),
                _el(10, "text", "id/res_referencia_label", "Referencia"),
                _el(11, "text", "id/res_referencia", "TR-20261111-0001"),
                _el(12, "text", "id/res_fecha_label", "Fecha"),
                _el(13, "text", "id/res_fecha", "11 nov 2026"),
                _el(14, "button", "id/btn_inicio", "Volver al inicio", actions=["tap"])]
