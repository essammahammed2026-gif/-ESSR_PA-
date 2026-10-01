# Changelog

All notable changes to the ESSR_PA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Standardized documentation layout: `docs/architecture.md`, `docs/engines.md`, `docs/api.md`, `CONTRIBUTING.md`, and `CHANGELOG.md`.
- Comprehensive backend dependencies in `requirements.txt` (`opencv-python`, `numpy`, `shapely`, `reportlab`).
- Centralized API client (`frontend/src/lib/api.ts`) and debounce hook (`frontend/src/lib/useDebounce.ts`).

### Changed
- Rebuilt root `README.md` into a concise, professional project overview and 5-minute quickstart guide.
- Hardened `.gitignore` to prevent test PDFs, images, temporary files, and output flipbooks from entering the repository.
- Streamlined `AGENTS.md` into an authoritative, token-efficient rulebook.

### Removed
- Pruned obsolete and placeholder backend engines: `quick_print_engine`, `cover_builder`, `vdp_engine`, `barcode_sheet_engine`, `bleed_engine`, `color_engine`, `bezier_utils`, `file_analyzer`, `font_resolver`.
- Flushed accumulated runtime test artifacts (~52MB) from `backend/temp_uploads/` and stale generated flipbooks.
- Deleted legacy placeholder studio routes (`/quickprint`, `/bleed`, `/barcode`, `/color`, `/cover`) and redundant `Sidebar.tsx`.

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
