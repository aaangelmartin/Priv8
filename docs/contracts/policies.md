# Políticas YAML por sitio - v1

Una política por app, en `policies/<app>.yaml`. El formato lo fija el Camino 1 (`core/policies.py`). Cada camino escribe las de sus pantallas: Álvaro `alba-core.yaml` e `inbox.yaml`, Ángel `banca-alcor.yaml`, Marco las de Brezo Banco y Nimbo Bróker.

**Pantalla sin política: no sale.** Si ninguna pantalla de la política casa con el snapshot, `observe` devuelve `denied: sin_regla` y el modelo no recibe nada.

## Ejemplo

```yaml
version: 1
app: alba-core            # web: clave del sitio; android: paquete (es.alcor.banca)
source: web               # web | android
screens:
  - id: factura.alta      # minúsculas, números, punto, guion
    url_re: /facturas/alta   # web: regex sobre la URL
    # when:               # o bien: cada match debe casar con algún elemento
    #   - {sel: "id/saldo"}
    origen: null          # origen de lo que encuentre el detector aquí (inbox: correo)
    detector: true        # pasar el detector por lo que no tiene regla (false en login)
    rules:                # la primera regla que casa gana
      - match: {sel: "#pago-iban"}
        cls: ambar
        tipo: IBAN
        origen: maestro
        campo: pago.iban
        acepta: [maestro]
      - match: {sel: "#registrar"}
        cls: verde
        critica: firmar
```

## Claves

| Clave | Dónde | Qué hace |
|---|---|---|
| `match` | regla, `when` | Casa con un elemento del snapshot. Claves: `sel` y `label` (igualdad exacta), `label_re` y `text_re` (regex), `role`. Todas las que pongas deben cumplirse |
| `cls` | regla | `verde`, `ambar` o `rojo` |
| `tipo` | regla ámbar | Tipo del token (`token.md`). Obligatorio en ámbar |
| `origen` | regla ámbar, pantalla | `propio`, `maestro`, `correo`, `tercero`, `titular`. Es la procedencia del dato y la usa #10 |
| `rasgo_signo` | regla ámbar | En importes, añade `-positivo` o `-negativo` al token |
| `extract` | regla ámbar | Regex con un grupo: solo el grupo se tokeniza (`"^Hola, (.+)$"` → `Hola, ‹PERSONA_1-titular›`) |
| `campo`, `acepta` | regla | Campo de destino y orígenes que pueden escribirse en él. `‹IBAN_2-correo›` en un campo que solo acepta `maestro` da `denied: destino` |
| `critica` | regla | `transferir`, `invertir`, `firmar`, `enviar` o `llamar`: tocar este elemento queda retenido hasta la confirmación |
| `resumen` | regla crítica | `sel` de los datos que se leen en la petición de confirmación |
| `solo_persona` | regla | El agente no puede tocarlo (entrar, huella, confirmar OTP): `act` devuelve `denied: rojo` |
| `sin_regla` | pantalla | Qué pasa con un elemento sin regla: `detector` (por defecto: lo que detecte se tokeniza, el resto es verde) o `ambar` (se tokeniza entero como `CODIGO`, la opción prudente) |
| `paused` | pantalla | Toda la pantalla pausa al agente (`autenticacion`): `observe` la devuelve con `paused` |
| `pause_on_focus` | pantalla | `sel` que, con el foco, pausan al agente mientras la persona escribe |

En `match`, `sel_re` es una regex sobre `sel`, útil para agrupar ids verdes (`'^id/(btn_volver|btn_inicio)$'`).

## Cómo casan los selectores

- **Web:** el adaptador pone en `sel` `#id` si el elemento tiene id; si no, `[name=…]`; si no, el selector CSS más corto que lo identifique. La política usa ese mismo texto.
- **Android:** `sel` es el `viewIdResourceName` sin el paquete (`id/saldo`).
- Si no hay selector estable, casar por `label`, `label_re` o `role`.

Los campos de contraseña (`password: true`) son rojos siempre, digan lo que digan las reglas.

## Comprobar

```bash
python -m pytest core/tests/test_policies.py
```
