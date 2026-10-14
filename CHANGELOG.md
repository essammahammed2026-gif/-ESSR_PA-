# Changelog

All notable changes to the ESSR_PA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
- **Book Studio Crop Module: unified single interface with per-line cut axes**:
  - Enabling Crop starts as plain crop (zero cut lines); operators add up to 3 cut lines, each independently switchable between vertical (pages) and horizontal (strips) with its own slider plus exact % type-in field.
  - Mixed-axis cuts run as two backend phases (vertical first, then horizontal across the new slices) for full grid cuts; dimension box shows column/row breakdowns and pages-per-sheet.
  - Frontend: `SplitLine { pos, direction }` model with `groupSplitLines`/`buildSegments`/`cutPageCount` helpers in `lib/splitLines.ts`; split ops extracted to `useBookSplitOps` (300-line cap).
  - Backend `split_pages` cuts along `split_lines` in one `split_direction` per call with per-slice `slice_box` records; `revert_pages` and `extract_page_image` handle all slice shapes; `SplitSpreadRequest` carries `split_lines`/`split_direction`.
- **Book Studio Crop Persistence & Template Inheritance Fix**:
  - Removed legacy, competing `useEffect` in `BookWorkspace.tsx` that forcibly reset `cropBox` to default 5% margins on every page navigation.
  - Centralized crop module state synchronization in `useBookModules.ts`, preserving working template inheritance across uncut spreads while accurately restoring uncommitted per-page adjustments via `pageCropsRef`.
  - Added cache invalidation via `clearPageCrops` in `useBookSplitOps.ts` on split, revert, and crop commits so active overlays reset to full bed cleanly over newly committed page regions.
- **Intake Mode Cleanup & Split Line Stability**:
  - Removed redundant "2-Page Spreads" upload mode from `BookLeftPanel.tsx` intake list since Book Studio handles single sheets and 2-up spreads natively inside the workspace.
  - Updated "Reset Full Bed" in `CropSplitPanel.tsx` to preserve configured cut lines while resetting outer margin bounds.
  - Added smart non-overlapping placement in `SplitLinesEditor.tsx` when adding subsequent cut lines (e.g. 50%, 67%, 33%) so multiple cuts remain immediately distinguishable on canvas.
- **Storage Management & Temporary Files Cleanup**:
  - Added dedicated "Storage & Cleanup" section to Settings (`/settings`) with quick one-click cleanup for runtime temp files.
  - Added an expandable folder breakdown accordion beneath the cleanup button detailing folder paths, item counts, disk usage, and categories (runtime temp vs. build cache).
  - Integrated native system file explorer inspection via `xdg-open` / OS folder open so operators can inspect directory contents prior to cleaning.
  - Implemented backend pure storage engine `backend/engines/storage_cleaner.py` and thin endpoints in `backend/settings_api.py` (`/storage-status`, `/open-folder`, `/clean-storage`) preserving `.gitkeep` files and resetting active in-memory sessions cleanly.

## [0.2.0] - 2026-10-12

### Added
- Book Studio: in-studio spread split/revert, single-page crop, high-precision deskew, bleed/burn-in modules with page scopes.
- Imposing Studio: Quiet 2-step book workflow, O(1) template replication, manual grid override, opposing-orientation rotation, inside/outside bleed, SVG cut export.
- Home triage hub with universal asset inspector and executive prepress PDF audit report.
- Settings Studio with sheet/roll preset CRUD and global defaults.
- Tauri v2 desktop shell; Celery/Redis removed in favor of FastAPI background tasks.

### Changed
- Backend routers are CV-free: all `fitz`/`cv2` logic lives in shared engines (`thumbnails`, `imposing_prep`, `book_scan_engine`); 2h TTL eviction on every upload/export path.
- Frontend split from god-files into studio modules; single `apiFetch`/`downloadBlob` client and shared `useDebounce` (350ms) everywhere.
- Shared `usePageDeck` deck ops, `DeckGrid`, `NumberControl`, and `BasePage` types across studios.
- Home, settings, contour, flipbook, and book-studio panels split into modules; pre-commit blocks binaries and CI runs frontend/backend/docs jobs.

### Fixed
- Imposing bleed preview race, opposing-rotation aspect check, outside-bleed cut alignment, preloaded-PDF resolution, contour `/temp_uploads` URLs, flipbook binding import.

### Removed
- Dead packers, spine math, placeholder engines/studios, legacy Header and color-picker polyfill; history purge of committed flipbook JPGs deferred to a backup window.

---

## [0.1.0] - 2026-10-01

### Added
- Initial core studios:
  - **Scanned Book Studio (`/book-studio`)**: Dual scanner intake, deskewing, margin cleanup, and 3mm synthesized bleed generation.
  - **Imposing Studio (`/imposing`)**: MaxRects sheet and roll packing, SVG visualizer, sheet efficiency HUD, cut marks.
  - **Contour Cut Studio (`/contour`)**: Alpha/Otsu thresholding, dilation/erosion offsets, smooth cubic Bézier vectorization, and SVG spot-color die lines.
  - **Flipbook Studio (`/flipbook`)**: 3D interactive virtual proofing (LTR/RTL, paperback/hardcover simulation).
  - **PDF Preflight Center (`/preflight`)**: Executive inspection report cards for trim boxes, bleed tolerances, DPI, and color spaces.
  - **Command Center (`/`)**: Service health dashboard and studio launchpad.
  - **Settings Manager (`/settings`)**: Substrate sizes and machine defaults.
- Unified runner script (`./start.sh`) managing backend, frontend, Redis, and Celery workers with `SIGINT` trap.
