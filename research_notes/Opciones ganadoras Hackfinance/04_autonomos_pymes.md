# Money and tax operations of Spanish autónomos and pymes (Nov 2026): late payment, IBAN fraud, government notifications, and five hackathon concepts

Research date: 10 Nov 2026. About 17 searches and fetches. This builds on `Producto ganador Hackfinance/autonomos_pymes_espana.md`, which already covers Verifactu, RETA regularisation, DEHú basics, gestorías, Kabilio and grants. That material is not repeated here except where new facts change it. Several figures come from press releases or secondary media, and that is flagged inline.

## 1. Cash flow and late payment in Spain: how big is it, and what is changing in 2026–2029

### Takeaway
Spanish pymes are paid in about 78–80 days on average, against a 60-day legal maximum. Late payment cost pymes about €1,957M in financing in Q4 2025 alone. 85% of large companies pay late, and there is still no sanctions regime in force. From Oct 2027 to Oct 2029, B2B e-invoicing will require companies to report invoice payment status to the AEAT. That gives Hacienda (and the creditor) verifiable evidence of who pays late. Nobody yet sells a Spanish-law-native collections agent built for that world.

### Cited Findings
- **Observatorio de Morosidad, CEPYME (2H 2025, published 7 Apr 2026)**
  - The average payment period (PMP) was 80.5 days in 2025, 34% above the 60-day legal maximum.
  - The pymes' PMP was 78.3 days in Q4 2025, down from 79.2 a year earlier.
  - Microempresas worsened to an annual average of 80.7 days (+2.3 days).
  - By sector, construction was 96.5 days. By region, Madrid had the highest PMP at 90.9 days.
  - [CEPYME NdP PDF](https://cepyme.es/storage/2026/04/NdP-El-esfuerzo-financiero-de-las-pymes-como-consecuencia-de-la-morosidad-se-cifra-en-1.957-millones-de-euros.pdf)
- **Financial cost of trade debt, CEPYME**
  - The total was €5,568M in Q4 2025, of which pymes bore €1,957M.
  - That splits into €611M for microempresas and €781M for small companies.
  - The installment-sales late-payment index rose to 54.1 points, breaking its downward trend since mid-2023.
  - CEPYME warns of a cycle change, with Euribor rising.
  - [CEPYME NdP PDF](https://cepyme.es/storage/2026/04/NdP-El-esfuerzo-financiero-de-las-pymes-como-consecuencia-de-la-morosidad-se-cifra-en-1.957-millones-de-euros.pdf)
- **Plataforma Multisectorial contra la Morosidad (PMcM), Apr 2026 report on 2025 data**
  - 85% of large companies breach the legal payment terms.
  - The private-sector PMP is 67 days and the public sector's is 70.
  - Main contractors pay subcontractors in 87 days on average.
  - "Confirming" lines are the usual tool for stretching payment terms, and are not always communicated transparently.
  - [Forbes](https://forbes.es/economia/907227/el-85-de-las-grandes-empresas-incumple-los-plazos-legales-de-pago-segun-pmcm/); [Diari de Tarragona](https://www.diaridetarragona.com/economia/262124/grandes-empresas-pagan-tarde-pymes.html); [esdiario](https://www.esdiario.com/economia/260416/185240/85-grandes-empresas-incumple-plazos-legales-pago.html)
  - The PMcM survey also reports 91% support for a sanctions regime — [search summary of PMcM coverage](https://forbes.es/economia/907227/el-85-de-las-grandes-empresas-incumple-los-plazos-legales-de-pago-segun-pmcm/) (figure not seen in the primary report)
- **Ministry of Industry (Consejo Estatal de la PYME, 2 Jul 2026)**
  - The business PMP is 64 days according to the Banco de España and 67 according to the PMcM. The public sector already complies.
  - [Mintur NdP](https://www.mintur.gob.es/es-es/gabineteprensa/notasprensa/2026/documents/20260702%20np%20consejo%20estatal%20de%20la%20pyme.pdf); [La Moncloa, Marco Estratégico PYME 2030](https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/industria-turismo/Paginas/2026/020726-hereu-refuerza-compromiso-pymes.aspx)
- **Informa D&B (Q1 2026)**: the average delay beyond the due date is 14.42 days, among the five worst in the EU. This measures delay past due, not the PMP, so it is not comparable with the figures above — [Merca2](https://www.merca2.es/2026/06/04/morosidad-pymes-espana-2026-14-42-dias-2389828/); [Informa PDF](https://cdn.informa.es/sites/5c1a2fd74c7cb3612da076ea/content_entry5c5021510fa1c000c25b51f0/6a1fd7a97deb180057f1a4ba/files/Pagos_europaT12026_InformaDB_es.pdf)
- **Legal framework: Ley 3/2004 on late payment** (legal maximum 60 days B2B; statutory late-payment interest; fixed compensation for collection costs) — [BOE consolidated Ley 3/2004](https://www.boe.es/buscar/act.php?id=BOE-A-2004-21614)
  - I did not re-fetch the article numbers or the current rate. The €40 per invoice compensation in art. 8 and the interest rate of the ECB rate plus 8 points come from my prior knowledge. Verify both on the BOE.
- **No sanctions regime in force yet**: Spain still has no sanctions regime for late payment. A reform of Ley 3/2004 to add one appears to be in progress, but its stage is unconfirmed — [Diari de Tarragona](https://www.diaridetarragona.com/economia/262124/grandes-empresas-pagan-tarde-pymes.html); [Legal Today](https://www.legaltoday.com/?p=128503)
  - Spendesk claims fines of up to €800,000 under a "nueva ley de morosidad". This is unverified, so treat it as vendor marketing — [Spendesk](https://www.spendesk.com/es/blog/morosidad-facturacion-electronica-b2b/)
- **EU Late Payment Regulation**: the 30-day B2B maximum, proposal 2023/0323(COD), is reported as blocked in the Council as of Aug 2026. Parliament adopted its first-reading position on 23 Apr 2024 — [trans.info](https://trans.info/es/los-transportistas-espanoles-esperan-52-dias-para-cobrar-la-reforma-europea-se-atasca-504049); [Forbes](https://forbes.es/economia/450356/la-eurocamara-apoya-la-nueva-ley-de-morosidad-con-un-limite-de-pago-de-30-dias/)
- **Orden HAC/1028/2026 (in force 6 Oct 2026; BOE-A-2026-20587)**, according to the AEAT page updated 27 Oct 2026:
  - Above €8M turnover: e-invoicing plus reporting of invoice and payment status from **6 Oct 2027**.
  - All other businesses: e-invoicing from **6 Oct 2028**.
  - Legal entities at or below €8M: payment-status reporting from **6 Oct 2028**.
  - Individuals (autónomos) and entities under income attribution: payment-status reporting from **6 Oct 2029**.
  - The order also defines the "solución pública de facturación electrónica", which covers issuing, faithful copies, invoice and payment status, querying and downloading, and authentication and representation.
  - [AEAT Novedades 2026](https://sede.agenciatributaria.gob.es/Sede/iva/novedades-iva/novedades-normativa-2026/orden-hac-1028-2026-2-electronica.html)
  - CORRECTION to the earlier notes: they said reporting for "<€8M starts 2029". The AEAT splits it: 2028 for companies, 2029 for autónomos.
- **Purpose of the reporting**: the AEAT frames e-invoicing as giving "información fiable sobre los plazos efectivos de pago" to curb late payment. The data will feed the Observatorio Estatal de la Morosidad Privada — [AEAT análisis 29 Oct 2026](https://sede.agenciatributaria.gob.es/Sede/informacion-institucional/puede-interesar/analisis/2026/octubre/29/facturacion-electronica-solucion-publica-facturacion-atras.html) (via search snippet)

### Inferences
- Late payment is large (about €2bn per quarter in financing cost for pymes), chronic, and about to become measurable by Hacienda from 2027–2029. A product that turns "I'm owed money" into a legally-grounded, evidence-backed claim is timely: statutory interest, the fixed compensation, the escalation letter and a proceso monitorio dossier.
- Confirming stretches terms, while factoring is "less known". Both are financing workarounds, not collection. The gap is an agent that collects what is legally owed and keeps the commercial relationship intact. A polite, persistent voice call is the culturally Spanish way to collect.

### Gaps
- Not fetched: the PMcM primary report itself, and the full BOE text of Orden HAC/1028/2026. The payment-status fields and reporting deadline (days after payment) are therefore unknown.
- No figures on factoring or confirming volume or cost in Spain were retrieved (AEF data would be the source).
- IVA de caja uptake, the mechanics of facturas rectificativas for impagos (art. 80 LIVA), and the specifics of modelos 303, 130 and 111 were not researched this session.

## 2. Supplier bank-account-change fraud (BEC) and accounts payable automation: who does it and what is missing

### Takeaway
There is no public Spanish statistic on BEC or fake-IBAN fraud. INCIBE, the Banco de España, BBVA, CaixaBank and Vodafone all publish warnings about it, and the Guardia Civil has flagged waves of fraudulent transfers hitting pymes. EU Verification of Payee (VoP) became mandatory on 9 Oct 2025, but it only checks that the name matches the IBAN. Fraudsters can open an account in a matching or similar name, and remittance files (remesas) can bypass the check. Payhawk offers VoP plus dual approval. Nobody enforces information-flow provenance, meaning an IBAN that arrived by email or PDF can never reach a payment field without out-of-band verification. That is exactly Priv8's core.

### Cited Findings
- **Size of the problem**
  - FBI IC3 2025 (US): 24,768 BEC complaints and $3,046M in losses, up from 21,442 and $2,770M in 2024. BEC is the second-largest loss category. No Spanish equivalent exists — [wwwhatsnew 25 Oct 2026](https://wwwhatsnew.com/2026/10/25/fraude-cambio-cuenta-bancaria-falso-ceo-autonomos-pymes/); [ecosistemastartup](https://ecosistemastartup.com/fraude-bec-us3-046m-al-ano-y-como-blindar-tu-pyme/)
  - Spain has no public statistic by fraud type. Interior counts about 500k digital-banking fraud offences in 2025 (+5.3%), but that is not BEC-specific — [ecosistemastartup](https://ecosistemastartup.com/fraude-bec-us3-046m-al-ano-y-como-blindar-tu-pyme/); [ruptura360](https://ruptura360.mx/tecno/fraude-bancario-escala-transferencias-desafian-la-seguridad-digital/) (secondary)
  - The Guardia Civil detected fraudulent transfers affecting companies and pymes in several provinces — [Cronista](https://www.cronista.com/espana/pc-movil/urgente-la-guardia-civil-detecta-transferencias-fraudulentas-en-distintas-provincias-que-afectan-a-empresas-y-pymes)
- **How it works**
  - INCIBE: attackers can sit inside the victim's mailbox for weeks before acting — [wwwhatsnew](https://wwwhatsnew.com/2026/10/25/fraude-cambio-cuenta-bancaria-falso-ceo-autonomos-pymes/); [INCIBE fraude email comprometido](https://www.incibe.es/empresas/te-ayudamos/fraude-email-comprometido); [INCIBE real case via intermediary company](https://www.incibe.es/linea-de-ayuda-en-ciberseguridad/casos-reales/fraude-bec-traves-de-una-empresa-intermediaria); [INCIBE types of BEC](https://www.incibe.es/empresas/blog/bec-tipos-de-fraude-como-operan-los-estafadores-y-como-detectarlos)
  - Banco de España: transfers are irrevocable payment orders. The bank can only ask the beneficiary bank to return the funds — [wwwhatsnew](https://wwwhatsnew.com/2026/10/25/fraude-cambio-cuenta-bancaria-falso-ceo-autonomos-pymes/)
- **Verification of Payee**: mandatory in euro-area banks since 9 Oct 2025 (art. 5c of Reg. 260/2012, added by Reg. 2024/886); it checks that the name matches the IBAN holder — [wwwhatsnew](https://wwwhatsnew.com/2026/10/25/fraude-cambio-cuenta-bancaria-falso-ceo-autonomos-pymes/)
- **Recommended controls**
  - Call back the supplier on the number already in the supplier file.
  - Separate preparer and approver when the IBAN changes or the amount is over a threshold.
  - Do not disable VoP in remesas, and treat "no coincide" as an alert.
  - Distrust urgency.
  - Audit mailbox forwarding rules.
  - [wwwhatsnew](https://wwwhatsnew.com/2026/10/25/fraude-cambio-cuenta-bancaria-falso-ceo-autonomos-pymes/)
  - Banks warn about the same fraud: [BBVA warning](https://finantresnoticias.com/negocios-y-autonomos/facturas-falsas-cambio-iban-aviso-bbva-empresas-antes-pagar-proveedores/); [CaixaBank](https://www.caixabank.com/es/esfera/content/fraude-facturas-empresas-autonomos); [Vodafone Empresas](https://www.vodafone.es/c/empresas/es/nuestra-vision/fraude-cambio-cuenta-bancaria/)
- **Payhawk (incumbent spend/AP)**
  - VoP check before every SEPA payment, not just at supplier onboarding — [Payhawk help](https://payhawk.com/help/es/verification-of-payee-eea-only)
  - Recommends separating who confirms payment data from who authorises payments. It offers dual authorisation for changing supplier details, plus alerts and a change log — [Payhawk fraud prevention](https://payhawk.com/es/plataforma/prevencion-del-fraude)
  - Admins manually fix IBANs that are out of date — [Payhawk help](https://payhawk.com/help/es/why-does-the-iban-differ-for-two-expenses-with-the-same-supplier)
  - AP invoice extraction in 60+ languages — [Payhawk pagos](https://payhawk.com/es/pagos-empresa)
  - Payhawk markets "Edición Otoño '26: Tu IA no solo responde. Ahora actúa sobre tus finanzas", so incumbents are going agentic — [Payhawk help banner](https://payhawk.com/help/es/overview-of-supplier-remittance-advice-in-payhawk)
- **Embat (Madrid, AI treasury)**
  - €30M Series B (May 2026, led by Cathay Innovation), focused on "agentic AI treasury".
  - Launched a banking product on 27 Jul 2026 covering cash management, international payments, collections and reconciliation.
  - Its target is mid-market and corporate finance teams, not micro-pymes.
  - [Cathay](https://www.cathaycapital.com/embat-accelerates-international-expansion-with-eur30-million-series-b-to-expand-its-ai-powered-treasury-management-system/); [IBS Intelligence](https://ibsintelligence.com/ibsi-news/embat-bags-e30m-to-scale-agentic-ai-treasury-solutions/); [Asset Servicing Times](https://www.assetservicingtimes.com/assetservicesnews/industryarticle.php?article_id=18181)
- **AR and collections agents**
  - **Fazeshift** (YC S24, SF): autonomous agents running AR end to end; $17M Series A in May 2026 — [YC](https://www.ycombinator.com/companies/fazeshift); [startups.fm](https://startups.fm/startups/fazeshift-yc)
  - **Audun** (YC S26, Oslo): AI-native debt collection — [YC](https://www.ycombinator.com/companies/audun)
  - **FullSeam** (YC): accounting agents that follow up with customers until they pay — [YC](https://www.ycombinator.com/companies/fullseam)
  - **Cleavr** (Paris): AI invoice collection; €1M pre-seed (Kima), then a reported €8M seed (Varsity). It frames Europe's late-payment problem at about €1 trillion — [The Paypers](https://thepaypers.com/fintech/news/cleavr-raises-eur-8-million-seed-round-for-ai-invoice-collection); [French Tech Journal](https://www.frenchtechjournal.com/europes-eu1-trillion-late-payment-problem-is-getting-worse-cleavr-thinks-ai-can-fix-it)
  - **Paraglide** (Sweden): AI agents for AR; $5M seed (Bessemer, DN Capital), Jan 2026 — [Fintech Global](https://fintech.global/2026/01/27/paraglide-raises-5m-to-bring-ai-agents-to-ar-automation/)
  - **Kolleno**: $4M seed for AR and cash flow — [FF News](https://ffnews.com/newsarticle/kolleno-raises-4m-seed-to-help-businesses-solve-their-cash-flow-struggles)

### Inferences
- **What AP tools miss**: they defend the vendor master with roles and dual approval, which are human process controls. They do not track where each payment field came from. A compromised mailbox plus a plausible PDF still reaches a human approver who "sees a matching VoP". Priv8's provenance policy enforces "data from third-party content cannot enter beneficiary or IBAN fields" as code. Its oracle checks the holder without exposing data. Its signed expediente proves diligence to the bank or insurer. These are a genuinely missing layer.
- **What AR agents miss in Spain**: none of Fazeshift, Cleavr, Paraglide or Audun is Spanish-law-native. None computes Ley 3/2004 interest and compensation, prepares a proceso monitorio, or uses the upcoming AEAT payment-status data as evidence. Most are email-first and enterprise-first, not voice-first for micro-pymes.
- Micro-pymes and autónomos have no AP department at all. "Dual approval" means one person, so an agent doing the second check by voice callback is the realistic control for them.

### Gaps
- No primary Spanish BEC loss statistic. INCIBE's annual balance was not fetched.
- Pleo, Holded, Quipu, Tesorio, Banktrack and Yaydoo AP and anti-fraud features were not verified this session; the searches returned nothing usable.
- No data on how often VoP returns "close match" or "no match", or on whether Spanish banks let pymes skip VoP in remesas.

## 3. Government notifications, aplazamientos and embargos: what is automatable and by which legal route

### Takeaway
DEHú has an official machine interface, LEMA, for "grandes destinatarios": companies that want to access, appear in and distribute notifications automatically. An open-source CLI client also exists. A notifications agent can therefore be built on an official API rather than by scraping. AEAT aplazamientos up to €50,000 need no guarantee, run up to 12 months for VAT, and cost 4.0625% demora interest in 2026. They can be filed online by the taxpayer, an apoderado or a colaborador social. That makes "I can't pay my 303 → prepare an aplazamiento" a concrete, safe agent action under a human hold.

### Cited Findings
- **DEHú LEMA API**
  - Web-service interface for "grandes destinatarios": legal persons with high notification volume who want to automate access, comparecencia and distribution. Registration as gran destinatario can be done from the DEHú front end. The WSDL is on se-dehuws.redsara.es (v2) — [PAe/CTT LEMA](https://administracionelectronica.gob.es/ctt/lema/abstract); [DEHú infographic](https://www.administracionelectronica.gob.es/pae_Home/dam/jcr:c0ce1dd0-a171-4292-a81b-779089d7b9e5/Infografia_Dehu_destinatarios.pdf)
  - AEAT publishes the DEHú manual and the specs for automated querying by grandes destinatarios — [AEAT acceso DEHú](https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/notificaciones-electronicas-ayuda-tecnica/acceso-notificaciones-electronicas-dehu.html)
  - Open-source LEMA client: [nilp0inter/dehucli](https://awesome.ecosyste.ms/projects/github.com%2Fnilp0inter%2Fdehucli)
  - Email alerts for new notifications exist, but they contain no content or deadlines — [AEAT avisos DEHú](https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/notificaciones-electronicas-ayuda-tecnica/recibir-avisos-nuevas-notificaciones-comunicaciones-dehu.html)
  - The Seguridad Social has its own notification sede — [Sede SS notificaciones](https://sede.seg-social.gob.es/wps/portal/sede/sede/Inicio/NotificacionesTelematicas/notificaciones+telematicas)
  - Notific@ is the issuer-side platform — [PAe Notifica](https://administracionelectronica.gob.es/ctt/notifica/abstract)
  - Some regional platforms (Catalonia's e-NOTUM) are integrating with DEHú — [AOC](https://www.aoc.cat/en/blog/2024/e-notum-sintegra-amb-la-dehu/)
  - The 10-day rule, días de cortesía and art. 43 Ley 39/2015 are already documented in the earlier notes.
- **AEAT aplazamientos**
  - No guarantee is needed when all aplazadas or pending debts total €50,000 or less (since 2023). Sources disagree on whether the basis is Orden HFP/387/2023 or HFP/311/2023 — [Grupo2000](https://www.grupo2000.es/novedades-aeat-aplazamiento-fraccionamiento-pago); [goveasy](https://es.goveasy.eu/en/blog/aplazamiento-deudas-tributarias-aeat-2026)
  - Up to 12 monthly installments for quarterly VAT; individuals in some sources up to 24 — [Billeo](https://www.billeo.es/blog/como-aplazar-el-iva-trimestral-a-hacienda); [invoo](https://invoo.es/es/blog/guias/aplazar-pago-impuestos-hacienda-autonomos/)
  - Interés de demora 4.0625% and interés legal 3.25% in 2026 — [goveasy](https://es.goveasy.eu/en/blog/aplazamiento-deudas-tributarias-aeat-2026) (secondary)
  - Some debts cannot be deferred, such as the IS pagos fraccionados — [Merca2](https://www.merca2.es/2026/06/18/aplazar-pago-impuesto-sociedades-requisitos-2400368/)
  - Jul 2026: a confirmed form lets taxpayers acknowledge a debt and request an aplazamiento (reconocimiento de deuda con solicitud de aplazamiento) — [El Español](https://www.elespanol.com/sociedad/20260721/confirmado-gobierno-puedes-reconocer-deuda-hacienda-aplazar-pago-formulario/1003744320384_0.amp.html); [Merca2](https://www.merca2.es/2026/07/21/reconocer-deuda-hacienda-aplazar-pago-formulario-2421552/); [TaxDown](https://taxdown.es/blog/reconocimiento-deuda-solicitud-aplazamiento)
- **Legal routes**: colaboradores sociales can file aplazamientos for third parties. Apoderamiento covers notifications and follow-up — [AEAT aplazamientos colaboradores](https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/colaboracion-social-ayuda-tecnica/consulta-solicitudes-aplazamiento-colaboradores.html); [AEAT colaboradores](https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/colaboracion-social-ayuda-tecnica/presentacion-declaraciones-colaboradores-sociales_.html) (both already in the earlier notes)

### Inferences
- **The comparecencia is itself the legal act.** Accessing a DEHú notification makes it served and starts the appeal and payment deadlines. An agent should therefore triage on metadata (issuer, concept, dates available before opening) and track the 10-day clock. Opening ("comparecer") should go under human hold, or happen deliberately on the last useful day. This is a non-obvious design point that a jury will recognise as legally literate.
- **Legal route for the agent, in order of safety**:
  1. A company client registers as a DEHú gran destinatario and uses LEMA with its own certificate. The agent runs on the client's machine via the Priv8 local executor.
  2. Apoderamiento (AEAT/DEHú) to a gestoría partner, which operates the agent.
  3. A colaborador social partner for filings (aplazamientos, modelos).
  4. Never let the model hold the .p12 or the Cl@ve PIN. The local executor signs only after a human approval.
- An agent cannot file a "proceso monitorio" on its own. LexNET and court filing need a lawyer or procurador only above €2,000, so below that the creditor can file directly. That figure is not verified this session.

### Gaps
- I did not read the LEMA spec, so it is unconfirmed whether LEMA exposes metadata before comparecencia and whether it supports apoderados. Check the AEAT spec PDF.
- Not researched: TGSS embargo flows (diligencias de embargo de cuentas, Import@ss aplazamientos) and certificate issuance (al corriente).
- Not found: an official ruling on AI agents using certificates. This is the same gap as in the earlier notes.

## 4. Concepts: novel, demo-able hackathon products (mandatory format)

### Takeaway
The strongest new concept is **Pago Blindado (IBAN Guard)**, an AP agent whose payment fields cannot be fed by third-party content. It is a direct reuse of Priv8's provenance policy, oracle and signed expediente, aimed at a fraud every Spanish bank warns about. It scores **4.35/5 weighted**. Close behind is **Cobro 8**, a voice-first, Ley 3/2004-native collections agent (4.08). After that come **Plazo 8**, a unified government-notification inbox on the official DEHú LEMA API (3.85), **Cierre 8**, a voice quarter close with aplazamiento under hold (3.58), and **Factura Viva**, which prepares pymes for e-invoice payment-status reporting and financing (3.20).

### Cited Findings
(Each concept below cites its sources inline. Weighting used throughout: Innovation and viability 30%, AI 15%, UX 15%, Technical 30%, Presentation 10%.)

---

#### Concept A — Pago Blindado (working name; or "IBAN Guard 8")
1. **Name and one-liner**: An accounts payable agent that pays your suppliers but can never be tricked into paying a new IBAN. Bank details that arrive by email or PDF cannot reach the payment field until 8 has verified them by voice on the phone number you already had.
2. **Problem**
   - BEC is the second-largest fraud loss category in the US: $3.046bn in 2025 — [wwwhatsnew](https://wwwhatsnew.com/2026/10/25/fraude-cambio-cuenta-bancaria-falso-ceo-autonomos-pymes/)
   - INCIBE documents real Spanish cases, including attackers who wait weeks inside the mailbox — [INCIBE](https://www.incibe.es/linea-de-ayuda-en-ciberseguridad/casos-reales/fraude-bec-traves-de-una-empresa-intermediaria)
   - Transfers are irrevocable, according to the Banco de España — [wwwhatsnew](https://wwwhatsnew.com/2026/10/25/fraude-cambio-cuenta-bancaria-falso-ceo-autonomos-pymes/)
   - BBVA and CaixaBank issue explicit warnings — [BBVA](https://finantresnoticias.com/negocios-y-autonomos/facturas-falsas-cambio-iban-aviso-bbva-empresas-antes-pagar-proveedores/); [CaixaBank](https://www.caixabank.com/es/esfera/content/fraude-facturas-empresas-autonomos)
   - The Guardia Civil has warned of waves of fraudulent transfers — [Cronista](https://www.cronista.com/espana/pc-movil/urgente-la-guardia-civil-detecta-transferencias-fraudulentas-en-distintas-provincias-que-afectan-a-empresas-y-pymes)
   - VoP (since 9 Oct 2025) only checks name against IBAN — [wwwhatsnew](https://wwwhatsnew.com/2026/10/25/fraude-cambio-cuenta-bancaria-falso-ceo-autonomos-pymes/)
   - GAP: there is no Spanish loss figure. Say so honestly in the pitch.
3. **Who pays and how much**: pymes with 5–250 staff and the gestorías that run payments for clients, on a SaaS model at about €29–99 per month per entity. Insurers (cyber policies) and banks could white-label it as an anti-fraud layer. GAP: there is no sourced number of Spanish pymes; DIRCE was not retrieved. The European late-payment and AR market is framed at about €1 trillion of late invoices — [French Tech Journal](https://www.frenchtechjournal.com/europes-eu1-trillion-late-payment-problem-is-getting-worse-cleavr-thinks-ai-can-fix-it) (AR side, a proxy only)
4. **Competition**
   - Payhawk offers VoP before each payment, dual authorisation for supplier changes and a change log — [Payhawk](https://payhawk.com/es/plataforma/prevencion-del-fraude); [Payhawk VoP](https://payhawk.com/help/es/verification-of-payee-eea-only)
   - Embat targets corporate treasury — [Cathay](https://www.cathaycapital.com/embat-accelerates-international-expansion-with-eur30-million-series-b-to-expand-its-ai-powered-treasury-management-system/)
   - Banks offer VoP itself.
   - **What they lack**: none of them control where data came from. The controls are role- and human-based, and a micro-pyme has only one person to fill both roles. There is no automated out-of-band callback, and no signed proof of diligence to present to a bank or insurer.
5. **What we build, and what it reuses from Priv8**
   - The agent reads the inbox and the PDF invoices, builds the payment run and executes it on the bank portal (computer use on the DOM).
   - **Reuses**:
     - tokens ([IBAN_1]), so the model never sees the real IBAN;
     - the **provenance policy**: an IBAN whose provenance is "email or attachment" is tainted and blocked from the beneficiary field;
     - the **oracle**: "does the new IBAN holder equal the supplier's CIF name?" via VoP, without revealing it;
     - the **human hold** for the transfer;
     - the **signed expediente**;
     - **8** with voice: an ElevenLabs agent calls the supplier on the master-file number and asks them to confirm the change.
   - Almost the whole Priv8 core is reused.
6. **Novelty**: information-flow control (CaMeL-style) applied to accounts payable. "The email cannot change the payment" is enforced by code, not by policy. There is also an automated, recorded voice callback to the phone number on file. I found no product doing either.
7. **Frontier AI and audio**
   - Claude extracts invoices, detects "account change" semantics, including subtle phrasings and multilingual ones, and drafts the callback script.
   - ElevenLabs Conversational AI places the callback in Spanish.
   - **Metrics** for the demo:
     - 10/10 seeded BEC emails blocked;
     - 0 tainted fields reaching the payment form;
     - time to pay a 20-invoice run, manual versus agent;
     - callback completed in under 60 s.
8. **3-minute demo and 1–3 day feasibility**
   - Script:
     1. A fake Gmail with 5 invoices, one of them saying "hemos cambiado de banco".
     2. The agent prepares the run.
     3. The tainted IBAN is blocked.
     4. 8 calls the "supplier" (a teammate's phone), and the supplier says "no hemos cambiado nada".
     5. The fraud is shown in red and the expediente is signed.
     6. The other 4 payments go to the bank-portal mock and stop at a hold for approval.
   - Feasibility: high. The provenance, tokens and executor already exist. Simulate the bank portal and VoP response. ElevenLabs outbound calling or a browser call is enough for the demo.
9. **Sponsor fit**: Claude is the core. ElevenLabs is the visible callback. MyInvestor and GPTadvisor fit is weak, though MyInvestor has business accounts (not verified). Fit is good for Claude and ElevenLabs and weak for the investment sponsors.
10. **Scores**:
    - Innovation and viability 4.5: real fraud with bank warnings, and provenance as a new layer.
    - AI 4: language plus live voice that matters.
    - UX 4.
    - Technical 4.5: largely built.
    - Presentation 4.5: a dramatic live "the fraudster loses" moment.
    - **Weighted 4.35.**
11. **Risks**
    - There is no Spanish loss statistic.
    - Payhawk could add a callback.
    - Auto-calling suppliers raises GDPR and recording consent questions, so announce the recording.
    - Real bank portals need PSD2 or a bank partner; the demo uses a mock.
    - The jury may see it as "anti-fraud" and therefore typical. Frame it as **AP automation that is safe by construction**, not as "scam alerts for the elderly".
12. **Sources**: inline above.

---

#### Concept B — Cobro 8 (Spanish-law-native collections agent with voice)
1. **Name and one-liner**: 8 chases your late invoices for you. It calls your client politely, computes the legal interest and the €40 they owe you, and if they keep stalling, hands you a signed monitorio dossier ready to file.
2. **Problem**
   - Pymes get paid in 78.3 days against a 60-day maximum.
   - The financing cost of late payment for pymes was €1,957M in Q4 2025 alone. Microempresas are getting worse (80.7 days).
   - [CEPYME](https://cepyme.es/storage/2026/04/NdP-El-esfuerzo-financiero-de-las-pymes-como-consecuencia-de-la-morosidad-se-cifra-en-1.957-millones-de-euros.pdf)
   - 85% of large companies pay late, and subcontractors wait 87 days — [Forbes/PMcM](https://forbes.es/economia/907227/el-85-de-las-grandes-empresas-incumple-los-plazos-legales-de-pago-segun-pmcm/)
   - There is no sanctions regime, and the EU 30-day regulation is blocked — [Diari de Tarragona](https://www.diaridetarragona.com/economia/262124/grandes-empresas-pagan-tarde-pymes.html); [trans.info](https://trans.info/es/los-transportistas-espanoles-esperan-52-dias-para-cobrar-la-reforma-europea-se-atasca-504049)
   - Self-help is the only lever.
3. **Who pays and how much**
   - Autónomos and micro-pymes pay a subscription of about €19–49 per month, or a success fee on recovered interest and compensation. The success fee is attractive because the money is "extra" the client legally owes.
   - Gestorías could resell it.
   - Market proxy: financing cost of €1,957M per quarter for pymes — [CEPYME](https://cepyme.es/storage/2026/04/NdP-El-esfuerzo-financiero-de-las-pymes-como-consecuencia-de-la-morosidad-se-cifra-en-1.957-millones-de-euros.pdf)
4. **Competition**
   - Fazeshift (YC S24, US enterprise AR) — [YC](https://www.ycombinator.com/companies/fazeshift)
   - Audun (YC S26, Norway, debt collection) — [YC](https://www.ycombinator.com/companies/audun)
   - Cleavr (France, €8M seed) — [The Paypers](https://thepaypers.com/fintech/news/cleavr-raises-eur-8-million-seed-round-for-ai-invoice-collection)
   - Paraglide (Sweden, $5M) — [Fintech Global](https://fintech.global/2026/01/27/paraglide-raises-5m-to-bring-ai-agents-to-ar-automation/)
   - Kolleno — [FF News](https://ffnews.com/newsarticle/kolleno-raises-4m-seed-to-help-businesses-solve-their-cash-flow-struggles)
   - Embat (collections inside corporate treasury) — [Asset Servicing Times](https://www.assetservicingtimes.com/assetservicesnews/industryarticle.php?article_id=18181)
   - Factoring and confirming finance the gap rather than collect it — [Forbes/PMcM](https://forbes.es/economia/907227/el-85-de-las-grandes-empresas-incumple-los-plazos-legales-de-pago-segun-pmcm/)
   - **What they lack**:
     - no Ley 3/2004 computation (statutory interest plus fixed compensation);
     - no Spanish monitorio dossier;
     - no voice-first approach;
     - none targets Spanish micro-pymes;
     - none is ready for AEAT payment-status data (2027–2029).
5. **What we build, and what it reuses**
   - The agent reads issued invoices from the invoicing software or a CSV and watches due dates.
   - Escalation ladder:
     1. friendly WhatsApp or email;
     2. a voice call by 8, in Spanish, in the creditor's chosen tone;
     3. a formal requerimiento with the calculated interest and €40 per invoice;
     4. a monitorio dossier (invoice, delivery evidence, requerimientos, call transcripts) as a signed expediente.
   - **Reuses**: tokens (the client's IBAN and data), the provenance policy (a debtor's email saying "pay to this other account" cannot alter anything), the human hold before formal escalation, the signed expediente as court evidence, and the 8 character and voice.
6. **Novelty**
   - Collections that know Spanish law, computing the exact legal claim.
   - A voice agent negotiating a payment date and recording a commitment ("promesa de pago").
   - The evidence chain is formatted for the monitorio.
   - Positioned for the moment Hacienda gets payment-status data — [AEAT Orden HAC/1028/2026](https://sede.agenciatributaria.gob.es/Sede/iva/novedades-iva/novedades-normativa-2026/orden-hac-1028-2026-2-electronica.html)
7. **Frontier AI and audio**
   - Claude plans the escalation, handles the debtor's objections in conversation ("ya lo he pagado", "no me llegó la factura") through tool calls to the ledger, and drafts the legal letter.
   - ElevenLabs Conversational AI handles the call, with emotion and tone control.
   - **Metrics**:
     - legal claim computed to the cent against a hand calculation;
     - call to payment commitment in under 2 minutes;
     - DSO before and after on a simulated 50-invoice ledger;
     - share of objections resolved without a human.
8. **Demo and feasibility**
   - Script:
     1. A dashboard shows €18k overdue across 12 invoices.
     2. 8 calls the "client" (a jury member, live).
     3. The client stalls, and 8 cites the 60-day term and the €40 compensation.
     4. The client commits to Friday.
     5. A promise is recorded and signed.
     6. For a second debtor, the agent generates the monitorio PDF.
   - Feasibility: high. ElevenLabs agent plus Claude tools on mocked data, and the interest formula is simple. Real data: CSV exports from Holded or Quipu, or simulated.
9. **Sponsor fit**: ElevenLabs is the hero, and Claude does legal reasoning. MyInvestor: weak. GPTadvisor: weak.
10. **Scores**:
    - Innovation 4: AR agents exist abroad, but Spanish-law plus voice is new.
    - AI 4.5: voice negotiation is the star.
    - UX 4.
    - Technical 4.
    - Presentation 4: a live call with the jury.
    - **Weighted 4.08.**
11. **Risks**
    - Debt-collection conduct rules and harassment limits, plus GDPR for recorded calls.
    - The legal figures (€40, interest rate, monitorio thresholds) need BOE verification. They are not verified this session.
    - Many pymes are afraid of annoying a big client. Mitigation: tone control, and the "friendly" level comes first.
    - Less Priv8 reuse than Concept A.
12. **Sources**: inline.

---

#### Concept C — Plazo 8 (one inbox for every government notification, with a deadline engine)
1. **Name and one-liner**: 8 watches DEHú, AEAT and Seguridad Social for you. It tells you each morning, by voice, what arrived, how many days you have before it counts as served, and what you need to do. It never opens a notification without your OK, because opening starts the clock.
2. **Problem**
   - The 10-day rule: an unopened notification is deemed served after 10 days (art. 43 Ley 39/2015), and the payment and appeal deadlines start running — [AEAT NEO](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/folleto-actividades-economicas/11-notificaciones-electronicas/11_2-notificaciones-electronicas-obligatorias-neo.html)
   - Notices seen only by the gestoría have cost autónomos their rights — [mutuafacil](https://mutuafacil.es/autonomos/regularizacion-cuotas-autonomos/) (secondary, from the earlier notes)
   - The official email alerts carry no content and no deadline — [AEAT avisos](https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/notificaciones-electronicas-ayuda-tecnica/recibir-avisos-nuevas-notificaciones-comunicaciones-dehu.html)
   - Notifications are split across several sedes (DEHú, Seguridad Social, regional ones) — [Sede SS](https://sede.seg-social.gob.es/wps/portal/sede/sede/Inicio/NotificacionesTelematicas/notificaciones+telematicas); [AOC e-NOTUM](https://www.aoc.cat/en/blog/2024/e-notum-sintegra-amb-la-dehu/)
3. **Who pays and how much**
   - Gestorías managing hundreds of clients, which carry liability when a notice is missed, at about €2–5 per client per month.
   - Pymes, at about €9–19 per month.
   - RETA has more than 3.5M autónomos — [MITES AUT](https://www.mites.gob.es/estadisticas/AUT/AUT_11_2025.pdf)
   - Gestoría tooling is a proven market, with Kabilio at nearly 500 firms — [TNW](https://thenextweb.com/news/kabilio-raises-e10m-to-bring-ai-agents-to-accounting-firms) (from the earlier notes)
4. **Competition**
   - The official DEHú email alerts.
   - Gestoría software from the large vendors (a10, Sage, Wolters Kluwer). Their notification modules were not verified this session.
   - The open-source dehucli — [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fnilp0inter%2Fdehucli)
   - Kabilio does document chasing, not notifications — [TNW](https://thenextweb.com/news/kabilio-raises-e10m-to-bring-ai-agents-to-accounting-firms)
   - **What they lack**: pre-opening triage with a legal-clock model, voice briefings, a drafted response or payment and an aplazamiento under hold, and a signed record of who saw what and when, for the "notified only to the gestoría" disputes.
5. **What we build, and what it reuses**
   - Connectors: DEHú via **LEMA** (official API) where the client is a gran destinatario; computer use on the Seguridad Social and AEAT sedes otherwise.
   - A deadline engine: the 10-day window, then the payment or appeal deadline once served.
   - Claude summarises each notice after it is opened.
   - **Reuses**: the local executor holding the certificate, the human hold on "comparecer", the signed audit, 8's voice and the tokens (NIF and amounts).
6. **Novelty**: treating the act of opening as a legal decision. No product I found reasons about "open now or on day 10". It is a single voice inbox across administrations, built on the official machine interface (LEMA) rather than screen-scraping.
7. **Frontier AI and audio**
   - Claude classifies the notice type (requerimiento, providencia de apremio, propuesta de liquidación, embargo) and extracts deadlines and amounts.
   - ElevenLabs reads the morning brief and answers questions ("¿qué pasa si no pago?").
   - **Metrics**: classification and deadline-extraction accuracy on a test set of about 20 real anonymised notices; time from arrival to user awareness; zero notifications lapsing silently.
8. **Demo and feasibility**
   - Script:
     1. Three pending notices are shown with countdowns.
     2. 8 says: "Tienes una propuesta de liquidación del 303, te quedan 4 días antes de que cuente como notificada; si la abres hoy tienes 10 días hábiles para alegar…" (confirm the exact legal deadlines).
     3. The user says "ábrela".
     4. The hold is approved, and the PDF is summarised.
     5. A draft reply or aplazamiento is prepared.
   - Feasibility: medium. LEMA needs gran destinatario registration and a certificate, which is risky in 1–3 days, so mock the DEHú with real-format sample notices and show dehucli against the real API if the team holds a certificate.
9. **Sponsor fit**: Claude and ElevenLabs are strong. MyInvestor and GPTadvisor are weak.
10. **Scores**:
    - Innovation 4.
    - AI 4.
    - UX 4.
    - Technical 3.5: the real API integration is uncertain.
    - Presentation 4.
    - **Weighted 3.85.**
11. **Risks**
    - Not verified: whether LEMA exposes metadata before comparecencia, and whether it supports apoderados.
    - The legal deadlines per notice type must be exact, since a wrong deadline means liability.
    - It overlaps with the earlier notes' top idea, so the coordinator may treat it as non-novel.
12. **Sources**: inline.

---

#### Concept D — Cierre 8 (voice-first quarterly close with a "can't pay" path)
1. **Name and one-liner**: At the end of each quarter, 8 sits with you for 5 minutes by voice, reconciles your bank against your invoices, shows the 303 and 130 to pay, and checks whether your account covers them. If it doesn't, it prepares the aplazamiento (up to €50k without guarantee) for you to sign.
2. **Problem**
   - Autónomos spend 226 hours a year on bureaucracy, about €3,390 a year — [Diario de León/ATA](https://www.diariodeleon.es/economia/260811/2093911/burocracia-cuesta-autonomo-3-400-euros-ano.html) (from the earlier notes)
   - Cash is tight because of late payment (80.7-day PMP for micro firms) — [CEPYME](https://cepyme.es/storage/2026/04/NdP-El-esfuerzo-financiero-de-las-pymes-como-consecuencia-de-la-morosidad-se-cifra-en-1.957-millones-de-euros.pdf)
   - Aplazamientos are available up to €50k without guarantee, at 4.0625% — [goveasy](https://es.goveasy.eu/en/blog/aplazamiento-deudas-tributarias-aeat-2026); [Grupo2000](https://www.grupo2000.es/novedades-aeat-aplazamiento-fraccionamiento-pago)
   - A new acknowledgement-plus-aplazamiento form is available — [El Español](https://www.elespanol.com/sociedad/20260721/confirmado-gobierno-puedes-reconocer-deuda-hacienda-aplazar-pago-formulario/1003744320384_0.amp.html)
3. **Who pays and how much**: autónomos at about €15–30 per month, priced below online gestorías (€49+) — [Xolo](https://blog.xolo.io/es/xolo-vs-taxdown-que-gestoria-online-es-mejor-para-autonomos-en-2026) (from the earlier notes)
4. **Competition**: online gestorías (Declarando, Xolo, TaxDown, Taxfix), and Holded and Quipu, which publish content on aplazamiento — [Holded](https://www.holded.com/es/blog/aplazamiento-iva-pymes). "Rumbo" (another Hackfinance team) is a voice tax copilot for nomads. **What competitors lack**: none combines the close with a bank-balance check via the oracle and an aplazamiento filed under hold.
5. **What we build, and what it reuses**: the oracle ("does the balance cover the 303?", answered without revealing the balance), tokens, the hold before filing, the expediente and 8's voice. Filing goes through a colaborador social partner — [AEAT](https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/colaboracion-social-ayuda-tecnica/consulta-solicitudes-aplazamiento-colaboradores.html)
6. **Novelty**: moderate. The voice close plus the aplazamiento path is new as a package, but it sits close to Rumbo and to online gestorías.
7. **Frontier AI and audio**: Claude reconciles and explains the result. ElevenLabs runs the dialogue. **Metrics**: close time against a manual baseline; 303 boxes matching a gestoría-prepared reference.
8. **Demo and feasibility**: mock bank CSV and invoices, then compute the 303 and 130, run the oracle check and produce the aplazamiento draft. Feasibility is medium-high, but tax correctness is the risk.
9. **Sponsor fit**: Claude and ElevenLabs are strong. MyInvestor has a weak link (idle cash could be parked in a money-market fund until the tax payment date).
10. **Scores**: Innovation 3 (Rumbo overlap), AI 4.5, UX 4, Technical 3.5, Presentation 3.5. **Weighted 3.58.**
11. **Risks**: the jury may see it as a Rumbo clone. Errors in the tax computation carry liability. The specifics of modelos 303 and 130 were not researched here.
12. **Sources**: inline.

---

#### Concept E — Factura Viva (payment-status readiness plus financing from verified status)
1. **Name and one-liner**: A ledger that records the status of every invoice (received, accepted, paid) the way the AEAT will require from 2027–2029. It warns you before you report yourself as a late payer, and it lets you finance a verified-accepted invoice with factoring.
2. **Problem**
   - Payment-status reporting starts 6 Oct 2027 for companies above €8M, 6 Oct 2028 for other companies and 6 Oct 2029 for autónomos — [AEAT](https://sede.agenciatributaria.gob.es/Sede/iva/novedades-iva/novedades-normativa-2026/orden-hac-1028-2026-2-electronica.html)
   - The data feeds the late-payment observatory — [AEAT análisis](https://sede.agenciatributaria.gob.es/Sede/informacion-institucional/puede-interesar/analisis/2026/octubre/29/facturacion-electronica-solucion-publica-facturacion-atras.html)
   - Factoring is "less known" among pymes — [Forbes/PMcM](https://forbes.es/economia/907227/el-85-de-las-grandes-empresas-incumple-los-plazos-legales-de-pago-segun-pmcm/)
3. **Who pays and how much**: factoring fintechs pay a lead or referral fee. Pymes pay a subscription. The market size is not sourced (no AEF data retrieved).
4. **Competition**: e-invoicing vendors (Holded, Quipu, Billin, Banqup) — [Banqup](https://www.banqup.com/es-es/resources/blog/10-essential-facts-on-spain-s-broad-invoicing-mandates); [Quipu](https://getquipu.com/blog/factura-electronica-b2b/). **What they lack**: using the status data for financing and collections is not evident.
5. **Reuse**: little. Some provenance and expediente.
6. **Novelty**: medium. The obligation is 1–3 years away, so the urgency is weak today.
7. **AI and audio**: weak fit for audio.
8. **Demo**: feasible, but not dramatic.
9. **Sponsor fit**: weak.
10. **Scores**: Innovation 3.5, AI 3, UX 3, Technical 3, Presentation 3.5. **Weighted 3.20.**
11. **Risks**: the payment-status format is not known yet (BOE text not read), and incumbents will build this.
12. **Sources**: inline.

### Inferences
- **Recommendation**: Concept A is the best fit for the existing Priv8 core. It reuses tokens, provenance, the oracle, the hold, the expediente and 8, and has a live "fraudster loses" voice moment. Concept B is the best ElevenLabs showcase. They combine naturally into one product, **"8 para tu caja: cobra y paga sin que te la cuelen"**. The inbound side (B) chases debtors and the outbound side (A) pays suppliers safely, with one provenance engine underneath.
- Neither A nor B overlaps with Rumbo (tax for nomads) or with typical "AI finance assistant" ideas.

### Gaps
- No Spanish market-size figures (number of pymes paying by transfer, BEC losses, factoring volume).
- The legal constants for Concept B (the €40 compensation, the interest rate, monitorio thresholds) and the deadlines per notice type for Concept C need checking against the BOE.
- Not verified: whether MyInvestor offers business accounts, which would affect sponsor fit for A and D.
