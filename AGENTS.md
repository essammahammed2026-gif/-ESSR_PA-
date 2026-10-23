# AGENTS.md — AI Coding Assistant & Pair Programming Guide

> **Authority:** This document defines the strict operational rules and architectural guardrails for AI coding assistants working in this repository. Follow these constraints without exception.

---

## 1. Golden Rules (Non-Negotiable System Integrity)

1. **Centralized API Client:**
   - NEVER hardcode `localhost:8000` or raw API URLs inside frontend components or hooks.
   - ALWAYS route backend traffic through `src/lib/api.ts` using `API_BASE_URL` or `getApiUrl()`.
2. **Debounce Reactive Sliders & Inputs:**
   - Sliders or continuous text inputs triggering real-time calculations (e.g., margins, thresholds, offsets) MUST use `src/lib/useDebounce.ts` (~350ms delay) to prevent UI freezing and server flooding.
3. **Strict TypeScript & Zero `any` Creep:**
   - Keep TypeScript strict mode enabled. Do NOT introduce loose `any` types. Provide explicit typed interfaces for API models and component states.
4. **Backend Architecture (Routers Thin, Engines Pure):**
   - Keep FastAPI routers in `main.py`, `imposing_api.py`, `book_scan_api.py`, etc., thin. They must only handle HTTP validation, response formatting, and background task dispatching.
   - All computer vision (OpenCV), PDF modification (PyMuPDF/fitz), and mathematical logic MUST live in pure, testable functions inside `backend/engines/`.
5. **Zero-Retention File Policy:**
   - Do not commit test images, sample PDFs, uploaded files, or generated assets. 
   - Clean up temporary working files inside `backend/temp_uploads/` immediately after processing.

---

## 2. Dynamic Architecture & File Health (No Arbitrary Caps)

1. **Single Responsibility Over Line Counts:**
   - Abandon strict, blind line-count ceilings (like the legacy 300-line rule). Instead, enforce logical segregation of code based on what it does.
   - A file should execute *one* cohesive responsibility. For example, rendering interactive UI elements on a canvas must be decoupled from heavy mathematical coordinate math.
2. **Consolidation Over Fragmentation:**
   - Never create new, fragmented side-files (e.g., `CanvasHelpers2.tsx`, `useBookExport.ts`, `controls.tsx`) to bypass growth.
   - If a file expands, first analyze it for duplicate logic. Extract repeating routines into existing, centralized utilities in `src/lib/` (frontend) or `backend/engines/` (backend). This shrinks the codebase by making code reusable.
3. **Canonical Single-Source-of-Truth Registry (Zero Duplication):**
   - Before writing any helper, math calculation, or state hook, check and reuse these canonical modules:
     - **Frontend (`frontend/src/`)**:
       - `src/lib/api.ts`: All backend URLs (`API_BASE_URL`, `getApiUrl`) and file downloads (`downloadBlob`). Never write manual `fetch` + `URL.createObjectURL` anchor-click boilerplate.
       - `src/lib/units.ts`: All length unit conversions (`mmToUnit`, `unitToMm`, `formatMmInUnit`, `getStepForUnit`, `pxToMmAtDpi`, `mmToPxAtDpi`). Never write inline `25.4` or `96 / 25.4` unit math in components.
       - `src/lib/pageScope.ts`: All page range parsing (`parsePageRange`), scope filtering (`isPageInScope`), crop target resolution (`resolveCropTarget`), and concrete page number calculation (`resolveConcretePageNumbers`).
       - `src/lib/splitLines.ts`: All cut-line sorting, non-overlapping placement (`getNextCutLine`), and millimeter/percentage segment sizing (`segmentSizes`).
       - `src/hooks/useBookModules.ts`: Unified Book Studio module state, split/crop operations, per-page layer unlinking, and PDF/imposing export handoff. Never split back into separate sub-hooks.
       - `src/hooks/useImpositionStudio.ts`: Unified Imposing Studio page deck, layout state, debounced preview, and export actions (`buildImposingPagesFromMeta`, `buildImposingPayload`). Never split back into separate sub-hooks.
     - **Backend (`backend/`)**:
       - `engines/units.py`: `MM_TO_PTS`, `PTS_TO_MM`, `mm_to_px`, `px_to_mm`, `is_page_in_scope`, `resolve_scope_pages`, `hex_to_rgb`, `format_page_ranges`, `parse_page_range`, `parse_page_selection`. Never hardcode `(pt / 72.0) * 25.4`.
       - `engines/thumbnails.py`: `resolve_temp_file`, `get_dimensions_mm`, `list_pdf_pages_mm`, `render_pdf_thumb`, `render_image_thumb`, `probe_source_dims`. Never write manual `.pdf/.png/.jpg` extension-fallback loops in routers.
       - `engines/imposing_prep.py`: `compute_opposing_rotation_deg`, `effective_page_rotation`, `build_imposing_pages_meta`, `build_sheet_specs`, `build_roll_specs`, `apply_alignment`.
       - `db/`: SQLite WAL ACID Persistence (`session.py`, `models.py`, `repository.py`) - handles concurrent session state, page ordering, applied edit layers, distributed locks, and export task tracking.
       - `storage/`: Structured Session Asset Store (`asset_store.py`) - isolates raw scans, rendered thumbnails, and compiled PDF exports under deterministic `data/storage/{session_id}/` directories.

---

## 3. Intermittent Session Recovery & Navigation Guardrails

1. **Session Context Recovery:**
   - At the beginning of a new workspace interaction, the agent MUST read the `[Unreleased]` section of `CHANGELOG.md` and the most recent `SESSION_LOG.md` to establish instant context. 
   - Do not execute broad, global project searches or read whole directories unless explicitly asked.
   
2. **Search and Scope Hygiene:**
   - Restrict file exploration exclusively to relevant code directories. 
   - Completely ignore build outputs, dependencies, and environment files (`node_modules/`, `.next/`, `.venv/`).
   - ABSOLUTELY ignore the contents of `backend/temp_uploads/` and `backend/public_flipbooks/` during text and code searches so the agent doesn't waste tokens reading old, cached images or heavy PDFs.

3. **Automated Session Hand-Off & Crash Recovery:**
   - At the beginning of a session, check if `backend/temp_uploads/` contains leftover scratch files from a previous crash. If it does, run the `backend/engines/storage_cleaner.py` routine to safely purge them before writing code. (Note: Persistent session assets live securely in `backend/data/storage/` tracked by SQLite WAL).
   - Before ending a coding session, the agent MUST summarize workspace changes into `SESSION_LOG.md` and ensure `temp_uploads/` is cleanly maintained.

4. **Strict Version Control Restrictions (User-Only Permissions):**
   - The AI agent is ABSOLUTELY FORBIDDEN from running `git commit`, `git push`, or `git pull` commands autonomously.
   - All code version check-ins, remote synchronization, and branch merges are the exclusive responsibility of the human user.
   - The agent may use presentational commands like `git status` or `git diff` for workspace diagnostics during crash recoveries or logs, but it must never modify the Git ledger history independently.

5. **Zero-Lag Navigation Mapping Protocol:**
   - The agent is strictly forbidden from running slow, global repository text searches to locate core features or routing code.
   - Before attempting to find or open a file, the agent MUST immediately read the "Repository Navigation Map" at the top of `docs/architecture.md` to instantly locate the target file's path.
   - If editing a route endpoint in `backend/*_api.py`, the agent must immediately open its verified twin engine in `backend/engines/*_engine.py` without searching.
   - **Keep the Map Synchronized:** Whenever a file is added, renamed, or consolidated, the agent MUST update the "Repository Navigation Map" in `docs/architecture.md` in the same turn so future sessions never encounter stale paths.


---

## 4. Live Iteration & Pay-As-You-Go Refactoring

1. **Active Context Cleanups:**
   - When instructed to fix a bug or add a feature within a specific file, the agent must spend 30 seconds assessing that local code block for structural debt before writing new lines.
   - If localized duplicate blocks or disorganized state code are found in the immediate area of modification, refactor and clean them up *in-stride* as part of fixing the issue.
2. **Verification Protocol (Fast Inner Loop vs. Final Gate):**
   - **During active editing:** Do NOT run full Next.js production builds (`npm run build`). Use targeted, low-overhead checking commands:
     - Frontend: `cd frontend && npx tsc --noEmit` (Checks typescript health)
     - Backend: `cd backend && python -m py_compile main.py engines/*.py` (Checks for syntax/import errors)
   - **Final Session Gate:** Only run comprehensive linting and production build verification checks (`npm run build`) once, immediately before checking in code or completing a major feature.
