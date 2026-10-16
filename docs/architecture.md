# Architecture & System Design

ESSR_PA is a modular, high-performance prepress automation and web-to-print application designed for print shops, digital presses, and bindery operations.

---

## Repository Navigation Map (Fast Lookup Index)

> **Purpose:** Instant structural index mapping backend routers to their pure engine twins and frontend studio routes to their component directories. Consult this map first to eliminate blind directory searches.

### 1. Backend: Routers (`backend/`) $\leftrightarrow$ Pure Engines (`backend/engines/`)

| Primary Router File | API Prefix / Scope | Matching Engine Twin(s) (`backend/engines/`) |
| :--- | :--- | :--- |
| `backend/book_scan_api.py` | `/api/book-scan/*` (Sessions, Crop, Split, Deskew, Page Ops, History, Export) | `book_scan_engine.py`, `schemas.py` |
| `backend/imposing_api.py` | `/api/imposing/*` (Upload, Book & Gang Preview, Nesting, PDF/SVG Export) | `imposing_prep.py`, `sheet_packer.py`, `roll_packer.py`, `sheet_gang_exporter.py`, `thumbnails.py`, `schemas.py` |
| `backend/settings_api.py` | `/api/settings/*` (Presets CRUD, Defaults, Runtime Storage Cleanup) | `storage_cleaner.py` *(persists config to `backend/settings.json`)* |
| `backend/main.py` | `/api/inspect`, `/api/preflight`, `/api/contour/*`, `/api/flipbook/*`, `/api/report/*` | `asset_inspector.py`, `preflight.py`, `contour_engine.py`, `flipbook_worker.py`, `report_generator.py`, `units.py` |
| *Shared Engine Utilities* | Cross-engine helpers, geometry/unit math, Pydantic models | `schemas.py`, `units.py`, `thumbnails.py` |

### 2. Frontend: Studio Page Routes (`frontend/src/app/`) $\leftrightarrow$ Component Folders (`frontend/src/components/`)

| Studio Route & Page File | Component Folder (`frontend/src/components/`) | Key Components, Hooks & Utilities |
| :--- | :--- | :--- |
| **`/`** (Command Center & Triage)<br>`src/app/page.tsx` | `src/components/home/` | `DropzonePanel.tsx`, `AssetPanel.tsx`, `AuditReport.tsx`, `types.ts` |
| **`/book-studio`** (Scanned Book Studio)<br>`src/app/book-studio/page.tsx` | `src/components/book-studio/`<br>`src/components/book-studio/modules/` | **Views:** `BookWorkspace.tsx`, `PageCanvas.tsx`, `BookLeftPanel.tsx`, `BookRightPanel.tsx`, `WorkspaceToolbar.tsx`, `DeckCard.tsx`, `DeckListView.tsx`, `PageContextMenu.tsx`, `PagePropertiesModal.tsx`, `HistoryPopover.tsx`, `RestoreOriginalModal.tsx`, `RotateDropdown.tsx`, `FileUploadQueue.tsx`<br>**Modules:** `CropSplitPanel.tsx`, `SplitLinesEditor.tsx`, `CropTargetPopover.tsx`, `DimensionsBox.tsx`, `DeskewPanel.tsx`, `BleedPanel.tsx`, `RestorePanel.tsx`, `PageScopeSelector.tsx`<br>**Hooks (`src/hooks/`):** `useBookStudioState.ts`, `useBookSession.ts`, `useBookModules.ts`, `useBookPageOps.ts`, `useBookHistory.ts`, `useBookShortcuts.ts`<br>**Types & Lib:** `src/types/book_studio.ts`, `src/lib/splitLines.ts`, `src/lib/pageScope.ts`, `src/lib/units.ts` |
| **`/imposing`** (Book & Gang Imposition)<br>`src/app/imposing/page.tsx` | `src/components/imposing/` | `LeftAssetPanel.tsx`, `PreviewViewport.tsx`, `SheetCanvas.tsx`, `RightControlPanel.tsx`<br>**Hooks (`src/hooks/`):** `useImpositionStudio.ts`<br>**Types:** `src/types/prepress.ts` |
| **`/contour`** (Die-Cut Vectorization)<br>`src/app/contour/page.tsx` | `src/components/contour/` | `ContourViewport.tsx`, `ContourControls.tsx` |
| **`/flipbook`** (3D Virtual Proofing)<br>`src/app/flipbook/page.tsx` | `src/components/flipbook/` | `FlipbookViewport.tsx`, `FlipbookControls.tsx` |
| **`/preflight`** (PDF Geometry & DPI Audit)<br>`src/app/preflight/page.tsx` | *(Self-contained route)* + `src/components/home/` | Inline preflight view in `src/app/preflight/page.tsx`; executive audit shared via `src/components/home/AuditReport.tsx` |
| **`/settings`** (System & Presets Config)<br>`src/app/settings/page.tsx` | `src/components/settings/` | `SheetsSection.tsx`, `RollsSection.tsx`, `DefaultsSection.tsx`, `StorageSection.tsx`, `AppearanceSection.tsx`, `ShortcutsSection.tsx`, `types.ts` |
| *Shared Shell, Context & Core Libs* | `src/components/layout/`<br>`src/components/shared/`<br>`src/components/ui/` | `StudioLayout.tsx`, `DeckGrid.tsx`, `NumberControl.tsx`, `button.tsx`<br>**Context:** `src/context/AppearanceContext.tsx`<br>**Core Libs (`src/lib/`):** `api.ts`, `useDebounce.ts`, `units.ts`, `utils.ts` |

---

## High-Level Topology

```text
+--------------------------------------------------------------+
|                Tauri v2 Desktop Application Shell            |
|   Native Windowing * IPC * Python Sidecar Process Lifecycle  |
+--------------------------------------------------------------+
|               Next.js 14 App Router Webview                  |
|   React 18 * TypeScript Strict * Tailwind CSS * Lucide       |
|                                                              |
|   Studios:                                                   |
|   /             Command Center & Engine Heartbeat            |
|   /book-studio  Scanned Book Intake & Bleed Synthesis        |
|   /imposing     Gang Run, Multi-file Batch Ingest, Per-Item Stretch/Pad|
|   /contour      Die-Cut Contour Vectorization                |
|   /flipbook     Interactive 3D Virtual Proofing              |
|   /preflight    PDF Geometry, DPI, & Color Inspection        |
|   /settings     Substrate Sizes & Machine Presets            |
+------------------------------+-------------------------------+
                               |
                               | REST (JSON / Multipart)
                               | Client: src/lib/api.ts
                               v
+--------------------------------------------------------------+
|             FastAPI Sidecar Backend (Local Process)          |
|   Uvicorn * PyMuPDF * OpenCV * NumPy * Pydantic              |
|   Native In-Process BackgroundTasks & Asyncio Worker Pool    |
|                                                              |
|   Routers:                                                   |
|   main.py          /api/preflight, /api/contour, /api/flipbook|
|   imposing_api.py  /api/imposing (upload, preview, export)   |
|   book_scan_api.py /init-session, thumbnails, reorder, export|
|   settings_api.py  /api/settings (presets CRUD)              |
+--------------------------------------------------------------+
```

---

## Core Components

### 1. Desktop Shell (`src-tauri/`)
* **Framework:** Tauri v2.
* **Architecture:** Self-contained native binary hosting the Next.js frontend webview and orchestrating the FastAPI Python backend as a bundled sidecar executable. Zero external daemon or broker dependencies (runs natively across Linux and Windows without Docker or WSL).

### 2. Frontend (`frontend/`)
* **Framework:** Next.js 14 (App Router) with React 18 and strict TypeScript.
* **Styling & Components:** Tailwind CSS, shadcn/base-ui primitives, Lucide icons.
* **Unified Studio Shell (`StudioLayout.tsx`):** A centralized 3-slot layout (`leftPanel` for Decks/Assets, `centerViewport` for interactive canvas, `rightPanel` for Controls/Export) shared across studios. Features independent collapsible sidebars (`w-11` slim rails with expand triggers), global keyboard hotkeys (`[` and `]`), top breadcrumb toggles, and seamless edge-to-edge canvas expansion.
* **Book Studio Architecture:** Prioritized intake modes (Single Pages, 2-Up Spreads, Dual Pass, Digital PDF), 2-column visual thumbnail deck in Left Panel with drag-and-drop reordering, high-resolution full-page canvas with instant A/B raw scan comparison (Space/O shortcuts), non-passive cursor-centric `Ctrl + Wheel` zoom, HTML5 Fullscreen API inspection. Features a modular processing pipeline (crop, split, deskew, cleanup) with granular page scoping (all, odds, evens, custom ranges) and non-destructive seam splitting with interactive canvas overlays.
* **Imposition Workflow:** Features a dual-mode workflow separating **Book & Publication Imposition** (sequential page ordering, book trim presets, outward bleed synthesis, opposing page auto-alignment) from **Gang Run & Sticker Nesting** (MaxRects 2D bin packing, multi-file queue, continuous roll and cut-sheet ganging), housed inside `StudioLayout` with unconstrained canvas scaling.
* **API Communication:** All requests route through `src/lib/api.ts` (`API_BASE_URL` dynamically configured via `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8000`).
* **Reactive Throttling:** Real-time sliders (margins, gaps, thresholds, offsets) are throttled using `src/lib/useDebounce.ts` (350ms) to prevent network flooding and server load spikes.

### 3. Backend & Engine (`backend/`)
* **API Framework:** FastAPI running on Uvicorn as a local sidecar.
* **Task Processing:** Replaced external message brokers (Celery & Redis) with FastAPI's native `BackgroundTasks` and `asyncio` execution pool, processing multi-page rendering, contour vectorization, gang run nesting, and export tasks strictly within the local process.
* **Prepress Engines (`backend/engines/`):** Pure functional modules executing geometry, computer vision, raster/vector transformations, and PDF synthesis.
* **API Documentation:** Interactive OpenAPI documentation is automatically served by FastAPI at `http://localhost:8000/docs`.

---

## Data Flow & Storage Lifecycle

### Ephemeral Storage Policy & Memory Safety
ESSR_PA follows a strict **zero-retention / ephemeral storage policy**:
* Files uploaded to `/temp_uploads/` are processed immediately.
* Endpoints like `/api/preflight` automatically clean up temporary files in a `finally` block upon completion.
* **In-Memory TTL Cache Eviction:** On low-memory systems (4GB–8GB RAM), prolonged usage can accumulate stale file references and preview objects. `backend/main.py` and `backend/book_scan_api.py` run automated TTL eviction (`CACHE_TTL_SECONDS = 7200` / 2 hours) on `PROJECT_CACHE`, `CONTOUR_CACHE`, `CONTOUR_PREVIEWS`, and `SESSIONS`, unlinking expired disk assets and purging dictionaries.
* Generated export files (such as flipbook HTML assets or imposing PDFs) are stored temporarily in runtime directories (`backend/temp_uploads/` and `backend/public_flipbooks/`), which are ignored by version control.
* *Roadmap Goal:* Transition file processing to purely in-memory buffers or client-side storage to eliminate local disk reliance entirely.

### Persistent Application State
* Preset sizes (standard sheet sizes: SRA3, A3, A4, B2; continuous roll widths: 600mm, 1000mm, 1600mm; and studio defaults) are stored in `backend/settings.json`.
* State modifications are made through `settings_api.py` rather than direct manual edits.
