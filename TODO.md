# Project TODO (Architecture & Spec Outstanding Items)

This file aggregates incomplete or future work items derived from `architecture.md` (Open items section + architectural gaps) and `spec.md` (features, UI elements, processing flows not yet implemented in the Next.js + FastAPI port).

Status legend: [ ] not started, [~] partial/in progress, [?] needs clarification / decision.

---
## 1. Pain Point Toolkit

### 1.1 Cleanup & Normalisation Tool
- [ ] Implement full Cleanup UI (style rule checkboxes, normalisation options, advanced thresholds sliders).
- [ ] Implement ingestion of raw list (textarea + summary chips: total, exact duplicates, near duplicates, merge candidates).
- [ ] Implement embedding + ANN similarity clustering (FAISS or alternative) service layer.
- [ ] Implement weak / vague / metric-laden / compound sentence heuristics.
- [ ] Implement AI canonicalisation + weak sentence rewrite endpoints (JSON structured responses with repair attempts).
- [ ] Implement proposal table with actions (Keep / Drop / Merge→ID / Rewrite) + rationale.
- [ ] Implement bulk accept / revert actions and state transitions to final canonical list.
- [ ] Persist provenance metadata for merged originals (merged_ids[]) and rationale.
- [ ] Excel export: Proposed sheet & Summary sheet with required columns/metrics.
- [ ] Edge cases: batching logic for >1500 items and variance guard for over-merging.
- [ ] Error handling for invalid / partial model JSON with repair attempts, fallback flags.
- [ ] Server-side unit tests: clustering, heuristic detection, canonicalisation merge logic.

### 1.2 Theme & Perspective Mapping (Enhancements)
(Current base implementation exists.)
- [ ] Display predefined theme & perspective reference lists in UI (currently only placeholder reference text panel).
- [ ] Add distribution charts (counts per theme/perspective) or at least counts table.
- [ ] Validate parsing robustness (graceful handling of malformed lines, duplicates, missing mappings) + tests.
- [ ] Consider server returning parse diagnostics (unmapped IDs) for front-end surfacing.

### 1.3 Impact Estimation (Enhancements)
- [ ] Add impact distribution visual or counts table (High/Medium/Low) if not already present.
- [ ] Add configurable batch size validation (min/max) + UI guidance.
- [ ] Parsing robustness tests (default to Medium if missing; ensure consistent ordering).

### 1.4 Pain Point to Capability Mapping (Enhancements)
- [ ] Provide preview of capability text alongside mapping results (e.g., tooltip or expandable row).
- [ ] Add metrics summary (mapped %, unmapped count if future multi-match allowed).
- [ ] Improve error reporting: show lines that failed to parse from model output.

## 2. Capability Toolkit

### 2.1 Capability Description Generation (Enhancements)
- [ ] Enforce verb usage frequency constraints server-side (track verbs; enforce max 3 each, no repeats).
- [ ] Add length validation (≤30 words) & style guard (Australian English heuristics) with fallback rewrite.
- [ ] Provide progress indicator (if large batches) – currently likely single call.
- [ ] Add unit tests for description parsing & style enforcement.

## 3. Applications Toolkit

### 3.1 Application → Capability Mapping (Enhancements)
- [ ] Add capability descriptions inline or via hover for better mapping review.
- [ ] Add summary metrics: average capabilities per application, % with NONE.
- [ ] Improve NONE handling clarity (explicit badge styling) & export counts.

### 3.2 Logical Application Model Generator
- [ ] Implement company dossier upload & preview section (HTML/JSON parsing) if not present.
- [ ] Add target number of categories slider & include-context checkbox (per spec) if missing.
- [ ] Split generation into steps (determine categories -> full analysis) with progress states.
- [ ] Export: ensure both Excel summary (applications + assigned category) and full analysis .txt.
- [ ] Tests for parsing category structure from model output.

### 3.3 Application Categorisation
- [ ] Build categorisation UI per spec (ID selection, description columns, batch size, results metrics) – check if currently implemented.
- [ ] Implement backend categorisation endpoint with parsing & validation.
- [ ] Add counts per category + Excel export with summary.
- [ ] Parsing tests (ID/category validation, fallback strategy).

### 3.4 Individual Application Mapping (Enhancements)
- [ ] Implement confidence tier parsing (Primary/Secondary/Potential) highlighting.
- [ ] Provide quick export (Excel/Markdown) of analysis.
- [ ] Expose warning for missing or ambiguous mappings.

## 4. Engagement Planning Toolkit

### 4.1 Engagement Touchpoint Planning
- [ ] Implement full UI per spec (dropdowns: type, duration, client size, phase; stakeholder roles textarea, objectives textarea, additional context, frequency & communication style).
- [ ] Backend prompt assembly aligning with spec sections.
- [ ] Export: text file + Excel (schedule + engagement details sheets).
- [ ] Tests for schedule generation structure.

## 5. Strategy & Motivations Toolkit

### 5.1 Strategy → Capability Mapping (Enhancements)
- [ ] Implement multi-capability mapping logic (allow 0..many) and parse comma-separated IDs.
- [ ] Add summary metrics (strategies mapped %, avg capabilities per strategy).
- [ ] Excel export validation (correct sheets/columns) + tests.

### 5.2 Tactics to Strategies Generator
- [ ] Implement 3-step AI interaction (optimal number -> detailed activities -> SWOT per activity).
- [ ] Parse mapping table, activities table, SWOT sections into structured data.
- [ ] Excel export with three sheets (Tactics to Strategies, Strategic Activities, SWOT Analyses).
- [ ] Edge handling for unmapped tactics (warn list).
- [ ] Unit tests for parsing multi-section responses.

## 6. Data, Information & AI Toolkit

### 6.1 Conceptual Data Model Generator (Enhancements)
- [ ] Two-phase generation (subject areas then entities) with progress states and caching.
- [ ] Parallel entity generation for subject areas; error isolation per area.
- [ ] Excel export verification: subject areas + entities mapping sheet.
- [ ] Parsing tests (entity line format, duplicate entity detection).

### 6.2 Data-Application Mapping
- [ ] Implement relationship type classification (system of entry vs system of record) + rationale column.
- [ ] Add optional application filtering UI.
- [ ] Batch concurrency with futures + progress reporting.
- [ ] Parsing robustness tests for relationship extraction.

### 6.3 AI Use Case Customiser
- [ ] Implement context summarisation (if length > threshold) caching mechanism.
- [ ] Parallel scoring with concurrency control & ordering guarantee.
- [ ] Excel export: ensure columns (ID, Original Text, Score, Rationale, Rank).
- [ ] Tests for numeric score extraction & sorting.

### 6.4 Use Case Ethics Review
- [ ] Implement four-perspective analysis prompts returning structured markdown sections.
- [ ] UI to display each section + optional combined export.
- [ ] Consider collapsible panels for each perspective.
- [ ] No-op heuristics fallback messaging when LLM disabled.

## 7. Admin & Testing Tool
- [ ] Model list retrieval & caching UI.
- [ ] Temperature slider and model selection persistence to model_config.json.
- [ ] Pricing table using cost estimates.
- [ ] Test prompt send & cost estimate calculation.
- [ ] Validation when LLM disabled (show heuristic mode banner).

## 8. Cross-cutting / Architectural
- [ ] Add server-side validation & rate limiting (e.g., FastAPI dependencies for API key / simple token bucket).
- [ ] Introduce unit tests for parsing and Excel generation across all services.
- [ ] Background job architecture (RQ or Celery) design doc + placeholder implementation for large batch operations.
- [ ] Authentication & multi-tenant separation (JWT/session + org scoping) – optional future.
- [ ] Observability: structured logging and basic request metrics (Prometheus or OpenTelemetry exporter).
- [ ] Error handling middleware returning consistent JSON error envelope.
- [ ] Frontend: central toast/alert system for errors & successes.
- [ ] Frontend: reusable progress bar / stepper component.
- [ ] Frontend: diagram or visual cues for each toolkit landing page (optional enhancement).
- [ ] Add README section summarising toolkits (replace create-next-app default).
- [ ] Add CI workflow (lint + backend tests) GitHub Actions.
- [ ] Security review: file upload size/type limits, input sanitisation.
- [ ] Configurable batch size caps (server-enforced) to protect model usage.
- [ ] Refine prompts for clarity & token efficiency (prompt library centralisation).

## 9. Documentation
- [ ] Extend `architecture.md` with sequence diagram(s) for a representative flow (e.g., Theme Mapping with streaming XLSX download).
- [ ] Provide API endpoint table (method, path, body schema summary) in architecture or separate API.md.
- [ ] Document environment variable matrix (required/optional, defaults) and deployment overrides.
- [ ] Add CONTRIBUTING.md with local dev scripts & coding standards.

## 10. Nice-to-haves / Future
- [ ] Dark/light theme toggle (currently dark-only) & accessible contrast audit.
- [ ] i18n framework integration (English default; easy locale extension).
- [ ] Offline / cached mode for small heuristic-only operations.
- [ ] Prompt versioning & experiment tracking.
- [ ] Export formats: CSV/JSON alongside XLSX.
- [ ] In-app diff viewer for Cleanup proposal vs final list.
- [ ] Audit trail export (e.g., JSON with provenance for canonical pain points).

## 11. Testing Deep Dive (Expanded Plan)

### 11.1 Backend Unit Tests
- [ ] pain_points: whitespace + dedupe normalisation (exact + near duplicates) logic.
- [ ] pain_points: clustering function (similarity threshold edge cases: below, at, above 0.80) incl. small + large input sets.
- [ ] pain_points: weak/vague/metric heuristic detectors (positive/negative examples table-driven tests).
- [ ] pain_points: canonical merge logic merging clusters (ensure provenance + rationale preserved).
- [ ] capability description parser (line format variations, trimming, duplicate capability names).
- [ ] mapping output parsers (theme/perspective, capability, strategy) for malformed lines, missing IDs, extra whitespace.
- [ ] impact estimation parser defaulting to Medium on invalid token.
- [ ] data-application relationship parser (system of entry vs record) with ambiguity fallback.
- [ ] Excel writer functions (sheets exist, column headers exact, row counts match input) using in-memory bytes.

### 11.2 Backend Integration / Contract Tests
- [ ] FastAPI TestClient happy-path for each endpoint (sample fixtures in `tests/fixtures/`).
- [ ] Negative cases: missing required form fields, invalid file type, oversized batch request.
- [ ] Response schema validation: ensure JSON keys subset of documented contract (Pydantic model tests).
- [ ] Heuristic (LLM disabled) mode responses deterministic snapshot.
- [ ] Multi-batch flow (e.g., theme mapping) accumulates results across batches.

### 11.3 Prompt Snapshot & Regression
- [ ] Snapshot current prompts (store canonical prompt strings under `tests/snapshots/prompts/`).
- [ ] Test to diff runtime prompt assembly vs snapshot (fail on accidental drift; allow version bump via env var / update script).
- [ ] Redact secrets/keys before snapshot.

### 11.4 Parsing Robustness / Property-Based
- [ ] Hypothesis-based tests for line parsers (random whitespace insertion, case variations, injected noise tokens) ensuring graceful skip not crash.
- [ ] Fuzz test for capability mapping output enforcing stable parse or flagged error list length <= input.

### 11.5 Performance & Scalability
- [ ] Micro-benchmark clustering (N=100, 500, 1000) record ms & assert within budget threshold (configurable) – mark as non-blocking / perf profile.
- [ ] Excel generation benchmark (capability mapping 2k rows) below time + memory envelope.
- [ ] Concurrency test: simulate parallel requests (5–10) to batch endpoint; assert isolation (no cross-mixing state) & latency distribution.

### 11.6 Security / Hardening Tests
- [ ] File upload: reject > configured size (add size limit & test). 
- [ ] File upload: reject disallowed MIME (e.g., .exe) with 415.
- [ ] Prompt injection attempt strings ensure sanitisation / neutral handling.
- [ ] Rate limit simulation (if implemented) returns 429 + retry-after.

### 11.7 Reliability / Error Handling
- [ ] Force model timeout -> heuristic fallback path returns structured error JSON (and still 200/appropriate code?).
- [ ] Corrupted XLSX input triggers clean 400 error message.
- [ ] Invalid JSON from model (simulate) triggers repair attempt & logs structured warning.

### 11.8 Frontend Component Tests (React Testing Library)
- [ ] ExcelPicker: header row change does NOT reopen file dialog (regression test for fixed bug).
- [ ] ExcelDataInput modes (id-text / single-text / multi-text) produce expected `StructuredExcelSelection` shape.
- [ ] Column persistence: re-selecting same filename hydrates prior selection.
- [ ] Download progress indicator updates with streamed chunks (mock fetch with ReadableStream polyfill).
- [ ] Error boundary / toast rendering (after implementing toast system).

### 11.9 Frontend Integration / E2E (Playwright or Cypress)
- [ ] Pain points theme mapping end-to-end: upload sample sheet -> select columns -> generate -> verify table rows.
- [ ] Capability description generation: upload -> generate -> export file presence.
- [ ] Route navigation via NavBar active state.
- [ ] Accessibility: run axe-core on key pages (no violations above minor severity).
- [ ] Mobile viewport snapshot for hero + getting started page (visual regression baseline).

### 11.10 Coverage & Quality Gates
- [ ] Configure pytest coverage (fail <80% backend lines; exclude migrations, __init__).
- [ ] Configure frontend coverage via vitest / jest (target 70% lines; exclude Next.js generated files).
- [ ] Add mutation testing (optional) with `mutmut` or `cosmic-ray` baseline (document thresholds only; not gating initially).
- [ ] CI workflow: run backend unit + integration, frontend lint + unit, e2e (smoke subset) on PR.
- [ ] Badge generation (coverage) in README after CI success.

### 11.11 Test Data & Fixtures
- [ ] Create `tests/fixtures/` with: small_pain_points.csv, large_pain_points.csv, capabilities.xlsx, applications.xlsx, strategies.xlsx, data_entities.xlsx, use_cases.xlsx.
- [ ] Provide factory helpers for generating synthetic pain points with controlled duplication & length variance.
- [ ] Provide JSON fixture for dossier / company context long text (used in summarisation tests).

### 11.12 Tooling & DX
- [ ] Add `make test` / `scripts/test-all.sh` update to include coverage flags & snapshot update command.
- [ ] Pre-commit hook (ruff/black or eslint/prettier) plus basic type check (`tsc --noEmit`).
- [ ] Watch mode for frontend tests (optional developer convenience).

### 11.13 Documentation
- [ ] TESTING.md: architecture (layers), how to run each test category, snapshot update workflow, performance test opt-in.
- [ ] Update CONTRIBUTING.md referencing testing strategy & minimum expectations for new endpoints/components.

### 11.14 Future / Stretch
- [ ] Load test scenario (k6 or Locust) simulating concurrent batch mapping requests.
- [ ] Chaos testing: inject random model failures / latency to assert graceful degradation.
- [ ] Synthetic monitoring script (scheduled) hitting health + one mapping endpoint with heuristics mode.
- [ ] Visual regression automation (Chromatic or Playwright trace compare).


---
Generated: 2025-08-10
