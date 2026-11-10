# Hackfinance: the event, winning patterns and building blocks for a reliable demo (as of 10 Nov 2026)

Method: web searches and fetches on 10 Nov 2026, plus live probes of `https://mcp.myinvestor.es/mcp` (JSON-RPC `initialize`, `tools/list`, `tools/call`) run from Madrid on the same day. Where a fact comes from my own probe, it says so.

## (a) The event: official page, organizers, dates, prize, sponsors, judges, previous editions

### Takeaway
There is an official page: **"Hackathon Finance", Madrid Engineering Week (MEW) 2026, organized by BEST UC3M with Anthropic, MyInvestor, ElevenLabs and GPTadvisor**, at UC3M's Leganés campus. It opened on **8 Nov**, and teams present to a jury on **12 Nov** (one page says 8-13 Nov). Teams have **4 to 6 people**, and prizes are **"up to €500"**. The challenge is "set by the company", and the page names GPTadvisor as the company participants get to know. **Judges are not published.** This is the first finance hackathon in the MEW series: the 2025 edition's tech challenge was a CaixaBank Tech augmented-reality competition. Today is 10 Nov, so **about 2 days of build time remain**.

### Cited Findings
- MEW 2026 runs **3-12 Nov 2026 at UC3M Leganés**. The listing reads "Hackathon Finance, 8-12 NOV, Anthropic, MyInvestor, GPTadvisor & ElevenLabs", with registration closed. It is the 7th edition since 2019, with 6 activities and 7 partner companies (Claude, MyInvestor, GPTAdvisor, ElevenLabs, Nexthink, JetBrains, Ineco). — [mew.bestuc3m.es](https://mew.bestuc3m.es/)
- Hackathon page: "8 - 13 de NOVIEMBRE 2026 · UC3M · LEGANÉS … Con el apoyo de Claude, MyInvestor, ElevenLabs y GPTAdvisor". Teams of **4 to 6** "deberán idear y desarrollar una solución tecnológica capaz de dar respuesta al reto planteado por la empresa". The opening on **8 Nov** at Leganés presented the challenge and the requirements and provided workspace and food. Teams can keep working **until 12 Nov**, when they present "ante un tribunal experto". Participants get to "conocer de cerca el funcionamiento de GPTadvisor" and can win "premios de hasta 500 €". — [mew.bestuc3m.es/hackathon-2026](https://mew.bestuc3m.es/hackathon-2026/)
- The program page says "Gana hasta 500€ … diseñar y desarrollar … una herramienta capaz de revolucionar el mundo de las finanzas. El reto combinará programación, innovación e inteligencia artificial". The closing **job fair is on 12 Nov, 18:30-20:00, with ElevenLabs, MyInvestor, Nexthink and GPTadvisor**, so the sponsors' people will likely be on campus that day. — [mew.bestuc3m.es/mew-2026](https://mew.bestuc3m.es/mew-2026/)
- MEW appears as an official UC3M activity in a 2025/26 university resolution: elective credits (RC optativos) for "Madrid Engineering Week 25_26". — [UC3M resolution PDF](https://www.uc3m.es/secretaria-virtual/media/secretaria-virtual/doc/archivo/doc_madrid-engineering-week-25_26/resolucion-actividad-con-rc-optativos_justificante-1.pdf)
- The **2025 edition had no finance hackathon**. It had a Siemens 3D-printing boat race, a CaixaBank Tech AR challenge, an Amazon masterclass, a JetBrains workshop, the Colegio de Ingenieros Industriales and Ineco. The 2025 organizing team is listed: main organizer Blanca Monteagudo Vega, with others for corporate relations, marketing and logistics. — [mew.bestuc3m.es/mew-2025](https://mew.bestuc3m.es/mew-2025/)
- The rubric and deliverables in the bases are: Innovation & viability 30%; frontier AI 15% ("tecnologías de lenguaje y audio avanzado … impacto medible en la usabilidad, la interactividad o la accesibilidad"); UX & accessibility 15% (including "tiempos de respuesta razonables"); technical implementation 30% ("solución acabada, madura y funcional lista para ejecutar"); presentation 10%. Deliverables: a GitHub repo and the "Download ZIP" (the ZIP is what gets evaluated), a README with install/config/run/test steps, a one-page PDF, and a PowerPoint. Any demo "deberá corresponder a la versión entregada". Submission is through a BEST UC3M form. — local file `/Users/aaangel/Developer/Priv8/bases/bases-hackathon.pdf` (no public URL found)
- Other teams' public repos for this event: **Rumbo** (voice tax copilot for digital nomads, "Proyecto para HackFinance 2026", last push 8 Nov) — [GitHub](https://github.com/nevambla/rumbo-hackfinance2026). **STUD€NTIA** (student budgeting app: shared expenses, coupons, an AI assistant through a Supabase Edge Function calling Claude, plain `index.html`; created 8 Nov, last push 9 Nov) — [GitHub](https://github.com/sergiofernandezmtnez/little_pretty_engineers_hackfinance)
- A public web search for "Hackfinance 2026 BEST UC3M" found nothing beyond the MEW site. No Luma or Eventbrite page, judge list or published "reto" text showed up. — [search context: the MEW site is the only primary source found](https://mew.bestuc3m.es/hackathon-2026/)

### Inferences
- The judges are probably people from GPTadvisor, MyInvestor, ElevenLabs and Anthropic, plus BEST or UC3M. The rubric's wording ("lenguaje y audio avanzado") reads like ElevenLabs and Anthropic input. A product that uses the **MyInvestor/GPTadvisor MCP** and **ElevenLabs audio** in a way that can't be removed speaks directly to the jury.
- The competition so far is student-grade: single-file HTML apps, budgeting assistants and voice tax copilots. A polished, end-to-end working demo with numbers on screen will stand out on the two 30% criteria.
- With about 2 build days left, scope has to be ruthless. Build one flow end to end, have a recorded backup video, and keep the README runnable from the ZIP (`.env.example`, seeded synthetic data, one command).

### Gaps
- I could not find the exact "reto" text presented on 8 Nov, the judge names, the number of prizes, or whether there are sponsor-specific prizes. Only the 8 Nov in-person briefing has them, so ask the organizers or teammates who attended.
- "Up to €500" may be a per-team total or the top prize; the page is ambiguous.
- I did not check Instagram or LinkedIn posts (@bestuc3m) because they need a login.

## (b) Winning patterns at comparable hackathons (fintech, Claude, ElevenLabs)

### Takeaway
Winners share a **striking live demo of an agent doing a real-world job** (calling businesses, operating a domain tool), **domain depth from someone close to the problem**, and **visible proof** (grounded sources, graders, measurements). The things penalized are the reverse: chatbots without action, demos that differ from the code, and no numbers.

### Cited Findings
- ElevenLabs Worldwide Hackathon winners: **GibberLink** (global, two agents switch to a data-over-sound protocol, chosen for "an intriguing demo"); **Procuro** (calls suppliers about delayed parts, "judges were blown away"); **Dealwise** (SF #1, calls local businesses for quotes); **Claimsio** (Warsaw #2, compliant debt collection). — [hacks.elevenlabs.io](https://hacks.elevenlabs.io/hackathons/8) (as summarized in `research_notes/Producto ganador Hackfinance/voz_finanzas_hackathons.md`)
- Claude "Built with Opus 4.7" winners: **Medkit** (1st, a gamified clinical simulator where an agentic grader scores against published guidelines, built on Claude Managed Agents); **Wrench Board** (2nd, the agent tells technicians which pad to probe and refines hypotheses from measurements); **Maieutic** (3rd, an IDE comparing spec intent with code); special prizes for **Most Creative Use**, the **"Keep Thinking" Prize** (MaestrIA, a home-repair diagnosis built on knowledge from the builder's carpenter father) and **Best Use of Managed Agents** (ARIA, five agents monitoring machine signals). No criteria or weights were published. — [claude.com](https://claude.com/resources/articles/meet-the-winners-of-built-with-opus-4-7-claude-code-hackathon)
- Claude Opus 4.8 Build Day (12-hour event, 310 participants, $500 in credits each): **Tekton** (1st, 3D reconstruction where every component links to its historical source), **Sim Francisco** (2nd, a synthetic census-based population whose polls came close to real results), **Custom Universe** (3rd, photo to editable 3D object). None is finance. — [claude.com blog](https://claude.com/blog/meet-the-winners-of-our-claude-opus-4-8-build-day-hackathon)
- The Opus 4.6 hackathon drew ~13,000 applicants for 500 places, and several winners were non-engineering domain experts (a lawyer's CrossBeam for permitting, a cardiologist). — [claude.com](https://claude.com/resources/articles/meet-the-winners-of-our-built-with-opus-4-6-claude-code-hackathon); [EdTech Innovation Hub](https://www.edtechinnovationhub.com/news/a-doctor-a-carpenter-and-a-teacher-win-anthropics-global-opus-47-hackathon)
- Generic fintech hackathon advice: judges score innovation, technical implementation, usability and impact; read the rubric and ask the sponsor what it wants; cover every criterion; start from a real everyday problem. — [Open Bank Project](https://www.openbankproject.com/blog/4-ways-to-win-any-fintech-hackathon/); [The Capital](https://medium.com/thecapital/how-to-win-a-hackathon-from-a-judge-mentor-and-participant-perspective-b7bfe9cd20a1); [WHub](https://medium.com/whub/how-to-win-a-fintech-hackathon-e0da060c601)
- An ETHGlobal finance event exists in 2026 (HackMoney 2026), but I did not review its finalists. — [ETHGlobal](https://ethglobal.com/events/hackmoney2026)

### Inferences
- Patterns to copy: (1) the agent **acts**, not just answers (calls, fills forms, produces an artifact); (2) **verifiability** wins with judges: grounded sources (Tekton), graders (Medkit), measured outcomes (Sim Francisco); (3) **one surprising moment** in the demo (GibberLink); (4) sponsor tech in a central role, since prize categories like "Best Use of X" reward it.
- Penalized, according to the advice sources and the rubric: generic assistants (the user already ruled these out), slideware, demos that don't match the submitted ZIP (explicitly disallowed in the bases), slow responses (UX criterion), and no business model (viability is 30%).

### Gaps
- I did not review galleries from BBVA, Santander or CaixaBank hackathons, or ETHGlobal fintech finalists, in this pass. Devpost searches weren't run because of the tool budget.
- No hackathon I found publishes judge scoring sheets that show penalties explicitly.

## (c) Building blocks for a 1-3 day build in Spain: reliability, limits, costs

### Takeaway
The most reliable blocks are: the **MyInvestor MCP** (public, no auth, stateless, ~60-110 ms per call measured from Madrid, 12 read-only tools including **backtesting**); the **Claude Messages API with the MCP connector** (remote MCP servers called server-side, tools only); and **ElevenLabs Agents** (low-latency STT/TTS, webhook tools, Twilio/SIP, ZRM). Riskier: **computer use** live (slow, token-heavy, misclicks), **real open banking** (needs a TPP license or Enable Banking restricted mode on your own accounts), and **Verifactu pre-production** (needs a digital certificate).

### Cited Findings
**MyInvestor MCP (sponsor block)**
- `https://mcp.myinvestor.es/mcp` is the official MyInvestor connector for Claude.ai, ChatGPT, Perplexity, Grok and Gemini. It covers the public catalogue: **2,400+ mutual funds**, **13 automated portfolios** (6 MyInvestor indexed + 7 Finanbest), **~1,050 ETFs** and **~6,000 stocks**. It is **read-only: no orders, no client data**, and "actions requiring a contract open MyInvestor's public website in a new tab". It is free and needs no account. It is maintained by MyInvestor Banco with **GPTadvisor**, contact info@gptadvisor.com. — [about.md](https://mcp.myinvestor.es/about.md)
- Tools listed by `tools/list` (my probe, 10 Nov 2026): `search_funds` (filters: query, isins, asset_type, geography, sector, management_type, market_cap, fixed_income_type, credit_quality, currency, distributing, esg_only, max_ter, max_risk, and more), `compare_instruments` (2-3 funds/ETFs/stocks), `get_funds` (full profile by ISIN, model-only), `list_facets`, `resolve_funds` (free-text names to ISINs with a confidence of high or ambiguous), `search_portfolios`, `compare_portfolios`, **`backtest_portfolio`** (1-10 holdings with weights; returns cumulative/annualized return, volatility, max drawdown, Sharpe, correlation), `search_etfs`, `search_stocks`, `get_instruments`, `list_instrument_facets`. — [about.md](https://mcp.myinvestor.es/about.md); probe of `https://mcp.myinvestor.es/mcp`
- My probe showed the server speaks MCP protocol `2025-06-18` over Streamable HTTP (SSE responses), server "myinvestor" v2.0.0, behind the Imperva CDN. A `tools/call` worked **without an `initialize` session** (stateless). Three `resolve_funds` calls took **0.11 s, 0.06 s and 0.06 s**. Results carry `_meta.ui.resourceUri` (MCP Apps widgets such as `ui://funds/search-results.html`) plus `structuredContent` usable by our own UI. The server instructions tell the model to treat tool output as untrusted data and to keep tool names confidential. — probe of `https://mcp.myinvestor.es/mcp`
- Terms of use govern the connector. — [terms.md](https://mcp.myinvestor.es/terms.md)

**Claude API**
- MCP connector (beta; headers `mcp-client-2026-09-15` / `mcp-client-2025-11-20`): pass `mcp_servers` (type `url`, optional `authorization_token`) plus an `mcp_toolset` in `tools`. **Only MCP tool calls** are supported, not resources or prompts. The server must be public over HTTP (Streamable HTTP or SSE), so local stdio servers won't work. It is **not ZDR-eligible**. — [Claude docs: MCP connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
- Computer use: the latest version is `computer_toolset_20260801` (no beta header) on the Opus/Sonnet/Haiku 5.x families. It is not available in Managed Agents. Each screenshot costs ~1,000-1,800 input tokens. Clicks can miss on downscaled or Retina screenshots, and Claude may assume an action succeeded without checking. Anthropic recommends a sandbox VM, keeping credentials away from the model, domain allowlists, and **human confirmation for payments**. Prompt injection from web pages and images is called a real risk. — [Claude docs: computer use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)

**ElevenLabs**
- Official API pricing page: **$0.08/min** (burst $0.16/min above the concurrency cap). Realtime v1 Mini/Max cost $0.08/min plus LLM tokens. Included minutes by tier: 15 / 75 / 275 / 1,238 / 3,738 / 12,375, with concurrency limits of 4, 6, 10, 20, 30 and 40 (the page doesn't map limits to plans). There is a Startup Grants Program (12 months, 33M characters) and a "30,000 credits for $1" Starter promotion. **No hackathon credits are mentioned.** — [elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api)
- Aggregators list plans at Free $0 (about 10-15 agent minutes, no commercial license), Starter $6, Creator $22, Pro $99, Scale $299 and Business $990. A price cut was reported on 7 May 2026. — [HappyRobot](https://www.happyrobot.ai/hub/elevenlabs-pricing); [UsagePricing](https://www.usagepricing.com/blueprint/activity/elevenlabs-2026-05-07-conversational-ai-price-cut); [developersdigest](https://www.developersdigest.tech/voice-agents/elevenlabs-agents)
- Scribe v2 Realtime: ElevenLabs claims under 150 ms latency in 90+ languages. Agents support webhook/client/system tools, native Twilio outbound calls (`POST /v1/convai/twilio/outbound-call`), SIP trunking, and Zero Retention Mode (API only; LLMs allowed include Claude). — [ElevenLabs blog](https://elevenlabs.io/blog/scribe-v2-realtime-in-elevenlabs-agents); [Twilio outbound API](https://elevenlabs.io/docs/eleven-agents/api-reference/twilio/outbound-call.md); [ZRM docs](https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm); [Agents overview](https://elevenlabs.io/docs/agents-platform/overview)
- Practitioner notes: set STT to "es" and use a native Spanish voice; Twilio webhooks time out at 15 s. — [DEV](https://dev.to/callstacktech/integrate-elevenlabs-for-natural-voice-ai-in-your-application-a-developers-journey-2l8d)

**Spanish open banking**
- The Redsys PSD2 HUB gives standardized XS2A APIs for **80+ entities** with a centralized sandbox. Each bank has its own sandbox page (e.g. Inversis, Selfbank, Cajamar, Banco Caminos), and access to the sandbox is requested at psd2.sandbox.soporte@redsys.es. — [Redsys PSD2](https://redsys.es/en/psd2.html); [Redsys dev guide](https://market.apis-i.redsys.es/psd2/xs2a/guia); [Inversis node](https://market.apis-i.redsys.es/psd2/xs2a/nodos/inversis)
- Enable Banking (an aggregator): most Spanish banks use Redsys. It has a sandbox covering BBVA and Sabadell, and limits of one active auth session per user per TPP. — [Enable Banking ES](https://enablebanking.com/docs/markets/es/)
- Enable Banking **"restricted mode"** in production is **free** and fetches data only from accounts the developer links themselves. Sandbox and personal use stay free, but apps can't go public without a contract. — [Enable Banking linked accounts](https://enablebanking.com/docs/api/linked-accounts/); [FAQ](https://enablebanking.com/docs/faq); [Changelog Dec 2025](https://enablebanking.com/blog/2026/01/15/enable-banking-changelog-december-2025); [Firefly III guide](https://docs.firefly-iii.org/tutorials/data-importer/eb/)
- CaixaBank has an "API Store" for companies. — [CaixaBank API store](https://caixabank.cat/empresa/bancadistancia/api-store.html)

**AEAT Verifactu**
- The AEAT has opened Verifactu voluntary-submission web services and QR validation in its **external testing (pre-production) environment**. — [fiskaly](https://www.fiskaly.com/blog/verifactu-pre-production-environment-opens-officially-for-developers); [fiscal-requirements](https://www.fiscal-requirements.com/news/3254-fiscalization-in-spain-the-newest-verifactu-updates-pre-production-environment-for-developers-is-opened)
- Submitting requires a qualified **digital certificate (.p12/.pfx)**. In test mode the QR points to pre-production. Certificate errors (e.g. code 4112) are common. — [Golfmanager help](https://intercom.help/golfmanager/es/articles/12832143-v3-verifactu); [Sage community](https://communityhub.sage.com/es/sage-despachos-connected/f/gestion-interna/257327/error-en-envio-de-facturas-en-empresa-de-pruebas-verifactu)

### Inferences
- **Best reliability per hour of work:** Claude (Messages API + MCP connector pointing at the MyInvestor MCP) + ElevenLabs Agent (web widget or WebRTC; phone via Twilio only if someone owns the number setup) + **synthetic** data for bank statements and positions. Real PSD2 data isn't worth the risk with 2 days left. If needed, link one teammate's own account in Enable Banking restricted mode, and keep a synthetic fallback.
- Server-side MCP calls from Anthropic go through Imperva. That worked from Claude.ai, so it should work from the API too, but **test on day 1**. Fallback: call the MCP directly from our backend (stateless JSON-RPC, as probed) and pass the results to Claude as ordinary tools.
- Run computer use **only on a local, controlled mock page** (or read the DOM instead, as Priv8 does) and **pre-record** it. Live, it costs ~1-2k tokens per screenshot and takes seconds per step, which hurts the "tiempos de respuesta" UX criterion.
- Latency budget for a voice turn: STT (~0.15 s) + Claude (time to first token, varies) + TTS. Show a live latency counter, since the rubric explicitly scores response time.
- Measurable metrics to show: the share of ISINs resolved automatically by `resolve_funds` (high vs ambiguous), fees saved per year (TER delta × balance), backtest delta (return/volatility/max drawdown) from `backtest_portfolio`, task time with voice vs manual, PII tokens leaked to the LLM (should be 0), and prompt-injection attempts blocked.

### Gaps
- I didn't verify official ElevenLabs Free/Starter credits on the main pricing page; the plan-to-concurrency mapping is unclear.
- I didn't check the BBVA API Market or Banco Sabadell developer portal status in 2026, or whether CaixaBank's API Store has a self-serve sandbox.
- I didn't find an official AEAT URL for the Verifactu pre-production endpoints; all sources are vendors.
- I found no Spanish synthetic bank-statement dataset. Plan to generate one (Claude can produce Norma 43 / CSV / PDF statements).
- I didn't measure Claude's end-to-end latency with the MCP connector.

## (d) Demo-strong concepts given these building blocks

### Takeaway
Four concepts make the sponsor tech essential and produce a number on screen: **Traspaso Abierto** (voice X-ray of fund fees plus MyInvestor backtest, ending in a signed transfer mandate), **Llamada Ciega** (an ElevenLabs agent makes calls to the bank for the user while the LLM sees only tokens), **Verifactu Hablado** (voice-to-legal invoices sent live to AEAT pre-production) and **Cartera a Prueba** (adversarial "red team your advisor" voice debate grounded in backtests). The first two reuse the most of Priv8 and fit the sponsors best.

### Cited Findings
- `backtest_portfolio`, `resolve_funds`, `compare_instruments` and `search_portfolios` exist and are read-only; contracting is left to MyInvestor's site. — [about.md](https://mcp.myinvestor.es/about.md)
- ElevenLabs Agents support webhook tools, Twilio outbound calls and ZRM. — [ZRM](https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm); [Twilio outbound](https://elevenlabs.io/docs/eleven-agents/api-reference/twilio/outbound-call.md)
- EU AI Act Art. 50 transparency obligations apply from 2 Aug 2026: a voice agent must disclose that it is an AI. — [Cooley](https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026)
- Spain's Ley 10/2025 on customer service (95% of calls answered in under 3 min, a right to a human; firms have 12 months to adapt). — [Consumo Responde](https://www.consumoresponde.es/art%C3%ADculos/nueva_ley_de_servicios_de_atencion_la_clientela_lsac)
- The Verifactu pre-production environment is open. — [fiskaly](https://www.fiskaly.com/blog/verifactu-pre-production-environment-opens-officially-for-developers)
- Hackathon winners in agent-calls-for-you voice products: Procuro, Dealwise. — [hacks.elevenlabs.io](https://hacks.elevenlabs.io/hackathons/8)

### Inferences (concept proposals; market and competitor figures belong to the market-research notes and are marked as gaps here)

**Concept 1: Traspaso Abierto ("tell it what you have, it shows what it costs you and hands you the signed transfer")**
1. *One-liner:* By voice or with a statement PDF, the user says what funds they hold. The agent resolves each to an ISIN, computes how much the fees cost them, backtests the indexed alternative from MyInvestor's catalogue, and generates a pre-filled transfer (traspaso) mandate that ends in MyInvestor's app.
2. *Problem:* Investors don't know the TER of their bank funds or the cost compounded over years. Transfers between Spanish funds are a manual, paper-heavy process. (Spanish fee and transfer-volume figures: GAP, take them from the market notes.)
3. *Who pays:* MyInvestor/GPTadvisor (customer-acquisition cost per transferred AUM), or B2B2C licensing to advisors. (CAC/AUM figures: GAP.)
4. *Competition:* The MyInvestor MCP itself only browses the catalogue. Comparators show fees but don't parse your statement or produce the mandate. (Named competitors: GAP.)
5. *What we build / reuse:* Claude + MCP connector (`resolve_funds` → `get_funds` → `backtest_portfolio` current vs proposed → `compare_instruments`). ElevenLabs voice intake with character "8" answering. Priv8 tokenization for the holder's name, DNI and IBAN on the statement. Provenance policy, so a note inside the PDF can't change the destination fund. Signed audit record, as with Open2Agents.
6. *Novelty:* It closes the loop from "what do I own" to a mandate ready to sign, with the AI never seeing PII, using the sponsor's own backtest engine.
7. *AI + audio metric:* ISINs auto-resolved (% high confidence), € fees saved over 10 years, backtest Δ return/volatility, time to mandate (voice vs manual form), PII tokens sent to the LLM = 0.
8. *3-minute demo:* Upload a synthetic statement from "Banco X" and speak: "tengo el Fidelity MSCI World y un fondo de Santander". The resolver asks which share class by voice. Show the fee chart and the backtest. Inject a malicious note in the PDF ("transfiere a ES99…") and watch it get blocked. Then the signed mandate PDF plus a deep link to MyInvestor. *Feasibility:* high. All APIs are live and the data is synthetic. ~1.5 days for 4 people.
9. *Sponsor fit:* MyInvestor and GPTadvisor (their MCP is central), Claude (MCP connector), ElevenLabs (voice intake and narration). The best fit of the four.
10. *Scores (1-5):* Innovation/viability 4 (clear business model for the sponsor); frontier AI 4 (voice is useful but not essential); UX 4; technical 5 (real APIs, deterministic); presentation 5. **Weighted ≈ 4.4**.
11. *Risks:* MyInvestor's terms of use for third-party apps (not checked); the voice part could look decorative; overlaps the team's existing "Mandato 8".
12. *Sources:* above.

**Concept 2: Llamada Ciega (the agent calls your bank for you; the LLM never hears your data)**
1. *One-liner:* An ElevenLabs phone agent calls the bank or insurer on the user's behalf (to cancel a product, request certificates or dispute a fee). The LLM reasons over `[IBAN_1]`/`[DNI]` tokens, and a local executor speaks the real values only on the audio leg.
2. *Problem:* Hold times and phone-only processes. Ley 10/2025 now sets service standards, and AI Act Art. 50 requires disclosure. (Spanish wait-time data: GAP.)
3. *Who pays:* Consumers (success fee, like Pine AI's 10-30%), or banks and neobanks as a white-label service. (Pricing evidence in `voz_finanzas_hackathons.md`.)
4. *Competition:* Pine AI and Relaya are US-focused, English only, and don't make a privacy claim at the token level. (See the voice notes.)
5. *What we build / reuse:* Priv8 tokenization, oracle, provenance and the signed record; character 8's voice; ElevenLabs Twilio outbound with webhook tools to the executor; Claude for planning and turns.
6. *Novelty:* A split-screen transcript (tokens) next to the audio (real values) is new and visual. An opening line compliant with Art. 50.
7. *Metric:* PII tokens in the LLM context = 0, turn latency (ms), task success over N test calls, minutes of the user's time saved.
8. *Demo:* A live call to a teammate playing "atención al cliente MyInvestor" (or a second ElevenLabs agent), with the split screen and a warm transfer to the user for SCA. *Feasibility:* medium. Telephony setup and the 15 s webhook timeout are risks; keep a web-call fallback.
9. *Sponsor fit:* ElevenLabs and Claude strong; MyInvestor weak unless the call is "pide el certificado de traspaso".
10. *Scores:* Innovation 4, AI/audio 5, UX 4, technical 3.5 (live telephony), presentation 5. **Weighted ≈ 4.1**.
11. *Risks:* The organizers listed "voice for elderly/anti-fraud" as typical, so the pitch must not look like that. Real banks will ask for the account holder; recording consent is unverified.
12. *Sources:* above plus the voice notes.

**Concept 3: Verifactu Hablado (a self-employed person dictates an invoice, it reaches the AEAT test system)**
1. *One-liner:* A self-employed worker (autónomo) dictates "factura a Acme, 3 horas a 60, IVA 21, retención 15". Claude structures it, validates NIF, VAT and withholding (IRPF), chains the Verifactu hash, sends it to AEAT pre-production, and returns the CSV code and the QR.
2. *Problem:* The Verifactu obligation for software and self-employed workers (dates: GAP, take them from the tax notes).
3. *Who pays:* Self-employed workers through a SaaS subscription; tax advisory firms (gestorías).
4. *Competition:* Invoicing SaaS products already certify for Verifactu (B2Brouter, fiskaly APIs). Voice-first plus validation is the gap. Overlaps with Rumbo's tax angle.
5. *Reuse:* Little of Priv8 (tokenizing the client's NIF); 8's voice.
6. *Novelty:* Moderate.
7. *Metric:* Seconds from speech to an invoice accepted by the AEAT, and the field error rate vs a manual form.
8. *Demo:* A real AEAT pre-production response on screen is a strong moment. *Feasibility:* medium-low. Needs a valid certificate and XML/SOAP signing in under 2 days.
9. *Sponsor fit:* Claude and ElevenLabs; none with MyInvestor or GPTadvisor.
10. *Scores:* Innovation 3, AI 4, UX 4, technical 3, presentation 4. **Weighted ≈ 3.4**.
11. *Risks:* Certificate and SOAP integration time; the overlap with Rumbo.
12. *Sources:* above.

**Concept 4: Cartera a Prueba (a voice "devil's advocate" for your investment plan, grounded in backtests)**
1. *One-liner:* The user says their plan out loud ("60% Nasdaq, 40% oro"). Two voices (ElevenLabs), a proponent and a skeptic, debate it using only numbers from `backtest_portfolio` and `compare_instruments`. The session ends in a one-page suitability-style report.
2. *Problem:* Retail investors decide on their own, without advice. MiFID suitability is costly for advisors. (Figures: GAP.)
3. *Who pays:* Robo-advisors and GPTadvisor (B2B "explainability layer").
4. *Competition:* GPTadvisor's own advisor tools (not reviewed); generic chatbots that aren't grounded.
5. *Reuse:* Little (8 as the moderator).
6. *Novelty:* An adversarial, grounded multi-voice format, where every claim is cited to a tool result (the Tekton-style "every claim linked to its source" pattern).
7. *Metric:* % of spoken claims backed by a tool call (grounding rate), and the user's comprehension quiz score before and after.
8. *Demo:* Very lively, two voices plus charts. *Feasibility:* high (MCP + ElevenLabs TTS only).
9. *Sponsor fit:* MyInvestor, GPTadvisor, Claude, ElevenLabs, all four.
10. *Scores:* Innovation 3.5 (close to "AI finance assistant"), AI/audio 5, UX 4, technical 4.5, presentation 5. **Weighted ≈ 4.1**.
11. *Risks:* Could be read as personalized investment advice (MiFID); could be seen as "the typical AI finance app".
12. *Sources:* above.

### Gaps
- The market size, competitor names and Spanish figures for each concept were outside this researcher's scope. They should come from the market and regulation notes.
- The exact challenge statement from 8 Nov may favour a concept (e.g. if GPTadvisor's challenge is about advisors, Concept 4 or 1). Get the briefing before choosing.
