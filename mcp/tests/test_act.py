"""act with a token reaches the executor with the real value; policy denials do not."""

from __future__ import annotations

from mcp import Client

from fakes import SEED
from server import build_server


async def _act(core, **args):
    async with Client(build_server(core)) as client:
        r = await client.call_tool("act", {"session": "s1", **args})
    return r.structured_content


async def test_token_is_rehydrated_for_the_executor(world):
    core, fake = world
    assert await _act(core, op="type", target="e6", text="‹PROVEEDOR_1·correo›") == {"ok": True}
    assert fake.adapter.performed[-1] == {"op": "type", "target": "e6", "text": SEED["proveedor"]}
    assert fake.adapter.fields["e6"].value == SEED["proveedor"]


async def test_destination_policy_blocks_iban_from_email(world):
    core, fake = world
    r = await _act(core, op="type", target="e10", text="‹IBAN_2·correo›")
    assert r["denied"] == "destino"
    assert fake.adapter.performed == []
    assert fake.adapter.fields["e10"].value == SEED["iban_maestro"]
    ev = fake.audit.events[-1]
    assert ev["kind"] == "blocked" and ev["reason"] == "destino" and "‹IBAN_2·correo›" in ev["tokens"]


async def test_unknown_token_is_not_written(world):
    core, fake = world
    r = await _act(core, op="type", target="e6", text="‹PROVEEDOR_9·correo›")
    assert r["denied"] == "token_desconocido"
    assert fake.adapter.performed == []


async def test_red_field_is_never_written(world):
    core, fake = world
    r = await _act(core, op="type", target="e12", text="‹CODIGO_1›")
    assert r["denied"] == "rojo"
    assert fake.adapter.performed == []


async def test_raw_value_from_the_model_is_blocked(world):
    core, fake = world
    r = await _act(core, op="type", target="e10", text=SEED["iban_correo"])
    assert r["denied"] == "fuga"
    assert fake.adapter.performed == []


async def test_critical_action_is_held_for_confirmation(world):
    core, fake = world
    for target, token in [("e6", "‹PROVEEDOR_1·correo›"), ("e7", "‹CIF_1·tercero›"), ("e8", "‹FACTURA_1·correo›"),
                          ("e9", "‹IMPORTE_1·positivo›")]:
        assert await _act(core, op="type", target=target, text=token) == {"ok": True}
    r = await _act(core, op="tap", target="e13")
    assert r == {"held": {"confirm": "c1"}}
    kinds = [e["kind"] for e in fake.audit.events]
    assert kinds.index("held") < kinds.index("approval")
    assert fake.adapter.screen == "factura.registrada"


async def test_held_action_waits_without_approval():
    from fakes import build_fake_core

    core, fake = build_fake_core(auto_approve=False)
    r = await _act(core, op="tap", target="e13")
    assert "held" in r
    assert fake.adapter.performed == []


async def test_oracle_compares_without_revealing(world):
    core, _ = world
    async with Client(build_server(core)) as client:
        r = await client.call_tool("oracle", {"session": "s1", "op": "compare",
                                              "args": ["‹IMPORTE_1·positivo›", "‹IMPORTE_2·positivo›"]})
        s = await client.call_tool("oracle", {"session": "s1", "op": "sum",
                                              "args": ["‹IMPORTE_1·positivo›", "‹IMPORTE_2·positivo›"]})
    assert r.structured_content == {"result": "igual", "budget_left": 29}
    assert s.structured_content["result"] == "‹SUMA_1›"
    assert s.structured_content["tramo"] == "1.000–10.000"


async def test_oracle_budget_runs_out():
    from fakes import build_fake_core

    core, _ = build_fake_core(oracle_budget=1)
    args = {"session": "s1", "op": "compare", "args": ["‹IMPORTE_1·positivo›", "‹IMPORTE_2·positivo›"]}
    async with Client(build_server(core)) as client:
        assert (await client.call_tool("oracle", args)).structured_content["result"] == "igual"
        assert (await client.call_tool("oracle", args)).structured_content["denied"] == "presupuesto"
