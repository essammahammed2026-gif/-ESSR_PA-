# Contributing Guidelines & Code Standards

Welcome to ESSR_PA. Whether you are a human developer or an AI assistant pair programming on this codebase, please follow the standards and verification procedures outlined below.

---

## 1. Golden Rules

1. **Strict TypeScript & Zero `any` Creep:**
   * Do not disable strict mode.
   * Never introduce loose `any` types. Provide explicit TypeScript interfaces or types for all API payloads and component props.
2. **Centralized API Client:**
   * Never hardcode `http://localhost:8000` inside frontend components or hooks.
   * Always import and use `src/lib/api.ts` (`API_BASE_URL` or `getApiUrl()`).
3. **Debounce Reactive Inputs:**
   * Any slider or continuous input that triggers backend calculation (such as margins, spacing, contour threshold, dilation offsets) **must** use `src/lib/useDebounce.ts` (~350ms delay) to prevent UI freezing and server flooding.
4. **Keep Routers Thin, Engines Pure:**
   * Backend route handlers in `main.py`, `imposing_api.py`, etc., should only handle HTTP validation, background task dispatching, and error codes.
   * Core logic belongs in `backend/engines/` as pure, testable functions without HTTP dependencies.
5. **Zero-Retention Storage:**
   * Never commit uploaded files, user data, test PDFs, or generated output bundles.
   * Clean up temporary working files inside `temp_uploads/` immediately after processing.

---

## 2. Development & Verification Workflow

Before submitting a pull request or ending a coding session, always run the full verification battery:

### Frontend Check
```bash
cd frontend
npm run lint    # Must report 0 errors and 0 warnings
npm run build   # Must compile cleanly (100% static/dynamic routes passing)
```

### Backend Check
```bash
cd backend
source .venv/bin/activate
python -m py_compile main.py imposing_api.py book_scan_api.py settings_api.py engines/*.py
```

### Smoke Test API
```bash
curl -s http://localhost:8000/
curl -s http://localhost:8000/api/settings
```

---

## 3. Documentation Policy

Documentation follows the **Docs-as-Code** standard with a single source of truth:
* **Feature additions or bug fixes:** Record human-readable entries in [`CHANGELOG.md`](./CHANGELOG.md) under the `[Unreleased]` section.
* **Architecture or engine updates:** Update the relevant files in [`docs/`](./docs/).
* **Do not duplicate:** Do not create ad-hoc summary files or copy route tables into subfolders.
