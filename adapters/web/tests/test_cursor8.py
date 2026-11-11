"""El cursor de 8 congelado (#187) se ve igual que el vivo: el 8 cobalto con sus ojos.

En cada par de fotogramas el adaptador congela la capa de 8 de la pestaña real
(cursor8.js, congelar): pone encima una copia quieta del SVG de los ojos y oculta el vivo.
El cuerpo del 8 se recorta con clipPath; si la copia repite los ids del original, sus
url(#id) apuntan a los del SVG oculto y el 8 cobalto desaparece de la captura (solo
quedaban los ojos blancos). Se cuentan los píxeles cobalto del cursor antes y después.
"""

from __future__ import annotations

import pytest

from adapters.web.vista import CALL_JS, INIT_SCRIPT

COBALTO = (0x2D, 0x45, 0xD6)


@pytest.fixture(scope="module")
def page():
    try:
        from playwright.sync_api import sync_playwright
        pw = sync_playwright().start()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"sin playwright: {e}")
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 600, "height": 400})
    ctx.add_init_script(script=INIT_SCRIPT)
    p = ctx.new_page()
    p.set_content("<!doctype html><html><body style='margin:0;background:#fff'><p>Alba Core</p></body></html>")
    p.evaluate(INIT_SCRIPT)  # set_content no siempre pasa por el init script
    yield p
    browser.close()
    pw.stop()


def _cobalto(page, png: bytes) -> int:
    """Píxeles cobalto de una captura PNG (contados en un canvas: sin dependencias de imagen)."""
    import base64

    return page.evaluate("""async ([src, c]) => {
        const img = new Image(); img.src = src; await img.decode()
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height
        const g = cv.getContext('2d'); g.drawImage(img, 0, 0)
        const d = g.getImageData(0, 0, cv.width, cv.height).data
        let n = 0
        for (let i = 0; i < d.length; i += 4)
            if (Math.abs(d[i] - c[0]) <= 40 && Math.abs(d[i + 1] - c[1]) <= 40 && Math.abs(d[i + 2] - c[2]) <= 40) n++
        return n
    }""", ["data:image/png;base64," + base64.b64encode(png).decode(), list(COBALTO)])


def _cursor(page) -> bytes:
    x, y = page.evaluate("() => window.__p8ocho.pos()")
    return page.screenshot(clip={"x": x - 40, "y": y - 40, "width": 80, "height": 80}, animations="allow")


def test_el_cursor_congelado_lleva_el_8_cobalto(page):
    assert page.evaluate(CALL_JS, ["di", {"texto": "Antes de seguir, espero tu confirmación en la consola."}]) is True
    page.wait_for_function("() => !!document.getElementById('p8-cursor-8').shadowRoot.querySelector('.ojos svg')",
                           timeout=5000)
    page.wait_for_timeout(400)  # que aparezca (opacidad) y el motor pinte unos fotogramas
    vivo = _cobalto(page, _cursor(page))
    assert vivo > 150, "el cursor vivo no tiene el 8 cobalto"

    estado = page.evaluate(CALL_JS, ["congelar", None])
    try:
        assert estado["ojos"].startswith("<svg")
        sh = "document.getElementById('p8-cursor-8').shadowRoot"
        fijo = page.evaluate(f"""() => {{
            const f = {sh}.querySelector('.ojos .p8-fijo')
            const ids = [...{sh}.querySelectorAll('[id]')].map((n) => n.id)
            const refs = [...f.querySelectorAll('[clip-path]')].map((n) => n.getAttribute('clip-path'))
            return {{ hay: !!f, repetidos: ids.length - new Set(ids).size,
                      refs_propias: refs.every((r) => f.querySelector('#' + CSS.escape(r.slice(5, -1)))) && refs.length > 0 }}
        }}""")
        assert fijo == {"hay": True, "repetidos": 0, "refs_propias": True}
        congelado = _cobalto(page, _cursor(page))
    finally:
        page.evaluate(CALL_JS, ["soltar", None])
    assert congelado > 0.6 * vivo, f"el cursor congelado pierde el 8 cobalto ({congelado} de {vivo} píxeles)"
