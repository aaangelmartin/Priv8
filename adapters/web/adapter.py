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

Vista de 8 en la consola (#147, #154): mientras una consola mira (core.connect
pone `watching` y `on_frame`), el adaptador mantiene una página espejo en un
Chromium sin ventana (vista.py) con la pestaña de 8 censurada en el DOM: cada valor
ámbar lleva su token y cada rojo «nunca sale» antes de escribirse en el espejo, y
lo que no ha leído el modelo sale como marcador neutro. Lo que se emite (CDP
Page.startScreencast, hasta FRAME_FPS por segundo) es ese espejo: los píxeles de la
pestaña real ya no salen del adaptador. Se sincroniza en el hilo del navegador entre
una llamada y la siguiente (cambios del DOM, desplazamiento, foco), así que
snapshot() y perform() no esperan a ningún fotograma. Sin nadie mirando, no se copia
ni se captura nada. PRIV8_FRAMES=0 lo apaga.

8 en la ventana (#135, #154): el cursor son los ojos de 8 (el motor de la web) con
su cara según lo que hace (lee, piensa, escribe, espera, se enfada, termina) y
bocadillos con lo que razona y hace. Lo mueve el canal de eventos del núcleo, en el
mismo proceso (on_core_event); en la ventana real el bocadillo puede llevar valores
(es la pantalla de la persona) y en la vista de 8 el mismo bocadillo lleva tokens.
"""

from __future__ import annotations

import os
import queue
import re
import threading
import time
import urllib.request
from collections.abc import Callable
from concurrent.futures import Future
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

# PRIV8_ALBA_URL y PRIV8_INBOX_URL apuntan a otra copia de las apps (tests sin tocar la demo).
APPS: dict[str, str] = {
    "alba-core": os.environ.get("PRIV8_ALBA_URL", "http://127.0.0.1:5173").rstrip("/"),
    "inbox": os.environ.get("PRIV8_INBOX_URL", "http://127.0.0.1:5174").rstrip("/"),
}

from .vista import CALL_JS, CENSOR_JS, INIT_SCRIPT, INSTALL_JS, Vista8, obs_map, secrets_of

# Cursor de 8 (#135): capa visible en la ventana de Chromium. PRIV8_CURSOR=0 la apaga.
# Tecleo visible: hasta TYPE_VISIBLE caracteres a ritmo humano y el resto de golpe, para que
# el retraso añadido por acción (deslizamiento hasta 0,5 s más tecleo) quede por debajo de 0,8 s.
TYPE_VISIBLE = 16
TYPE_BUDGET_MS = 220


def cursor_enabled(default: bool) -> bool:
    """PRIV8_CURSOR=0|off|false lo apaga, 1|on lo enciende; sin la variable, `default`."""
    v = os.environ.get("PRIV8_CURSOR")
    if v is None or not v.strip():
        return default
    return v.strip().lower() not in ("0", "off", "false", "no")


# Vista de 8 (#147, #154): fotogramas por segundo como mucho, tamaño máximo y calidad JPEG.
FRAME_FPS = 10
FRAME_MAX_W, FRAME_MAX_H = 1650, 1140
FRAME_QUALITY = 70
FRAME_TICK_MS = 15      # sin trabajos, cada cuánto atiende el navegador los fotogramas
SYNC_EVERY_S = 0.1      # cada cuánto se mira si la pestaña ha cambiado (debounce de los cambios)
VIEWPORT = {"width": 1100, "height": 760}

# Lo que dice 8 en el bocadillo: corto, una frase, sin markdown.
BLOQUEO = {
    "destino": "Ese dato del correo no entra en ese campo.",
    "fuga": "Esa petición llevaba un dato sin tapar: no sale.",
    "rojo": "Ese dato nunca sale.",
    "presupuesto": "El oráculo no responde más.",
    "asesoria": "No doy consejo de inversión.",
    "caducado": "La confirmación ha caducado.",
    "cancelado": "Acción cancelada.",
    "sin_regla": "Esta pantalla no tiene regla: vuelvo.",
    "token_desconocido": "Ese token no existe en la sesión.",
    "adaptador": "La pantalla no ha respondido.",
}


_ES_LLAMADA = re.compile(r'^\s*(observe|act|oracle)\b|\{"')  # un paso con herramientas, no una respuesta


def _firma(raw: dict[str, Any]) -> tuple:
    """Qué pantalla es y qué elementos tiene (sin sus textos): misma firma, mismos ids."""
    return (raw.get("app"), raw.get("url"),
            tuple((e.get("id"), e.get("role"), e.get("sel"), e.get("label")) for e in raw.get("elements", [])))


def corto(texto: str | None, maximo: int = 150) -> str:
    """La primera frase de un texto del modelo, sin markdown, para un bocadillo."""
    s = re.sub(r"\*\*|__|`+|^#+\s*", "", str(texto or ""), flags=re.M)
    s = re.sub(r"^\s*(?:\d+[.)]|[-*•])\s+", "", s, flags=re.M)
    s = " ".join(s.split())
    m = re.match(r"^(.{20,}?[.:;!?])(?:\s|$)", s)
    if m and len(m.group(1)) <= maximo:
        return m.group(1)
    if len(s) <= maximo:
        return s
    cut = s[:maximo].rsplit(" ", 1)[0]
    if cut.count("‹") > cut.count("›"):  # sin partir un token
        cut = cut[:cut.rindex("‹")].rstrip()
    return cut + "…"


def frames_enabled() -> bool:
    v = os.environ.get("PRIV8_FRAMES", "").strip().lower()
    return v not in ("0", "off", "false", "no")


HOME: dict[str, str] = {"alba-core": "/facturas/alta", "inbox": "/bandeja"}
# Nombres con los que el agente puede pedir cada app en open_app (minúsculas, sin espacios ni guiones).
ALIASES: dict[str, str] = {
    "albacore": "alba-core", "alba": "alba-core", "erp": "alba-core",
    "inbox": "inbox", "correo": "inbox", "bandeja": "inbox", "email": "inbox", "mail": "inbox",
}


def app_key(name: str, apps: dict[str, str]) -> str | None:
    """Clave de la app para un nombre como 'Alba Core', 'ERP' o 'correo'."""
    if name in apps:
        return name
    import unicodedata
    n = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    n = "".join(c for c in n if c.isalnum())
    key = ALIASES.get(n)
    return key if key in apps else None


# Perfil de Chromium que recuerda la sesión entre ejecuciones (#137), como el navegador de
# un ordenador de la empresa. PRIV8_WEB_PROFILE=<carpeta> usa otra; "off", uno de usar y tirar.
DEFAULT_PROFILE = Path(__file__).resolve().parents[2] / ".priv8" / "chromium"


def profile_dir(env: dict[str, str] | None = None) -> Path | None:
    """Carpeta del perfil persistente, o None si PRIV8_WEB_PROFILE=off."""
    v = (os.environ if env is None else env).get("PRIV8_WEB_PROFILE", "").strip()
    if v.lower() in ("off", "0", "no", "false"):
        return None
    return Path(v).expanduser() if v else DEFAULT_PROFILE


def on_login_screen(url: str) -> bool:
    """La app pide identificarse (su ruta es /login): la clave la escribe la persona."""
    return urlparse(url).path.rstrip("/").endswith("/login")

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
    if (!visible(el) || el.closest('[data-p8-ignore]')) continue;  // la capa del cursor de 8 no entra
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
                  text: el.dataset.p8Text !== undefined ? (el.dataset.p8Text || null)
                        : field ? el.value : (clean(el.innerText) || null),
                  enabled: !disabled,
                  bounds: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
                  actions};
    if (sel) item.sel = sel;
    if (el.type === 'password') item.password = true;
    if (parent) item.parent = parent.getAttribute('data-p8-ref');
    out.push(item);
  }
  const f = document.activeElement && document.activeElement.getAttribute('data-p8-ref');
  const adj = document.querySelector('#adjunto');
  const pdf = {};
  if (adj && adj.getAttribute('href')) {
    for (const id of ['pdf-proveedor', 'pdf-cif', 'pdf-numero', 'pdf-importe']) {
      const e = document.getElementById(id);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      pdf[id] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
    }
  }
  return {elements: out, focus: f || null, pdfHref: adj ? adj.getAttribute('href') : null, pdfBounds: pdf};
}
"""


_PDF_CAMPOS = (("proveedor", "Proveedor", "pdf-proveedor"), ("cif", "CIF", "pdf-cif"),
               ("numero", "Numero", "pdf-numero"), ("importe", "Total", "pdf-importe"))
_PDF_ETIQUETA = {"pdf-proveedor": "Proveedor (PDF)", "pdf-cif": "CIF (PDF)",
                 "pdf-numero": "Número (PDF)", "pdf-importe": "Importe (PDF)"}


def pdf_texto(data: bytes) -> str:
    """Texto de un PDF sencillo (sin comprimir): los operandos de Tj, una línea cada uno."""
    lineas = []
    for m in re.finditer(rb"\(((?:\\.|[^\\)])*)\)\s*Tj", data):
        raw = re.sub(rb"\\(.)", rb"\1", m.group(1), flags=re.S)
        lineas.append(raw.decode("cp1252", "replace"))
    return "\n".join(lineas)


def pdf_campos(texto: str) -> dict[str, str]:
    """proveedor, cif, numero e importe de la factura a partir de su texto."""
    out = {}
    for clave, etiqueta, _ in _PDF_CAMPOS:
        m = re.search(rf"^{etiqueta}:\s*(.+)$", texto, re.M)
        if m:
            out[clave] = m.group(1).strip()
    return out


class WebAdapter:
    """Una pestaña de Chromium por app; open_app cambia la pestaña activa.

    `known(snapshot) -> bool` dice si una pantalla tiene política (mount_web pasa la del
    núcleo). Con él, back, open_app y recover() nunca dejan al agente en una página que
    no sale: lo llevan a la pantalla de inicio de la app. Sin él basta con que la página
    sea del origen de la app y tenga elementos data-p8.
    """

    source = "web"

    def __init__(self, apps: dict[str, str] | None = None, start: str = "inbox", *,
                 headless: bool = False, on_call: Callable[[str], bool] | None = None,
                 timeout_ms: int = 5000, slow_mo_ms: int = 0, profile: str | Path | None = None,
                 cursor: bool | None = None, known: Callable[[dict[str, Any]], bool] | None = None) -> None:
        self.apps = dict(apps or APPS)
        self.start = start
        self.known = known
        # Con ventana, la persona ve a 8 mover el cursor; sin ventana (tests) no hace falta.
        self.cursor = cursor_enabled(not headless) if cursor is None else cursor
        if start not in self.apps:
            raise ValueError(f"app desconocida: {start}")
        self.on_call = on_call or self._llamada_simulada
        self.calls: list[str] = []
        self.seq = 0
        self._timeout = timeout_ms
        self.profile = Path(profile) if profile else None  # None: contexto de usar y tirar
        self._jobs: queue.Queue[tuple[Callable[[], Any], Future] | None] = queue.Queue()
        # Vista de 8 (#147, #154). core.connect pone on_frame, watching, session y lo que sigue;
        # sin núcleo no se emite nada.
        self.on_frame: Callable[[dict[str, Any]], Any] | None = None
        self.watching: Callable[[], int] = lambda: 0
        self.session: str | None = None
        self.p8_render: Callable[[str], str | None] | None = None  # token -> valor (solo local)
        self.p8_render_text: Callable[[str], str] | None = None    # texto con tokens -> texto real
        self.p8_secrets: Callable[[], list[str]] = lambda: []     # valores de la bóveda y de confianza
        self.p8_check: Callable[[str], dict[str, Any]] | None = None  # el bloqueo final del núcleo
        self.frames = frames_enabled()
        self.frames_sent = 0
        self._vista: Vista8 | None = None
        self._frame: tuple[str, int, int] | None = None  # último fotograma del espejo sin enviar
        self._last_img: tuple[str, int, int] | None = None
        self._frame_at = 0.0
        self._sync_at = 0.0
        self._sync_force = True
        self._raw: dict[str, Any] | None = None        # último snapshot (valores reales, solo aquí)
        self._observed: dict[str, Any] | None = None   # lo que vio el modelo de él (tokens)
        self._refs_ok = False                          # los data-p8-ref de la página son los de ese snapshot
        self._over: dict[str, str] = {}                # lo que escribe 8 ahora, con tokens, por elemento
        self._extra_sel: dict[str, dict[str, str]] = {}  # por app: id de un campo del PDF -> selector
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
            self._ctx = self._open_context(headless, slow_mo_ms)
            self._ctx.set_default_timeout(self._timeout)
            if self.cursor:  # los ojos de 8 en cada página que se cargue
                self._ctx.add_init_script(script=INIT_SCRIPT)
            self._pages: dict[str, Any] = {}
            self.app = start
            for app in self.apps:  # una pestaña por app desde el principio (la persona entra en el ERP)
                self._page(app)
            self._page(start).bring_to_front()
        except BaseException as e:  # noqa: BLE001
            self._ready.set_exception(e)
            return
        self._ready.set_result(True)
        while True:
            if self._streaming():
                try:
                    job = self._jobs.get_nowait()
                except queue.Empty:
                    self._stream_tick()
                    continue
            else:
                self._stop_cast()
                try:
                    job = self._jobs.get(timeout=0.4)
                except queue.Empty:
                    continue
            if job is None:
                break
            fn, fut = job
            try:
                fut.set_result(fn())
            except BaseException as e:  # noqa: BLE001
                fut.set_exception(e)
            self._sync_force = True  # tras una acción o una lectura, la vista de 8 se vuelve a copiar
        self._stop_cast()
        if self._vista is not None:
            self._vista.close()
        self._ctx.close()
        if self._browser is not None:
            self._browser.close()
        self._pw.stop()

    def _open_context(self, headless: bool, slow_mo_ms: int) -> Any:
        """Con perfil, uno persistente: la sesión de Alba Core sigue en la siguiente ejecución.
        Si el perfil está en uso (otro agente abierto), uno de usar y tirar."""
        opts = {"viewport": dict(VIEWPORT), "locale": "es-ES"}
        self._browser = None
        if self.profile is not None:
            try:
                self.profile.mkdir(parents=True, exist_ok=True)
                return self._pw.chromium.launch_persistent_context(
                    str(self.profile), headless=headless, slow_mo=slow_mo_ms, **opts)
            except Exception as e:  # noqa: BLE001
                import sys
                print(f"priv8: perfil de Chromium {self.profile} no disponible ({type(e).__name__}); "
                      "sesión sin recordar", file=sys.stderr)
                self.profile = None
        self._browser = self._pw.chromium.launch(headless=headless, slow_mo=slow_mo_ms)
        return self._browser.new_context(**opts)

    def _call(self, fn: Callable[[], Any]) -> Any:
        fut: Future = Future()
        self._jobs.put((fn, fut))
        return fut.result(timeout=self._timeout / 1000 + 30)

    def _page(self, app: str) -> Any:
        page = self._pages.get(app)
        if page is None or page.is_closed():
            # El perfil persistente abre con una pestaña en blanco: se aprovecha.
            libres = [p for p in self._ctx.pages if p.url == "about:blank" and p not in self._pages.values()]
            page = libres[0] if libres else self._ctx.new_page()
            page.goto(self.apps[app] + HOME.get(app, "/"))
            self._pages[app] = page
        return page

    # ---- interfaz del núcleo (core/adapter.py) ----

    def snapshot(self) -> dict[str, Any]:
        def job() -> dict[str, Any]:
            page = self._page(self.app)
            page.wait_for_load_state("domcontentloaded")
            self._ocho_todos("modo", "leer")
            dom = page.evaluate(_SNAPSHOT_JS)
            elements = dom["elements"] + self._pdf_elements(page.url, dom)
            self._extra_sel[self.app] = {e["id"]: e["sel"] for e in elements[len(dom["elements"]):]}
            self.seq += 1
            raw = {"source": "web", "app": self.app, "screen": None, "url": page.url, "seq": self.seq,
                   "focus": dom["focus"], "system_dialog": None, "elements": elements}
            # La observación de este snapshot llega por on_core_event; hasta entonces, marcadores.
            # Si es la misma pantalla con los mismos elementos (p. ej. la lectura que hace la
            # confirmación), sigue valiendo la observación anterior: solo lleva tokens.
            misma = self._raw is not None and _firma(self._raw) == _firma(raw)
            if not misma:
                self._observed, self._over = None, {}
            elif self._observed is not None:
                self._observed = {**self._observed, "seq": raw["seq"]}
            self._raw, self._refs_ok = raw, True
            return raw
        return self._call(job)

    def _pdf_elements(self, url: str, dom: dict[str, Any]) -> list[dict[str, Any]]:
        """Lee el PDF adjunto en local (mismo origen) y lo emite como elementos del snapshot."""
        if not dom.get("pdfHref"):
            return []
        pdf_url = urljoin(url, dom["pdfHref"])
        if urlparse(pdf_url).netloc != urlparse(url).netloc:  # solo el adjunto de la propia app
            return []
        try:
            with urllib.request.urlopen(pdf_url, timeout=5) as r:
                campos = pdf_campos(pdf_texto(r.read()))
        except OSError:  # sin adjunto legible: la pantalla sale sin los campos del PDF
            return []
        n = len(dom["elements"])
        out = []
        for clave, _, sel in _PDF_CAMPOS:
            if clave not in campos or sel not in dom["pdfBounds"]:
                continue
            n += 1
            out.append({"id": f"e{n}", "role": "text", "label": _PDF_ETIQUETA[sel], "text": campos[clave],
                        "enabled": True, "bounds": dom["pdfBounds"][sel], "actions": [], "sel": "#" + sel})
        return out

    def perform(self, action: dict[str, Any]) -> dict[str, Any]:
        return self._call(lambda: self._perform(action))

    def _perform(self, a: dict[str, Any]) -> dict[str, Any]:
        from playwright.sync_api import Error as PwError, TimeoutError as PwTimeout

        op, target, text = a.get("op"), a.get("target"), a.get("text") or ""
        try:
            if op == "open_app":
                key = app_key(text, self.apps)
                if key is None:
                    return {"ok": False, "error": "target_no_encontrado"}
                self.app = key
                if not self._usable(key):  # funciona desde cualquier página, también una muerta
                    self._go_home(key)
                self._page(key).bring_to_front()
                return {"ok": True}
            page = self._page(self.app)
            if op == "back":
                # Nunca fuera de la app: si atrás sale de su origen o cae en una página que no
                # sale (p. ej. la pestaña en blanco del principio), a su pantalla de inicio.
                page.go_back()
                if not self._usable(self.app):
                    self._go_home(self.app)
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
                self._cursor(page, "tap", target, "Pulso")
                el.click()
                return {"ok": True}
            if op == "type":
                if not el.is_editable():
                    return {"ok": False, "error": "no_permitido"}
                if self._cursor(page, "type", target, "Escribo en"):
                    self._type_visible(el, text)
                el.fill(text)  # el valor final es siempre el mismo, con cursor o sin él
                self._cursor(page, "done")
                return {"ok": True}
            if op == "call":
                self._cursor(page, "tap", target, "Llamo a")
                numero = text or (el.input_value() if el.is_editable() else el.inner_text())
                self.calls.append(numero)
                return {"ok": bool(self.on_call(numero))}
            return {"ok": False, "error": "no_permitido"}
        except PwTimeout:
            return {"ok": False, "error": "timeout"}
        except PwError:
            return {"ok": False, "error": "otro"}

    # ---- vista de 8 en la consola (#147, #154), siempre en el hilo del navegador ----

    def _streaming(self) -> bool:
        if not self.frames or self.on_frame is None:
            return False
        try:
            return self.watching() > 0
        except Exception:  # noqa: BLE001
            return False

    def _stream_tick(self) -> None:
        """Sin trabajos pendientes y con alguien mirando: copia la pestaña activa, censurada, en
        la vista de 8 si ha cambiado, emite el espejo y deja al navegador atender un momento."""
        from playwright.sync_api import Error as PwError

        try:
            page = self._page(self.app)
            if self._vista is None:
                self._vista = Vista8(self._pw, VIEWPORT)
            if not self._vista.casting:
                self._frame = self._last_img = None
                self._vista.start_cast(self._on_cast, FRAME_QUALITY, FRAME_MAX_W, FRAME_MAX_H)
                self._sync_force = True
            if self._sync_force or time.monotonic() - self._sync_at > SYNC_EVERY_S:
                self._sync(page)
            self._flush()
            page.wait_for_timeout(FRAME_TICK_MS)
        except PwError:
            time.sleep(FRAME_TICK_MS / 1000)

    def _vista_activa(self) -> bool:
        return self._vista is not None and self._vista.casting

    def _sync(self, page: Any, force: bool = False) -> None:
        """Copia la pestaña de 8 en la vista de 8, censurada en el DOM (vista8.js) y tras el
        bloqueo final (vista.guard). Sin cambios en la página ni en la observación, no hace nada."""
        if self._vista is None:
            return
        force = force or self._sync_force
        self._sync_force = False
        self._sync_at = time.monotonic()
        obs = self._observed if (self._refs_ok and self._observed
                                 and (self._raw or {}).get("app") == self.app) else None
        args = {"force": force,
                "key": f"{self.app}|{(obs or {}).get('seq')}|{sorted(self._over.items())}",
                "obs": obs_map(obs), "sel": self._extra_sel.get(self.app, {}) if obs else {},
                "over": dict(self._over) if obs else {}}
        doc = page.evaluate(CENSOR_JS, args)
        if doc is None:
            return
        try:
            extra = list(self.p8_secrets() or [])
        except Exception:  # noqa: BLE001
            extra = []
        secrets = secrets_of(self._raw, obs, self._valor, extra)
        if not self._vista.write(doc, secrets, self.p8_check) and obs:
            # Algo no ha pasado el bloqueo final: otra vez solo con marcadores. Si tampoco pasa,
            # la vista se queda como estaba.
            doc = page.evaluate(CENSOR_JS, {**args, "force": True, "obs": {}, "sel": {}, "over": {}})
            if doc is not None:
                self._vista.write(doc, secrets, self.p8_check)
        paused = (obs or {}).get("paused")
        self._vista.call("velo", {"titulo": "8 mira a otro lado", "modo": "apartar",
                                  "texto": "Aquí escribes tú: la clave o el código no llegan al modelo."}
                         if paused else None)
        self._vista.call("aviso", None if obs else "8 aún no ha leído esta pantalla")

    def _valor(self, token: str) -> str | None:
        if self.p8_render is None:
            return None
        try:
            return self.p8_render(token)
        except Exception:  # noqa: BLE001
            return None

    def _stop_cast(self) -> None:
        if self._vista is not None:
            self._vista.stop_cast()

    def _on_cast(self, img: str, w: int, h: int) -> None:
        self._frame = self._last_img = (img, w, h)
        self._flush()

    def _flush(self) -> None:
        """Envía el último fotograma del espejo si toca (FRAME_FPS como mucho): gana el último."""
        if self._frame is None or not self._vista_activa() or self.on_frame is None:
            return
        now = time.monotonic()
        if now - self._frame_at < 1 / FRAME_FPS:
            return
        img, w, h = self._frame
        if not w or not h:
            return
        self._frame, self._frame_at = None, now
        page = self._pages.get(self.app)
        try:
            self.on_frame({"app": self.app, "w": w, "h": h, "img": img, "mime": "image/jpeg", "vista": "8",
                           "where": {"url": page.url if page is not None else None}})
            self.frames_sent += 1
        except Exception:  # noqa: BLE001 - la consola nunca para al agente
            pass

    # ---- 8 en la ventana y en la vista de 8 (#135, #154) ----

    def _ocho(self, page: Any, method: str, args: Any) -> Any:
        """window.__p8ocho[method](args) en una página real (lo instala si aún no está)."""
        r = page.evaluate(CALL_JS, [method, args])
        if r == "falta":
            page.evaluate(INSTALL_JS)
            r = page.evaluate(CALL_JS, [method, args])
        return r

    def _ocho_todos(self, method: str, real: Any, vista: Any = None) -> None:
        """Lo mismo en la ventana real (con `real`) y en la vista de 8 (con `vista`, o `real`).
        Solo es pantalla: si falla, sigue todo igual."""
        from playwright.sync_api import Error as PwError

        if self.cursor:
            try:
                self._ocho(self._page(self.app), method, real)
            except PwError:
                pass
        if self._vista_activa():
            try:
                self._vista.call(method, real if vista is None else vista)
            except PwError:
                pass

    def note_action(self, a: dict[str, Any]) -> None:
        """Lo que escribió el modelo para la acción que viene (con tokens), antes de perform():
        la vista de 8 enseña eso en el campo, nunca el valor rehidratado."""
        if a.get("op") == "type" and a.get("target") and a.get("text") is not None:
            self._over[str(a["target"])] = str(a["text"])
            self._sync_force = True

    def on_core_event(self, msg: dict[str, Any]) -> None:
        """Canal de eventos del núcleo (en el mismo proceso): la observación de cada snapshot
        y lo que hace 8, para su cara y sus bocadillos. Nunca para al núcleo."""
        try:
            self._on_core_event(msg)
        except Exception:  # noqa: BLE001
            pass

    def _on_core_event(self, msg: dict[str, Any]) -> None:
        kind = msg.get("type")
        if kind == "screen" and msg.get("session") == self.session:
            obs, raw = msg.get("observed") or {}, msg.get("raw") or {}
            if raw.get("source") == "web" and raw.get("seq") == self.seq:
                self._observed = obs
                self._sync_force = True
            return
        if kind != "audit":
            return
        ev = msg.get("event") or {}
        if ev.get("session") != self.session:
            return
        k, d, saw = ev.get("kind"), ev.get("detail") or "", ev.get("model_saw")
        paso = re.search(r"paso\s+\d+", d)
        if k == "observe_sent":
            self._later(lambda: self._ocho_todos("modo", "pensar"))
        elif k == "task":
            if saw and "razona" in d:
                self._decir(corto(saw), "8 piensa", "neutro", "hablar", 5200)
            elif saw and paso and not _ES_LLAMADA.match(saw):
                self._decir(corto(saw, 170), "8 responde", "seguro", "listo", 7000)
            elif re.match(r"^fin\b", d):
                self._later(lambda: self._ocho_todos("modo", "listo"))
            elif "inicio" in d and not paso:
                self._later(lambda: self._ocho_todos("modo", "saludar"))
        elif k == "blocked":
            self._decir(BLOQUEO.get(ev.get("reason") or "", "No puedo hacer eso."), "Bloqueado", "bloqueo", "enfado", 5200)
        elif k == "held":
            self._decir("Espero tu confirmación en la consola.", "Antes de seguir", "aviso", "esperar", 9000)
        elif k == "approval":
            ok = bool(ev.get("approved_by"))
            self._decir("Aprobado. Sigo." if ok else "Rechazado. No lo hago.", None,
                        "seguro" if ok else "bloqueo", "asentir" if ok else "negar", 2600)
        elif k == "paused":
            self._later(lambda: self._ocho_todos("modo", "apartar"))

    def _decir(self, texto: str, eyebrow: str | None, tono: str, modo: str, ms: int) -> None:
        """Un bocadillo: en la ventana real con los valores (es la pantalla de la persona),
        en la vista de 8 con los tokens."""
        if not texto:
            return
        real = texto
        if self.p8_render_text is not None:
            try:
                real = self.p8_render_text(texto)
            except Exception:  # noqa: BLE001
                real = texto

        def job() -> None:
            self._ocho_todos("modo", modo)
            self._ocho_todos("di", {"texto": real, "eyebrow": eyebrow, "tono": tono, "ms": ms},
                             {"texto": texto, "eyebrow": eyebrow, "tono": tono, "ms": ms})
        self._later(job)

    def _later(self, fn: Callable[[], Any]) -> None:
        """Al hilo del navegador sin esperar (desde él mismo, ahora)."""
        if threading.current_thread() is self._thread:
            fn()
        else:
            self._jobs.put((fn, Future()))

    def _cursor(self, page: Any, op: str, target: str | None = None, verb: str | None = None) -> bool:
        """Lleva el cursor de 8 hasta `target` (o lo recoge con op='done'), en la ventana y en la
        vista de 8. Solo es pantalla: si algo falla, la acción sigue igual que sin cursor."""
        from playwright.sync_api import Error as PwError

        vista = self._vista_activa()
        if not self.cursor and not vista:
            return False
        try:
            if target:
                page.locator(f'[data-p8-ref="{target}"]').scroll_into_view_if_needed(timeout=1000)
            if op == "done":
                self._ocho_todos("done", None)
                return True
            if vista:  # el espejo al día antes de que su cursor vaya a un elemento suyo
                self._sync(page, force=True)
                try:
                    self._vista.call("go", {"op": op, "ref": target, "verb": verb, "nowait": True,
                                            "escribe": self._over.get(target or "") if op == "type" else None})
                except PwError:
                    pass
            if not self.cursor:
                return False
            return bool(self._ocho(page, "go", {"op": op, "ref": target, "verb": verb}))
        except PwError:
            return False

    @staticmethod
    def _type_visible(el: Any, text: str) -> None:
        """Teclea el principio de `text` letra a letra para que se vea escribir. Para en el primer
        salto de línea (un Enter podría enviar el formulario); fill() pone luego el valor entero."""
        from playwright.sync_api import Error as PwError

        visible = text.split("\n", 1)[0][:TYPE_VISIBLE]
        if not visible:
            return
        try:
            el.fill("")
            el.press_sequentially(visible, delay=max(8, min(45, TYPE_BUDGET_MS // len(visible))))
        except PwError:
            pass

    # ---- pantallas conocidas ----

    def _usable(self, app: str) -> bool:
        """La pestaña de `app` está en una pantalla de la app que sale al agente: su origen,
        con elementos data-p8 y, si hay `known`, con política."""
        page = self._page(app)
        if urlparse(page.url).netloc != urlparse(self.apps[app]).netloc:
            return False
        try:
            page.wait_for_load_state("domcontentloaded")
            page.wait_for_selector("[data-p8]", timeout=min(self._timeout, 2000))
        except Exception:  # noqa: BLE001  sin elementos marcados
            return False
        if self.known is None:
            return True
        # Mismo recorrido que snapshot(), sin contar seq: los ids del DOM no cambian.
        elements = page.evaluate(_SNAPSHOT_JS)["elements"]
        if app == (self._raw or {}).get("app"):
            self._refs_ok = False  # los ids de la página ya no son los del último snapshot
        return bool(elements) and bool(self.known({"source": "web", "app": app, "screen": None,
                                                   "url": page.url, "elements": elements}))

    def _go_home(self, app: str) -> None:
        """Pantalla de inicio de `app`. La sesión de Alba Core vive en el almacenamiento de la
        app, así que navegar no la cierra."""
        page = self._page(app)
        page.goto(self.apps[app] + HOME.get(app, "/"))
        try:
            page.wait_for_selector("[data-p8]", timeout=self._timeout)
        except Exception:  # noqa: BLE001  la pantalla saldrá como esté
            pass

    def recover(self) -> bool:
        """El núcleo no tiene política para la pantalla: si la pestaña activa no está en una
        pantalla conocida, a la de inicio de su app. True si la ha movido."""
        def job() -> bool:
            if self._usable(self.app):
                return False
            self._go_home(self.app)
            return True
        return self._call(job)

    def reset_view(self) -> None:
        """Estado de partida de cada encargo (lo llama el bucle, no es una herramienta del
        modelo): cada app en su pantalla de inicio y la pestaña de `start` delante."""
        def job() -> None:
            for app in self.apps:
                self._go_home(app)
            self.app = self.start
            self._page(self.start).bring_to_front()
        self._call(job)

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

    def wait_until_logged_in(self, app: str = "alba-core", timeout_s: float = 300) -> bool:
        """Espera a que la persona entre en `app` (su URL deja de ser /login). La clave es roja:
        la escribe la persona en la ventana de Chromium, nunca el agente."""
        import time

        def on_login() -> bool:
            page = self._page(app)
            if on_login_screen(self._settled_url(page)):
                page.bring_to_front()
                return True
            return False

        end = time.monotonic() + timeout_s
        while time.monotonic() < end:
            if not self._call(on_login):
                self._call(lambda: self._page(self.app).bring_to_front())
                return True
            time.sleep(1)
        return False

    def logged_in(self, app: str = "alba-core") -> bool:
        """`app` ya tiene la sesión abierta (recordada en el perfil o la de la demo), sin esperar."""
        return self._call(lambda: not on_login_screen(self._settled_url(self._page(app))))

    def _settled_url(self, page: Any) -> str:
        """URL una vez la app ha pintado: el ERP lleva a /login al arrancar si no hay sesión."""
        try:
            page.wait_for_selector("[data-p8]", timeout=self._timeout)
        except Exception:  # noqa: BLE001  sin elementos marcados: vale la URL que haya
            pass
        return page.url

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
