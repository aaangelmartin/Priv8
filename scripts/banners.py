"""Genera los gráficos de los README con la marca de priv8.es.

Plantilla: brand/banner/fuente/plantilla.html. Cada vista se saca a PNG a doble resolución con el Chromium de
Playwright. Las fuentes (Sora, IBM Plex) se cargan de Google Fonts, así que necesita red.

    uv run python scripts/banners.py            # todos
    uv run python scripts/banners.py hero pie   # solo esos

Si Pillow está instalado (`uv run --with pillow ...`), los PNG se reducen a paleta para que pesen menos.
"""

from __future__ import annotations

import asyncio
import re
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlencode

from playwright.async_api import async_playwright

RAIZ = Path(__file__).resolve().parent.parent
PLANTILLA = RAIZ / "brand/banner/fuente/plantilla.html"

# nombre: (archivo de salida, parámetros de la vista)
GRAFICOS: dict[str, tuple[str, dict[str, str]]] = {
    "hero": ("brand/banner/readme.png", {"v": "hero"}),
    "pie": ("brand/banner/pie.png", {"v": "pie"}),
    "flujo": ("docs/img/como-funciona.png", {"v": "flujo"}),
    "clases": ("docs/img/clases.png", {"v": "clases"}),
    "verticales": ("docs/img/verticales.png", {"v": "verticales"}),
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
    )
    pagina = destino / "plantilla.html"
    pagina.write_text(html)
    return pagina


def _paleta(png: Path) -> None:
    try:
        from PIL import Image
    except ImportError:
        return
    img = Image.open(png).convert("RGBA")
    img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(png, optimize=True)


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
    pedidos = sys.argv[1:] or list(GRAFICOS)
    desconocidos = [n for n in pedidos if n not in GRAFICOS]
    if desconocidos:
        sys.exit("No existe: " + ", ".join(desconocidos) + "\nHay: " + ", ".join(GRAFICOS))
    asyncio.run(main(pedidos))
