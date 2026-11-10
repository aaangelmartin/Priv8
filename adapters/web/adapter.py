"""Adaptador web con Playwright (#18): ERP Alba Core y bandeja de correo.

Cumple core/adapter.py: snapshot() devuelve la pantalla con valores reales
(snapshot.schema.json) y perform() ejecuta una acción ya rehidratada. Todo lo
que pasa por aquí se queda en la zona de confianza.

Lee el DOM, no píxeles: solo entra en el snapshot lo que la app marca con
data-p8="<role>" (contrato en apps/erp-sim/README.md). El selector es "#id" o,
sin id, ".clase"; es lo que casan las políticas de policies/.

Playwright síncrono solo puede usarse desde el hilo que lo arrancó, y el núcleo
llama al adaptador desde varios hilos (el bucle del agente, el WebSocket de
aprobaciones). Por eso el navegador vive en un hilo propio y cada llamada se le
pasa por una cola.

    from adapters.web import WebAdapter
    web = WebAdapter(start="inbox")      # abre Chromium con una pestaña por app
    core.connect("b2b", web)
"""

from __future__ import annotations

import queue
import threading
from collections.abc import Callable
from concurrent.futures import Future
from typing import Any

APPS: dict[str, str] = {
    "alba-core": "http://127.0.0.1:5173",
    "inbox": "http://127.0.0.1:5174",
}
HOME: dict[str, str] = {"alba-core": "/facturas/alta", "inbox": "/bandeja"}

# Recorre el DOM y devuelve los elementos marcados con data-p8. Marca cada uno con
# data-p8-ref para que perform() lo encuentre sin recalcular selectores.
_SNAPSHOT_JS = r"""
() => {
  const DEFAULT_ACTIONS = {textbox: ['type'], button: ['tap'], link: ['tap'], menuitem: ['tap'],
                           checkbox: ['tap'], radio: ['tap'], switch: ['tap'], tab: ['tap'], option: ['tap']};
  const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
  const labelOf = (el) => {
    if (el.dataset.p8Label) return el.dataset.p8Label;
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return clean(l.textContent);
    }
    return null;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
  };
  document.querySelectorAll('[data-p8-ref]').forEach((el) => el.removeAttribute('data-p8-ref'));
  const out = [];
  let n = 0;
  for (const el of document.querySelectorAll('[data-p8]')) {
    if (!visible(el)) continue;
    const ref = 'e' + (++n);
    el.setAttribute('data-p8-ref', ref);
    const role = el.dataset.p8;
    const field = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    const r = el.getBoundingClientRect();
    const sel = el.id ? '#' + el.id : (el.classList.length ? '.' + el.classList[0] : null);
    let actions = el.dataset.p8Actions !== undefined
      ? el.dataset.p8Actions.split(/[\s,]+/).filter(Boolean)
      : (DEFAULT_ACTIONS[role] || []);
    const disabled = el.disabled === true || el.getAttribute('aria-disabled') === 'true';
    if (disabled) actions = [];
    const parent = el.parentElement && el.parentElement.closest('[data-p8-ref]');
    const item = {id: ref, role, label: labelOf(el),
                  text: field ? el.value : (clean(el.textContent) || null),
                  enabled: !disabled,
                  bounds: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
                  actions};
    if (sel) item.sel = sel;
    if (el.type === 'password') item.password = true;
    if (parent) item.parent = parent.getAttribute('data-p8-ref');
    out.push(item);
  }
  const f = document.activeElement && document.activeElement.getAttribute('data-p8-ref');
  return {elements: out, focus: f || null};
}
"""


class WebAdapter:
    """Una pestaña de Chromium por app; open_app cambia la pestaña activa."""

    source = "web"

    def __init__(self, apps: dict[str, str] | None = None, start: str = "inbox", *,
                 headless: bool = False, on_call: Callable[[str], bool] | None = None,
                 timeout_ms: int = 5000, slow_mo_ms: int = 0) -> None:
        self.apps = dict(apps or APPS)
        if start not in self.apps:
            raise ValueError(f"app desconocida: {start}")
        self.on_call = on_call or self._llamada_simulada
        self.calls: list[str] = []
        self.seq = 0
        self._timeout = timeout_ms
        self._jobs: queue.Queue[tuple[Callable[[], Any], Future] | None] = queue.Queue()
        self._ready: Future = Future()
        self._thread = threading.Thread(target=self._run, args=(start, headless, slow_mo_ms),
                                        name="priv8-web", daemon=True)
        self._thread.start()
        self._ready.result(timeout=60)  # propaga el error si Chromium no arranca

    # ---- hilo del navegador ----

    def _run(self, start: str, headless: bool, slow_mo_ms: int) -> None:
        from playwright.sync_api import sync_playwright

        try:
            self._pw = sync_playwright().start()
            self._browser = self._pw.chromium.launch(headless=headless, slow_mo=slow_mo_ms)
            self._ctx = self._browser.new_context(viewport={"width": 1100, "height": 760}, locale="es-ES")
            self._ctx.set_default_timeout(self._timeout)
            self._pages: dict[str, Any] = {}
            self.app = start
            self._page(start)
        except BaseException as e:  # noqa: BLE001
            self._ready.set_exception(e)
            return
        self._ready.set_result(True)
        while (job := self._jobs.get()) is not None:
            fn, fut = job
            try:
                fut.set_result(fn())
            except BaseException as e:  # noqa: BLE001
                fut.set_exception(e)
        self._browser.close()
        self._pw.stop()

    def _call(self, fn: Callable[[], Any]) -> Any:
        fut: Future = Future()
        self._jobs.put((fn, fut))
        return fut.result(timeout=self._timeout / 1000 + 30)

    def _page(self, app: str) -> Any:
        page = self._pages.get(app)
        if page is None or page.is_closed():
            page = self._ctx.new_page()
            page.goto(self.apps[app] + HOME.get(app, "/"))
            self._pages[app] = page
        return page

    # ---- interfaz del núcleo (core/adapter.py) ----

    def snapshot(self) -> dict[str, Any]:
        def job() -> dict[str, Any]:
            page = self._page(self.app)
            page.wait_for_load_state("domcontentloaded")
            dom = page.evaluate(_SNAPSHOT_JS)
            self.seq += 1
            return {"source": "web", "app": self.app, "screen": None, "url": page.url, "seq": self.seq,
                    "focus": dom["focus"], "system_dialog": None, "elements": dom["elements"]}
        return self._call(job)

    def perform(self, action: dict[str, Any]) -> dict[str, Any]:
        return self._call(lambda: self._perform(action))

    def _perform(self, a: dict[str, Any]) -> dict[str, Any]:
        from playwright.sync_api import Error as PwError, TimeoutError as PwTimeout

        op, target, text = a.get("op"), a.get("target"), a.get("text") or ""
        try:
            if op == "open_app":
                if text not in self.apps:
                    return {"ok": False, "error": "target_no_encontrado"}
                self.app = text
                self._page(text).bring_to_front()
                return {"ok": True}
            page = self._page(self.app)
            if op == "back":
                page.go_back()
                return {"ok": True}
            if op == "key":
                page.keyboard.press(text)
                return {"ok": True}
            if op == "scroll":
                dy = {"up": -400, "down": 400}.get(a.get("direction", "down"), 0)
                dx = {"left": -400, "right": 400}.get(a.get("direction", ""), 0)
                page.mouse.wheel(dx, dy)
                return {"ok": True}
            if not target:
                return {"ok": False, "error": "target_no_encontrado"}
            el = page.locator(f'[data-p8-ref="{target}"]')
            if el.count() != 1:
                return {"ok": False, "error": "target_no_encontrado"}
            if op in ("tap", "send"):
                el.click()
                return {"ok": True}
            if op == "type":
                if not el.is_editable():
                    return {"ok": False, "error": "no_permitido"}
                el.fill(text)
                return {"ok": True}
            if op == "call":
                numero = text or (el.input_value() if el.is_editable() else el.inner_text())
                self.calls.append(numero)
                return {"ok": bool(self.on_call(numero))}
            return {"ok": False, "error": "no_permitido"}
        except PwTimeout:
            return {"ok": False, "error": "timeout"}
        except PwError:
            return {"ok": False, "error": "otro"}

    # ---- utilidades ----

    def goto(self, app: str, path: str) -> None:
        """Navega a una ruta (montaje de la demo y tests; el agente usa tap y open_app)."""
        def job() -> None:
            self.app = app
            page = self._page(app)
            page.goto(self.apps[app] + path)
            page.wait_for_load_state("networkidle")  # /reset redirige por su cuenta
            page.bring_to_front()
        self._call(job)

    def close(self) -> None:
        if self._thread.is_alive():
            self._jobs.put(None)
            self._thread.join(timeout=10)

    @staticmethod
    def _llamada_simulada(numero: str) -> bool:
        # Hasta que exista la llamada real (#23): queda en self.calls y no sale nada.
        return True

    def __enter__(self) -> WebAdapter:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
