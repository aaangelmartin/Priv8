"""Genera apps/inbox-sim/public/factura-octubre.pdf desde data/seed.json (correo 9, adjunto).

PDF mínimo escrito a mano (sin dependencias): una página, Helvetica, texto sin comprimir.

    uv run python scripts/make_invoice_pdf.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "inbox-sim" / "public" / "factura-octubre.pdf"


def _esc(s: str) -> bytes:
    return s.encode("cp1252").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def build(a: dict) -> bytes:
    lineas = [
        ("FACTURA", 20),
        (f"Proveedor: {a['proveedor']}", 12),
        (f"CIF: {a['cif']}", 12),
        (f"Numero: {a['numero']}", 12),
        (f"Fecha: {a['fecha']}", 12),
        (f"Su pedido: {a['pedido']}", 12),
        (f"Base imponible: {a['base']}", 12),
        (f"IVA 21 %: {a['iva']}", 12),
        (f"Total: {a['importe']}", 14),
    ]
    stream, y = b"BT\n", 780
    for texto, size in lineas:
        stream += b"/F1 %d Tf 1 0 0 1 56 %d Tm (" % (size, y) + _esc(texto) + b") Tj\n"
        y -= size + 14
    stream += b"ET"
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    out, offs = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offs)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return out


if __name__ == "__main__":
    seed = json.loads((ROOT / "data" / "seed.json").read_text(encoding="utf-8"))
    adj = next(m for m in seed["correo"]["mensajes"] if m["id"] == 9)["adjunto"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(build(adj))
    print(f"escrito {OUT.relative_to(ROOT)}")
