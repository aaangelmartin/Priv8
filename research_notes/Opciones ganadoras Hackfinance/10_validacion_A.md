# Validación adversarial A: Mandato 8 (fusión), Cosecha, Retenida, Idónea, Cartera a Prueba

Fecha: 10 nov 2026. Método: búsquedas y lecturas web nuevas hechas hoy, más dos sondeos en directo de `https://mcp.myinvestor.es/mcp` (`initialize` y `tools/list`). Fuentes de partida: `_contexto.md`, `02_inversion_minorista.md`, `07_consumidor_tramites.md` (Mudanza 8), `08_hackathon_tecnica.md` y `reports/Producto ganador Hackfinance.md`. El objetivo era intentar tumbar cada concepto. Las puntuaciones van de 1 a 5 y se ponderan así: Innovación y viabilidad 30 %, IA de frontera 15 %, UX 15 %, Implementación 30 %, Presentación 10 %.

## Resumen

| Concepto | Veredicto | Innov. 30 | IA 15 | UX 15 | Impl. 30 | Pres. 10 | Ponderada | Antes |
|---|---|---|---|---|---|---|---|---|
| 1. Mandato 8 (fusión con Mudanza 8, Traspaso Abierto y Fuga) | **KEEP WITH CHANGES** | 3,5 | 3,5 | 4 | 4,5 | 4,5 | **3,98** | 4,0-4,4 |
| 4. Idónea | **KEEP WITH CHANGES** | 3,5 | 4,5 | 4,5 | 4 | 4 | **4,00** | 4,0 |
| 2. Cosecha | KEEP WITH CHANGES (como módulo, no como producto) | 3,5 | 3 | 4 | 3,5 | 4 | **3,55** | 4,20 |
| 5. Cartera a Prueba | DROP como producto (la voz escéptica sobrevive como función) | 2,5 | 4 | 3,5 | 4 | 4 | **3,48** | 4,1 |
| 3. Retenida | **DROP** | 3 | 3 | 3,5 | 3 | 3,5 | **3,13** | 4,05 |

Hay tres hallazgos que afectan a todos los conceptos:

1. **El MCP de MyInvestor no se puede meter en una app sin permiso.** Las condiciones se actualizaron el 26 oct 2026. Ahora toleran el "uso razonable desde herramientas de desarrollo de IA y agentes", pero siguen prohibiendo el "acceso automatizado o programático" y "construir bases de datos o productos derivados" con sus datos ([terms.md](https://mcp.myinvestor.es/terms.md)). Además, las instrucciones que el servidor devuelve hoy en `initialize` mandan al modelo explicar que "integrar el servicio en scripts o aplicaciones" no está permitido (sondeo propio, `https://mcp.myinvestor.es/mcp`). Llamarlo desde nuestro backend con la Claude API choca, por tanto, con las condiciones escritas. Hay que pedir por escrito a GPTadvisor (info@gptadvisor.com, que es el contacto de las condiciones) un permiso para la hackathon. El plan B es enseñar el MCP en directo dentro de Claude.ai, que es el uso permitido. Guardar una copia en caché del catálogo sería "extracción" y tampoco vale.
2. **El hueco de "traspaso preparado" ya lo han cerrado en parte.** El 22 oct 2026 Indexa lanzó el traspaso de toda una cartera gestionada en una sola solicitud ([Finect](https://www.finect.com/usuario/eduardogarcia/articulos/indexa-capital-simplifica-el-traspaso-de-fondos-de-carteras-gestionadas)). MyInvestor ya tiene en su app "Traer fondos desde otra entidad", que funciona subiendo PDF firmados ([MyInvestor](https://myinvestor.es/landings/planes-pensiones/traspaso/)).
3. **El MCP sigue en pie y tiene 12 herramientas, `backtest_portfolio` incluida.** `search_stocks` devuelve además la rentabilidad por dividendo (sondeo propio de `tools/list`, 10 nov 2026).

---

## 1. Mandato 8 / Mudanza 8 / Traspaso Abierto / Fuga (fusión)

**Veredicto: KEEP WITH CHANGES.** Es el concepto que mejor encaja con los patrocinadores y con lo que el equipo ya tiene construido. Pero la novedad declarada ("traspaso prefirmado") ya no se sostiene. Lo que sigue siendo nuevo es **que la IA trabaje con la cartera del usuario sin verla, que la solicitud llegue a MyInvestor sin errores y que nadie la pueda manipular, con pruebas de todo**. Hay que recortar el alcance: fuera el traslado de cuenta, las domiciliaciones, los seguros vinculados y las llamadas de Mudanza 8. Se queda solo con fondos y planes.

**Puntuación corregida:** Innovación 3,5 (Indexa y MyInvestor ya digitalizaron la solicitud; el valor está en la privacidad, la procedencia y la validación previa) - IA 3,5 (la voz sirve para confirmar y explicar, pero sigue siendo prescindible si no se mide) - UX 4 - Implementación 4,5 (Priv8 ya lee el DOM, tokeniza y retiene) - Presentación 4,5. **Ponderada: 1,05 + 0,525 + 0,6 + 1,35 + 0,45 = 3,98.**

### Hechos verificados
- **Flujo actual de MyInvestor.** El traspaso se pide en la app, en "Traer fondos desde otra entidad", subiendo dos PDF: la "solicitud de cambio de comercializador firmada" y un "extracto o informe de posiciones de la entidad origen, firmado". El extracto tiene que tener menos de 3 meses, los titulares deben coincidir con la cuenta de destino y debe detallar fondos o planes con ISIN y participaciones. Si hay cotitulares, firman todos. El plazo "puede variar" y "suele ser de varias semanas, pudiendo extenderse a 30 días o más". Si se rechaza, la app da el motivo y deja reenviar la solicitud — [MyInvestor, landing de traspaso](https://myinvestor.es/landings/planes-pensiones/traspaso/)
- **Plazos legales de fondos (CNMV).** Entre fondos de la misma gestora o comercializadora, máximo 5 días hábiles. Entre entidades distintas, "en torno a ocho días hábiles" — [CNMV, guía rápida de traspasos](https://www.cnmv.es/DocPortal/Publicaciones/Fichas/TraspasosEntreFondosDeInversion.pdf) (PDF leído hoy)
- **Planes de pensiones.** La entidad de destino tiene 2 días hábiles para pedir el traspaso y la de origen 5 días hábiles para ejecutarlo (3 si es la misma entidad). La norma es el RD 304/2004 modificado; la cita al "art. 50" de las notas es errónea — [BBVA Mi Jubilación](https://www.bbvamijubilacion.es/blog/rescate-o-traspaso-de-planes-de-pensiones-cuales-son-los-plazos-legales/); [BOE RD 62/2018](https://www.boe.es/eli/es/rd/2018/02/09/62)
- **Los traspasos fallan por datos que no cuadran.** Hay quejas en la OCU y en Rankia; en concreto, MyInvestor pide el "código de cuenta de partícipe", no el número de contrato — [OCU](https://www.ocu.org/reclamar/lista-reclamaciones-publicas/myinvestor-me-22pierde-22-el-dine/4cf6df548a793b147d); [Rankia](https://www.rankia.com/foros/fondos-inversion/temas/7349412-traspaso-fondos-caixabank-myinvestor-codigo-cuenta-participe)
- **Condiciones del MCP y sus instrucciones de servidor:** ver los hallazgos transversales — [terms.md](https://mcp.myinvestor.es/terms.md)

### Afirmaciones corregidas o refutadas
- *"Nadie prepara el traspaso"*: **refutada.** Indexa tramita desde el 22 oct 2026 la cartera entera en una solicitud, con solo el nombre de la cartera y la cuenta de valores, en 2-3 semanas ([Finect](https://www.finect.com/usuario/eduardogarcia/articulos/indexa-capital-simplifica-el-traspaso-de-fondos-de-carteras-gestionadas)). MyInvestor ya digitalizó la entrada en su app.
- *"El comparador de Indexa exige subir un archivo"*: **matizada.** También acepta una captura de pantalla ([Rankia/Forbes](https://forbes.es/economia/752509/indexa-capital-lanza-un-comparador-automatizado-de-carteras-de-inversion-con-ia/)), así que leer la pantalla no es una ventaja exclusiva. La nuestra es leerla **sin que el modelo vea los datos personales**.
- *"Planes de pensiones en el MCP"*: siguen fuera ("aún no", según las instrucciones del servidor).
- *Mudanza 8 (cuenta, domiciliaciones, seguros por teléfono)*: no hay hueco verificado para MyInvestor en hipotecas ni seguros, y suma tres sistemas simulados más. **Se recorta.**

### Competidores nuevos
- **Indexa Capital**: traspaso de la cartera completa en una solicitud (oct 2026) y comparador con IA hecho con GPTadvisor que acepta capturas.
- **MyInvestor**: su propio flujo en app, con PDF y estado de la solicitud.
- **BBVA**: app de traspasos de planes ([BBVA](https://www.bbva.es/personas/productos/planes-de-pensiones/app-traspasos.html)).
- Ninguno valida la solicitud antes de enviarla (titulares, antigüedad, participaciones, código de partícipe), ninguno tokeniza y ninguno deja un expediente de procedencia.

### Bloqueos legales
- **MiFID / LMV.** El asesoramiento es un servicio de inversión reservado: Ley 6/2023, art. 125.1.g ([finreg360](https://finreg360.com/alerta/la-esma-actualiza-la-definicion-de-asesoramiento-en-materia-de-inversion/); [ESMA, ficha de finfluencers en España](https://www.esma.europa.eu/sites/default/files/2026-01/ES_Spain_es_-_Finfluencers_factsheet.pdf), donde ESMA dice que poner "esto no es asesoramiento" no protege). Elegir el fondo de destino tiene que hacerlo el usuario. El agente no puede "proponer el indexado equivalente" para un cliente concreto. Lo que sí puede hacer es copiar al formulario el destino que el usuario dicta.
- **Condiciones del MCP:** hace falta permiso escrito (ver arriba).
- **Leer el portal de origen con la sesión del usuario.** Si se ejecuta en local, en el dispositivo del usuario, es el propio usuario quien actúa y no un TPP de PSD2. Aun así, puede chocar con las condiciones del banco de origen. Para la hackathon se resuelve con un banco simulado.

### Demo de 3 minutos: qué es real y qué se simula
- **Real:** Claude con tokens; el ejecutor local; el oráculo de titularidad ("¿coinciden los titulares?", sin revelar ninguno); la procedencia, que bloquea un correo del tipo "vende y transfiere a ES…"; el PDF de solicitud generado y firmado; el expediente firmado y verificable; la voz de 8 (ElevenLabs) con lectura de vuelta; el catálogo de MyInvestor en Claude.ai, o por API si GPTadvisor da permiso.
- **Simulado:** el portal del banco de origen y la pantalla "Traer fondos desde otra entidad" de MyInvestor.
- **Equipo de 4 en 2 días:** se puede, porque el 80 % es Priv8 ya hecho.

### Métrica medible para IA y audio
- **Solicitudes que pasarían la validación de MyInvestor a la primera:** 0/N para el agente ingenuo frente a N/N para Mandato 8, sobre 20 extractos sintéticos con errores sembrados (cotitular, extracto de más de 3 meses, ISIN o clase equivocados, código de partícipe).
- **Datos personales que llegan al LLM:** 0.
- **Error de lectura de vuelta por voz en ISIN e importes:** WER y CER sobre un conjunto propio.
- **Tiempo hasta tener la solicitud lista:** voz frente a formulario manual.

**Frase:** "MyInvestor rechaza traspasos por un dato mal copiado. 8 lee tu banco sin ver tus datos, monta la solicitud que no se rechaza y nadie puede desviarla."

**Mayor riesgo:** que el jurado lo vea como "lo que Indexa y MyInvestor ya hacen, con una capa de privacidad", y que no podamos usar el MCP por API. Mitigación: abrir con la métrica de rechazos y con el ataque bloqueado, no con "traspasos fáciles".

---

## 2. Cosecha (cosecha de pérdidas fiscales antes del 31 de diciembre)

**Veredicto: KEEP WITH CHANGES, pero como módulo de Mandato 8 o como segunda pantalla de la demo, no como producto principal.** El problema es real y tiene fecha límite, pero la IA aporta poco (el cálculo es determinista), el sustituto de otro ISIN es una zona gris tanto fiscal como MiFID, y ya hay un roboadvisor español que lo hace.

**Puntuación corregida:** Innovación 3,5 - IA 3 - UX 4 - Implementación 3,5 (lotes FIFO de varios brokers simulados y calendario de bloqueo; el plazo es justo) - Presentación 4. **Ponderada: 1,05 + 0,45 + 0,6 + 1,05 + 0,4 = 3,55** (antes 4,20).

### Hechos verificados
- **Ventana de la regla.** Dos meses para valores cotizados y un año para los no cotizados (art. 33.5 f y g LIRPF) — [CNMV, guía de fiscalidad de acciones](https://www.cnmv.es/DocPortal/Publicaciones/Guias/Guia_Fiscalidad_Acciones.pdf); [AEAT, manual IRPF](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2022/c11-ganancias-perdidas-patrimoniales/ganancias-perdidas-patrimoniales-que-no-bi/perdidas-patrimoniales-que-no-se-tales.html)
- **Escala del ahorro desde 2025:** 19 / 21 / 23 / 27 / 30 %, con el 30 % por encima de 300.000 € (Ley 7/2024) — [Cuatrecasas](https://www.cuatrecasas.com/es/spain/fiscalidad/art/irpf-incremento-tipo-ahorro-2025); [Raisin](https://www.raisin.com/es-es/tributacion/declaracion-de-la-renta/tramos-irpf/)
- **Compensación.** Las pérdidas pendientes se arrastran 4 años y pueden compensar hasta el 25 % de los rendimientos del capital mobiliario (fuente secundaria; no lo comprobé en el BOE) — [Estrategias de Inversión](https://www.estrategiasdeinversion.com/actualidad/finanzas-personales/cerramos-ya-2026-que-hacer-para-consolidar-las-n-966037)
- **Clases de un mismo fondo.** La DGT considera que las distintas clases de participaciones de un mismo fondo no son valores homogéneos a efectos del FIFO. Eso no es lo mismo que la regla de los dos meses — [Consejo General de Gestores (resumen de consultas DGT, may. 2026)](https://www.consejogestores.org/noticias/consultas-vinculantes-dgt-mayo-2026/)

### Afirmaciones corregidas o refutadas
- *"Nadie lo hace en España"*: **refutada.** **inbestMe** hace *tax-loss harvesting* para sus clientes "sin coste adicional": sustituye el ETF en pérdidas por uno parecido y respeta los 60 días ([inbestMe](https://inversion.inbestme.com/en/knowledge/tax-loss-harvesting-tlh)). El hueco que queda es más estrecho: hacerlo **antes de operar, con varios brokers y para quien no tiene roboadvisor**.
- *"El sustituto con otro ISIN del mismo índice es seguro"*: **no verificado.** No encontré ninguna consulta de la DGT que diga que dos ETF del mismo índice de gestoras distintas no son homogéneos. Lo que hay son opiniones contrarias en foros ([Club de Inversión](https://www.elclubdeinversion.com/ufaq/puedo-vender-un-etf-con-perdidas-y-volver-a-comprarlo-enseguida/)). No se puede prometer en el escenario.
- *Plazo de los fondos*: vender un fondo para realizar la pérdida rompe el diferimiento del traspaso, y la liquidación tarda D+2 o D+3. La fecha límite real es antes del 31 de diciembre.
- *Proponer el sustituto*: recomendar un instrumento concreto a un cliente concreto es asesoramiento (LMV art. 125.1.g). Solo se puede ofrecer como un filtro objetivo que el usuario elige.

### Competidores nuevos
- **inbestMe** (TLH automático dentro de su gestión).
- Informes fiscales de los brokers: Trade Republic retiene y reporta en España desde junio de 2025 ([nota de Trade Republic](https://assets.traderepublic.com/assets/files/250605_TradeRepublic_PressRelease_SpainBranchLaunch_ES_ES.pdf)).
- Calculadoras: AllInvestView ([regla de los dos meses](https://www.allinvestview.com/es/calculadora-regla-dos-meses/)).
- Las guías de prensa de cada diciembre; el problema se conoce bien.

### Demo y métrica
- **Real:** el motor fiscal FIFO con la regla de ±2 meses; la voz explicando "vender esto te ahorra X € y no puedes recomprarlo hasta el 9 de enero"; el oráculo.
- **Simulado:** los dos brokers y la orden.
- **Métricas:** euros de IRPF ahorrados frente a no hacer nada en una cartera de prueba; 0 infracciones de la regla en 50 escenarios sintéticos; segundos hasta decidir frente a una hoja de cálculo. Es medible, pero no es "IA de frontera": la IA solo explica.

**Frase:** "Quedan 7 semanas para vender en pérdidas: 8 te dice cuánto ahorras y qué no puedes recomprar, sin ver tu cartera."

**Mayor riesgo:** que el jurado pregunte "¿y si Hacienda considera homogéneo el sustituto?" y no tengamos una consulta de la DGT que lo respalde. Además, en un año alcista hay pocas pérdidas latentes.

---

## 3. Retenida (recuperar retenciones extranjeras sobre dividendos)

**Veredicto: DROP.** Ya hay competidores financiados en la UE. La premisa sobre Francia es falsa. Los procedimientos de Alemania y Suiza no se pueden enseñar en directo. Los importes por cliente son pequeños y el encaje con MyInvestor es débil. Lo único que merece la pena conservar es la escena del phishing que cambia el IBAN de destino, y se puede meter dentro de Mandato 8.

**Puntuación corregida:** Innovación 3 - IA 3 - UX 3,5 - Implementación 3 - Presentación 3,5. **Ponderada: 0,9 + 0,45 + 0,525 + 0,9 + 0,35 = 3,13** (antes 4,05).

### Hechos verificados
- **FASTER (Directiva (UE) 2025/50).** Hay que transponerla antes del 31 dic 2028 y se aplica desde el **1 ene 2030**; Francia podría transponerla en 2027 — [CACEIS](https://www.caceis.com/regulatory-environment/regulatory-watch/faster-faster-and-safer-relief-of-excess-withholding-taxes); [Société Générale](https://www.securities-services.societegenerale.com/en/insights/views/news/faster-entered-into-force-on-30-january-2025/)
- **Suiza.** Retiene un 35 % y el convenio con España lo limita al 15 %. La devolución se pide con el **formulario 90**, específico para residentes en España (no el 86, que es para el Reino Unido) — [Bundespublikationen, formulario 90](https://www.bundespublikationen.admin.ch/fr/product/000000000862674092/peticion-de-devolucion-formulario-90); [ibani](https://www.ibani.com/es/guias/impuesto-anticipado-35-reembolso-no-residentes)
- **Alemania.** La devolución se pide al BZSt. Va por escrito o por el portal BZSt-Online, y para un extranjero el registro puede tardar **hasta seis semanas** — [BDO](https://bdo.de/getmedia/4b49d5a4-5382-4348-8c2d-449110da26de/BDO-Das-Entlastungsverfahren-nach-%C2%A7-50c-EStG-PB.pdf?ext=.pdf); [Bayernportal](https://www.bayernportal.de/dokumente/leistung/9092337864229)

### Afirmaciones corregidas o refutadas
- *"Francia retiene el 30 %"*: **refutada para personas físicas.** El tipo interno para personas físicas no residentes es el **12,8 %**, por debajo del 15 % del convenio, así que si se aplica bien no hay exceso que reclamar. El 25 % o el 30 % aparece solo cuando falta documentación o el perceptor es una entidad — [Clearstream, Francia](https://clearstream.com/clearstream-en/res-library/market-coverage/relief-at-source-eligibility-documentation-deadlines-french-equities-securities-held-in-ceu--1316690)
- *"No existe un servicio B2C"*: **refutada.** Ver la lista de competidores.
- *"Rellenar el formulario y enviarlo en la demo"*: **no es viable en directo.** Suiza pide papel y certificado de residencia, y Alemania pide el registro en BZSt-Online.

### Competidores nuevos
- **Divizend** (Múnich): importa del broker por API, CSV o PDF; cubre 15 países, Suiza incluida; cobra el **17,5 % de lo recuperado**; el certificado de residencia hay que enviarlo por correo postal — [Divizend Maximizer](https://divizend.com/platform/maximizer)
- **DivTax** (Hamburgo): B2C desde 2025; ronda pre-semilla de ~1 M€ en marzo de 2026 — [FinTech Global](https://fintech.global/2026/03/03/divtax-raises-e1m-to-help-investors-reclaim-dividend-tax/)
- **Sprintax Dividends** — [FF News](https://ffnews.com/news/sprintax-making-withholding-tax-recovery-an-automated-reality)
- Ninguno parece centrarse en residentes españoles, pero ampliar a España es poco esfuerzo para ellos.

### Métrica
Euros recuperables detectados y porcentaje de dividendos bien clasificados frente a una verdad conocida. Es medible, pero poco vistoso.

**Frase (si se mantuviera):** "Suiza te debe el 20 % de cada dividendo: 8 lo encuentra y te deja el formulario 90 listo para firmar."

**Mayor riesgo:** que un jurado conozca Divizend o DivTax y vea un "me too" con menos cobertura y sin envío real.

---

## 4. Idónea (test MiFID por voz, con preguntas de comprensión y registro firmado; B2B)

**Veredicto: KEEP WITH CHANGES.** Es el concepto con mejor encaje en el 15 % de audio y con GPTadvisor, que vende B2B, no tiene en su web ningún producto de idoneidad ni de voz y vende "auditoría en cada capa". El marco de ESMA lo respalda. Los cambios: presentarlo como módulo para una entidad regulada que sigue siendo la responsable del test; que la puntuación sea determinista y el LLM solo entreviste; y añadir el **test de conveniencia** (el que se aplica a la ejecución de órdenes sin asesoramiento, el caso del bróker de MyInvestor) además del de idoneidad (que se aplica a carteras gestionadas y asesoramiento).

**Puntuación corregida:** Innovación 3,5 (hay perfiladores conductuales y onboarding con IA; voz más comprobación de comprensión con registro firmado no aparece en producción en España) - IA 4,5 - UX 4,5 - Implementación 4 - Presentación 4. **Ponderada: 1,05 + 0,675 + 0,675 + 1,2 + 0,4 = 4,00.**

### Hechos verificados
- **Directrices de idoneidad de ESMA (ESMA35-43-3172).** Informe final del 23 sept 2022, aplicables desde el 3 oct 2023. Piden a las entidades "tomar medidas razonables y usar herramientas adecuadas" para que la información del cliente sea **fiable, exacta y coherente**. También cubren de forma expresa las herramientas automatizadas — [ESMA35-43-3172 (copia de FIN-FSA)](https://prod.finanssivalvonta.fi/globalassets/en/publications/supervision-releases/2023/esma35-43-3172_guidelines_on_certain_aspects_of_the_mifid_ii_suitability_requirements.pdf); [MFSA](https://www.mfsa.mt/wp-content/uploads/2022/09/esma35-43-3172_final_report_on_mifid_ii_guidelines_on_suitability-2.pdf)
- **Declaración de ESMA sobre IA en servicios de inversión (30 may 2024).** Pide avisar al cliente, extremar la diligencia en la idoneidad y guardar registros — [ESMA35-335435667-5924](https://www.esma.europa.eu/sites/default/files/2024-05/ESMA35-335435667-5924__Public_Statement_on_AI_and_investment_services.pdf)
- **Idoneidad frente a conveniencia.** La idoneidad aplica al asesoramiento y la gestión discrecional; la conveniencia, a la ejecución o transmisión de órdenes sin asesoramiento. Los tests se entregan desde el 1 nov 2007 — [CaixaBank, test MiFID](https://www.caixabank.es/particular/cultura-financiera/test-mifid.html)
- **Dispersión entre roboadvisors.** Los roboadvisors españoles traducen los perfiles de riesgo de forma muy dispar, lo que cuestiona la eficacia de la idoneidad en contextos automatizados — [TFG Comillas](https://repositorio.comillas.edu/jspui/bitstream/11531/100389/1/TFG%20-%20de%20la%20Puente%20Medina%2c%20Laura.pdf) (es un trabajo académico de grado: como indicio)
- **Lo que publica GPTadvisor.** Su web habla de AI Wealth Agents, propuestas de cartera, informes, "memoria del cliente", "auditoría en cada capa" y del sandbox de la CNMV desde 2024. No hay test de idoneidad ni voz — [gptadvisor.com](https://www.gptadvisor.com/)

### Afirmaciones corregidas
- *"Registro firmado para la CNMV"*: **matizada.** El registro es de la entidad, no se entrega a la CNMV. Hay que decir "registro auditable por la entidad y el supervisor".
- *Riesgo de la Ley de IA*: la idoneidad no está entre los casos de alto riesgo del anexo III, que sí incluye el *scoring* crediticio y la tarificación de seguros de vida y salud (es inferencia mía). Aplica la transparencia del art. 50 desde el 2 ago 2026: hay que anunciar que es una IA.

### Competidores nuevos
- **Perfiladores de riesgo conductual:** Oxford Risk y FinaMetrica (Morningstar). Hacen cuestionarios psicométricos, sin voz.
- **Onboarding con IA:** fincite ([FinTech Global](https://fintech.global/2026/04/27/fincites-4-ai-use-cases-easing-the-burden-on-advisers/)); Delos, con cuestionarios adaptativos ([Delos](https://delos.so/blog/ai-powered-wealth-management-onboarding)); WealthAi, con agentes de onboarding ([FinTech Global](https://fintech.global/?p=258926)).
- Ninguno combina voz, preguntas de vuelta para comprobar que se entiende, detección de incoherencias y registro firmado de cada respuesta.

### Demo de 3 minutos: qué es real y qué se simula
- **Real:** ElevenLabs Agent (STT y TTS en español) más Claude como entrevistador; una matriz de puntuación determinista (por ejemplo, la de un banco ficticio); el detector de incoherencias (el usuario dice "acepto perder un 20 %" y luego "no quiero perder nada", y 8 vuelve a preguntar); la pregunta de comprensión ("si el fondo cae un 20 %, ¿cuánto vale tu inversión de 10.000 €?"); el registro firmado con el hash de cada turno; la cara de 8 escuchando y hablando con el volumen real.
- **Simulado:** el CRM de la entidad.
- **Equipo de 4 en 1,5-2 días:** se puede.

### Métrica medible
- **Incoherencias detectadas** sobre 10 personas guionizadas con contradicciones sembradas (por ejemplo, 9/10 frente a 0/10 del formulario).
- **Comprensión medida** con preguntas de vuelta.
- **Tiempo hasta terminar** frente al formulario, y **abandono**.
- **WER en cifras habladas.**
- **Latencia por turno** en pantalla.

**Frase:** "El test MiFID mide lo que marcas. Idónea mide lo que entiendes, y deja la prueba firmada."

**Mayor riesgo:** que se vea como "otro asistente de voz" que reutiliza poco Priv8 (aquí la tokenización no luce), y que la adopción dependa de lo que decida el departamento de cumplimiento de cada entidad. Mitigación: venderlo a GPTadvisor como capa de cumplimiento y meter el registro y la procedencia de Priv8 (las respuestas solo pueden venir del micrófono del usuario, nunca de una pantalla).

---

## 5. Cartera a Prueba (dos voces debaten un plan con backtests de MyInvestor)

**Veredicto: DROP como producto; la función sobrevive.** El formato "dos voces debaten tus fuentes" existe desde septiembre de 2025 en **NotebookLM (formato Debate)**. Un debate sobre el plan concreto de un cliente acaba en veredicto, y eso es asesoramiento. Además depende al 100 % del MCP, cuyas condiciones prohíben integrarlo en apps. Lo que vale la pena conservar es "la voz escéptica con cada afirmación anclada a un backtest" como momento de 20 segundos dentro de Mandato 8 o de Idónea.

**Puntuación corregida:** Innovación 2,5 - IA 4 - UX 3,5 - Implementación 4 - Presentación 4. **Ponderada: 0,75 + 0,6 + 0,525 + 1,2 + 0,4 = 3,48** (antes 4,1).

### Hechos verificados
- **NotebookLM Audio Overviews** tiene cuatro formatos (Deep Dive, Brief, Critique y Debate) desde el 2 sept 2025, con "un debate formal entre dos presentadores" — [9to5Google](https://9to5google.com/2025/09/02/notebooklm-audio-overview-debate/); [ayuda de Google](https://support.google.com/notebooklm/answer/16212820)
- **ElevenLabs Agents admite varias voces** en una misma conversación — [documentación de ElevenLabs](https://elevenlabs.io/docs/eleven-agents/customization/voice/multi-voice-support). Ya hubo un "motor de debate por voz" en el ElevenLabs Global Hackathon — [AI Tinkerers](https://bucharest.aitinkerers.org/hackathons/h_VnaDazfvoi4/entries/ht_RW3O9kjlo5A)
- **`backtest_portfolio`** existe: de 1 a 10 posiciones, con rentabilidad, volatilidad, máxima caída y Sharpe (sondeo propio de `tools/list`).

### Competidores nuevos
- NotebookLM (Debate, Critique).
- El patrón *round-robin* de proponente y crítico en marcos multiagente (Swarms).
- El comparador de Indexa con GPTadvisor.

### Métrica
El porcentaje de afirmaciones habladas respaldadas por una llamada a una herramienta (*grounding rate*) es buena métrica y se puede reutilizar en otros conceptos.

**Frase:** "Antes de invertir, escucha a quien te lleva la contraria, con datos reales."

**Mayor riesgo:** que el jurado diga "esto es NotebookLM con fondos" y que GPTadvisor lo vea como asesoramiento sin test de idoneidad.

---

## Recomendación del validador

1. **Producto: Mandato 8 recortado a fondos y planes**, con el gancho medible "solicitudes que MyInvestor no rechaza" y el ataque de "vende y transfiere" bloqueado.
2. **Si el reto del 8 nov va de asesores o de entidades**, conviene cambiar a **Idónea**, o meter su confirmación hablada con preguntas de comprensión dentro de Mandato 8 para sumar en el 15 % de audio.
3. **Cosecha** puede ir como diapositiva de "siguiente caso de uso", mostrando el motor de la regla de los dos meses.
4. **Retenida** y **Cartera a Prueba** salen. La escena del IBAN cambiado por phishing y el *grounding rate* se quedan como piezas sueltas.
5. **Acción del día 1:** escribir a info@gptadvisor.com y al equipo de MyInvestor que está en la hackathon pidiendo permiso para llamar al MCP por API durante el evento. Sin ese permiso, el MCP solo se enseña desde Claude.ai.
