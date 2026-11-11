"""Línea telefónica simulada de Banca Alcor (#24): un IVR con menú por tonos.

Todo es inventado: el número, los menús y los nombres de los gestores. Solo
habla en texto (lo que en una llamada real sería el audio de la línea) y lo
que recibe son tonos (DTMF), voz y la orden de ceder la llamada.

    uv run python -m voice.ivr_alcor            # servicio local en :8711
    uv run python -m voice.ivr_alcor --port 9000

Rutas (JSON):
    POST /llamadas                  {"numero"}  → {"id", "texto"}
    POST /llamadas/<id>/tecla       {"tecla"}   → {"texto"}
    POST /llamadas/<id>/voz         {"texto"}   → {"texto"}
    POST /llamadas/<id>/esperar                 → {"texto"}
    POST /llamadas/<id>/ceder       {"a"}       → {"texto"}
    POST /llamadas/<id>/colgar                  → {"texto"}
    GET  /llamadas/<id>                         → estado y registro de la llamada
"""

from __future__ import annotations

import argparse
import itertools
import json
import threading
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

NUMERO = "900 811 811"  # inventado: la línea de atención de Banca Alcor
PORT = 8711

# Cada estado: lo que dice la línea, sus teclas (tecla → estado) y, si es una espera,
# cuántas veces se oye la música antes de pasar al siguiente estado.
MENUS: dict[str, dict[str, Any]] = {
    "inicio": {
        "texto": ("Bienvenido a Banca Alcor. Esta llamada puede ser grabada. "
                  "Para tarjetas, pulse 1. Para transferencias, pulse 2. "
                  "Para hablar con un gestor, pulse 3."),
        "teclas": {"1": "tarjetas", "2": "transferencias", "3": "gestor_espera"},
    },
    "tarjetas": {
        "texto": ("Tarjetas. Para bloquear una tarjeta por robo o pérdida, pulse 1. "
                  "Para consultar un cargo de su tarjeta, pulse 2. "
                  "Para volver al menú principal, pulse 0."),
        "teclas": {"1": "bloqueo", "2": "cargo_pin", "0": "inicio"},
    },
    "bloqueo": {
        "texto": ("Bloqueo de tarjetas. Para identificar la tarjeta, marque los dieciséis "
                  "dígitos de la tarjeta seguidos de la tecla almohadilla."),
        "teclas": {}, "pide": "tarjeta",
    },
    "cargo_pin": {
        "texto": "Para consultar sus cargos, marque el PIN de su tarjeta seguido de la tecla almohadilla.",
        "teclas": {}, "pide": "pin",
    },
    "transferencias": {
        "texto": ("Transferencias. Para hacer una transferencia nueva, pulse 1. "
                  "Para conocer el estado de una transferencia, pulse 2. "
                  "Para volver al menú principal, pulse 0."),
        "teclas": {"1": "transferencia_otp", "2": "transferencia_dni", "0": "inicio"},
    },
    "transferencia_otp": {
        "texto": "Para firmar la operación, diga o marque el código que le hemos enviado por SMS.",
        "teclas": {}, "pide": "otp",
    },
    "transferencia_dni": {
        "texto": "Para localizar la transferencia, marque el número de su DNI.",
        "teclas": {}, "pide": "dni",
    },
    "gestor_espera": {
        "texto": ("Le pasamos con un gestor. En este momento todos nuestros gestores están "
                  "ocupados. Por favor, espere."),
        "teclas": {}, "espera": 2, "siguiente": "gestor",
    },
    "gestor": {
        "texto": "Hola, Álvaro Carpintero al habla, gestor de Banca Alcor. ¿En qué puedo ayudarle?",
        "teclas": {}, "humano": True,
    },
}
MUSICA = "Música de espera. Su llamada es importante para nosotros. Por favor, no cuelgue."
NO_VALIDA = "Opción no válida."


@dataclass
class Llamada:
    """Una llamada a la línea. `log` guarda todo lo que oyó y lo que dijo la línea."""

    id: str
    estado: str = "inicio"
    esperas: int = 0
    cedida_a: str | None = None
    colgada: bool = False
    log: list[dict[str, str]] = field(default_factory=list)

    def _di(self, texto: str) -> str:
        self.log.append({"de": "linea", "texto": texto})
        return texto

    def _entra(self, estado: str) -> str:
        self.estado, self.esperas = estado, 0
        return self._di(MENUS[estado]["texto"])

    def inicio(self) -> str:
        return self._entra("inicio")

    def tecla(self, tecla: str) -> str:
        self.log.append({"de": "llamante", "tecla": tecla})
        if self.colgada or self.cedida_a:
            return ""
        destino = MENUS[self.estado]["teclas"].get(tecla)
        if destino is None:
            return self._di(NO_VALIDA + " " + MENUS[self.estado]["texto"])
        return self._entra(destino)

    def voz(self, texto: str) -> str:
        """Lo que dice quien llama. Una persona del banco lo escucha; el menú no lo entiende."""
        self.log.append({"de": "llamante", "texto": texto})
        return ""

    def esperar(self) -> str:
        m = MENUS[self.estado]
        if self.colgada or self.cedida_a:
            return ""
        if "espera" not in m:
            return ""  # silencio: la línea espera una tecla o al humano
        self.esperas += 1
        if self.esperas > m["espera"]:
            return self._entra(m["siguiente"])
        return self._di(MUSICA)

    def ceder(self, a: str) -> str:
        self.log.append({"de": "llamante", "ceder": a})
        self.cedida_a = a
        return self._di("La llamada continúa con la persona.")

    def colgar(self) -> str:
        self.colgada = True
        return ""

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "estado": self.estado, "cedida_a": self.cedida_a,
                "colgada": self.colgada, "log": self.log}


class Centralita:
    """Varias llamadas a la vez, por id."""

    def __init__(self) -> None:
        self._ids = itertools.count(1)
        self._lock = threading.Lock()
        self.llamadas: dict[str, Llamada] = {}

    def nueva(self) -> Llamada:
        with self._lock:
            c = Llamada(id=f"alcor-{next(self._ids)}")
            self.llamadas[c.id] = c
            return c


def _handler(central: Centralita) -> type[BaseHTTPRequestHandler]:
    class H(BaseHTTPRequestHandler):
        def _send(self, code: int, body: dict[str, Any]) -> None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args: Any) -> None:  # silencio en la terminal
            pass

        def _body(self) -> dict[str, Any]:
            n = int(self.headers.get("Content-Length") or 0)
            return json.loads(self.rfile.read(n) or b"{}") if n else {}

        def do_GET(self) -> None:  # noqa: N802
            parts = self.path.strip("/").split("/")
            if len(parts) == 2 and parts[0] == "llamadas" and parts[1] in central.llamadas:
                return self._send(200, central.llamadas[parts[1]].to_dict())
            self._send(404, {"error": "no existe"})

        def do_POST(self) -> None:  # noqa: N802
            parts, body = self.path.strip("/").split("/"), self._body()
            if parts == ["llamadas"]:
                c = central.nueva()
                return self._send(200, {"id": c.id, "texto": c.inicio()})
            if len(parts) != 3 or parts[0] != "llamadas" or parts[1] not in central.llamadas:
                return self._send(404, {"error": "no existe"})
            c, op = central.llamadas[parts[1]], parts[2]
            if op == "tecla":
                return self._send(200, {"texto": c.tecla(str(body.get("tecla", "")))})
            if op == "voz":
                return self._send(200, {"texto": c.voz(str(body.get("texto", "")))})
            if op == "esperar":
                return self._send(200, {"texto": c.esperar()})
            if op == "ceder":
                return self._send(200, {"texto": c.ceder(str(body.get("a", "titular")))})
            if op == "colgar":
                return self._send(200, {"texto": c.colgar()})
            self._send(404, {"error": "operación desconocida"})

    return H


def serve(port: int = PORT, host: str = "127.0.0.1") -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), _handler(Centralita()))


def main() -> None:
    ap = argparse.ArgumentParser(description="Línea simulada de Banca Alcor")
    ap.add_argument("--port", type=int, default=PORT)
    args = ap.parse_args()
    srv = serve(args.port)
    print(f"Banca Alcor - línea simulada {NUMERO} en http://127.0.0.1:{args.port}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
