"""Saca el PDF de la presentación del jurado desde la página /pitch de la landing.

Sirve apps/landing/dist en un puerto libre, abre /pitch/?pdf con el Chromium de Playwright sin ventana (todas las
diapositivas una debajo de otra, en su estado final y con menos movimiento) y lo imprime a 1920 x 1080, una
diapositiva por página. El anexo va al final. Las fuentes vienen de Google Fonts, así que necesita red.

    make pitch-pdf                                         # construye la landing y saca el PDF
    uv run python scripts/pitch_pdf.py                     # solo el PDF, con el dist que haya
    uv run python scripts/pitch_pdf.py --shots /tmp/pitch  # además, un PNG de cada diapositiva
"""

from __future__ import annotations

import argparse
import asyncio
import functools
import http.server
import socket
import threading
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "apps" / "landing" / "dist"
OUT = ROOT / "docs" / "entregables" / "priv8-presentacion.pdf"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def serve(port: int) -> http.server.ThreadingHTTPServer:
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args: object) -> None:  # sin una línea por petición
            pass

    handler = functools.partial(Quiet, directory=str(DIST))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


async def main(out: Path, shots: Path | None) -> None:
    if not (DIST / "pitch" / "index.html").exists():
        raise SystemExit("Falta apps/landing/dist/pitch: ejecuta antes `pnpm build` en apps/landing (o `make pitch-pdf`).")
    port = free_port()
    srv = serve(port)
    base = f"http://127.0.0.1:{port}/pitch/"
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await browser.new_context(viewport={"width": 1920, "height": 1080}, reduced_motion="reduce")
            page = await ctx.new_page()
            await page.goto(base + "?pdf", wait_until="networkidle")
            await page.evaluate("document.fonts.ready")
            # los ojos de 8 se montan cuando las fuentes están listas: se espera a que haya uno en cada hueco
            await page.wait_for_function(
                "[...document.querySelectorAll('.e8')].every((e) => e.querySelector('svg'))", timeout=15000
            )
            await page.wait_for_timeout(600)
            n = await page.locator("section.slide").count()
            out.parent.mkdir(parents=True, exist_ok=True)
            await page.pdf(path=str(out), width="1920px", height="1080px", print_background=True, prefer_css_page_size=True)
            print(f"{out}: {n} diapositivas")
            if shots:
                shots.mkdir(parents=True, exist_ok=True)
                live = await ctx.new_page()
                for i in range(1, n + 1):
                    await live.goto(f"{base}#{i}", wait_until="networkidle")
                    await live.reload(wait_until="networkidle")
                    await live.evaluate("document.fonts.ready")
                    await live.wait_for_timeout(3000)
                    await live.screenshot(path=str(shots / f"diapositiva-{i:02d}.png"))
                print(f"{n} capturas en {shots}")
            await browser.close()
    finally:
        srv.shutdown()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=OUT, help="ruta del PDF")
    ap.add_argument("--shots", type=Path, default=None, help="carpeta para un PNG de cada diapositiva")
    a = ap.parse_args()
    asyncio.run(main(a.out.resolve(), a.shots.resolve() if a.shots else None))
