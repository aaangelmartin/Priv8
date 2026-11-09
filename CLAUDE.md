# Priv8 CUA — contexto del proyecto

Proyecto del equipo para la hackathon de finanzas de la Madrid Engineering Week (MEW). Las bases y la rúbrica están en `bases/bases-hackathon.pdf`.

## Qué construimos

**Priv8 CUA** es un protocolo de privacidad para *computer-use agents* (CUA): agentes de IA que usan pantallas como una persona. Los datos sensibles de cada pantalla se sustituyen por tokens antes de llegar al modelo, y se rehidratan solo en local al ejecutar la acción. El agente hace el trámite sin ver los datos.

- **Núcleo general:** sirve para cualquier sector.
- **Perfil Finanzas:** la primera aplicación y el foco de la hackathon.
- **Modelo:** B2B. Lo adoptan bancos y brokers que quieren ofrecer agentes, empresas que los construyen y departamentos financieros.
- **Frase clave:** "Visa y Google resolvieron cómo paga un agente. Priv8 CUA resuelve qué ve mientras trabaja."

## Las seis piezas del protocolo

1. **Tokens** tipados y estables por sesión: `‹IBAN_1·propio›`, `‹IMPORTE_3·positivo›`. La tabla token → valor vive solo en el entorno de confianza.
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

## Qué construir, en orden

| | Pieza | Stack sugerido |
|---|---|---|
| A | Especificación del protocolo (`SPEC.md`) | Markdown |
| B | Núcleo / SDK: detector, tokenizador, políticas YAML, oráculo, ejecutor, bloqueo, auditoría | Python |
| C | Servidor MCP con herramientas cerradas: `observe`, `act`, `oracle` | MCP + Claude API |
| E | Banca simulada: login, saldo, movimientos, transferencias, domiciliaciones y una trampa de inyección de instrucciones. Nombre inventado, nunca una marca real | React |
| D | Adaptador web: lee el DOM, toca y escribe | Playwright |
| F | App de referencia: chat + voz, renderizador local, confirmaciones habladas | React + ElevenLabs + Web Speech |
| G | Consola de auditoría: vista dividida "lo que ves / lo que ve la IA", fugas bloqueadas, latencia por paso | React |
| H | Métricas con pantallas sintéticas: % de datos que llegan al modelo, tareas completadas y latencia añadida, con y sin protocolo | Python |
| I | Entregables de las bases | — |
| J | (Opcional) Adaptador Android con servicio de accesibilidad | Kotlin |

### Reglas importantes

- El agente **nunca** tiene acceso directo al navegador o al sistema: sin `eval`, sin CDP crudo, sin adb, y sin escribir sus propios helpers. Solo herramientas cerradas.
- El agente **ejecuta, no aconseja** inversiones (el asesoramiento financiero está regulado).
- La app de referencia es obligatoria: la rúbrica da un 15% a UX y otro 15% a lenguaje y audio, y un protocolo sin interfaz no puntuaría ahí.

### Demo (unos 3 minutos)

1. El mismo trámite sin protocolo: la consola muestra todo en claro.
2. Por voz: "¿Cuánto tengo entre mis cuentas?", ya con Priv8 CUA. La consola solo muestra tokens y la cifra real se oye con la voz local.
3. "Pasa 200 € al broker": el agente lo prepara y pide confirmación por voz.
4. Una inyección de instrucciones escondida en la página queda bloqueada.
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
  - Noche `#0B1B33`: seriedad.
  - Cobalto `#2D45D6`: marca y acciones.
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

## Logo: los ojos (8)

Los ojos son el agente y se llama **8**, que se lee 8 o Eight. La referencia viva de sus estados es `docs/ojos.html`.


La implementación de referencia es el `<script>` de `docs/logo.html`.

- **Construcción:** el 8 de Sora con su anillo inferior reflejado arriba, de modo que los dos huecos son iguales, y girado 90°. Los dos huecos son los ojos. El script mide el glifo real de Sora en un canvas y coloca pupilas y párpados en los huecos.
- **Comportamiento**, inspirado en GrokBot:
  - Todo con muelles amortiguados.
  - Pupilas redondas con escorzo hacia el borde.
  - Cabeza que sigue a la mirada con retraso.
  - Parpadeos simples, dobles y guiños.
  - Estados: mirar (sigue el puntero), pensar (entrecierra y mira arriba), cargando (se encoge en tres puntos), listo (rebote y ojos sonrientes), sorpresa, sueño y proteger dato.
- **Sistema de estados de los datos:** 8 **ve** (verde) o **no ve** (ámbar y rojo). Hay una sola cara para no ver, porque el agente no ve ni un token ni un dato que nunca sale; la diferencia entre ámbar y rojo se muestra en la interfaz (chip de token frente a etiqueta "nunca sale"), no en los ojos. Cara de "no ve" por defecto: los huecos de los ojos se cierran y quedan recortados en forma de asterisco.
- **24 opciones animadas de "no ver"**, sin vendas: manos, manos espiando, telón, bóveda, cerradura, candado, asteriscos, contraseña, ojos apretados, mirar a otro lado, ojos en blanco, dormido, gafas de sol, persiana, cremallera, pixelado, niebla, huella, tokens, almohadilla, binario, glitch, escudo y texto tachado.

### Decisiones pendientes

- [ ] Confirmar la cara de "no ve" (propuesta: asteriscos). Ya no hay una cara para tokenizado y otra para nunca sale.
- [ ] Comprobar que el nombre Priv8 no choca con otra marca.
- [ ] Unificar la paleta de `docs/plan.html` con la de la marca (el plan usa un azul anterior, `#2F43D0`).

## Archivos

- `docs/plan.html`: plan completo del proyecto (problema, protocolo, arquitectura, rúbrica, fases, demo).
- `docs/marca.html`: guía de marca.
- `docs/logo.html`: logo de los ojos, interactivo, con todo el código de animación.
- `brand/tokens.css`: variables de marca para la app, la consola y la banca simulada.
- `bases/bases-hackathon.pdf`: bases y rúbrica oficiales.
