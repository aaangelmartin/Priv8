# Arquitectura de Priv8

Resumen en texto de `docs/arquitectura.html`, que tiene los diagramas, los contratos con ejemplos, los cuatro flujos y el reparto. Sustituye a la arquitectura v2 «Priv8 Gateway» (OCR sobre píxeles y proxy de API), descartada el 10 nov 2026.

## Decisiones

- **Un núcleo, dos verticales.** B2B (arnés para empresas sobre ERP y CRM antiguos) y B2C (8 en un Android del emulador). Las dos usan el mismo núcleo y los mismos contratos.
- **Se lee estructura, no píxeles.** DOM con Playwright en web y árbol de accesibilidad en Android. Nuestra medición de OCR por escritorio remoto leyó bien 8 de 120 IBAN.
- **Herramientas cerradas.** El agente solo tiene `observe`, `act` y `oracle`. Sin `eval`, sin CDP crudo, sin adb, sin helpers propios.
- **Tokens como texto:** `‹TIPO_n·etiqueta›`, por ejemplo `‹IBAN_1·propio›` o `‹IMPORTE_3·positivo›`. Estables por sesión; la tabla vive solo en la bóveda local.
- **Voz mixta.** ElevenLabs lee frases sin datos; la voz local del portátil o del móvil lee cifras y nombres.

## Zonas

| Zona | Qué hay |
|---|---|
| Confianza · portátil | Núcleo y bóveda, servidor MCP y bucle del agente, adaptador web, puente Android, registro firmado |
| Confianza · emulador | APK de 8 (servicio de accesibilidad, app 8 con los ojos en un WebView, voz local) y apps de banca simuladas |
| Confianza · navegador | ERP Alba Core, bandeja de correo, consola de auditoría |
| Nube | API de Claude y ElevenLabs (voz y llamada por Twilio). Solo reciben tokens y frases sin datos |

Antes de salir hacia la nube, el **bloqueo final** revisa cada petición: si un patrón sensible se escapa sin tokenizar, la petición no sale.

## Núcleo (Python)

| Pieza | Qué hace |
|---|---|
| Detector | Reglas por sitio, patrones con validación (IBAN mod-97, DNI/NIE, CIF, Luhn), coincidencia con la bóveda y nombres |
| Tokenizador y bóveda | Mismo valor, mismo token; lo rojo (claves, PIN, OTP, tarjeta completa) nunca entra en la bóveda ni sale |
| Políticas YAML | Por sitio: selectores a clase y tipo, campos de destino, acciones críticas. Pantalla sin política: no sale |
| Procedencia | Etiqueta el origen de cada dato. Lo que viene de un correo o de un tercero no puede llegar a un campo de pago ni cambiar la operación |
| Oráculo | `sum`, `compare` y `matches` sin revelar cifras, con presupuesto de preguntas y respuestas por tramos |
| Ejecutor | Rehidrata los tokens en local al escribir en el campo; un token desconocido no se escribe |
| Confirmación humana | Transferir, enviar y firmar quedan retenidos hasta la aprobación; caduca a los 5 minutos |
| Bloqueo final | Revisa toda salida hacia Claude y ElevenLabs |
| Auditoría firmada | JSONL encadenado por hashes: qué recibió el modelo, qué se bloqueó y qué aprobó la persona |

## Contratos (`docs/contracts/`, se fijan el martes 10 a las 14:00)

Herramientas MCP `observe` / `act` / `oracle` · gramática de tokens · snapshot de pantalla (común a web y Android) · interfaz de adaptador `snapshot()` / `perform()` y puente Android · evento de auditoría · petición de confirmación · segmento de voz · políticas YAML por sitio. Los ejemplos están en `docs/arquitectura.html`. Un cambio lo aprueban Pablo (Camino 1) y quien lo consume.

## Despliegue de la demo (puertos propuestos)

| Proceso | Dónde | Puerto | Arranque |
|---|---|---|---|
| Núcleo, API y eventos | portátil | 8700 | `make core` |
| Servidor MCP y agente | portátil | 8701 | `make agent` |
| Puente Android | portátil ↔ emulador | 8765 (`adb reverse`) | `make bridge` |
| ERP Alba Core | navegador | 5173 | `pnpm --filter erp-sim dev` |
| Bandeja de correo | navegador | 5174 | `pnpm --filter inbox-sim dev` |
| Consola de auditoría | navegador | 5175 | `pnpm --filter console dev` |
| APK de 8 y bancos | emulador | — | `scripts/emu.sh` |
| Modo replay sin claves | portátil | los mismos | `make replay` |

Datos inventados en `data/seed.json`: Banca Alcor, Brezo Banco, Nimbo Bróker, Suministros Lumen (proveedor) y Talleres Norte (la empresa que paga).

## Repositorio

```
core/              Python · detector, tokens, bóveda, políticas, procedencia, oráculo, ejecutor, confirmación, bloqueo, auditoría · Camino 1
mcp/               Python · servidor MCP, bucle del agente, modo replay · Camino 3
adapters/web/      Playwright · Camino 2
adapters/android/  Kotlin · servicio de accesibilidad y puente · Camino 3
apps/erp-sim/ apps/inbox-sim/ apps/console/   React + Vite · Camino 2 (correos de prueba: Camino 4)
apps/android-8/    Kotlin · diseño y voz: Camino 3 · app y dictado: Camino 4
apps/banks-sim/    Kotlin · Banca Alcor: Camino 3 · Brezo y Nimbo: Camino 4
voice/             ElevenLabs y Twilio · Caminos 2 y 3
policies/  data/seed.json  metrics/  docs/contracts/  scripts/emu.sh
```

## Reparto

Ver la tabla de `CLAUDE.md` y las issues #4–#56 con sus milestones (M1 martes 10, M2 miércoles 11, M3 jueves 12).

## Por decidir

- De qué campo de la ficha del proveedor sale la pregunta de comprobación.
- El número de teléfono para las llamadas.
- Una APK con tres bancos o tres APK.
- Si los ajustes restringidos de Android 13+ bloquean el servicio de accesibilidad instalado con adb (se prueba hoy; alternativa: imagen de Android 12 o `adb shell settings put secure enabled_accessibility_services`).
