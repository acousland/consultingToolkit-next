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

---
Generated: 2025-08-10
