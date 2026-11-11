# Priv8 · entry points. Each path adds its own targets here (core, bridge, ...).

.PHONY: agent agent-web web web-install replay replay-fake demo test metrics sin-protocolo video-sin-protocolo video-con-protocolo videos

# MCP server (streamable HTTP on :8701) and the agent loop, live against the Claude API.
# Needs ANTHROPIC_API_KEY (see .env.example).
agent:
	uv run python -m agent.agent --serve --task "$${TASK:-registrar factura}"

# Live agent over the real Alba Core and mailbox (Playwright). Needs `make web` running
# and ANTHROPIC_API_KEY. Held actions are approved from the audit console.
agent-web:
	uv run python -m agent.agent --web --task "$${TASK:-registrar factura}"

# Alba Core (:5173), the mailbox (:5174) and the audit console (:5175). First time: make web-install.
web:
	(cd apps/erp-sim && pnpm dev) & (cd apps/inbox-sim && pnpm dev) & (cd apps/console && pnpm dev) & wait

web-install:
	cd apps/erp-sim && pnpm install
	cd apps/inbox-sim && pnpm install
	cd apps/console && pnpm install
	uv run playwright install chromium

# Same loop with recorded model responses over the real core and a demo scene of
# core/scenes.py: no API key needed. SCENE=b2c for the transfer, REPLAY=FILE for another file.
replay:
	uv run python -m agent.agent --scene $${SCENE:-b2b} --replay $${REPLAY:-core/replays/$${SCENE:-b2b}.json}

# «registrar factura» with recorded model responses over the fake core (agent/fakes.py).
replay-fake:
	PRIV8_CORE=fake uv run python -m agent.agent --replay $${REPLAY:-agent/replays/registrar_factura.json}

# The two demo scenes (B2B invoice, B2C balance and transfer) with recorded model
# responses and the real core: no API key needed. SCENE=b2b or SCENE=b2c runs one.
# Writes a signed audit log to audit/replay.jsonl and verifies it.
demo:
	uv run python -m core.replay $${SCENE:-}

# Every test suite and the contract examples.
test:
	uv run pytest agent/tests core/tests voice/tests adapters/web/tests metrics
	uv run python docs/contracts/validate.py
	uv run python data/check_seed.py
	node apps/console/src/alertas.test.mjs
	node apps/console/src/tokens.test.mjs

# B2B metrics with and without the protocol (local, no API). Writes metrics/out/b2b.json.
metrics:
	PRIV8_AUDIT=off uv run python -m metrics.b2b
	PRIV8_AUDIT=off uv run python -m metrics.b2c

# The same B2B scene with and without the protocol as console feeds (#45), from the same
# run as make metrics. Writes apps/console/public/{sin,con}-protocolo.json; open them with
# ?feed=sin-protocolo or ?feed=con-protocolo.
sin-protocolo:
	PRIV8_AUDIT=off uv run python -m metrics.feeds

# Videos of the console playing those feeds (Playwright, 1440x900) in docs/entregables/video/.
# Needs pnpm install in apps/console; also writes an .mp4 when ffmpeg is available.
video-sin-protocolo: sin-protocolo
	uv run python scripts/grabar_consola.py sin-protocolo

video-con-protocolo: sin-protocolo
	uv run python scripts/grabar_consola.py con-protocolo

videos: video-sin-protocolo video-con-protocolo
