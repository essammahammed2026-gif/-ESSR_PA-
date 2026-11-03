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
5. **Absolute Data Preservation & Non-Destructive Storage Policy:**
   - **User Data is Inviolable:** `backend/data/flint.db` and everything inside `backend/data/storage/` (`originals/`, `sessions/`, `exports/`) are **strictly permanent user assets**.
   - **Zero-Tolerance Assistant Deletion Ban:** The AI assistant is ABSOLUTELY AND UNCONDITIONALLY FORBIDDEN from executing any command, script, or SQL statement that deletes records from SQLite (`sessions`, `pages`, `export_jobs`), drops tables, or deletes folders/files within `backend/data/storage/`. Test resets or database wipes are strictly forbidden unless the human user explicitly orders a full data wipe and provides direct confirmation in that prompt.
   - **Non-Destructive Schema Migrations:** All database schema changes in `backend/db/` MUST be purely additive (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN`). Never drop, recreate, or truncate tables.
   - **Automated Hot Snapshots:** The backend creates an automated, rolling SQLite hot snapshot (`flint_backup_*.db`) via SQLite online backup API before running migrations or database initialization.
   - **Git & Scratch Hygiene:** Do not commit test images, sample PDFs, uploaded files, or generated assets to git. Clean up only transient scratch files inside `backend/temp_uploads/`. Never run cleanup commands against `data/storage/`.

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
       - `engines/units.py`: `MM_TO_PTS`, `PTS_TO_MM`, `mm_to_px`, `px_to_mm`, `is_page_in_scope`, `hex_to_rgb`, `format_page_ranges`, `parse_page_range`, `parse_page_selection`. Never hardcode `(pt / 72.0) * 25.4`.
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
   - ABSOLUTELY ignore the contents of `backend/temp_uploads/`, `backend/public_flipbooks/`, and `backend/data/` (`flint.db`, snapshots, and `storage/`) during text and code searches so the agent doesn't waste tokens reading old, cached images or hang on binary database files.

3. **Automated Session Hand-Off & Safe Scratch Maintenance:**
   - Scratch Cleanup Only: At the beginning of a session, check if `backend/temp_uploads/` contains leftover scratch files from a previous crash. If it does, safely purge only loose files inside `backend/temp_uploads/` (preserving `.gitkeep` and active subdirectories).
   - Never run bulk cleanup scripts or touch `backend/data/storage/` (sessions, originals, exports). Persistent user assets and cards live safely in `backend/data/storage/` and are tracked by SQLite WAL in `backend/data/flint.db`.
   - Before ending a coding session, the agent MUST summarize workspace changes into both `CHANGELOG.md` (under `[Unreleased]`) and `SESSION_LOG.md`.

4. **Strict Version Control Restrictions (User-Only Permissions):**
   - The AI agent is ABSOLUTELY AND UNCONDITIONALLY FORBIDDEN from running any modifying Git command (`git commit`, `git push`, `git pull`, `git reset`, `git clean`, `git checkout`, `git rebase`, `git merge`).
   - All code version check-ins, remote synchronization, and branch merges are the exclusive responsibility of the human user.
   - The agent may use non-destructive presentational commands like `git status` or `git diff` for workspace diagnostics during crash recoveries or logs, but it must never modify the Git ledger history or working tree state independently.
   - **Repository Synchronization & Backups:** Scheduled or daily syncs must always use the dedicated pre-flight script [`scripts/daily_sync.sh`](file:///home/essam/Projects/ESSR_PA/scripts/daily_sync.sh), which enforces automated fail-safes (secret scans, file size limits < 25MB, upstream divergence checks, and code verification).

5. **Zero-Lag Navigation Mapping Protocol:**
   - The agent is strictly forbidden from running slow, global repository text searches to locate core features or routing code.
   - Before attempting to find or open a file, the agent MUST immediately read the "Repository Navigation Map" at the top of `docs/architecture.md` to instantly locate the target file's path.
   - If editing a route endpoint in `backend/*_api.py`, the agent must immediately open its verified twin engine in `backend/engines/*_engine.py` without searching.
   - **Keep the Map Synchronized:** Whenever a file is added, renamed, or consolidated, the agent MUST update the "Repository Navigation Map" in `docs/architecture.md` in the same turn so future sessions never encounter stale paths.


---

## 4. Live Iteration & Pay-As-You-Go Refactoring

1. **Active Context Cleanups:**
   - When instructed to fix a bug or add a feature within a specific file, inspect the local function or component for duplicate logic, unused state, or structural debt before writing new lines.
   - If localized duplicate blocks or disorganized state code are found in the immediate area of modification, refactor and clean them up *in-stride* as part of fixing the issue.
2. **Verification Protocol (Strict Ban on `npm run build`):**
   - **Absolute Ban on `npm run build`:** The AI agent is STRICTLY AND UNCONDITIONALLY FORBIDDEN from running `npm run build` or full production packaging under any circumstance, unless the human user explicitly commands it in that exact prompt. Running full Next.js production builds during development wastes memory, causes UI lag, and litters the workspace with `.next` build artifacts.
   - **Approved Fast Verification Commands Only:** Always verify code integrity using fast, targeted checks only:
     - Frontend TypeScript: `cd frontend && npx tsc --noEmit` (Checks typescript type safety and import integrity with zero build overhead)
     - Backend Python: `cd backend && python3 -m py_compile main.py sessions_api.py imposing_api.py book_scan_api.py settings_api.py engines/*.py` (Checks for syntax and compilation errors without starting server daemons)
