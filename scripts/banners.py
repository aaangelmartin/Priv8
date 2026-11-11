"""Genera los gráficos de los README con la marca de priv8.es.

Plantilla: brand/banner/fuente/plantilla.html. Cada vista se saca a PNG a doble resolución con el Chromium de
Playwright. Las fuentes (Sora, IBM Plex) se cargan de Google Fonts, así que necesita red.

    uv run python scripts/banners.py              # todos
    uv run python scripts/banners.py hero pie     # solo esos
    uv run python scripts/banners.py --capturas   # antes, saca de nuevo las capturas de las apps

Las capturas de las apps reales (panel, consola, Alba Core y correo) se guardan en brand/banner/fuente/capturas/
y la plantilla las enmarca. `--capturas` arranca sus servidores de desarrollo en puertos libres (5281 a 5284), sin
núcleo ni agente, con Chromium sin ventana; necesita `pnpm install` en cada app.

Si Pillow está instalado (`uv run --with pillow ...`), los PNG se reducen a paleta para que pesen menos.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import socket
import subprocess
import sys
import time
import tempfile
from pathlib import Path
from urllib.parse import urlencode

from playwright.async_api import async_playwright

RAIZ = Path(__file__).resolve().parent.parent
PLANTILLA = RAIZ / "brand/banner/fuente/plantilla.html"
CAPTURAS = RAIZ / "brand/banner/fuente/capturas"

# nombre: (archivo de salida, parámetros de la vista)
GRAFICOS: dict[str, tuple[str, dict[str, str]]] = {
    "hero": ("brand/banner/readme.png", {"v": "hero"}),
    "pie": ("brand/banner/pie.png", {"v": "pie"}),
    "flujo": ("docs/img/como-funciona.png", {"v": "flujo"}),
    "clases": ("docs/img/clases.png", {"v": "clases"}),
    "verticales": ("docs/img/verticales.png", {"v": "verticales"}),
    "uso-instalar": ("docs/img/uso-instalar.png", {"v": "instalar"}),
    "uso-panel": ("docs/img/uso-panel.png", {"v": "panel"}),
    "uso-b2b": ("docs/img/uso-b2b.png", {"v": "b2b"}),
    "uso-b2c": ("docs/img/uso-b2c.png", {"v": "b2c"}),
    "uso-claude": ("docs/img/uso-claude.png", {"v": "claude"}),
}
# cabecera de cada README: carpeta, título, segunda línea y cara de 8
CABECERAS = [
    ("core", "Núcleo", "Detecta, tokeniza y decide.", "nove"),
    ("agent", "Agente", "observe, act, oracle.", "reposo"),
    ("voice", "Voz", "Las cifras, solo en local.", "reposo"),
    ("adapters/web", "Adaptador web", "El DOM, no los píxeles.", "reposo"),
    ("adapters/android", "Adaptador Android", "El árbol de accesibilidad.", "reposo"),
    ("apps/android-8", "8 en tu móvil", "Habla, mira y no ve.", "reposo"),
    ("apps/banks-sim", "Bancos simulados", "Alcor, Brezo y Nimbo.", "reposo"),
    ("apps/console", "Consola", "Lo que ve 8, en directo.", "nove"),
    ("apps/erp-sim", "Alba Core", "El ERP antiguo de la demo.", "reposo"),
    ("apps/inbox-sim", "Correo", "La factura del proveedor.", "reposo"),
    ("apps/landing", "priv8.es", "La web.", "reposo"),
    ("apps/mcp-site", "mcp.priv8.es", "Priv8 en tu Claude Code.", "reposo"),
    ("docs/contracts", "Contratos", "JSON Schema con ejemplos.", "reposo"),
]
for i, (carpeta, titulo, linea, cara) in enumerate(CABECERAS):
    GRAFICOS["cab-" + carpeta.replace("/", "-")] = (
        f"brand/banner/cabeceras/{carpeta.replace('/', '-')}.png",
        {"v": "cabecera", "t": titulo, "s": linea, "e": cara, "n": str(i * 3)},
    )


def _camino(svg: Path) -> str:
    return re.search(r' d="([^"]+)"', svg.read_text()).group(1)


def _dentro(svg: Path) -> str:
    return re.search(r"<svg[^>]*>(.*)</svg>", svg.read_text(), re.S).group(1)


def _pagina(destino: Path) -> Path:
    logo = RAIZ / "brand/logo"
    html = (
        PLANTILLA.read_text()
        .replace("__REPOSO__", _camino(logo / "8-reposo-blanco.svg"))
        .replace("__NOVE__", _camino(logo / "8-nove-blanco.svg"))
        .replace("__NUNCASALE__", _camino(logo / "8-nuncasale-blanco.svg"))
        .replace("__BY__", _dentro(RAIZ / "apps/landing/src/by-laaabs.svg"))
        .replace("__CAPTURAS__", CAPTURAS.as_uri())
    )
    pagina = destino / "plantilla.html"
    pagina.write_text(html)
    return pagina


# Capturas de las apps reales. Cada una: puerto, carpeta, variables de entorno, ruta, tamaño y qué hacer antes.
APPS = {
    "panel": (5281, "apps/panel", {}, "/", (1280, 1100)),
    "consola": (5282, "apps/console", {}, "/?demo", (1440, 900)),
    "alba": (5283, "apps/erp-sim", {"VITE_ALBA_SESION": "admin.alba"}, "/facturas/alta", (1280, 800)),
    "correo": (5284, "apps/inbox-sim", {}, "/", (1280, 800)),
}
# el panel sin servidor: su /api/estado con la demo B2B lista
ESTADO_PANEL = {"modo": "b2b", "fase": "listo", "motivo": "", "ocupado": "", "clave": True, "log": [],
                "piezas": {"alba": True, "correo": True, "consola": True, "agente": True,
                           "emulador": False, "puente": False}}


def _espera_puerto(puerto: int, segundos: float = 40) -> None:
    fin = time.time() + segundos
    while time.time() < fin:
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", puerto)) == 0:
                return
        time.sleep(0.3)
    raise RuntimeError(f"no arranca nada en {puerto}")


async def capturas() -> None:
    CAPTURAS.mkdir(parents=True, exist_ok=True)
    procs = []
    try:
        for nombre, (puerto, carpeta, env, _, _) in APPS.items():
            vite = RAIZ / carpeta / "node_modules/.bin/vite"
            if not vite.exists():
                sys.exit(f"Falta pnpm install en {carpeta}")
            procs.append(subprocess.Popen(
                [str(vite), "--port", str(puerto), "--strictPort", "--host", "127.0.0.1"],
                cwd=RAIZ / carpeta, env={**os.environ, **env, "BROWSER": "none"},
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        for puerto, *_ in APPS.values():
            _espera_puerto(puerto)
        async with async_playwright() as p:
            nav = await p.chromium.launch(headless=True)
            for nombre, (puerto, _, _, ruta, (w, h)) in APPS.items():
                pg = await nav.new_page(viewport={"width": w, "height": h}, device_scale_factor=2,
                                        reduced_motion="reduce")
                if nombre == "panel":
                    await pg.route("**/api/**", lambda r: r.fulfill(
                        status=200, content_type="application/json", body=json.dumps(ESTADO_PANEL)))
                await pg.goto(f"http://127.0.0.1:{puerto}{ruta}")
                await pg.wait_for_timeout(2500)
                destino = CAPTURAS / f"{nombre}.png"
                if nombre == "panel":
                    await pg.locator(".demos").screenshot(path=str(destino))
                elif nombre == "alba":
                    await pg.locator(".ventana").screenshot(path=str(destino))
                else:
                    if nombre == "correo":
                        await pg.get_by_text("Suministros Lumen").first.click()
                        await pg.wait_for_timeout(800)
                    if nombre == "consola":
                        await pg.wait_for_timeout(14000)
                    await pg.screenshot(path=str(destino))
                print(f"captura {destino.relative_to(RAIZ)}")
                await pg.close()
            await nav.close()
    finally:
        for pr in procs:
            pr.terminate()


def _paleta(png: Path) -> None:
    """Reduce el PNG a 256 colores (mediana sobre RGB) con la transparencia en dos niveles: pesa diez veces menos
    y los colores de marca no se desvían, que con la reducción por octree sí pasaba."""
    try:
        from PIL import Image
    except ImportError:
        return
    img = Image.open(png).convert("RGBA")
    alfa = img.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
    pal = img.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal.paste(255, mask=alfa.point(lambda a: 255 - a))
    lista = pal.getpalette()[: 255 * 3] + [0, 0, 0]
    pal.putpalette(lista)
    pal.info["transparency"] = 255
    pal.save(png, optimize=True, transparency=255)


async def main(nombres: list[str]) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        pagina = _pagina(Path(tmp))
        async with async_playwright() as p:
            nav = await p.chromium.launch()
            pg = await nav.new_page(viewport={"width": 1280, "height": 1000}, device_scale_factor=2)
            for nombre in nombres:
                salida, params = GRAFICOS[nombre]
                await pg.goto(pagina.as_uri() + "?" + urlencode(params))
                await pg.wait_for_function("window.__listo === true", timeout=20000)
                destino = RAIZ / salida
                destino.parent.mkdir(parents=True, exist_ok=True)
                await pg.locator("#v").screenshot(path=str(destino), omit_background=True)
                _paleta(destino)
                print(f"{salida}  {destino.stat().st_size // 1024} KB")
            await nav.close()


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--capturas" in args:
        args.remove("--capturas")
        asyncio.run(capturas())
    pedidos = args or list(GRAFICOS)
    desconocidos = [n for n in pedidos if n not in GRAFICOS]
    if desconocidos:
        sys.exit("No existe: " + ", ".join(desconocidos) + "\nHay: " + ", ".join(GRAFICOS))
    asyncio.run(main(pedidos))
