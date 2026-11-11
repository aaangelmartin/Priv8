# Priv8 CUA - especificación v1

Priv8 CUA es un protocolo para que un agente de IA use pantallas sin ver los datos. Cada dato sensible se cambia por un token antes de llegar al modelo y solo vuelve a su valor real en local, al ejecutar. El agente completa el trámite; la cifra, el IBAN o el nombre no salen del entorno de confianza.

Este documento fija lo mínimo que tiene que cumplir una implementación. Los formatos exactos están en `docs/contracts/` (JSON Schema con ejemplos). La implementación de referencia es `core/`.

## 1. Zonas

| Zona | Qué hay | Ve valores reales |
|---|---|---|
| Confianza | Núcleo y bóveda, adaptadores (DOM web, accesibilidad Android), ejecutor, renderizador y voz locales, consola | Sí |
| Nube | Modelo (Claude) y voz sin datos (ElevenLabs) | No: solo tokens y texto de interfaz |

Todo lo que cruza de la zona de confianza a la nube pasa por el **bloqueo final**.

## 2. Clases de dato

| Clase | Qué es | Qué recibe el modelo |
|---|---|---|
| **Rojo** - nunca sale | Contraseñas, PIN, usuario de acceso, códigos de un solo uso, tarjeta completa | `"text": null`. No entra en la bóveda |
| **Ámbar** - se tokeniza | IBAN, DNI, NIE, CIF, nombres, importes, teléfonos, correos, movimientos | Un token: `‹IBAN_1-maestro›` |
| **Verde** - libre | Botones, etiquetas, títulos, menús | El texto tal cual |

Un campo de contraseña es rojo siempre, diga lo que diga la política.

## 3. Tokens

```
‹TIPO_n-etiqueta›      ‹IBAN_1-propio›   ‹IMPORTE_3-positivo›   ‹SUMA_1›
regex: ‹([A-Z]+)_(\d+)(?:-([a-z]+))?›
```

- Mismo valor (normalizado) y misma sesión, mismo token. `n` cuenta por tipo desde 1.
- La etiqueta dice lo justo para decidir: el origen (`propio`, `maestro`, `correo`, `tercero`, `titular`) o el signo (`positivo`, `negativo`). El origen completo vive en la bóveda.
- El texto de pantalla con `‹` o `›` se neutraliza antes de tokenizar: una página no puede colar un token falso.

Detalle completo en `docs/contracts/token.md`.

## 4. Las seis piezas

1. **Tokens y bóveda.** La tabla token → valor vive solo en la zona de confianza, una por sesión. Guarda en qué orígenes se ha visto cada valor.
2. **Clases y detección.** Una política YAML por sitio (`policies/*.yaml`, formato en `docs/contracts/policies.md`) da clase, tipo, origen, campo de destino y acciones críticas por selector. El detector cubre el texto libre: patrones validados (IBAN mod-97, letra de DNI/NIE, control de CIF, Luhn), importes, teléfonos, correos, códigos de un solo uso, valores ya conocidos y nombres por contexto. **Pantalla sin política: no sale.**
3. **Oráculo.** `sum`, `compare` y `matches` sin revelar cifras. `sum` devuelve un `‹SUMA_n›` nuevo y su tramo. Hay presupuesto por sesión y por token, de modo que una búsqueda binaria contra importes de referencia no reconstruye una cifra.
4. **Ejecutor.** El modelo escribe tokens; el ejecutor los cambia por el valor real en local y llama al adaptador. Un token que no existe en la sesión no se escribe. Antes comprueba la **procedencia**: un campo de destino solo admite tokens de su tipo vistos en un origen aceptado. Un IBAN que solo ha llegado por correo no entra en el IBAN de pago, y una llamada solo va a un teléfono de la ficha.
5. **Confirmación humana.** Transferir, invertir, firmar, enviar y llamar quedan retenidos (`held`) hasta que la persona aprueba, por voz o en pantalla, con un resumen en voz mixta. Caduca a los 5 minutos. La autenticación del banco (SCA de PSD2) y los controles marcados `solo_persona` los hace siempre la persona; mientras se autentica, el agente queda en pausa.
6. **Auditoría.** JSONL encadenado por hashes y firmado con ed25519. Registra qué recibió el modelo, qué se bloqueó y qué aprobó la persona. `python -m core.verify` detecta una línea alterada.

**Modo estricto (por defecto).** Al modelo solo llega el texto que cubre una regla de la política: ámbar como token, rojo como `null` y el verde que la regla declara legible (que también pasa el detector). Un elemento sin regla llega sin su texto, y el texto suelto de la página no llega. El modo permisivo, que una política pide con `modo: permisivo` o la variable `PRIV8_POLITICA_ESTRICTA=0`, manda además el resto de la página filtrado por el detector. Gana siempre el más estricto. Detalle y argumento en `core/README.md`.

**Bloqueo final.** Cada petición hacia el modelo o la voz en la nube se revisa entera antes de salir: patrones validados, datos rojos y cualquier valor real de la bóveda o de la lista de confianza. Si aparece uno, la petición no sale y queda `blocked: fuga`. Falla cerrado.

## 5. Herramientas del agente

El agente solo tiene estas tres. Sin `eval`, sin CDP crudo, sin adb, sin helpers propios.

| Herramienta | Entrada | Salida |
|---|---|---|
| `observe` | `session` | Pantalla tokenizada (`observation.schema.json`), o `denied` |
| `act` | `session`, `op` (`tap`, `type`, `key`, `scroll`, `open_app`, `back`, `send`, `call`), `target`, `text` con tokens o texto verde | `{"ok": true}`, `{"held": {"confirm": "c3"}}` o `denied` |
| `oracle` | `session`, `op` (`sum`, `compare`, `matches`), `args` (tokens) | `‹SUMA_n›` y tramo, o una palabra (`mayor`, `coincide`…), con `budget_left`; o `denied` |

Motivos de rechazo: `fuga`, `destino`, `rojo`, `presupuesto`, `sin_regla`, `token_desconocido`, `caducado`, `cancelado`. El detalle que acompaña al rechazo nunca lleva valores reales. Formatos en `docs/contracts/tools.schema.json`.

## 6. Recorridos

```
observe  adaptador.snapshot() → política → detector → bóveda → bloqueo final → modelo
act      modelo → elemento y clase → tokens conocidos → procedencia → confirmación → rehidratar → adaptador.perform()
oracle   modelo → presupuesto → bóveda → token nuevo o palabra → modelo
salida   plantilla con tokens → renderizador local → pantalla; voz: frases → nube, tokens → voz local
```

## 7. Conformidad

Una implementación es conforme si cumple todo lo siguiente. Entre paréntesis, el test de la implementación de referencia que lo comprueba.

1. Ningún valor ámbar ni rojo aparece en lo que recibe el modelo (`test_tokens_vault::test_observacion_de_alcor`, `test_facade::test_observe_tokeniza_y_registra`).
2. Lo rojo no entra en la bóveda ni se escribe desde el agente (`test_tokens_vault::test_tipos_rojos_no_entran`, `test_facade::test_act_rechaza`).
3. Mismo valor y sesión, mismo token; sesiones aisladas (`test_tokens_vault::test_mismo_valor_mismo_token`, `test_sesiones_aisladas`).
4. Una pantalla sin política no sale (`test_facade::test_pantalla_sin_politica_no_sale`).
5. Un token desconocido no se escribe; uno conocido llega al adaptador con su valor real y ese valor no queda en la auditoría (`test_facade::test_act_rehidrata_en_local`).
6. Un dato con origen no aceptado no entra en un campo de destino, en todas sus formas de escritura (`test_provenance`, 10 variantes del correo trampa).
7. Las acciones críticas quedan retenidas hasta una aprobación de la persona dentro de plazo (`test_confirm`).
8. El oráculo no permite reconstruir una cifra con el presupuesto por defecto (`test_oracle::test_no_se_reconstruye_una_cifra_por_busqueda_binaria`).
9. El bloqueo final para cualquier valor de la bóveda o patrón sensible, también con escapes JSON (`test_leak`).
10. La auditoría detecta una línea editada, borrada, reordenada o con firma ajena (`test_audit`).
11. En modo estricto, un texto sin regla (una dirección, un nombre poco común) no llega al modelo, aunque el detector no lo reconozca; en permisivo sí (`test_extras::test_estricto_solo_sale_lo_que_cubre_una_regla`, `test_extras::test_observe_y_el_modo_del_entorno`).

## 8. Límites conocidos

- Los nombres sueltos sin contexto ni presencia previa en la bóveda o en la lista de confianza pueden no detectarse. Por eso las pantallas necesitan política, la bandeja de correo usa reglas y el modo estricto es el de por defecto. Dentro de un texto que una regla declara legible (el cuerpo del correo) el detector sigue siendo la única barrera.
- La llamada de verificación necesita el número real del proveedor para marcar. Es el único valor que sale: va a la voz con retención cero y queda en la auditoría.
- En la demo, el núcleo corre en el portátil junto al emulador, unidos por `adb reverse`. En producción, el núcleo va dentro del móvil.
- El agente ejecuta, no aconseja: ante una petición de asesoría de inversión, responde que no puede.
