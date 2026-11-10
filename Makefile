# Priv8 · entry points. Each path adds its own targets here (core, bridge, ...).

.PHONY: agent replay demo test

# MCP server (streamable HTTP on :8701) and the agent loop, live against the Claude API.
# Needs ANTHROPIC_API_KEY (see .env.example).
agent:
	uv run python -m agent.agent --serve --task "$${TASK:-registrar factura}"

# Same loop with recorded model responses: no API key needed.
replay:
	uv run python -m agent.agent --replay $${REPLAY:-agent/replays/registrar_factura.json}

# The two demo scenes (B2B invoice, B2C balance and transfer) with recorded model
# responses and the real core: no API key needed. SCENE=b2b or SCENE=b2c runs one.
# Writes a signed audit log to audit/replay.jsonl and verifies it.
demo:
	uv run python -m core.replay $${SCENE:-}

# Every test suite and the contract examples.
test:
	uv run pytest agent/tests core/tests voice/tests
	uv run python docs/contracts/validate.py
