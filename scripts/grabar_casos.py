"""Graba de una vez todos los casos de la demo (#187): `make grabar-casos`.

    uv run python scripts/grabar_casos.py                 # B2B y B2C
    uv run python scripts/grabar_casos.py --solo b2b      # solo B2B (sin emulador)
    uv run python scripts/grabar_casos.py --solo b2c      # solo B2C (emulador listo)

B2B: cada caso de data/casos.json con scripts/grabar_sesion.py --caso ID (Alba Core y el
correo reales en 5193 y 5194, Chromium con ventana, eventos en 8792). B2C: scripts/grabar_movil.py
(el emulador, con 8700 y 8765 libres). Los casos con respuestas grabadas no gastan API; los
demás usan el .env y guardan sus respuestas para la próxima vez. Al acabar, `make casos-provisionales`
ya no toca los casos grabados de verdad.

Los casos B2B «Registrar la factura» y «Contestar al proveedor» salen además, recortados, de la
sesión completa (make grabar-sesion): esta orden graba cada uno por separado.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from casos_comun import grabables  # noqa: E402

ROOT = HERE.parent


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--solo", choices=["b2b", "b2c"])
    ap.add_argument("--env-file", default=str(ROOT / ".env"))
    ap.add_argument("--aprueba-sola", action="store_true", help="B2C: aprueba desde el canal, sin tocar el móvil")
    a = ap.parse_args()
    fallos = []
    if a.solo in (None, "b2b"):
        for c in grabables("b2b"):
            print(f"\n== {c['id']}: {c['titulo']} ==", file=sys.stderr, flush=True)
            r = subprocess.run([sys.executable, str(HERE / "grabar_sesion.py"), "--caso", c["id"], "--env-file", a.env_file],
                               cwd=ROOT)
            if r.returncode:
                fallos.append(c["id"])
    if a.solo in (None, "b2c"):
        print("\n== B2C en el emulador ==", file=sys.stderr, flush=True)
        cmd = [sys.executable, str(HERE / "grabar_movil.py"), "--env-file", a.env_file]
        if a.aprueba_sola:
            cmd.append("--aprueba-sola")
        if subprocess.run(cmd, cwd=ROOT).returncode:
            fallos.append("b2c")
    if fallos:
        print(f"\nSin grabar: {', '.join(fallos)}", file=sys.stderr)
        return 1
    print("\nTodos los casos grabados en apps/console/public/sesion-*.json", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
