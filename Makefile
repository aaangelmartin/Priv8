# Priv8 · entry points. Each path adds its own targets here (core, bridge, ...).

.PHONY: agent replay

# MCP server (streamable HTTP on :8701) and the agent loop, live against the Claude API.
# Needs ANTHROPIC_API_KEY (see .env.example).
agent:
	uv run python -m agent.agent --serve --task "$${TASK:-registrar factura}"

# Same loop with recorded model responses: no API key needed.
replay:
	uv run python -m agent.agent --replay $${REPLAY:-agent/replays/registrar_factura.json}
