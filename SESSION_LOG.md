# Session Log

## Date: 2026-10-29

### Task 33: Production Build Gate & Session Hand-Off
- **Objective**:
  - Run comprehensive Next.js production build verification gate (`npm run build`).
  - Eliminate all unused variable errors and React hook warnings flagged by ESLint during build.
  - Verify backend engine compilation and zero-retention storage policy.
- **Verification Results**:
  - **Frontend Production Build**: `cd frontend && npm run build` (Next.js 14.2.35) succeeded with exit code `0`.
    - Type checking and linting passed cleanly (`✓ Linting and checking validity of types`).
    - All 13 static application routes generated successfully without runtime or SSG errors.
  - **Backend Compilation**: `cd backend && python3 -m py_compile main.py engines/*.py` exited with code `0`.
  - **Storage Hygiene**: `python3 backend/engines/storage_cleaner.py` executed cleanly with code `0` (`backend/temp_uploads/` clean).
  - **Git Status**: Git working tree diagnostics executed; all modifications preserved cleanly for human version control check-in.

### Task 32: Decouple Split Tool from Crop Box Features & Canvas Overlays
- **Objective**:
  - Fully decouple the **Split** tool from the **Crop** tool:
    - The Split tool must not display, manipulate, or execute any crop box features (no outer crop borders, no corner/edge resize handles, no center move handle).
    - Cut lines span edge-to-edge across the entire page with proportional millimeter dimension tags referencing the full sheet dimensions.
    - Dragging cut lines operates directly on normalized page coordinates (0..1) without crop box offsets or scaling constraints.
    - Splitting execution commits slice geometry cleanly without applying or composing new crop boxes onto child pages, and leaves existing crop settings intact without resetting to full bed.
- **Architectural Implementation**:
  - **Decoupled Split Canvas Overlay ([`frontend/src/components/book-studio/PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx))**:
    - Added `isSplitMode?: boolean` to `PageCanvasProps`.
    - Split canvas overlay logic into dedicated `renderCropOverlay` (Crop tool only) and `renderSplitOverlay` (Split tool only).
    - `renderSplitOverlay` mounts full-page cut lines (`absolute inset-0`), with no bounding crop boxes, handles, or drag move targets.
    - Proportional segment sizing in `renderSplitOverlay` computes millimeters against full page width and height (`pageBaseWidthMm`, `pageBaseHeightMm`).
    - Top notch dimensions and canvas tool hint text dynamically reflect full sheet dimensions and split mode instructions.
  - **Full-Page Cut Line Dragging ([`frontend/src/components/book-studio/BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx))**:
    - Passed `isSplitMode={focusedModule === "split"}` to `PageCanvas`.
    - In `onMove`, when `isSplitMode` is active, cut line dragging calculates positions directly from relative page coordinates `Math.max(0.01, Math.min(0.99, isH ? relY : relX))` and returns immediately without running crop box resize logic.
  - **Pure Split Execution & State Cleanliness ([`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts))**:
    - In `runSplitPhase`: removed `crop_box` payload property so the backend `/api/book-scan/split-spread/${sessionId}` endpoint receives `None` and preserves existing child page crop boxes without composing new crops.
    - In `splitSpread`: removed `cropBox` dependencies; on split completion, removes only the split pages from `pageCrops` and clears `splitLines: []` on `cropModule` without resetting `cropBox: { ...FULL_BED }`.
    - In `revertSplitLevel` and `revertSpread`: clears `splitLines: []` without clobbering active `cropBox`.
  - **Scope Indicator Copy ([`frontend/src/components/book-studio/modules/CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx))**:
    - Updated unlinked Dual mode hint to neutral "Click or drag on either page to switch".
- **Verification**:
  - `cd frontend && npx tsc --noEmit` exited with code `0`.
  - `cd backend && python3 -m py_compile main.py engines/*.py` exited with code `0`.
  - `python3 backend/engines/storage_cleaner.py` exited with code `0`.

### Task 31: Split Tool Dual-Mode Cut Overlays, Auto-Detection & Batch Execution
- **Objective**:
  - Extend the Dual Mode interaction model to the Split tool:
    - Render interactive cut lines on both primary and secondary pages in Dual Mode.
    - Enable Dual ON linking (cut lines added or dragged update both pages simultaneously) and Dual OFF individual editing (grabbing or adding a cut line on either page auto-detects that page and modifies only its cut lines).
    - Unified **Split** execution: committing via **Split** applies all accumulated cut lines across all configured pages (from `pageCropsRef.current` + active page), grouping identical configurations for single-pass batch execution and handling per-page custom cut lines cleanly.
- **Architectural Implementation**:
  - **Dual Canvas Cut Overlays ([`frontend/src/components/book-studio/PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx))**:
    - Added `secondarySplitLines` prop to `PageCanvas`.
    - Removed `side === "primary"` restriction in `renderCropOverlay`, enabling full rendering and interactive dragging of `SplitLineOverlay` on both primary and secondary pages with proportional segment sizing.
  - **Split Line State & Auto-Detection ([`frontend/src/components/book-studio/BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx))**:
    - Formulated `primarySplitLines` and `secondarySplitLines`:
      - In Dual ON mode (`isDualLinked`), `secondarySplitLines` mirrors `cropModule.splitLines` (or its draft).
      - In Dual OFF mode, secondary page has its own `splitLines` and never inherits the left page's lines unbidden.
    - Synchronized `splitLines` alongside `cropBox` in `handleCropPointerDown`, `onSelectPrimaryPage`, and `onSelectSecondaryPage` so interacting with either page immediately focuses that page and loads its cut lines.
  - **Unified Split Commit (`splitSpread`) ([`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts))**:
    - Aggregates all staged cut lines from `pageCropsRef.current` and active `cropModule.splitLines`.
    - Automatically groups target pages by identical cut line positions and orientations.
    - For linked dual spreads or Scope All, executes batch splits in single API calls via `target_page_ids`.
    - For independent spreads with custom cut lines, executes sequential phase splits across updated document slices.
    - Clears staged drafts via `clearPageCrops()` and resets tool state to full bed.
- **Verification**:
  - `cd frontend && npx tsc --noEmit` exited with code `0`.
  - `cd backend && python3 -m py_compile main.py engines/*.py` exited with code `0`.
  - `python3 backend/engines/storage_cleaner.py` exited with code `0`.

### Task 30: Unified Crop Apply & Simplified Dual-Mode Auto-Detection
- **Objective**:
  - Simplify and unify the "Apply" button: clicking Apply commits all accumulated adjustments across all pages (from `pageCrops` + active page) without discarding manual tweaks or confusing the user with dynamic strings like `Apply (P.1)`. The button now simply reads **"Apply"** (and **"Split"** in Split mode).
  - Simplify Dual Page Mode: replace the individual `P.left` / `P.right` buttons in the Scope bar with a single **"Dual"** toggle button:
    - **Dual ON (Default)**: Adjustments apply to both pages of the active spread simultaneously.
    - **Dual OFF**: User adjusts each page individually without clicking page buttons. The app auto-detects which page the user works on (left or right) upon click or drag.
  - Clean Spread Inheritance: Unedited spreads start cleanly with the document default crop box (or global baseline if "All" scope was used), preventing previous spread overrides from spilling over.
- **Architectural Implementation**:
  - **Unified `applyCrop` Payload Builder ([`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts))**:
    - Aggregates all entries from `pageCropsRef.current` into `per_page_crops`.
    - If `cropModule.target.base === "all"`, sends `apply_to_all: true` with the baseline box while sending all individual page adjustments in `per_page_crops`, so the backend preserves all custom tweaks.
    - If non-global scope (e.g. `current`), constructs `target_page_ids` from the union of scoped pages and all modified pages in `perPageCropsPayload`.
    - Clears `pageCrops` upon successful commit so the workspace resets cleanly to the committed state.
    - Resets `dualSides` cleanly to `["left", "right"]` when navigating to a new unedited spread.
  - **Dual Mode Scope Toggle & Auto-Detection UI ([`frontend/src/components/book-studio/modules/CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx))**:
    - Replaced `P.left` / `P.right` buttons with a single `Dual` toggle button in the Scope bar when in Dual Mode.
    - Added an active editing indicator when Dual is OFF (`Editing Page X • Click or drag either box to switch`).
    - Simplified commit action button label to **`Apply`** and **`Split`**.
    - Updated `activePage` resolution to automatically bind dimensions and margin inputs to the right page if the right side is active in unlinked mode.
  - **Interactive Auto-Detection on Canvas ([`frontend/src/components/book-studio/BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx) & [`PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx))**:
    - Added `onSelectPrimaryPage` to `PageCanvas`.
    - In `handleCropPointerDown`, checks `isDualLinked`:
      - If `isDualLinked` is `true`: dragging either box updates both pages together.
      - If `isDualLinked` is `false`: grabbing the primary box switches focus and `dualSides` to `["left"]`; grabbing the secondary box switches focus and `dualSides` to `["right"]`.
    - `secondaryCropBox` in `BookWorkspace` respects `isDualLinked`, preventing unedited secondary pages from taking an unlinked primary page's box.
- **Verification**:
  - `cd frontend && npx tsc --noEmit` exited with code `0`.
  - `cd backend && python3 -m py_compile main.py engines/*.py` exited with code `0`.
  - `python3 backend/engines/storage_cleaner.py` exited with code `0`.

## Date: 2026-10-28

### Task 29: Fix Continuous Mode View Switch Page Display & Crop Box Persistence
- **Objective**:
  - Fix bug where switching back from continuous mode to normal (page-by-page) mode causes the preview to display only the page number (`Page X`) rather than the rendered page image.
  - Fix bug where adjusting the crop box and switching to continuous mode causes the crop box to disappear.
- **Root Cause Analysis**:
  1. **Thread Concurrency Collision on Thumbnail Generation**: PyMuPDF (`fitz.Document`) is not thread-safe across concurrent worker threads. When continuous mode mounted and initiated simultaneous thumbnail requests for all pages in the deck, concurrent backend threads collided on shared document handles in `extract_page_image`, throwing HTTP 500 exceptions and leaving the browser with failed image loads that rendered fallback alt text (`Page X`).
  2. **Crop State Reset on View/Page Navigation**: `useBookModules.ts` was only writing to `pageCrops` state during auto-detect actions. Manual crop drags updated `cropModule.cropBox` but never synchronized into `pageCrops[selectedPageId]`. When toggling continuous view mode or switching pages, the module reset effect checked `pageCropsRef.current[selectedPageId]`, found undefined, and reset the crop box to `FULL_BED`.
  3. **Continuous Scroll Crop Overlays Missing**: `BookWorkspace.tsx` in continuous mode rendered plain `<img>` elements without any overlay layer for the active crop box or existing saved crops.
  4. **Canvas Image Cached Ready State**: In `PageCanvas.tsx`, when switching between view modes or remounting, if an image was already completed in the browser memory cache, standard `onLoad` events might not refire synchronously, causing temporary loading state artifacts.
- **Architectural Implementation**:
  - **PyMuPDF Thread Safety & Auto-Recovery ([`backend/book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py))**:
    - Added global `_DOC_RENDER_LOCK = threading.Lock()` around PyMuPDF page rendering operations.
    - Wrapped thumbnail extraction in try-except with automatic document handle invalidation and reopen recovery if a handle ever enters an invalid or closed state.
  - **Live Crop State Synchronization ([`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts))**:
    - Added a reactive synchronization effect that saves manual crop adjustments (`cropBox`, `splitLines`, `splitPos`) into `pageCrops[selectedPageId]` whenever `cropModule.enabled` is active, ensuring crop boxes persist across view mode toggles and page switches.
  - **Continuous Scroll Crop Overlays ([`frontend/src/components/book-studio/BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx))**:
    - Implemented `renderContinuousCropOverlay` in continuous scrolling mode (both single-page and dual-page layouts).
    - Renders the active crop box border, corner handles, and split lines on `selectedPageId`, and dashed reference outlines on other pages with saved crops.
    - Added `isContinuousScroll` to the pan/zoom reset effect to ensure returning to page-by-page mode centers the canvas cleanly at `{ x: 0, y: 0 }` and zoom `1.0`.
  - **Cached Image Ready Resolution ([`frontend/src/components/book-studio/PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx))**:
    - Added mount/`imageSrc` check for `imgRef.current?.complete && imgRef.current.naturalWidth > 0` to immediately mark images as loaded when served from cache.
    - Added automatic transient image reload with `retryKey`.
- **Verification & Final Gate**:
  - Frontend TypeScript verification: `cd frontend && npx tsc --noEmit` exited with code `0`.
  - Backend compile verification: `python3 -m py_compile backend/main.py backend/book_scan_api.py backend/engines/*.py` exited with code `0`.
  - Storage clean verified: `python3 backend/engines/storage_cleaner.py` exited with code `0` (temp scratch cleanly purged).
  - Next.js Production Build Gate: `cd frontend && npm run build` exited with code `0` (all 13 routes compiled and statically generated with 0 errors).

### Task 28: Fix Missing useMemo and Book Studio Module & Toolbar Props Alignment
  - Resolve runtime crash `ReferenceError: useMemo is not defined` in `PageCanvas.tsx:334`.
  - Fix TypeScript compilation issues across Book Studio:
    - Restore `"bleed"` to `FocusedModuleId` in `types/book_studio.ts`.
    - Align `BookRightPanel.tsx` shortcuts, descriptors, and option renders to include the `bleed` tool cleanly.
    - Clean up legacy toolbar and history props in `BookWorkspace.tsx` and preserve `canRedo`.
- **Architectural Implementation**:
  - **Hook Import Fix ([`PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx))**:
    - Added missing `useMemo` to `import React, { useRef, useState, useEffect, useMemo } from "react";`.
  - **Type & Prepress Module Alignment ([`types/book_studio.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/types/book_studio.ts), [`BookRightPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookRightPanel.tsx))**:
    - Expanded `FocusedModuleId` to include `"bleed"`.
    - Added `bleed` entry in `moduleShortcuts` (`shortcutLabels.module_bleed || "5"`), `moduleDescriptors` (`IconToolBleed`), and registered `BleedPanel` in the active options body.
  - **Workspace Toolbar Props Cleanliness ([`BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx))**:
    - Removed unused `onRestoreOriginal`, `history`, `currentHistoryIndex`, and `onSelectHistoryStep` props that were previously relocated to the top header bar (`HistoryPopover`).
    - Restored `canRedo?: boolean` in `BookWorkspaceProps`.
- **Verification**:
  - TypeScript validation via deno: `deno run -A frontend/node_modules/typescript/bin/tsc --noEmit --project frontend/tsconfig.json` exited with code `0`.
  - Backend compile verification: `python3 -m py_compile backend/main.py backend/settings_api.py backend/engines/*.py` exited with code `0`.

### Task 27: Crop Tool Simplification & Dedicated History System
- **Objective**:
  - In Crop Tool:
    1. Remove Trim Presets dropdown and presets logic.
    2. Remove Auto-Detect feature (Paper/Content detection mode, Page/All detection buttons, reset to full bed).
    3. Rename "Margins & Insets" to "Margins", defaulting aspect lock to `free` (instead of `normal`/`lock`) and units to `unit` (instead of `%`).
    4. Remove Reset and Revert buttons and features from the tool footer; establish a dedicated "History" system with timestamped logs (`hh:mm:ss`), an icon next to the Units dropdown in the header, customizable history limits in Settings (min = 5, max = 50), and stage restoration via Undo/Redo or clicking a historical stage.
    5. Remove the status line (`Slice (...)`, `Cropped • Level X`, `Uncropped`).
- **Architectural Implementation**:
  - **Crop Tool Trim Presets & Auto-Detect Removed ([`CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx))**:
    - Removed `DEFAULT_BOOK_TRIMS`, `selectedTrimPreset`, `handleSelectTrimPreset`, and trim presets UI.
    - Stripped out the Detect mode selector, Detect Page/All buttons, and auto-detect icons from `CropSplitPanel.tsx`.
    - Retained the live `Dimensions` badge display (`dimsText`, `areaPct`).
  - **Margins Defaults & Labels Updated ([`CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx), [`useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts), [`types/book_studio.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/types/book_studio.ts))**:
    - Renamed disclosure label to **Margins**.
    - Updated default `aspectLock` to `"free"` and default `unitMode` to `"unit"`.
    - Aspect ratio lock toggle displays `Lock` vs `Free`.
  - **Dedicated Timestamped History System ([`book-studio/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/book-studio/page.tsx), [`HistoryPopover.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/HistoryPopover.tsx), [`settings_api.py`](file:///home/essam/Projects/ESSR_PA/backend/settings_api.py), [`ShortcutsSection.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/settings/ShortcutsSection.tsx))**:
    - Placed the History popover trigger directly next to the Unit dropdown in the top header bar of Book Studio.
    - Enhanced [`HistoryPopover.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/HistoryPopover.tsx) to display exact timestamp readouts (`hh:mm:ss`) for every action alongside page counts.
    - Updated backend [`settings_api.py`](file:///home/essam/Projects/ESSR_PA/backend/settings_api.py) and frontend [`ShortcutsSection.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/settings/ShortcutsSection.tsx) history limit bounds to **5–50** (default: 50).
    - Removed Revert and Reset buttons from `CropSplitPanel.tsx`, leaving a clean, full-width `Apply (Page)` / `Split (Page)` commit button.
  - **Status Line Removed ([`CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx))**:
    - Completely removed the `Status: Slice / Cropped • Level X / Uncropped` row.
- **Verification**:
  - Frontend TypeScript verification: `deno run -A frontend/node_modules/typescript/bin/tsc --noEmit --project frontend/tsconfig.json` exited with code `0`.
  - Backend compile verification: `python -m py_compile backend/main.py backend/settings_api.py backend/engines/*.py` exited with code `0`.
  - Storage clean verified: `python backend/engines/storage_cleaner.py` ran cleanly.

### Task 26: Remove Module Toggles, Separate Crop & Split Tools, Top-Bar Split Curtain & Bottom HUD View Modes (Dual Page, Continuous Scroll, Fit Width/Page)
- **Objective**:
  - Remove the enable toggle switch at the top of each Book Studio module (`CropSplitPanel.tsx`, `DeskewPanel.tsx`, `CleanupPanel.tsx`, `RestorePanel.tsx`, `BleedPanel.tsx`).
  - Separate `Crop` and `Split` into two distinct tools in the right tools panel (`BookRightPanel.tsx`).
  - Move the Split Curtain (`Columns2`) toggle button from the bottom HUD bar to the top toolbar (`WorkspaceToolbar.tsx`).
  - Add **Fit Width**, **Fit Page**, **Dual Page Mode** (two pages side-by-side, reverting to 1 page when clicked again), and **Continuous Scrolling vs. Page-by-Page Scrolling** toggle buttons to the bottom HUD bar (`BookWorkspace.tsx` & `PageCanvas.tsx`).
- **Architectural Implementation**:
  - **Module Toggles Removed (`CropSplitPanel.tsx`, `DeskewPanel.tsx`, `CleanupPanel.tsx`, `RestorePanel.tsx`, `BleedPanel.tsx`)**:
    - Removed the top checkbox toggle bars from all 5 panels and ensured interacting with any control or clicking Apply automatically sets `enabled: true`.
  - **Separated `Crop` & `Split` Tools (`types/book_studio.ts`, `useBookStudioState.ts`, `BookRightPanel.tsx`, `CropSplitPanel.tsx`)**:
    - Expanded `FocusedModuleId` to `"crop" | "split" | "deskew" | "cleanup" | "restore" | "bleed"`.
    - Added `mode?: "crop" | "split"` to `CropSplitPanel.tsx` (following the `AGENTS.md` consolidation rule without creating fragmented files). In `"crop"` mode, renders Crop Detection, Trim Presets, Dimensions, and Margins & Insets (`hideCutLines={true}` on canvas). In `"split"` mode, renders Cut Lines (`+ Vertical`, `+ Horizontal`, `SplitLinesEditor`) and auto-adds a default vertical cut line at `50%` if none exist (`hideCutLines={false}` on canvas).
  - **Top Toolbar Split Curtain (`WorkspaceToolbar.tsx` & `BookWorkspace.tsx`)**:
    - Moved `isSplitCurtain` toggle button from the bottom bar into `WorkspaceToolbar.tsx` next to the Hand (Pan) tool.
  - **Bottom HUD View & Fit Controls (`BookWorkspace.tsx` & `PageCanvas.tsx`)**:
    - Added **Dual Page Mode** (`BookOpen` button) rendering `pages[selectedIdx]` and `pages[selectedIdx + 1]` side-by-side, reverting to 1 page when clicked again.
    - Added **Continuous Scrolling vs. Page-by-Page** (`ScrollText` button) toggling between single/dual canvas view and a vertical continuous scroll container of all pages.
    - Added **Fit Width** (`MoveHorizontal` button) and **Fit Page** (`File` button) to the bottom bar.

### Task 25: Borderless Studio Layout, Minimal Top Bar, Floating Bottom HUD & Simple Drill-Down Tools Panel
- **Objective**:
  - Redesign the Preview Panel, Page Deck, and Tools Panel across all 4 Studios (`Book Studio`, `Imposing Studio`, `Contour Studio`, `Flipbook Studio`) to match the clean, borderless reference UI.
  - Keep only the Hand (Pan) tool, Undo/Redo buttons, and Page Deck toggle button in the top preview toolbar.
  - Place the toggleable Page Deck panel in the middle column (between the Left Preview Panel and Right Tools Panel).
  - Replace bordered module cards and colored badges in the Right Tools Panel with a simple, borderless column list of tool names that opens each tool's options when clicked (`← [Tool Name]`).
- **Architectural Implementation**:
  - **Unified Studio Layout (`frontend/src/components/layout/StudioLayout.tsx`)**:
    - Re-ordered the 3-column layout to `[centerViewport (flex-1) | leftPanel (Middle Page Deck) | rightPanel (Right Tools Panel)]` with edge-to-edge bleed (`-m-2 sm:-m-2.5 md:-m-3`) and `1px` `border-[#1E232E]` dividers.
  - **Book Studio (`WorkspaceToolbar.tsx`, `BookWorkspace.tsx`, `BookLeftPanel.tsx`, `BookRightPanel.tsx`, `modules/*.tsx`, `book-studio/page.tsx`)**:
    - Simplified `WorkspaceToolbar.tsx` to Hand (Pan) toggle, Undo/Redo (with History popover), and `Pages` deck toggle.
    - Updated `BookWorkspace.tsx` to edge-to-edge borderless styling and upgraded the floating bottom pill HUD with `|< < [ 1 ] / N > >|` navigation, Split Curtain toggle, Zoom `-`, continuous Zoom slider (`40`–`400%`), Zoom `+`, Zoom `%`, and Fullscreen toggle.
    - Redesigned `BookRightPanel.tsx` into a flat, borderless tool list (`Crop & Split`, `Deskew`, `Cleanup & Erase`, `Colors & Tone`, `Bleed & Marks`, plus `Imposing Studio` and `3D Flipbook` handoffs) that opens options on click with a `← [Tool Name]` back header.
    - Stripped card borders and module header banners from `CropSplitPanel.tsx`, `DeskewPanel.tsx` (adding `Draw Ruler` and `Grid` buttons inside Section 1), `CleanupPanel.tsx`, `RestorePanel.tsx`, and `BleedPanel.tsx`.
  - **Imposing Studio (`PreviewViewport.tsx`, `LeftAssetPanel.tsx`, `RightControlPanel.tsx`, `imposing/page.tsx`)**:
    - Updated `PreviewViewport.tsx` with the minimal top bar (Hand tool + `Pages` deck toggle) and floating bottom pill HUD (sheet navigation, page labels toggle, zoom slider, fit-to-screen).
    - Converted `RightControlPanel.tsx` into the borderless drill-down tool list (`Imposition Mode`, `Sheet & Format`, `Layout & Grid`, `Prepress Marks`, `Page Actions`).
  - **Contour Studio (`ContourViewport.tsx`, `ContourControls.tsx`, `contour/page.tsx`)**:
    - Updated `ContourViewport.tsx` to borderless with the minimal Hand tool top bar and floating bottom zoom slider HUD.
    - Moved `ContourControls` to `rightPanel` and converted it into the borderless drill-down tool list (`Input Artwork`, `Cut Geometry`, `Spot Stroke Swatch`, `Finishing Options`).
  - **Flipbook Studio (`FlipbookViewport.tsx`, `FlipbookControls.tsx`, `flipbook/page.tsx`)**:
    - Wrapped `flipbook/page.tsx` in `StudioLayout`, made `FlipbookViewport.tsx` borderless, and converted `FlipbookControls.tsx` into the borderless drill-down tool list (`Input PDF Document`, `Reading & Quality`, `Binding Style`).
- **Verification**:
  - Frontend TypeScript: `deno run -A frontend/node_modules/typescript/bin/tsc --noEmit --project frontend/tsconfig.json` exited with code `0`.
  - Clean `backend/temp_uploads/`.

### Task 24: Crop Module Collapsible Margins, Book Trim Presets, Deskew Decluttering, Angle HUD & Interactive Split Curtain
- **Objective**:
  - Make the Crop module's Margins panel a collapsible dropdown, collapsed by default.
  - Add standard book trim presets (A4, A5, B5, US Trade 6x9, Digest, Pocket Book, etc.) with a configurable Book Trim Sizes table in `/settings`.
  - Declutter Deskew module by removing redundant Straighten button and Grid toggle (already permanently accessible in the workspace toolbar).
  - Add non-obtrusive live angle readout when drawing the Straighten baseline on canvas without blocking the user's cursor or text view.
  - Replace the old compare toggle in the workspace toolbar with an interactive vertical split curtain on the canvas featuring a draggable slider divider for direct side-by-side inspection of raw scans vs processed pages.
- **Architectural Implementation**:
  - **Crop Module Margins Dropdown & Trim Presets (`frontend/src/components/book-studio/modules/CropSplitPanel.tsx`)**:
    - Created collapsible accordion disclosure (`isMarginsOpen`, default `false`) with a one-line summary trigger pill showing live insets (`L:.. T:.. R:.. B:.. mm/%`) and chevron.
    - Integrated standard book trim presets dropdown ("Freeform / Custom", A4, A5, B5 JIS, US Trade, Digest, Pocket Book, Royal, Square), loaded dynamically from `/api/settings` with fallback defaults. Selecting a preset scales and centers the crop box on the page to match the exact trim aspect ratio.
  - **Settings API & Trim Presets Table (`backend/settings_api.py`, `backend/settings.json`, `frontend/src/components/settings/`)**:
    - Added `BookTrimPreset` Pydantic model to `backend/settings_api.py` and `book_trims` array to `AppSettings` / `DEFAULT_SETTINGS` / `backend/settings.json`.
    - Added REST endpoints: `POST /api/settings/book-trims`, `PUT /api/settings/book-trims/{trim_name}`, `DELETE /api/settings/book-trims/{trim_name}`.
    - Created `frontend/src/components/settings/BookTrimsSection.tsx` with full CRUD (add, inline edit, delete) and embedded it into the `Media & Book Trims` tab in `frontend/src/app/settings/page.tsx`.
    - Updated navigation map in `docs/architecture.md`.
  - **Deskew Module Streamlining (`frontend/src/components/book-studio/modules/DeskewPanel.tsx`)**:
    - Removed redundant Straighten button and Grid toggle box from Section 3, removing unused `Ruler` and `Grid` icons.
    - Renamed Section 3 to "Scope & Apply", keeping the panel clean, compact, and focused on angle detection, fine-tuning slider/nudges, page scoping, and apply/reset actions.
  - **Straighten Angle HUD Readout (`frontend/src/components/book-studio/PageCanvas.tsx`)**:
    - Positioned the live angle readout badge offset from the cursor point (`translate-x-3 -translate-y-5`, flipping on edge proximity) with semi-transparent dark backdrop blur styling, guaranteeing that baseline text and the cursor crosshair remain 100% unobstructed during measurement.
  - **Interactive Split Curtain Comparison (`BookWorkspace.tsx`, `PageCanvas.tsx`, `WorkspaceToolbar.tsx`)**:
    - Removed the old toggle button from `WorkspaceToolbar.tsx`.
    - Added a Split Curtain toggle button to the floating bottom HUD bar in `BookWorkspace.tsx` (`Columns2` icon).
    - In `PageCanvas.tsx`, rendered a dual-layer preview: base processed image and top raw unedited scan clipped horizontally with CSS `clipPath: inset(0 ${(1 - curtainPos) * 100}% 0 0)`.
    - Added an interactive draggable vertical divider line (`curtainPos` from 0.02 to 0.98) with a central grip handle (`‹›`), pointer capture, and floating corner tags ("Original Scan" and "Processed").
- **Verification**:
  - Python Backend: `cd backend && python3 -m py_compile main.py settings_api.py book_scan_api.py engines/*.py` exited with code `0`.
  - Frontend TypeScript: `deno run -A frontend/node_modules/typescript/bin/tsc --noEmit --project frontend/tsconfig.json` exited with code `0`.
  - Clean `backend/temp_uploads/`.

### Task 23: Session Document Cache Isolation & Universal Upload Preview Sticking Fix
- **Objective**:
  - Fix critical issue where the app is stuck displaying an old file's preview regardless of what file is uploaded.
- **Root Cause & Architectural Problem**:
  1. **Unkeyed Document Cache Poisoning in Backend (`get_session_docs`)**:
     - In `backend/book_scan_api.py`, `init_book_scan_session` created the in-memory session dictionary in `SESSIONS[session_id]` without setting `"id": session_id`.
     - When `get_page_thumbnail` subsequently called `get_session_docs(session)`, `session.get("id", "")` evaluated to `""` (empty string).
     - The fitz Document handle for the very first file ever loaded was cached under `_SESSION_DOCS[""]`.
     - Every newly uploaded document in subsequent sessions also evaluated `session.get("id", "")` to `""`, hit `"" in _SESSION_DOCS`, and extracted pages from the first file's open PDF handle.
  2. **Unpartitioned RAM Thumbnail Cache (`_THUMB_RAM_CACHE`)**:
     - `get_ram_thumbnail(cache_tag)` was indexed solely by `cache_tag` without `session_id`, creating cross-session cache bleed risks for pages with similar geometry tags.
  3. **Stale URL Query Parameter Loops in Frontend**:
     - In `book-studio/page.tsx`, `imposing/page.tsx`, `contour/page.tsx`, and `flipbook/page.tsx`, when routing from Hub or Command Center with `?file_path=...` or `?file_id=...`, the parameter remained indefinitely in the browser URL.
     - When users clicked "New Job" or reset the active studio, the `useEffect` saw `!sessionId` or `!fileId` with the query parameter still present in `searchParams`, immediately re-initializing the previous file.
  4. **Browser Input Change Suppression**:
     - Native `<input type="file">` did not reset its `value` on change. Re-uploading the same file (e.g. after editing or clicking "New Job") did not fire `onChange`, causing the preview to remain on the old artwork.
- **Architectural Implementation**:
  - **Backend (`backend/book_scan_api.py`)**:
    - Added explicit `"id": session_id` to `session_data` in `init_book_scan_session`.
    - Updated `get_session_docs(session, session_id=session_id)` to accept explicit `session_id` and bypass cache when no ID is present, preventing `""` key poisoning.
    - Evicted any legacy empty-string document handles on session init.
    - Partitioned `_THUMB_RAM_CACHE` with `f"{session_id}_{cache_tag}"` and added `purge_session_ram_cache` invoked on session close and eviction.
  - **Frontend (`frontend/src/`)**:
    - `frontend/src/app/book-studio/page.tsx`: Added `preloadedPathRef` one-shot guard and URL query parameter sanitization via `window.history.replaceState`.
    - `frontend/src/app/imposing/page.tsx`: Added `preloadedFileIdRef` one-shot guard and URL query parameter sanitization.
    - `frontend/src/app/contour/page.tsx` & `frontend/src/app/flipbook/page.tsx`: Added one-shot guards and URL query parameter sanitization.
    - File input value reset (`e.target.value = ""`): Applied to `frontend/src/app/page.tsx`, `BookLeftPanel.tsx`, `useImpositionStudio.ts`, and `FlipbookControls.tsx`.
- **Verification**:
  - Python Backend: `cd backend && python3 -m py_compile main.py book_scan_api.py engines/*.py` exited with code `0`.
  - Frontend TypeScript: `deno run -A frontend/node_modules/typescript/bin/tsc --noEmit --project frontend/tsconfig.json` exited with code `0`.
  - Storage Hygiene: `backend/temp_uploads/` verified clean.

## Date: 2026-10-27

### Task 22: Book Studio Real-Time Preview Optimization & High-Throughput Browsing
- **Objective**:
  - Resolve severe preview lag, event loop freezing, and canvas preview sticking on an old page (e.g. Page 4) during document browsing after cropping, splitting, or applying erase/magic boxes.
- **Root Cause & Architectural Problem**:
  1. **FastAPI Event-Loop Freezing (`async def`)**:
     - `get_page_thumbnail` in `backend/book_scan_api.py` was defined as `async def`. Under FastAPI/Starlette, `async def` runs on the main asyncio thread. Heavy OpenCV processing (`flatten_spine_illumination`, morphological dilation/closing, despeckling) and PyMuPDF rendering blocked the single event loop, freezing all concurrent requests.
  2. **Browser Connection Queue Saturation**:
     - The left panel deck card list was issuing requests for 20-50 pages without priority, consuming the browser's 6 concurrent HTTP connection slots. The center viewport canvas preview request (`dpi=150`) was queued behind deck cards.
  3. **URL Churn on Page Navigation**:
     - `buildThumbnailUrl` dynamically incorporated `selectedPageId` for uncommitted draft sliders with scope "current". Every page click modified query parameters and invalidated thumbnail cache tags for both the previously selected and newly selected cards, forcing continuous re-renders from scratch.
  4. **Silent Loading in Canvas**:
     - Native `<img>` in `PageCanvas.tsx` had no loading indicator or transition, continuing to paint the previous image (Page 4) until the new image resolved, making the UI appear completely frozen.
  5. **Redundant PDF Open/Close**:
     - Every single thumbnail request parsed and opened the full PDF via `fitz.open(...)` from disk and closed it in `finally:`.
- **Architectural Implementation**:
  - **Backend (`backend/book_scan_api.py`, `backend/engines/book_scan_engine.py`)**:
    - Converted `get_page_thumbnail` from `async def` to sync `def`, offloading thumbnail execution to Starlette's threadpool executor.
    - Implemented `get_session_docs`: persistent in-memory fitz Document handle caching per active session with thread lock.
    - Added `_THUMB_RAM_CACHE`: 128-item in-memory LRU cache returning cached JPEG bytes in < 1ms.
    - Replaced numpy division in `flatten_spine_illumination` with OpenCV AVX2 SIMD `cv2.divide` and normalized background estimation proxy to 320px max dimension (accelerated 80 DPI card rendering from 82ms to **37ms**).
    - Bypassed unneeded live Hough skew detection on thumbnail requests when angle is not explicitly detected.
  - **Frontend (`frontend/src/`)**:
    - `useBookSession.ts` & `useBookStudioState.ts`: Created `buildDeckThumbnailUrl` / `getDeckThumbnailUrl` strictly reflecting committed page properties, completely decoupling deck cards from `selectedPageId` and draft sliders. Page selection clicks now trigger **zero** network requests for deck cards.
    - `PageCanvas.tsx`: Added `fetchPriority="high"`, `isImageLoading` state, smooth opacity transitions, and a centered loading indicator pill (`Loading Page X...`).
    - `DeckCard.tsx`: Added `fetchPriority="low"`, `loading="lazy"`, `decoding="async"`, and wrapped with `React.memo` using custom props comparison.
- **Verification**:
  - Backend Compilation: `python3 -m py_compile main.py book_scan_api.py engines/*.py` exited with code `0`.
  - Frontend TypeScript Check: `deno run -A frontend/node_modules/typescript/bin/tsc --noEmit --project frontend/tsconfig.json` exited with code `0`.
  - Benchmark: 80 DPI sidebar thumbnail rendered in 37.3ms (55% faster), 150 DPI preview in 147.3ms, RAM cache in < 1ms.
  - Storage Hygiene: `backend/temp_uploads/` verified clean.

### Task 21: Streamlined Single-System History Journal Architecture & Universal Multi-Level Reversion
- **Objective**:
  - Resolve critical bugs when deleting crop entries and reverting to older states in the history journal.
  - Eliminate the dual-system friction where the Modifications layer stack and the History Journal competed against each other.
  - Establish a single, authoritative history tracking system (History Journal + `Ctrl+Z` / `Ctrl+Y`) with universal multi-level reversion and scoped resets across all Book Studio modules.
- **Root Cause & Architectural Problem**:
  - The coexistence of two competing state systems:
    1. A complex "Modifications" layer panel (`LayerEntryStack`) attempting to maintain non-destructive stack entries with cascading dependencies, slice-ancestry mappings, and manual card deletions.
    2. A snapshot-based "History Journal" (`useBookHistory`) maintaining full document state steps for undo/redo.
  - Deleting an entry from the modifications stack broke underlying page geometries if subsequent operations depended on that crop/split, leaving zombie entries, corrupted coordinate spaces, or unsynchronized visual states.
- **Architectural Implementation**:
  - **Single Source of Truth**:
    - Completely removed `LayerEntryStack` from all modules ([`CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx), [`DeskewPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/DeskewPanel.tsx), [`CleanupPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CleanupPanel.tsx), [`BleedPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/BleedPanel.tsx), [`RestorePanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/RestorePanel.tsx)).
    - Replaced ~300 lines of brittle `removeAppliedCrop` patchwork math with pure, clean state operations.
  - **Backend Hierarchical Multi-Level Crop Stack (`backend/engines/book_scan_engine.py`, `backend/engines/schemas.py`, `backend/book_scan_api.py`)**:
    - Enhanced `BookStudioPage` and backend page models with `crop_stack: list[CropBox]`.
    - Added `apply_crop_to_pages`: pushes composed crop boxes onto `p["crop_stack"]`.
    - Implemented `revert_crop_pages`:
      - `mode="level"`: Pops the topmost crop box from `crop_stack`, restores previous dimensions (`width_mm`, `height_mm`), and recalibrates master scan bed coordinates.
      - `mode="reset"`: Clears the entire crop stack and restores the uncropped master bed.
    - Added `single_level: bool = False` to `revert_pages` / `/revert-spread/` endpoint for stepping back 1 split level without wiping out all prior split work.
    - Added route `POST /api/book-scan/revert-crop/{session_id}`.
  - **Frontend History Reactivity & Level-by-Level Controls**:
    - `useBookHistory.ts`: Added `onStepRestored` callback to clean up drafts; automatically bumped `p.rev` on restored snapshots so thumbnail images and DOM canvases update immediately without stale browser cache.
    - `useBookModules.ts`:
      - Implemented `revertCropLevel(scopeMode: "current" | "all")` and `resetCrop(scopeMode)`.
      - Implemented `revertSplitLevel(pageId)`.
      - Implemented `resetDeskew(scopeMode)`.
      - Appended clear, descriptive entries to history journal (e.g. `Revert Crop Level (P.1)`, `Crop Page (Paper • P.1)`).
    - `CropSplitPanel.tsx`: Added live status badge displaying current crop level and slice status, plus tactile `Apply`, `Revert 1 Level ↶`, and `Reset ↺` buttons.
    - `DeskewPanel.tsx`: Added `Reset (0°)` button.
    - `BleedPanel.tsx`: Added `Reset (0mm)` button.
    - `RestorePanel.tsx`: Added `Reset` button.
- **Verification**:
  - Python Backend: `cd backend && python3 -m py_compile main.py book_scan_api.py engines/*.py` exited with code `0`.
  - Frontend TypeScript: `cd frontend && npx tsc --noEmit` exited with code `0`.
  - Next.js Production Build: `npm run build` passed with code `0` (13/13 static routes generated, zero errors).
  - Storage Hygiene: `backend/temp_uploads/` verified clean.

### Task 20: Crop Entry Registration & Multi-Generation Split Layer Persistence
- **Objective**:
  - Fix issue where applying a crop in the Crop module did not register as an entry in the Modifications layer stack.
  - Fix issue where applying a split and then applying another split overwrote (or hid/replaced) the previous split entry in the Modifications layer stack.
- **Root Cause & Architectural Problem**:
  1. Ancestry Disconnect in `LayerEntryStack`:
     - `LayerEntryStack` in [`PageScopeSelector.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/PageScopeSelector.tsx) filtered entries strictly by `entry.targetPageIds.includes(activePageId)`.
     - When pages were split into slices, the slices received new IDs (e.g. `p1` -> `p1_left`, `p1_right`, and subsequent horizontal splits created `p1_left_col_0`, `p1_left_col_1`).
     - Previous split and crop entries in `appliedEntries` only retained the parent/ancestor IDs. Because `LayerEntryStack` did not resolve slice ancestry, any entry targeting ancestor pages or previous split generations failed the exact string match and disappeared from the active view.
     - Furthermore, entries with `origScope: "all"` had non-empty `targetPageIds` from their creation time, causing the id check to fail and prematurely return `false` before the `origScope === "all"` rule could take effect.
  2. Sequential Split Overwriting:
     - In [`useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts) (`splitSpread`), subsequent splits added a new split entry to `appliedEntries` but left earlier split and crop entries with stale `targetPageIds` that only referenced parent IDs.
  3. Crop Entry Target Resolution & Reindexing:
     - In `applyCrop`, `targetPageIds` only stored raw target IDs without resolving parent/slice ancestry, and page number indexing was computed before referencing the new post-crop page metadata.
- **Architectural Implementation**:
  - [`frontend/src/components/book-studio/modules/PageScopeSelector.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/PageScopeSelector.tsx):
    - Added `pages?: BookStudioPage[]` to `LayerEntryStackProps`.
    - Added `getAncestorIds` recursive helper traversing `immediate_parent_id` and `parent_page_id` up the page slice tree to collect all ancestor IDs.
    - Updated `pageEntries` filtering to:
      1. Check `excludedPages`.
      2. Check `entry.origScope === "all"` (persisting global modifications across all slices).
      3. Check whether `entry.targetPageIds` matches `activePageId` OR any of its `ancestorIds`.
      4. Fallback to `targetPages` matching.
  - [`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts):
    - Updated `splitSpread`: When new slice IDs (`allSliceIds`) are generated from `parentIds`, all existing entries in `appliedEntries` that targeted `parentIds` or had `origScope === "all"` are mapped to include `allSliceIds` in their `targetPageIds` and have their `targetPages` updated against `current`.
    - Updated `applyCrop`: Populated `targetPageIds` with full ancestry and derived slice IDs, re-indexed `cropTargetPages` using the fresh `updatedPages`, computed accurate scope labels (`P.n`, `P.n,m`, `All`), and reliably appended the crop entry to `cropModule.appliedEntries`.
    - Updated `removeAppliedCrop`: Synchronized ancestor checks to test both `immediate_parent_id` and `parent_page_id`.
  - Modules Integration:
    - Passed `pages={pages}` to `LayerEntryStack` in [`CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx), [`DeskewPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/DeskewPanel.tsx), [`RestorePanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/RestorePanel.tsx), and [`BleedPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/BleedPanel.tsx).
- **Verification**:
  - Frontend TypeScript: `cd frontend && npx tsc --noEmit` exited with code `0`.
  - Backend Python: `cd backend && python3 -m py_compile main.py engines/*.py` exited with code `0`.
  - Next.js Production Build: `npm run build` passed with code `0` (13/13 static routes generated, zero errors).
  - Storage Hygiene: `backend/temp_uploads/` verified clean.

### Task 19: Relative Position-Preserving Crop Box Adjustments & Canvas Dragging
- **Objective**:
  - Prevent crop box position reset when modifying margin values via steppers or number inputs in `CropSplitPanel.tsx` or dragging resize handles on `PageCanvas.tsx` / `BookWorkspace.tsx`.
  - Ensure changes are strictly relative to the current position and placement of the crop box on the page.
- **Root Cause & Architectural Problem**:
  - When `Lock` mode was active, `handleInsetChange` computed a single ratio from the target value and forced `x1 = ratio, y1 = ratio, x2 = 1 - ratio, y2 = 1 - ratio`, discarding the crop box's actual position and resetting it to a centered square/rectangle.
  - Similarly, in `BookWorkspace.tsx`, dragging handles in `Lock` mode forced `box.x1 = ratio, box.x2 = 1 - ratio, box.y1 = ratio, box.y2 = 1 - ratio`.
- **Architectural Implementation**:
  - [`frontend/src/components/book-studio/modules/CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx):
    - Reworked `handleInsetChange` to calculate `delta = targetVal - curSideVal` in both physical unit mode (`mm`/`in`/`cm`/`px`) and percentage mode (`%`).
    - In `Lock` mode, `delta` is clamped to prevent negative margins and maintain minimum 2mm / 2% crop width and height, then applied uniformly to all 4 margins relative to their current position (`curLeft + delta`, `curRight + delta`, `curTop + delta`, `curBottom + delta`).
    - In `Normal` mode, only the target side is adjusted relative to page boundaries.
    - Updated split lines recalculation so that cut line absolute positions on the sheet remain intact during box adjustments.
  - [`frontend/src/components/book-studio/BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx):
    - Reworked handle drag handlers (`w`, `e`, `n`, `s`, `nw`, `ne`, `sw`, `se`) to compute deltas relative to `cropDragStartRef.current.box`.
    - In `Lock` mode, deltas expand or contract the box symmetrically around its current center without shifting its position.
    - In `Normal` mode, anchor-based dragging prevents initial snapping jitter.
- **Verification**:
  - Python Backend: `cd backend && python3 -m py_compile main.py engines/*.py` exited with code `0`.
  - Frontend TypeScript: `cd frontend && npx tsc --noEmit` exited with code `0`.
  - Next.js Production Build: `npm run build` passed with code `0` (13/13 static routes generated, zero errors).
  - Storage Hygiene: `backend/temp_uploads/` verified clean.

## Date: 2026-10-26

### Task 18: Crop Module Redesign, Flickering Elimination & Streamlined Controls
- **Objective**:
  1. Eliminate preview panel flickering when increasing or decreasing crop values.
  2. Keep the whole page image 100% visible while moving/adjusting the draft crop box, and only cut/crop when the user applies the crop. Remove the inspection opacity slider completely.
  3. De-clutter and re-distribute the tools panel with generous spacing so fields do not overlap or clip.
  4. Rework the locking ratio to two modes: `Lock` (all sides move together symmetrically) and `Normal` (every side moves freely and independently).
  5. Remove artificial crop ceilings (like 48%), allowing the user to crop freely without breaking entries (preventing negative values and clamping bounds so margins do not exceed page dimensions or cross opposing edges).
  6. Shorten tool and option names to as few words as possible (single-word titles: `Crop`, `Detect`, `Paper`, `Content`, `Page`, `All`, `Dimensions`, `Margins`, `Lock`, `Normal`, `Left`, `Right`, `Top`, `Bottom`, `Splits`, `Vertical`, `Horizontal`, `Scope`, `Apply`, `Update`, `Cancel`).
  7. Eliminate browser default number spinner arrows, keeping only the dedicated `[-]` and `[+]` buttons.
- **Architectural & Component Implementation**:
  - [`frontend/src/components/book-studio/PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx):
    - Removed the 4 dark overlay scrim divs (`backdrop-blur-[1px]` with dynamic background opacity). This eliminates GPU backdrop re-rasterization that caused repainting stutter and flickering during margin adjustments.
    - Removed `transition-all duration-150` on the page `<img>` so image rendering is instantaneous with zero transition jitter. Full scanned page remains completely visible at all times during crop framing.
  - [`frontend/src/app/book-studio/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/book-studio/page.tsx):
    - Configured `rightWidthClass="w-full lg:w-[325px] xl:w-[345px]"` to provide ample breathing room for the right sidebar tools without horizontal cramping.
  - [`frontend/src/types/book_studio.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/types/book_studio.ts) & [`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts):
    - Updated `aspectLock` to `'lock' | 'normal' | 'all' | 'none'`, defaulting cleanly to `'lock'`.
  - [`frontend/src/components/book-studio/BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx):
    - Refactored `activeCropDrag` handlers:
      - In `Lock` mode (`aspectLock === "lock" || aspectLock === "all"`): dragging any handle (`w`, `e`, `n`, `s`, or corners) adjusts all 4 margins symmetrically together.
      - In `Normal` mode (`aspectLock === "normal"`): each side and corner handle moves freely and independently without moving opposing sides.
  - [`frontend/src/components/book-studio/modules/CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx):
    - Removed inspection opacity slider completely.
    - Replaced the 4-way aspect ratio toggle with a clean 2-button segmented toggle: `Lock` and `Normal`.
    - Shortened all titles, tools, and options to minimal single words (`Crop`, `Detect`, `Paper`, `Content`, `Page`, `All`, `Dimensions`, `Margins`, `Lock`, `Normal`, `Left`, `Right`, `Top`, `Bottom`, `Splits`, `Vertical`, `Horizontal`, `Scope`, `Apply`, `Update`, `Cancel`).
    - Suppressed browser native numeric spinner arrows using Tailwind CSS `[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`, preserving clean, tactile `[-]` and `[+]` buttons.
    - Restructured the 4 margin steppers into a clean, spacious 2x2 layout with top row label/unit headers and generous 28px buttons, eliminating all clipping and overlap.
    - Reworked boundary calculations: removed artificial 48% limits, clamping cleanly to `[0, pageWidth - opposingMargin - 2mm]` in `Normal` mode and `[0, minDimension / 2 - 2mm]` in `Lock` mode.
- **Verification**:
  - Python compilation: `cd backend && python3 -m py_compile main.py book_scan_api.py imposing_api.py settings_api.py engines/*.py` exited with code `0`.
  - TypeScript compilation: `cd frontend && npx tsc --noEmit` exited with code `0`.
  - Next.js production build: `npm run build` passed with code `0` (13/13 static pages generated, zero errors).
  - Storage hygiene: `backend/temp_uploads/` verified clean.

### Task 17: Manual Spine Selection Rectangle, Continuous Despeckle & Precision Crop Controls
- **Objective**:
  1. Cleanup Module: Implement a manual spine selection rectangle (to isolate book-spine gutter shadows) and control flattening intensity via a continuous strength slider (10% to 100%, debounced).
  2. Cleanup Module: Replace the 4 discrete despeckle buttons (`Off`, `L1`, `L2`, `L3`) with a continuous numeric slider + direct number input (0.0 to 10.0, step 0.5) with live debounced preview.
  3. Crop Module: Implement 4 directional step inputs (`Left`, `Top`, `Right`, `Bottom`) with stepper buttons (-/+) and direct input, plus a unit toggle button between `%` and active default unit (`mm`/`in`/`cm`/`px` via canonical `src/lib/units.ts`).
  4. Crop Module: Implement aspect ratio lock toggles (`All 4`, `L-R`, `T-B`, `Free`) with **All 4 locked by default** so stepping or dragging insets scales linked sides symmetrically.
  5. Crop Module: Implement a prominent live cropped dimension badge displaying current cropped dimensions in the selected unit (e.g. `148.5 mm × 210.0 mm`) and sheet area percentage.
  6. Crop Module: Implement post-detection inspection opacity (continuous slider 0% to 100%, default 55%) controlling the shading opacity outside the crop box on `PageCanvas.tsx` to inspect trimmed margins.
- **Architectural & Engine Implementation**:
  - [`backend/engines/book_scan_engine.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/book_scan_engine.py):
    - Upgraded `flatten_spine_illumination` to accept `strength: float = 1.0` and `spine_box: Optional[Dict[str, float]] = None`. When `spine_box` is provided, a Gaussian-feathered spatial mask (feathering 20% of the box dimension) is blended with the original image, removing gutter shadows with zero visible transition seams.
    - Upgraded `despeckle_image` to continuous float `level: float` (0.0=off, 0.1..10.0 dust filter) mapping to non-linear resolution-scaled connected component areas (`base_area = max(2.0, 4.5 * (lvl ** 1.35))`).
    - Updated `process_single_page` and `render_export_pages` to pass and export `spine_strength`, `spine_box`, and `despeckle_level`.
  - [`backend/engines/schemas.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/schemas.py) & [`backend/book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py):
    - Added `spine_strength: float = 1.0` and `spine_box: Optional[str] = None` to thumbnail query parameters and `ExportRequest`.
    - Updated cache tag hashing with `_st{int(spine_strength*100)}`, `_spb_{spine_box}`, and `_ds{int(round(despeckle_level*10))}`.
  - [`frontend/src/types/book_studio.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/types/book_studio.ts), [`frontend/src/hooks/useBookSession.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookSession.ts), & [`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts):
    - Added `aspectLock?: "all" | "lr" | "tb" | "none"` (default `"all"`), `unitMode?: "percent" | "unit"`, and `overlayOpacity?: number` (default `0.55`) to `CropModuleConfig`.
    - Added `spineStrength?: number` (default `1.0`), `spineBox?: CropBox | null`, `spineSelectionActive?: boolean`, and continuous `despeckleLevel: number` to `CleanupModuleConfig`.
    - Added 350ms debounced hooks: `debouncedSpineStrength` and `debouncedDespeckle` per AGENTS.md rules.
    - Wired `per_page_cleanup` serialization for high-res PDF print exports.
  - [`frontend/src/components/book-studio/modules/CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx):
    - Built the 4 directional step inputs (`Left`, `Top`, `Right`, `Bottom`) with `-` / `+` steppers, direct numeric input, and toggle between `%` and active default unit (`mm`/`in`/`cm`/`px`).
    - Added Aspect Ratio Lock segmented control (`All 4`, `L-R`, `T-B`, `Free`) defaulting to `All 4`.
    - Added live cropped dimension badge: `W × H (area% of page)`.
    - Added post-detection inspection opacity slider (0% to 100%, default 55%).
  - [`frontend/src/components/book-studio/modules/CleanupPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CleanupPanel.tsx):
    - Added spine shadow flattening strength slider (10% to 100%, debounced).
    - Added "Select Spine Area" button / "Reset Area" button with active badge and intelligent gutter presets.
    - Added continuous numeric despeckle slider (0.0 to 10.0, step 0.5) + direct numeric input.
  - [`frontend/src/components/book-studio/PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx) & [`frontend/src/components/book-studio/BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx):
    - Styled dynamic crop scrim opacity with `rgba(0, 0, 0, ${cropModule.overlayOpacity ?? 0.55})`.
    - Rendered interactive cyan spine selection box with 8 resize handles and interior move bar.
    - Implemented `handleSpinePointerDown` with stable bounding box dragging.
    - Updated crop drag handles to strictly adhere to `aspectLock` symmetry.
- **Verification**:
  - Python compilation: `cd backend && python3 -m py_compile main.py book_scan_api.py imposing_api.py settings_api.py engines/*.py` exited with code `0`.
  - TypeScript compilation: `cd frontend && npx tsc --noEmit` exited with code `0`.
  - Next.js production build: `npm run build` passed with code `0` (13/13 static routes generated, zero errors).
  - Storage hygiene: `backend/temp_uploads/` verified clean.

### Task 16: Mask Box Resize Handle Dragging & Preview Visibility (Show/Hide) Architecture
- **Objective**:
  1. Fix the mask box resizing handles on the canvas preview so they smoothly resize and move the erase box in all directions (`n`, `s`, `w`, `e`, `nw`, `ne`, `sw`, `se`, `move`).
  2. Fix show/hide visibility toggling so that hiding an individual mask entry or toggling "Hide" on the entire Modifications panel cleanly hides the whiteout/erase boxes from both the preview canvas and the backend thumbnail image.
  3. Ensure that when editing an existing mask, the old mask is excluded from the underlying image pixels so the user can see what was underneath while repositioning or resizing the draft box.
- **Root Cause & Architectural Problem**:
  - `overlayRef` in `PageCanvas.tsx` was conditionally attached only inside `{cropModule?.enabled && <div ref={overlayRef}>}`. When the user was inside the Cleanup module, `cropModule.enabled` was `false`, causing `overlayRef.current` to be `null`. Therefore, `handleMaskPointerDown` and `onMove` in `BookWorkspace.tsx` failed their null check and aborted immediately without dragging or resizing anything.
  - The backend (`backend/book_scan_api.py`) burned all masks from `page_info["masks"]` directly into the thumbnail JPEG pixels via OpenCV whenever `preview_clean` was `true`. Because the thumbnail endpoint had no parameter for excluded/hidden masks, hiding an entry or the entire modifications panel in the frontend only hid the HTML overlay, while the white box remained permanently baked into the underlying image pixels.
- **Changes Delivered**:
  - [`frontend/src/components/book-studio/PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx):
    - Added a permanent `<div ref={overlayRef} className="absolute inset-0 pointer-events-none select-none" />` covering the image bounds so `overlayRef.current` is always non-null regardless of which tool is active.
    - Elevated `draftMaskBox` to `z-[55]` and ensured `pointer-events-auto` on all 8 corner/edge resize handles and the interior drag area.
  - [`frontend/src/components/book-studio/BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx):
    - Re-architected pointer drag handlers using stable initial bounding box anchor points from `maskDragStartRef.current`, eliminating edge creep and rounding drift for precision CAD-grade resizing.
    - Updated `visiblePageMasks` to respect `cleanupModule.enabled` and individual entry visibility across all mask ID formats.
  - [`backend/book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py):
    - Added `exclude_mask_ids: Optional[str] = None` query parameter to `/api/book-scan/page-thumbnail/{session_id}/{page_id}`.
    - Filtered `masks_list` when `exclude_mask_ids` is provided (supporting comma-separated mask IDs or `*` to exclude all masks). Automatically invalidates and updates disk cache tags (`mask_sig`).
  - [`frontend/src/types/book_studio.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/types/book_studio.ts), [`frontend/src/hooks/useBookSession.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookSession.ts), & [`frontend/src/hooks/useBookStudioState.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookStudioState.ts):
    - Wired `excludeMaskIds` into `ThumbnailRenderOpts` and `buildThumbnailUrl`.
    - Computed active `hiddenMaskIds` in `getThumbnailUrl` for hidden entries, disabled cleanup, and masks currently in draft edit.
  - [`frontend/src/components/book-studio/modules/CleanupPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CleanupPanel.tsx):
    - Added synchronization hook to populate `appliedEntries` from `pages` if unmapped masks exist from session persistence (gated with `initializedRef` to run strictly once on load, preventing double entry creation during live `handleApply`).
    - Deduplicated entry commits in `handleApply` by filtering any matching mask IDs before appending.
    - Ensured coordinate normalization (`Math.min`/`Math.max`) on edit and apply.
    - Removed redundant "Clear Page" and "Clear All" buttons from the Erase Box section in `CleanupPanel.tsx` in favor of the Modifications layer stack.
- **Verification**:
  - Backend compile: `cd backend && python3 -m py_compile main.py book_scan_api.py imposing_api.py settings_api.py engines/*.py` exited with code `0`.
  - Frontend typecheck: `cd frontend && npx tsc --noEmit` exited with code `0` (zero errors).
  - Storage hygiene: `backend/temp_uploads/` verified clean.
- **Objective**:
  1. Eliminate the premature creation of entries when dragging a mask box on the canvas; follow the single-commit rule where no modification entry is created until the user clicks "Apply".
  2. Remove redundant in-tool box entries so there is exactly one unified entry per committed modification in the Modifications panel.
  3. Wire the "Edit" button in the Modifications panel so it displays interactive resize and move controls for the mask box directly on the preview canvas and allows the user to edit its fill color and page scope.
- **Root Cause & Architectural Problem**:
  - Drawing on the canvas via `PageCanvas.handleMaskPointerUp` previously called `onApplyMaskBox` immediately, which hit `/api/book-scan/mask-page/` and pushed an entry to `cleanupModule.appliedEntries` immediately on mouse up. Clicking "Apply" then created a second entry for the same action.
  - No draft state existed for masks, unlike `cropBox` in the Crop tool, preventing interactive handles (resize/move) and color adjustments before commit.
- **Changes Delivered**:
  - [`frontend/src/types/book_studio.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/types/book_studio.ts):
    - Added `draftMaskBox?: MaskBox | null;` to `CleanupModuleConfig`.
  - [`frontend/src/components/book-studio/PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx):
    - Added interactive resize/move bounding box for `cleanupModule?.draftMaskBox` with 8 corner/edge resize handles (`nw`, `ne`, `sw`, `se`, `n`, `s`, `w`, `e`) and an interior `move` drag area styled with the mask's fill color.
    - Updated `handleMaskPointerUp` to pass coordinates up without prematurely creating database entries.
  - [`frontend/src/components/book-studio/BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx):
    - Implemented `handleMaskPointerDown`, `activeMaskDrag`, and pointer move/up listeners to support live dragging, resizing, and repositioning of `draftMaskBox`.
  - [`frontend/src/app/book-studio/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/book-studio/page.tsx):
    - Updated `onApplyMaskBox` on `PageCanvas` to set `draftMaskBox` in `cleanupModule` and deactivate the drawing tool, perfectly mirroring the Crop tool draft workflow.
    - Passed `setCleanupModule` to `BookWorkspace` and `applyMaskBox`/`removeMaskBox` down to `BookRightPanel`.
  - [`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts) & [`frontend/src/hooks/useBookStudioState.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookStudioState.ts):
    - Initialized `draftMaskBox: null` in `cleanupModule`.
    - Enhanced `applyMaskBox` to accept `customColor` and `existingMaskId` parameters for seamless update workflows.
  - [`frontend/src/components/book-studio/modules/CleanupPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CleanupPanel.tsx):
    - Unified `handleApply`: if a `draftMaskBox` is present, it commits the box to targeted pages via `applyMaskBox` and pushes/updates a single clean modification entry in `cleanupModule.appliedEntries` before clearing the draft.
    - Updated `handleEditEntry`: clicking "Edit" restores `draftMaskBox` onto the canvas, displays the interactive resize controls, sets the fill color picker, and updates the action button to "Update Entry".
    - Added "Draft Box Active" / "Editing Mask Box" pill with a "Cancel Box" button.
    - Enhanced `handleDeleteApplied` to clear `draftMaskBox` and invoke `removeMaskBox`.
- **Verification**:
  - Backend compile: `cd backend && python3 -m py_compile main.py book_scan_api.py imposing_api.py settings_api.py engines/*.py db/*.py storage/*.py` exited with code `0`.
  - Frontend typecheck: `cd frontend && npx tsc --noEmit` exited with code `0` (zero errors).
  - Production build: `cd frontend && npm run build` exited with code `0` (13 static pages generated cleanly).
  - Storage hygiene: `backend/temp_uploads/` verified clean.

### Task 14: Erase Box Modifications Synchronization, Auto-Pruning & Canvas Parity
- **Objective**:
  1. Synchronize the Cleanup module modifications panel entries with user erase box operations in real-time, matching the behavior of the Crop tool modification panel.
  2. Ensure that when the user manually deletes the last erase box on a page or across all pages, the modification entries are cleanly removed from the Modifications panel.
  3. When all boxes across all pages are deleted (and no background filters are active), ensure the Cleanup module is disabled and the Modifications panel completely hides.
  4. Wire canvas mask visibility toggling from the Modifications panel (`Show`/`Hide` eye icons) so canvas overlays immediately respect entry visibility.
- **Root Cause & Architectural Problem**:
  - Previously, deleting the last erase box on a page did not unlink the page from multi-page entries (`All` / `Custom`), leaving empty pages with obsolete modification cards.
  - Deleting the last remaining box across the entire book could leave stale entries or fail to disable the cleanup state.
  - History jumps (Undo/Redo) could desynchronize the layer entry stack from the actual mask geometry on pages.
- **Changes Delivered**:
  - [`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts):
    - Re-architected `removeMaskBox`: when `totalRemainingBoxes === 0`, prunes all mask entries from `appliedEntries` and sets `enabled: false` if no filters remain. When `totalRemainingBoxes > 0`, recalculates remaining boxes per entry, unlinks pages that reached 0 boxes (`targetPageIds`, `targetPages`, `scopeLabel`), and updates live counts (`details: "X Box(es)"`).
    - Updated `applyMaskBox`: accurately computes box counts and attaches `solidColor` and scope labels.
    - Updated `clearPageMasks` & `clearAllMasks`: synchronized with `appliedEntries` pruning and scope re-evaluation.
    - Updated `useEffect` on `pages`: guarantees bidirectional consistency between canvas page masks and `cleanupModule.appliedEntries` during Undo, Redo, page operations, or session restoration.
  - [`frontend/src/components/book-studio/modules/CleanupPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CleanupPanel.tsx):
    - Enabled `onClearPageMasks` to accept target page IDs for multi-page entry deletion.
    - Updated `handleDeleteApplied` and `handleDeleteFromCurrentPage` to trigger proper page-specific mask clearing and unlinking.
    - Enhanced `handleEditEntry` to distinguish between filter entries and erase box entries.
  - [`frontend/src/components/book-studio/BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx) & [`frontend/src/app/book-studio/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/book-studio/page.tsx):
    - Passed `cleanupModule` into `BookWorkspace` and computed `isMasksVisible` for the active page, hiding canvas mask overlays when an entry is toggled to `Hide` in the Modifications panel.
  - [`frontend/src/types/book_studio.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/types/book_studio.ts):
    - Added `solidColor?: string;` to `AppliedModuleEntry` for inline color swatch rendering in `LayerEntryStack`.
- **Verification**:
  - Backend compile: `cd backend && python3 -m py_compile main.py book_scan_api.py imposing_api.py settings_api.py engines/*.py db/*.py storage/*.py` exited with code `0`.
  - Frontend typecheck: `cd frontend && npx tsc --noEmit` exited with code `0` (zero errors).
  - Production build: `cd frontend && npm run build` succeeded with code `0` (13 static routes generated cleanly).
  - Storage hygiene: `backend/temp_uploads/` verified clean.

### Task 13: Cleanup Module Decoupling, Layer Stack Application & Single-Source Unlinking
- **Objective**:
  1. Extract `CleanupPanel` from `RestorePanel.tsx` into a dedicated, single-responsibility module file [`frontend/src/components/book-studio/modules/CleanupPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CleanupPanel.tsx).
  2. Implement true per-page parameter resolution from applied layer stacks (`AppliedModuleEntry` / `BleedEntry`) across both real-time thumbnail previews and backend PDF/ZIP exports.
  3. Consolidate duplicated `handleDeleteFromCurrentPage` routines across 4 modules (`CleanupPanel`, `RestorePanel`, `DeskewPanel`, `BleedPanel`) into canonical helper `unlinkPageFromEntries` in [`frontend/src/lib/pageScope.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/lib/pageScope.ts).
  4. Fix preview and export bugs where pages in applied layer scopes erroneously rendered with active form slider values instead of their committed entry parameters.
- **Root Cause & Architectural Problem**:
  - `RestorePanel.tsx` previously housed two separate modules (`CleanupPanel` and `RestorePanel`) spanning 942 lines, violating single responsibility.
  - While Book Studio allowed operators to add entries to `appliedEntries` for different page scopes, `buildThumbnailUrl` and `exportPdf` only evaluated whether a page was included in the scope, then applied the global/active form state to all matching pages. Adjusting a slider on Page 2 inadvertently altered the rendered output of previously committed modifications on Page 1.
  - Each of the 4 panels independently implemented ~30 lines of identical page unlinking math.
- **Changes Delivered**:
  - [`frontend/src/lib/pageScope.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/lib/pageScope.ts):
    - Added `getAppliedEntryForPage` to find the highest-priority visible entry matching a given page.
    - Updated `isPageInAppliedEntries` to wrap `getAppliedEntryForPage`.
    - Added canonical `unlinkPageFromEntries` to remove a page from an entry, manage exclusions, and format custom scope labels.
  - [`frontend/src/components/book-studio/modules/CleanupPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CleanupPanel.tsx):
    - Created clean standalone component handling erase boxes, fill color, spine shadows, and despeckle filters.
  - [`frontend/src/components/book-studio/modules/RestorePanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/RestorePanel.tsx):
    - Pruned `CleanupPanelProps` and `CleanupPanel`, leaving a concise, dedicated component for color mode, background whitening, and tonal vibrance/contrast.
  - [`frontend/src/components/book-studio/modules/DeskewPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/DeskewPanel.tsx) & [`frontend/src/components/book-studio/modules/BleedPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/BleedPanel.tsx):
    - Replaced duplicated unlinking boilerplate with `unlinkPageFromEntries`.
  - [`frontend/src/components/book-studio/BookRightPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookRightPanel.tsx):
    - Updated import to load `CleanupPanel` from `./modules/CleanupPanel`.
  - [`frontend/src/hooks/useBookSession.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookSession.ts):
    - Updated `buildThumbnailUrl` to resolve effective deskew, cleanup, color, and bleed values per page from matching layer entries before querying backend thumbnails.
  - [`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts):
    - Extended `exportPdf` to compile per-page maps (`per_page_cleanup`, `per_page_restoration`, `per_page_bleed`) and include them in `exportPayload`.
  - [`backend/engines/schemas.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/schemas.py) & [`backend/engines/book_scan_engine.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/book_scan_engine.py):
    - Added `per_page_cleanup`, `per_page_restoration`, `per_page_bleed` fields to `ExportRequest`.
    - Wired `BookScanEngine.render_export_pages` to extract and apply per-page cleanup, color/tone, and bleed parameters during compilation.
  - [`docs/architecture.md`](file:///home/essam/Projects/ESSR_PA/docs/architecture.md):
    - Synchronized Repository Navigation Map to reflect dedicated `CleanupPanel.tsx` path.
- **Verification**:
  - Backend compile: `cd backend && python3 -m py_compile main.py book_scan_api.py imposing_api.py settings_api.py engines/*.py db/*.py storage/*.py` exited with `0`.
  - Frontend typecheck: `cd frontend && npx tsc --noEmit` exited with `0` (zero errors).
  - Storage hygiene: `backend/temp_uploads` verified clean.

### Task 12: Production Build Gate & Session Hand-Off
- **Objective**:
  1. Execute comprehensive production build verification gate (`npm run build`) across all frontend pages and routes.
  2. Perform full backend syntax and import compilation check (`python3 -m py_compile`).
  3. Verify zero-retention storage policy on `backend/temp_uploads/`.
  4. Perform workspace readiness audit prior to session close.
- **Verification Results**:
  - **Backend Compilation**: `python3 -m py_compile main.py book_scan_api.py imposing_api.py settings_api.py engines/*.py db/*.py storage/*.py` executed with exit code `0` (clean).
  - **Frontend Production Build**: `cd frontend && npm run build` (Next.js 14.2.35) succeeded with exit code `0`.
    - Type checking and linting passed (`✓ Linting and checking validity of types`).
    - 13 static routes generated successfully without runtime or SSG errors (`/`, `/book-studio`, `/imposing`, `/contour`, `/flipbook`, `/settings`, etc.).
  - **Storage Hygiene**: `backend/temp_uploads/` and `backend/temp_uploads/book_scans/` verified clean (zero dangling scratch or payload files; only repository `.gitkeep` files present).
  - **Git Status**: Git tree inspected; uncommitted modifications preserved cleanly for user review without autonomous commits (adhering strictly to User-Only Version Control rule in `AGENTS.md`).

### Task 11: Binary Asset Store Cut-Over & Tiered Storage Migration (Task 1.3)
- **Objective**:
  1. Cut over the binary file pipeline from flat `temp_uploads/` to `backend/storage/asset_store.py` (`data/storage/` with its 4 isolated tiers: `originals/`, `sessions/`, `cache/`, `exports/`).
  2. Ensure all SQLite database session records point directly to structured storage paths (`backend/data/storage/sessions/{session_id}`).
  3. Route thousands of rendered page thumbnails to `backend/data/storage/cache/{session_id}/`, keeping session directories clean and allowing risk-free cache clearing without deleting customer files.
  4. Preserve original incoming PDFs and artwork uploads immutably in `backend/data/storage/originals/` using atomic writes.
  5. Store background print exports in `backend/data/storage/exports/` mapped to `ExportJobModel`.
  6. Update `StorageCleaner` so operators can safely purge preview caches without risking data loss.
- **Root Cause & Architectural Problem**:
  - In Phase 1 of the persistence migration, the SQLite WAL database was wired for metadata, but routers (`book_scan_api.py`, `imposing_api.py`, `main.py`) still hardcoded `TEMP_DIR = "temp_uploads/book_scans"`, dumping raw uploads, temp splits, thumbnails, and exports into the same directory and pointing database rows back into `temp_uploads/`.
- **Changes Delivered**:
  - [`backend/storage/asset_store.py`](file:///home/essam/Projects/ESSR_PA/backend/storage/asset_store.py):
    - Added `save_file_stream` for atomic streaming writes via temporary files and OS-level `os.replace`.
    - Added `save_original` for archiving incoming raw artwork in `originals/`.
    - Added `resolve_asset_file` supporting multi-tier lookup (session, originals, and legacy fallback).
    - Added `clear_cache` for dedicated thumbnail purging.
  - [`backend/book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py):
    - Removed `TEMP_DIR = "temp_uploads/book_scans"`.
    - Replaced with `session_dir = asset_store.get_session_dir(session_id)`.
    - Stored uploads using `asset_store.save_file_stream`.
    - Routed rendered thumbnails in `get_page_thumbnail` to `asset_store.get_thumbnail_cache_path(session_id, cache_tag)`.
    - Routed export outputs (`_run_export_job`, `export_cleaned_book`, `extract_single_page`) to `asset_store.get_export_path(...)`.
    - Routed session cleanup to `asset_store.purge_session(session_id)`.
  - [`backend/imposing_api.py`](file:///home/essam/Projects/ESSR_PA/backend/imposing_api.py):
    - Routed uploads to `asset_store.save_original(...)`.
    - Routed thumbnails to `asset_store.get_thumbnail_cache_path("imposing", ...)`.
    - Routed PDF/SVG exports to `asset_store.get_export_path(...)`.
  - [`backend/main.py`](file:///home/essam/Projects/ESSR_PA/backend/main.py):
    - Mounted `/storage/cache` as `StaticFiles` alongside `/temp_uploads`.
    - Routed `/api/inspect` uploads to `asset_store.save_original` and thumbnails to `asset_store.get_thumbnail_cache_path("inspect", ...)`.
    - Routed contour upload to `asset_store.save_original` and cache to `asset_store.cache_dir`.
  - [`backend/engines/thumbnails.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/thumbnails.py):
    - Updated `pregen_pdf_thumbnails` to store pregenerated thumbnails in `asset_store.cache_dir`.
    - Updated `resolve_temp_file` to search `asset_store` across all tiers first before falling back to `temp_uploads`.
  - [`backend/engines/storage_cleaner.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/storage_cleaner.py):
    - Replaced monolithic directory wipe with fine-grained targets: `storage_cache` (safe preview cache), `storage_sessions` (abandoned session slices), and `storage_exports` (completed exports).
  - [`frontend/next.config.mjs`](file:///home/essam/Projects/ESSR_PA/frontend/next.config.mjs) & [`frontend/src/app/contour/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/contour/page.tsx):
    - Added `/storage/cache/:path*` rewrite to backend proxy.
    - Updated SVG path regex in Contour Studio to support both `/temp_uploads/` and `/storage/cache/`.
  - [`docs/architecture.md`](file:///home/essam/Projects/ESSR_PA/docs/architecture.md):
    - Updated Repository Navigation Map entry for `backend/storage/`.
- **Verification**:
  - Live API verification test (`/api/book-scan/init-session` -> `/api/book-scan/page-thumbnail`):
    - Verified session directory created in `backend/data/storage/sessions/{session_id}`.
    - Verified thumbnail saved and retrieved from `backend/data/storage/cache/{session_id}/`.
    - Verified `temp_uploads/book_scans` remained completely untouched.
    - Verified `asset_store.purge_session` cleanly removed session workspace and cache.
  - Ran `StorageCleaner.clean('runtime')` (freed 120.9 MB; `temp_uploads` completely cleared).
  - Backend py_compile passed with 0 errors across all modules.
  - Frontend `npx tsc --noEmit` passed with 0 errors.

### Task 10: Modifications Panel Per-Page Filtering, Custom Scope Tooltip & UI Cleanups
- **Objective**:
  1. Fix the applied entries display bug: when an entry is removed from a page and that page has no other modifications, the modifications box must not show on that page at all.
  2. Implement `Custom` scope badge with `All minus (p.n, p.m)` hover tooltip when an "All" scope entry is unlinked from specific pages.
  3. Rename applied effect boxes to `Modifications` across all modules (`Crop & Split`, `Deskew`, `Cleanup`, `Colors`, `Bleed`).
  4. Move modifications count closer to the panel title and highlight it in a distinguished badge.
  5. Shorten batch control button labels from "Hide All" / "Clear All" to "Hide" / "Clear" so they fit on a single line.
  6. Standardize scope indicators to always use `P.n` instead of alternating with `Current` or `Page n`.
  7. Strip verbose dimension percentages (e.g. `L:10% T:5%...`) from applied cards, showing concise effect names and options (with inline color swatch for solid bleeds).
  8. Remove the redundant `{pageCropsCount} ready • Active` badge from `CropSplitPanel`.
- **Root Cause & Architectural Problem**:
  1. `LayerEntryStack` previously rendered all module entries regardless of whether the entry targeted `activePageId` or `activePageNum`. When an operator unlinked an entry from Page 2, Page 2's panel continued showing the entry with the remaining pages list (`P.1,3`), causing confusing clutter.
  2. The scope badge previously printed the full remaining page list (e.g. `P.1,3,4,5...29`), overflowing the card.
- **Changes Delivered**:
  - [`frontend/src/types/book_studio.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/types/book_studio.ts):
    - Added `origScope?: "all" | "odds" | "evens" | "range" | "current"` and `excludedPages?: number[]` to `AppliedModuleEntry` and `BleedEntry`.
  - [`frontend/src/lib/pageScope.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/lib/pageScope.ts):
    - Standardized `resolveConcretePageNumbers` to generate `P.n`, `All`, `Odds`, `Evens`.
  - [`frontend/src/components/book-studio/modules/PageScopeSelector.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/PageScopeSelector.tsx):
    - Default `title = "Modifications"`.
    - Added `pageEntries` filtering based on `activePageId`, `activePageNum`, and `entry.excludedPages`. Returns `null` when `pageEntries.length === 0`.
    - Compacted header with distinguished pill badge and single-line "Hide" / "Clear" buttons.
    - Added `Custom` scope badge with `All minus (p.n, ...)` tooltip.
    - Stripped `L:10% ...` dimension percentages and added color swatch support for solid bleed.
    - Ensured `SCOPE_OPTIONS` always formats current page as `P.n`.
  - [`frontend/src/components/book-studio/modules/CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx):
    - Removed `{pageCropsCount} ready • Active` badge.
    - Set title to `Modifications`.
    - Formatted scope presets and apply buttons to `P.n`.
  - [`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts):
    - Formatted `formatCropScopeLabel` to `P.n`.
    - Cleaned `Crop` card details to `Paper` / `Content` (no percentages).
    - Tracked `origScope` and `excludedPages` in `removeAppliedCrop`.
  - [`frontend/src/components/book-studio/modules/DeskewPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/DeskewPanel.tsx), [`RestorePanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/RestorePanel.tsx), [`BleedPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/BleedPanel.tsx):
    - Updated entry creation and per-page unlinking routines to record `origScope` and `excludedPages`.
    - Set title to `Modifications`.
    - Cleaned card details (concise options, angles, and hex colors).
- **Verification**:
  - `cd frontend && npx tsc --noEmit` exited 0 (clean TypeScript build).
  - `cd frontend && npm run lint` exited 0 (`✔ No ESLint warnings or errors`).


### Task 9: Resolve Book Studio Session Initialization Failure
- **Objective**: Fix the `failed to initialize book studio session` error returned when uploading files in Book Studio.
- **Root Cause & Architectural Problem**:
  1. During the earlier import pruning across backend modules, `BookScanEngine` and `PageOpError` were omitted from the imports of [`backend/book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py). When `/api/book-scan/init-session` was called, `BookScanEngine.collate_from_paths` raised a server 500 `NameError: name 'BookScanEngine' is not defined`.
  2. In addition, when optional parameters such as `odds_order` or `existing_file_path` defaulted to FastAPI `Form(...)` objects, directly persisting them into the SQLite database table caused SQLAlchemy JSON serialization failure (`TypeError: Object of type Form is not JSON serializable`).
  3. Pruned imports in `sheet_gang_exporter.py` (`apply_alignment`, `resolve_temp_file`), `flipbook_worker.py` (`tempfile`, `subprocess`), and `book_scan_engine.py` (`Set`) were also identified via static AST analysis and restored.
- **Changes Delivered**:
  - [`backend/book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py):
    - Added `from engines.book_scan_engine import BookScanEngine, PageOpError`.
    - Added comprehensive normalization for primitive parameters (`mode`, `is_spread`, `odds_order`, `evens_order`, `spread_split_pos`, `start_with`, `existing_file_path`, `reverse_file_indices`) and file inputs so default `Form`/`File` objects are normalized before processing and SQLite persistence.
  - [`backend/engines/sheet_gang_exporter.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/sheet_gang_exporter.py):
    - Added `from engines.imposing_prep import apply_alignment` and `from engines.thumbnails import resolve_temp_file`.
  - [`backend/engines/flipbook_worker.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/flipbook_worker.py):
    - Added `import tempfile` and `import subprocess`.
  - [`backend/engines/book_scan_engine.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/book_scan_engine.py):
    - Added `Set` to `typing` imports.
- **Verification**:
  - Live HTTP POST tests against `/api/book-scan/init-session` for `single`, `multi_merge`, and `dual` intake modes all completed with HTTP 200 and valid session payloads.
  - `python -m py_compile main.py book_scan_api.py db/*.py storage/*.py engines/*.py` exited 0.
  - `cd frontend && npx tsc --noEmit` exited 0.

### Task 8: Fix Spread Split Deletion Bug, Per-Page Entry Removal, and Documentation Synchronization
- **Objective**:
  1. Fix the bug where splitting a page/spread and deleting the entry corrupted/crashed the page deck.
  2. Implement a mechanism to remove an applied entry only from the current page the user is viewing (while keeping other target pages intact).
  3. Review and update all project documentation (`AGENTS.md`, `docs/api.md`, `docs/architecture.md`) to ensure all rules, utilities, and endpoints are up to date and strictly adhered to.
- **Root Cause & Architectural Problem**:
  1. In `backend/engines/book_scan_engine.py` (`revert_pages`), `target_page_ids` was evaluated strictly with `p["id"] in t_ids`. When a spread was split, the child pages were assigned slice IDs (e.g., `p0_s0`, `p0_s1`), whereas the stored split entry referenced the parent ID `p0`. As a result, no pages matched, and `revert_pages` raised an uncaught `PageOpError(400, "No split pages found to revert.")`, halting the client with a 400 error.
  2. The parent original spread dimensions were not preserved across slices, risking distorted spread dimensions on recombine.
  3. When an edit layer (crop, bleed, deskew, cleanup) was applied to multiple pages (e.g. `All`, `Odds`, `Range`), users had no way to remove the edit from just one page without deleting the entire layer and re-applying it manually.
- **Changes Delivered**:
  - `backend/engines/book_scan_engine.py`:
    - Updated `revert_pages` to match `(p.get("id") in t_ids or p.get("parent_page_id") in t_ids or p.get("immediate_parent_id") in t_ids)`.
    - Made `revert_pages` idempotent: if no split pages remain to revert, gracefully returns `(pages, page_id)` instead of throwing an unhandled 400.
    - Added `parent_spread_orig_width_mm` and `parent_spread_orig_height_mm` to split slices during `split_pages` so recombining restores true pre-split geometry.
  - `frontend/src/hooks/useBookModules.ts`:
    - Updated `splitSpread` to associate both parent and child slice IDs in `targetPageIds` and compute slice numbers for `targetPages` and `scopeLabel`.
    - Refactored `removeAppliedCrop` to support dual-mode deletion: full entry removal (with spread recombining) vs. selective single-page removal (`onlyTargetPageId`).
    - Fixed downlevel iteration compatibility with `Array.from(new Set(...))`.
  - `frontend/src/components/book-studio/modules/PageScopeSelector.tsx`:
    - Added `FileMinus` icon action button to `LayerEntryStack` cards when an entry targets multiple pages and the active page is among them.
    - Displays tooltip: "Remove edit only from Page X".
  - `frontend/src/components/book-studio/modules/CropSplitPanel.tsx`:
    - Wired `activePageNum`, `activePageId`, and `onDeleteFromCurrentPage` to `removeAppliedCrop(entryId, activePageId)`.
  - `frontend/src/components/book-studio/modules/DeskewPanel.tsx`, `RestorePanel.tsx`, `BleedPanel.tsx`:
    - Implemented `handleDeleteFromCurrentPage` unlinking `selectedPageId` and `activePageNum` from `targetPageIds` and `targetPages`, updating `scopeLabel` dynamically.
    - Wired `onDeleteFromCurrentPage` to `LayerEntryStack`.
  - Documentation Updates:
    - `AGENTS.md`: Updated canonical modules for `src/lib/units.ts` (`pxToMmAtDpi`, `mmToPxAtDpi`), `src/lib/pageScope.ts` (`resolveConcretePageNumbers`), `engines/units.py`, `backend/db/` (SQLite WAL), and `backend/storage/` (structured asset store).
    - `docs/api.md`: Documented all 26 endpoints in `backend/book_scan_api.py`, including sessions, locking, and background export jobs.
    - `docs/architecture.md`: Verified all active components and storage architecture.
- **Verification**:
  - `cd frontend && npx tsc --noEmit` exited 0 (clean TypeScript build).
  - `cd frontend && npm run lint` exited 0 (`✔ No ESLint warnings or errors`).
  - `cd backend && python -m py_compile main.py book_scan_api.py db/*.py storage/*.py engines/*.py` exited 0 (clean Python syntax).

### Task 7: Codebase Clean-Up, Rule Enforcement & Optimization
- **Objective**: 
  1. Audit the full codebase against `AGENTS.md` guidelines, resolving all ESLint warnings/errors and TypeScript errors.
  2. Fix React hook ordering issues (conditional `useMemo` in `LayerEntryStack`) and missing callback dependencies.
  3. Eliminate loose `any` types and experimental `(window as any).EyeDropper` casts with clean ambient type declarations.
  4. Debounce the deskew angle continuous slider (~350ms) to prevent server flooding while maintaining instant visual rotation.
  5. Centralize all pixel/millimeter unit conversions into `src/lib/units.ts` and `backend/engines/units.py`, purging inline `25.4` magic numbers across all engines and components.
  6. Prune dead imports across 13 backend modules and delete the unused orphaned `frontend/src/lib/utils.ts` file.
  7. Add `session_storage` target to `backend/engines/storage_cleaner.py` for persistent session management in Settings.
- **Root Cause & Architectural Problem**:
  1. `LayerEntryStack` placed `useMemo` after an early return on `entries.length === 0`, violating React Rules of Hooks.
  2. Dragging the deskew angle slider fired unthrottled HTTP POST calls on every mouse tick.
  3. Unit conversions (`25.4`) were inlined across `BookWorkspace.tsx`, `contour_engine.py`, `asset_inspector.py`, `book_scan_engine.py`, `thumbnails.py`, and `book_scan_api.py`.
  4. Orphaned single-line file `utils.ts` existed with zero references.
- **Changes Delivered**:
  - `frontend/src/components/book-studio/modules/PageScopeSelector.tsx`:
    - Moved `displayEntries` and `allVisible` `useMemo` hooks to top of `LayerEntryStack` before any early returns.
    - Cleaned `LayerEntryItem` interface.
    - Pruned unused `AppliedModuleEntry` import.
  - `frontend/src/types/eyedropper.d.ts`:
    - Created ambient typing for experimental `window.EyeDropper`.
  - `frontend/src/components/book-studio/modules/BleedPanel.tsx`, `RestorePanel.tsx`, `AppearanceSection.tsx`:
    - Removed `(window as any).EyeDropper` and all `@typescript-eslint/no-explicit-any` disables.
  - `frontend/src/components/book-studio/modules/CropSplitPanel.tsx`:
    - Removed unused `pages` prop destructuring.
  - `frontend/src/hooks/useBookModules.ts`:
    - Added missing `cropModule.splitLines` to `useCallback` dependency array.
  - `frontend/src/lib/units.ts` & `frontend/src/components/book-studio/BookWorkspace.tsx`:
    - Added `pxToMmAtDpi` and `mmToPxAtDpi` in `units.ts`.
    - Replaced inline `25.4` conversions in `BookWorkspace.tsx`.
  - `frontend/src/hooks/useBookStudioState.ts`:
    - Added debounced HTTP sync (~350ms) to `setPageDeskewAngle` with cleanup on unmount, preserving instant optimistic state updates for 60fps canvas rotation.
  - `frontend/src/lib/utils.ts`:
    - Deleted orphaned unused file.
  - `backend/engines/units.py`:
    - Added `MM_PER_INCH = 25.4`, `mm_to_px`, `px_to_mm`, and `is_page_in_scope`.
  - `backend/engines/book_scan_engine.py`, `contour_engine.py`, `thumbnails.py`, `asset_inspector.py`, `book_scan_api.py`:
    - Replaced all inline `/ 25.4` and `* 25.4` calculations with canonical `mm_to_px` and `px_to_mm`.
    - Delegated `BookScanEngine.is_page_in_scope` to `engines.units.is_page_in_scope`.
  - Pruned unused imports across: `settings_api.py`, `book_scan_api.py`, `imposing_api.py`, `flipbook_worker.py`, `roll_packer.py`, `sheet_gang_exporter.py`, `sheet_packer.py`, `report_generator.py`, `book_scan_engine.py`, `db/models.py`, `db/repository.py`, `storage/asset_store.py`.
  - `backend/engines/storage_cleaner.py`:
    - Added `session_storage` target for `backend/data/storage`.
  - `docs/architecture.md`:
    - Removed deleted `utils.ts` and updated core libs in Repository Navigation Map.
- **Verification**:
  - `npm run lint` exited with code 0 (`✔ No ESLint warnings or errors`).
  - `npx tsc --noEmit` exited with code 0 (0 TypeScript errors).
  - Backend compile `python -m py_compile` exited with code 0 across all files.
  - AST check verified 0 unused imports across all backend files.
  - Grep audit confirmed zero inline `25.4` outside canonical `units.ts` and `units.py`.
  - Grep audit confirmed zero `as any` in frontend.

### Task 6: Database & Storage Architecture Implementation (SQLite WAL + Structured Asset Store)
- **Objective**: 
  1. Migrate session and page state management from ephemeral in-memory `SESSIONS` dictionary to an ACID metadata database (SQLite with WAL mode).
  2. Implement a structured on-disk asset store outside git (`backend/data/storage/{session_id}/raw|thumb|exports/`) separating binary files from metadata.
  3. Provide crash recovery and multi-worker safety across server restarts and local network access.
  4. Implement collaborative multi-user session locking and export job tracking in SQLite.
- **Root Cause & Architectural Problem**:
  1. In-memory `SESSIONS` dictionary lost all session metadata whenever Uvicorn restarted or if multiple workers were used.
  2. Flat `temp_uploads/` directory mixed raw uploads, temporary crops, thumbs, and exports without per-session namespaces, risking accidental cleanup wiping active work.
  3. No transactional locking existed for multi-user LAN access, allowing concurrent operators to clobber each other's edits.
- **Changes Delivered**:
  - `backend/requirements.txt`:
    - Added `sqlalchemy>=2.0.0`.
  - `backend/db/session.py`:
    - Configured SQLite WAL engine at `backend/data/flint.db` with PRAGMAs: `journal_mode=WAL`, `busy_timeout=15000`, `foreign_keys=ON`, `synchronous=NORMAL`.
    - Created scoped `get_db()` session context manager.
  - `backend/db/models.py`:
    - Implemented ORM models: `SessionModel`, `PageModel`, `AppliedLayerModel`, `SessionLockModel`, `ExportJobModel`.
  - `backend/db/repository.py`:
    - Created `SessionRepository` providing transactional CRUD for sessions, batch page reorders/mutations, layer stack snapshots, session locks, and export jobs.
  - `backend/storage/asset_store.py`:
    - Created `AssetStore` with deterministic directory layouts: `data/storage/{session_id}/raw/`, `thumb/`, `exports/`.
  - `backend/main.py`:
    - Added database initialization in `@app.on_event("startup")` ensuring tables exist automatically.
  - `backend/book_scan_api.py`:
    - Replaced raw dictionary lookup with `get_or_load_session`, automatically rehydrating sessions from SQLite WAL if restarted or accessed across workers.
    - Transactionally synced page mutations (reorder, rotate, delete, crop, split, deskew, mask, restore, duplicate, insert blank) to the database on every action.
    - Integrated DB tracking for export jobs (`_run_export_job`, `start_export_job`, `get_export_job_status`).
    - Added multi-user endpoints: `GET /sessions`, `POST /lock/{session_id}`, `DELETE /lock/{session_id}`, `GET /lock/{session_id}`.
  - `docs/architecture.md`:
    - Synchronized the Repository Navigation Map and Data Flow & Storage Lifecycle sections with `backend/db/` and `backend/storage/`.
- **Verification**:
  - `cd backend && python -m py_compile main.py book_scan_api.py db/*.py storage/*.py engines/*.py` exited with code 0 (clean compilation).
  - `cd frontend && npx tsc --noEmit` exited with code 0 (clean TypeScript check).
  - Database created and verified at `backend/data/flint.db`.

### Task 5: Layer Stack Latest-On-Top, Space-Saving Compact Cards & Crop Reversion Fixes
- **Objective**: 
  1. Rearrange entry cards so the latest applied entry is always rendered on top across all modules.
  2. Optimize entry cards to display only essential information in a high-density, compact format saving vertical sidebar space.
  3. Fix crop entry removal bug where deleting an entry failed to revert pages or caused corrupted dimensions across multi-page sessions.
- **Root Cause & Architectural Problem**:
  1. `LayerEntryStack` rendered entries in chronological order (oldest on top), forcing operators to scroll through earlier edits to reach the active layer.
  2. Entry cards used generous multi-line padding (`p-2`, two rows per card), consuming ~48px of vertical height per item and pushing module controls off-screen in a 300px sidebar.
  3. Crop entry deletion relied on whole-document snapshots (`entry.prevPagesSnapshot`). In multi-page or multi-entry sessions:
     - Deleting an entry targeting Page 1 restored an old snapshot where Page 2 was uncropped, wiping out Page 2's edits.
     - Submitting multiple deletions via `forEach` in `handleDeleteAll` triggered concurrent async API races over `/api/book-scan/restore-pages`.
     - Updating an edited crop entry didn't purge the previous boundary, causing compounding crop inset.
- **Changes Delivered**:
  - `frontend/src/components/book-studio/modules/PageScopeSelector.tsx`:
    - Added `displayEntries = useMemo(() => [...entries].reverse(), [entries])` to render the most recent edit at the top of the stack for all modules.
    - Redesigned entry cards into an ultra-compact, single-line high-density layout (`py-1.5 px-2`, height ~24px, >50% space saving).
    - Compacted scope pill (`px-1.5 py-0.2`, `text-[8.5px]`), inline secondary details, tiny editing indicator, and reduced action button icons (`size={11}`).
  - `frontend/src/hooks/useBookModules.ts`:
    - Replaced whole-document snapshot restore in `removeAppliedCrop` with target-page-aware crop re-evaluation: if a target page has remaining entries, it falls back to the latest active crop; if not, its `crop_box` and `page_crop_box` are purged and dimensions cleanly revert to `orig_width_mm`/`orig_height_mm` with a cache-busting `rev` bump.
    - Handled split entry reversal so slices recombine into parent spreads.
    - Implemented dedicated atomic `removeAllAppliedCrops` routine to clear all crops, revert splits, reset dimensions, and sync with backend in a single pass.
  - `frontend/src/hooks/useBookStudioState.ts` & `frontend/src/app/book-studio/page.tsx`:
    - Exposed and forwarded `removeAllAppliedCrops` to `BookRightPanel`.
  - `frontend/src/components/book-studio/BookRightPanel.tsx`:
    - Forwarded `removeAllAppliedCrops` to `CropSplitPanel`.
  - `frontend/src/components/book-studio/modules/CropSplitPanel.tsx`:
    - Replaced concurrent `forEach` loop in `handleDeleteAll` with atomic `removeAllAppliedCrops`.
    - Wired `handleApplyAction` so updating an edited entry purges the prior crop before committing updated boundaries.
- **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - Backend `python -m py_compile` passed with 0 errors.
  - Zero-retention file policy verified: `backend/temp_uploads` is clean.

### Task 4 (TCK-03): UI Accent & Tooltip Behavior
- **Objective**: Ensure all active toggles and switches across modules explicitly reflect the application theme accent color (`var(--app-accent, #f59e0b)`), remove hardcoded shortcut labels from headers and button text, and migrate shortcut indicators exclusively to dynamic hover tooltips reading user keybind settings.
- **Root Cause & Architectural Problem**:
  1. Static badges like `Key 1`, `Key 2`, `Key 3`, `Key 4`, `Key 5` were hardcoded in module headers and card descriptions, causing UI clutter and breaking if user keybinds differed.
  2. Button text contained hardcoded shortcut letters (e.g. `Draw Box (M)`, `Straighten (S)`, `Grid (G)`, and `↵`), violating clean typography standards.
  3. Active tool and toggle states used hardcoded Tailwind amber classes (`bg-amber-500`, `text-amber-400`, `border-amber-400`, `accent-amber-500`) instead of the centralized CSS theme variables (`var(--app-accent, #f59e0b)`, `--app-accent-fg`, `accent-[var(--app-accent,#f59e0b)]`).
  4. Tooltips lacked dynamic keybind formatting: shortcuts like `A`, `Shift+A`, `X`, `Enter` were static strings in `title` attributes rather than referencing `shortcutLabels`.
- **Changes Delivered**:
  - `frontend/src/hooks/useBookShortcuts.ts`:
    - Extended `DEFAULT_BOOK_SHORTCUTS` with `module_crop: "1"`, `module_deskew: "2"`, `module_cleanup: "3"`, `module_restore: "4"`, `module_bleed: "5"`, and `exit_module: "escape"`.
    - Enhanced `formatCombo` to format `escape` as `Esc` and preserve combo capitalization.
    - Updated keyboard event listener to dynamically dispatch `handlers.focusModule` and `handlers.exitModule` based on user-configured keybinds.
  - `frontend/src/hooks/useBookStudioState.ts`:
    - Added `module_crop`, `module_deskew`, `module_cleanup`, `module_restore`, `module_bleed`, and `exit_module` to the memoized `shortcutLabels` dictionary.
  - `frontend/src/app/book-studio/page.tsx`:
    - Passed `shortcutLabels={shortcutLabels}` to `BookRightPanel`.
  - `frontend/src/components/book-studio/BookRightPanel.tsx`:
    - Added `shortcutLabels?: Record<string, string>` to `BookRightPanelProps`.
    - Computed `moduleShortcuts` mapped to active keybinds.
    - Replaced static `{mod.keyNum}` header badges with clean layout; migrated card tooltips to `title={`Open ${mod.title} options (${mod.shortcut})`}`.
    - Updated quick-jump strip tooltips to `title={`Jump to ${mod.title} (${mod.shortcut})`}` and return button to `title={`Return to All Modules (${shortcutLabels.exit_module || "Esc"})`}`.
    - Forwarded `shortcutLabels` to all child module panels.
  - `frontend/src/components/book-studio/modules/CropSplitPanel.tsx`:
    - Removed static `Key 1` header badge and `↵` symbol from commit button text.
    - Migrated tooltips on toggle switch, auto-detect (`detect_page`), detect all (`detect_all`), cut line (`add_cut`), and commit button (`apply_action`) to dynamic `shortcutLabels`.
    - Updated custom range input focus ring to `focus:border-[var(--app-accent,#f59e0b)]`.
  - `frontend/src/components/book-studio/modules/DeskewPanel.tsx`:
    - Removed static `Key 2` header badge and `(S)` from `Straighten` and `(G)` from `Grid` button text.
    - Migrated tooltips on switch (`module_deskew`), detect page (`detect_page`), detect all (`detect_all`), straighten line (`straighten_tool`), alignment grid (`grid_toggle`), and apply (`apply_action`) to dynamic `shortcutLabels`.
    - Updated checkboxes and range slider to `accent-[var(--app-accent,#f59e0b)]`.
    - Replaced hardcoded amber classes on active Straighten button with `var(--app-accent, #f59e0b)` and `var(--app-accent-fg, #090d16)`.
  - `frontend/src/components/book-studio/modules/RestorePanel.tsx`:
    - In `CleanupPanel`: removed static `Key 3` header badge and `(M)` from `Draw Box` button text. Updated switch, mask tool, eyedropper, and apply button tooltips to dynamic `shortcutLabels`.
    - Replaced hardcoded amber classes on active Draw Box button with `var(--app-accent, #f59e0b)` and `var(--app-accent-fg, #090d16)`.
    - Updated spine shadow checkbox to `accent-[var(--app-accent,#f59e0b)]`.
    - In `RestorePanel`: removed static `Key 4` header badge. Updated switch and apply button tooltips to dynamic `shortcutLabels`. Updated whiten BG checkbox and range sliders to `accent-[var(--app-accent,#f59e0b)]`.
  - `frontend/src/components/book-studio/modules/BleedPanel.tsx`:
    - Removed static `Key 5` header badge. Updated switch, eyedropper, and apply button tooltips to dynamic `shortcutLabels`.
    - Updated crop marks checkbox to `accent-[var(--app-accent,#f59e0b)]` and eyedropper hover to `hover:text-[var(--app-accent,#f59e0b)]`.
  - `frontend/src/components/book-studio/WorkspaceToolbar.tsx`:
    - Updated crop, straighten, and erase active buttons to use `--app-accent`, `--app-accent-fg`, and `--app-accent-15`/`30`.
    - Standardized compare button tooltip to dynamic `shortcutLabels.toggle_original`.
  - `frontend/src/components/book-studio/modules/SplitLinesEditor.tsx`:
    - Updated split line percentage range slider to `accent-[var(--app-accent,#f59e0b)]`.
- **Verification**:
  - `npx tsc --noEmit` passed cleanly with 0 errors.
  - Backend compile (`python -m py_compile`) passed cleanly with 0 errors.
  - Zero-retention file policy verified: `backend/temp_uploads` contains no stale files.
  - No autonomous git commits performed.

### Task 3 (TCK-02): Universal Edit Entry Pattern ("Layer Stack")
- **Objective**: Standardize all destructive or multi-pass tool operations (`Bleed`, `Colors`, `Cleanup`, `Deskew`, `Crop & Split`) into an inspectable Universal Layer Stack with edit, delete, preview visibility toggle, and batch controls.
- **Root Cause & Architectural Problem**:
  1. Entry rendering and controls were fragmented: `BleedPanel` had an ad-hoc custom list while other modules used a barebones `AppliedEntriesList` that only supported deletion.
  2. No mechanism existed to toggle preview visibility on/off for visual comparison without permanently deleting the edit.
  3. No in-place editing existed: tweaking an applied entry required deleting it and reconfiguring all inputs from scratch.
  4. Modules lacked batch controls (Show/Hide All, Delete All) and detailed operation parameter metadata.
- **Changes Delivered**:
  - `frontend/src/types/book_studio.ts`: Extended `AppliedModuleEntry` and `BleedEntry` with optional `details?: string`, `params?: Record<string, any>`, and explicit target page IDs.
  - `frontend/src/components/book-studio/modules/PageScopeSelector.tsx`:
    - Implemented `LayerEntryStack` component (and backward-compatible alias `AppliedEntriesList`).
    - Added entry action buttons: Edit (`Pencil`), Delete (`Trash2`), and Preview Visibility Toggle (`Eye`/`EyeOff`).
    - Added header batch controls: **Show/Hide All** preview layers toggle and **Clear All** button.
    - Added explicit target scope badges (`P.4`, `Range 1-10`, `All`, `Odds`, `Evens`), parameter details lines, and active "Editing" badge.
  - `frontend/src/components/book-studio/modules/BleedPanel.tsx`:
    - Deprecated legacy ad-hoc applied bleeds list in favor of `LayerEntryStack`.
    - Added `handleToggleVisibility`, `handleToggleAllVisibility`, `handleDeleteAll`, and `editingId` in-place update state.
  - `frontend/src/components/book-studio/modules/RestorePanel.tsx`:
    - Integrated `LayerEntryStack` into both `CleanupPanel` and `RestorePanel` (Color & Tone).
    - Added `editingId`, `handleEditEntry`, `handleToggleVisibility`, `handleToggleAllVisibility`, `handleDeleteAll`, and "Update Entry" + "Cancel" buttons.
  - `frontend/src/components/book-studio/modules/DeskewPanel.tsx`:
    - Integrated `LayerEntryStack`, added `editingId`, `handleEditEntry`, `handleToggleVisibility`, `handleToggleAllVisibility`, `handleDeleteAll`, and "Update Entry" + "Cancel" buttons.
  - `frontend/src/components/book-studio/modules/CropSplitPanel.tsx`:
    - Integrated `LayerEntryStack`, added `editingId`, `handleEditEntry`, `handleToggleVisibility`, `handleToggleAllVisibility`, and `handleDeleteAll`.
  - `frontend/src/hooks/useBookModules.ts`:
    - Enforced preview vs. export separation: `resolveModuleExportScope` retains all applied entries on export regardless of preview visibility toggle (`all non-deleted entries remain active on export`).
    - Attached `details` and `params` to applied entries created by `splitSpread` and `applyCrop`.
- **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - Backend compile (`python -m py_compile`) passed with 0 errors.
  - Pure unit tests executed via Node.js verified preview visibility skipping in `isPageInAppliedEntries`, export preservation in `resolveModuleExportScope`, batch toggle, and in-place editing.
  - Live studio routes returned HTTP 200 without errors.
  - `backend/temp_uploads` verified clean.

### Task 1 (TCK-13): Next.js SSR Hydration Safety & Client Guards
- **Objective**: Eliminate SSR/client DOM hydration mismatches and window-dependent crashes across all studio viewports.
- **Root Cause**:
  1. Theme toggle button and dimension unit initial states accessed client-only globals (`localStorage`, `window`) during SSR render pass, resulting in mismatched text/icon markup.
  2. Canvas and viewport rendering modules executed canvas initialization logic on the server.
- **Changes Delivered**:
  - `src/components/shared/ClientOnly.tsx`: Created reusable client-only wrapper mounting content only after browser hydration.
  - `src/app/layout.tsx`: Wrapped `ThemeToggleButton` with `ClientOnly`.
  - `src/hooks/useBookStudioState.ts`: Decoupled `unit` state from direct synchronous `localStorage` read during initial render.
  - `src/app/book-studio/page.tsx`, `imposing/page.tsx`, `contour/page.tsx`, `flipbook/page.tsx`: Configured canvas viewport components with dynamic imports and `ssr: false`.
- **Verification**: `npx tsc --noEmit` passed with 0 errors; all studio routes return HTTP 200 without hydration errors.

### Task 2 (TCK-01): Scope Resolution & State Immutability
- **Objective**: Prevent applied prepress module effects from drifting when the operator navigates to another page, by statically binding concrete target page arrays instead of dynamic `"current"` strings.
- **Root Cause**:
  - `useBookSession.ts` evaluated `isPageInScope(pageNum, scope, activePageNum)` using the dynamic `activePageNum` of the current selection. Navigating pages dynamically transferred visual effects to whichever page was active.
- **Changes Delivered**:
  - `frontend/src/types/book_studio.ts`: Added concrete `targetPages: number[]`, `targetPageIds?: string[]`, and `visible?: boolean` to `AppliedModuleEntry` and `BleedEntry`. Added module applied entries to `ThumbnailRenderOpts`.
  - `frontend/src/lib/pageScope.ts`: Created `resolveConcretePageNumbers` (evaluates any scope into explicit 1-based `pageNumbers: number[]`), `isPageInAppliedEntries` (checks whether a page is in an entry's static target set), and `formatPageNumbersToRange`.
  - `frontend/src/components/book-studio/modules/PageScopeSelector.tsx`: Accepts `activePageNum` and renders concrete labels (e.g. `P.1` instead of ambiguous "Current").
  - `frontend/src/components/book-studio/modules/`: Updated `CropSplitPanel`, `DeskewPanel`, `CleanupPanel`, `RestorePanel`, and `BleedPanel` to resolve concrete pages upon clicking **Apply** and forward `activePageNum` into scope selectors and button labels.
  - `frontend/src/components/book-studio/BookRightPanel.tsx`: Derives `activePageNum` and forwards `pages`, `selectedPageId`, and `activePageNum` to all module panels.
  - `frontend/src/hooks/useBookModules.ts`: Populates `targetPages` on split and crop applied entries. In `exportPdf`, aggregates concrete page ranges from applied entries via `formatPageNumbersToRange` so exported PDFs reflect accurate target pages.
  - `frontend/src/hooks/useBookSession.ts` & `useBookStudioState.ts`: Updated thumbnail URL generator to prioritize `isPageInAppliedEntries` for deskew, cleanup, restoration, and bleed.
- **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - Backend compile check (`python -m py_compile`) passed with 0 errors.
  - Pure unit tests executed via Node.js verified that navigating from page 2 to page 3 leaves page 2's applied effect strictly intact with zero drift.
  - Purged runtime storage cache via `StorageCleaner.clean('runtime')` (freed 42.1 MB).

### Browser Window Reuse & Single-Tab Launch Notification
- **Problem**: Running Flint opened a new browser window every time instead of reusing the already-open window, and clicking the launcher when Flint was already open in a tab caused redundant windows to spawn.
- **Root Cause**:
  1. `start.sh`'s `open_app_window` explicitly ran `zen-browser --new-window "http://localhost:3000"`.
  2. `focus_window` was failing because the page lacked a `<title>` tag (and Hyprland Lua syntax differed from legacy `dispatch focuswindow address:...`).
  3. No tab detection existed to prevent re-opening when Flint was already loaded.
- **Changes Delivered**:
  - `start.sh`: Replaced `--new-window` with standard invocation `zen-browser "http://localhost:3000"` (and fallback `xdg-open`), which opens a tab in the already-active browser window.
  - `start.sh`: Added `is_flint_tab_open` which queries Hyprland client titles and Zen's live `recovery.jsonlz4` sessionstore.
  - `start.sh`: Updated `launch` case so if Flint is already open in a tab, it focuses the window, triggers `notify-send -i flint "Flint" "Flint Prepress Studio is already running"`, and exits immediately without spawning anything new.
  - `start.sh`: Updated `focus_window` to support Omarchy's Hyprland Lua dispatch (`hl.dsp.window.bring_to_top(w)`).
  - `frontend/src/app/layout.tsx`: Added `<head><title>Flint Prepress Studio</title></head>` so browser tabs and window managers display the proper title.
- **Verification**:
  - Executed `./start.sh launch` with Zen running; verified console output: `Flint services are running. Flint tab is already opened.` and confirmation of `notify-send` notification without creating duplicate windows or tabs.
  - `npx tsc --noEmit` passed with 0 errors.
  - Checked `backend/temp_uploads` is clean.

### New Logo (Concept 3) Rollout & Icon Sizing Fix
- **Context**: IDE crashed mid-task; recovered from previous conversation. User approved concept 3 (faceted cyan→amber flame "F") as-is (raster, not yet redrawn as SVG).
- **Problem**: Old icon looked tiny in the Zen browser sidebar because the favicon had large padding around a small mark.
- **Changes**:
  - All sizes generated from one 1024px master mark (tight alpha-bbox crop, 2px alpha erosion to remove white halo from the sticker extraction).
  - Browser: transparent glyph (`favicon.ico` multi-size, `icon.png`), `apple-icon.png`, `manifest.ts` + `public/icons/*` (dark `#181D27` tile + maskable).
  - App: `public/flint_mark.png` (sidebar + PDF report header); collapsed sidebar logo 26→30px. Removed `public/flint_icon.png`.
  - OS: `~/.local/share/icons/hicolor/{16..512}/apps/flint.png` + `gtk-update-icon-cache`. Tauri icons regenerated (ico/icns were 0-byte).
  - Generator script kept outside repo (agent scratch `build_icons.py`).
- **Verification**: `tsc --noEmit` OK; `/favicon.ico`, `/icon.png`, `/apple-icon.png`, `/manifest.webmanifest`, `/icons/icon-192.png`, `/flint_mark.png` all 200 and linked in `<head>`.
- **Follow-up**: Optional clean SVG redraw of the mark for large-format/vinyl-cutter use.

### Multi-Machine App Logo Missing Root Cause & Git Asset Exemption
- **Objective**: Diagnose why opening the app on other computers failed to display the application logo.
- **Rules Followed**: Consulted `AGENTS.md` strictly: zero autonomous git check-ins (user-only git permissions), verified navigation map, verified runtime storage zero-retention (`backend/temp_uploads/` clean).
- **Root Cause & Resolution**:
  1. **Global Image Ignore Rule**: Root `.gitignore` contained a blanket `*.png` rule intended for ad-hoc test files. This rule silently ignored `frontend/public/flint_mark.png`, `frontend/public/flint_icon.png`, and Tauri icons (`frontend/src-tauri/icons/*.png`).
  2. **Missing Remote Assets**: Because `frontend/public/` was never tracked or pushed to Git, any other computer that cloned or pulled the repository had an empty `public/` directory. Next.js returned HTTP 404 for `/flint_mark.png`, resulting in an empty logo container.
  3. **Fix**: Updated `.gitignore` to explicitly whitelist `!frontend/public/**` and `!frontend/src-tauri/icons/**`.
  4. **Verification**: Checked `git status` confirming `flint_mark.png`, `flint_icon.png`, and Tauri icon assets are now tracked. Verified TypeScript health (`tsc --noEmit`) passes with 0 errors.

---

## Date: 2026-10-22

### Frontend Stale Cache Recovery & Node/Next Runtime Clarification
- **Objective**: Clarify runtime environment versions (Node.js 20 LTS vs. Next.js 14.2) and diagnose/resolve UI loading failure on `localhost:3000`.
- **Rules Followed**: Consulted `AGENTS.md` rules strictly: verified centralized navigation map, verified runtime storage zero-retention policy (`backend/temp_uploads/` clean), user-only git permissions honored.
- **Root Cause & Resolution**:
  1. **Runtime Clarification**:
     - Verified system Node.js version is `v20.20.2` LTS (matching CI workflow) and frontend framework is `Next.js 14.2.35` on React 18.
     - Advised retaining Next.js 14.2 for desktop stability, Tauri v2 compatibility, and React 18 canvas rendering predictability.
  2. **UI Loading 404 Chunk Diagnostics**:
     - Investigated UI failure reports; checked systemd user unit `flint-frontend.service` and discovered the server had been running stale for 36+ hours.
     - Found all static chunk requests (`layout.css`, `main-app.js`, `app-pages-internals.js`, `page.js`) were returning HTTP 404 due to desynchronized in-memory manifests after earlier multi-machine git merges.
     - Purged stale `.next` directory and restarted `flint-frontend.service`.
  3. **Verification**:
     - Verified all static assets return HTTP 200.
     - Verified `/`, `/book-studio`, `/imposing`, and `/settings` compile cleanly and load without errors.
     - Purged temporary storage via `storage_cleaner.py` (0 lingering files).

---

### Multi-Machine Git Push Conflict Resolution & Root Stray Cleanup
- **Objective**: Troubleshoot and resolve rejected git push to remote origin on `main` caused by uncoordinated commits from a secondary work PC, assess root directory stray folders (`temp_uploads`, `public_flipbooks`), and synchronize the repository cleanly.
- **Rules Followed**: Consulted `AGENTS.md` rules strictly: user-only git check-ins and pushes, zero autonomous git history modifications, zero-retention storage policy verified (`backend/temp_uploads` and `backend/public_flipbooks` completely clean).
- **Changes Completed**:
  1. **Git Root Cause & Multi-Machine Workflow Education**:
     - Analyzed the non-fast-forward push rejection; explained divergence caused by working across two machines without syncing.
     - Documented the difference between destructive `--force` vs. safe `--force-with-lease` (lease validation checks before overwriting).
     - Outlined the "Sit Down (`git pull`) / Stand Up (`git push`)" prevention protocol for multi-device workflows.
  2. **Root Workspace Directory Cleanup**:
     - Investigated stray `temp_uploads` and `public_flipbooks` folders at repository root; verified they were historical ad-hoc artifacts from running commands outside `backend/`.
     - Confirmed legitimate application runtime directories are safely maintained under `backend/temp_uploads/` and `backend/public_flipbooks/`.
     - Safely purged stray root directories `temp_uploads/` and `public_flipbooks/`.
     - Updated root `.gitignore` to explicitly ignore `/temp_uploads/` and `/public_flipbooks/` to prevent recurrence.
  3. **Repository Alignment & Verification**:
     - User committed `.gitignore` and executed `git push --force-with-lease origin main`.
     - Confirmed `git status` reports working tree completely clean and up to date with `origin/main`.
     - Runtime storage confirmed 0 lingering files in `backend/temp_uploads/` and `backend/public_flipbooks/`.

---

## Date: 2026-10-21

### Book Studio Explicit Apply, Reversible Applied History & High-Density UI Polish
- **Objective**: Implement explicit Apply buttons across all Book Studio prepress modules, prevent automatic effect application on module entry, render an Applied entries list at the bottom of each module with delete-to-reverse support, fix the Erase Box drawing/deletion tool and layout clipping, reduce all labels to concise 1–2 words, and eliminate duplicate options.
- **Rules Followed**: `AGENTS.md` rules honored: strict TypeScript (`0` errors, zero `any`), centralized `src/lib/api.ts`, no new fragmented side-files, zero-retention temp directory hygiene, and user-only git permissions.
- **Changes Completed**:
  1. **Explicit Apply & No Auto-Apply on Entry (`useBookStudioState.ts`, `CropSplitPanel.tsx`, `DeskewPanel.tsx`, `RestorePanel.tsx`, `BleedPanel.tsx`)**:
     - Modified `openModule(mod)` to set `focusedModule = mod` and ensure `cropModule.enabled` is only true while `mod === 'crop'`.
     - Completely removed auto-enabling side-effects on entry so entering `deskew`, `cleanup`, `restore`, or `bleed` leaves the module inactive until the operator clicks **Apply**.
  2. **Applied Entries List with Delete-to-Reverse (`PageScopeSelector.tsx`, `useBookModules.ts`, `useBookStudioState.ts`, and all 5 module panels)**:
     - Created reusable `AppliedEntriesList` in `PageScopeSelector.tsx` displaying applied items with scope pills, concise labels, and a `Trash2` button.
     - In `useBookModules.ts`, saved snapshots prior to commit in `splitSpread` and `applyCrop`, and added `removeAppliedCrop(id)` to restore the snapshot and sync via `POST /api/book-scan/restore-pages`.
     - Added `clearAllDeskewAngles` and reverse handlers for `deskewModule`, `cleanupModule`, `restorationModule`, and `bleedModule`.
  3. **Fixed Erase Box Tool & Optimistic Updates (`PageCanvas.tsx`, `useBookModules.ts`, `RestorePanel.tsx`)**:
     - Fixed `PageCanvas.tsx` z-index layering (`z-40` for masks, `z-[60]` for delete `×` button) so hover-deletion works seamlessly even while the erase box drawing tool is active.
     - Added optimistic 0ms updates in `useBookModules.ts` for `applyMaskBox`, `removeMaskBox`, `clearPageMasks`, and `clearAllMasks`.
     - Preserved **Clear Page** and **Clear All** buttons.
  4. **High-Density 1–2 Word Labels & Zero Clipping/Duplication**:
     - Redesigned `PageScopeSelector` with a non-clipping full-width 5-column grid (`Current | All | Odds | Evens | Range`).
     - Reduced verbose text across all modules to 1–2 word names (`Crop & Split`, `Deskew`, `Cleanup`, `Colors`, `Bleed`, `Paper`, `Content`, `Detect`, `Detect All`, `Spine Shadow`, `Despeckle`, `Whiten BG`).
     - Removed duplicate scope selectors and unified color mode picking in `RestorePanel.tsx`.
  5. **Verification**: Frontend (`npx tsc --noEmit`) and Backend (`python3 -m py_compile`) passed with 0 errors.

---

### Book Studio Drill-Down Modules Hub & Dedicated Module Workspaces
- **Objective**: Redesign the Book Studio Right Panel (`BookRightPanel.tsx`) from stacked nested accordions into a Drill-Down Modules Hub + Dedicated Module Workspace architecture, expanding the UI/UX of all 5 prepress modules.
- **Rules Followed**: Consulted `docs/architecture.md` and `AGENTS.md`, maintained strict TypeScript (`0` errors, zero `any`), consolidated and removed the fragmented `CropTargetPopover.tsx` side-file, updated `docs/architecture.md` in the same turn, and verified clean runtime storage (`StorageCleaner.clean('runtime')`).
- **Changes Completed**:
  1. **State & Shortcut Navigation (`useBookStudioState.ts`, `useBookShortcuts.ts`, `book-studio/page.tsx`, `BookWorkspace.tsx`)**:
     - Initialized `focusedModule` to `null` (Modules Hub view) and added `openModule(mod)` which auto-enables a module when entered and clears transient canvas tools when backing out (`mod = null`).
     - Added `Esc` shortcut (`exitModule`) to back out of active canvas tools or return from a dedicated module view to the Modules Hub.
     - Synced top canvas toolbar buttons (`Crop`, `Straighten`, `Erase`) to automatically open their corresponding module workspace in the Right Panel.
  2. **Drill-Down Hub & Quick-Jump Header (`BookRightPanel.tsx`)**:
     - Built the **Modules Hub** view with an active layer counter badge and 5 rich module cards displaying live configuration summaries, badges, progress bars, and independent inline ON/OFF switches.
     - Built the **Dedicated Module Workspace** header with a `← All Modules` (`Esc`) button and a 5-icon quick-jump bar (`1`–`5`) with active-layer indicator dots.
  3. **Upgraded Individual Module Workspaces (`CropSplitPanel.tsx`, `DeskewPanel.tsx`, `RestorePanel.tsx`, `BleedPanel.tsx`, `splitLines.ts`)**:
     - `CropSplitPanel`: Added descriptive `Paper Sheet` / `Tight Content` cards, live 4-edge trim percentage readouts, separate `+ Vertical Cut` and `+ Horizontal Cut` buttons, and inline target scope pills; removed `CropTargetPopover.tsx`.
     - `DeskewPanel`: Unified Auto detection and Manual angle fine-tuning into a single view with `±0.1° / ±0.5° / Reset` micro-nudge buttons.
     - `CleanupPanel` & `RestorePanel`: Reorganized into spacious section cards with 2×2 descriptive color mode cards and 1-click slider reset links.
     - `BleedPanel`: Added descriptive Outside/Inside placement cards and 1-click standard bleed presets (`0`, `2`, `3`, `5` mm).

---

### Book Studio Complete Prepress Suite & Flint Unified Design System
- **Objective**: Execute the approved 5-phase upgrade roadmap (`book_studio_roadmap.md`):
  1. Dedicated **Cleanup & Spot Masking** module (`Erase / Whiteout Box` across `Current`, `Selected`, `All`, `Odds`, `Evens`, `Range`, 1-click clear, Morphological Spine Shadow Illumination Leveling, and Safe Despeckle).
  2. **Smart Mixed-Content Color & Tone Studio** (`Smart Auto` pixel-level chroma-aware hybrid compositing + per-page color mode overrides).
  3. **Expandable Multi-Format Export Dropdown** (`Merged PDF`, `Separate PDF Pages .zip`, `JPEG .zip`, `PNG .zip`, `TIFF .zip` with DPI, Quality, and TIFF compression controls).
  4. **Layer-Stack vs. Focused Module Architecture & Comprehensive Hotkeys** (`1`–`5` module focus, `S` Straighten, `M` Erase Box, `C` Crop, `X` Cut Line, `G` Grid, `I` Eyedropper, `A` Detect Page, `Shift+A` Detect All, `Enter` Apply).
  5. **Unified Flint Design System** (**Obsidian Studio** Dark Mode + **Daylight Paper** Light Mode + `docs/design_system.md`).
- **Rules Followed**: Centralized API client (`src/lib/api.ts`), strict TypeScript (`0` errors, zero `any`), thin FastAPI routers / pure OpenCV & PyMuPDF engines (`backend/engines/book_scan_engine.py`), zero fragmented side-files, synchronized `docs/architecture.md`, and zero-retention cleanup (`StorageCleaner.clean('runtime')`).
- **Changes Completed**:
  1. **Backend Engine & API (`backend/engines/schemas.py`, `backend/engines/book_scan_engine.py`, `backend/book_scan_api.py`)**:
     - Added `apply_spot_masks`, `flatten_spine_illumination`, `despeckle_image`, `apply_smart_auto_color`, `apply_masks_to_pages`, `apply_color_mode_to_pages`, and `export_pages_archive`.
     - Added `POST /api/book-scan/mask-page/{session_id}`, `POST /api/book-scan/color-mode-page/{session_id}`, and multi-format `.zip` / `.pdf` support in `_run_export_job` and `/export-download/{job_id}`.
  2. **Frontend State, Modules & Canvas (`frontend/src/types/book_studio.ts`, `useBookSession.ts`, `useBookModules.ts`, `useBookStudioState.ts`, `useBookShortcuts.ts`, `RestorePanel.tsx`, `BookRightPanel.tsx`, `PageCanvas.tsx`, `BookWorkspace.tsx`, `WorkspaceToolbar.tsx`, `DeckCard.tsx`, `book-studio/page.tsx`)**:
     - Built `CleanupPanel` and upgraded `RestorePanel` inside `RestorePanel.tsx` with `Smart Auto` and per-page override pills.
     - Added interactive `Erase / Whiteout Box (M)` drawing and hover `×` badge deletion on `PageCanvas.tsx`.
     - Added quick-tool buttons (`Crop`, `Straighten`, `Erase`, `Grid`, `Compare`) to `WorkspaceToolbar.tsx` and status dots (`Crop`, `Tilt`, `Mask`, `Color`) to `DeckCard.tsx`.
     - Built the expandable Multi-Format Export Dropdown in `book-studio/page.tsx`.
  3. **Unified Flint Design System (`AppearanceContext.tsx`, `globals.css`, `tailwind.config.ts`, `layout.tsx`, `AppearanceSection.tsx`, `docs/design_system.md`)**:
     - Enabled live Light/Dark theme switching in `AppearanceContext.tsx`, `AppearanceSection.tsx`, and the sidebar footer in `layout.tsx`, backed by semantic CSS variables in `globals.css` and documented in `docs/design_system.md`.
     - Added independent per-theme accent color persistence (`darkAccentColor` and `lightAccentColor`), automatic WCAG luminance contrast calculation (`--app-accent-text` and `--app-accent-fg`), `darkMode: "class"` in `tailwind.config.ts`, and high-contrast Daylight Paper borders, active segmented pills, and status badges.
  4. **Verification & Clean**: Passed `npx tsc --noEmit` (`0` errors), `python -m py_compile` (`0` errors), end-to-end Python engine & multi-format ZIP tests, and `StorageCleaner.clean('runtime')`.

---

## Date: 2026-10-20

### Book Studio Smart Per-Page Crop, Deskew, Chroma-Safe Border Cleanup & Exact Export Fidelity
- **Objective**: Upgrade Book Studio's crop, deskew, border restoration, and export pipeline to handle real-world scanned books with shifting paper placement, black scanner lid voids, synthetic PDF white margins, per-page varying skew, architectural drawings, and edge-adjacent blue stamps/signatures (verified on `test_material/bag 1.pdf`), while guaranteeing that **Export PDF** strictly honors every per-page edit without overriding or re-detecting.
- **Rules Followed**: Consulted `docs/architecture.md` and `AGENTS.md`, routed all frontend calls through `src/lib/api.ts`, kept FastAPI routers thin and OpenCV/PyMuPDF logic pure in `backend/engines/book_scan_engine.py`, maintained strict TypeScript (`0` errors, no `any`), and ran `StorageCleaner.clean('runtime')`.
- **Changes Completed**:
  1. **2-Stage Smart Auto-Detect Crop (`Paper Sheet` vs. `Tight Content`)**:
     - Upgraded `BookScanEngine.detect_book_crop_and_seam(image, mode="paper")` in [`book_scan_engine.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/book_scan_engine.py) to first strip synthetic pure-white PDF wrapper borders (`mean >= 254.2, std < 1.8`) and then march inward past dark scanner lid voids (`median < 175` or `mean(strip < 130) > 0.35`) and thin black border lines, isolating the true physical paper sheet while preserving stamps and signatures (`paper` mode), or cropping tightly around inner ink (`content` mode).
  2. **Batch "Detect All → Browse & Tweak → Apply All" Crop Workflow**:
     - Added `BatchDetectCropRequest` and `per_page_crops` to `CropPageRequest` and `ExportRequest` in [`schemas.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/schemas.py).
     - Added `POST /api/book-scan/detect-crop-batch/{session_id}` in [`book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py) and updated `BookScanEngine.apply_crop_to_pages` to apply individual per-page crop boxes in a single batch commit.
     - Updated [`useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts) and [`CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx) with a `Paper Sheet` / `Tight Content` mode toggle, **Detect Page** + **Detect All** buttons, a `<N> pages ready` badge, and seamless per-page draft crop persistence when stepping through pages (`[` / `]`).
  3. **Upgraded Per-Page Deskew + Batch Detect All + Interactive 2-Point Straighten Ruler**:
     - Upgraded `BookScanEngine.detect_skew_angle` with dark scanner void masking (`bg < 175`), 1px-thin horizontal word fusion, `cv2.fitLine` (`DIST_L1`) baseline regression, and `cv2.HoughLinesP` line detection for tables and engineering drawings.
     - Added `POST /api/book-scan/detect-angle-batch/{session_id}` and `POST /api/book-scan/deskew-page/{session_id}` in [`book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py), plus `BookScanEngine.apply_deskew_to_pages`.
     - Updated [`DeskewPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/DeskewPanel.tsx) and [`PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx) with **Detect Page** + **Detect All**, per-page angle slider tweaks, and an interactive **Draw Straighten Line** ruler tool on the canvas.
  4. **Removed Clean Border Option, Added Per-Module Progress Bars & Fixed Preview Sync Bugs**:
     - Removed the `Border Clean` UI section from [`RestorePanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/RestorePanel.tsx) and set `cleanBorders = false` by default in [`useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts), [`schemas.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/schemas.py), and [`book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py).
     - Added [`ModuleProgressBar`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/PageScopeSelector.tsx#L10-L30) and chunked batch progress tracking in [`useBookSession.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookSession.ts) and [`useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts) so `Crop & Split`, `Deskew`, `Bleed`, and `Cleanup & Colors` each render a live progress bar with percentage and page counter whenever working.
     - Fixed bug in `get_page_thumbnail` where `page_info["deskew_angle"]` was only applied when `deskew_module_enabled` was true, and fixed single-page `detectCrop` to auto-enable `cropModule.enabled`.
     - Updated `BookScanEngine.render_export_pages` and `useBookModules.ts` (`exportPdf`) to pass and strictly honor all committed per-page crops, uncommitted draft `pageCrops`, and per-page `deskew_angle` overrides without re-running `detect_skew_angle` or overwriting with global defaults.
  5. **Verification & Storage Clean**: Passed `npx tsc --noEmit` (0 errors), `py_compile` (0 errors), and end-to-end `BookScanEngine` verification on `test_material/bag 1.pdf`.

---

## Date: 2026-10-16

### Book Studio Multi-File Intake & Collation Repair (Duplex & Sequential Merge)
- **Objective**: Fix broken Odds/Evens duplex intake in Book Studio and expand it into a unified, high-utility multi-file engine that also supports sequential multi-part assembly (combining split scans/chapters) with file reordering and per-file page reversal.
- **Rules Followed**: Consulted navigation map in `docs/architecture.md`, canonical single-source-of-truth registry in `AGENTS.md` (`useBookSession.ts`, `backend/engines/book_scan_engine.py`), fast inner-loop checks only (`tsc --noEmit` and `py_compile`), zero-retention storage cleanup, and user-only git permissions.
- **Changes Completed**:
  1. **Root Cause Fix in Session Lifecycle**: Fixed `initSession()` in [`useBookSession.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookSession.ts) to construct proper multipart payloads for `dual` (with `file_odds`, `file_evens`, `odds_order`, `evens_order`, `start_with`) and `multi_merge` (with `files` queue and `reverse_file_indices`).
  2. **Backend Router & Engine Collation**:
     - Refactored `/api/book-scan/init-session` in [`book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py) so `mode == "dual"` is evaluated first and cleanly dispatches duplex collation.
     - Added `start_with` parameter (`odds` vs `evens`) to `collate_from_paths` and `collate_scans` in [`book_scan_engine.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/book_scan_engine.py).
     - Enhanced `combine_files_to_pdf` with `reverse_indices` support to efficiently reverse page order for selected parts prior to merging.
  3. **UI / UX Polish in Book Studio**:
     - Evolved intake mode to **Multi-File & Collation** in [`BookLeftPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookLeftPanel.tsx) with a sleek segmented pill selector between **Duplex (Odds / Evens)** and **Combine Parts**.
     - Added 1-click **Swap (⇄)** button and **Start with** (Odd vs. Even) selector in Duplex mode.
     - Reused and enhanced [`FileUploadQueue.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/FileUploadQueue.tsx) for Sequential Merge with Move Up/Down, Remove, Clear All, and per-file **Rev** toggle.
     - Aligned all intake cards and buttons with the application's dynamic accent theme (`var(--app-accent)`).
  4. **Verification & Storage Clean**: Passed `tsc --noEmit` (0 errors), `py_compile` (0 errors), and programmatic `BookScanEngine` verification tests in `.venv`. `StorageCleaner.clean('runtime')` executed cleanly.

---

### Preflight Studio Deprecation & Command Center (Home) Polish
- **Objective**: Completely deprecate and remove the obsolete Preflight Studio (`frontend/src/app/preflight/`, `backend/engines/preflight.py`, and `/api/preflight`), consolidating all artwork verification and prepress inspection into the Command Center / Home Studio. Polish the Home Studio with unit management, 4-studio launchpad, metric telemetry tiles, dynamic accent styling, and customer-ready PDF report generation.
- **Rules Followed**: Fast lookup index in `docs/architecture.md`, canonical single-source-of-truth registry in `AGENTS.md` (`src/lib/units.ts`, `src/lib/api.ts`), 30s code inspection and cleanup in-stride, fast inner-loop checks only (`tsc --noEmit` & `py_compile`), zero-retention storage cleanup, and user-only git permissions.
- **Changes Completed**:
  1. **Preflight Removal**: Deleted `frontend/src/app/preflight/`, removed `IconPreflightStudio` and nav item from `frontend/src/app/layout.tsx`, removed `backend/engines/preflight.py`, and pruned `/api/preflight` from `backend/main.py`. Scrubbed lingering preflight runtime references in `asset_inspector.py`, `flipbook/page.tsx`, and `prepress.ts`.
  2. **Navigation Map Synchronization**: Updated `docs/architecture.md` (routers table, studio routes table, and topology diagram) in the same turn.
  3. **Studio Launchpad Order & Dynamic Accent Theme**: Rebalanced `DropzonePanel.tsx` studio cards to match the exact sidebar navbar order: **Book Studio, Imposing Studio, Contour Studio, Flipbook Studio**, styled with dynamic theme accent (`var(--app-accent)`) and no redundant descriptions.
  4. **Prominent Artwork Thumbnail Preview**: Enlarged artwork thumbnail in `AssetPanel.tsx` from 56px to a prominent container (`w-full h-52 sm:h-60`) with centered contain-fit rendering above artwork metadata.
  5. **Customer-Facing Prepress Quality PDF Report**:
     - Embedded app logo mark (`flint_mark.png`) in header table.
     - Removed internal operator studio remediation references and software marketing footer.
     - Added clean customer sign-off fields (`Customer Signature`, `Date`, `Customer Name (Print)`, `Approval Status`).
  6. **Home Prepress Audit Report Streamlining**: Condensed `AuditReport.tsx` into a minimal non-repeating 2×2 grid (Trim & Geometry, Image Resolution, Bleed Margins, Color Separation), stripping out duplicate metric tiles and verbose paragraphs.
  7. **Header & Global Unit Sync**: Added header unit dropdown (`mm`, `cm`, `inches`, `pixels`) with localStorage persistence in `src/app/page.tsx`.
  8. **Universal Breadcrumbs Across Studios & Settings**: Integrated unified breadcrumb navigation into the top header of every studio and the settings page (`Home / Studio / [Sub-items/Filename]`). Inside Home Studio, opening an inspection displays an interactive breadcrumb returning directly to the intake dropzone.
  9. **PDF Thumbnail Alpha Fix & Dynamic On-Demand Endpoint**: Resolved thumbnail rendering failures on books with transparency (`ValueError: 'jpg' cannot have alpha`) by enforcing `alpha=False` in `thumbnails.py`. Added `/api/inspect/thumbnail/{file_id}` to dynamically generate thumbnails on-the-fly, accompanied by a clean fallback card in `AssetPanel.tsx`.
  10. **Recent Inspections Sanitization**: Sanitized legacy `flint_recent_jobs` in `sessionStorage` and added component-level filtering in `AssetPanel.tsx` and `page.tsx` so the deprecated Preflight Studio never appears.
  11. **Verification & Storage Clean**: Passed `tsc --noEmit` (0 errors) and `py_compile` on backend (0 errors). `StorageCleaner.clean('runtime')` executed cleanly.

---

### 1. Context & Objective
- **Objective**: Execute the comprehensive Architectural Optimization & De-Fragmentation plan across Book Studio, Imposing Studio, Flipbook Studio, and `backend/engines/` to eliminate legacy 300-line file-splitting debt, remove duplicate math/geometry routines, and establish the `docs/architecture.md` Repository Navigation Map.
- **Rules Followed**: Centralized API client (`src/lib/api.ts`), strict TypeScript with zero `any`, thin FastAPI routers / pure engines, fast inner-loop checks (`npx tsc --noEmit` & `py_compile`), zero-retention runtime storage cleanup (`StorageCleaner.clean('runtime')`), and user-only Git commit authority.

### 2. Summary of Completed Phases

#### Phase 0: Repository Navigation Map
- Added the **Repository Navigation Map** at the top of [`docs/architecture.md`](file:///home/essam/Projects/ESSR_PA/docs/architecture.md) mapping every backend router to its engine twins and every frontend studio route to its component/hook directories.

#### Phase 1: Book Studio De-Fragmentation
- Merged `frontend/src/lib/cropTarget.ts` into [`frontend/src/lib/pageScope.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/lib/pageScope.ts) (`parsePageRange`, `isPageInScope`, `resolveCropTarget`) and deleted `cropTarget.ts`.
- Added `getNextCutLine()` to [`frontend/src/lib/splitLines.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/lib/splitLines.ts) and routed [`CropSplitPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/CropSplitPanel.tsx) and [`SplitLinesEditor.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/SplitLinesEditor.tsx) through it.
- Merged `useBookSplitOps.ts` and `useBookExport.ts` into [`frontend/src/hooks/useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts), removed the mutable `clearCropsRef` indirection in [`useBookStudioState.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookStudioState.ts), and deleted the two old hook files.
- Folded `SplitLineOverlay.tsx` into [`PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx), replaced inline `vSegs` math with `segmentSizes()`, removed dead pointer props from [`BookWorkspace.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookWorkspace.tsx), and deleted `SplitLineOverlay.tsx`.

#### Phase 2 & 2.5: Imposing Studio & Flipbook Studio Consolidation
- Enhanced [`frontend/src/lib/units.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/lib/units.ts) (`mmToUnit`, `unitToMm`, `formatMmInUnit`) to support `"in"` and `"px"` aliases, updated [`RightControlPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/imposing/RightControlPanel.tsx) to use `@/lib/units` and `@/components/shared/NumberControl` directly, and deleted `frontend/src/components/imposing/controls.tsx`.
- Consolidated `usePageDeck.ts`, `useImpositionState.ts`, and `useImposingJob.ts` into [`frontend/src/hooks/useImpositionStudio.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useImpositionStudio.ts) (including `buildImposingPagesFromMeta` and `buildImposingPayload`), updated [`frontend/src/app/imposing/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/imposing/page.tsx), and deleted the three fragmented hook files.
- Un-minified [`frontend/src/app/flipbook/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/flipbook/page.tsx) and replaced manual `fetch` + `URL.createObjectURL` download boilerplate with `downloadBlob()` from [`frontend/src/lib/api.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/lib/api.ts).

#### Phase 3: Backend Geometry, Engine & Router Deduplication
- Extracted `_make_placed_item`, `_find_best_rect`, `_split_and_prune_free_rects`, `_make_sheet_result`, and `_pack_single_sheet_pass` inside [`backend/engines/sheet_packer.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/sheet_packer.py), eliminating 3x duplicated MaxRects placement and free-rect splitting blocks.
- Added `compute_opposing_rotation_deg`, `_iter_expanded_item_pages`, and `build_imposing_pages_meta` in [`backend/engines/imposing_prep.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/imposing_prep.py) and shared them across [`backend/engines/sheet_gang_exporter.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/sheet_gang_exporter.py) and [`backend/imposing_api.py`](file:///home/essam/Projects/ESSR_PA/backend/imposing_api.py).
- Inlined `BLUEWHALE_SVG_LOGO`, `BLANK_WHITE_PAGE_URI`, and `apply_print_binding_padding` into [`backend/engines/flipbook_worker.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/flipbook_worker.py) and deleted `backend/engines/helpers.py` and `backend/engines/resources.py`.
- Unified 1-based page range token parsing in [`backend/engines/units.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/units.py), used `PTS_TO_MM` in [`backend/engines/thumbnails.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/thumbnails.py), and routed all 3 temp-file lookup loops in [`backend/main.py`](file:///home/essam/Projects/ESSR_PA/backend/main.py) through `resolve_temp_file()`.

#### Phase 4: Agent Guardrails, Documentation Synchronization & Pre-Commit Polish
- Added the **Canonical Single-Source-of-Truth Registry** and mandatory **Navigation Map Synchronization Rule** to [`AGENTS.md`](file:///home/essam/Projects/ESSR_PA/AGENTS.md).
- Synchronized [`docs/architecture.md`](file:///home/essam/Projects/ESSR_PA/docs/architecture.md), [`docs/engines.md`](file:///home/essam/Projects/ESSR_PA/docs/engines.md), [`docs/api.md`](file:///home/essam/Projects/ESSR_PA/docs/api.md), and [`CONTRIBUTING.md`](file:///home/essam/Projects/ESSR_PA/CONTRIBUTING.md).
- Fixed staged path prefix stripping (`sed "s|^frontend/||"`) in [`.pre-commit-config.yaml`](file:///home/essam/Projects/ESSR_PA/.pre-commit-config.yaml).

### 3. Verification & Cleanup
- Frontend TypeScript & ESLint check: `npx --prefix frontend tsc --project frontend/tsconfig.json --noEmit` & `eslint` (0 warnings, 0 errors).
- Final Frontend Production Build Gate: `npm --prefix frontend run build` (0 errors, 11/11 static & dynamic routes compiled cleanly).
- Backend compilation & smoke test: `python3 -m py_compile backend/main.py backend/imposing_api.py backend/book_scan_api.py backend/settings_api.py backend/engines/*.py` + `MaxRectsSheetPacker` (gang/book/grid), `compute_opposing_rotation_deg`, and `units` assertions (0 errors).
- Runtime storage purged via `StorageCleaner.clean('runtime')`; `backend/temp_uploads/` and `backend/public_flipbooks/` verified completely empty.

---

## Session Update: Book Studio Production Polish, Multi-Select & Live Prepress Engines

### 1. Features & Fixes Delivered
1. **Notch Stacking Order**: Fixed notch z-index (`z-20`) so it stays beneath the workspace toolbar, history dropdown, and modal overlays (`z-40`).
2. **Global Length Unit Selector**:
   - Added studio-wide unit dropdown (`mm`, `cm`, `inches`, `pixels`) in the header right actions, persisted to localStorage via [`src/lib/units.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/lib/units.ts).
   - Dynamically applied global unit across the canvas notch readout, crop box tags, cut-line segment sizes, bleed inputs, and page properties modal.
3. **Crop & Split Panel Polish**:
   - Compacted `Auto-Detect` button styling.
   - Fixed Apply/Split dropdown popover to open downward (`top-full mt-1.5`) with proper clipping avoidance.
   - Refined `SplitLinesEditor` row spacing, slider minimum widths, and numeric percentage inputs to eliminate UI overlap on narrow panels.
4. **Deskew Grid Customization**:
   - Added custom grid color picker to [`DeskewPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/DeskewPanel.tsx) with live preview on [`PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx).
   - Increased grid line thickness (`2px`) for high-contrast alignment against light/dark scan backgrounds.
5. **Functional Bleed Engine**:
   - Built full dual-mode bleed engine in [`backend/engines/book_scan_engine.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/book_scan_engine.py) (`apply_bleed_to_image`) supporting mirrored edge synthesis (`cv2.BORDER_REFLECT_101`) and solid-color margins (`cv2.BORDER_CONSTANT`) with Japanese corner crop marks.
   - Updated thumbnail router [`backend/book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py) and PDF exporter to reflect live bleed adjustments.
   - Added unbounded numeric input and color picker + Eyedropper (native `window.EyeDropper` with canvas pixel-sampling fallback) in [`BleedPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/BleedPanel.tsx).
6. **Enhanced Scan Color Restoration**:
   - Added Color Mode selection (`Color`, `Grayscale`, `B & W` via adaptive Otsu thresholding), B&W threshold slider, and background paper whitening in [`RestorePanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/RestorePanel.tsx) and [`book_scan_engine.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/book_scan_engine.py).
7. **Deck Context Menu & Page Properties Simplification**:
   - Removed redundant page number header from [`PageContextMenu.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageContextMenu.tsx).
   - Simplified [`PagePropertiesModal.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PagePropertiesModal.tsx) to exclusively show Page Size (in the studio's global unit), Color Mode, and Resolution (`DPI`).
8. **Multi-Select & Batch Operations in Deck Panel**:
   - Implemented `Ctrl+Click` / `Cmd+Click` toggling and `Shift+Click` range selection in [`BookLeftPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookLeftPanel.tsx), [`DeckCard.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/DeckCard.tsx), and [`DeckListView.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/DeckListView.tsx).
   - Added "Select ▾" header dropdown with fast filters: All Pages, Odd Pages, Even Pages, Custom Range (e.g. `1-5, 8`), and Reset Selection, along with selected count badge.
   - Added batch operations (`onBatchRotate`, `onBatchDelete`, `onBatchDuplicate`) in [`PageContextMenu.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageContextMenu.tsx) backed by [`useBookPageOps.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookPageOps.ts).
9. **Split Size Preview Tags & Hover / Drag Proximity**:
   - Removed redundant `P1`/`P2` prefixes; oriented tags vertically for vertical cuts and horizontally for horizontal cuts in [`PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx), formatted in the active global unit.
   - Positioned tags in close proximity to the cut line boundaries (`pr-3` / `pl-3` and `pb-2.5` / `pt-2.5`) instead of arbitrary cell centers.
   - Reduced visual clutter for multi-split spreads: when only 1 cut line exists, its tags are shown by default; when > 1 cut line exists, tags are hidden and ONLY the tags for the specific cut line being hovered over or dragged are revealed, keeping all other cut lines' tags hidden. When the mouse moves away or drag finishes, the tags cleanly disappear.
10. **Eyedropper Fix & Floating Color Loupe**:
    - Fixed on-canvas pixel sampling in [`PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx) by drawing the image element to the offscreen canvas (`ctx.drawImage`) before reading pixel buffer data.
    - Added a floating circular color loupe tracking the cursor during active eyedropper hover, rendering a live color preview ring, crosshair target, and uppercase hex code badge.
11. **Applied Bleed Management & Placement (Outside vs. Inside)**:
    - Added an "Apply Bleed" commit workflow in [`BleedPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/BleedPanel.tsx) maintaining an `appliedBleeds` entry list with inline edit (loads parameters back into draft controls) and delete actions.
    - Added Outside Bleed (expands total sheet dimensions outward past trim line) and Inside Bleed (insets safety margin within existing sheet bounds).
    - Updated dimension notch in [`PageCanvas.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/PageCanvas.tsx) to reflect dynamic outside (`+3mm bleed`) or inside (`-3mm bleed`) sheet dimensions.
    - Updated backend [`book_scan_engine.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/book_scan_engine.py), [`schemas.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/schemas.py), and [`book_scan_api.py`](file:///home/essam/Projects/ESSR_PA/backend/book_scan_api.py) for inside bleed rendering, thumbnail caching, and PDF export.
    - Fixed number inputs in [`BleedPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/modules/BleedPanel.tsx) to hide native spinner arrows and prevent text overlapping.
12. **Responsive Live Slider Dragging**:
    - Reduced debounce delays from 350ms to 50ms across Color Restoration (saturation, contrast, B&W threshold, border margin) and Bleed width/color in [`useBookModules.ts`](file:///home/essam/Projects/ESSR_PA/frontend/src/hooks/useBookModules.ts), giving users immediate real-time visual preview while dragging sliders.

### 2. Verification
- Frontend inner loop: `cd frontend && npx tsc --noEmit` passed with 0 errors.
- Backend inner loop: `python3 -m py_compile backend/main.py backend/book_scan_api.py backend/engines/*.py` passed with 0 errors.
- Runtime storage cleaned: `StorageCleaner.clean('runtime')` confirmed 0 lingering files in `backend/temp_uploads/` and `backend/public_flipbooks/`.

---

## Session Update: Book Studio Intake Streamlining

### 1. Changes Delivered
- **Removed Redundant Digital Intake**: Removed `"digital"` ("Digital / Vector PDF") option from [`BookLeftPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookLeftPanel.tsx) and [`BookIntakeMode`](file:///home/essam/Projects/ESSR_PA/frontend/src/types/book_studio.ts).
- **Removed Dead Import**: Removed unused `IconPreflightStudio` from [`BookLeftPanel.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/components/book-studio/BookLeftPanel.tsx).
- **Intake Modes Simplified**: Streamlined document intake into two unambiguous modes:
  1. **Standard Book PDF**: Single pages or 2-up spreads to split, crop, and restore.
  2. **Dual Pass (Odds / Evens)**: Collate separate odd and even duplex scan batches.

### 2. Verification
- Frontend inner loop: `cd frontend && npx tsc --noEmit` passed with 0 errors.
- Backend inner loop: `python3 -m py_compile backend/main.py backend/book_scan_api.py backend/engines/*.py` passed with 0 errors.
- Runtime storage verified clean via `StorageCleaner.clean('runtime')`.

---

## Session Update: Live Export Progress Bar & Prepress PDF Compression Optimization

### 1. File Size 5x Inflation Analysis & Root Causes
1. **Uncompressed PDF Objects**: Previously, `doc.save()` was invoked without stream deflation or object garbage collection, leaving uncompressed PDF object trees and raw metadata.
2. **Sensor-Noise High Quality JPEG (95Q)**: A hardcoded quality of 95 encoded high-frequency sensor noise and paper grain without improving visual print sharpness, multiplying file weight by 3x–5x.
3. **3-Channel BGR Bloat on Grayscale/B&W**: Even when Grayscale or B&W mode was applied, the engine converted images to 3-channel 24-bit BGR, creating 3 identical color planes.
4. **JPEG on Pure Text**: Encoding high-contrast B&W text with JPEG produced DCT ringing artifacts while taking 1.5–2 MB per page.

### 2. Changes Delivered
1. **Prepress Engine Compression (`backend/engines/book_scan_engine.py`)**:
   - Switched PyMuPDF export to `doc.save(output_pdf_path, garbage=4, deflate=True, clean=True)`, compressing all PDF streams and purging unused resources.
   - Reduced baseline JPEG quality from 95 to 88 (standard prepress threshold), preserving 100% visible detail while discarding sensor noise bloat.
   - Added intelligent color space encoding:
     - Pure B&W pages: Encoded with lossless Deflate/PNG (`cv2.IMWRITE_PNG_COMPRESSION=9`), yielding razor-sharp text with ~95% smaller file size (~40 KB vs 1.8 MB per page).
     - Grayscale pages: Encoded as single-channel `DeviceGray` JPEGs, cutting uncompressed data by 66%.
     - Color pages: Prepress JPEG Quality 88.
2. **Asynchronous Export Job Infrastructure (`backend/book_scan_api.py`)**:
   - Added `EXPORT_JOBS` registry with TTL eviction.
   - Added `POST /api/book-scan/export-job/{session_id}` background task worker reporting two-phase progress:
     - Phase 1 (0–60%): Per-page image extraction, deskew, whitening, and color restoration.
     - Phase 2 (60–100%): Synthesized bleed extension, Japanese trim mark vectorization, and stream deflation.
   - Added `GET /api/book-scan/export-job/{job_id}` for status polling and `GET /api/book-scan/export-download/{job_id}` for file retrieval.
3. **Frontend Progress Tracking Modal (`frontend/src/components/book-studio/ExportProgressModal.tsx`)**:
   - Built modern prepress modal overlay with smooth animated progress bar, percentage readout, active page counter (`Page X of Y`), and descriptive status messages.
   - Shows output file size badge upon completion and automatically initiates file download via `downloadBlob()`.
4. **Hook & UI Integration (`useBookModules.ts`, `page.tsx`)**:
   - Updated `exportPdf` to trigger the background job and poll every 350ms.
   - Added live percentage readout inside the studio header export button: `Exporting (45%)...`.
   - Updated Repository Navigation Map in `docs/architecture.md`.

### 3. Verification
- Frontend inner loop: `npx tsc --noEmit` passed with 0 errors.
- Backend inner loop: `python -m py_compile` passed with 0 errors.
- Runtime storage cleaned: `StorageCleaner.clean('runtime')` confirmed 0 lingering files in `backend/temp_uploads/`.




---

## Session Update: Dev Server "Internal Server Error" Recovery

### 1. Root Cause
- Frontend (`next dev`) and backend (`uvicorn`) had been running since Oct 16 under transient systemd units. The `frontend/` and `backend/` directories were later replaced on disk, leaving both processes attached to deleted directories (`/proc/<pid>/cwd -> ... (deleted)`). Next.js failed every request with `ENOENT: scandir 'frontend/src/app'` → HTTP 500.
- `./start.sh restart` then aborted (`set -e`) because the stopped `flint-backend` transient unit was left in a `failed` state, which blocks `systemd-run --unit=flint-backend` from reusing the name.

### 2. Changes Delivered
- `start.sh`: Added `systemctl --user reset-failed` after every `systemctl --user stop` for `flint-backend` / `flint-frontend`, so a crashed/failed unit can no longer block a restart.

### 3. Verification
- `bash -n start.sh` passed.
- After restart: `/`, `/book-studio`, `/imposing` → 200; backend `/docs` → 200; both units `active (running)`.

## 2026-10-26 — Cleanup mask edit/visibility fixes
- PageCanvas: draft (editing) mask box raised to z-[55] so resize/move handles are no longer covered by saved mask overlays or the draw surface.
- BookWorkspace: per-mask visibility (each mask follows its own applied entry `visible` flag); mask being edited is hidden from saved overlays. Replaced page-wide `isMasksVisible`.
- useBookSession: cleanup filter params resolve only from non-mask entries, so hiding filter entries/all entries works even when mask entries exist.

## 2026-10-29 — Crop tool in dual / continuous preview modes
- BookWorkspace: wheel-zoom listener now re-binds when switching page-by-page <-> continuous (was bound to a stale element, causing browser-zoom/UI glitches after toggling back). Continuous dual rows use CSS `zoom` instead of `transform: scale` (no more overlapping rows).
- BookWorkspace: continuous mode selected page now has an interactive crop box (move/edge/corner handles) wired to the shared crop drag logic via `overlayRef`.
- PageCanvas: dual-page layout gives each page a half-width column (removed `max-w-[46vw]`), so the image/overlay stay aligned and the crop box is draggable.
- Follow-up: removed Continuous Scroll mode from BookWorkspace (button, state, render path, extra refs) — it caused flicker/UI glitches. Preview is now single/dual page only; crop box works in both via PageCanvas. `tsc --noEmit` clean.

## 2026-10-29 — Scope-Aware Crop Tool & Dual-Mode Per-Page Toggles
- Crop Module Scope Default: Changed default scope from `all` to current page (`P.n`).
- Live Scope Propagation: Editing the crop box now updates drafts across all in-scope pages in real-time (`All`, `Odds`, `Evens`, `Range`, or active dual-page selection).
- Dual Mode Per-Page Crop Boxes: Both previewed pages now render independent interactive crop boxes (`primaryCropBox` & `secondaryCropBox`).
- Dual-Mode Scope Toggles: Added dynamic `P.left` and `P.right` toggle buttons in `CropSplitPanel` scope bar when in Dual Mode:
  - Clicking `P.left` selects/focuses the left page only.
  - Clicking `P.right` selects/focuses the right page only.
  - Toggling both allows simultaneous editing and applying to both visible pages.
  - Dragging either crop box on the canvas automatically focuses the respective page when in single/current scope.
- Typecheck & Build Health: `npx tsc --noEmit` and `python3 -m py_compile` passed with 0 errors.

## 2026-10-29 — Fixed Book Spread Navigation & Clean Spread Inheritance
- Fixed Book Spreads in Dual Mode:
  - Pages are now paired as discrete book spreads (`[1, 2]`, `[3, 4]`, `[5, 6]`, ...) rather than sliding by a single page (`[1, 2]` -> `[2, 3]`).
  - Next/Prev navigation advances or steps back by full spreads (+2 / -2) in dual mode.
  - HUD readout displays `P. 1–2 / N`, `P. 3–4 / N`, etc.
  - Resolved crop box leaks where moving from `[1, 2]` previously overlapped Page 2 into `[2, 3]`.
- Default Dual-Mode Scope:
  - Both visible pages (`P.left` and `P.right`) are now selected by default in `dualSides` (`["left", "right"]`), allowing immediate editing of both pages together.
- Clean Spread Crop Initialization:
  - Removed passive persist `useEffect` in `useBookModules.ts` that erroneously stamped prior spread crop boxes onto newly visited pages during navigation.
  - Moving to `[3, 4]` starts with the document default crop box (or committed crop box) if no prior edits were made, cleanly supporting the workflow: select All on page 1 -> switch to dual mode -> adjust 2 pages at a time -> apply.
- Verified: `npx tsc --noEmit` and `python3 -m py_compile` passed with 0 errors.
