"""Valida los ejemplos de docs/contracts/examples contra sus esquemas.

Uso: python docs/contracts/validate.py   (necesita jsonschema >= 4.18)

Nombre de cada ejemplo: <esquema>.<nombre>.json, o <esquema>.<def>.<nombre>.json
para validar contra una definición interna (tools.act_input.tap.json se valida
contra tools.schema.json#/$defs/act_input). Los de examples/invalid deben fallar.
"""

import json
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

HERE = Path(__file__).resolve().parent
BASE_URI = "https://priv8.dev/contracts/"
TOKEN_RE = re.compile(r"‹([A-Z]+)_(\d+)(?:-([a-z]+))?›")


def load_registry():
    schemas = {}
    for path in HERE.glob("*.schema.json"):
        schema = json.loads(path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        schemas[path.name] = schema
    registry = Registry().with_resources(
        (BASE_URI + name, Resource.from_contents(s)) for name, s in schemas.items()
    )
    return schemas, registry


def validator_for(example: Path, schemas, registry):
    parts = example.name.split(".")
    schema_file = parts[0] + ".schema.json"
    if schema_file not in schemas:
        raise SystemExit(f"{example.name}: no existe {schema_file}")
    schema = schemas[schema_file]
    if len(parts) == 4:  # esquema.def.nombre.json
        schema = {"$ref": f"{BASE_URI}{schema_file}#/$defs/{parts[1]}"}
    return Draft202012Validator(schema, registry=registry)


def main() -> int:
    schemas, registry = load_registry()
    failures = 0
    for example in sorted((HERE / "examples").glob("*.json")):
        data = json.loads(example.read_text(encoding="utf-8"))
        errors = list(validator_for(example, schemas, registry).iter_errors(data))
        if errors:
            failures += 1
            print(f"FALLA  {example.name}: {errors[0].message}")
        else:
            print(f"ok     {example.name}")
    for example in sorted((HERE / "examples" / "invalid").glob("*.json")):
        data = json.loads(example.read_text(encoding="utf-8"))
        if validator_for(example, schemas, registry).is_valid(data):
            failures += 1
            print(f"FALLA  invalid/{example.name}: debería no validar")
        else:
            print(f"ok     invalid/{example.name} (rechazado)")
    # La regex de token.md y el patrón del esquema común tienen que coincidir.
    for tok in ("‹IBAN_1-propio›", "‹IMPORTE_6›", "‹SUMA_12›"):
        if not TOKEN_RE.fullmatch(tok):
            failures += 1
            print(f"FALLA  regex de token.md no acepta {tok}")
    print(f"\n{'Todo en verde' if not failures else f'{failures} fallos'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
