# Voice AI in finance, ElevenLabs for a finance demo, and what wins fintech/AI hackathons (as of 10 Nov 2026)

Note on sources: most company metrics below come from the companies themselves (case studies, marketing) and are marked as self-reported. Searches ran on 10 Nov 2026.

## (a) Who uses voice agents in finance, for whom, and with what results

### Takeaway
Voice agents in finance work at scale mostly on the **institution side** (collections, loan and mortgage servicing), and the reported results there are large but self-reported: tens of millions of calls, 40-45% headcount cuts. The **consumer side**, where an agent calls the bank or insurer for the user, is less crowded. Pine AI is the main product there, plus small tools such as Relaya and KallyAI. Several hackathon winners were "agent that calls businesses for you" projects.

### Cited Findings
**Institution side (B2B)**
- Salient (auto-lending servicing and collections): its "Taylor" agents automate collections, inbound support, welcome and verification calls, and Westlake Financial handles 10M+ calls per month with them (Salient case study, self-reported). — [Salient / Westlake](https://www.trysalient.com/resources/westlake)
- Salient at Westlake: a 45% cut in servicing headcount and at least $12M in annual savings (secondary profile). — [Yespress](https://yespress.io/salient)
- Salient at American Credit Acceptance: 300,000+ calls per month. The case study gives no outcome metrics. — [Salient / ACA](https://www.trysalient.com/resources/aca)
- Salient's general claims: 40% fewer outbound collections staff, 60% fewer inbound care calls, 39M+ interactions and $1B+ collected (self-reported). — [Salient blog](https://www.trysalient.com/blog/ai-voice-agents-consumer-lending)
- Salient reportedly reached $25M ARR and a $500M valuation in two years with zero churn (secondhand reporting). — [WebProNews](https://www.webpronews.com/salients-ai-collections-surge-25m-arr-zero-churn-in-two-years); [AOL/BI](https://www.aol.com/articles/salient-ai-loan-processing-startup-175739627.html)
- Consumer Portfolio Services (a listed lender) announced in May 2025 that it had deployed Salient's AI servicing and collections platform. — [Seeking Alpha PR](https://seekingalpha.com/pr/20096503-consumer-portfolio-services-deploys-ai-powered-servicing-platform-from-salient-to-advance)
- Kastle (YC S24) builds voice and SMS agents for mortgage servicing: payment collection, escrow questions and loss mitigation. The agents connect to the servicing system and telephony, leave loan comments, and hand calls back to humans. — [kastle.ai](https://kastle.ai); [YC](https://ycombinator.com/companies/kastle)
- Kastle's traction figures conflict: "10 of top 25 servicers, $2B+ processed" in one source, "$1B in payments" in another. Seed funding is reported as $2.3M (Commerce Ventures) or $2.8M. — [Dealroom/YC Root Access](https://dealroom.co/news/talk-UKwpr_Trvns-kastles-ai-employee-for-banks-2b-processed-and-scaling/); [Fondo](https://fondo.com/blog/kastle-launches); [Extruct](https://www.extruct.ai/hub/kastle-ai-funding/)
- Kastle pivoted about a month before YC Demo Day, dropping a real-estate SDR idea at roughly $4k MRR to focus on agents. — [Dealroom/YC Root Access](https://dealroom.co/news/talk-UKwpr_Trvns-kastles-ai-employee-for-banks-2b-processed-and-scaling/)
- Other YC voice-caller companies in insurance and claims are all B2B: LunaBill (healthcare billing calls to insurers), Health Harbor (S23, calls insurers for clinics), Toothy AI (W25, dental insurance verification), Zudo (W23, warranty claims), Avallon AI (X25, claims for TPAs). — [LunaBill YC launch](https://www.ycombinator.com/launches/Ooq-lunabill-ai-voice-callers-for-healthcare-billing-teams); [Health Harbor](https://altss.com/companies/yc/health-harbor); [Toothy](https://yespress.io/toothy-ai-yc-w25); [Zudo](https://yespress.io/zudo-work); [Avallon](https://yespress.io/avallon-ai-yc-x25)
- Bank of America's Erica (mostly text, with voice added later): 3B+ interactions, about 50M users, and "98% find the information they need, significantly decreasing call center volume" (bank's own claim, not a defined containment rate). EricaAssist (agent assist) cut average call time by nearly 1 minute. — [BofA newsroom, Aug 2025](https://newsroom.bankofamerica.com/content/newsroom/press-releases/2025/08/a-decade-of-ai-innovation--bofa-s-virtual-assistant-erica-surpas.html); [IT Brief](https://itbrief.news/story/bank-of-america-adds-ai-to-ericaassist-for-faster-calls)

**Consumer side (acting for the user)**
- Pine AI (19Pine Pte. Ltd.) calls customer service for the user: it negotiates bills, cancels subscriptions and disputes bank fees. It researches policies and competitor prices, calls retention departments, waits on hold and follows up until the issue is solved. — [App Store](https://apps.apple.com/us/app/pine-ai-your-ai-call-agent/id6746403769); [Pine blog](https://www.19pine.ai/blog/how-pine-works-simplifying-bill-management-and-negotiation)
- Pine claims a 93-94% negotiation success rate and savings of up to $1,000 per year. It charges a success fee of 10-30% of savings (self-reported). — [Pine blog](https://www.19pine.ai/blog/how-pine-works-simplifying-bill-management-and-negotiation)
- SiliconANGLE (6 May 2026) covered Pine's launch of an agentic service for complex customer-service interactions. — [SiliconANGLE](https://siliconangle.com/?p=747588)
- Relaya presents itself as a consumer agent that dials, navigates phone menus, waits on hold and connects you once a human answers ("all voice AI products today are geared towards businesses"). — [Relaya](https://neynar.notion.site/Relaya-27e655195a8b80659c2deaa975bb79ba)
- KallyAI markets AI-made insurance calls (holds, transfers) for consumers (vendor page). — [KallyAI](https://kallyai-landing.pages.dev/blog/how-to-avoid-calling/insurance-company)

### Inferences
- The market splits in two. The institution side (Salient, Kastle) is funded, proven and crowded. The consumer side (Pine) is an emerging category and almost nobody serves it in Spain or in Spanish. A hackathon project on the consumer side looks fresh to judges and still matches a pattern investors already recognise ("Pine for Spain").
- **Voice adds measurable value** when the other party is phone-only or phone-first (retention departments, insurers' claims lines, collections), when calls are high-volume and repetitive (servicing), or when the user can't use the screen. **Voice is a gimmick** when it just reads out a dashboard the user could look at faster, or when it replaces a button with a spoken command and gains nothing.

### Gaps
- I found no independent (non-vendor) audit of Salient, Kastle or Pine metrics.
- I found no Spanish or European startup doing consumer-side calls to banks or insurers.
- I did not verify Vapi-based fintechs specifically.

## (b) Where voice has measurable impact, and the numbers

### Takeaway
Hard numbers exist for operational efficiency on the institution side (call volume, headcount, handle time). Accessibility needs are well documented: visually impaired users struggle with banking channels and skew older. But I found no robust figures on voice-banking adoption among elderly users.

### Cited Findings
- Bureau of Internet Accessibility survey: at least 58% of banks did not provide sufficient digital accessibility for disabled customers. — [Retail Banker International](https://www.retailbankerinternational.com/comment/retail-banking-people-with-disabilities/)
- A table attributed to Mastercard reports that respondents with visual disabilities have difficulty with each channel: ATMs 60%, mobile 60%, online and phone banking 80%. The methodology is unverified. — [Disabled World](https://www.disabled-world.com/disability/finance/financial-inclusion.php)
- Ofcom (UK): people with a visual impairment are more likely to be retired than non-disabled people (57% vs 18%). — [Ofcom PDF](https://www.ofcom.org.uk/__data/assets/pdf_file/0030/132969/Research-summary-vision-impairment.pdf)
- About 12M Americans have visual impairments, and mobile banking remains "structurally inaccessible" to them (UC Berkeley student project, advocacy framing). — [Berkeley iSchool 2026](https://www.ischool.berkeley.edu/projects/2026/finsight-inclusive-mobile-banking-blind-and-low-vision-users)
- Institutional efficiency figures (all self-reported): Salient 40-45% headcount reduction and 60% fewer inbound calls; EricaAssist about 1 minute less per call; Erica "significantly decreasing call center volume". — sources in (a)
- Spain's Ley 10/2025 (BOE, 27 Dec 2025) requires 95% of calls to be answered in under 3 minutes, guarantees human attention on request, and bans purely automated service. Companies have 12 months to adapt (until about the end of December 2026). For financial services the law applies only where sector rules don't cover the point. — [Consumo Responde](https://www.consumoresponde.es/art%C3%ADculos/nueva_ley_de_servicios_de_atencion_la_clientela_lsac); [Management Solutions PDF](https://www.managementsolutions.com/sites/default/files/publicaciones/esp/nt-boe-lsac.pdf); [Menorca.info](https://www.menorca.info/actualidad/dudas-respuestas/2026/06/05/2642915/adios-largas-esperas-telefonicas-ley-confirma-podran-pasar-mas-minutos-antes-atiendan.html); [finreg360](https://finreg360.com/alerta/la-ley-que-regula-los-servicios-de-atencion-a-la-clientela-se-ha-promulgado/)

### Inferences
- Metrics a team can actually show in a demo: minutes of the user's time saved per task (hold time plus call time), task completion rate across N test calls, latency per turn (ms), and STT accuracy on Spanish finance vocabulary (IBAN, amounts, policy numbers). Comparing "with voice" vs "without" (steps, taps, minutes) makes the impact of the audio itself measurable, which is what the rubric asks for.
- Ley 10/2025 works in a team's favour: an agent that calls for the user, waits on hold and hands over to a human agent fits a legal right that comes into force for companies around December 2026, a timely hook for a pitch.

### Gaps
- I found no Spanish data on how long people wait on bank or insurer phone lines, and no data on how often consumers call banks or insurers.
- I found no reliable statistic on voice-banking use by elderly people. The Thales "89% of visually impaired victims of fraud" figure has no source, so don't use it.

## (c) Phone calls for the user: legal, consent and privacy in Spain/EU, and the tokenization idea

### Takeaway
Since 2 Aug 2026, the EU AI Act Article 50 requires a voice agent to say at the first interaction that it is an AI, and vendor guidance says it should also say on whose behalf it calls. The other side may still demand identity checks or the account holder. A privacy design where the LLM only sees tokens and a local executor speaks the real data only to the institution is defensible. It also fits ElevenLabs' Zero Retention Mode and webhook tools.

### Cited Findings
- AI Act Article 50 transparency duties apply from 2 Aug 2026. The Commission published guidelines on 20 Jul 2026. — [Cooley](https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026); [Sidley](https://datamatters.sidley.com/2026/06/24/eu-ai-act-transparency-obligations-preparing-for-compliance-by-2-august-2026/); [DLA Piper](https://www.dlapiper.com/en-gl/insights/publications/2026/08/the-eus-new-guidelines-on-ai-transparency)
- A phone agent must disclose that it is a machine and, per vendor guidance, on whose behalf it calls, at the latest at the first interaction. The "obvious" exception is read narrowly, so a human-sounding voice must disclose. — [Famulor](https://www.famulor.io/nl/blog/eu-ai-act-article-50-what-your-ai-phone-agent-must-say); [artificialintelligenceact.eu](https://artificialintelligenceact.eu/?p=6131)
- Machine-readable marking under Article 50(2) may get an extension to 2 Dec 2026 for systems already on the market, via the Digital Omnibus (pending formal adoption per one source). — [Sidley](https://datamatters.sidley.com/2026/06/24/eu-ai-act-transparency-obligations-preparing-for-compliance-by-2-august-2026/)
- Fines for transparency breaches are reported at up to €15M or 3% of turnover. I did not check this against the regulation text. — [Cooley](https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026)
- ElevenLabs ZRM: no call recordings are stored, and transcripts or metadata with PII are not logged after the call. Data comes out through post-call webhooks. It can be enabled per agent or enforced for the whole workspace. Debugging is limited. — [ElevenLabs ZRM docs](https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm)
- ZRM covers API use only, not the web UI or playground. The allowed LLMs listed are Gemini, Claude and ElevenLabs-hosted Qwen, though another doc page differs. Under ZRM, "Eleven Realtime v1 Max" is the only Realtime model, in the US and EU only. — [ZRM resource](https://elevenlabs.io/docs/resources/zero-retention-mode); [ZRM agents docs](https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm); [HIPAA page](https://elevenlabs.io/docs/agents-platform/legal/hipaa)
- Agents support webhook (server) tools, client tools and system tools (transfer, end call, language detection). — [ElevenLabs Agents overview](https://elevenlabs.io/docs/agents-platform/overview)

### Inferences (opinion)
- Proposed architecture: the LLM reasons over placeholders such as `{{IBAN_1}}` and `{{DNI}}`. When the institution asks for a value, the agent calls a webhook tool on a local executor. The executor injects the real value only into the outgoing audio leg, or returns it as a TTS-only string that is never echoed back into the LLM context. With ZRM on the agent and redaction in the transcript, the team can show judges a transcript with tokens next to the audio with real data, which is a very visual way to show privacy by design.
- Opening line that satisfies Article 50: "Hola, soy un asistente de IA llamando en nombre de [titular], que ha autorizado esta llamada." Store the consent record (timestamp, scope) and show it in the demo.
- In a live demo, banks will likely require identity verification from the account holder (or a power of attorney). The safest demo is a "warm transfer": the agent waits on hold and does the triage, then brings the user in for authentication. Alternatively, call a mock institution played by a teammate or a second agent.

### Gaps
- I did not check GDPR rules on recording third-party agents in Spain, or whether consent to record calls is needed. I found no Spanish case law on AI agents acting as a consumer's representative on calls.
- I found no doc confirming whether ZRM applies to calls routed through SIP or Twilio.

## (d) ElevenLabs capabilities for a finance demo (2026)

### Takeaway
ElevenLabs Agents covers the whole demo stack: STT (Scribe v2 Realtime), LLM orchestration, TTS, tools/webhooks, native Twilio outbound calls, SIP trunking, and ZRM. Spanish is a major language for them. Pricing is low for a hackathon, though the figures come from aggregators.

### Cited Findings
- Scribe v2 Realtime: ElevenLabs claims under 150 ms latency across 90+ languages (the launch blog gives 30-80 ms) and 93.5% on FLEURS over 30 languages (vendor claim). It is integrated into Agents. — [ElevenLabs blog](https://elevenlabs.io/blog/scribe-v2-realtime-in-elevenlabs-agents); [Realtime STT page](https://elevenlabs.io/realtime-speech-to-text); [HN thread](https://hn.jakechampion.name/item/45905100)
- ElevenLabs says a large share of its agents run in Spanish, Portuguese and Hindi. I found no Spanish-specific error rate (WER). — [ElevenLabs blog (PL)](https://elevenlabs.io/pl/blog/scribe-v2-realtime-in-elevenlabs-agents)
- Agents offer 5k+ voices across 31 languages per the overview; marketing pages say 72+ languages, so the counts conflict. — [Agents overview](https://elevenlabs.io/docs/eleven-agents/overview.md); [Agents page](https://www.elevenlabs.io/agents)
- Native Twilio outbound call: `POST /v1/convai/twilio/outbound-call` with agent_id, agent_phone_number_id and to_number. — [API ref](https://elevenlabs.io/docs/eleven-agents/api-reference/twilio/outbound-call.md)
- SIP trunking works with Twilio and other providers: inbound origination URI, outbound termination URI and digest auth. Non-Twilio numbers can connect through SIP. — [SIP trunking docs](https://elevenlabs.io/docs/conversational-ai/guides/sip-trunking); [Help center](https://help.elevenlabs.io/hc/en-us/articles/34669255028625-Can-I-connect-a-non-Twilio-phone-to-ElevenLabs-Agents-formerly-Conversational-AI); [SIP upgrades blog](https://elevenlabs.io/fr/blog/sip-upgrades-for-elevenlabs-agents)
- Pricing (aggregators, 2026): the free tier has 10k credits and about 15 agent minutes per month, with no commercial license. Plans: Starter $6, Creator $22, Pro $99, Scale $299, Business $990. Overage is about $0.08 per minute (some sources say $0.10 on Creator and Pro). A price cut was reported on 7 May 2026. — [HappyRobot](https://www.happyrobot.ai/hub/elevenlabs-pricing); [CostBench](https://www.costbench.com/software/voice-ai-agents/elevenlabs-conversational/); [UsagePricing](https://www.usagepricing.com/blueprint/activity/elevenlabs-2026-05-07-conversational-ai-price-cut)
- Practitioner tip: for Spanish, set STT to "es" and pick a native Spanish voice, because an English voice with Spanish transcription causes accent mismatch. Twilio webhooks time out at 15 s. — [DEV post](https://dev.to/callstacktech/integrate-elevenlabs-for-natural-voice-ai-in-your-application-a-developers-journey-2l8d)

### Inferences
- A Creator plan ($22) plus a Twilio number is enough for a weekend demo. Call the phone live on stage so judges hear a real call. Show latency and number of turns on screen.

### Gaps
- I did not confirm official ElevenLabs pricing directly on elevenlabs.io/pricing; the figures come from aggregators.
- I found no quality benchmark for Castilian vs Latin American Spanish voices, and no figure for end-to-end agent latency.
- I did not research voice design (Voice Design v3) in detail.

## (e) What wins fintech and AI hackathons, and what we know about HackFinance / Madrid Engineering Week / BEST UC3M

### Takeaway
I could not find an official HackFinance 2026 page, but a public GitHub repo, "rumbo-hackfinance2026" (a voice tax copilot for digital nomads), confirms the event exists and that **other teams are already building voice finance products for it**. The ElevenLabs hackathon winners show a clear pattern: agents that make real phone calls on someone's behalf (Procuro, Dealwise), compliance in finance (Claimsio, debt collection), and above all a striking live demo (GibberLink).

### Cited Findings
- The GitHub repo "nevambla/rumbo-hackfinance2026" describes Rumbo as a voice tax copilot for digital nomads: it counts days in each country, warns before a tax threshold and sets aside tax per invoice, "Proyecto para HackFinance 2026". The page shows no README content or rubric. — [GitHub](https://github.com/nevambla/rumbo-hackfinance2026)
- BEST UC3M has run hackathons before, e.g. Hackathon IV (2018, big data, with Iberinform and IBM). — [UC3M Business](https://business.uc3m.es/en/news-master/hackathon-iv/)
- Other Madrid events: MADHACK FinTech AI Hackathon (Casa del Lector, year not confirmed); Madrid Tech Week 2026 (late Oct to 5 Nov 2026, start dates conflict). I found no "Madrid Engineering Week". — [MADHACK](https://somo.social/e/madhack-fintech-ai-hackathon-426); [Luma MADHACK](https://luma.com/ex48n6iu); [Ecosistema Startup](https://ecosistemastartup.com/madrid-tech-week-2026-1-200-empresas-y-600-expertos/)
- ElevenLabs Worldwide Hackathon winners. Global: **GibberLink**, two agents that switch to a more efficient audio protocol once they detect each other as AI, picked unanimously for "an intriguing demo". NYC #2: **Procuro**, calls suppliers to find delayed parts ("judges were blown away" by the demo after a late pivot). SF #1: **Dealwise**, calls local businesses for quotes and availability. Warsaw #2: **Claimsio**, automates compliant debt collection. The online track rewarded "feature rich" (Hugo) and social impact (Pep, physiotherapy). Judges included Mati Staniszewski (ElevenLabs), Guillermo Rauch (Vercel), Anton Osika (Lovable) and a16z partners. — [ElevenLabs blog](https://elevenlabs.io/blog/announcing-the-winners-of-the-elevenlabs-worldwide-hackathon)
- A Colombian fintech (Monet, microcredit) built a Spanish-language ElevenLabs voice agent reachable by voice and WhatsApp; no prize confirmed. — [hacks.elevenlabs.io](https://hacks.elevenlabs.io/hackathons/8)
- Typical fintech criteria: innovation, technical implementation, usability and impact. Read the rubric and challenges, and ask the sponsor what they want. — [Open Bank Project](https://www.openbankproject.com/blog/4-ways-to-win-any-fintech-hackathon/); [Koodoo](https://medium.com/koodoo/5-tips-for-winning-a-fintech-hackathon-55f2f8265f59)
- Cover every criterion rather than just one, and plan the demo against the scorecard. — [Microsoft archive](https://learn.microsoft.com/en-us/archive/blogs/matt-harrington/tips-for-winning-hackathons); [The Capital](https://medium.com/thecapital/how-to-win-a-hackathon-from-a-judge-mentor-and-participant-perspective-b7bfe9cd20a1)
- Research the judges and what they care about; start from a real everyday problem (the FinHACK HK lesson). — [The Capital](https://medium.com/thecapital/how-to-win-a-hackathon-from-a-judge-mentor-and-participant-perspective-b7bfe9cd20a1); [WHub](https://medium.com/whub/how-to-win-a-fintech-hackathon-e0da060c601)
- JetBrains published "How to win a hackathon: notes from the judging table" (June 2026), but the fetch returned 403 and I couldn't read it. — [JetBrains blog](https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/)

### Inferences (opinion)
- For a rubric that rewards "frontier AI + language + audio with measurable impact": (1) the audio has to be essential, meaning the job can't be done without a phone call, as with calling an insurer or bank; (2) do a live demo with a real call, ideally agent to institution plus a warm transfer to the user; (3) show numbers on screen, such as minutes of hold time saved, turn latency, success rate over N calls, and STT accuracy on IBANs and amounts; (4) show compliance as a feature: Article 50 disclosure, Ley 10/2025, ZRM and tokenization.
- Common mistakes to avoid: a voice chatbot that reads a balance aloud (gimmicky); an unrehearsed demo with no fallback (bring a recorded backup); no numbers; ignoring privacy in finance.
- How to differentiate from Rumbo (the competitor seen in the repo): Rumbo is an advice copilot (user ↔ agent). A consumer-side "agent calls the institution for you" product works in a different direction, and judges at ElevenLabs hackathons have repeatedly rewarded it (Procuro, Dealwise).

### Gaps
- I found no official HackFinance 2026 page, organizer, dates, rubric, sponsors or judges. BEST UC3M's role and "Madrid Engineering Week" are unconfirmed.
- I found no Devpost galleries of Spanish fintech hackathon winners.
