# Agents that operate financial websites, screens and legacy software, and the infrastructure around them (state as of Nov 2026)

Research done 2026-11-10. About 17 tool calls. YC batch codes: W=Winter, X/P=Spring, S=Summer, F=Fall. Several batch labels come from YC listing pages fetched today; where a label came only from an aggregator, it is marked as such.

## 1. YC (2024–2026) and other companies building computer-use / browser agents for finance tasks

### Takeaway
Finance agents in YC are mostly "AI employee / AI BPO" back-office plays. Most connect over APIs or ERPs, and only a few say outright that they drive screens: Zomma S26, Monumint W24, LedgerUp S24 (customer AP portals), and outside YC, FurtherAI (insurance) and TaxGPT. None of the ones found says how it keeps sensitive values (account numbers, PII, credentials) out of the model, or how it stops injected page text from steering actions. Their trust story is "logged and replayable screenshots" plus human sign-off.

### Cited Findings
**Computer-use / screen-operating finance agents**
- **Zomma (YC S26)**: "The AI BPO for financial services, run by computer-use agents". The agents work on the same screens human analysts use, with no integrations. Tasks: KYC reviews, transaction alerts, disputes. First wedge is cross-border transaction-alert investigation (pull KYC and payment history, verify invoices, research counterparties, write cited assessments, draft RFIs). Planned: compliance queue, payment disputes, client onboarding, trade ops. Live pilots with a US RIA and a $10B AUM wealth-tech. Team of 5; CEO ex-Goldman. Claims 92% on OSWorld. Trust claim: every step "logged and replayable" with timestamped screenshots and citations. Nothing stated on encryption, data residency or PII handling. Pricing and funding not stated. — [YC: Zomma](https://www.ycombinator.com/companies/zomma)
- **Monumint (YC W24)**: conversational AI agents that act inside banks' existing systems, from account opening through collections. — [YC finance list](https://www.ycombinator.com/companies/industry/finance) / [YC: Monumint](https://www.ycombinator.com/companies/monumint)
- **LedgerUp (YC S24)**: submits invoices to customer AP portals such as Coupa and Ariba, and applies payments to open invoices (AR + portal operation + cash application). — [YC: LedgerUp](https://www.ycombinator.com/companies/ledgerup)
- **FurtherAI (YC status not confirmed)**: "Computer Use 2.0". Its agents navigate insurance carrier portals, policy-admin systems and legacy tools by operating the screen. — [FurtherAI blog](https://www.furtherai.com/blog/introducing-computer-use-2-0-on-furtherai)
- **TaxGPT (not YC as far as found)**: the agent opens the accountant's own tax platform in a browser and operates it like a human to complete returns. — [Accounting Today](https://www.accountingtoday.com/news/taxgpt-touts-ai-that-automatically-completes-returns-from-start-to-finish)
- **Sphere (YC status unconfirmed)**: according to its CEO, its AI agents submit filings and registrations in government tax portals. — [The CFO Club](https://thecfoclub.com/operational-finance/nicholas-rudder/)

**Finance back-office agents (mostly API/ERP, not screen-first)**
- **Zalos (YC F25)**: finance-automation workbench with AI workers for accounting, billing, AP and treasury, "zero integrations", on a finance-specific agent harness and skill library, with stress on controls and auditability. — [YC: Zalos](https://www.ycombinator.com/companies/zalos)
- **Clerked (YC F25)**: AI clerks that automate accounts payable and advise on spend and payment timing. — [YC: Clerked](https://www.ycombinator.com/companies/clerked)
- **ProcIndex (YC S25)**: AP, AR, reconciliation and vendor management on top of existing ERPs. — [YC: ProcIndex](https://www.ycombinator.com/companies/procindex)
- **Mesh (YC W25)**: AI agent for bank reconciliation and month-end accruals, built on AP-inbox data and journals; claims ~90% of accruals automated. — [Launch YC: Mesh](https://www.ycombinator.com/launches/Mgh-mesh-ai-agent-for-bank-reconciliation)
- **Definite (YC F26)**: back-office agents on a live model of the books. Reads ERP, ledger, payroll and payments systems read-only; does not write back or move money. — [YC: Definite](https://www.ycombinator.com/companies/definite)
- **Modern (YC P26)**: AI coworker for order-to-cash. — [YC: Modern](https://www.ycombinator.com/companies/modern)
- **Bear (YC S26)**: full-stack AI accounting firm (bookkeeping + tax filings). Agents do the work and a certified accountant signs off. — [YC: Bear](https://www.ycombinator.com/companies/bear-inc)
- **Rational (YC S26)**: "AI employees" running accounting end to end (borderline). **Billow AI Labs (YC S26)**: works inside NetSuite, Coupa and spreadsheets. — [YC finance list](https://www.ycombinator.com/companies/industry/finance)
- **Luca IQ (YC S26)**: tax-calculation API and an IRS-authorized e-filing engine for accounting firms and fintechs. This is the API route rather than portal driving. — [YC API list](https://www.ycombinator.com/companies/industry/api)
- **Levocred AI (YC S26)** and **PathPilot (YC S24)**: AI employees/agents for lenders (servicing, collections, underwriting, onboarding). **Accend (S23)** and **Casca (S23)**: underwriting and SMB loan origination. — [YC finance list](https://www.ycombinator.com/companies/industry/finance)
- **Blaze (YC S24)**: agentic finance platform where agents pay bills, invoice clients and move money **on user approval**. — [YC: Blaze](https://www.ycombinator.com/companies/blaze-2)
- **Parsewise (YC P25)**: multi-document processing plus oversight of AI agent fleets for insurance, KYC and financial risk. — [YC: Parsewise](https://www.ycombinator.com/companies/parsewise)
- **Volaren (YC F26)**: investing app whose agents trade within user limits. — [YC finance list](https://www.ycombinator.com/companies/industry/finance)
- **Govra (non-YC; General Catalyst seed)**: agents for state tax agencies, starting with audits (CA, IN, WI, NH). — [Forbes, 2026-10-08](https://www.forbes.com/sites/annatong/2026/10/08/this-ai-startup-is-selling-tax-agencies-a-new-way-to-find-cheats/)
- **Applied Recon (Applied Systems, incumbent)**: insurance-agency commission reconciliation that uses computer vision on carrier statements. Applied's own research says agencies spend 15+ hours a week on this. — [Applied Systems blog](https://www1.appliedsystems.com/en-us/blog/posts/how-ai-is-transforming-insurance-agency-experience/)

**Horizontal browser/computer-use infrastructure (YC)**
- **Browser Use (YC W25)**: open-source browser-agent framework with 110k+ GitHub stars; $17M seed led by Felicis (Mar 2025). — [YC: Browser Use](https://www.ycombinator.com/companies/browser-use), [Browser Use seed post](https://browser-use.com/posts/seed-round)
- **Notte (YC S25)**: cloud browsers for agents with live view and replays, residential proxies, stealth/CAPTCHA, and authenticated profiles with 2FA. — [YC API list](https://www.ycombinator.com/companies/industry/api)
- **Dari (YC F25, aggregator label)**: platform for production-grade browser-use agents. **Aside (YC F25)**: AI browser across the user's existing sites. **Vesence (YC P25)**: workspace running agents in parallel across inbox, files and browser. — [Extruct F25 list](https://www.extruct.ai/data-room/ycombinator-companies-f25/), [YC automation list](https://www.ycombinator.com/companies/industry/automation)
- A YC startup building AI agents for Windows pivoted away in July 2025, a sign that desktop/legacy computer use is hard to commercialize horizontally. — [TechCrunch 2025-07-18](https://techcrunch.com/2025/07/18/why-a-y-combinator-startup-tackling-ai-agents-for-windows-gave-up-and-pivoted/)

### Inferences
- Buyers of screen-operating finance agents are regulated institutions: banks, RIAs, insurers, lenders, accounting firms. For them, data exposure to a third-party model and an auditable record are the main blockers. Today's vendors answer with "replayable screenshots", and those screenshots themselves hold raw PII.
- Each screen-driving vendor (Zomma, Monumint, LedgerUp, FurtherAI, TaxGPT) is building its own safety layer, or none. That points to a horizontal "trust layer for financial computer-use agents" that these vendors, or the banks evaluating them, could adopt.
- Government and tax portals are thinly covered by YC companies (Sphere unconfirmed; Luca IQ takes the API route). Many portals have no API, which leaves room for screen agents there.

### Gaps
- Funding and pricing for Zomma, Monumint, LedgerUp, Zalos, Clerked and Levocred were not found.
- Only about 50 of the 96 companies on the YC finance list loaded, so other screen-agent finance companies may exist.
- FurtherAI's and Sphere's YC status was not verified.

## 2. Agent payments / agentic commerce, and agent identity (KYA): who does what, and what they leave out

### Takeaway
The stack is split into layers: permission/mandate (AP2, Visa TAP, Mastercard Verifiable Intent), checkout (ACP, UCP), settlement (cards, x402, MPP), and identity (Web Bot Auth, KYA). The known gaps:
- no per-transaction policy decision bound to what the agent actually saw;
- weak dispute and liability handling (x402 is irreversible, and only Amex is reported to cover agent errors);
- KYA is a one-time onboarding check that, by Baselayer's own CEO's admission, does not stop a model from being manipulated.

### Cited Findings
**YC agent-payment startups**
- **Agentcard (YC; batch not shown on its launch page)**: debit cards for AI agents. Fund a wallet, set a budget, issue one-time cards that auto-close after one charge; per-card caps; a "buy" feature launched with DoorDash; works over MCP, CLI or API; a B2B version gives companies' users' agents cards. The page describes **no approval workflows**. CEO Karen Serfaty (ex-CEO of Atlas). Launched about 5 months before this research. — [Launch YC: Agentcard](https://www.ycombinator.com/launches/Qx6-agentcard-debit-cards-for-ai-agents)
- **Sponge (YC W26)**: financial infrastructure for the agent economy. Sponge Wallet lets agents sign up and pay for services without human involvement, over bank accounts, cards and crypto. Sponge Gateway lets businesses sell to agents by uploading an API spec. The page describes no spending limits or approval controls. Team is ex-Stripe stablecoin. — [Launch YC: Sponge](https://www.ycombinator.com/launches/PTD-sponge-financial-infrastructure-for-the-agent-economy), [YC: Sponge](https://www.ycombinator.com/companies/sponge)
- **Locus (YC F25)**: connects agents to funds with spending limits; payments are traceable and reconcilable. — [YC: Locus](https://www.ycombinator.com/companies/locus)
- **Wildcard** and **Sitefire** (YC, batch not stated): visibility and GEO for products in AI shopping. — [Rye landscape, Jun 2026](https://rye.com/blog/agentic-commerce-startups)
- Versine: not found in this research (gap).

**Non-YC agent-payment startups**
- **Skyfire**: verified agent identity via KYAPay (signed JWTs) plus an Agent Checkout product. $9.5M from Neuberger Berman, a16z CSX and Coinbase Ventures (2024). One source reports $8.5M seed instead. — [Rye](https://rye.com/blog/agentic-commerce-startups), [Stellagent](https://stellagent.ai/insights/agentic-commerce-infra-startups)
- **Nekuda**: agentic-payments SDK with a secure agent wallet, credentials and "agentic mandates"; Visa Intelligent Commerce launch partner. $5M seed (May 2025) led by Madrona, with Amex Ventures and Visa Ventures. — [Rye](https://rye.com/blog/agentic-commerce-startups)
- **Payman**: card and wallet rails with payee allowlist and per-transaction limits. No funding data found. — [FintechSpecs](https://fintechspecs.com/blog/best-ai-agent-payment-infrastructure-providers/)
- **Basis Theory**: PCI vault; leads the Agentic Commerce Consortium (20+ members). $33M Series B (Oct 2025). **Prava**: tokenized card payments for agents with passkey approval. **Rye**, **Henry Labs** (on Nekuda), **Zinc**, **Induced AI**: checkout execution. **Forter**, **Signifyd**, **HUMAN + Riskified (AgenticTrust)**, **DataDome**, **Kasada**, **Akamai**: trust and fraud. — [Rye](https://rye.com/blog/agentic-commerce-startups)

**Networks and protocols (status per secondary sources; check against primary specs)**
- Payments split into permission (AP2, Verifiable Intent), checkout (ACP, UCP) and settlement (cards, x402, MPP), and no protocol covers all three. An agent built for Stripe ACP cannot natively transact on Mastercard Agent Pay. — [Reactify](https://www.reactify-solutions.com/articles/agentic-commerce-protocols-2026), [RisingWave](https://risingwave.com/blog/mastercard-agent-pay-vs-visa-vs-stripe-agentic-commerce/)
- **Mastercard Agent Pay**: Agentic Tokens plus Verifiable Intent artifacts. **Visa Trusted Agent Protocol**: built with Cloudflare, Oct 2025. Both use Web Bot Auth as the agent-authentication layer. — [ATXP](https://atxp.ai/blog/mastercard-agent-pay-stripe-acp-visa-x402-comparison-2026/), [Akamai](https://www.akamai.com/blog/security/redefine-trust-web-bot-authentication)
- **AP2** carries signed authorization evidence and is not a rail. AP2 v0.2 reportedly requires a non-agentic "Trusted Surface" for user signatures. — [Applied Technology Index](https://appliedtechnologyindex.com/research/2026-comparative-analysis-agentic-commerce-payment-protocols/)
- **x402**: stablecoin-only, an "exact" payment is irreversible, no built-in disputes, no native fiat off-ramp. Monthly volume reportedly fell to $372,200 in Oct 2026 (single source). — [ATXP](https://atxp.ai/blog/mastercard-agent-pay-stripe-acp-visa-x402-comparison-2026/), [Patech Labs](https://www.patechlabs.com/news/ai-agent-payments-guide-x402-ap2-mpp-visa-mastercard)
- Amex is reportedly the only network offering explicit protection for agent errors, and only for registered agents. — [Applied Technology Index](https://appliedtechnologyindex.com/research/2026-comparative-analysis-agentic-commerce-payment-protocols/)
- "x402, AP2 and UCP are not your spending policy": the protocols carry authorization, but no layer decides whether this particular transaction should go through. — [DEV Community](https://dev.to/suraj_khaitan_f893c243958/your-ai-agent-can-pay-now-x402-ap2-and-ucp-are-not-your-spending-policy-3l25)

**Agent identity / KYA**
- **Web Bot Auth**: IETF WG draft (2026) profiling HTTP Message Signatures (RFC 9421), with a Signature-Agent header and a key directory at a well-known path. It proves where a request came from. KYA is about who is behind the agent and why it is acting. — [Akamai](https://www.akamai.com/blog/security/redefine-trust-web-bot-authentication), [DataDome](https://datadome.co/agent-trust-management/web-bot-auth-and-know-your-agent-why-identity-isnt-enough/)
- **Baselayer**: $35M Series A led by M13 (2026-09-22) and an Agentic Identity Suite. KYA establishes who deployed the agent, who it represents, and whether it may do a given task, building on Baselayer's KYB network of financial institutions. Its CEO concedes it will not stop a model from ignoring instructions or being exploited. — [Crunchbase News](https://news.crunchbase.com/ai/verifying-ai-agents-baselayer-35m-raise/), [Baselayer](https://baselayer.com/agentic-identity/), [TechTimes](https://www.techtimes.com/articles/327943/20260923/baselayer-raises-35m-build-ai-agent-identity-verification-no-law-yet-requires.htm)
- **Shufti KYA** (launched 2026-10-28): verifies agent identity, that a real person authorized the action, and the agent's permissions, in one flow, tied to Shufti KYC/KYB. — [Shufti press release](https://shuftipro.com/press-release/shufti-launches-know-your-agent-to-verify-ai-agents/)
- **Vouched KYA-OS** (open standard donated to DIF), **Akamai KYA**, **Trustfull**, **Persona KYA** (single source). — [Vouched](https://www.vouched.id/know-your-agent), [Eco](https://eco.com/support/en/articles/14846277-know-your-agent-kya-identity-for-agent-payments)
- Critique: KYA is checked once at onboarding and does not cover spending limits or approvals. — [Tacnode](https://tacnode.io/post/know-your-agent), [Abstraxn](https://abstraxn.com/blogs/know-your-agent-kya)
- Alter: not found in this research (gap).

### Inferences
- Gaps nobody covers:
  - binding the payment mandate to the content the agent saw (what text or page influenced this payee or amount?);
  - a signed, merchant-verifiable receipt of the human approval plus the agent's context, usable as chargeback evidence (Open2Agents' angle);
  - payments to legacy or bank portals that have no ACP/AP2 integration (B2B AP via screens).
- Most YC payment startups (Agentcard, Sponge) are rails with budget caps. Their human approval is weak or absent, and none of them inspects what the agent is about to do in a web UI.

### Gaps
- Primary Visa/Mastercard/Stripe/Google specs were not fetched; protocol statements rely on secondary blogs.
- Batches for Agentcard, Payman, Skyfire (likely not YC), Versine and Alter are unverified.

## 3. Data minimization/redaction for agents and prompt-injection defense for browser agents

### Takeaway
Three halves exist, but no product joins them:
- **Text PII tokenization** (Skyflow, Protecto, Presidio, llm-hasher) covers text sent to an LLM.
- **Screenshot redaction** (Screenpipe, Strac) covers images.
- **Injection detection** covers inputs and outcomes: classifiers (Lakera, now Check Point; Prompt Security, now SentinelOne) and outcome judges (Silmaril).

CaMeL-style information-flow control, which stops untrusted text from flowing into sensitive sinks such as payment fields, is still research with no commercial product found. Nothing found combines reversible tokenization of what the screen agent sees with local rehydration at action time.

### Cited Findings
- **Silmaril (YC 2026; labeled Spring/P26)**: "self-healing" prompt-injection defense that judges whether an execution leads to a harmful outcome rather than whether an input looks malicious. Claims: 96% block rate on its own dataset, 2x more attacks caught 10x faster, retraining in under 60 minutes, 5-line LangChain integration, protects agents like Claude Code and OpenClaw. All figures are self-reported. — [Launch YC: Silmaril](https://www.ycombinator.com/launches/Pvl-silmaril-self-healing-prompt-injection-defense), [silmaril.dev](https://www.silmaril.dev/), [Garry Tan on X](https://x.com/garrytan/status/2044182160207425857)
- **ContextFort (YC directory label S25, per search snippet; unverified)**: Chrome extension giving security teams visibility and controls over AI browser agents. It tracks agent sessions end to end (it reverse-engineered Claude in Chrome), blocks specific actions on specific pages, and blocks risky cross-site flows. — [Show HN: ContextFort](https://news.ycombinator.com/item?id=46614015)
- **Lakera**: acquired by Check Point; announced Sep 2025, about $300M reported. — [Check Point blog](https://blog.checkpoint.com/security/check-point-to-acquire-lakera-redefining-security-for-the-ai-era/), [SecurityWeek](https://www.securityweek.com/check-point-to-acquire-ai-security-firm-lakera/)
- **Prompt Security**: acquired by SentinelOne (announced 2025-08-05, closed 2025-09-05; price reported as $180M or $300M). Covers prompt injection, data leakage and shadow AI for employees, apps and agents. — [Wikipedia](https://en.wikipedia.org/wiki/Prompt_Security), [AppSec Santa](https://appsecsanta.com/prompt-security)
- **Screenpipe**: open local PII image redactor (rfdetr, ~109MB, ~120ms per image, offline) and the ScreenLeak benchmark for redaction of screen telemetry and computer-use traces. — [Hugging Face](https://huggingface.co/screenpipe/pii-image-redactor), [ScreenLeak](https://screenpipe.github.io/screenleak/)
- **WebPII benchmark** (arXiv 2603.17357, 2026): says no public benchmark existed for visual PII detection for computer-use agents. — [arXiv](https://arxiv.org/pdf/2603.17357)
- **Strac**: browser DLP that inspects images before they reach ChatGPT/Claude, and notes that text-only filters miss pixels. — [Strac](https://www.strac.io/blog/image-redaction)
- **Text tokenization**: Skyflow (privacy vault spanning LLM and the data stack), Enigma Vault, Protecto, Blindfold, Microsoft Presidio (reversible replacement), open-source llm-hasher (local detection plus an encrypted vault, restores values on the way back). — [Enigma Vault comparison](https://www.enigmavault.io/blog/best-pii-tokenization-software-for-llms/), [llm-hasher](https://github.com/yemrealtanay/llm-hasher)
- **CaMeL** (Google DeepMind/ETH): a privileged planner plus a quarantined LLM, with provenance metadata on values and a custom interpreter. Trail of Bits (Jan 2026) still calls it research, and agentic browsers lack isolation. Follow-up work: "Operationalizing CaMeL" (tiered risk: provenance checks for reads, explicit confirmation for high-risk actions); CaMeLoT (policies only checked at tool-call time, no whole-execution spec); ActPlane (in-loop IFC misses effects via shell-outs); NeuroTaint (offline provenance auditing). No startup productizing CaMeL was found. — [Trail of Bits](https://blog.trailofbits.com/2026/01/13/lack-of-isolation-in-agentic-browsers-resurfaces-old-vulnerabilities/), [CaMeL paper](https://css.csail.mit.edu/6.5660/2026/readings/camel.pdf), [arXiv 2505.22852](https://arxiv.org/pdf/2505.22852), [arXiv 2609.18674](https://arxiv.org/pdf/2609.18674), [arXiv 2606.25189](https://arxiv.org/pdf/2606.25189), [arXiv 2604.23374](https://arxiv.org/pdf/2604.23374)
- "Hidden Dangers of Browsing AI Agents" proposes source/sink blocking for browser agents. — [arXiv 2505.13076](https://arxiv.org/html/2505.13076v1)

### Inferences
- The security incumbents (Check Point/Lakera, SentinelOne/Prompt) sell detection firewalls. Silmaril sells outcome judgment, and ContextFort sells visibility and blocking at the browser layer. None of them does deterministic information-flow guarantees ("this IBAN came from an email body, so it cannot go into the beneficiary field").
- Redaction tools are one-way: they mask, so the agent can no longer finish the task. Reversible tokenization plus local rehydration, so the agent can still act, appears to exist only for text APIs, not for screen agents.

### Gaps
- No Skyflow agent-specific product details were fetched.
- No commercial CaMeL product was found. Absence is not proof; stealth startups may exist.

## 4. Where Priv8's capabilities add something nobody else has: concrete product angles

### Takeaway
Priv8 sits on an uncovered seam between three groups:
- screen-operating finance agents (Zomma, Monumint, LedgerUp, FurtherAI), which need privacy and auditability;
- agent-payment rails (Agentcard, Sponge, AP2/TAP), which carry authorization but no per-action, content-aware policy;
- injection and redaction tools (Silmaril, ContextFort, Screenpipe, Skyflow), which detect or mask but never let the agent act on hidden values with deterministic flow guarantees.

### Cited Findings (evidence supporting each gap)
- Zomma's stated trust model is logged, replayable screenshots, with nothing on data handling. — [YC: Zomma](https://www.ycombinator.com/companies/zomma)
- Baselayer's CEO says KYA does not stop a model from ignoring instructions. — [TechTimes](https://www.techtimes.com/articles/327943/20260923/baselayer-raises-35m-build-ai-agent-identity-verification-no-law-yet-requires.htm)
- x402 payments are irreversible with no dispute process; only Amex covers agent errors. — [ATXP](https://atxp.ai/blog/mastercard-agent-pay-stripe-acp-visa-x402-comparison-2026/), [Applied Technology Index](https://appliedtechnologyindex.com/research/2026-comparative-analysis-agentic-commerce-payment-protocols/)
- Agentcard describes no approval workflow; Sponge describes no limits. — [Agentcard](https://www.ycombinator.com/launches/Qx6-agentcard-debit-cards-for-ai-agents), [Sponge](https://www.ycombinator.com/launches/PTD-sponge-financial-infrastructure-for-the-agent-economy)
- CaMeL-style IFC is not productized. — [Trail of Bits](https://blog.trailofbits.com/2026/01/13/lack-of-isolation-in-agentic-browsers-resurfaces-old-vulnerabilities/)
- There is no joint visual-plus-text reversible tokenization product. — [Strac](https://www.strac.io/blog/image-redaction), [Enigma Vault](https://www.enigmavault.io/blog/best-pii-tokenization-software-for-llms/)

### Inferences (product angles, ranked by how untaken they look)
1. **"Safe pay-a-vendor in the bank portal" (B2B AP via screen agent)**. The agent reads an invoice, logs into the business bank's web portal and schedules the transfer.
   - Priv8 tokenizes the IBAN, amounts and credentials, and the oracle checks "invoice IBAN == vendor master IBAN" without showing either.
   - Provenance policy blocks an IBAN that came from the email body (the classic BEC / vendor-fraud injection).
   - The human hold goes to the phone ("8" reads the summary aloud).
   - A signed receipt goes to the auditor.

   Overlaps Clerked/Zalos/Blaze on AP, but none of them claims screen operation with IFC. This is the best demo: an injected "update bank details" email is visibly blocked.
2. **Trust layer / SDK for financial computer-use vendors** (sold to Zomma-, Monumint-, FurtherAI-type companies, or to the banks that procure them): "your agent never sees raw PII; tokenized, replayable, signed logs instead of raw screenshots". Screenshots logged as tokens solve the "replayable screenshots full of PII" problem. Nobody found sells this horizontally.
3. **Government and tax portal filing agent with zero-knowledge PII**: SSN/NIF, bank account and income go in as tokens, rehydrated locally into portal fields, with the oracle used for checks like "does this match last year's return". Thin coverage (Sphere unconfirmed; Luca IQ is API-only).
4. **Provenance firewall as a ContextFort/Silmaril complement**: deterministic "third-party text cannot reach payment fields" enforcement at the executor. It is a sink-side guarantee rather than a probabilistic detector, and it pitches as "CaMeL for screen agents, shipped".
5. **Open2Agents chargeback-evidence receipts**: signed record = AP2 mandate + agent identity (Web Bot Auth/KYA) + Priv8 provenance trace showing no third-party content influenced payee or amount + mobile approval. This addresses the dispute and liability gap (x402 irreversibility; only Amex covers agent errors) and complements Agentcard/Sponge/Nekuda rails, which lack it.
6. **Insurance or lending back-office "claims/payout hold"**: the agent operates a legacy policy-admin or servicing screen. A payout or bank-detail change triggers a human hold plus an oracle match of the beneficiary against KYC records without exposing them.

- Hackathon framing: angle 1 (with 5 as the merchant-side twin) gives the clearest before/after demo. A plain agent obeys the injected IBAN; the Priv8 agent blocks it, asks "8" for approval and emits a signed receipt. No company found demos exactly this.

### Gaps
- Whether Zomma, Monumint or others already have undisclosed PII and injection controls is unknown. Their pages are silent, and silence does not prove absence.
- No market sizing or willingness-to-pay data was gathered for a "trust layer for computer-use agents".
