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
Managed by `backend/book_scan_api.py`.

* **`POST /api/book-scan/init-session`**: Initializes a book scan session. Supports single-pass scans, 2-up double-page spreads, dual-pass duplex scans (odds/evens), and digital PDFs.
* **`GET /api/book-scan/page-thumbnail/{session_id}/{page_id}`**: Returns cached raster thumbnail or high-res page image. Supports dynamic resolution via `dpi` (e.g. 100 DPI for fast deck cards, 150 DPI for high-res viewport inspection) and live preview filters (border cleanup, saturation, contrast, deskew).
* **`POST /api/book-scan/reorder/{session_id}`**: Persists reordered page sequence.
* **`POST /api/book-scan/rotate/{session_id}`**: Rotates individual page in 90° CW/CCW increments.
* **`DELETE /api/book-scan/page/{session_id}/{page_id}`**: Removes blank or unwanted scan pages.
* **`POST /api/book-scan/export/{session_id}`**: Compiles processed pages with 3mm synthesized mirrored bleed, PDF trim boxes, and vector crop marks into a print-ready PDF.

### 6. Settings & Preset Management (`/api/settings/*`)
Managed by `backend/settings_api.py`.

* **`GET /api/settings`**: Retrieves application settings, standard sheet sizes (A4, A3, SRA3, B2), roll widths, and studio default values from `settings.json`.
* **`PUT /api/settings`**: Persists updated machine configurations or custom substrate sizes.
* **`POST /api/settings/sheets`** / **`PUT /api/settings/sheets/{name}`** / **`DELETE /api/settings/sheets/{name}`**: Creates, updates, or deletes sheet size presets.
* **`POST /api/settings/rolls`** / **`PUT /api/settings/rolls/{name}`** / **`DELETE /api/settings/rolls/{name}`**: Creates, updates, or deletes continuous roll presets.
* **`POST /api/settings/reset`**: Restores system defaults.
