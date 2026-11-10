"""In-process adapter from the five ports in `core_port` to the real Priv8 core.

Team decision (option A): the core (`core/`, Camino 1) runs as a Python
library in the same process as the MCP server and the agent loop. No HTTP
between them. The same process also serves the console events WebSocket
(:8700) and the Android bridge (:8765).

The core is expected to expose five module-level functions (see "Lo que el
núcleo expone" in agent/README.md):

    observe(session) -> observation dict (observation.schema.json) | {"denied": ...}
    act(session, op, target=None, text=None[, direction=None]) -> act_result
    oracle(session, op, args) -> oracle_result
    check(payload: str) -> verdict with allowed: bool, findings: list[str]
    record(event: dict) -> the stored event, with seq, ts, prev, hash and sig

`core` is imported lazily, only when the real core is selected, so the fake
core and the tests never need it.

Selection: PRIV8_CORE=real|fake (default real). The fake core in agent/fakes.py
stays for the tests and for `make replay-fake`.

The real core reads screens through an adapter connected per session
(`core.connect`). Until the web adapter and the Android bridge are wired into
this process, `mount_scene` connects one of the in-memory demo scenes of
core/scenes.py, so the server and the agent loop have a screen to work on.
"""

from __future__ import annotations

import importlib
import os
from collections.abc import Mapping
from types import ModuleType
from typing import Any

from agent.core_port import JSON, Core, LeakVerdict

CORE_MODULE = "core"
REQUIRED = ("observe", "act", "oracle", "check", "record")
ENV_VAR = "PRIV8_CORE"
CHOICES = ("fake", "real")
DEFAULT_CHOICE = "real"
# In-memory demo screens of core/scenes.py (b2b: supplier invoice, b2c: balance and transfer).
SCENES = ("b2b", "b2c")
DEFAULT_SCENE = "b2b"


class RealCoreUnavailable(RuntimeError):
    """The real core cannot be used: `core` does not import, or lacks functions."""

    def __init__(self, module: str, missing: tuple[str, ...], cause: str | None = None) -> None:
        self.module = module
        self.missing = missing
        names = ", ".join(f"{module}.{n}" for n in missing)
        msg = f"PRIV8_CORE=real needs the in-process core `{module}`; missing: {names}"
        if cause:
            msg += f" ({cause})"
        msg += ". See 'Lo que el núcleo expone' in agent/README.md, or set PRIV8_CORE=fake."
        super().__init__(msg)


class _Screen:
    def __init__(self, fn: Any) -> None:
        self._observe = fn

    def observe(self, session: str) -> JSON:
        return dict(self._observe(session))


class _Actor:
    def __init__(self, fn: Any) -> None:
        self._act = fn

    def act(self, session: str, op: str, target: str | None = None, text: str | None = None,
            direction: str | None = None) -> JSON:
        # direction only exists for scroll: a core that does not take it still works for every other op.
        extra = {"direction": direction} if direction is not None else {}
        return dict(self._act(session, op, target=target, text=text, **extra))


class _Oracle:
    def __init__(self, fn: Any) -> None:
        self._oracle = fn

    def oracle(self, session: str, op: str, args: list[str]) -> JSON:
        return dict(self._oracle(session, op, list(args)))


class _LeakCheck:
    def __init__(self, fn: Any) -> None:
        self._check = fn

    def check(self, payload: str) -> LeakVerdict:
        verdict = self._check(payload)
        allowed = _field(verdict, "allowed")
        findings = _field(verdict, "findings") or ()
        if not isinstance(allowed, bool):
            # Fail closed: a verdict we cannot read is a block.
            return LeakVerdict(ok=False, reason="fuga", matched=("veredicto_ilegible",))
        return LeakVerdict(ok=allowed, reason=None if allowed else "fuga",
                           matched=tuple(str(f) for f in findings))


class _Audit:
    def __init__(self, fn: Any) -> None:
        self._record = fn
        # Mirror of what this process recorded, for `agent --audit-out`. The core keeps the real log.
        self.events: list[JSON] = []

    def record(self, event: JSON) -> JSON:
        stored = dict(self._record(dict(event)))
        self.events.append(stored)
        return stored


def _field(obj: Any, name: str) -> Any:
    if isinstance(obj, Mapping):
        return obj.get(name)
    return getattr(obj, name, None)


def _load(module: str) -> ModuleType:
    try:
        return importlib.import_module(module)
    except ImportError as e:
        raise RealCoreUnavailable(module, REQUIRED, cause=f"import failed: {e}") from e


def build_real_core(module: str = CORE_MODULE) -> Core:
    """Wire the five ports to the real core, imported in-process from `module`.

    Raises RealCoreUnavailable naming every missing function.
    """
    mod = _load(module)
    missing = tuple(n for n in REQUIRED if not callable(getattr(mod, n, None)))
    if missing:
        raise RealCoreUnavailable(module, missing)
    return Core(
        screen=_Screen(mod.observe),
        actor=_Actor(mod.act),
        oracle=_Oracle(mod.oracle),
        leak=_LeakCheck(mod.check),
        audit=_Audit(mod.record),
    )


def mount_scene(session: str, name: str = DEFAULT_SCENE, *, simulated_persona: bool = False,
                module: str = CORE_MODULE) -> Any:
    """Connect a demo scene of core/scenes.py to `session` in the real core and return it.

    With `simulated_persona`, a simulated person approves every held action before the
    next screen read, as in `make demo`. Only for recorded replays and tests: in a live
    run the person approves from app 8 or the console.
    """
    if name not in SCENES:
        raise ValueError(f"scene {name!r}: expected one of {', '.join(SCENES)}")
    mod = _load(module)
    try:
        scenes = importlib.import_module(f"{module}.scenes")
    except ImportError as e:
        raise RealCoreUnavailable(module, ("scenes",), cause=f"import failed: {e}") from e
    scene = scenes.SCENES[name]()
    if simulated_persona:
        def approve_pending() -> None:
            for req in mod.pending(session):
                mod.approve({"type": "approval_result", "id": req["id"], "ok": True,
                             "via": "pantalla", "by": "persona"})
        scene.before_snapshot = approve_pending
    mod.connect(session, scene)
    return scene


def mount_web(session: str, *, start: str = "inbox", module: str = CORE_MODULE,
              events: bool = True) -> Any:
    """Connect the real Alba Core and mailbox (adapters/web, Playwright) to `session`.

    Unlike the scenes, the screens are the apps of apps/erp-sim and apps/inbox-sim, which
    must be running (ports 5173 and 5174). The seed values are trusted so the final block
    looks for them in everything that goes out, and the events WebSocket (:8700) starts so
    the audit console can show the screens and the person can approve held actions there.
    """
    import sys
    from pathlib import Path

    from adapters.web import WebAdapter

    mod = _load(module)
    data = Path(__file__).resolve().parent.parent / "data"
    sys.path.insert(0, str(data))
    from check_seed import known

    mod.trust(known())
    web = WebAdapter(start=start)
    mod.connect(session, web)
    if events:
        importlib.import_module(f"{module}.server").start()
    return web


def tokenize_task(session: str, text: str, module: str = CORE_MODULE) -> str:
    """What the person asked, with their data replaced by tokens of `session`, before it goes to Claude."""
    return str(_load(module).tokenize_text(session, text))


def core_choice(env: Mapping[str, str] | None = None) -> str:
    """The value of PRIV8_CORE (real by default). Anything else is an error."""
    env = os.environ if env is None else env
    choice = (env.get(ENV_VAR) or DEFAULT_CHOICE).strip().lower()
    if choice not in CHOICES:
        raise ValueError(f"{ENV_VAR}={env.get(ENV_VAR)!r}: expected one of {', '.join(CHOICES)}")
    return choice


def select_core(env: Mapping[str, str] | None = None) -> Core:
    """The core named by PRIV8_CORE: the in-memory fake, or the real in-process core."""
    if core_choice(env) == "real":
        return build_real_core()
    from agent.fakes import build_fake_core

    core, _ = build_fake_core()
    return core
