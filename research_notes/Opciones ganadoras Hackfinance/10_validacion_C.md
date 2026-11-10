# Validación adversarial C: seis conceptos de voz, consumo y cumplimiento

Fecha: 10 nov 2026. Validador C. Fuentes de partida: `05_accesibilidad_inclusion.md`, `06_regtech_b2b.md`, `07_consumidor_tramites.md`, `01_yc_aceleradoras.md` (Renta Probada) y `reports/Producto ganador Hackfinance.md` (Albacea). Se hicieron unas 16 búsquedas y lecturas nuevas: el texto consolidado de la Ley 10/2025 en el BOE, el análisis de Gómez-Acebo & Pombo extraído del PDF, la competencia en pruebas de voicebots, analítica de voz MiFID, cancelaciones, herencias, ayudas y la cartera EUDI. Las puntuaciones son juicio del validador.

Escala 1-5. Ponderada = 0,30·Innovación + 0,15·IA/audio + 0,15·UX + 0,30·Implementación + 0,10·Presentación.

---

## Resumen

| # | Concepto | Veredicto | Innov. | IA | UX | Impl. | Pres. | **Ponderada** | Nota original |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Recorrido Hablado + Prueba B2 | **KEEP WITH CHANGES** | 3,5 | 4,5 | 4,5 | 4 | 4 | **4,00** | 4,40 / 4,23 |
| 4 | Prueba de Baja | **KEEP WITH CHANGES** | 3,5 | 5 | 4 | 4 | 4,5 | **4,05** | 4,25 |
| 5 | Albacea que llama | **DROP** como producto (se queda como escena o segundo caso) | 3,5 | 3,5 | 4 | 2,5 | 4,5 | **3,38** | 4,10 |
| 2 | Cliente Misterioso 8 | **DROP** (como mucho, módulo) | 2,5 | 4,5 | 3,5 | 4 | 4 | **3,55** | 4,40 |
| 6 | Lo que te toca / Renta Probada | **DROP** (el oráculo sí/no pasa a la demo principal) | 3 | 3 | 4 | 3 | 4 | **3,25** | 3,95 / 4,08 |
| 3 | Escucha MiFID | **DROP** | 2,5 | 3,5 | 3 | 4 | 3 | **3,23** | 4,15 |

**Hallazgos que cambian la decisión:**
1. **La regla de los 3 minutos no obliga directamente a los bancos.** La Ley 10/2025 dice que los servicios financieros se rigen por su normativa sectorial y que ella misma solo es supletoria (art. 2.1.e y 2.5). Su DF 2.ª reescribe el art. 29 de la Ley 44/2002 y para el teléfono solo exige atención "a la mayor brevedad posible" por un operador o agente, sin minutos ni porcentaje. También quedan fuera para finanzas la auditoría ENAC y las sanciones (arts. 21-23). Con eso pierde la base legal la tesis de "Cliente Misterioso" para bancos, y también el uso que "Prueba de Baja" hacía de los 3 minutos como prueba en las bajas de seguros bancarios.
2. **"Nadie llama para auditar voicebots" es falso.** Cyara (incumbente en pruebas de IVR) lanzó en marzo de 2026 módulos de Compliance y Bias para agentes de IA, y Hamming (YC S24), Cekura (YC F24) y Coval (Serie A de 28 M$) hacen llamadas simuladas a agentes de voz.
3. **"Nadie revisa llamadas en español" es falso.** Fonetic, empresa española, analiza el 100 % de las llamadas de las mesas de BBVA y Santander para MiFID desde hace más de diez años. Aveni Detect (Reino Unido, 12 M£ en 2026, con Lloyds y Nationwide como inversores) revisa casi el 100 % de las llamadas de asesoramiento.
4. **LO 1/2025 (MASC):** la grabación de una llamada de baja no es por sí sola un MASC. El art. 10 pide un documento que pruebe que la otra parte recibió una solicitud de *negociar*, y la Audiencia Provincial de Barcelona dice que una reclamación previa a secas no basta. Hay que corregir el pitch.

---

## 1. Recorrido Hablado + Prueba B2 (8 Accesible)

**Veredicto: KEEP WITH CHANGES.** De los seis, es el que mejor encaja con la rúbrica (15 % de UX y accesibilidad más 15 % de audio) y con los patrocinadores (MyInvestor, por el traspaso y el KID). Pero hay que quitarle el "nadie hace la operación por voz" y apoyar la novedad en la **prueba de fidelidad** y en la **privacidad**, no en la voz.

**Puntuación corregida:** Innovación 3,5 · IA 4,5 · UX 4,5 · Implementación 4 · Presentación 4 → **4,00** (antes 4,40 y 4,23).

**Hechos verificados**
- La Directiva 2019/882, Anexo I, Sección IV, exige para banca de consumo que la identificación, la firma electrónica, la seguridad y los pagos sean perceptibles, operables, comprensibles y robustos. La información no puede superar el nivel B2 del MCER — [EUR-Lex 32019L0882](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32019L0882).
- CaixaBank es miembro de la Red Panhispánica de Lenguaje Claro de la RAE y ya tiene un proyecto de **Lectura Fácil** de contratos — [CaixaBank](https://www.caixabank.com/es/actualidad/noticias/caixabank-primer-banco-miembro-de-la-red-panhispanica-de-lenguaje-claro-y-accesible-de-la-rae).
- El asistente Blue de BBVA admite órdenes dictadas por micrófono, cubre según el banco "el 100 % de las operaciones de la app" y tiene un agente que ejecuta Bizum dentro del chat. Bizum también funciona con Siri — [Valencia Plaza](https://valenciaplaza.com/valenciaplaza/blue-asistente-virtual-bbva); [BBVA AI Factory](https://www.bbvaaifactory.com/specialized-ai-agents-in-an-ai-assistant/).

**Afirmaciones corregidas o refutadas**
- "Ningún competidor completa la operación por voz": **refutado** dentro de cada banco (BBVA Blue). Lo que sigue abierto es (a) hacerlo *entre bancos* y del lado del usuario, (b) sin que el modelo vea los datos y (c) con prueba firmada.
- "Nadie hace contratos en lectura fácil": **refutado** (CaixaBank). Lo que no aparece en ninguna parte es la **verificación automática de que no cambió ninguna cifra ni obligación**.
- "B2 medible": no hay un método oficial. Los índices Fernández-Huerta e INFLESZ solo aproximan el nivel. Hay que presentarlo como "estimación" y no como "cumplimiento".

**Competidores que faltaban:** BBVA Blue (voz dentro del banco); los agentes de navegador generalistas con voz (ChatGPT en modo agente, Gemini en Chrome, Perplexity Comet), que ya pueden operar una web bancaria sin ninguna capa de privacidad; CaixaBank Lectura Fácil y Plena Inclusión (adaptación humana); Deque/axe y Evinced (auditoría automática de recorridos de accesibilidad; no verificado en esta ronda); Prodigioso Volcán (legal design en español, consultoría).

**Bloqueos legales:** la SCA de PSD2 la tiene que hacer el titular, y eso se queda así. El agente que actúa sobre la web real del banco en nombre del usuario es una zona gris respecto a los términos de uso, y por eso la demo usa banca simulada. Hay que evitar decir "cumple la Ley 11/2023" (lección de la FTC con accessiBe, multa de 1 M$, nota 05).

**Demo (3 min), real o simulado:** real: Claude con lectura del DOM, voz de ElevenLabs (STT y TTS), tokenización, el KID público de un fondo de MyInvestor y el oráculo de fidelidad. Simulado: el banco y la SCA. Se puede construir en 2 días con 4 personas, porque el núcleo existe. Guion: "Traspasa mi fondo a MyInvestor" con los ojos tapados → 8 lee el KID en B2 → la tabla de fidelidad marca 37/37 → una cifra manipulada a propósito sale en rojo → confirmación por voz y en la app.

**Métrica de IA y audio:** (1) cifras y obligaciones conservadas, N/N, con un caso negativo sembrado; (2) tiempo y número de pasos con VoiceOver frente a 8 en el mismo recorrido; (3) acierto en 3 preguntas orales de comprensión con el original frente a la versión B2 (5 voluntarios); (4) latencia de voz p50 y p95; (5) cero datos personales en los registros del modelo.

**Patrocinadores:** MyInvestor alto (traspaso y KID), Claude alto, ElevenLabs alto, GPTadvisor medio (asesor accesible).

**Pitch:** "El banco tiene que explicarte el contrato en nivel B2. 8 te lo lee y demuestra que no cambió ni una cifra."

**Riesgo principal:** que el jurado lo vea como "otro asistente de voz del banco" (Blue ya existe). La prueba de fidelidad tiene que ser lo primero que se vea en pantalla, no un detalle.

---

## 2. Cliente Misterioso 8

**Veredicto: DROP** como producto principal. Como mucho, un módulo de "autoauditoría del art. 50" para el propio voicebot de 8.

**Puntuación corregida:** Innovación 2,5 · IA 4,5 · UX 3,5 · Implementación 4 · Presentación 4 → **3,55** (antes 4,40).

**Hechos verificados (BOE, texto consolidado)**
- Art. 2.1.e: los servicios financieros "se regirán por su normativa sectorial de aplicación". Art. 2.5: la ley es supletoria para ellos y no se les aplican el art. 13.8 ni los arts. 18, 19, 21, 22 y 23 (calidad, auditoría ENAC, sanciones) — [BOE Ley 10/2025](https://www.boe.es/eli/es/l/2025/12/26/10/con).
- Arts. 8.2 y 10.3: el 95 % de las solicitudes de atención personalizada y de las llamadas deben atenderse, de media, en menos de 3 minutos. Esto rige para las empresas del ámbito general — [BOE](https://www.boe.es/eli/es/l/2025/12/26/10/con).
- La DF 2.ª reescribe el art. 29 de la Ley 44/2002 para las entidades financieras: atención personalizada "a través de un operador o agente", "a la mayor brevedad posible", prohibición de contestadores automáticos "como medio exclusivo" y coste de llamada no superior a una llamada geográfica o móvil estándar. **No fija minutos ni porcentaje** — [BOE](https://www.boe.es/eli/es/l/2025/12/26/10/con); [Gómez-Acebo & Pombo (R. Palá), ene 2026](https://ga-p.com/wp-content/uploads/2026/01/Atencion_cliente_financiero.pdf).
- La misma ley modifica el art. 21 del TRLGDCU para que los servicios financieros y de seguros cuenten como servicios básicos de interés general, con teléfono gratuito de atención al consumidor — [GA_P](https://ga-p.com/wp-content/uploads/2026/01/Atencion_cliente_financiero.pdf).
- El art. 50(1) del AI Act (avisar de que se habla con una IA) aplica desde el 2 ago 2026. El ómnibus no lo retrasó; solo el marcado del 50(2), al 2 dic 2026 para los sistemas existentes — [Jones Walker](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html); [Ropes & Gray](https://www.ropesgray.com/en/insights/viewpoints/2026/08/102nfqm/you-talkin-to-me-operationalising-the-eu-ai-acts-transparency-obligations).

**¿Obliga la Ley 10/2025 a los bancos?** Solo en parte. El art. 29 de la Ley 44/2002, que es la norma específica, ya regula la atención telefónica ("a la mayor brevedad posible"). Por eso la regla de los 3 minutos del art. 8.2 difícilmente se puede aplicar como supletoria, y aunque se aplicara no habría auditoría ENAC ni régimen sancionador propio (arts. 21-23 excluidos). Para un banco, el "semáforo de los 3 minutos" no mide ninguna obligación exigible. Lo que sí es exigible: que haya un operador humano disponible, que el bot no sea el único canal, el coste de la llamada y el aviso de IA del art. 50. Es una interpretación del validador, no un dictamen.

**Afirmaciones refutadas:** "No se ha encontrado un producto que audite llamando". Hay al menos cinco:
- Cyara, con módulos AI Trust de Compliance y Bias (mar 2026) y "outbound call testing" — [CX Today](https://www.cxtoday.com/security-privacy-compliance/cyara-launches-agentic-testing-and-ai-governance-to-close-the-ai-trust-gap-in-customer-service/); [destinationCRM](https://www.destinationcrm.com/Articles/ReadArticle.aspx?ArticleID=174127).
- Hamming (YC S24) y Cekura (YC F24) — [Coval: Hamming vs Cekura](https://www.coval.ai/blog/hamming-vs-cekura).
- Coval (Serie A de 28 M$) — [Coval](https://coval.ai/blog/coval-vs-hamming).

Ninguno vende "mapeo artículo a artículo de la ley española con expediente firmado", pero eso es una función que se les puede añadir, no un producto.

**Legalidad de las llamadas automatizadas:** no son comunicaciones comerciales, así que los derechos de la LGTel frente a llamadas no deseadas no parecen aplicar (no verificado en el texto). Los problemas reales son tres: (a) un cliente sintético con identidad falsa ante un banco es un riesgo de fraude o de términos de uso; (b) 500 llamadas por noche consumen la capacidad que necesitan los clientes reales; (c) la voz del empleado grabado es un dato personal según el RGPD. Conclusión: solo es viable con contrato del banco auditado, y en ese caso es exactamente el mercado de Cyara.

**Demo:** construible en 1-2 días (dos agentes de ElevenLabs, uno de ellos con fallos sembrados). Es buen espectáculo, pero mide normas que no obligan al comprador financiero.

**Métrica:** segundo en que llega el aviso de IA; precisión y recall sobre infracciones sembradas; error del cronómetro por debajo del 5 %.

**Patrocinadores:** ElevenLabs alto, Claude medio, MyInvestor y GPTadvisor bajo.

**Pitch (si se reutiliza como módulo):** "Antes de lanzar su voz, 8 se audita a sí mismo: aviso de IA en el primer segundo y humano a un toque."

**Riesgo principal:** el jurado (o un abogado entre el público) puede señalar que los 3 minutos no obligan a los bancos y que Cyara ya lo vende.

---

## 3. Escucha MiFID

**Veredicto: DROP.**

**Puntuación corregida:** Innovación 2,5 · IA 3,5 · UX 3 · Implementación 4 · Presentación 3 → **3,23** (antes 4,15).

**Hechos verificados**
- La obligación de grabar las comunicaciones relativas a órdenes (art. 16.7 MiFID II) y conservarlas 5-7 años es correcta (ESMA Q&A, nota 06).
- **Fonetic** (España) analiza el 100 % de las llamadas de las mesas de BBVA en España, Londres y Nueva York, y tiene a Santander como cliente para MiFID II y Dodd-Frank — [Finextra](https://www.finextra.com/pressarticle/58753/bbva-rolls-out-fonetic-linguistic-analysis-and-trading-compliance-tech); [WatersTechnology](https://waterstechnology.com/trading-tech/2276277/santander-takes-fonetic-for-dodd-frank-mifid-compliance).
- **Aveni** (Reino Unido): Aveni Detect revisa todas las llamadas de asesoramiento y marca las de riesgo. Octopus Money llegó a casi el 100 % de cobertura de QA. En 2026 levantó 12 M£ con Lloyds y Nationwide — [fintech.global, jun 2026](https://fintech.global/2026/06/04/lloyds-and-nationwide-backed-aveni-raises-12m/); [caso Octopus Money](https://www.casestudies.com/company/aveni/case-study/how-octopus-money-uses-al-to-deliver-more-personalised-advice-at-scale).
- BBVA ya procesa con IA generativa las transcripciones de sus llamadas en España (para la experiencia de cliente) — [BBVA](https://www.bbva.com/es/innovacion/bbva-mide-con-ia-la-experiencia-real-del-cliente-mas-alla-de-las-encuestas-de-satisfaccion/).

**Afirmaciones refutadas:** "En inglés, sin mid-market español, sin llamadas minoristas": Fonetic es español y Aveni hace exactamente la revisión de llamadas minoristas de asesoramiento. Solo sobrevive el diferencial "el LLM nunca ve datos personales", que es una función, no un producto. **No verificado:** cuánto volumen de órdenes telefónicas tiene un neobróker como MyInvestor. Probablemente es bajo (opera por app), y eso quita al patrocinador como cliente.

**Demo:** técnicamente es fácil (llamadas sintéticas), pero es procesamiento por lotes, sin interacción. Puntúa poco en UX y en "impacto en interactividad".

**Pitch:** "El 100 % de tus llamadas revisadas sin que el modelo oiga un DNI." Fonetic ya dice lo primero.

**Riesgo principal:** el jurado conoce a los incumbentes, y el oráculo "llamada frente a orden" no basta para justificar un producto nuevo.

---

## 4. Prueba de Baja

**Veredicto: KEEP WITH CHANGES.** Es la mejor demo de audio del lote (una llamada en directo contra un agente de retención). Pero hay que (a) quitar "válido como MASC", (b) apoyarse en el TRLGDCU y no en los 3 minutos, y (c) darle forma financiera para el jurado: "cancela este cargo recurrente desde tu banco" y bajas de seguros vinculados.

**Puntuación corregida:** Innovación 3,5 · IA 5 · UX 4 · Implementación 4 · Presentación 4,5 → **4,05** (antes 4,25).

**Hechos verificados**
- Ley 10/2025: la baja cuenta como "incidencia" (art. 3.4); hay que admitir el mismo canal por el que se contrató (art. 7.1); la respuesta llega por el mismo canal o el que elija el cliente (art. 13.5) — [BOE](https://www.boe.es/eli/es/l/2025/12/26/10/con). Esto solo obliga a las empresas del ámbito de la ley (servicios básicos y empresas de 250 o más trabajadores con más de 50 M€ de facturación). **Muchos gimnasios y servicios pequeños quedan fuera.**
- La base que aplica a todos es el TRLGDCU (RDL 1/2007), art. 62: la baja se puede pedir por la misma forma en que se contrató y sin obstáculos onerosos o desproporcionados — [BOE RDL 1/2007](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555). Citado de memoria del texto; comprobar la redacción exacta.
- Botón de desistimiento (Directiva 2023/2673): aplicable desde el 19 jun 2026. España no lo había transpuesto y hay expediente de infracción. Ojo: cubre el desistimiento de 14 días, **no** la baja de una suscripción en curso — [OCU](https://www.ocu.org/organizacion/prensa/notas-de-prensa/2026/normabotondesistimiento190626); [elderecho.com](https://elderecho.com/bruselas-expedienta-a-espana-por-no-transponer-la-directiva-sobre-servicios-financieros-a-distancia).
- Grabar una conversación en la que se participa es lícito (STC 114/1984, nota 07).

**Afirmaciones corregidas**
- "Expediente válido como prueba previa al pleito según la LO 1/2025": **sobredimensionado.** El art. 10 exige acreditar que la otra parte recibió una solicitud o invitación a negociar (con fecha y acceso al contenido), y para la AP de Barcelona una reclamación previa a secas no basta — [KPMG](https://assets.kpmg.com/content/dam/kpmgsites/es/pdf/2025/06/legal-alert-medios-solucion-controversias-masc-medida-eficiencia-procesal.pdf.coredownload.inline.pdf); [AP Barcelona](https://www.conesalegal.com/hubfs/02-Acuerdos-unificacion-criterios-OCTUBRE25_Audiencia-Provincial-de-Barcelona.pdf). Formulación correcta: "el expediente es la prueba de que pediste la baja; 8 redacta además el escrito fehaciente que abre el MASC o la reclamación al SAC".
- "Pruebas de que se incumplieron los 3 minutos": solo valen frente a empresas del ámbito general (telecos, energía, grandes empresas), no frente a bancos ni aseguradoras (ver concepto 2).
- Grabación: es lícita para el participante, pero si la graba una empresa (8) en nombre del usuario, esa empresa pasa a tratar la voz del empleado. Hace falta una base del RGPD y un aviso en la apertura. No verificado con la AEPD.

**Competidores que faltaban**
- **Pine AI**: web en español, llama, cancela y reclama, con planes de créditos — [19pine.ai/es](https://www.19pine.ai/es); [SiliconANGLE](https://siliconangle.com/2026/05/06/pine-ai-aims-consumer-ai-agent-complex-customer-service-interactions/). Es el riesgo principal: si llega a España, el diferencial se queda en la prueba y la privacidad.
- **Unsubby**: opera en España y cancela con cartas formales en nombre del cliente. Tiene quejas públicas en la OCU por cobros tras la baja — [OCU](https://www.ocu.org/reclamar/lista-reclamaciones-publicas/baja-de-suscripcion/8e1d436728c66d7103). Es un aviso útil: un "servicio que da de baja" puede acabar siendo la estafa.
- Aboalarm y Volders (Alemania, cartas de baja con justificante; de memoria, no verificado en esta ronda). Google "Ask for Me" (llamadas a negocios en EE. UU.; de memoria). Cambio (YC, negocia deudas por teléfono) — [TechCrunch](https://techcrunch.com/2024/02/13/yc-backed-cambio-puts-ai-bots-on-the-phone-to-negotiate-debt-talk-to-a-banks-customers).

**Demo:** construible en 2 días. Real: la llamada saliente de ElevenLabs con Twilio, Claude, la firma del expediente y la tokenización (el DNI solo se dice en el tramo de audio). Simulado: la empresa, interpretada por un segundo agente con guion de retención. No hay que llamar a una empresa real en directo.

**Métrica de IA y audio:** bajas confirmadas en N llamadas de prueba con guiones de retención variados; % de números de confirmación bien extraídos (STT); contraofertas resistidas sin cambiar la instrucción (procedencia); latencia por turno; minutos ahorrados al usuario; cero datos personales en el contexto del LLM.

**Patrocinadores:** ElevenLabs muy alto, Claude alto, MyInvestor medio si se presenta como "cancela desde el extracto los cargos recurrentes y los seguros de tu banco anterior", GPTadvisor bajo.

**Pitch:** "8 llama, se identifica como IA, consigue tu número de baja y te deja la prueba firmada de que la pediste."

**Riesgo principal:** que la empresa se niegue a tratar con una IA y exija al titular (es lo normal en telecos y banca). Mitigación: la llamada pasa al usuario en la verificación de identidad. Riesgo secundario: parece más un producto de consumo que de finanzas.

---

## 5. Albacea que llama

**Veredicto: DROP como producto de la hackathon.** Tiene la mejor historia, pero la llamada no aporta lo que promete y la demo es casi toda simulada. Se puede usar como segundo caso de uso de "Mandato 8" o "Prueba de Baja" en la diapositiva de mercado.

**Puntuación corregida:** Innovación 3,5 · IA 3,5 · UX 4 · Implementación 2,5 · Presentación 4,5 → **3,38** (antes 4,10 y 4,25).

**Hechos verificados**
- Para actuar, los bancos piden el certificado de defunción, el de últimas voluntades y el testamento o la declaración de herederos. Las cuentas del fallecido se consultan en la Agencia Tributaria o en el procedimiento de Sucesiones — [BdE Portal Cliente Bancario](https://clientebancario.bde.es/pcb/es/blog/que-ocurre-con-una-caja-de-seguridad-cuando-fallece-su-titular.html); [Consumer](https://www.consumer.es/economia-domestica/familia/como-saber-si-un-familiar-fallecido-dejo-testamento-o-seguro-de-vida.html).
- Heritae (Madrid, 2020): tarifa plana. Las cifras son contradictorias: 2.999 € IVA incluido hasta 200.000 € de caudal, 5.500 € la gestión integral y planificación desde 99 € más IVA — [El Referente](https://elreferente.es/inversiones/nace-heritae-startup-espanola-gestiona-manera-integral-herencias/).
- Empathy (EE. UU.): Serie C de 72 M$ (mayo 2025), con la "Empathy Alliance" de diez bancos y aseguradoras. **Esto valida el canal B2B2C por aseguradoras** que la nota 07 no había verificado — [Infor Capital](https://inforcapital.com/news/empathy-lands-72m-to-enhance-grief-and-legacy-solutions/); [Index Ventures](https://www.indexventures.com/perspectives/empathy-unites-industry-giants-to-create-new-standards-of-support/).
- Prismm: infraestructura para que los bancos retengan el patrimonio heredado — [Ecosistema Startup](https://ecosistemastartup.com/prismm-infraestructura-para-que-bancos-retengan-herencias/).
- Las 441.270 defunciones (INE) y el plazo de 6 meses del modelo 650 vienen de la nota anterior. El plazo de 6 meses es estatal y es correcto; la cifra de defunciones no se revisó en esta ronda.

**Afirmaciones corregidas**
- "8 llama a cada banco para pedir el saldo a fecha de defunción": por secreto bancario y protección de datos, ningún banco da saldos por teléfono a un tercero sin acreditar la condición de heredero. El trámite es **documental** (envío de documentación, a veces presencial). La llamada aporta poco más que "¿qué documentos piden y dónde?".
- "Solo Hacienda sabe qué cuentas había": es aproximado. El heredero puede pedir la información fiscal a la AEAT. Pero eso exige su Cl@ve o certificado, que no se puede automatizar.

**Competidores que faltaban:** Empathy (EE. UU., grande, B2B2C), Prismm, y servicios británicos de notificación única a varias entidades (Life Ledger, Settld; de memoria, no verificado).

**Demo:** necesitaría simular Justicia, notario, la AEAT y varios bancos. En 2 días queda como "maqueta de seis portales". Implementación 2,5.

**Métrica:** días hasta el mapa de bienes; entidades contactadas; euros localizados. En la demo todo sería simulado, así que las cifras no convencen.

**Patrocinadores:** MyInvestor medio (reinversión del dinero heredado; "ejecuta, no aconseja"), ElevenLabs y Claude medio.

**Pitch:** "Seis meses para el 650 y diez entidades distintas: 8 lleva el expediente y tú solo firmas."

**Riesgo principal:** es una demo de cartón piedra, con el usuario en duelo y mayor, muy cerca del "asistente por voz para mayores" que el usuario descartó.

---

## 6. Lo que te toca / Renta Probada (fusionados)

**Veredicto: DROP** como producto. El **oráculo sí/no sobre ingresos** sí es una escena excelente para enseñar el núcleo de Priv8: se puede pasar a la demo principal ("¿cubre el saldo el traspaso?", "¿ingresos por debajo del umbral?").

**Puntuación corregida:** Innovación 3 · IA 3 · UX 4 · Implementación 3 · Presentación 4 → **3,25** (antes 3,95 y 4,08).

**Hechos verificados**
- Cuarta opinión de la AIReF sobre el IMV (julio 2025): non take-up del **55 % en el IMV y del 72 % en el CAPI**, similar a años anteriores. En Baleares y Cataluña pasa del 65 % — [El Salto](https://www.elsaltodiario.com/renta-basica/55percent-hogares-podrian-recibir-imv-no-lo-han-solicitado-segun-airef); [Menorca.info](https://www.menorca.info/actualidad/nacional/2024/07/10/2201195/ingreso-minimo-vital-mas-mitad-hogares-solicitan.html). Corrige el 56 % de la nota 07, que es la cifra de 2023. No se encontró una opinión de 2026.
- El CAPI se reconoce dentro del IMV cuando la Administración ya tiene los datos verificados — [Guía Ministerio vía El Debate](https://www.eldebate.com/familia/20260528/asi-puedes-pedir-ayudas-benefician-familias-actualizadas-gobierno_422124.html).
- Cartera EUDI (eIDAS 2): cada Estado debe ofrecer al menos una cartera gratuita antes del **24 dic 2026**, con divulgación selectiva ("compartir solo lo que pide el servicio"). El estado de España es dudoso: eIDEasy lo rebajó en julio de 2026 a "proyecto anunciado" — [Garrigues](https://www.garrigues.com/es_ES/garrigues-digital/cartera-europea-identidad-digital-ya-tiene-calendario-tareas-completar-antes); [eIDEasy, jul 2026](https://www.eideasy.com/blog/eu-digital-identity-wallets-july-2026).

**Afirmaciones corregidas o refutadas**
- "Sin que el modelo vea tus ingresos" como valor: es **débil para el comprador.** La Seguridad Social y la AEAT ya tienen esos datos, y al hogar vulnerable le importa cobrar, no que Claude no vea su renta. La privacidad es un requisito higiénico, no la razón de compra.
- "Renta Probada: verificación sin revelar sobre datos públicos españoles, no existe": la divulgación selectiva es justo la función de la cartera EUDI, que llega por ley en diciembre de 2026. Los certificados de la AEAT ya llevan un CSV verificable, y Tink, Plaid y otros agregadores verifican ingresos por open banking. El hueco se cierra solo por la vía institucional.
- "Nadie comprueba todas las ayudas": TaxDown ya publica guías de ayudas y busca deducciones en la renta — [TaxDown](https://taxdown.es/ayudas/ayudas-inflacion). La AIReF propone conceder el IMV de oficio, que es la amenaza estructural.

**Bloqueos legales:** Cl@ve no se puede automatizar. La presentación por terceros necesita apoderamiento o ser colaborador social. Una base de reglas con más de 300 deducciones autonómicas no se valida en 2 días, y una regla mal aplicada perjudica a un hogar vulnerable.

**Demo:** se puede construir el oráculo con 3 perfiles y 2-3 comunidades, pero el resto (Renta Web, Seguridad Social) es una maqueta. La voz tiene poco papel.

**Métrica:** euros identificados por hogar; campos revelados al tercero (0 de N); tiempo frente al baseline. La métrica de audio es débil.

**Patrocinadores:** Claude medio, ElevenLabs bajo-medio, MyInvestor y GPTadvisor bajo.

**Pitch:** "8 te dice a qué tienes derecho sin mirar lo que ganas."

**Riesgo principal:** suena a "asistente de finanzas con IA" con trasfondo social, sin comprador claro y con la cartera EUDI y el IMV de oficio comiéndose el hueco.

---

## Conclusiones para la shortlist

1. **De este lote, el que se queda es 1 (Recorrido Hablado + Prueba B2)**, con la prueba de fidelidad como protagonista y el traspaso a MyInvestor como recorrido de la demo. Encaja con "Mandato 8": el mandato se lee en B2 con prueba de fidelidad antes de firmar.
2. **El segundo es 4 (Prueba de Baja)**, que da el mejor 15 % de audio, pero hay que darle forma financiera (cargos recurrentes y seguros vinculados desde la app del banco) y quitar las afirmaciones sobre el MASC y los 3 minutos.
3. **Piezas que se pueden aprovechar de los descartados:** el oráculo sí/no (6) como escena del núcleo; la autoauditoría del art. 50 (2) para el propio voicebot de 8; el canal B2B2C por aseguradoras que valida Empathy (5) para la diapositiva de mercado.
4. **Queda sin verificar:** la redacción exacta del art. 62 del TRLGDCU; el criterio de la AEPD sobre que un tercero grabe en nombre del usuario; el volumen de órdenes telefónicas de MyInvestor; el WER de Scribe v2 en español financiero (ElevenLabs solo publica cifras agregadas: [ElevenLabs Scribe v2](https://elevenlabs.io/blog/introducing-scribe-v2)). Este último hay que medirlo en la propia demo.
