"""Graba la consola reproduciendo un feed del trámite B2B (#45, #54).

    uv run python scripts/grabar_consola.py sin-protocolo     # make video-sin-protocolo
    uv run python scripts/grabar_consola.py con-protocolo     # make video-con-protocolo

Levanta la consola (Vite) en un puerto propio, abre ?feed=NOMBRE en Chromium de
Playwright con recordVideo y espera al mensaje final del feed. El vídeo queda en
docs/entregables/video/NOMBRE.webm y, si hay ffmpeg, también en .mp4 (recortando la
carga de la página). Con --frames DIR guarda capturas durante la grabación para revisarla.
Los feeds salen de `make sin-protocolo` (metrics/feeds.py).
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CONSOLE = ROOT / "apps" / "console"
OUT = ROOT / "docs" / "entregables" / "video"
PORT = 5179
ANCHO, ALTO = 1440, 900
CAPTURAS = (6, 14, 22, 30)  # segundos de la grabación en que se guarda una captura
CIERRE_S = 3.5               # se queda en la pantalla final antes de cortar


def servir() -> subprocess.Popen:
    proc = subprocess.Popen(["pnpm", "exec", "vite", "--port", str(PORT), "--strictPort", "--host", "127.0.0.1"],
                            cwd=CONSOLE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/", timeout=1)
            return proc
        except OSError:
            if proc.poll() is not None:
                sys.exit(f"Vite no arranca en :{PORT} (¿pnpm install en apps/console?)")
            time.sleep(0.2)
    proc.terminate()
    sys.exit(f"Vite no responde en :{PORT}")


def grabar(feed: str, frames: Path | None, tmp: Path) -> tuple[Path, float]:
    """Devuelve el webm crudo de Playwright y el segundo en que la consola ya está pintada."""
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": ANCHO, "height": ALTO}, color_scheme="dark",
                                  record_video_dir=str(tmp), record_video_size={"width": ANCHO, "height": ALTO})
        t0 = time.monotonic()
        page = ctx.new_page()
        page.goto(f"http://127.0.0.1:{PORT}/?feed={feed}")
        page.wait_for_selector(".modo")
        page.evaluate("document.fonts.ready")
        inicio = time.monotonic() - t0
        pendientes = list(CAPTURAS)
        while not page.evaluate("window.__p8FeedFin === true"):
            t = time.monotonic() - t0 - inicio
            if frames and pendientes and t >= pendientes[0]:
                page.screenshot(path=str(frames / f"{feed}-{pendientes.pop(0):02d}s.png"))
            if t > 120:
                sys.exit("El feed no termina: ¿falta el mensaje fin? (make sin-protocolo)")
            page.wait_for_timeout(100)
        page.wait_for_timeout(CIERRE_S * 1000)
        if frames:
            page.screenshot(path=str(frames / f"{feed}-fin.png"))
        video = Path(page.video.path())
        ctx.close()
        browser.close()
    return video, inicio


def codificar(crudo: Path, inicio: float, feed: str) -> list[Path]:
    OUT.mkdir(parents=True, exist_ok=True)
    webm, mp4 = OUT / f"{feed}.webm", OUT / f"{feed}.mp4"
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        shutil.copy(crudo, webm)
        return [webm]
    corte = ["-ss", f"{max(inicio - 0.1, 0):.2f}", "-i", str(crudo), "-an", "-r", "25"]
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", *corte, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36",
                    "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", str(webm)], check=True)
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", *corte, "-c:v", "libx264", "-preset", "slow", "-crf", "24",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)], check=True)
    return [webm, mp4]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("feed", choices=["sin-protocolo", "con-protocolo"])
    ap.add_argument("--frames", type=Path, help="carpeta donde guardar capturas durante la grabación")
    a = ap.parse_args()
    if not (CONSOLE / "public" / f"{a.feed}.json").exists():
        sys.exit(f"Falta apps/console/public/{a.feed}.json: make sin-protocolo")
    if a.frames:
        a.frames.mkdir(parents=True, exist_ok=True)
    server = servir()
    try:
        with tempfile.TemporaryDirectory() as tmp:
            crudo, inicio = grabar(a.feed, a.frames, Path(tmp))
            salidas = codificar(crudo, inicio, a.feed)
    finally:
        server.terminate()
    for f in salidas:
        print(f"{f.relative_to(ROOT)} - {f.stat().st_size / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
