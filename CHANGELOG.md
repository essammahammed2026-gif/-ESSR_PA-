# Changelog

All notable changes to the ESSR_PA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
- **Smart Window/Tab Launch & Single-Instance Reuse (`start.sh`)**:
  - Removed `--new-window` flag from browser opening logic, ensuring Flint opens in the already-active browser window/tab instead of creating an unwanted new window.
  - Added `is_flint_tab_open` detector combining Hyprland client title queries and Zen Browser live sessionstore inspection (`recovery.jsonlz4`).
  - When the app is launched while already open in a tab, Flint focuses the active window, triggers an OS notification ("Flint Prepress Studio is already running"), and cleanly exits without creating duplicate tabs or windows.
  - Added `<title>Flint Prepress Studio</title>` to `frontend/src/app/layout.tsx` for proper tab and window title reporting.
- **New Flint Logo & Full-Size Icon Set (Concept 3 — faceted flame "F")**:
  - Replaced old `favicon.ico`, `flint_mark.png`, `flint_icon.png` (removed) and Tauri placeholder icons.
  - Favicon / `icon.png`: transparent, tightly-cropped glyph filling ~96% of the canvas height so it reads at full size in browser tabs and the Zen sidebar (old icon had heavy padding). Multi-size ICO: 16, 24, 32, 48, 64, 128, 256; small sizes are unsharp-masked.
  - Added `src/app/manifest.ts` + `public/icons/` (192/512 dark tile `#181D27`, 512 maskable) and `apple-icon.png` for installed-app / OS taskbar use.
  - Regenerated OS launcher icons (`hicolor` 16–512) and Tauri `32x32`, `128x128`, `128x128@2x`, `icon.png`, real `icon.ico`/`icon.icns` (previously 0-byte).
  - Collapsed sidebar logo enlarged from 26px to 30px.
- **Book Studio Explicit Apply, Reversible Applied History & High-Density UI Polish**:
  - **Explicit Apply & No Auto-Apply on Entry**:
    - Removed auto-enabling side-effects on module entry (`openModule`). Entering `Crop & Split`, `Deskew`, `Cleanup`, `Colors`, or `Bleed` never activates the effect automatically; only explicit clicks on **Apply** commit the module's effect.
    - Isolated crop guide canvas overlay to activate only while inside `Crop & Split`.
  - **Applied Entries List with Delete-to-Reverse**:
    - Added an `Applied` list at the bottom of every module showing committed actions, concise labels, and scope tags (`Current`, `All`, `Odds`, `Evens`, `Range`).
    - Every applied item includes a `Trash2` button that removes the entry and reverses the effect (e.g., restoring previous page geometry for crop/split, clearing deskew tilts, resetting color/background filters, or removing bleed margins).
  - **Optimistic 0ms Erase Boxes & Canvas Overlay Fix**:
    - Fixed the Erase Box tool (`PageCanvas.tsx`) by raising saved masks to `z-40` with hover delete `×` buttons on `z-[60]` so pointer events are never captured by the active drawing surface.
    - Implemented instant optimistic local state updates in `useBookModules.ts` for `applyMaskBox`, `removeMaskBox`, `clearPageMasks`, and `clearAllMasks`.
    - Added 1-click **Clear Page** and **Clear All** buttons without duplicating scope pickers.
  - **High-Density 1–2 Word Labels & Zero Clipping/Duplication**:
    - Reduced verbose titles and multi-word descriptions across all tools, module panels, and Hub cards to concise 1–2 word names (`Crop & Split`, `Deskew`, `Cleanup`, `Colors`, `Bleed`, `Paper`, `Content`, `Detect`, `Detect All`, `Spine Shadow`, `Despeckle`, `Whiten BG`).
    - Replaced flex layout in `PageScopeSelector` with a non-clipping 5-column full-width grid (`Current | All | Odds | Evens | Range`).
    - Eliminated redundant scope selectors and dual color mode controls in `RestorePanel.tsx`.
- **Book Studio Drill-Down Modules Hub & Dedicated Module Workspaces**:
  - **Modules Hub Overview (`BookRightPanel.tsx`)**: Replaced stacked accordion modules with a master-detail Drill-Down Hub displaying 5 rich module cards (`[1] Crop & Split`, `[2] Deskew & Straighten`, `[3] Cleanup & Masking`, `[4] Color & Tone Studio`, `[5] Print Bleed & Marks`) with live status summaries, active layer count pill, inline ON/OFF toggles, and per-module task progress bars.
  - **Dedicated Module Workspace Navigation**: Clicking any module card (or pressing `1`–`5`, or activating a canvas tool in `WorkspaceToolbar`) auto-enables the module and transitions the Right Panel into a dedicated full-height workspace with a `← All Modules` (`Esc`) back button and a compact 5-icon quick-jump strip.
  - **Expanded Per-Module UI/UX**:
    - **`CropSplitPanel.tsx`**: Added descriptive `Paper Sheet` vs. `Tight Content` mode cards, live 4-edge crop inset percentage readouts (`Left`, `Top`, `Right`, `Bottom`), separate `+ Vertical Cut` and `+ Horizontal Cut` buttons with output page count preview, and inline visible target scope pills (`Current | All | Odds | Evens | Range`). Removed the obsolete `CropTargetPopover.tsx` side-file.
    - **`DeskewPanel.tsx`**: Unified Auto Baseline Detection and Manual Page Angle fine-tuning into a single view with a live angle badge, slider, and 1-click micro-nudge buttons (`-0.5°`, `-0.1°`, `Reset`, `+0.1°`, `+0.5°`).
    - **`CleanupPanel` & `RestorePanel.tsx`**: Expanded Spot Erase / Whiteout Box (`M`) controls, Spine & Gutter shadow leveling, Safe Despeckle, 2×2 Global Book Color Mode cards with descriptions, Per-Page Override bar, and tone sliders with 1-click default reset links.
    - **`BleedPanel.tsx`**: Added Outside/Inside bleed cards, Mirror/Solid mode switcher, and 1-click prepress bleed width presets (`0 mm`, `2 mm`, `3 mm`, `5 mm`).
- **Book Studio Complete Prepress Suite: Cleanup & Masking, Smart Mixed-Content Auto Color, Multi-Format Export, Layer Hotkeys & Unified Flint Design System**:
  - **Unified 1-Line Global Scope Picker (`PageScopeSelector`) & Auto-Fading Canvas Tooltips**:
    - Standardized `PageScopeSelector.tsx` across all Book Studio modules (`Erase`, `Background Cleanup`, `Deskew`, `Color & Tone Studio`, `Print Bleed`) into a compact 1-line segmented control supporting `Current | All | Odds | Evens | Range`.
    - Added a `1.8s` auto-fade timer to the floating active-tool hint pill on `PageCanvas.tsx` (`Crop`, `Erase`, `Straighten`, `Eyedropper`) so it never obstructs the preview canvas.
  - **Dedicated Cleanup & Spot Masking Module (`CleanupPanel`)**:
    - Added interactive **Erase / Whiteout Box (`M`)** canvas tool (`PageCanvas.tsx`, `BookWorkspace.tsx`) allowing operators to drag a box over scanner fingers, 3-hole punches, staples, or edge marks and apply it across **`Current`**, **`Selected`** (Deck multi-select), **`All`**, **`Odds`**, **`Evens`**, or **`Range`** in the exact same coordinates.
    - Added 1-click removal via hover `×` badges on the canvas, **Clear Page**, or **Clear All** across the book (`POST /api/book-scan/mask-page/{session_id}`).
    - Added **Morphological Spine & Gutter Shadow Leveling** (`flatten_illumination`) and connected-component **Safe Despeckle** (`despeckle_level: 0 | 1 | 2 | 3`) that removes scanner dust specks while protecting punctuation periods and Arabic/Latin diacritics.
  - **Smart Mixed-Content Color & Tone Studio (`Smart Auto`)**:
    - Implemented **Pixel-Level Chroma-Aware Hybrid Compositing** (`BookScanEngine.apply_smart_auto_color`) for `color_mode = "auto"`, separating chromatic pixels (color illustrations, stamps, signatures) from neutral text/paper so mixed-content pages get crisp dark text, clean white paper, and vibrant color regions simultaneously without JPEG/B&W artifacts.
    - Added **Per-Page Color Mode Overrides** (`Default`, `Auto`, `Color`, `Gray`, `B&W`) via `POST /api/book-scan/color-mode-page/{session_id}` with Deck status dots.
  - **Expandable Multi-Format Export Dropdown**:
    - Upgraded the Book Studio Export button (`frontend/src/app/book-studio/page.tsx`) into a split-button + popover supporting **Merged PDF (`.pdf`)**, **Separate PDF Pages (`.zip`)**, **JPEG Images (`.zip`)**, **Lossless PNG Images (`.zip`)**, and **Archival TIFF Images (`.zip`)** with Output DPI (`150 / 200 / 300 / 400`), Quality slider (`60–100%`), and TIFF compression (`LZW`, `Deflate`, `None`).
  - **Layer-Stack vs. Focused Module Architecture & Full Hotkey Matrix**:
    - Separated active layer state (`module.enabled`) from the **Focused Module (`1`–`5`)** so multiple modules remain active simultaneously while context-aware hotkeys (`A` Detect Page, `Shift+A` Detect All, `Enter` Apply) target the focused module.
    - Added direct canvas tool hotkeys (`S` Straighten Line, `M` Erase Box, `C` Crop Overlay, `X` Add Cut Line, `G` Alignment Grid, `I` Eyedropper) to `useBookShortcuts.ts`, `WorkspaceToolbar.tsx`, and `ShortcutsSection.tsx`.
  - **Unified Flint Design System ("Obsidian Studio" Dark & "Daylight Paper" Light Mode)**:
    - Enabled **Light Mode ("Daylight Paper")** and refined **Dark Mode ("Obsidian Studio")** across the App Shell (`layout.tsx`, `StudioLayout.tsx`), Settings (`AppearanceSection.tsx`), Home Studio, and Book Studio via semantic CSS variables in `globals.css` and `AppearanceContext.tsx`, plus a 1-click theme toggle button in the sidebar.
    - Added **independent per-theme accent colors** (`darkAccentColor` stored in `essr_accent_color_dark` defaulting to `#F59E0B` Amber Gold, and `lightAccentColor` stored in `essr_accent_color_light` defaulting to `#2563EB` Cobalt Blue) with a dedicated **Dark Accent / Light Accent** switcher and curated per-theme preset swatches in `AppearanceSection.tsx`.
    - Implemented automatic WCAG luminance contrast variables (`--app-accent-text` for accent text on light/dark panels and `--app-accent-fg` for text on solid accent buttons), enabled `darkMode: "class"` in `tailwind.config.ts`, and strengthened Light Mode borders, segmented pills, and status badges for high-contrast readability.
    - Documented the design system in `docs/design_system.md` and linked it in `docs/architecture.md`.
- **Book Studio Smart Per-Page Crop, Deskew, Live Module Progress Bars & Exact Export Fidelity**:
  - **2-Stage Smart Auto-Detect Crop (`Paper Sheet` vs. `Tight Content`)**: Upgraded `BookScanEngine.detect_book_crop_and_seam` (`backend/engines/book_scan_engine.py`) with a 2-stage scanner edge detector that strips synthetic white PDF wrapper padding and marches past dark scanner lid voids/black border lines while preserving page paper margins, stamps, and signatures (`paper` mode), or crops tightly to inner ink (`content` mode).
  - **Batch "Detect All → Browse & Tweak → Apply All" Crop Workflow**: Added `POST /api/book-scan/detect-crop-batch/{session_id}` and per-page `per_page_crops` support to `POST /api/book-scan/crop-page/{session_id}`. Updated `useBookModules.ts` and `CropSplitPanel.tsx` so operators can run **Detect All**, step through pages (`[` / `]` or arrows) to inspect and tweak each page's individual crop box (`pageCrops[pageId]`), and commit all per-page crop boxes in one click (`Apply`).
  - **Upgraded Per-Page Deskew, Batch Detect All & Interactive 2-Point Straighten Ruler**:
    - Upgraded `BookScanEngine.detect_skew_angle` with dark scanner void masking (`bg < 175`), 1px-thin horizontal word fusion, `cv2.fitLine` L1 baseline regression, and `cv2.HoughLinesP` line detection for tables and architectural drawings.
    - Added per-page `deskew_angle` storage on `BookStudioPage`, `POST /api/book-scan/detect-angle-batch/{session_id}`, and `POST /api/book-scan/deskew-page/{session_id}`.
    - Added **Detect Page** + **Detect All** buttons, per-page angle badge/slider, and an interactive **Draw Straighten Line** ruler tool in `DeskewPanel.tsx` and `PageCanvas.tsx` allowing operators to drag along any horizontal text line or vertical table border on the canvas to immediately compute and apply the exact straightening angle.
  - **Live Per-Module Progress Bars**: Added `ModuleProgressBar` across `CropSplitPanel`, `DeskewPanel`, `BleedPanel`, and `RestorePanel`, plus chunked batch progress tracking in `useBookSession.ts` so long batch operations (`Detect All` crops/angles across 140+ pages, `Apply` crop/split, and live slider renders) display real-time percentage and page counts inside each module header.
  - **Removed Clean Border Option**: Removed the `Border Clean` UI section from `RestorePanel.tsx` and disabled `cleanBorders` by default across frontend and backend schemas so outer paper content, stamps, and signatures are never altered by border whitening.
  - **Guaranteed Export Fidelity**: Updated `BookScanEngine.render_export_pages` and `useBookModules.ts` (`exportPdf`) to pass and strictly honor all committed per-page crops, uncommitted draft `pageCrops`, and per-page `deskew_angle` overrides without re-running `detect_skew_angle` or overwriting per-page edits with global defaults.
- **Book Studio Multi-File Collation & Sequential Merge (Combine Parts)**:
  - **Fixed Dual Pass Intake**: Resolved bug where `initSession()` hardcoded `mode="single"` and dropped `file_odds`, `file_evens`, `odds_order`, and `evens_order`. Repaired backend router dispatch in `backend/book_scan_api.py` so `mode="dual"` is evaluated correctly without being swallowed by batch file arrays.
  - **Quick Swap & Starting Parity**: Added 1-click **Swap (⇄)** button in `BookLeftPanel.tsx` to instantly swap Odds and Evens files without re-browsing. Added **Start with** selector (`Odd (1, 2...)` vs `Even (2, 1...)`) forwarded through `BookScanEngine.collate_scans` and `collate_from_paths`.
  - **Sequential Merge (Combine Parts)**: Integrated `FileUploadQueue.tsx` with reorderable file parts (Move Up, Move Down, Remove, Clear All), multi-format intake (PDF, PNG, JPG, TIFF, WebP), and an inline **Rev** toggle to reverse individual batch page order before merging.
  - **High-Performance Backend Assembly**: Enhanced `BookScanEngine.combine_files_to_pdf` with `reverse_indices` support to efficiently merge documents with selective per-part reversal using PyMuPDF stream insertion.
  - **Unified Accent Theming**: Converted `FileUploadQueue` and intake status indicators to respect the dynamic application theme accent (`var(--app-accent)`).
- **Preflight Studio Deprecation & Command Center (Home) Consolidation & Polish**:
  - **Complete Preflight Deprecation**: Deleted redundant `src/app/preflight/page.tsx`, removed `/api/preflight` route from `backend/main.py`, and removed prototype `backend/engines/preflight.py`. Scrubbed all lingering preflight mentions from `asset_inspector.py`, `flipbook/page.tsx`, and `prepress.ts`.
  - **Sidebar & Quick Launch Streamlining**: Removed Preflight Studio link from global sidebar navigation in `layout.tsx` and aligned the home studio cards in `DropzonePanel.tsx` to match the exact sidebar navbar order: **Book Studio, Imposing Studio, Contour Studio, Flipbook Studio**, displaying clean names and icons without redundant descriptions.
  - **Dynamic Theme Accent Support**: Connected all Home Studio cards, dimension badges, export buttons, and routing indicators to respect the user-selected accent color (`var(--app-accent)`) instead of hardcoded disparate colors.
  - **Prominent Artwork Inspection Preview**: Enlarged the thumbnail in `AssetPanel.tsx` from a tiny 56px box to a prominent artwork preview card.
  - **Customer-Facing Prepress Audit PDF Report**: Embedded the application logo mark (`flint_mark.png`) into the PDF report header. Removed internal operator studio remediation references and software marketing footers, adding clean customer approval sign-off fields (`Customer Signature`, `Date`, `Customer Name`, `Approval Status`).
  - **Streamlined Prepress Audit Report (Zero Redundancy)**: Condensed `AuditReport.tsx` into a minimal non-repeating 2×2 grid (Trim & Geometry, Image Resolution, Bleed Margins, Color Separation) displaying concise metrics, status badges, and actionable lists while eliminating repetitive paragraphs and duplicate tiles.
  - **Universal Breadcrumb Navigation**: Implemented standardized breadcrumb headers across every studio and settings (`Home / Studio / [Sub-items/Filename]`). In Home Studio, opening an inspection displays an interactive breadcrumb returning instantly to the intake dropzone.
  - **PDF Thumbnail Alpha Crash Resolution & On-Demand Endpoint**: Resolved thumbnail rendering failure on books and PDFs with transparency (`ValueError: 'jpg' cannot have alpha`) by enforcing `alpha=False` in `backend/engines/thumbnails.py`. Added `/api/inspect/thumbnail/{file_id}` to dynamically serve or render thumbnails on the fly, with graceful error fallback cards in `AssetPanel.tsx`.
  - **Recent Inspections Studio Sanitization**: Cleaned legacy `flint_recent_jobs` in `sessionStorage` and added component-level filtering to guarantee the deprecated Preflight Studio never appears when opening recent inspections.
  - **Global Length Unit Support**: Added header unit dropdown (`mm`, `cm`, `inches`, `pixels`) with persistent localStorage sync to `src/app/page.tsx`.
- **Book Studio Live Export Progress & Prepress PDF Compression Optimization**:
  - **Live Export Progress Bar**: Implemented asynchronous export task worker in `backend/book_scan_api.py` (`POST /api/book-scan/export-job/{session_id}`, `GET /api/book-scan/export-job/{job_id}`, `GET /api/book-scan/export-download/{job_id}`) with per-page stage tracking. Built `ExportProgressModal.tsx` in frontend with live percentage progress bar, page indicator, active operation status, and automatic download trigger upon completion.
  - **5x File Size Bloat Elimination**: Solved file size inflation by enabling PyMuPDF stream deflation (`garbage=4, deflate=True, clean=True`) in `book_scan_engine.py`, lowering JPEG quality from sensor-noisy 95 to optimal prepress 88, encoding grayscale pages as 1-channel `DeviceGray` (saving 66% uncompressed size), and encoding pure B&W line art as lossless Deflate/PNG (~95% smaller than JPEG with zero ringing artifacts).
- **Book Studio Intake Streamlining**: Removed redundant "Digital / Vector PDF" intake option from `BookLeftPanel.tsx` and `types/book_studio.ts`, simplifying intake into two clear, distinct modes: "Standard Book PDF" (single/spreads/batches) and "Dual Pass (Odds / Evens)".
- **Book Studio Multi-Selection, Live Bleed & Production Polish**:
  - **Eyedropper Sampling & Magnifier Loupe**: Fixed canvas pixel sampling in `PageCanvas.tsx` (`ctx.drawImage` prior to `ctx.getImageData`) and introduced a floating circular color loupe with a live RGB swatch and hex badge tracking the cursor on hover.
  - **Applied Bleed Management & Inside/Outside Placement**: Added an "Apply Bleed" commit workflow in `BleedPanel.tsx` storing configured bleeds in an `appliedBleeds` entry list with inline edit and delete actions; introduced Outside Bleed (expands sheet outward past trim marks) and Inside Bleed (insets safety border inside page perimeter); updated dimension notch dynamically (`+3mm bleed` / `-3mm bleed`).
  - **Responsive Live Slider Dragging**: Reduced debounce delays from 350ms to 50ms across Color Restoration (saturation, contrast, B&W threshold, border margin) and Bleed width/color, delivering fluid ~20fps preview updates while dragging sliders.
  - **Input Spacing & Spinner Arrows**: Fixed number inputs in `BleedPanel` to eliminate overlap with native up/down stepper arrows.
  - **Global Length Units**: Added header unit dropdown (`mm`, `cm`, `inches`, `pixels`) dynamically formatting dimensions, crop readouts, cut line sizing, bleed inputs, and page properties modal.
  - **Multi-Select & Batch Actions**: Implemented `Ctrl+Click` multi-select, `Shift+Click` contiguous range selection, "Select ▾" quick filters (All, Odds, Evens, Custom Range), and batch page operations (rotate, delete, duplicate) in the Deck panel.
  - **Live Bleed Engine**: Added dual-mode bleed in `book_scan_engine.py` (mirrored edge synthesis via OpenCV `BORDER_REFLECT_101` and solid-color borders via `BORDER_CONSTANT`) with Japanese corner crop marks, live preview thumbnails, unbounded inputs, and color picker + canvas eyedropper sampling.
  - **Scan Color Restoration**: Added Color Mode selector (`Color`, `Grayscale`, adaptive Otsu `B & W`), threshold slider, and background paper whitening.
  - **UI / UX Polish**: Lowered notch z-index under toolbars and modals; fixed Apply dropdown downward positioning; compacted `Auto-Detect` and cut-line editor rows; thickened Deskew grid lines with custom color picker; simplified Page Properties modal and context menu.

- **Architectural Optimization, De-Fragmentation & Engine Deduplication**:
  - **Repository Navigation Map**: Added fast-lookup router-to-engine and route-to-component mapping table at the top of `docs/architecture.md` to eliminate blind directory searches.
  - **Phase 1 — Book Studio De-Fragmentation**:
    - Merged `cropTarget.ts` into `src/lib/pageScope.ts` and extracted shared non-overlapping cut-line placement math (`getNextCutLine`) into `src/lib/splitLines.ts`.
    - Consolidated `useBookModules.ts`, `useBookSplitOps.ts`, and `useBookExport.ts` into a single cohesive hook at `src/hooks/useBookModules.ts`, removing the mutable `clearCropsRef` workaround in `useBookStudioState.ts`.
    - Folded `SplitLineOverlay.tsx` directly into `PageCanvas.tsx`, routed vertical segment calculation through `segmentSizes()`, and stripped dead pointer props from `BookWorkspace.tsx`.
  - **Phase 2 & 2.5 — Imposing & Flipbook Studio Consolidation**:
    - Unified unit conversion math in `src/lib/units.ts` (`mmToUnit`, `unitToMm`, `formatMmInUnit` supporting `"in"` and `"px"` aliases) and deleted the single-component `src/components/imposing/controls.tsx` wrapper.
    - Consolidated `usePageDeck.ts`, `useImpositionState.ts`, and `useImposingJob.ts` into `src/hooks/useImpositionStudio.ts` with pure `buildImposingPagesFromMeta()` and `buildImposingPayload()` helpers.
    - Un-minified `src/app/flipbook/page.tsx` and routed export blob downloads through `downloadBlob()` from `src/lib/api.ts`.
  - **Phase 3 — Backend Geometry, Engine & Router Deduplication**:
    - Extracted `_make_placed_item`, `_find_best_rect`, `_split_and_prune_free_rects`, `_make_sheet_result`, and `_pack_single_sheet_pass` inside `MaxRectsSheetPacker` (`backend/engines/sheet_packer.py`), removing 3x duplicated placement and rect-splitting blocks.
    - Unified opposing-orientation rotation (`compute_opposing_rotation_deg`), page expansion (`_iter_expanded_item_pages`), and page metadata construction (`build_imposing_pages_meta`) in `backend/engines/imposing_prep.py`, shared across `sheet_gang_exporter.py` and `imposing_api.py`.
    - Inlined `BLUEWHALE_SVG_LOGO`, `BLANK_WHITE_PAGE_URI`, and `apply_print_binding_padding` into `backend/engines/flipbook_worker.py` and removed the orphaned `helpers.py` and `resources.py` files.
    - Unified 1-based page range parsing in `backend/engines/units.py`, replaced hardcoded `(rect.width / 72.0) * 25.4` with `PTS_TO_MM` in `backend/engines/thumbnails.py`, and routed all `main.py` temp-file extension fallback loops through `resolve_temp_file()`.
- **Document Pipeline State Persistence & Sub-Slice Lineage Fix**:
  - Resolved silent failure when attempting crop or split operations after a cut-line split in Book Studio.
  - Cleared `cropModule.splitLines` upon split commit and revert in `useBookSplitOps.ts` so `CropSplitPanel` correctly transitions between split and crop modes without retaining stale cut lines.
  - Fixed candidate page resolution in `useBookSplitOps.ts` when applying splits across documents where pages have already been split into slices, preventing `parentIds` from collapsing into an empty set.
  - Added `immediate_parent_id` tracking in `book_scan_engine.py` and `BookStudioPage` to maintain parent-child hierarchy during chained multi-phase cuts, preventing phase 2 and sub-splits from targeting stale page IDs.
  - Unified base dimension resolution in `BookScanEngine.split_pages` to prioritize `orig_width_mm` over scaled `width_mm`, preventing crop fraction compounding on iterative sub-splits.
  - Made `page_id` optional in `SplitSpreadRequest` and `CropPageRequest` schemas with robust router fallback, preventing HTTP 422 errors when batch-targeting all pages.
- **History Journal, Multi-Step Iterative Page Splitting & Shortcut Settings**:
  - Implemented Adobe-style 50-step bounded History Journal with instant non-destructive browsing, timeline jumps, Undo (`Ctrl+Z`), Redo (`Ctrl+Y` / `Ctrl+Shift+Z`), and confirmation-guarded "Restore Original" (`Ctrl+Shift+R`).
  - Added backend atomic state restoration via `POST /restore-pages/{session_id}` in `book_scan_api.py` and `BookScanEngine.restore_pages`.
  - Unlocked multi-step iterative splitting: removed single-split guards and implemented coordinate composition (`vis_x1 + s_start * vis_w`) so sub-slices retain accurate absolute root coordinates without drifting or snapping.
  - Replaced fragmented revert buttons in `CropSplitPanel.tsx` with unified Undo/Redo/History controls in `WorkspaceToolbar.tsx`.
  - Added dedicated "Shortcuts & History" tab in System Settings (`ShortcutsSection.tsx`) with History Limit adjustment (10–100) and keyboard shortcut rebinding with browser conflict prevention.
  - Extracted `RotateDropdown.tsx`, `HistoryPopover.tsx`, `RestoreOriginalModal.tsx`, `useBookHistory.ts`, and `useBookShortcuts.ts`, maintaining strict sub-300 line file caps across all modules.
- **Split Revert Streamlining, Rotate Dropdown & Laptop Display Density**:
  - Removed redundant "Split Page" banner box from `CropSplitPanel.tsx`; replaced "Split Pages active" label with an action button for "Revert Current Page" alongside "Revert All Spreads".
  - Cleaned "Show Original" / "Show Edited" toggle in `WorkspaceToolbar.tsx`, removing the "Space / O" key badge for a cleaner presentation.
  - Combined rotation buttons into a unified "R°" dropdown with 90° Clockwise, 90° Counter-Clockwise, and 180° rotation actions.
  - Implemented responsive laptop scaling and configurable Display Density (`Compact`, `Balanced`, `Relaxed`) in `AppearanceContext` and Settings, optimizing 14"–15" laptop screens with ~15–20% more usable workspace and canvas area.
- **Draggable Cut Lines, Roboto Typography & Book Studio Polish**:
  - Cut lines are now draggable along their full length on the preview (new `SplitLineOverlay.tsx`), not only via the pill/slider; active line highlights while dragging.
  - Roboto / Roboto Mono wired into Tailwind `font-sans`/`font-mono` via `next/font` CSS variables so the whole app uses them.
  - Book Studio: unified cyan/amber into the user accent color, softer weights, refined crop handles, dotted canvas backdrop, thin scrollbars, accent focus rings and range sliders.
- **Crop Box Controls & Studio Header Refinements**:
  - Removed manual typing input fields for crop box values, returning entirely to interactive canvas preview adjustment via handles and box dragging.
  - Restored clean, presentational `DimensionsBox` displaying real-time sheet and page segment dimensions.
  - Removed the "Deck" and "Controls" panel toggle buttons situated above the tools panel in `StudioLayout`.
  - Relocated the Grid and List deck view buttons to the left side of the top header bar directly above the deck panel.
- **Manual Canvas Crop Box Resizing & Window-Backed Pointer Interactions**:
  - Implemented direct edge resize bars (`n`, `s`, `w`, `e`) and corner handles (`nw`, `ne`, `sw`, `se`) on the preview crop box in `PageCanvas.tsx`, separating interior box dragging from edge scaling.
  - Replaced element-level pointer capture with window-backed `pointermove` and `pointerup` event listeners in `BookWorkspace.tsx`, eliminating dropped frames and cursor escapes during rapid drag resizing.
- **Dimension Field Steppers & Accurate Aspect Ratio Lock**:
  - Added increment and decrement step buttons (up/down arrows) next to dimension inputs in `DimensionInputField.tsx` with unit-aware step scaling (1mm, 0.1cm, 0.05in, 5px).
  - Wired aspect ratio lock toggle with truthful state and iconography (`Lock` with active accent outline vs `Unlock`), maintaining exact width/height proportionality when locked.
- **Global Accent Color Theming Across Settings & App**:
  - Updated Settings panel tabs, active highlights, header icons, and action buttons (`/settings`) to dynamically inherit the user's selected accent color (`var(--app-accent)`).
- **Appearance & Theming System (`/settings`)**:
  - Added dedicated "Appearance" tab in System Settings (`AppearanceSection.tsx`).
  - Added Theme mode selector with "Dark" (active default) and "Light" (placeholder for future implementation).
  - Added Global Accent Color Picker supporting native color picker, hex input, preset swatches (Amber Gold, Cyan Teal, Emerald Print, Purple Studio, Rose Crimson, Industrial Orange, Electric Blue), and live UI component preview.
  - Implemented `AppearanceProvider` and `useAppearance` hook with global CSS custom properties (`--app-accent`, `--app-accent-rgb`, `--app-accent-15`, `--app-accent-30`, `--app-accent-glow`) dynamically skinning studio buttons, cut lines, handles, active tabs, and navigation highlights.
  - Full client-side persistence in `localStorage` (`essr_theme`, `essr_accent_color`, `essr_selected_unit`) surviving page reloads.
- **Crop Box Free Movement & Aspect Ratio Unlock**:
  - Implemented free translation and movement of the entire crop box across the page bed via interior dragging (`cursor-move`).
  - Unlocked aspect ratio by default; ensured button presses (resets, unit toggles, steppers, presets) never lock proportions or constrain resizing.
  - Reduced minimum boundary constraints to 2% to ensure fluid, unconstrained positioning.
- **Unit Selectors & Consolidated Page Properties**:
  - Created centralized unit conversion utility in `lib/units.ts` for `mm`, `cm`, `pixels` (96 DPI), and `inches`.
  - Added dropdown unit selector (`cm`, `mm`, `pixels`, `inches`) right next to the crop dimension input fields in `InteractiveDimensions.tsx`.
  - Consolidated Page Properties modal into a single unified "Page Dimension" input with the matching unit selector.
- **Book Studio Concept UI Overhaul & Top-Bar Controls (`concept.png`)**:
  - Promoted high-contrast Amber `[ Export PDF ]` button to the top header bar alongside a segmented `[ ☰ ] [ ⊞ ]` View Toggle for switching between List and Grid deck views.
  - Redesigned `CropSplitPanel`: master ON/OFF switch, scissors icon badge, `+ Add Cut Line`, `Auto-Detect Bounds`, `Reset`, and unified `[ Apply to All Pages ˅ ]` split action button with `CropTargetPopover`.
  - Integrated `InteractiveDimensions` with direct millimeter width/height numeric inputs, 350ms debouncing, and interactive padlock (`🔒`/`🔓`) aspect ratio lock.
  - Deprecated and cleanly removed obsolete `DimensionsBox.tsx` and `CropTargetSelector.tsx`.
- **Deck Views (Clean DeckCard & Minimalist DeckListView)**:
  - Cleaned `DeckCard` by removing `#n` badge and hover corner buttons to maximize thumbnail clarity and delegate actions to the context menu.
  - Implemented `DeckListView` providing a minimalist list view with drag-and-drop reorder, active highlights, split indicators, and dimensions.
- **Page Context Menu & Advanced Operations**:
  - Added `PageContextMenu` on right-click across Grid and List views with Copy, Paste (Before/After), Duplicate, Insert Blank (Before/After), Rotate (90° CW, -90° CCW, 180°), Delete, and Extract (PDF, PNG, JPEG, WebP).
  - Added `PagePropertiesModal` displaying page dimensions (mm/pt), aspect ratio, rotation angle, split status, and source origin.
  - Backend pure engine methods `duplicate_page`, `insert_blank_page`, and `extract_single_page` in `BookScanEngine` with thin router endpoints in `book_scan_api.py`.
  - Extracted `useBookPageOps` hook, preserving strict sub-300-line caps across all frontend files.
- **CI / GitHub Actions**:
  - Added `actions/setup-node@v4` with Node 20 and npm caching, along with `npm ci` before running frontend lint and build in `.github/workflows/ci.yml`.
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
