# FIX — Bloat & Agent-Slowness Remediation Plan

> Explicitly requested execution tracker (exception to AGENTS.md §2.1 no-ad-hoc-files).
> Single source of truth for code/docs stays: `CHANGELOG.md`, `docs/architecture.md`, `docs/engines.md`.
> This file tracks progress only — delete on completion.

## Baseline (2026-10-10 audit)

- Worktree 5.2G: `frontend/src-tauri/target/ 4.0G` + `node_modules/ 535M` + `.next/ 129M` + `backend/temp_uploads/ 319M (1,155 files)` + `backend/.venv/` (178M libllvmlite.so, 73M cv2.so).
- `.git` 238MiB total, pack 37MiB — `8737523 Base core` committed ~270x `flipbook_*.jpg`, zeroed in `0f4e54f`, never filter-repo'd.
- Tracked: ~90 files, ~33k LOC incl. locks (`package-lock 10k`, `Cargo.lock 4.4k`) → ~16k real LOC. `frontend/src` 9,320 lines across 30 files; 10 files >400 lines = 73%.
- God files: `BookRightPanel 1033`, `settings/page 1015`, `page 791`, `contour/page 743`, `BookWorkspace 723`, `flipbook/page 699`, `useBookStudioState 593`, `PreviewViewport 497`, `imposing/page 492`, `BookLeftPanel 429` / backend `imposing_api 836`, `book_scan_engine 752`, `book_scan_api 709`, `sheet_gang_exporter 628`, `sheet_packer 605`, `main 594`.
- Duplication: `hex_to_rgb x3`, `parse_page_range x3`, thumbnail render x4, crop-marks x4, deck/viewport/NumberControl across studios.
- Dead: `Header.tsx`, `controls.tsx NumberControl/ArtworkColorPicker` (unused), `GridSheetPacker`, `GridRollPacker` (broken refs), `helpers PAPER_CALIPERS`, `POST /api/shutdown`, dual inspect-report endpoints.
- Retention violation: 14x `book_scans/<uuid>/` each 13M `single_content.pdf` + 60-100 `thumb_*.jpg`; TTL only on `GET /` + `init-session`.
- Verification tax: `next lint` 30-120s (not <3s), full `build` on every handover, backend `py_compile` allowlist, smoke needs live sidecar.

## Progress Tracker

- [x] Phase 0.1 — Delete generated (.next, pycache, logs, dump.rdb) — done 2026-10-10
- [x] Phase 0.2 — `temp_uploads/book_scans` 319M/1155 files → 0 — done 2026-10-10
- [x] Phase 0.3 — Ignore consolidation (+`.next-build`, `book_scans/.gitkeep`) — done 2026-10-10
- [x] Phase 0.4 — Agent-context excludes documented (no code change needed)
- [ ] Phase 0.5 — HISTORY REWRITE (deferred: needs backup + re-clone + force-push window)
- [x] Phase 1.2 — New `engines/units.py` (`MM_TO_PTS`, `hex_to_rgb`, `format_page_ranges`) — done
- [x] Phase 1.3 — Delete dead (`GridSheetPacker`, `GridRollPacker`, spine math) — done
- [x] Phase 1.1 — New `engines/thumbnails.py` (single `render_pdf_thumb/render_image_thumb/pregen/resolve_temp_file/downsampled_preview`); replaced copies in `main.py` inspect + contour-upload, `imposing_api.py` upload + thumbnail + `_pregen` — done 2026-10-10
- [x] Phase 1.5 — Eviction on all upload paths (`inspect`, `contour/upload`, `flipbook`, `imposing/upload`, `book-scan/export`); `imposing_export_*` pdf/svg deleted via BackgroundTasks after download — done 2026-10-10. `POST /api/shutdown` and `/temp_uploads` mount KEPT (frontend `layout.tsx:80`, `PreviewViewport:331`, `controls:108` depend on them) — removal would break UX; documented risk accepted for local sidecar.
- [x] Phase 1.6 — Report endpoints share `_lookup_inspect_analysis` + `_report_pdf_response` helpers (both routes kept: POST is used by `page.tsx:284`, GET is the deep-linkable variant) — done 2026-10-10
- [x] Phase 1.4a — `imposing_api.py` 804 → 538 lines. New `engines/schemas.py` (`ImposingItem`, `ImposingRequest`), new `engines/imposing_prep.py` (`build_sheet_specs`, `build_roll_specs`, `apply_alignment`); `parse_page_range` → `units.py`, `get_dimensions_mm` → `thumbnails.py` (also fixed unclosed `fitz.open` leak); 70-line roll-PDF render → `SheetGangExporter.export_roll_pdf` (now closes doc); dropped unused imports — done 2026-10-10
- [x] Phase 1.4b — `book_scan_api.py` 710 → 453 lines: all request models → `schemas.py`; `split_pages` / `revert_pages` / `apply_crop_to_pages` / `render_export_pages` static methods on `BookScanEngine` (+ `PageOpError` carrying HTTP status); dropped `numpy`/`BackgroundTasks`/`JSONResponse`/`BaseModel` dead imports. `main.py` 594 → 536: flipbook `page_range` splitter → `units.parse_page_selection`, update endpoint → `flipbook_worker.refresh_flipbook_html`. Split/revert/crop round-trip unit-checked — done 2026-10-10
- [ ] Phase 1 — Backend thin-router + shared engines (remaining: thumbnail helper, router slimming, retention eviction, shutdown removal, endpoint consolidation)
- [ ] Phase 2 — Frontend god-split + shared hooks
- [ ] Phase 3 — Docs + verification + guardrails

---

## Phase 0 — Hygiene + .git surgery (immediate, zero logic risk)

- [ ] 0.1 Delete generated: `frontend/.next*`, `tsconfig.tsbuildinfo`, `backend/__pycache__`, `uvicorn.log`, `dump.rdb`. Keep `target/`, `node_modules/`, `.venv/` on disk, exclude from agents.
- [ ] 0.2 `backend/temp_uploads/book_scans/*` older than 2h → delete, keep `.gitkeep`. Confirm `du -sh` 319M → ~0, `find | wc -l` → ~0.
- [ ] 0.3 Consolidate ignores: root `.gitignore` owns all rules; `frontend/.gitignore` shim only. Verify `git check-ignore -v` for `target/ node_modules/ .venv/ temp_uploads/`.
- [ ] 0.4 Agent-context excludes: `target/ node_modules/ .next/ .venv/ temp_uploads/ *.lock *.woff *.ico .agents/skills/Omarchy/` in grep/glob config.
- [ ] 0.5 HISTORY REWRITE (approved): `git filter-repo --strip-blobs-bigger-than 500K --force` scoped to `backend/public_flipbooks/flipbook_*` + Base-core JPGs, then `gc --prune=now --aggressive`. Requires backup + re-clone. Target pack 37MiB → <10MiB.

Accept: `du -sh`, `git count-objects -vH`, `Glob src/**/*` = 30 files only.

## Phase 1 — Backend (correctness win)

- [ ] 1.1 New `backend/engines/thumbnails.py` — single `render_jpeg_thumb()`. Replace in `main.py:117-145`, `imposing_api.py:156-207,324-345`, `book_scan_api.py:259-285`.
- [ ] 1.2 New `backend/engines/schemas.py` + `units.py` — `MM_TO_PTS`, `hex_to_rgb` (1 copy), unified `parse_page_range`/`is_page_in_scope`, shared `PlacedItem` types. Delete nested copies.
- [ ] 1.3 Delete dead: `GridSheetPacker (sheet_packer 546-605)`, `GridRollPacker (roll_packer 219-280)`, `helpers 61-112`, empty `__init__.py` stays.
- [ ] 1.4 Thin routers: move `build_sheet/roll_specs, apply_alignment, preview math, roll-PDF render` (imposing_api 350-736) → exporter; move `split/revert/crop math, export loop` (book_scan_api 407-709) → engine; move `inspect/contour preview` (main 81-486) → engines. Target routers <250 lines (model: `settings_api 204`).
- [ ] 1.5 Retention fix: evict on every upload/export, delete `imposing_export_*` after response, remove/gate public `mount("/temp_uploads")`, remove unauth `POST /api/shutdown (main 577-593)`.
- [ ] 1.6 Consolidate `GET /report-pdf/{id}` vs `POST /export-report-pdf` → one.

Accept: no `fitz/cv2` in routers, `rg hex_to_rgb|parse_page_range` = 1 hit each, `py_compile` clean.

## Phase 2 — Frontend (agent-context win)

- [ ] 2.1 Split `BookRightPanel 1033` → `modules/CropSplitPanel, DeskewPanel, BleedPanel, RestorePanel` + `PageScopeSelector`.
- [ ] 2.2 Split `settings/page 1015` → `SheetsSection, RollsSection, DefaultsSection`; split `contour 743` / `flipbook 699` into `*_controls + *_viewport`.
- [ ] 2.3 New `hooks/usePageDeck.ts` (shared reorder/rotate/delete/reset); new `components/shared/DeckGrid.tsx + ViewportCanvas.tsx` (zoom/pan/pagination/overlay).
- [ ] 2.4 New `ui/NumberControl.tsx`; delete dead `Header.tsx`, unused `controls.tsx` exports.
- [ ] 2.5 Harden `lib/api.ts` → `apiFetch/postForm/downloadBlob`; replace 30+ inline fetch copies. Migrate manual `typingTimeout` (imposing 393-403, contour 368, flipbook 161) → `useDebounce`.
- [ ] 2.6 Unify `types/book_studio + prepress` → `BasePage`.

Accept: no `src` file >300 lines, `rg API_BASE_URL` only in `lib/api.ts`, `lint` clean, strict TS, no `any`.

## Phase 3 — Docs + verification + future-proof

- [ ] 3.1 Cut `CHANGELOG [Unreleased]` → version `[0.2.0]` ≤30 lines; drop inline file links.
- [ ] 3.2 `docs/engines.md + architecture.md` reference-only (no algo constants); delete `backend/README.md` shim; `docs/api.md` single route owner.
- [ ] 3.3 AGENTS.md §3A: scoped `eslint <changed> && tsc --noEmit` (fast loop); full `build` only for frontend changes at handover. Backend: `ruff + compileall + pytest` (no hardcoded router list, no live-curl requirement).
- [ ] 3.4 Exclude `.agents/skills/Omarchy/` from agent path.
- [ ] 3.5 Guardrails in AGENTS.md: 300-line file cap, no `cv2/fitz` in routers, must use `apiFetch + useDebounce`, `temp_uploads/` empty at session end. Pre-commit: ruff/eslint-changed/tsc/ban `*.jpg|*.pdf`. CI split: frontend/backend/docs jobs. Monthly `du + count-objects` audit + 2h TTL enforced by background task.

## Final Gate (run once)

```bash
cd frontend && npm run lint && npm run build
cd backend && python -m py_compile main.py imposing_api.py book_scan_api.py settings_api.py engines/*.py
curl -s http://localhost:8000/ ; curl -s http://localhost:8000/api/settings
```

Then delete this file; log outcomes to `CHANGELOG.md` + `docs/*` per AGENTS.md §2.
