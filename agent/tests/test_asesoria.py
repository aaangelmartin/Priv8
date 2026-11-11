"""8 executes, it does not advise (issue #43): the guard before the model, its voice and its face."""

from __future__ import annotations

import importlib
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from mcp import Client
from referencing import Registry, Resource

from agent import agent as agent_mod
from agent.agent import TASKS, run_agent
from agent.asesoria import FRASE, es_asesoria
from agent.core_adapter import build_real_core, mount_scene
from agent.server import build_server

CONTRACTS = Path(__file__).resolve().parents[2] / "docs" / "contracts"

ASESORIA = [
    "¿En qué fondo lo meto?",
    "en que fondo lo meto",
    "¿Qué fondo es mejor?",
    "¿Qué acciones compro?",
    "Dime el mejor fondo indexado",
    "Recomiéndame un ETF",
    "¿Qué me recomiendas para mis ahorros?",
    "Quiero tu opinión sobre el fondo Indexa",
    "¿Tú qué harías con el dinero?",
    "¿Qué hago con mis ahorros?",
    "¿Invierto en el fondo Indexa?",
    "¿Compro acciones de Inditex?",
    "¿Y si invierto en cripto?",
    "¿Lo meto en el fondo?",
    "¿Merece la pena invertir en bitcoin?",
    "¿Vale la pena el fondo de Nimbo?",
    "¿Es buen momento para comprar?",
    "¿Va a subir la bolsa?",
    "¿Es buena idea invertir en bonos?",
    "¿Debería vender mis acciones?",
    "¿Cuánto debería invertir?",
    "¿Cuánto meto en el bróker?",
    "¿Dónde invierto mi dinero?",
    "Pasa 200 € al bróker y dime en qué fondo lo meto",
    "¿Cuánto invierto en ‹PERSONA_1›?",
]

ORDENES = [
    "Pasa 200 € al bróker",
    "Invierte 200 € en el fondo X que he elegido",
    "Mete 200 € en el fondo que me aconsejó mi gestor",
    "¿Puedes invertir 200 € en el fondo Indexa?",
    "Compra 10 acciones de Inditex",
    "Vende las acciones de Telefónica",
    "Transfiere ‹IMPORTE_1› a ‹PERSONA_1›",
    "¿Cuánto tengo entre mis bancos?",
    "¿Cuánto he invertido este año?",
    "¿Cuánto vale el fondo X?",
    "¿Cómo va mi fondo?",
    "¿Cuánto pongo en la transferencia?",
    "registrar factura",
    TASKS["registrar factura"],
    "",
]


@pytest.mark.parametrize("texto", ASESORIA)
def test_advice_is_detected(texto):
    assert es_asesoria(texto)


@pytest.mark.parametrize("texto", ORDENES)
def test_orders_and_questions_about_own_data_run(texto):
    assert not es_asesoria(texto)


def test_fixed_sentence_is_short_calm_and_has_no_data():
    assert len(FRASE) <= 90
    assert "!" not in FRASE and "¡" not in FRASE
    assert "‹" not in FRASE
    example = json.loads((CONTRACTS / "examples" / "events.voice-no-puedo.json").read_text(encoding="utf-8"))
    assert example["utterance"]["segments"] == [{"voice": "cloud", "text": FRASE}]
    assert FRASE in agent_mod.SYSTEM  # defence in depth: the model knows the same sentence


class NoModel:
    """Fails the test if the loop calls the model."""

    async def create(self, **_):
        raise AssertionError("an advice request must not reach the model")


def _audit_validator() -> Draft202012Validator:
    registry = Registry().with_resources(
        ("https://priv8.dev/contracts/" + p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
        for p in CONTRACTS.glob("*.schema.json"))
    return Draft202012Validator({"$ref": "https://priv8.dev/contracts/events.schema.json"}, registry=registry)


async def test_fake_core_declines_without_calling_the_model(world):
    core, fake = world
    async with Client(build_server(core)) as client:
        result = await run_agent(client, NoModel(), core, "¿En qué fondo lo meto?")
    assert (result.status, result.steps, result.final_text) == ("asesoria", 0, FRASE)
    assert result.tool_calls == []
    [event] = fake.audit.events
    assert (event["kind"], event["reason"], event["model_saw"]) == ("blocked", "asesoria", None)
    assert fake.audit.verify()


async def test_tool_surface_is_still_checked_before_declining(world):
    from agent.agent import ToolSurfaceError

    class Wider:
        async def list_tools(self):
            from types import SimpleNamespace as N
            return N(tools=[N(name=n, description="", input_schema={}) for n in ("observe", "act", "oracle", "eval")])

    core, _ = world
    with pytest.raises(ToolSurfaceError):
        await run_agent(Wider(), NoModel(), core, "¿En qué fondo lo meto?")


async def test_real_core_says_the_sentence_then_shows_no_puedo():
    from core import events

    events.clear()
    import core as core_mod

    importlib.reload(core_mod)
    seen: list[dict] = []
    events.subscribe(seen.append)
    mount_scene("b2c", "b2c")
    core = build_real_core()
    async with Client(build_server(core)) as client:
        result = await run_agent(client, NoModel(), core, "¿Qué fondo me recomiendas?", session="b2c")
    events.clear()

    assert result.status == "asesoria"
    assert [m["type"] for m in seen] == ["voice", "audit"]
    voice, audit = seen
    assert voice["utterance"]["session"] == "b2c"
    assert voice["utterance"]["segments"] == [{"voice": "cloud", "text": FRASE}]
    assert (audit["event"]["kind"], audit["event"]["reason"]) == ("blocked", "asesoria")
    validator = _audit_validator()
    for msg in seen:
        errors = list(validator.iter_errors(msg))
        assert not errors, errors[0].message


def test_cli_exits_zero_on_a_declined_request(monkeypatch, capsys):
    monkeypatch.setenv("PRIV8_CORE", "fake")
    rc = agent_mod.main(["--task", "¿En qué fondo lo meto?", "--replay",
                         str(Path(__file__).resolve().parents[1] / "replays" / "registrar_factura.json")])
    assert rc == 0
    assert FRASE in capsys.readouterr().out


def test_core_say_holds_a_sentence_with_data():
    from core import events

    events.clear()
    import core as core_mod

    importlib.reload(core_mod)
    seen: list[dict] = []
    events.subscribe(seen.append)
    assert core_mod.say("b2c", "Tu IBAN es ES91 2100 0418 4502 0005 1332") is None
    first = core_mod.say("b2c", FRASE)
    second = core_mod.say("b2c", FRASE)
    events.clear()
    assert [m["utterance"]["utterance"] for m in seen] == [first["utterance"], second["utterance"]] == ["u1", "u2"]
