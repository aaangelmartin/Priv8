# Priv8 CUA — contexto del proyecto

Proyecto del equipo para la hackathon de finanzas de la Madrid Engineering Week (MEW). Las bases y la rúbrica están en `bases/bases-hackathon.pdf`.

## Qué construimos

**Priv8 CUA** es un protocolo de privacidad para *computer-use agents* (CUA): agentes de IA que usan pantallas como una persona. Los datos sensibles de cada pantalla se sustituyen por tokens antes de llegar al modelo, y se rehidratan solo en local al ejecutar la acción. El agente hace el trámite sin ver los datos.

- **Núcleo general:** sirve para cualquier sector.
- **Perfil Finanzas:** la primera aplicación y el foco de la hackathon.
- **Modelo:** B2B. Lo adoptan bancos y brokers que quieren ofrecer agentes, empresas que los construyen y departamentos financieros.
- **Nombres:** la marca y el producto son **Priv8**. **Priv8 CUA** es el protocolo sobre el que funciona (se usa al hablar del protocolo, con quien lo integra). El agente es **8**.
- **Frase clave:** "Visa y Google resolvieron cómo paga un agente. Priv8 resuelve qué ve mientras trabaja."

## Las seis piezas del protocolo

1. **Tokens** tipados y estables por sesión: `‹IBAN_1-propio›`, `‹IMPORTE_3-positivo›`. La tabla token → valor vive solo en el entorno de confianza.
2. **Clases de dato:**
   - **Rojo, nunca sale:** contraseñas, PIN, logins, OTP, tarjeta completa.
   - **Ámbar, se tokeniza:** IBAN, DNI, nombres, importes, movimientos.
   - **Verde, libre:** interfaz.
3. **Oráculo** local que calcula sin revelar (`sum`, `compare`, `matches`), con presupuesto de preguntas y respuestas por tramos. Así se evita que el agente adivine una cifra a base de comparaciones.
4. **Ejecutor:** el modelo escribe tokens y el ejecutor pone el valor real en pantalla.
5. **Confirmación humana obligatoria** para transferir, invertir, firmar y enviar formularios. La autenticación del banco (PSD2) la hace siempre el usuario.
6. **Auditoría:** registro de qué recibió el modelo, qué se bloqueó y qué aprobó el usuario.

Hay además un **bloqueo final**: si un patrón sensible se escapa sin tokenizar, la petición no sale.

### Detección (perfil Finanzas)

- Reglas por sitio (selectores).
- Patrones con validación: IBAN mod-97, letra del DNI/NIE, Luhn para tarjetas.
- Coincidencia con la bóveda local.
- Nombres de personas.

### Salida privada

El modelo responde con plantillas con tokens. Un renderizador local sustituye los tokens antes de mostrarlos al usuario. La voz va mixta:
- ElevenLabs lee las frases sin datos.
- La voz local (Web Speech o la del móvil) lee cifras y nombres.

## Qué construimos en la hackathon (decidido el 10 nov 2026)

Priv8 CUA es el producto. Sobre el mismo núcleo, dos verticales, y las dos salen en la demo:

- **B2B - Priv8 para empresas:** un arnés para automatizar con IA procesos que hoy no se automatizan por miedo a exponer datos (RGPD, SOC 2), con *computer use* sobre ERP y CRM antiguos. Proceso de la demo: llega un correo con la factura de un proveedor → 8 la registra en el ERP simulado (Alba Core) sin ver los datos → contesta el correo → bloquea el cambio de IBAN que viene en el mismo correo (procedencia) → la consola avisa de posible fraude → la persona aprueba → registro firmado. Sin llamada al proveedor (decidido el 11 nov; el código de la llamada queda como extra).
- **B2C - 8 en tu móvil:** una APK para el emulador de Android Studio (no va a Google Play) que maneja el móvil por accesibilidad y habla con voz. Recorre las apps de banca simuladas (Banca Alcor, Brezo Banco, Nimbo Bróker), responde "¿cuánto tengo?", prepara transferencias con confirmación por voz y mira a otro lado mientras la persona pone su huella, clave u OTP. No asesora ni firma.

Se lee el DOM (Playwright) y el árbol de accesibilidad, no píxeles. Las herramientas del agente son solo `observe`, `act` y `oracle`. El núcleo es una librería Python que corre en el mismo proceso que el servidor MCP (`agent/`), los eventos de la consola y el puente Android.

### Reparto (issues #4–#56, milestones M1 martes 10, M2 miércoles 11, M3 jueves 12)

| Camino | Responsable | Qué lleva |
|---|---|---|
| 1 - Núcleo (B2B) | Pablo (`rrojjo`) | Contratos, detector, tokens y bóveda, políticas, procedencia, oráculo, ejecutor, confirmación, bloqueo final, auditoría, modo replay, `SPEC.md`, README |
| 2 - Empresa (B2B) | Álvaro (`alvaarocl`) | `seed.json`, ERP y bandeja simulados, adaptador web, consola de auditoría, alarma de fraude en la consola, métricas B2B, vídeo, ZIP |
| 3 - Android, agente, voz y diseño (B2C) | Ángel (`aaangelmartin`) | Servidor MCP y bucle del agente, servicio de accesibilidad, puente, Banca Alcor, voz mixta, confirmaciones habladas y todo el diseño: branding v2, app 8 y 8, kit visual, landing, PDF y diapositivas |
| 4 - App 8 y bancos (B2C) | Marco (`marcoobarroso`) | App 8 con los ojos, renderizador local, Brezo Banco y Nimbo Bróker, dictado, emulador, correos de prueba, métricas B2C |

La arquitectura completa (componentes, contratos, flujos, despliegue y repositorio) está en `docs/arquitectura.html` y resumida en `docs/arquitectura.md`.

### Reglas importantes

- El agente **nunca** tiene acceso directo al navegador o al sistema: sin `eval`, sin CDP crudo, sin adb, y sin escribir sus propios helpers. Solo herramientas cerradas.
- El agente **ejecuta, no aconseja** inversiones (el asesoramiento financiero está regulado).
- La app de referencia es obligatoria: la rúbrica da un 15% a UX y otro 15% a lenguaje y audio, y un protocolo sin interfaz no puntuaría ahí.

### Demo (unos 3 minutos)

1. El mismo trámite sin protocolo: la consola muestra todo en claro.
2. B2B: correo con factura → ERP → respuesta; el cambio de IBAN del correo queda bloqueado y la consola avisa de posible fraude.
3. B2C por voz: "¿Cuánto tengo entre mis bancos?". La consola solo muestra tokens y la cifra real se oye con la voz local.
4. "Pasa 200 € al bróker": 8 lo prepara, mira a otro lado durante la huella y pide confirmación por voz.
5. Cierre con las métricas propias.

## Entregables (según las bases)

- Repositorio de GitHub público o compartido.
- ZIP descargado con "Download ZIP" (es la versión que se evalúa).
- `README.md` con descripción, requisitos, instalación, configuración, ejecución y prueba.
- PDF de una cara: problema, solución y valor diferencial.
- Presentación.

## Rúbrica

| Criterio | Peso |
|---|---|
| Innovación y viabilidad | 30% |
| Implementación técnica | 30% |
| IA frontera (lenguaje y audio) | 15% |
| UX y accesibilidad | 15% |
| Presentación | 10% |

## Competencia investigada

- **Investigación de Tsinghua** "Available but Invisible" (arXiv 2602.10139): la misma idea en emulador Android. Valida el concepto, pero no es un producto.
- **Skyflow:** bóveda de privacidad para IA, sin agentes que usen pantallas.
- **Visa TAP, Google AP2, Coinbase x402, PayPal:** solo cubren el pago.
- **Basis Theory:** solo credenciales de tarjeta.
- **ScreenLeak:** benchmark de redacción en pantallas.

## Marca

Las variables están en `brand/tokens.css` y la guía completa en `docs/marca.html`.

- **Colores:**
  - Cobalto `#2D45D6`: el color principal de la marca. Fondo de portadas, diapositivas, icono y 8; acción principal en interfaces.
  - Noche `#0B1B33`: texto principal y fondos oscuros (consola).
  - Cobalto claro `#8FA2FF`: sobre fondo oscuro.
  - Niebla `#EEF2F8`: fondos.
  - Pizarra `#5A6478`: texto secundario.
  - Estados: Seguro `#1F8A5B`, Aviso `#A86400`, Bloqueado `#C23A2E`.
- **Tipografía:**
  - Sora (600/700) en titulares y logo.
  - IBM Plex Sans en el texto.
  - IBM Plex Mono en tokens y código.
- **Tokens visuales:** siempre en Plex Mono, con comillas ‹ ›, fondo cobalto suave.
- **Tono:** preciso y tranquilo. Sin superlativos, exclamaciones ni emojis.

## 8, el agente (los ojos)

El agente se llama **8** (se lee "Ocho" o "Eight"; en texto siempre la cifra). Sus ojos son el logo. La referencia viva y el código de todas las animaciones están en `docs/ojos.html`; la guía en `docs/marca.html`.

- **Construcción:** el 8 de Sora 700 con su anillo inferior reflejado arriba (los dos huecos iguales), girado 90°. Los huecos son los ojos, con pupilas redondas. El script mide el glifo real en un canvas.
- **Movimiento:** muelles amortiguados en mirada, párpados, tamaño e inclinación; la cabeza sigue a la mirada con retraso; transición con anticipación y parpadeo en cada cambio de estado; gestos sueltos en reposo.
- **Parpadeo:** en almendra, como un ojo real: cierra desde las esquinas en 70 ms, cerrado 30 ms, abre en 160 ms. Parte de la pose de la emoción. No parpadea con los ojos ya cerrados (risa, inactivo, no ve).
- **Solo ojos:** nada de manos, vendas, iconos ni adornos tipo emoji. La única excepción son las "z" en Sora de inactivo.
- **Emociones (10):** alegría, risa, agradecer, sorpresa, tristeza, enfado, miedo, curiosidad, duda, disculpa.
- **Flujo (18):** reposo, saludar, llamar, interrumpido, escuchar, hablar, pensar, leer, cargando, pedir permiso, esperar, mirar a otro lado (mientras el usuario escribe su clave u OTP), listo, confirmado, cancelado, no puedo (asesoría de inversión o dato rojo), sin conexión, inactivo.
- **Datos:** la cara cuenta lo que 8 puede hacer con el dato. **Ve** (verde): ojos abiertos. **Tokenizado** (ámbar): lo tiene pero tapado, los huecos se cierran en dos asteriscos. **Nunca sale** (rojo): ni lo mira, cierra los ojos como al parpadear y se queda así. La interfaz lo acompaña con el chip de token o la etiqueta "nunca sale".
- **Tamaño:** a partir de 32 px se distinguen todas las caras; por debajo, 8 va siempre animado.
- **En la app:** hablar y escuchar deben moverse con el volumen real de la voz y del micrófono.
- **Archivos:** logos trazados, icono de app y favicon en `brand/logo/`.
- **Expresiones a medida:** si ningún estado encaja, el agente crea una con un JSON (esquema en `brand/8/expresion.schema.json`). El motor lo valida y recorta a rangos seguros; API `P8.definir`, `P8.poner`, `P8.mezclar`. Taller en `docs/ojos.html`.

### Decisiones tomadas

- [x] Caras de datos: asteriscos para tokenizado y ojos cerrados (cierre de parpadeo) para nunca sale.
- [x] Paleta y fuentes de `docs/plan.html` unificadas con la marca.
- [x] Pronunciación: Priv8 se lee "priveit" (priv + *eight*); Priv8 CUA, "priveit ce u a".
- [x] Nombre Priv8 revisado: hay un registro "PRIV8" de Orchid en EE. UU. (clases 35/41, eventos) y "priv8" es jerga de exploits. Para la hackathon se mantiene, escrito siempre "Priv8 CUA". Antes de un uso comercial: búsqueda en EUIPO, OEPM y WIPO (clases 9, 36 y 42).


## Archivos

- `docs/plan.html`: estrategia actual (Priv8 CUA y sus dos verticales, demo, métricas, rúbrica, plan de 2 días).
- `docs/arquitectura.html`: arquitectura completa, contratos, flujos y reparto por persona. Resumen en `docs/arquitectura.md`.
- `docs/marca.html`: guía de marca.
- `docs/ojos.html`: 8 en vivo, con todas las emociones, estados y el código de animación.
- `docs/archivo/logo.html`: exploración antigua del logo (sustituida, se conserva como archivo).
- `brand/logo/`: logos trazados, icono de app (16 a 512 px) y favicon.
- `brand/tokens.css`: variables de marca para la app, la consola y la banca simulada.
- `bases/bases-hackathon.pdf`: bases y rúbrica oficiales.
- `research_notes/` y `reports/`: investigación de mercado y validaciones que llevaron a la decisión.
