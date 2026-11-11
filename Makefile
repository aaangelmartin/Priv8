# Priv8 · entry points. Each path adds its own targets here (core, bridge, ...).

.PHONY: agent agent-web agent-android agent-android-replay web web-install replay replay-fake demo test metrics

# MCP server (streamable HTTP on :8701) and the agent loop, live against the Claude API.
# Needs ANTHROPIC_API_KEY (see .env.example).
agent:
	uv run python -m agent.agent --serve --task "$${TASK:-registrar factura}"

# Live agent over the real Alba Core and mailbox (Playwright). Needs `make web` running
# and ANTHROPIC_API_KEY. Held actions are approved from the audit console.
agent-web:
	uv run python -m agent.agent --web --task "$${TASK:-registrar factura}"

# Live agent on the Android emulator (B2C). First `scripts/movil.sh` (AVD, APKs, adb reverse
# 8765 and 8700). The core serves the bridge on :8765 and the events on :8700; held actions
# are spoken and approved on the phone, and 8 says the answer there. TASK="..." runs one task;
# without TASK, 8 waits for tasks dictated on the phone (core.next_task, #47). Needs
# ANTHROPIC_API_KEY; RECORD=FILE saves a replay.
agent-android:
	uv run python -m agent.agent --android $${TASK:+--task "$$TASK"} $${RECORD:+--record "$$RECORD"}

# Same on the emulator with recorded model responses: no API key. The person still logs in,
# confirms and types the code on the phone.
agent-android-replay:
	uv run python -m agent.agent --android --replay $${REPLAY:-agent/replays/b2c_android.json}

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
	uv run pytest agent/tests core/tests voice/tests adapters/web/tests adapters/android/tests metrics
	uv run python docs/contracts/validate.py
	uv run python data/check_seed.py
	node apps/console/src/alertas.test.mjs
	node apps/console/src/tokens.test.mjs

# B2B metrics with and without the protocol (local, no API). Writes metrics/out/b2b.json.
metrics:
	PRIV8_AUDIT=off uv run python -m metrics.b2b
	PRIV8_AUDIT=off uv run python -m metrics.b2c
