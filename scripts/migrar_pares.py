"""Pasa las sesiones grabadas del formato anterior a pares de fotogramas (#187).

    uv run python scripts/migrar_pares.py                          # todas las de apps/console/public
    uv run python scripts/migrar_pares.py apps/console/public/sesion-b2b.json

Antes, una sesión web llevaba la vista de 8 y la pestaña real en dos listas sueltas, cada una a
su ritmo, y la consola podía enseñar una más nueva que la otra. Ahora van juntas en `pares`
(casos_comun.py). Esta orden empareja cada fotograma real con el de la vista de 8 más cercano en
el tiempo (casos_comun.migrar), comprueba el resultado (casos_comun.pares_incoherentes) y
reescribe el JSON; los JPEG no cambian. Las sesiones que ya tienen pares, las de Android y las
provisionales sin fotogramas se quedan como están. La consola hace lo mismo al reproducir una
grabación antigua sin migrar (apps/console/src/reproductor.js).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from casos_comun import migrar, pares_incoherentes  # noqa: E402

PUBLIC = HERE.parent / "apps" / "console" / "public"


def main(argv: list[str]) -> int:
    rutas = [Path(a) for a in argv] or sorted(PUBLIC.glob("sesion-*.json"))
    for ruta in rutas:
        d = json.loads(ruta.read_text(encoding="utf-8"))
        nueva = migrar(d)
        if nueva is d:
            print(f"{ruta.name}: sin cambios", file=sys.stderr)
            continue
        fallo = pares_incoherentes(nueva)
        if fallo is not None:
            sys.exit(f"{ruta.name}: los pares no casan ({fallo}); no se toca")
        texto = json.dumps(nueva, ensure_ascii=False, separators=(",", ":"))
        ruta.write_text(texto + "\n", encoding="utf-8")
        print(f"{ruta.name}: {len(nueva['pares'])} pares", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
