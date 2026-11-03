# API Reference & Integration

The backend is built with FastAPI. It automatically exposes standard, interactive **OpenAPI (Swagger)** documentation at:

```text
http://localhost:8000/docs
```

Or ReDoc at:
```text
http://localhost:8000/redoc
```

Developers and client integrators should refer to `/docs` for exhaustive Pydantic request models, query parameters, and JSON response schemas.

---

## Core API Pipelines

### 1. Asset Inspection & Prepress Audit (`/api/inspect/*`)
Managed in `backend/main.py`.

* **`POST /api/inspect`**: Universal asset intake and triage. Extracts trim boxes, millimeter dimensions, colorspace (CMYK/RGB/Spot), per-image DPI metrics, bleed compliance, generates high-res thumbnail previews, and registers the file for immediate cross-studio handoff.
* **`GET /api/inspect/report-pdf/{file_id}`**: Synthesizes and downloads an executive A4 Prepress Quality & Preflight Audit Report PDF with traffic-light compliance summaries, page-by-page findings, and remediation steps.
* **`POST /api/inspect/export-report-pdf`**: Accepts custom analysis payloads or cached file IDs and compiles the printable audit report PDF.

### 2. Imposition Pipeline (`/api/imposing/*`)
Managed by `backend/imposing_api.py`. Backed by SQLite WAL persistence (`SessionModel(studio_type="imposing")`).

* **`POST /api/imposing/upload`**: Uploads source artwork or PDF page to inspect geometry and dimensions. Pre-generates page thumbnails in background threads for instant lightbox display.
* **`POST /api/imposing/init-session`**: Initializes a persistent SQLite WAL imposing session from an uploaded file, staged asset ID, or local file path, indexing pages in the `pages` table.
* **`GET /api/imposing/session/{session_id}`**: Restores session layout parameters, substrate specs, and page deck state from SQLite WAL.
* **`PATCH /api/imposing/session/{session_id}`**: Debounced auto-save endpoint to transactionally persist layout parameters and page mutations.
* **`GET /api/imposing/pages/{file_id}`**: Retrieves granular page deck metadata (dimensions, aspect ratios, thumbnail URLs) for drag-and-drop deck reordering, rotation, and duplication.
* **`GET /api/imposing/thumbnail/{file_id}/{page_num}`**: Streams lazy, on-demand JPEG thumbnails for large multi-page publications.
* **`POST /api/imposing/preview`**: Accepts layout parameters (sheet dimensions, roll width, margins, spacing, rotation flag, manual rows × cols) and runs `sheet_packer` or `roll_packer`. Returns calculated layout metrics (yield count, waste percentage) and an SVG representation for live canvas visualization.
* **`POST /api/imposing/export`**: Renders the final print-ready PDF via `sheet_gang_exporter.py` with crop marks, registration targets, and bleed margins; marks the session as `tag="done"` and records an `ExportJobModel`.
* **`POST /api/imposing/export-svg`**: Generates a layered SVG with separated `Artwork` (print) and `CutContour` (die-cut vector) layers for digital flatbed cutter software.
* **`POST /api/imposing/ocr-inspect`**: Runs live PyMuPDF/Tesseract OCR inspection on a page, returning detected text blocks, bounding boxes, and script confidence.

### 3. Session Registry & Staged Intake Pipeline (`/api/sessions/*`, `/api/intake/*`)
Managed in `backend/sessions_api.py`. Backed by SQLite WAL persistence (`backend/db/`) and structured asset storage (`backend/storage/`).

* **`GET /api/sessions`**: Lists all persistent project sessions across all studios with filtering (`studio_type`, `status`, `tag`, `search`, `date_preset`), sorting, and pagination.
* **`GET /api/sessions/{session_id}`**: Retrieves complete session metadata, applied layer history, page records, and lock state.
* **`PATCH /api/sessions/{session_id}`**: Updates session title, studio tag (`active`, `done`, `starred`, `needs_review`), notes, or layout parameters.
* **`DELETE /api/sessions/{session_id}`**: Moves a project session to Trash (`status="trash"`).
* **`POST /api/sessions/{session_id}/restore`**: Restores a project session from Trash to `status="active"`.
* **`POST /api/sessions/trash/empty`**: Permanently cleans metadata records marked for trash disposal.
* **`GET /api/sessions/telemetry/stats`**: Returns real-time dashboard telemetry (active/archived project counts, total storage usage across originals, sessions, cache, and exports).
* **`GET /api/sessions/exports/jobs`**: Paginated server-side log of completed and active PDF export jobs with status filtering.
* **`GET /api/sessions/exports/{job_id}/download`**: Direct download endpoint for compiled PDF/archive deliverables.
* **`GET /api/intake/assets`**: Lists staged intake assets with pagination, search, and file-type filtering.
* **`POST /api/intake/upload-batch`**: Ingests files into the Staged Asset Workbench, recording metadata in `intake_assets` and storing files in `storage/originals/`.
* **`POST /api/intake/combine-sequential`**: Combines multiple selected staged assets sequentially into a single multi-page PDF saved directly back to the staging area.
* **`POST /api/intake/combine-duplex`**: Interleaves odd and even pass scans into a collation-ordered document in staging.
* **`PATCH /api/intake/assets/{file_id}`**: Renames a staged intake file.
* **`DELETE /api/intake/assets/{file_id}`** / **`DELETE /api/intake/assets`**: Removes single or batch assets from staging.

### 4. Die-Cut Contour Vectorization (`/api/contour/*`)
Managed in `backend/main.py`.

* **`POST /api/contour/upload`**: Ingests raster artwork or PDF and returns an image thumbnail along with detected dimensions.
* **`POST /api/contour/generate`**: Accepts thresholding mode, dilation/erosion offset (mm), smoothing factor, and area filtering. Runs `contour_engine.py` and returns the vectorized cut path as an SVG preview.
* **`GET /api/contour/export`**: Downloads the final cut path as a standalone SVG or PDF with designated spot-color die lines.

### 5. Book Scan Ingest & Cleanup (`/api/book-scan/*`)
Managed by `backend/book_scan_api.py`, backed by SQLite WAL persistence (`backend/db/`) and structured asset store (`backend/storage/`).

* **`POST /api/book-scan/init-session`**: Initializes a book scan session. Supports single-pass scans, 2-up double-page spreads, dual-pass duplex scans (odds/evens), and digital PDFs. Persists page records in SQLite and caches raw assets.
* **`GET /api/book-scan/sessions`**: Lists all active book scan sessions with page counts, thumbnail previews, creation timestamps, and active lock statuses.
* **`GET /api/book-scan/page-thumbnail/{session_id}/{page_id}`**: Returns cached raster thumbnail or high-res page image. Supports dynamic resolution via `dpi` (e.g. 100 DPI for fast deck cards, 150 DPI for high-res viewport inspection) and live preview filters (border cleanup, saturation, contrast, deskew).
* **`GET /api/book-scan/extract-page/{session_id}/{page_id}`**: Streams full-resolution processed page image for single-page export or inspection.
* **`POST /api/book-scan/reorder/{session_id}`**: Persists reordered page sequence.
* **`POST /api/book-scan/rotate/{session_id}`**: Rotates individual page in 90° CW/CCW increments.
* **`DELETE /api/book-scan/page/{session_id}/{page_id}`**: Removes blank or unwanted scan pages.
* **`POST /api/book-scan/duplicate-page/{session_id}`**: Duplicates an existing page record and its asset references.
* **`POST /api/book-scan/insert-blank/{session_id}`**: Inserts a synthesized blank page at a specified position with custom dimensions.
* **`POST /api/book-scan/detect-angle/{session_id}/{page_id}`**: Auto-detects and returns skew angle for a single page.
* **`POST /api/book-scan/detect-angle-batch/{session_id}`**: Batch calculates skew angles across all or scoped pages in parallel.
* **`POST /api/book-scan/deskew-page/{session_id}`**: Persists deskew angle adjustments for a page or batch scope.
* **`POST /api/book-scan/detect-crop/{session_id}/{page_id}`**: Auto-detects the physical page bounds/crop box against the scanner backing.
* **`POST /api/book-scan/detect-crop-batch/{session_id}`**: Batch calculates detected physical crop boxes across pages.
* **`POST /api/book-scan/crop-page/{session_id}`**: Persists manual or detected crop box adjustments to a page or batch scope.
* **`POST /api/book-scan/split-spread/{session_id}`**: Splits 2-up double-page spreads (or multi-line cut grids) into individual child page slices, tracking parent-child relationships and restoring spread origins.
* **`POST /api/book-scan/revert-spread/{session_id}`**: Restores previously split spread slices back into their original parent sheet format, matching by parent ID or slice IDs.
* **`POST /api/book-scan/mask-page/{session_id}`**: Applies or updates cleanup mask polygons/rectangles.
* **`POST /api/book-scan/color-mode-page/{session_id}`**: Applies color-mode and tone corrections (B&W thresholding, grayscale, contrast/saturation boost).
* **`POST /api/book-scan/restore-pages/{session_id}`**: Atomically restores session pages and module states to a historical snapshot (Undo/Redo/History Journal & Restore Original).
* **`POST /api/book-scan/lock/{session_id}`**: Acquires or heartbeats a cooperative concurrency lock with an owner identifier and TTL.
* **`DELETE /api/book-scan/lock/{session_id}`**: Releases a held session concurrency lock.
* **`GET /api/book-scan/lock/{session_id}`**: Inspects the current lock holder, remaining TTL, and active edit state.
* **`POST /api/book-scan/export-job/{session_id}`**: Enqueues an asynchronous background export job returning a `job_id` for progress tracking.
* **`GET /api/book-scan/export-job/{job_id}`**: Polls the background export job status, page-by-page progress percentage, and error state.
* **`GET /api/book-scan/export-download/{job_id}`**: Downloads the print-ready compiled PDF once the background export job completes.
* **`POST /api/book-scan/export/{session_id}`**: Synchronously compiles processed pages with synthesized bleed, trim boxes, and vector crop marks into a print-ready PDF.

### 6. 3D Virtual Flipbook Proofing (`/api/flipbook/*`)
Managed in `backend/main.py` and `backend/engines/flipbook_worker.py`.

* **`POST /api/flipbook`**: Ingests multi-page PDF or image list and builds an interactive 3D virtual page-turn proof preview (hardcover or paperback).
* **`POST /api/flipbook/update`**: Updates virtual binding settings (page turn speed, cover texture, LTR/RTL reading direction, spine thickness).
* **`POST /api/flipbook/export`**: Bundles a standalone self-contained HTML5/WebGL 3D flipbook package for client approval.

### 7. Settings, Presets & Runtime Storage (`/api/settings/*`)
Managed by `backend/settings_api.py` and `backend/engines/storage_cleaner.py`.

* **`GET /api/settings`**: Retrieves application settings, standard sheet sizes (A4, A3, SRA3, B2), roll widths, and studio default values from `settings.json`.
* **`PUT /api/settings`**: Persists updated machine configurations or custom substrate sizes.
* **`POST /api/settings/sheets`** / **`PUT /api/settings/sheets/{name}`** / **`DELETE /api/settings/sheets/{name}`**: Creates, updates, or deletes sheet size presets.
* **`POST /api/settings/rolls`** / **`PUT /api/settings/rolls/{name}`** / **`DELETE /api/settings/rolls/{name}`**: Creates, updates, or deletes continuous roll presets.
* **`POST /api/settings/reset`**: Restores system defaults.
* **`GET /api/settings/storage`**: Returns real-time disk usage metrics across runtime upload caches (`temp_uploads`, `book_scans`, `public_flipbooks`) and build caches.
* **`POST /api/settings/storage/clean`**: Safely purges temporary runtime files (`tier: "runtime"` or `"all"`) via `StorageCleaner`.
