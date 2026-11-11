"""Vista de 8 (#154): la pantalla que maneja 8, censurada en el DOM, para la consola.

La consola ya no recibe píxeles de la pestaña real. El adaptador mantiene una segunda
página, la *vista de 8*, en un Chromium aparte y sin ventana que el agente nunca navega:

    pestaña real ──(vista8.js: clona y censura la copia)──▶ HTML censurado
        ──(bloqueo final: guard)──▶ página espejo ──(captura, junto a la pestaña real)──▶ par

1. vista8.js se ejecuta en la pestaña real (que ya tiene los valores) y trabaja sobre un
   clon: cada elemento data-p8 lleva el texto que leyó el modelo (tokens en lo ámbar,
   «nunca sale» en lo rojo); lo que aún no ha leído y el texto sin marcar que el modelo no
   recibió salen como marcador neutro; imágenes y campos sin marcar, vacíos.
2. guard() mira todo el texto que queda: ningún valor de la bóveda ni de la semilla de
   confianza, y el mismo bloqueo final que las peticiones al modelo. Si algo no pasa, esa
   copia no se escribe y la vista se queda como estaba.
3. Solo entonces el HTML entra en la página espejo (sin scripts: no se ejecuta nada) con
   las mismas hojas de estilo (base href), el desplazamiento y el cursor de 8.

Así el valor real no existe en la vista de 8 en ningún momento: lo que llega a la página
espejo ya está censurado, y lo que se emite a la consola es esa página.
"""

from __future__ import annotations

import base64
import re
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

CENSOR_JS = (HERE / "vista8.js").read_text(encoding="utf-8")
_CURSOR_SRC = (HERE / "cursor8.js").read_text(encoding="utf-8")
_ENGINE = ROOT / "apps" / "console" / "src" / "eight" / "engine.js"
_FONTS = ROOT / "docs" / "entregables" / "fonts"
# Familias propias, para no tocar las fuentes de la app en la que se pinta.
_FONT_FILES = (("P8 Sora", 700, "sora-latin-700-normal.woff2"),
               ("P8 Plex Sans", 400, "ibm-plex-sans-latin-400-normal.woff2"),
               ("P8 Plex Sans", 600, "ibm-plex-sans-latin-600-normal.woff2"),
               ("P8 Plex Mono", 500, "ibm-plex-mono-latin-500-normal.woff2"),
               ("P8 Plex Mono", 600, "ibm-plex-mono-latin-600-normal.woff2"))


def _install_js() -> str:
    """() => {...}: el motor de los ojos, las fuentes y cursor8.js, listo para evaluar."""
    engine = _ENGINE.read_text(encoding="utf-8").replace("export function createEngine", "function createEngine", 1)
    engine = engine.replace("var FONT='Sora,", "var FONT='\"P8 Sora\", Sora,", 1)
    fonts = []
    for fam, peso, nombre in _FONT_FILES:
        p = _FONTS / nombre
        if p.exists():
            fonts.append(f'["{fam}", {peso}, "{base64.b64encode(p.read_bytes()).decode()}"]')
    return ("() => {\n" + engine + "\nconst FONTS = [" + ",".join(fonts) + "];\n"
            "return (" + _CURSOR_SRC.strip().rstrip(";") + ")(createEngine, FONTS);\n}")


INSTALL_JS = _install_js()
INIT_SCRIPT = "(" + INSTALL_JS + ")()"

# Llama a window.__p8ocho[metodo](args); 'falta' si la página aún no lo tiene instalado.
CALL_JS = "([m, a]) => (window.__p8ocho ? window.__p8ocho[m](a) : 'falta')"

# Lo que se añade a la página espejo: cómo se ven los tokens, «nunca sale» y los marcadores.
VISTA_CSS = """
<style id="p8-vista">
  .p8-tok { font: 600 .86em/1.35 "P8 Plex Mono", "IBM Plex Mono", ui-monospace, monospace !important;
            background: #E4E9FD !important; color: #2236B5 !important; border-radius: 6px; padding: .06em .42em;
            white-space: nowrap; letter-spacing: 0 !important; text-transform: none !important;
            /* nunca se sale de su caja: en una pequeña (un avatar) se recorta con puntos suspensivos */
            display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom;
            box-sizing: border-box }
  .p8-nunca { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom;
              box-sizing: border-box }
  .p8-nunca { font: 600 .82em/1.35 "P8 Plex Mono", "IBM Plex Mono", ui-monospace, monospace !important;
              color: #A83228 !important; background: repeating-linear-gradient(135deg, #FBE5E3 0 6px, #F7D7D3 6px 12px) !important;
              border-radius: 6px; padding: .08em .5em; white-space: nowrap; text-transform: none !important }
  /* un dato tapado: una barra suave del color del texto, del mismo tamaño que el texto */
  .p8-x { position: relative; display: inline-block; vertical-align: baseline; line-height: inherit; white-space: nowrap; max-width: 100%; overflow: hidden;
          color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important;
          background: none !important; user-select: none; letter-spacing: -.02em }
  .p8-x::after { content: ""; position: absolute; left: 1px; right: 1px; top: 50%; height: .9em; transform: translateY(-46%);
                 border-radius: 999px; background: var(--p8c, #0B1B33); opacity: .17 }
  .p8-media { background: rgba(90, 100, 120, .12) !important; border-radius: 6px; vertical-align: middle }
  input[data-p8-c="ambar"], textarea[data-p8-c="ambar"] { color: #2236B5 !important; background-color: #EEF1FE !important;
            font-family: "P8 Plex Mono", "IBM Plex Mono", ui-monospace, monospace !important }
  input[data-p8-c="rojo"], textarea[data-p8-c="rojo"] { color: #A83228 !important; background-color: #FBE5E3 !important;
            font-family: "P8 Plex Mono", "IBM Plex Mono", ui-monospace, monospace !important }
  [data-p8-focus] { outline: 2px solid #2D45D6 !important; outline-offset: 2px }
  * { caret-color: transparent !important; scrollbar-width: none !important }
  ::-webkit-scrollbar { display: none !important }
</style>
"""

# Escribe en la página espejo un documento ya censurado (nunca ejecuta nada: sin scripts).
APPLY_JS = r"""
(d) => {
  const set = (el, attrs) => {
    for (const a of [...el.attributes]) if (!(a.name in attrs)) el.removeAttribute(a.name)
    for (const [k, v] of Object.entries(attrs)) { try { el.setAttribute(k, v) } catch {} }
  }
  if (window.__p8head !== d.head + d.base) {
    document.head.innerHTML = '<meta charset="utf-8">' + d.head + d.css
    const b = document.createElement('base')
    b.href = d.base
    document.head.prepend(b)
    window.__p8head = d.head + d.base
  }
  set(document.documentElement, d.htmlAttrs)
  set(document.body, d.bodyAttrs)
  const t = document.createElement('template')
  t.innerHTML = d.body
  document.body.replaceChildren(t.content)
  scrollTo(d.sx, d.sy)
  for (const el of document.querySelectorAll('[data-p8-scroll]')) {
    const [top, left] = el.getAttribute('data-p8-scroll').split(',').map(Number)
    el.scrollTop = top
    el.scrollLeft = left
  }
  // Las barras de lo tapado, del color del texto que tapan.
  for (const x of document.querySelectorAll('.p8-x')) {
    if (x.parentElement) x.style.setProperty('--p8c', getComputedStyle(x.parentElement).color)
  }
  return true
}
"""

BLANK = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>"

_TOKEN = re.compile(r"‹[^›]{1,80}›")
MIN_SECRET = 4  # valores más cortos (un «1», «Sí») no se buscan: casarían con cualquier cosa


def obs_map(observed: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    """{id: {cls, text, label}} de una observación: solo lo que recibió el modelo (tokens)."""
    out: dict[str, dict[str, Any]] = {}
    for el in (observed or {}).get("elements", []):
        out[el["id"]] = {"cls": el.get("cls", "verde"),
                         "text": None if el.get("cls") == "rojo" else el.get("text"),
                         "label": el.get("label")}
    return out


def secrets_of(raw: dict[str, Any] | None, observed: dict[str, Any] | None,
               render: Callable[[str], str | None] | None = None,
               extra: Iterable[str] = ()) -> set[str]:
    """Valores reales que nunca pueden aparecer en la vista de 8: el texto y la etiqueta
    reales de cada elemento ámbar o rojo, el valor de cada token que vio el modelo y los
    valores de confianza (la semilla)."""
    out: set[str] = set()
    vistos = {e["id"]: e for e in (observed or {}).get("elements", [])}
    for el in (raw or {}).get("elements", []):
        o = vistos.get(el.get("id"))
        if o is not None and o.get("cls", "verde") == "verde" and not el.get("password"):
            continue
        for k in ("text", "label"):  # sin observación cuenta como ámbar
            v = el.get(k)
            visto = (o or {}).get(k) if (o or {}).get("cls") != "rojo" or k == "label" else None
            if isinstance(v, str) and v.strip() and not (isinstance(visto, str) and v.strip() in visto):
                out.add(v.strip())
    if render is not None:
        for el in (observed or {}).get("elements", []):
            for tok in el.get("tokens") or []:
                v = render(tok)
                if v and v != tok:
                    out.add(v.strip())
    out.update(v.strip() for v in extra if isinstance(v, str))
    return {v for v in out if len(v) >= MIN_SECRET}


def tapar(partes: list[list[Any]], secrets: Iterable[str]) -> list[list[Any]]:
    """Las partes de texto de una máscara, con cada valor de `secrets` que aún contengan
    cambiado por un marcador (lo que el detector no reconoce: el texto real de lo ámbar)."""
    vals = sorted({v for v in secrets if len(v) >= MIN_SECRET}, key=len, reverse=True)
    if not vals:
        return partes
    pat = re.compile("|".join(re.escape(v) for v in vals), re.IGNORECASE)
    out: list[list[Any]] = []
    for k, v in partes:
        if k != "t":
            out.append([k, v])
            continue
        pos = 0
        for m in pat.finditer(v):
            if m.start() > pos:
                out.append(["t", v[pos:m.start()]])
            out.append(["x", m.end() - m.start()])
            pos = m.end()
        if pos < len(v):
            out.append(["t", v[pos:]])
    return out


def _squash(s: str) -> str:
    return re.sub(r"\s+", "", s).lower()


def guard(text: str, secrets: Iterable[str], check: Callable[[str], dict[str, Any]] | None = None) -> str | None:
    """Bloqueo final de la vista de 8. None si puede salir; si no, el motivo (sin el valor)."""
    plano = _squash(text)
    for v in secrets:
        if v in text or (len(_squash(v)) >= MIN_SECRET and _squash(v) in plano):
            return "valor real"
    if check is not None:
        sin_tokens = _TOKEN.sub(" ", text)  # los tokens ya son lo que recibe el modelo
        verdict = check(sin_tokens)
        if not verdict.get("allowed", True):
            return "patrón: " + ", ".join(verdict.get("findings") or [])
    return None


class Vista8:
    """La página espejo, en su propio Chromium sin ventana. Todo en el hilo del navegador."""

    def __init__(self, pw: Any, viewport: dict[str, int], scale: float = 1.5) -> None:
        self._browser = pw.chromium.launch(headless=True)
        self._ctx = self._browser.new_context(viewport=dict(viewport), device_scale_factor=scale, locale="es-ES",
                                              java_script_enabled=True)
        self.page = self._ctx.new_page()
        self.page.set_content(BLANK)
        self.page.evaluate(INSTALL_JS)
        self.url: str | None = None
        self.writes = 0
        self.blocked = 0
        self.last_block: str | None = None

    def write(self, doc: dict[str, Any], secrets: Iterable[str],
              check: Callable[[str], dict[str, Any]] | None = None) -> bool:
        """Escribe en el espejo una copia censurada si pasa el bloqueo final."""
        motivo = guard(doc.get("text") or "", secrets, check)
        if motivo is not None:
            self.blocked += 1
            self.last_block = motivo
            return False
        if self.page.viewport_size != {"width": doc["w"], "height": doc["h"]} and doc.get("w") and doc.get("h"):
            self.page.set_viewport_size({"width": int(doc["w"]), "height": int(doc["h"])})
        m = re.match(r"^(https?://[^/]+)", doc.get("url") or "")
        base = (m.group(1) if m else "http://127.0.0.1") + "/"
        self.page.evaluate(APPLY_JS, {"head": doc["head"], "body": doc["body"], "htmlAttrs": doc["htmlAttrs"],
                                      "bodyAttrs": doc["bodyAttrs"], "sx": doc["sx"], "sy": doc["sy"],
                                      "base": base, "css": VISTA_CSS})
        self.url = doc.get("url")
        self.writes += 1
        return True

    def call(self, method: str, args: Any) -> Any:
        r = self.page.evaluate(CALL_JS, [method, args])
        if r == "falta":
            self.page.evaluate(INSTALL_JS)
            r = self.page.evaluate(CALL_JS, [method, args])
        return r

    def html(self) -> str:
        return self.page.content()

    def captura(self, quality: int) -> bytes:
        """JPEG de la página espejo tal como está (px CSS, del tamaño de la pestaña real). El
        adaptador lo toma justo después del de la pestaña real: los dos forman un par (#187)."""
        return self.page.screenshot(type="jpeg", quality=quality, scale="css", timeout=3000)

    def close(self) -> None:
        try:
            self._ctx.close()
            self._browser.close()
        except Exception:  # noqa: BLE001
            pass
