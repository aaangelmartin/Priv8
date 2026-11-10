# Contexto común para la investigación (leer primero)

Fecha: 10 de noviembre de 2026. Objetivo: encontrar las mejores ideas para ganar la hackathon de finanzas **Hackfinance** (Madrid Engineering Week, organiza BEST UC3M). Patrocinadores visibles en las bases: **GPTadvisor, MyInvestor, Claude (Anthropic), ElevenLabs, Hackfinance, BEST**.

## Rúbrica oficial (bases)
- Innovación y viabilidad 30 %: problema real de finanzas; solución útil y aplicable; viable financieramente; factor novedoso y competitivo frente al mercado.
- Uso de capacidades de IA de frontera 15 %: la IA aporta valor diferencial; se apoya en **tecnologías de lenguaje y audio avanzado** y genera un **impacto medible** en usabilidad, interactividad o accesibilidad.
- Experiencia de usuario y accesibilidad 15 %: interfaz clara, funcional, intuitiva; tiempos de respuesta razonables.
- Implementación técnica 30 %: solución acabada, madura, funcional y lista para ejecutar.
- Presentación 10 %: problema, solución y arquitectura claros; impacto y valor diferencial; tiempo y respuestas al jurado.

## Entregables (bases)
Repo GitHub público o compartido; ZIP de "Download ZIP" (es lo que se evalúa); README con descripción, requisitos, instalación, configuración, ejecución y prueba; PDF de una cara (problema, solución, valor diferencial); PowerPoint. La demo debe corresponder a la versión entregada. Plazo estimado de construcción: 1 a 3 días, equipo de 4 personas.

## Lo que ya tiene el equipo
- **Priv8** (núcleo técnico, reutilizable): un agente de IA que usa pantallas (computer use / navegador) opera sobre **datos tokenizados** (los datos sensibles se cambian por tokens tipo [IBAN_1] antes de llegar al modelo); un **ejecutor local** pone los valores reales al actuar; un **oráculo** compara cifras sin revelarlas (¿cubre el saldo?, ¿coincide el titular?); una **política de procedencia** (control de flujo de información, estilo CaMeL) impide que datos o instrucciones de terceros (correos, notas, PDF) entren en campos de pago o cambien la operación; **retención humana** de lo irreversible; **expediente/auditoría firmada**. Marca cerrada (Cobalto, Sora/IBM Plex) y personaje **8** (unos ojos animados con 28 estados y voz).
- **Open2Agents** (ganó otra hackathon el fin de semana pasado): una puerta para que las tiendas dejen comprar a los agentes de IA y bloqueen scrapers: identidad del agente (Web Bot Auth, Visa TAP), mandatos AP2, aprobación en el móvil, expediente firmado contra chargebacks.
- Medición propia: OCR (Apple Vision) sobre fichas de terminal: nítido IBAN 120/120, por escritorio remoto 8/120; por eso se lee el DOM, no píxeles.

## Opción actual (a mejorar o superar)
**Mandato 8**: la IA trabaja con la cartera del cliente sin verla (tokens), nadie puede manipularla (procedencia), y la confirmación sigue en la app del banco con el mandato y pruebas firmadas. Primer caso: traspasos de fondos y planes de otros bancos a MyInvestor. Hechos: el conector MCP de MyInvestor (jun 2026, con GPTadvisor) es público, sin autenticación, solo catálogo (~2.300 fondos), la compra se termina en la app "por seguridad". FIDA (open finance para inversiones) va camino de retirarse (borrador Comisión 3 nov 2026). Otro equipo de Hackfinance prepara "Rumbo", copiloto fiscal por voz para nómadas digitales.

## Ideas descartadas por el usuario por típicas
"Asistente de finanzas con IA", "asistente por voz para mayores contra estafas", "proxy que tapa datos" a secas. El usuario quiere algo **novedoso, no la típica app de finanzas con IA**, **validado, con mercado, funcional y que siga la rúbrica**.

## Formato obligatorio para cada idea candidata que propongas
Para cada concepto (mínimo 3 por investigador, idealmente 4-5):
1. **Nombre** y frase de una línea.
2. **Problema** con evidencia cuantificada y fuente (cifras, regulación, fechas).
3. **Quién paga y cuánto** (modelo de negocio, tamaño de mercado en España/UE con fuente).
4. **Competencia**: quién lo hace ya (YC con batch, aceleradoras, startups ES/UE, incumbentes) y **qué les falta** exactamente.
5. **Qué hacemos nosotros** y qué parte del núcleo Priv8 / 8 / Open2Agents reutiliza (o si no reutiliza nada, dilo).
6. **Por qué es novedoso** (qué no existe hoy).
7. **IA de frontera y audio**: cómo usa Claude y ElevenLabs y **qué métrica medible** se puede enseñar en la demo.
8. **Demo de 3 minutos** y **viabilidad de construirla en 1-3 días** (qué APIs/datos reales hay, qué se simula).
9. **Encaje con patrocinadores** (MyInvestor, GPTadvisor, Claude, ElevenLabs).
10. **Puntuación** 1-5 en cada criterio de la rúbrica y ponderada, con justificación.
11. **Riesgos** y lo que no está verificado.
12. **Fuentes** (URL en cada afirmación).
