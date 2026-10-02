# AGENTS.md — AI Coding Assistant & Pair Programming Guide

> **Authority:** This document defines the operational rules for AI coding assistants working in this repository. Follow these constraints without exception.

---

## 1. Golden Rules (Non-Negotiable)

1. **Centralized API Client:**
   * NEVER hardcode `localhost:8000` or API URLs in frontend components or hooks.
   * ALWAYS use `src/lib/api.ts` (`API_BASE_URL` or `getApiUrl()`).
2. **Debounce Reactive Sliders & Inputs:**
   * Sliders/inputs triggering real-time layout or calculation recalculations (e.g., margins, gaps, thresholds, offsets) MUST use `src/lib/useDebounce.ts` (~350ms delay).
3. **Strict TypeScript & Zero `any` Creep:**
   * Keep TypeScript strict mode enabled.
   * Do NOT introduce `any` types. Provide explicit typed interfaces for API models and component states.
4. **Backend Architecture (Routers Thin, Engines Pure):**
   * Keep FastAPI routers in `main.py`, `imposing_api.py`, etc., thin (HTTP validation, response formatting, Celery task dispatch).
   * Put business, math, CV, and PDF generation logic in `backend/engines/` as pure, testable functions.
5. **Zero-Retention File Policy:**
   * Do not commit test images, sample PDFs, uploaded files, or generated flipbooks/bundles.
   * Clean up files in `temp_uploads/` immediately after processing.

---

## 2. Documentation Maintenance Protocol

To avoid documentation degradation across AI sessions:
1. **Never create ad-hoc summary files** (e.g. `SESSION_SUMMARY.md`, `NOTES.md`, or AI role registries).
2. **Single Source of Truth:**
   * Code/API changes: Add entry to `[Unreleased]` in [`CHANGELOG.md`](./CHANGELOG.md).
   * Engine/algorithm updates: Edit [`docs/engines.md`](./docs/engines.md).
   * Architecture/flow changes: Edit [`docs/architecture.md`](./docs/architecture.md).
   * Do NOT write duplicate tables of routes or commands in subdirectories.

---

## 3. Verification Protocol (Iterative vs. Definition of Done)

### A. Fast Inner Loop (During Active Iteration & Editing)
Do **NOT** run full Next.js production builds (`npm run build`) or spin background polling timers after every minor code edit. This wastes tokens, CPU, and context. Use lightweight checks instead:

```bash
# Fast TypeScript & ESLint check (< 3 seconds)
cd frontend && npm run lint
```

### B. Final Session Gate (Definition of Done — Only Run Once Before Handover or Commit)
Before completing any major task, handing off to the user, or ending a session, the following checks MUST pass cleanly:

```bash
# 1. Frontend validation (Full production build check)
cd frontend && npm run lint && npm run build

# 2. Backend validation (0 syntax/import errors)
cd backend && python -m py_compile main.py imposing_api.py book_scan_api.py settings_api.py engines/*.py

# 3. API Smoke test
curl -s http://localhost:8000/ ; curl -s http://localhost:8000/api/settings
```
