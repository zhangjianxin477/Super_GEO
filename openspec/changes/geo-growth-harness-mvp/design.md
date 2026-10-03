# Design

## Context

See `proposal.md` for the product motivation and the capability specs for behavior. The repository is currently planning-only and has no pre-existing application code. The MVP must validate a real GEO delivery loop for CoreNote while also forming a reusable Harness for other B2B SaaS customers.

The system has two distinct information domains:

1. **Private, verified client knowledge**: CoreNote items, approved website material, and manually reviewed evidence used to validate product claims and ground content.
2. **Public AI-answer observations**: model responses, citations, and competitor references collected for a defined query, market, locale, and time.

The design must keep those domains traceable but separate. It must support China and international markets without treating them as translation-only variants. It must also remain useful when model providers, CoreNote connectivity, or direct answer execution are unavailable.

## Goals / Non-Goals

**Goals:**

- Provide one durable, auditable workflow from client intake through query design, answer observation, diagnosis, content work, follow-up testing, and report delivery.
- Reuse commodity components where they pass a documented adoption review; reserve custom implementation for GEO business rules, evidence policy, scoring, and workflows.
- Preserve raw observations and versioned evidence so GEO results can be inspected and reproduced within their stated scope.
- Make domestic and overseas market packs independently configurable across queries, models, content formats, channels, and competitors.
- Support CoreNote as the preferred first evidence integration without coupling the core workflow to CoreNote internals.
- Keep a human approval gate for public-facing claims and distribution tasks.

**Non-Goals:**

- Build a generalized agent marketplace, autonomous publishing engine, SEO crawler at internet scale, or a replacement for CoreNote.
- Guarantee inclusion, citations, ranking, leads, or revenue from any model or content action.
- Treat imported screenshots or manually captured answers as identical in reliability to directly executed provider runs.
- Implement every domestic and overseas model or channel in the first release.

## Decisions

### 1. Use a modular monolith with explicit Harness ports

The MVP will be a modular monolith, not independently deployed microservices. It will organize the application around stable ports and domain modules:

```text
Experience layer
  Workspace | Query Lab | Observatory | Intelligence | Content Studio | Reporting

Harness ports
  EvidenceSource | ModelProvider | AnswerImporter | ResearchSource
  AnalysisSkill | ContentSkill | WorkflowAction | ReportRenderer

Domain services
  Evidence policy | Query versioning | Run orchestration | GEO scoring
  Diagnosis | Review approval | Action traceability | Audit

Persistence
  Relational records | Object storage for raw artifacts | Search/index layer as required
```

**Rationale:** The first product needs end-to-end speed, consistent audit data, and low operational overhead. Explicit ports preserve extension boundaries without paying distributed-system costs before product fit is proven.

**Alternatives considered:**
- Microservices: rejected for MVP due to premature deployment, tracing, and data-consistency complexity.
- A fully generic no-code agent platform: rejected because it obscures the GEO business workflow and weakens the interview-quality product narrative.

### 2. Model the product around immutable versions and evidence lineage

All query datasets, approved evidence packs, assessment configurations, content briefs, drafts, and report scopes will be versioned. A measurement comparison references immutable baseline and follow-up versions rather than mutable current state.

```text
EvidencePack vN ─┐
QueryDataset vN ─┼─ AssessmentRun ─ AnswerObservation ─ AnalysisResult
ProviderConfig ─┘                                  └─ Diagnosis ─ Brief ─ Action
```

**Rationale:** AI outputs vary over time. A defensible client report requires the ability to identify what was asked, where, when, with what model/provider configuration, and against which evidence policy.

**Alternatives considered:**
- Store only aggregate metrics: rejected because metrics cannot be audited or diagnosed.
- Update records in place: rejected because it destroys baseline reproducibility.

### 3. Separate market packs from shared brand evidence

A workspace maintains one shared approved brand-evidence base plus independent market packs. Each market pack defines locale, target country or region, audience, query dataset, model-provider set, competitors, target channels, and metric cohort.

```text
Workspace
├── Brand Evidence Pack (shared, versioned)
├── China Market Pack
│   ├── Chinese query datasets
│   ├── domestic providers and channels
│   └── domestic competitors
└── Global Market Pack
    ├── English / localized query datasets
    ├── international providers and channels
    └── international competitors
```

**Rationale:** Product facts should remain consistent, but discovery language, buyer intent, third-party sources, and distribution channels vary by market.

**Alternatives considered:**
- One global dataset with translated queries: rejected because translated wording does not reliably represent local user intent.
- Fully duplicated workspaces per country: rejected because it creates brand-fact drift and duplicated governance.

### 4. Normalize observations before applying GEO scoring

The observatory will retain raw model output and construct normalized answer observations. Analysis skills operate on the normalized record, while each finding links back to raw evidence. A baseline rule set covers: brand mention, recommendation context, relative list position when present, owned/third-party citations, supported/unsupported/conflicting claim status, and competitor mention.

**Rationale:** It permits providers and manual imports to differ in shape while making metrics transparent and comparable within a declared cohort.

**Alternatives considered:**
- Analyze free-form raw text independently for every report: rejected because it produces inconsistent measurement.
- Treat list position as universal ranking: rejected because many answer formats do not provide a meaningful rank.

### 5. Treat content as an evidence-grounded, reviewed workflow

A content brief is the bridge between diagnosis and production. It contains the target market, query cohort, intended channel, mandatory facts, evidence links, prohibited claims, competitor context, planned structure, and success measures. Drafts are artifacts of a brief; public-release status requires review.

**Rationale:** Direct “write an article” actions do not create a reliable GEO strategy and can introduce inaccurate public claims.

**Alternatives considered:**
- Fully autonomous content and publication agents: rejected for client-risk, governance, and evidence-quality reasons.
- Manual document process outside the application: rejected because it breaks diagnosis-to-outcome traceability.

### 6. Distinguish managed distribution tasks from AI-platform placement

The system will manage content publication and distribution as human-reviewed actions to owned sites and eligible third-party channels. It will never model an AI answer platform as a controlled publishing destination. Results are measured as observations in later assessment runs.

**Rationale:** The product must avoid deceptive promises and cannot control external model selection or citation behavior.

### 7. Adopt-first technology selection with a documented acceptance gate

Before building non-domain infrastructure, the implementation will evaluate existing GitHub/open-source components using a decision record. Candidates will be judged on license compatibility, maintenance cadence, security posture, provider/channel support, deployment model, observability, extensibility, operational cost, and exit path.

The initial evaluation categories are:

| Category | Preferred approach | Custom boundary |
|---|---|---|
| Workflow execution | Evaluate established durable workflow or job orchestration components | GEO state transitions, approvals, and rules |
| Model tracing/evaluation | Evaluate established LLM observability and evaluation components | GEO metric definitions and answer-evidence linkage |
| Web extraction/research | Evaluate maintained extraction/crawling components | Source qualification and competitor-analysis rules |
| Queues/scheduling | Evaluate managed or open-source job tooling | Run planning and retry policy semantics |
| Rich text/content editing | Evaluate mature editor components | Brief constraints and evidence annotations |
| Charts/report rendering | Evaluate maintained chart/PDF/report components | GEO metric presentation and report narrative |
| Authentication/authorization | Evaluate compatible identity and role components | Workspace permissions and audit policy |

A component will be adopted only after the evaluation record documents the decision. If none meets the product’s requirements, the team will build the smallest replaceable custom adapter.

**Rationale:** This complies with the adopt-first instruction while preventing dependency choices based only on popularity.

### 8. CoreNote is an adapter, not a hard dependency

The CoreNote connector will import source-linked knowledge into a versioned evidence pack through an adapter boundary. Website and manual evidence adapters will use the same canonical evidence model. The workflow remains usable without a live CoreNote API.

**Rationale:** CoreNote is the first showcase client and preferred evidence source, but the Harness must be sellable to customers who use different knowledge systems.

**Alternatives considered:**
- Embed or reproduce CoreNote functions: rejected because it duplicates a separate product and expands MVP scope.
- Require CoreNote for every workspace: rejected because it limits market applicability.

### 9. Store audit events and artifacts separately from business records

Business records live in relational entities; large raw answers, screenshots, imported documents, and report artifacts live in object storage with immutable references. Audit events record actor, action, affected record, input/output references, and outcome.

**Rationale:** Retaining raw evidence is required for report defensibility while keeping operational records queryable.

## Risks / Trade-offs

- [Model providers change output behavior, access methods, or policies] → Design provider adapters and manual-import fallback; record provider and collection context for every observation.
- [GEO metric movements are noisy and not causal] → Use cohort compatibility checks, report confidence and completeness, link actions as observational, and prohibit guarantee language.
- [CoreNote integration API or authorization details are unavailable] → Begin with a documented adapter contract and manual/website evidence sources; implement a live connector only after interface discovery.
- [Automated claim extraction misclassifies brand facts] → Keep raw source links, confidence flags, reviewer overrides, and approval gates.
- [Competitor research causes legal, quality, or rate-limit issues] → Restrict research to permitted, attributable sources; capture provenance; use throttled adapters; do not bypass access controls.
- [Third-party dependencies become unmaintained or incompatible] → Require adoption records, isolate dependencies behind ports, and maintain exit criteria.
- [Multi-market expansion overwhelms the MVP] → Start with one China and one global market pack, a limited provider set, and high-priority query cohorts.

## Migration Plan

1. Create the application skeleton, versioned domain model, and Harness port contracts without importing legacy data.
2. Seed a CoreNote workspace through manual/website evidence import so the product loop can be tested before a live connector exists.
3. Configure one China and one global market pack with approved CoreNote query cohorts.
4. Run baseline assessments, validate normalized observation and scoring quality with human review, and refine metric rules before customer reporting.
5. Enable content briefs and reviewed draft workflows; record publication/distribution actions rather than automate broad release.
6. Run a compatible follow-up cohort and generate a pilot report.
7. Roll back unsafe integrations by disabling their adapters; preserve previously approved evidence, raw observations, and reports because all artifacts are append-only/versioned.

## Open Questions

- Which authenticated CoreNote integration surface is available for the first live connector (API, export, webhook, or other controlled access)?
- Which domestic and international model providers can be called through authorized APIs in the initial environment, and which require manual observation import?
- Which approved China and overseas content channels will be used for the CoreNote pilot, and what editorial or account permissions are available?
- What deployment, identity, and data-residency constraints apply to the first enterprise pilot?
