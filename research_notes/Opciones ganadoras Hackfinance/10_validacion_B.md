# 10 - Validación adversarial B: Titular 8 / Pago Blindado, Expediente 59, Prueba de Origen, Cobro 8, Mandato A2A

Fecha: 10 nov 2026. Método: lectura de 01, 03 y 04; unas 30 búsquedas y lecturas nuevas. Fuentes primarias leídas en texto completo: el **texto del PSR adoptado por el Consejo** (doc. ST-8221-2026, extraído a texto y leído en los arts. 50, 57, 59, 59a y en la disposición final de aplicación), la **Ley 3/2004 consolidada en el BOE** (arts. 4, 7 y 8), la **Resolución del Tesoro del 30 jun 2026** (BOE-A-2026-14327) y la **Ley 10/2025 de atención a la clientela** (BOE-A-2025-26698). Lo que viene de proveedores va marcado **[vendor]**.

Ponderación: Innovación y viabilidad 30 %, IA de frontera 15 %, UX 15 %, Implementación técnica 30 %, Presentación 10 %. Notas de 1 a 5.

---

## Resumen

| # | Concepto | Nota original | Nota corregida | Veredicto |
|---|---|---|---|---|
| 1 | Titular 8 / Pago Blindado | 4,30 / 4,35 | **4,05** | KEEP WITH CHANGES (absorbe Prueba de Origen) |
| 2 | Expediente 59 | 4,25 | **3,98** | KEEP WITH CHANGES |
| 3 | Prueba de Origen | 4,13 | 3,28 (por separado) | MERGE INTO 1 (y su parte de evidencia en 2) |
| 4 | Cobro 8 | 4,08 | **3,78** | DROP como producto principal; como mucho, módulo secundario de 1 |
| 5 | Mandato A2A | 3,85 | **3,20** | DROP (o MERGE INTO Mandato 8 / Open2Agents) |

**Lo que cambia:**
- Las notas originales eran optimistas sobre todo en innovación, porque los informes no buscaron la competencia directa:
  - Spendflo, Trustmi y Eftsure + Sis ID + Relish en el caso 1.
  - Murphy, que es española, tiene voz y la financia ElevenLabs, en el caso 4.
  - TrueLayer y Yapily en el caso 5.
- El PSR existe y el art. 59 es real. Sin embargo:
  - solo cubre a **consumidores**;
  - solo cubre la suplantación **del propio PSP por canales que se le atribuyen**;
  - se aplica a los **21 meses de la entrada en vigor**, y el texto todavía no está en el DOUE.
- Por eso, el ángulo "PSR" no sirve para el caso 1, que es B2B.

---

## 1. Titular 8 / Pago Blindado (cuentas a pagar: un IBAN llegado por email o PDF no entra en el campo de pago hasta que 8 llama al proveedor)

**Veredicto: KEEP WITH CHANGES.** Es el que mejor enseña el núcleo de Priv8 en vivo. Pero no es cierto que "no hay ningún producto que haga esto": el flujo "detectar el cambio en el email, retener y verificar llamando al número que ya consta" ya existe. Lo que aún no está en el mercado es esto:
- (a) la regla impuesta **por código**, con control de flujo de información, en vez de por proceso humano;
- (b) la **llamada hecha por el agente** y su resultado, evaluado y firmado;
- (c) que el modelo no ve el IBAN, porque solo maneja tokens.

El pitch tiene que apoyarse en esas tres cosas.

### Notas corregidas
| Criterio | Antes | Ahora | Por qué |
|---|---|---|---|
| Innovación y viabilidad | 5 / 4,5 | **3,5** | Spendflo ya vende un "AI bank detail change verification agent". Trustmi, Eftsure, Trustpair y Abnormal cubren el cambio de IBAN. El hueco sigue ahí (control de flujo de información + llamada automática + firma), pero es más estrecho. En España no hay cifra de pérdidas. |
| IA de frontera | 4 | **4** | Llamada saliente real con ElevenLabs, más Claude evaluando la respuesta y extrayendo la "semántica de cambio". Se puede medir. |
| UX | 4 | **4** | |
| Implementación | 4 / 4,5 | **4,5** | La procedencia, los tokens, el ejecutor y el expediente ya existen. El VoP y el portal del banco se simulan. |
| Presentación | 4 / 4,5 | **4,5** | El momento "el estafador pierde en directo" funciona. |
| **Ponderada** | 4,30 / 4,35 | **4,05** | 1,05 + 0,60 + 0,60 + 1,35 + 0,45 |

### Hechos verificados
- **VoP, primer año (datos de la EPC presentados en ago 2026, vía Qombo [vendor]):**
  - ~2.200 M de consultas en el T2 2026.
  - 66,2 % match, 16,2 % close match, 15,4 % no match.
  - El 95 % responde en menos de 1 s.
  - No hay datos de España.
  - [Qombo](https://www.qombo.tech/en/blog/verification-of-payee-one-year-on)
  - Otras series de 2025 dan órdenes parecidos: Luxemburgo 60/19/14 ([ABBL](https://www.abbl.lu/verification-of-payee-consolidation-in-europe-and-strong-adoption-in-luxembourg/)), Worldline 61/25/14 ([Worldline](https://worldline.com/en/home/main-navigation/resources/blogs/2025/verification-of-payee-is-now-live-in-the-eurozone)).
  - Con esto, "1 de cada 3 consultas da aviso" se sostiene como orden de magnitud. El 80 % de opt-out de Deutsche Bank sigue siendo de fuente secundaria.
- **El PSR amplía el VoP a todas las transferencias, también fuera del Reg. 260/2012 (art. 50).** Si el PSP aplica mal el servicio, responde con reembolso inmediato (art. 57). Los arts. 50 y 57 se aplican **27 meses** después de la entrada en vigor — [PSR, texto del Consejo ST-8221-2026](https://data.consilium.europa.eu/doc/document/ST-8221-2026-INIT/en/pdf).
- **Considerando (73) del PSR:** los usuarios que no son consumidores pueden darse de baja del VoP en canales de lotes automatizados, o pactar que la comprobación se haga *después* de autorizar. Esto confirma por ley el hueco de las remesas que Titular 8 cubre — [ST-8221-2026](https://data.consilium.europa.eu/doc/document/ST-8221-2026-INIT/en/pdf).
- **España ya tiene un servicio de Iberpay que valida el CIF del titular contra el IBAN.** Lleva años funcionando y va más allá del nombre del VoP — [BBVA CIB, abr 2026](https://www.bbvacib.com/insights/news/bbva-cib-new-generation-fraud-treasury/).
  - Para B2B en España es mejor que el VoP. El oráculo de 8 debería consultarlo (en la demo, simulado) y no solo el VoP.

### Afirmaciones corregidas o refutadas
- "Ningún producto une VoP, procedencia y verificación por voz con prueba firmada" (03 y 04) **es parcialmente falso**:
  - [Spendflo](https://www.spendflo.com/agents/ai-bank-detail-change-verification-agent) **[vendor]** detecta solicitudes de cambio en emails, mensajes de portal y adjuntos, retiene los pagos pendientes y prepara la verificación por callback. **La llamada la hace una persona.**
  - Lo único nuevo es que la llamada sea del agente y que la regla sea de flujo de información, no de rol.
- "Payhawk podría añadir un callback": el riesgo real son Spendflo, Eftsure y Trustpair, que ya están ahí.
- Riesgo que el informe no vio: el **"callback" está en entredicho por la clonación de voz** ([Traceless](https://traceless.com/learn/vendor-payment-fraud-and-why-verification-keeps-failing/)).
  - Llamar al número que ya consta sigue siendo robusto frente al spoofing entrante, pero un jurado puede preguntar "¿y si la voz que contesta es clonada?".
  - Mitigación: 8 no pregunta "¿confirma el cambio?". Hace un **desafío de conocimiento** (número y fecha de la última factura pagada, que el estafador del buzón puede conocer; mejor un dato del maestro que no viaja por email) y, si hay discrepancia, pide un segundo canal.
- Ley 3/2004 en el BOE: no aplica aquí (ver Cobro 8).

### Competidores que faltaban
- **Spendflo** (EE. UU.): agentes de verificación del cambio de datos bancarios, con callback humano — [Spendflo](https://www.spendflo.com/agents/ai-bank-detail-verification-agent).
- **Eftsure + Sis ID (Francia, presente en Europa) + Relish** (EE. UU., validación de datos de proveedor con IA, comprada en sep 2026). Protege 288.000 M$ al año y monitoriza 11 M de proveedores **[vendor]** — [Eftsure](https://www.eftsure.com/en-au/blog/company-news/eftsure-teams-up-with-sis-id/); [Dealroom](https://dealroom.co/news/149229-eftsure-buys-relish-to-protect-288b-in-payments-a-year/).
- **Trustpair** (Francia): validación continua de la titularidad de cuentas. Más de 500 empresas, alianza con Coupa (abr 2026) y con Certa (jun 2026). Su marketing dice literalmente "No more manual callbacks" **[vendor]** — [Trustpair](https://trustpair.com/products/account-validation/); [Fintech Futures](https://www.fintechfutures.com/press-releases/trustpair-and-coupa-expand-partnership-to-help-enterprises-prevent-ai-driven-vendor-payment-fraud).
- **Trustmi** (Israel, Insight Partners): seguridad de pagos en cuentas a pagar con IA, antifraude BEC — [Insight](https://www.insightpartners.com/ideas/trustmi-leadership-story/).
- **Abnormal Security**: detecta el fraude de factura en el email — [Abnormal](https://abnormal.ai/learning/invoice-fraud-ai).
- **Iberpay** (validación CIF–IBAN en España), Meelo, iPiD y SurePay (comprobación de nombre/IBAN).
- **YC:** no he encontrado ninguno que haga exactamente esto. El más cercano es BeeSafe AI (W26, ingeniería social) — [YC Fraud Prevention](https://www.ycombinator.com/companies/industry/fraud-prevention).
- **Holded y Pleo:** no encontré funciones de verificación de IBAN. Sigue sin verificar.

**Qué les falta a todos:** ninguno impide *por construcción* que un dato de contenido de terceros llegue al campo de pago. Validan la cuenta (titular/CIF), no de dónde vino la instrucción. Y ninguno hace la llamada con un agente que deje un registro firmado. Esa es la frase del jurado.

### Bloqueos legales
- **AI Act art. 50(1):** en vigor desde el 2 ago 2026, sin aplazar por el Omnibus. 8 tiene que decir al principio de la llamada que es una IA — [Goodwin](https://www.goodwinlaw.com/en/insights/publications/2026/08/alerts-technology-dpc-eu-ai-act-transparency-obligations-now-in-force).
- **RGPD:** la llamada a un contacto B2B del proveedor puede apoyarse en el interés legítimo. La grabación hay que anunciarla.
- **Telecomunicaciones:** desde el 7 jun 2025 está prohibido hacer llamadas comerciales desde móviles (Orden TDF/149/2025). Esta llamada no es comercial, pero conviene un número fijo o de empresa — [Fieldfisher](https://www.fieldfisher.com/ca-es/locations/espana/actualidad/7-de-junio-prohibicion-de-las-llamadas-comerciales).
- No hay bloqueo de fondo.

### Demo (3 min): real frente a simulado
- **Real:**
  - Claude lee 5 facturas y emails, uno con "hemos cambiado de banco".
  - La procedencia marca el IBAN como tainted y el campo se bloquea.
  - Llamada saliente real con ElevenLabs Agents por Twilio o SIP al móvil de un compañero, con un número fijo español — [ElevenLabs SIP](https://elevenlabs.io/docs/agents-platform/phone-numbers/sip-trunking).
  - Claude evalúa la transcripción, se firma el expediente y el pago queda retenido.
- **Simulado:** el VoP y el servicio CIF–IBAN de Iberpay (respuestas según el rulebook), el portal del banco y el buzón.
- **Viable en 2 días con 4 personas: sí.** El riesgo es la latencia de la llamada en directo. Lleva una grabación de respaldo.

### Métrica de IA y audio
- **Batería de 30 emails** (10 BEC, entre ellos variantes sutiles: "nuevo IBAN en el pie de firma", "factura rectificada con otra cuenta", en catalán o inglés; más 20 legítimos). Se mide:
  - recall y falsos positivos de Claude detectando la semántica de cambio;
  - **0 valores tainted en campos de pago** (esto es un invariante del código, no una estadística).
- **Llamada:** tiempo hasta la verificación (objetivo: menos de 60 s), % de llamadas completadas sin intervención humana y latencia por turno medida.
- **Comparación:** tiempo por aviso VoP close match resuelto (manual frente a 8).

### Pitch
"Payhawk o Trustpair validan la cuenta. 8 valida **de dónde salió la orden**: un IBAN que llega por email no puede llegar al pago hasta que 8 llama al número que ya tenías y lo firma."

### Mayor riesgo
Que el jurado lo vea como "otro antifraude de cuentas a pagar" que ya existe (Spendflo, Trustpair). Hay que enseñar que el bloqueo es **estructural** (el campo no acepta el dato) y no una alerta.

---

## 2. Expediente 59 (expediente de reembolso por suplantación del PSP bajo el PSR, por voz, para bancos)

**Veredicto: KEEP WITH CHANGES.** El texto adoptado lo refuerza más de lo que decía el informe:
- **La carga de la prueba de la negligencia grave recae en el PSP.**
- **El PSP debe invitar al consumidor a contar lo ocurrido** e incluirlo en su valoración.

Esa "invitación" es exactamente el intake por voz. Hay dos cambios:
- **(a)** el criterio decisivo es si se usaron **canales atribuidos al PSP** (número, email, web o app suplantados). El expediente tiene que reunir esa prueba, no solo la cronología;
- **(b)** hay que asumir que el comprador no tiene urgencia hasta 2027-2028 y vender "preparación + reducción de reclamaciones al BdE" desde ya.

### Notas corregidas
| Criterio | Antes | Ahora | Por qué |
|---|---|---|---|
| Innovación y viabilidad | 4 | **3,5** | La base legal es sólida, pero se aplica en unos 21 meses tras la publicación (no antes de finales de 2028). Además, los gestores de casos antifraude (Flagright, SEON, Feedzai, NICE Actimize) venden ya "preparación PSR", y en Reino Unido existe el RCMS de Pay.UK. |
| IA de frontera | 5 | **4,5** | La voz es central y natural (declaración de la víctima, lectura y confirmación). Se puede medir. |
| UX | 4 | **4** | |
| Implementación | 4 | **4** | Casos sintéticos y movimientos simulados. Todo construible. |
| Presentación | 5 | **4,5** | Historia clara. Hay que evitar que suene a "anti-estafas para mayores". |
| **Ponderada** | 4,25 | **3,98** | 1,05 + 0,675 + 0,60 + 1,20 + 0,45 |

### Hechos verificados (texto del PSR, Consejo, ST-8221-2026)
- **Art. 59(1):**
  - El consumidor manipulado por un tercero que se hace pasar por su PSP "using communication channels attributed to the consumer's payment service provider" tiene derecho al **reembolso íntegro**.
  - Condición: que lo notifique sin demora indebida a su PSP **y denuncie ante la policía**.
- **Art. 59(2): 15 días hábiles** desde la notificación con la denuncia. En ese plazo, el PSP reembolsa o justifica la negativa por sospecha objetiva de fraude o de negligencia grave e indica los organismos a los que puede acudir el consumidor. Si concluye que hubo fraude, lo comunica a la autoridad.
  - El informe dudaba entre "siguiente día hábil, 10 o 15": la cifra correcta es **15**.
- **Art. 59(3)-(4):**
  - No se aplica si el consumidor actuó con fraude o negligencia grave. **La carga de la prueba es del PSP.**
  - Antes de concluirlo, el PSP **debe invitar al consumidor a aportar información** sobre los hechos.
  - Que el consumidor no la aporte no basta para concluir negligencia.
- **Considerando (80a):** los canales cubren email, teléfono, web o app del PSP, y también las copias fraudulentas de la web o la app.
- **Art. 59a:** cooperación con operadores de telecomunicaciones y con muy grandes plataformas (canales dedicados, intercambio de datos). Los operadores deben adoptar medidas contra la manipulación del identificador de llamada (CLI) y del email.
- **Aplicación:** "21 months after the date of entry into force" (los arts. 50 y 57, a los 27 meses).
- Todo lo anterior en [ST-8221-2026](https://data.consilium.europa.eu/doc/document/ST-8221-2026-INIT/en/pdf).
- **Calendario:**
  - El Consejo publicó los textos el 23 oct 2026 y confirmó la **adopción en primera lectura el 29 oct 2026** (Consejo TTE n.º 4205, Luxemburgo) — [Regulation Tomorrow](https://www.regulationtomorrow.com/2026/11/psd3-and-psr-council-of-eu-adopts-texts-at-first-reading/); [Consejo ST-15154-2026](https://data.consilium.europa.eu/doc/document/ST-15154-2026-INIT/en/pdf).
  - **Falta el pleno del PE** (segunda lectura) y después la publicación en el DOUE.
  - **La fecha del 14 dic 2026 para el pleno no la he podido verificar.**
- **España, contexto de canal:** desde el 7 mar 2025 la Orden TDF/149/2025 obliga a los operadores a bloquear llamadas con CLI vacío o con numeración no atribuida — [BOE](https://boe.es/buscar/act.php?id=BOE-A-2025-2870); [wwwhatsnew, 5 nov 2026](https://wwwhatsnew.com/2026/11/05/llamadas-numero-banco-suplantado-spoofing-ley/). El spoofing del número real del banco sigue siendo posible en parte. Esto da una prueba concreta para el expediente: "número que vio la víctima frente a números oficiales del banco".

### Afirmaciones corregidas o refutadas
- "El Consejo adoptó su posición el 21-23 oct" (03): la **adopción fue el 29 oct**. El 23 es la fecha de publicación de los textos.
- "No tengo verificado el número de artículo": **es el art. 59**, verificado.
- "Aplicación hacia finales de 2028": es **condicional**. Son 21 meses tras la entrada en vigor y el PE todavía no ha votado. Con el DOUE a principios de 2027, la aplicación quedaría en el otoño de 2028 o más tarde.
- No aparece en el texto "PSR exige un borrador de denuncia". El PSR exige la denuncia **del consumidor**. El banco solo puede ayudar a prepararla (por ejemplo, la denuncia por internet de la Policía Nacional). Hay que presentarlo como ayuda, no como obligación.

### Competidores que faltaban
- **Pay.UK RCMS** (Reino Unido): sistema único de gestión de reclamaciones de reembolso APP entre banco emisor y receptor. Sin IA visible. Es el análogo regulado más cercano y demuestra que hay demanda de "gestión del expediente" — [Pay.UK RCMS](https://www.wearepay.uk/rcms/).
- **Flagright, SEON y Entersekt**: se posicionan con gestión de casos "lista para PSR/PSD3" **[vendor]** — [Flagright](https://www.flagright.com/post/psd3-and-real-time-fraud-liability-are-eu-psps-operationally-ready); [SEON](https://seon.io/resources/psr-psd3-fraud-prevention-for-psps/); [Entersekt](https://www.entersekt.com/resources/psd3-news-how-the-new-rules-tackle-fraud).
- **FrauDfense** (iniciativa de tres grandes bancos españoles para responder de forma coordinada al crimen financiero; su CEO viene de Iberpay). Puede ser comprador o competidor — [Fintech Futures](https://www.fintechfutures.com/financial-crime-fraud-prevention/fraudfense-check-launches-after-year-long-trial-by-three-major-spanish-banks).
- **Starling Scam Intelligence y ThreatMark** (prevención, no expediente).

**Qué les falta:** no he encontrado ninguno que haga intake por voz de la declaración de la víctima + comprobación de "canal atribuido al PSP" + cronología firmada, con los datos de la víctima tokenizados.

### Bloqueos legales
- **RGPD art. 22:** la decisión de reembolsar o denegar no puede ser automática. 8 propone y el analista decide.
- **AI Act:** no es alto riesgo. El Anexo III excluye la detección de fraude financiero del punto 5(b), y esto no es solvencia. Se aplica el art. 50 (avisar de que es una IA).
- **Ley 10/2025 (atención a la clientela, aplica a servicios financieros y a empresas grandes, adaptación hasta el 28 dic 2026):**
  - un bot de voz debe ofrecer **atención por una persona en cualquier momento**;
  - el 95 % de esas peticiones deben atenderse en menos de 3 minutos.
  - El intake de 8 necesita un botón o comando de "hablar con una persona" visible.
  - [BOE-A-2025-26698](https://boe.es/boe/dias/2025/12/27/pdfs/BOE-A-2025-26698.pdf)

### Demo: real frente a simulado
- **Real:**
  - Llamada de la víctima por voz (ElevenLabs Scribe o Agents) y extracción de la cronología por Claude.
  - Cruce con movimientos tokenizados (Priv8).
  - Checklist del art. 59: consumidor, canal atribuido, notificación sin demora, denuncia y riesgo de negligencia grave.
  - TTS que lee el resumen a la víctima para que lo confirme.
  - Expediente firmado con el contador de 15 días hábiles.
- **Simulado:** el core bancario, la lista de números oficiales del banco y los registros de llamadas.
- **Viable: sí.**

### Métrica de IA y audio
- Sobre **12 casos sintéticos**: dentro del alcance, fuera (suplantación de la policía o romántica) y dudosos (la víctima compartió el OTP). Se mide:
  - acierto en el alcance del art. 59 frente a una etiqueta hecha por el equipo con el texto del artículo;
  - % de campos del expediente rellenados correctamente;
  - tiempo hasta el expediente completo (objetivo: menos de 5 min frente a días);
  - **0 datos personales en claro en los logs del modelo**.
- **Audio:** WER de Scribe en llamadas en español con ruido y % de víctimas que confirman el resumen leído sin correcciones.

### Pitch
"El PSR da al banco 15 días hábiles y le pone a él la carga de probar la negligencia grave. 8 le entrega el expediente en 5 minutos, desde la propia llamada de la víctima."

### Mayor riesgo
La **falta de urgencia**: se aplica como pronto a finales de 2028 y el PE no ha votado. Los gestores de casos antifraude lo absorben como una función más.

---

## 3. Prueba de Origen (certificado firmado de procedencia por pago para la responsabilidad del PSR)

**Veredicto: MERGE INTO Titular 8** (como "certificado de diligencia" del pago), y su parte de evidencia como un módulo de Expediente 59. **Por separado no se sostiene.**

### Por qué se rompe
1. **El art. 59 solo protege a consumidores**, y solo cuando el suplantador usó canales atribuidos al PSP. En B2B (donde de verdad está el cambio de IBAN por email) el PSR no da derecho a reembolso, así que el certificado no "mueve responsabilidad" bajo el art. 59.
2. **Para certificar la procedencia de una instrucción, alguien tiene que haber visto la fuente.** La app del banco no ve la llamada del falso empleado ni el WhatsApp. El certificado solo existe cuando el pago lo prepara un agente con Priv8 que leyó la fuente, y eso hoy es casi cero pagos de consumidor.
3. **La afirmación "el PSR traslada al PSP el fraude APP cuando su prevención fue inadecuada" (01) es imprecisa.** Lo que dice el texto:
   - el PSP debe tener "adequate prevention and robust technical safeguards" contra la réplica de sus canales (art. 59(-1));
   - si **no aplica la monitorización de transacciones** y la operación fue fraudulenta, reembolsa (considerando 100).
   - No hay una responsabilidad general por APP.
   - [ST-8221-2026](https://data.consilium.europa.eu/doc/document/ST-8221-2026-INIT/en/pdf)
4. **Nadie ha validado el valor probatorio de un "certificado de procedencia"**, y la carga de la prueba la pone el art. 59(4) sobre el PSP. El certificado ayudaría al banco, pero solo si el banco controla el agente.

### Notas (por separado)
- Innovación 3 - IA 2,5 - UX 3 - Técnica 4 - Presentación 3,5.
- **Ponderada: 3,28** (antes 4,13).

### Qué se conserva al fusionarlo
- En Titular 8, cada pago sale con un PDF firmado: origen de cada campo, resultado VoP/Iberpay, transcripción del callback y aprobación humana. Le sirve al banco, a la aseguradora de ciberriesgo y al auditor.
- En Expediente 59, la "prueba de canal": qué número o email vio la víctima frente a los canales oficiales.

### Competidores que faltaban
Los mismos de 1 y 2. Además, **Mastercard** usa los datos de intención del token como pista de auditoría en el ámbito de tarjetas ([Digital Applied](https://www.digitalapplied.com/blog/agent-checkout-authentication-card-networks-2026)).

### Pitch (dentro de 1)
"Cada pago de 8 lleva su procedencia firmada: qué lo originó, quién lo confirmó y por qué canal."

### Mayor riesgo
Prometer un efecto legal (traslado de responsabilidad bajo el PSR) que el texto no da.

---

## 4. Cobro 8 (agente de cobro por voz bajo la Ley 3/2004)

**Veredicto: DROP como producto principal.**
- Las cifras legales son correctas.
- Pero hay un competidor español, de voz, **financiado por el propio ElevenLabs** (Murphy), y otros cinco.
- Además, reutiliza poco Priv8.
- Como mucho, puede ser un "lado de cobro" de Titular 8 en la diapositiva de visión, no en la demo.

### Notas corregidas
| Criterio | Antes | Ahora | Por qué |
|---|---|---|---|
| Innovación y viabilidad | 4 | **3** | Murphy (España, cobro por voz con IA en más de 30 idiomas, 15 M$, Northzone + ElevenLabs), Cleavr, Causa Prima (Madrid/Múnich, 10 M$ pre-seed), Colektia, easyChatbot e Invisible Collector. Lo diferencial es el B2B con Ley 3/2004 para micropymes: real, pero estrecho. |
| IA de frontera | 4,5 | **4,5** | La negociación por voz luce mucho. |
| UX | 4 | **4** | |
| Implementación | 4 | **4** | La fórmula es simple y está verificada. |
| Presentación | 4 | **4** | |
| **Ponderada** | 4,08 | **3,78** | 0,90 + 0,675 + 0,60 + 1,20 + 0,40 |

### Hechos verificados (BOE)
- **Error en el informe 04:** el enlace "BOE-A-2004-21614" **no es la Ley 3/2004** (es una Orden FOM de nombramiento). El identificador correcto es **BOE-A-2004-21830** — [BOE Ley 3/2004 consolidada](https://www.boe.es/buscar/act.php?id=BOE-A-2004-21830).
- **Art. 4:** sin pacto, 30 días naturales desde la entrega o el servicio. El máximo pactado es 60 días.
- **Art. 7.2:** el interés legal de demora es el tipo de la operación principal de financiación del BCE más reciente antes del semestre **más 8 puntos**.
- **Art. 8.1:** **40 € fijos**, "que se añadirá en todo caso y sin necesidad de petición expresa", además de los costes de cobro acreditados que los superen.
  - El Tribunal Supremo (STS 612/2021) fija que se deben **por cada factura** pagada tarde — [CGPJ](https://www.poderjudicial.es/cgpj/es/Poder-Judicial/Noticias-Judiciales/El-Tribunal-Supremo-fija-que-el-deudor-moroso-debe-abonar-40-euros-por-cada-factura-pagada-fuera-de-plazo).
- **Tipo del 2.º semestre de 2026: 10,40 %.** El tipo del BCE en la última operación del 1.er semestre (30 jun 2026) fue del 2,40 % — [BOE-A-2026-14327](https://boe.es/boe/dias/2026/07/01/pdfs/BOE-A-2026-14327.pdf).
  - Sale otra resolución el 1 ene 2027: el demo debe leer el tipo de una tabla y no fijarlo en el código.
- **LO 1/2025 (MASC):** desde el 3 abr 2025 hay un requisito de procedibilidad en lo civil. **La mayoría de juntas de jueces y LAJ exige un intento de MASC antes del monitorio** (salvo el monitorio europeo). Hay discrepancias.
  - Se acredita con un medio fehaciente: burofax, requerimiento notarial o certificado con acuse — [El Derecho](https://elderecho.com/criterios-adoptados-en-juntas-de-jueces-y-lajs-sobre-el-cumplimiento-del-requisito-de-procedibilidad-establecido-en-la-ley-organica-1-2025); [Legal Today](https://www.legaltoday.com/practica-juridica/derecho-civil/civil/el-requisito-de-negociacion-previa-en-la-jurisdiccion-civil-tras-la-lo-1-2025-claves-practicas-para-su-correcta-aplicacion-2026-03-30/).
  - **Consecuencia:** el "dossier del monitorio" debe incluir el intento de MASC, y una llamada grabada por sí sola probablemente no sirve como medio fehaciente. Esto es a la vez un gancho (8 prepara el MASC) y un límite (sigue haciendo falta el burofax).

### Afirmaciones corregidas o refutadas
- "Ninguno es nativo de la ley española ni de voz para micropymes": **falso en lo de la voz y en lo de español**. Murphy es española y de voz, aunque se centra en deuda de consumo y gran volumen (utilities, telecos, BNPL) — [Finovate](https://finovate.com/spanish-ai-debt-collection-startup-murphy-raises-15-million/); [Northzone](https://northzone.com/portfolio/murphy).
- "Un jurado en vivo recibe la llamada": un **inversor de Murphy es ElevenLabs**, patrocinador de la hackathon. Es probable que alguien del jurado conozca el caso y lo use para preguntar por la novedad.
- **Ley 10/2025:** **no** se aplica (regula la atención a la clientela de consumidores y excluye a las pymes salvo en servicios básicos). La Ley 3/2004 solo cubre operaciones entre empresas o con la Administración, así que el ámbito B2B es coherente.
- "La tecnología encaja con la auditoría de Priv8": la reutilización es **baja**. Los tokens y la procedencia apenas aportan en una llamada de cobro.

### Competidores que faltaban
- **Murphy** (España, cobro por voz con IA, 15 M$ en jul 2025 con Northzone, ElevenLabs, Lakestar y Seedcamp) — [PYMNTS](https://www.pymnts.com/?p=2821623); [El Referente](https://elreferente.es/?p=187423).
- **Causa Prima** (Madrid/Múnich): red de agentes de IA para finanzas B2B (disputas, condiciones de pago, pronto pago), 10 M$ pre-seed liderada por Creandum, jun 2026 — [Finantres](https://finantresnoticias.com/negocios-y-autonomos/causa-prima-levanta-86-millones-para-automatizar-facturas/).
- **Colektia** (España y Latinoamérica: agente de cobro omnicanal con voz) — [Colektia](https://colektia.com/en/debt-collection-agency-spain).
- **easyChatbot** (Málaga, cobros con IA para pymes) — [ecosistemastartup](https://ecosistemastartup.com/?p=40392).
- **Invisible Collector** (con apoyo de ICEX) — [El Referente](https://elreferente.es/entrevistas/invisible-collector-ia-para-operaciones-de-cobro/).
- **Dost** (Serie A de 6,7 M€; incluye cuentas a cobrar).
- **Monk** (cobro por voz) — [Monk](https://monk.com/blog/voice-collections).
- Ya citados en 04: Fazeshift, Audun, FullSeam, Cleavr, Paraglide, Kolleno.

### Bloqueos legales
- **AI Act art. 50:** avisar de que es una IA.
- **RGPD:** grabación informada, y no llamar a terceros ni contar la deuda a quien no es el deudor. La AEPD tiene historial de sanciones a empresas de recobro (no lo he revisado en esta sesión).
- **Acoso (art. 172 ter CP):** limitar la frecuencia.
- **Llamadas comerciales desde móvil prohibidas:** el cobro no es comercial, pero conviene usar un número fijo.
- **MASC** antes del monitorio.

No hay un bloqueo de fondo para el cobro B2B.

### Demo
- **Real:** la llamada y el cálculo exacto (factura de 3.200 € con 47 días de retraso al 10,40 %, más 40 €).
- **Simulado:** el libro de facturas y el burofax.
- **Viable: sí.**

### Métrica
- Cálculo legal al céntimo frente al cálculo a mano en 20 facturas.
- % de llamadas que terminan en una promesa de pago con fecha.
- Objeciones resueltas sin intervención humana.

### Pitch
"8 cobra lo que la ley ya te debe: la factura, el 10,40 % y 40 € por cada una, con el MASC listo para el monitorio."

### Mayor riesgo
**Novedad.** Murphy ya hace cobro por voz con IA desde España y con ElevenLabs de inversor.

---

## 5. Mandato A2A (mandatos agénticos para SEPA Inst y Bizum)

**Veredicto: DROP**, o MERGE INTO Mandato 8 / Open2Agents como una línea de hoja de ruta.
- Se solapa con lo que el equipo ya presentó.
- Todo sería simulado: no hay API de Bizum y en la UE no existe un VRP regulado.
- Ya hay movimientos de TrueLayer y Yapily, y AP2 contempla pagos A2A.

### Notas corregidas
| Criterio | Antes | Ahora | Por qué |
|---|---|---|---|
| Innovación y viabilidad | 4 | **3** | TrueLayer está en el Supercharged Sandbox de la FCA (13 jul – 31 dic 2026) con Pay by Bank agéntico y un modelo de "Bank on File" ([TrueLayer](https://truelayer.com/newsroom/announcements/truelayer-selected-for-fcas-supercharged-sandbox-to-test-agentic-payments/)). Yapily + Yugo hacen un prototipo con cVRP y aprobación en la app ([Yapily](https://www.yapily.com/blog/yugo-yapily-agentic-commerce-open-banking/)). El mercado agéntico es casi nulo. |
| IA de frontera | 3 | **2,5** | El dictado del mandato es una conversión de voz a JSON de poco valor diferencial. |
| UX | 4 | **3,5** | |
| Implementación | 4 | **3,5** | Todo simulado: sin API de Bizum y sin VRP en la UE. La SCA delegada no tiene base que se pueda enseñar. |
| Presentación | 4 | **3,5** | El jurado ya vio Open2Agents la semana pasada (es otra hackathon, pero el equipo es el mismo). |
| **Ponderada** | 3,85 | **3,20** | 0,90 + 0,375 + 0,525 + 1,05 + 0,35 |

### Hechos verificados
- **No hay producto agéntico ni de Bizum ni de Wero.**
  - La IA de Bizum es un asistente de incidencias (Telefónica Tech, sep 2026) — [Finantres](https://finantresnoticias.com/bancos/bizum-estrena-asistente-ia-incidencias-estafas-derivacion-automatica-bancos/).
  - Wero solo habla de comercio agéntico en paneles — [Payment Expert](https://paymentexpert.com/2026/03/18/mpe-day-2-is-wero-europes-hail-mary/).
- **No hay ninguna opinión ni Q&A de la Autoridad Bancaria Europea sobre SCA y agentes.**
  - La EFIF lo discutió en feb 2026 ([ESMA EFIF](https://www.esma.europa.eu/sites/default/files/2026-06/EFIF_SoCs_meeting_February_2026.pdf)).
  - Hay un documento de jun 2026 sobre "agentic AI in embedded finance", pero es de la **Euro Banking Association** (abe-eba.eu), no de la Autoridad Bancaria Europea. No confundirlas en el pitch — [ABE-EBA](https://www.abe-eba.eu//wp-content/uploads/2026/06/EBA_2026_OFWG_Agentic-AI-in-Embedded-Finance_Fact-Sheet_v1.0.pdf).
- **PSD2/RTS:** sigue haciendo falta SCA. La vía realista es la exención de beneficiario de confianza (art. 13 del RTS) o una SCA por pago en la app — [Osborne Clarke](https://www.osborneclarke.com/insights/agentic-payments-new-challenge-europes-payments-ecosystem).
  - Esto es exactamente lo que ya cubren Mandato 8 y Open2Agents (aprobación en el móvil).

### Afirmaciones corregidas o refutadas
- "El primer mandato de agente para pagos A2A en España": TrueLayer (Reino Unido) y Yapily ya lo prototipan con open banking. En la UE, sin VRP regulado, el "mandato" acaba siendo una SCA por pago o una lista de beneficiarios de confianza, que ya existe en las apps bancarias.
- "Reutilización muy alta": es cierto, y justo por eso **parece reciclado**.

### Competidores que faltaban
TrueLayer, Yapily (+ Yugo, Urbo), AP2 con mandatos firmados, y los gigantes de tarjetas ya citados.

### Bloqueos legales
- SCA delegada sin validar.
- El PSR no contempla al agente como pagador.
- Sin acceso a Bizum.

### Demo
Todo simulado. Es viable, pero no convence a un jurado técnico.

### Métrica
% de pagos fuera del mandato bloqueados en una batería de inyecciones. Es la misma métrica que Titular 8, que la enseña mejor.

### Pitch
"El mandato que firmas una vez y que ningún email puede ampliar." Esa frase ya es Titular 8 o Mandato 8.

### Mayor riesgo
Que el jurado lo vea como Open2Agents con otro nombre y sin nada real detrás.

---

## Recomendación de fusión

**Un solo producto: "Titular 8"** (cuentas a pagar seguras por construcción), con Prueba de Origen dentro como certificado firmado de cada pago.

**Expediente 59** queda como segunda opción independiente, para bancos. Es mejor que Titular 8 en audio (15 %), pero peor en urgencia del comprador. Si el equipo quiere una voz más protagonista y un comprador bancario (MyInvestor como banco sujeto al PSR), es la alternativa. No conviene juntar 1 y 2 en la misma demo de 3 minutos: los compradores son distintos (pyme frente a banco) y el PSR no se aplica a B2B.

## Lo que sigue sin verificar
- La fecha del pleno del PE (14 dic 2026) y la fecha de publicación en el DOUE.
- Las tasas VoP y de opt-out específicas de España.
- Las funciones antifraude de Holded y Pleo.
- El historial de sanciones de la AEPD a empresas de recobro.
- El art. 814 LEC (monitorio sin abogado ni procurador), no releído en esta sesión.
- El volumen de pérdidas por BEC en España (sigue sin cifra oficial).
