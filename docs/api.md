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
Managed by `backend/imposing_api.py`.

* **`POST /api/imposing/upload`**: Uploads source artwork or PDF page to inspect geometry and dimensions. Pre-generates page thumbnails in background threads for instant lightbox display.
* **`GET /api/imposing/pages/{file_id}`**: Retrieves granular page deck metadata (dimensions, aspect ratios, thumbnail URLs) for drag-and-drop deck reordering, rotation, and duplication.
* **`GET /api/imposing/thumbnail/{file_id}/{page_num}`**: Streams lazy, on-demand JPEG thumbnails for large multi-page publications.
* **`POST /api/imposing/preview`**: Accepts layout parameters (sheet dimensions, roll width, margins, spacing, rotation flag, manual rows × cols) and runs `sheet_packer` or `roll_packer`. Returns calculated layout metrics (yield count, waste percentage) and an SVG representation for live canvas visualization.
* **`POST /api/imposing/export`**: Renders the final print-ready PDF via `sheet_gang_exporter.py` with crop marks, registration targets, and bleed margins.
* **`POST /api/imposing/export-svg`**: Generates a layered SVG with separated `Artwork` (print) and `CutContour` (die-cut vector) layers for digital flatbed cutter software.

### 3. Preflight Inspection (`/api/preflight`)
Managed in `backend/main.py`.

* **`POST /api/preflight`**: Accepts one or more uploaded PDF files. Passes file paths to `engines.preflight.run_preflight()` to verify page geometry (`TrimBox`, `BleedBox`), image DPI, embedded fonts, and color spaces.
* *Note:* Uploaded files are processed and unlinked immediately in the endpoint's `finally` block.

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

### 6. Settings, Presets & Runtime Storage (`/api/settings/*`)
Managed by `backend/settings_api.py` and `backend/engines/storage_cleaner.py`.

* **`GET /api/settings`**: Retrieves application settings, standard sheet sizes (A4, A3, SRA3, B2), roll widths, and studio default values from `settings.json`.
* **`PUT /api/settings`**: Persists updated machine configurations or custom substrate sizes.
* **`POST /api/settings/sheets`** / **`PUT /api/settings/sheets/{name}`** / **`DELETE /api/settings/sheets/{name}`**: Creates, updates, or deletes sheet size presets.
* **`POST /api/settings/rolls`** / **`PUT /api/settings/rolls/{name}`** / **`DELETE /api/settings/rolls/{name}`**: Creates, updates, or deletes continuous roll presets.
* **`POST /api/settings/reset`**: Restores system defaults.
* **`GET /api/settings/storage`**: Returns real-time disk usage metrics across runtime upload caches (`temp_uploads`, `book_scans`, `public_flipbooks`) and build caches.
* **`POST /api/settings/storage/clean`**: Safely purges temporary runtime files (`tier: "runtime"` or `"all"`) via `StorageCleaner`.
