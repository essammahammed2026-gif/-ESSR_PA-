# Changelog

All notable changes to the ESSR_PA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
- **Book Studio Full-Page Viewport & Left Deck Gallery**:
  - **Thumbnail Deck in Left Panel**: Moved the visual thumbnail deck directly into [`BookLeftPanel.tsx`](frontend/src/components/book-studio/BookLeftPanel.tsx) with 2-column cards, rotation tags, drag-and-drop reordering, and hover actions, replacing the plain text list and freeing up the central screen.
  - **Full-Page Center Viewport Refinements**: Refactored [`BookWorkspace.tsx`](frontend/src/components/book-studio/BookWorkspace.tsx) with a clean toolbar (removed redundant labels and bottom hint pill), added counter-clockwise rotation (`RotateCcw`), and integrated the HTML5 Fullscreen API (`Maximize2` / `Minimize2`).
  - **Contextual Toggle Button**: Replaced verbose status labels with a clear dynamic button: `Show Original` when viewing edited, and `Show Edited` when viewing original.
  - **Mouse Wheel Zoom & Pan Control**: Intercepted `Ctrl + Wheel` via non-passive event listeners to zoom directly into the cursor location without triggering browser page zoom, with `Ctrl + 0` resetting scale to 100%, and mouse-drag panning when zoomed.
  - **Instant Original Overlay with Shortcuts**:
    - **Hold `[Space]`**: Temporarily overlays the raw, unprocessed scan to quickly inspect what was changed, releasing immediately snaps back to cleaned.
    - **Press `[O]`**: Toggles between Raw Original and Cleaned Print View.
    - **Keys `[` and `]` / Arrow keys**: Rapidly flip through previous and next pages.
  - **Unified StudioLayout Shell Component**: Created [`StudioLayout.tsx`](frontend/src/components/layout/StudioLayout.tsx) establishing a standard 3-slot architecture (Left Deck / Center Viewport / Right Controls) shared across the suite. Features collapsible sidebars (`w-11` slim rails with expand triggers), global bracket hotkeys (`[` and `]`), top breadcrumb toggles, and seamless full-width canvas expansion.
  - **Studio Adoption (Book Studio & Imposing Studio)**: Successfully migrated both [`book-studio/page.tsx`](frontend/src/app/book-studio/page.tsx) and [`imposing/page.tsx`](frontend/src/app/imposing/page.tsx) to `StudioLayout`, removing hundreds of lines of repetitive layout boilerplate.
  - **Dynamic Backend Cache & DPI Scaling**: Updated `get_page_thumbnail` in [`book_scan_api.py`](backend/book_scan_api.py) to support dynamic DPI (100 DPI for fast deck thumbnails, 150 DPI for high-res viewport inspection) and multi-parameter cache keys.

- **Documentation & Setup Guides**:
  - **Work PC & Cross-Platform Setup Guide**: Added step-by-step setup and quickstart instructions in [`README.md`](README.md) covering cloning from GitHub, environment setup, and service running for both Linux/macOS and Windows without external Redis or Celery dependencies.
  - **Prepress Engine & API Sync**: Updated [`docs/api.md`](docs/api.md), [`docs/engines.md`](docs/engines.md), and [`backend/README.md`](backend/README.md) to document the Universal Asset Inspector (`asset_inspector.py`), Executive Audit Report Generator (`report_generator.py`), and granular imposition deck endpoints.

- **Bug Fixes**:
  - **Asset Ingest Cache NameError**: Defined [`INSPECT_CACHE`](backend/main.py#L49) in [`main.py`](backend/main.py) and added it to cache eviction pruning. Resolved an unhandled 500 `NameError: name 'INSPECT_CACHE' is not defined` on `POST /api/inspect` that caused browsers (specifically Zen Browser / Firefox) to drop CORS headers and fail file uploads with `TypeError: NetworkError when attempting to fetch resource`.

- **Home Rework & Granular Prepress Audit Report**:
  - **Simplified Home Dashboard**: Renamed the triage hub to **Home**, removed superfluous marketing copy, streamlined the dropzone, and integrated active progress bars during asset analysis and studio launch.
  - **Sidebar Logo Toggle & Breadcrumb Fixes**: Removed the burger menu icon in [`layout.tsx`](frontend/src/app/layout.tsx) so clicking the Flint logo directly opens and closes the sidebar. Replaced unlinked breadcrumb headers across all studio workspaces with functional `<Link href="/">Home</Link>` paths.
  - **Master/Detail Prepress Audit Report**: Implemented a side-by-side inspection layout in [`page.tsx`](frontend/src/app/page.tsx). Left panel displays asset thumbnail, specifications, and instant preloaded studio launchers. Right panel displays an itemized technical audit checklist:
    - **Page Geometry & Trim Uniformity**: Itemizes exact page ranges for each dimension group (e.g. Pages 1–10: 210 × 297 mm A4, Page 11: 420 × 297 mm A3).
    - **Image Resolution (DPI)**: Scans every embedded image across all pages, itemizing exact page numbers, DPI values, and pixel dimensions for images below 300 DPI.
    - **Bleed Margins & TrimBox**: Checks TrimBox vs BleedBox, reports detected bleed in millimeters, and lists all page numbers lacking bleed margins.
    - **Color Space & Separation**: Identifies primary colorspace, reports RGB page numbers needing CMYK plate conversion, and lists spot colors.
  - **Executive PDF Report Export**: Added [`engines/report_generator.py`](backend/engines/report_generator.py) and backend routes (`GET /api/inspect/report-pdf/{file_id}`, `POST /api/inspect/export-report-pdf`), allowing operators to generate and download a printable, executive-ready A4 PDF Prepress Quality Audit Report to send to clients or team members.
  - **Instant Studio Preloading**: Pre-passes analyzed artwork parameters and IDs across all studios (Imposing, Contour, Book Studio, Flipbook, Preflight) to eliminate redundant uploads and duplicate processing bars.

- **Icon-Only Collapsed Sidebar & Typography Upgrade**:
  - **Collapsed Icon Rail by Default**: Reconfigured [`layout.tsx`](frontend/src/app/layout.tsx) sidebar to initialize in collapsed icon-rail mode (`w-14`), expanding the available workspace canvas.
  - **Instant Studio Tooltips on Hover**: Added floating hover tooltips with directional pointer carets for all studios, settings, and shutdown actions, displaying the studio name cleanly without canvas jitter.
  - **Flattened Studio Hierarchy**: Removed categorical grouping headers (`Overview`, `Prepress & Ingest`, `Production & Finishing`, `Digital Proofing`) in favor of a single unified studio list.
  - **Removed Tag Noise**: Stripped all decorative badge tags (`SVG`, `PDF`, `Bleed`, `Gang`) from sidebar items, retaining pure studio names.
  - **Space-Efficient Typography**: Switched typeface to **Roboto** (weights 300, 400, 500, 700) with `-0.012em` letter tracking in [`globals.css`](frontend/src/app/globals.css), creating clean vertical proportions and compact horizontal footprint across prepress controls and data fields.

- **Granular Page-Level Imposition & Deck Manipulation**:
  - **Data Models**: Introduced [`ImposingPage`](frontend/src/types/prepress.ts), `ImposingPageMeta`, and `ImposingUploadResponse` in `types/prepress.ts`.
  - **Thumbnail & Page Metadata Ingestion**: Updated `analyze_universal_asset` in `engines/asset_inspector.py`, `POST /api/inspect`, and `POST /api/imposing/upload` in `imposing_api.py` to extract and return per-page dimensions, aspect ratios, and thumbnail URLs. Added `GET /api/imposing/pages/{file_id}` for instant on-demand page retrieval.
  - **Interactive Page Deck (`LeftAssetPanel`)**: Replaced placeholder chips with live thumbnail cards supporting drag-and-drop reordering, per-page rotation (90° CW/CCW), exclusion/inclusion toggling, page duplication, and real-time active count indicators.
  - **State & Packer Integration**: Implemented `reorderPages`, `rotatePage`, `toggleDeletePage`, `duplicatePage`, and `getItemsForLayout()` in `useImpositionState` and `page.tsx`, directly feeding page order and rotations into the 2D packing engine and debounced sheet preview.
  - **Prepress Marks Integration**: Wired registration marks (`regMarks`) across [`RightControlPanel`](frontend/src/components/imposing/RightControlPanel.tsx), [`PreviewViewport`](frontend/src/components/imposing/PreviewViewport.tsx), and backend PDF/SVG export engines (`SheetGangExporter.export_pdf` and `export_svg`).
  - **Manual Rows × Columns Override**: Added interactive manual grid controls (`rows`, `cols`) with an Auto-Fit toggle in [`RightControlPanel`](frontend/src/components/imposing/RightControlPanel.tsx). Integrated the grid override into `MaxRectsSheetPacker.pack_sheets` in [`backend/engines/sheet_packer.py`](backend/engines/sheet_packer.py), allowing operators to lock explicit grid layouts alongside auto-packing. Wired parameters across `ImposingRequest` in [`imposing_api.py`](backend/imposing_api.py) and debounced preview/export triggers.

- **Imposing Studio UI Refactor**:
  - Unified Book and Gang mode control logic in `page.tsx` into a single shared interface.
  - Replaced the custom EyeDropper `<canvas>` polyfill with the native HTML5 `<input type="color">` picker, removing over 50 lines of fallback code and leveraging native GTK/Windows pickers.
  - Extracted the interactive sheet canvas and layout preview into a standalone `<PreviewViewport />` component, reducing `page.tsx` line count by over 1,000 lines while maintaining stability and zero React re-render loops.

- **Local-First Architecture & Native Desktop Migration (Tauri v2 Integration)**:
  - **Removed Celery & Redis dependencies**: Transitioned background processing (multi-page renders, PDF imposition, export synthesis, flipbook rasterization) entirely to FastAPI's native `BackgroundTasks` and `asyncio` execution pool, enabling zero-dependency native execution across Linux and Windows without Docker or WSL.
  - **Cleaned Requirements & Service Scripts**: Removed `celery` and `redis` from [`backend/requirements.txt`](backend/requirements.txt), deleted legacy `celery_app.py`, and streamlined [`start.sh`](start.sh) service orchestrator.
  - **Tauri v2 Desktop Packaging Scaffold**: Configured Tauri v2 desktop application bundle with Next.js webview frontend, Python FastAPI sidecar orchestrator, and strict TypeScript IPC / API data models.
  - Fixed orphaned `uvicorn` processes lingering on port 8000 when stopping services through `/api/shutdown` or systemd.
  - Added `-m 2` maximum timeout on backend and frontend healthcheck requests in [`start.sh`](start.sh) to prevent launcher freezes during app menu launch.
  - Added automated port recovery (`fuser -k` / `pkill`) in [`start.sh`](start.sh) to ensure ports 8000 and 3000 are cleanly reclaimed before service start.
  - Improved Hyprland window focus matching to target `Flint`, `Prepress`, or port `3000` in Zen Browser.

- **Fixed Preloaded PDF Resolution & Blank Export in Imposing Studio**:
  - Resolved file identification mismatch where `/api/inspect` saved assets with randomized prefixes without file extension, preventing Imposing Studio from locating the uploaded PDF on disk.
  - Added `resolve_temp_file()` in `imposing_api.py` to robustly resolve file paths across exact names, file extensions, and upload prefix variations.
  - Added background pregeneration of multi-page PDF thumbnails during universal inspect so all book pages render instantly in the imposing preview canvas.
  - Initialized default press sheet dimensions (SRA3: 320 × 450 mm) so that imposing calculation and layout preview fire immediately upon loading preloaded artwork.

- **Concise On-Hover Tool & Studio Descriptions**:
  - Removed persistent static description paragraphs from studio tiles and dispatch recommendations on the Dashboard Hub (`/`).
  - Implemented concise, streamlined tooltips that only appear on hover over the tool or studio name.
  - Shortened all descriptions across the asset inspection engine, dashboard tiles, and sidebar navigation items into concise, actionable summaries.

- Implemented **Prepress Triage Desk & Universal Ingest Hub** (`/`):
  - **Universal Format Inspection Engine (`engines/asset_inspector.py`)**:
    - Automatically inspects single/multi-page PDFs, high-res PNGs, JPEGs, TIFFs, and WEBPs.
    - Accurately measures physical trim dimensions in millimeters (`mm`), page counts, aspect ratios, embedded raster counts, alpha transparency channels, and color space models.
  - **Intelligent Pre-Loaded Studio Dispatch (`POST /api/inspect`)**:
    - Generates high-resolution raster previews synchronously and registers server cache IDs.
    - Dispatches users to target studios with their artwork already pre-loaded into state via URL parameters (Imposing, Contour, and Book Studio).
  - **Eliminated AI-Stock Design & De-Cluttered Visuals**:
    - Replaced redundant marketing metrics cards and duplicate studio links with a functional dropzone, live technical asset inspection strip, and recent file recall.
    - Refined typography hierarchy: consistent weights, disciplined monospace metrics (`tabular-nums`), and removed noisy micro-badges.
- Implemented **Two-Mode Imposition Architecture (Book & Publication Mode vs. Gang Run & Sticker Nesting Mode)** in Imposing Studio:
  - **Streamlined Operator UI & Layout De-Cluttering**:
    - **Quiet Imposing 2-Step Workflow Architecture**: Split Book Mode into an intuitive 2-stage prepress pipeline:
      - **Step 1 (Page Trim & Bleed Setup)**: Configure Finished Trim preset/dimensions, Content Fit Mode (`Fit`, `Stretch`, `Crop`), opposing landscape auto-rotation, and Bleed Extension (Mirrored Edge or Solid Color).
      - **Step 2 (Sheet Impose / Step & Repeat)**: Target Press Sheet selection, corner crop marks, gripper margins, gutter gaps, guillotine orientation, and sheet alignment.
    - **Ultra-Fast Book Imposition ($O(1)$ Template Replication)**: Replaced repeated 125+ pass MaxRects bin-packing on uniform book sheets with instant Sheet 1 template placement and mathematical page sequence offsets, dropping calculation times from 15–20s down to ~15ms on 500+ page documents.
    - **In-Memory Document Handle Caching**: Cached open PDF document handles during preview calculation cycles to eliminate repetitive disk re-reads.
    - **Compact Half-Width Viewport**: Reduced preview canvas width by half (`max-w-[560px]`) alongside the 370px sidebar to optimize screen space and eliminate excessive horizontal eye travel.
    - **Bleed Off by Default & Consolidated Controls**: Uploaded artwork and books now initialize with bleed disabled (`bleed_mode: "none"`, `bleed_mm: 0`). When toggled on, the **Bleed Method** (Mirrored Edge vs Solid Color) and **Bleed Type** (Outside vs Inside) appear together inside the primary Bleed Extension group rather than hidden away in Advanced Options.
    - **Trim Box & Content Fit Streamlining**: Moved content fit selector (`Stretch`, `Fit`, `Crop`) directly under Finished Trim Size inputs; removed duplicate original size from trim card and added a quick `Reset` button.
    - **Active File Information & Page Range**: Consolidated the active file card with primary file name, total sequential page count, original dimensions (`W × H`), and direct Page Range input (`all` / custom) right beneath the title.
    - **Centered Alignment Default**: Imposition placement now defaults to `Center` rather than `Top Left`.
    - **Cleaner Viewport**: Removed redundant prepress legend and verbose media stats bar from the top of the preview panel for an uncluttered prepress cockpit.
    - Replaced the overwhelming 2-column side-by-side cockpit cards with a single sleek, focused sidebar (`w-[350px]`) and a compact live press sheet viewport (`h-[380px] lg:h-[420px]`).
    - Added quick-toggle Bleed Method selection (**Mirrored Edge** vs **Solid Color**) with color swatch and screen eyedropper.
    - Upgraded preview thumbnail resolution from ~72 DPI (0.35 scale) to ~150 DPI (0.72 scale) in both synchronous and background pre-generation for crisp page readability.
    - Added viewport toolbar toggle (`Labels On / Labels Off`) and reduced page overlay badges to a minimal 7px non-intrusive badge.
    - Simplified everyday book imposition down to 3 quick steps: (1) Finished Trim preset, (2) Press Sheet size, (3) 3 Essential Prepress Toggles (`Auto-orient landscape`, `Prepress Corner Crop Marks`, `Bleed Extension`).
    - Introduced a progressive disclosure accordion (`[ ⚙️ Advanced Options ]`) to house technical prepress tuning (gripper margins, gutter gaps, inside/outside bleed synthesis, 3×3 alignment, and die-line outlines) without cluttering operator workflow.
    - Dedicated **Book Geometry & Bleed** card with standard book trim presets (A5, A4, B5, Novel 6×9", Digest, Pocket, Custom), aspect lock and swap W/H, reset to original PDF size, outward mirror bleed synthesis, and fit mode selection.
    - Preserves sequential page imposition: maintains strict numerical page order (1, 2, 3...) across press sheets (`job_mode: "book"` in `MaxRectsSheetPacker`).
    - Prepress Opposing Landscape checkbox: single clear toggle `Auto-orient opposing landscape pages` (turns landscape pages 90° CW to match book trim; normal portrait pages remain upright).
    - Dedicated **Target Press Media & Marks** card with sheet presets (SRA3, A3, B2, 33×48, A4, Custom), swap W/H, gripper margin, gutter gap, 3×3 alignment grid, Polar/guillotine cut, prepress corner crop marks, and cut outline die-lines.
  - **Gang Run & Sticker Nesting Mode**: Retains continuous roll and cut sheet nesting with multi-item queue, copy counts, and individual bleed/fit parameters.
  - **Prepress Viewport Legend**: Visual legend in the viewport toolbar distinguishing Trim Box cut line, Bleed margin, and Press Gripper margin.
  - **Inside Bleed Mode**: Retains the exact target trim dimensions (e.g. 19.5 × 28.2 cm) while insetting content by the user-specified bleed margin (e.g. 2.5 mm).
  - **Outside Bleed Mode**: Keeps artwork at full target size and expands the outer cut box on the sheet by 2× bleed margin.
  - **Solid Fill Bleed**: Pads the outer margin with a solid color, selectable via an integrated color swatch and screen/page eyedropper.
  - **Mirror-Edge Bleed**: Synthesizes a true bleed extension by reflecting and mirroring outer edge pixels (via OpenCV `BORDER_REFLECT_101`) directly in high-res vector PDF export.
  - **Interactive Thumbnail & Eyedropper Upgrade**: Upgraded `ArtworkColorPicker` to load directly from the PDF thumbnail endpoint, enabling direct color sampling from any page of a book.
- Added per-item **Fit Mode** (`stretch`, `fit`, `crop`) and **Conditional Opposing Page Rotation** (`none`, `cw`, `ccw`) in Imposing Studio:
  - **Stretch**: Forces artwork/PDF pages to fill the exact target W×H dimensions.
  - **Scale**: Scales proportionally to target bounds and letterboxes/pads with selectable background color (integrates with color picker & eyedropper).
  - **Crop**: Centers and scales artwork proportionally to fill the target W×H area without whitespace, clipping overflow evenly.
  - **Opposing Page Rotation Only**: Examines each individual page's aspect orientation ($W > H$ vs. $H > W$). Only pages whose orientation opposes the target slot (e.g., landscape pages in a portrait book) are rotated 90° CW or CCW; pages that already match the target orientation are kept unrotated.
- Fixed Imposing Studio live preview and export for **Bleed Synthesis** and **Opposing Page Rotation**:
  - **Bleed Preview Rendering**: Fixed a React state batching race condition where selecting bleed mode or type overwrote the atomic item updates. Added full live canvas preview visualization for both **Solid Bleed** (with prepress hatch guides and color fill) and **Mirror Bleed** (with outward edge reflections), as well as dedicated trim box / safety boundary dashed markers and corner badges displaying mode and placement (`inside` vs `outside`).
  - **Opposing Page Rotation Bug**: Fixed the aspect orientation comparison in `imposing_api.py`, `sheet_packer.py`, and `sheet_gang_exporter.py`. Orientation was previously checked against physical sheet coordinates (which inverted whenever the bin packer rotated the piece on the press sheet, mistakenly causing portrait pages to rotate). Orientation is now strictly evaluated against the user-configured target trim dimensions (`target_w_mm` vs `target_h_mm`), ensuring portrait pages remain unrotated while only opposing pages (e.g. landscape diagrams or spreads in a portrait book) rotate CW/CCW without stretching or distortion.
  - **Outside Bleed Cut Alignment**: Updated `SheetGangExporter` PDF and SVG exporters so that when outside bleed is active, cut contours, borders, and prepress crop marks align directly with the finished trim box (`content_rect`) rather than the outer bleed margin.
- Added background thumbnail pre-generation for multi-page PDFs in Imposing Studio: on upload a daemon thread opens the PDF once and sequentially renders all page thumbnails at 0.35× scale, eliminating the N-parallel-fitz.open() spike that caused lag on large books. Subsequent thumbnail requests become instant disk-cache hits regardless of book size.
- Added multi-page book imposing in Imposing Studio (`/imposing`): supports imposing massive books (e.g. up to 3,000 pages) without crashing or UI freezing.

- Added on-demand lazy thumbnail generation endpoint (`GET /api/imposing/thumbnail/{file_id}/{page_num}`) with low-res (72 DPI, 0.35 scale, ~15KB) disk caching so only visible press sheets load thumbnails.
- Guaranteed 100% full-resolution vector PDF and SVG exports (`/api/imposing/export` & `/api/imposing/export-svg`) by extracting raw page vector trees directly via PyMuPDF `show_pdf_page()`, completely bypassing low-res preview assets.
- Added multi-page book badge (`Book (X pages)`) and custom page range selector (e.g. `1-16`, `17-32`, or `all`) with quick preset buttons directly inside the artwork queue cards.
- Added high-volume sheet navigation toolbar with first/last shortcuts (`<<`, `>>`) and a direct sheet number jump input.
- Added inline editing capabilities for Sheet Presets and Continuous Roll Media in Settings Studio (`/settings`) with dedicated backend endpoints (`PUT /api/settings/sheets/{name}` and `PUT /api/settings/rolls/{name}`).
- Added Layered Cut SVG Export (`/api/imposing/export-svg`) in Imposing Studio and `SheetGangExporter.export_svg`: exports press-ready SVGs with separated `Artwork` and `CutContour` layers (with base64 embedded artwork, trim boxes, and optional corner crop marks) for digital cutting plotters (Zünd, Kongsberg, Roland, Summa).
- Added Polar / Guillotine uniform piece orientation mode (`uniform_orientation: bool`) in Imposing Studio and `MaxRectsSheetPacker` engine so repeated copies of artwork maintain an identical 0° or 90° orientation across sheets for continuous straight-line guillotine cutter channels.
- Refactored Imposing Studio layout to feature a wider, side-by-side control panel for Settings and Artwork Items, while removing the bulky top-level efficiency HUD in favor of a compact embedded statistics bar in the viewport header, significantly increasing available workspace.
- Moved the Imposing Studio "Add Artwork" drag-and-drop box from the bottom of the Items queue up into the global top header bar as a primary action button to save vertical space.
- Added multiple file selection support in Imposing Studio: users can now upload a batch of artwork simultaneously, creating an independent queue card for each file.
- Added native Original Size tracking for all uploaded imposing artwork, displaying original dimensions in the queue card and providing a quick "Reset to Original Size" shortcut button.
- Migrated the **"Keep Aspect Ratio"** and Background Fill Color tool from a global layout setting into an individual, per-artwork setting, allowing different files to be stretched or padded independently on the same sheet.
- Integrated the native browser **EyeDropper API** (with a fallback smart modal for Firefox/Zen) to allow users to pick background fill colors and border colors directly from their artwork inside the Imposing Studio preview.
- Fixed Imposing Studio canvas preview to forcefully stretch artwork thumbnails (`object-fill`) instead of padding them with white space (`object-contain`), matching the backend PDF export behavior exactly.
- Replaced the Sheet/Roll Alignment text dropdown with a much more intuitive and compact interactive 3x3 grid selector.
- Added native AVIF and WEBP image handling in the backend PDF exporter by intercepting them with OpenCV and injecting them into PyMuPDF as standard streams.
- Enabled 9-way alignment (Top Left, Top Center, Top Right, Left, Center, Right, Bottom Left, Bottom Center, Bottom Right) for Sheet and Roll imposing, and fixed alignment not being applied to final outputs.
- Removed the `% Scale` field completely from the Imposing Studio items list to simplify the user interface, relying exclusively on exact W/H dimensions.
- Added and fixed "Show Box / Cut Outline Around Art" toggle with custom color picker across Imposing Studio canvas preview and PDF export (eliminating unwanted forced green preview outlines when borders are disabled).
- Added global default setting for `uniform_orientation` in Settings Studio (`/settings`) and backend `settings_api.py`.
- Standardized documentation layout: `docs/architecture.md`, `docs/engines.md`, `docs/api.md`, `CONTRIBUTING.md`, and `CHANGELOG.md`.
- Comprehensive backend dependencies in `requirements.txt` (`opencv-python`, `numpy`, `shapely`, `reportlab`).
- Centralized API client (`frontend/src/lib/api.ts`) and debounce hook (`frontend/src/lib/useDebounce.ts`).
- Low-end hardware optimizations:
  - Automated 2-hour TTL cache eviction (`evict_stale_caches`, `evict_stale_sessions`) in `main.py` and `book_scan_api.py` to prevent memory leaks on 4GB–8GB machines.
  - Native image lazy-loading (`loading="lazy"` and `decoding="async"`) across Book Studio thumbnails and high-res preview inspectors.
  - RequestAnimationFrame (`rAF`) event throttling for canvas pan/zoom interactions in Imposing and Contour studios.
  - Downsampled raster preview pipeline for Contour Studio with standalone `/api/contour/export` for high-resolution die lines.
  - Sliding-window lazy loading (`LAZY_WINDOW = 3`) in Flipbook 3D virtual proofing engine.

### Fixed
- Fixed missing artwork image in Contour Cut Studio preview caused by unproxied relative `/temp_uploads` asset URLs: routed via Next.js rewrites and resolved through centralized `getApiUrl()`.
- Fixed flipbook preview live update failure when switching binding styles, restoring missing `apply_print_binding_padding` import in `backend/main.py` and improving UI error handling in `frontend/src/app/flipbook/page.tsx`.

### Changed
- Streamlined sidebar header and studio header bars into compact toolbars, reducing vertical overhead and expanding workspace canvas and tool panel areas across Contour, Imposing, Flipbook, and Book Scan studios.
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
