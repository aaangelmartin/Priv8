"""Comprueba un registro de auditoría firmado.

    python -m core.verify audit/replay.jsonl [--pub audit/priv8.pub]
"""

import sys

from core.audit import main

if __name__ == "__main__":
    sys.exit(main(["verify", *sys.argv[1:]]))
