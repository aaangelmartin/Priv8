"""Políticas YAML por sitio · formato v1 (docs/contracts/policies.md).

Una política dice, para una app, qué pantallas conoce, qué clase y tipo tiene
cada elemento, a qué campo de destino corresponde y qué acciones son críticas.
Pantalla sin política: no sale (denied: sin_regla).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Cls = Literal["verde", "ambar", "rojo"]
Tipo = Literal[
    "IBAN", "DNI", "NIE", "CIF", "PERSONA", "PROVEEDOR", "IMPORTE", "SUMA",
    "FACTURA", "TEL", "EMAIL", "MOVIMIENTO", "RESPUESTA", "CODIGO",
]
Origen = Literal["propio", "maestro", "correo", "tercero", "titular"]
Critica = Literal["transferir", "invertir", "firmar", "enviar", "llamar"]
Source = Literal["web", "android"]

DEFAULT_DIR = Path(__file__).resolve().parent.parent / "policies"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Match(_Strict):
    """Cómo reconocer un elemento o una pantalla. Todas las claves dadas deben cumplirse."""

    sel: str | None = None  # igualdad exacta con element.sel
    sel_re: str | None = None  # regex sobre element.sel (filas repetidas, familias de ids)
    label: str | None = None  # igualdad exacta con element.label
    label_re: str | None = None  # regex sobre element.label
    text_re: str | None = None  # regex sobre element.text (solo para reconocer pantallas)
    role: str | None = None

    @model_validator(mode="after")
    def _not_empty(self) -> Match:
        if not any((self.sel, self.sel_re, self.label, self.label_re, self.text_re, self.role)):
            raise ValueError("match vacío: indica sel, sel_re, label, label_re, text_re o role")
        for rx in (self.sel_re, self.label_re, self.text_re):
            if rx:
                re.compile(rx)
        return self

    def hits(self, el: dict[str, Any]) -> bool:
        if self.sel is not None and el.get("sel") != self.sel:
            return False
        if self.sel_re is not None and not re.search(self.sel_re, el.get("sel") or ""):
            return False
        if self.label is not None and el.get("label") != self.label:
            return False
        if self.role is not None and el.get("role") != self.role:
            return False
        if self.label_re is not None and not re.search(self.label_re, el.get("label") or ""):
            return False
        if self.text_re is not None and not re.search(self.text_re, el.get("text") or ""):
            return False
        return True


class Rule(_Strict):
    """Regla de un elemento de la pantalla."""

    match: Match
    cls: Cls
    tipo: Tipo | None = None  # obligatorio si cls es ambar
    origen: Origen | None = None  # procedencia del dato que se muestra aquí
    rasgo_signo: bool = False  # IMPORTE: etiquetar positivo/negativo
    extract: str | None = None  # regex; el grupo 1 es el dato y el resto queda verde
    campo: str | None = None  # campo de destino, p. ej. pago.iban
    acepta: tuple[Origen, ...] | None = None  # orígenes que pueden escribirse en campo
    critica: Critica | None = None  # tocar o enviar pide confirmación
    resumen: tuple[str, ...] = ()  # sel de los datos que se leen en la confirmación
    solo_persona: bool = False  # el agente no puede tocarlo (entrar, huella, OTP)

    @model_validator(mode="after")
    def _coherent(self) -> Rule:
        if self.resumen and self.critica is None:
            raise ValueError("resumen necesita critica")
        if self.cls == "ambar" and self.tipo is None:
            raise ValueError("una regla ambar necesita tipo")
        if self.cls != "ambar" and (self.tipo or self.origen or self.rasgo_signo or self.extract):
            raise ValueError("tipo, origen, rasgo_signo y extract solo tienen sentido en reglas ambar")
        if self.extract is not None and re.compile(self.extract).groups < 1:
            raise ValueError("extract necesita un grupo de captura")
        if self.acepta is not None and self.campo is None:
            raise ValueError("acepta necesita campo")
        return self


class Screen(_Strict):
    id: str = Field(pattern=r"^[a-z0-9_.-]+$")
    url_re: str | None = None  # solo web: regex sobre la URL
    when: tuple[Match, ...] = ()  # alguno de los elementos cumple cada match
    rules: tuple[Rule, ...] = ()
    detector: bool = True  # pasar el detector por lo que no tiene regla
    sin_regla: Literal["detector", "ambar"] = "detector"  # elemento sin regla: detector, o ámbar entero
    origen: Origen | None = None  # origen de lo que encuentre el detector aquí (inbox: correo)
    paused: Literal["autenticacion", "dialogo_sistema"] | None = None  # pantalla entera en pausa
    pause_on_focus: tuple[str, ...] = ()  # sel que, con el foco, pausan al agente

    @field_validator("url_re")
    @classmethod
    def _rx(cls, v: str | None) -> str | None:
        if v is not None:
            re.compile(v)
        return v

    @model_validator(mode="after")
    def _has_matcher(self) -> Screen:
        if self.url_re is None and not self.when:
            raise ValueError(f"pantalla {self.id}: indica url_re o when")
        return self

    def matches(self, snap: dict[str, Any]) -> bool:
        if self.url_re is not None and not re.search(self.url_re, snap.get("url") or ""):
            return False
        elements = snap.get("elements") or []
        return all(any(m.hits(el) for el in elements) for m in self.when)

    def rule_for(self, el: dict[str, Any]) -> Rule | None:
        """Primera regla que casa. El orden del YAML importa."""
        for rule in self.rules:
            if rule.match.hits(el):
                return rule
        return None

    def campos(self) -> dict[str, tuple[Origen, ...] | None]:
        return {r.campo: r.acepta for r in self.rules if r.campo}


class Policy(_Strict):
    version: Literal[1]
    app: str  # web: clave del sitio; android: paquete
    source: Source
    screens: tuple[Screen, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def _unique(self) -> Policy:
        ids = [s.id for s in self.screens]
        dup = {i for i in ids if ids.count(i) > 1}
        if dup:
            raise ValueError(f"pantallas repetidas: {sorted(dup)}")
        return self

    def screen_for(self, snap: dict[str, Any]) -> Screen | None:
        """Pantalla de la política para el snapshot. Si el adaptador ya trae
        snap['screen'] y existe, manda; si no, la primera que casa."""
        name = snap.get("screen")
        if name:
            for s in self.screens:
                if s.id == name:
                    return s
        for s in self.screens:
            if s.matches(snap):
                return s
        return None


class PolicySet:
    """Todas las políticas cargadas, por app."""

    def __init__(self, policies: list[Policy]):
        self._by_app: dict[str, Policy] = {}
        for p in policies:
            if p.app in self._by_app:
                raise ValueError(f"dos políticas para la app {p.app}")
            self._by_app[p.app] = p

    def __contains__(self, app: str) -> bool:
        return app in self._by_app

    def __getitem__(self, app: str) -> Policy:
        return self._by_app[app]

    @property
    def apps(self) -> list[str]:
        return sorted(self._by_app)

    def screen_for(self, snap: dict[str, Any]) -> Screen | None:
        """None significa: no hay política y la pantalla no sale."""
        policy = self._by_app.get(snap.get("app", ""))
        return policy.screen_for(snap) if policy else None


def load_policy(path: str | Path) -> Policy:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    try:
        return Policy.model_validate(data)
    except Exception as exc:  # pydantic.ValidationError, con el archivo delante
        raise ValueError(f"{path}: {exc}") from exc


def load_policies(directory: str | Path = DEFAULT_DIR) -> PolicySet:
    return PolicySet([load_policy(p) for p in sorted(Path(directory).glob("*.yaml"))])
