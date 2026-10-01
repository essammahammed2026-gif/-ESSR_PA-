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

### 1. Imposition Pipeline (`/api/imposing/*`)
Managed by `backend/imposing_api.py`.

* **`POST /api/imposing/upload`**: Uploads source artwork or PDF page to inspect geometry and dimensions.
* **`POST /api/imposing/preview`**: Accepts layout parameters (sheet dimensions, roll width, margins, spacing, rotation flag) and runs `sheet_packer` or `roll_packer`. Returns calculated layout metrics (yield count, waste percentage) and an SVG representation for live canvas visualization.
* **`POST /api/imposing/export`**: Renders the final print-ready PDF via `sheet_gang_exporter.py` with crop marks, registration targets, and bleed margins.

### 2. Preflight Inspection (`/api/preflight`)
Managed in `backend/main.py`.

* **`POST /api/preflight`**: Accepts one or more uploaded PDF files. Passes file paths to `engines.preflight.run_preflight()` to verify page geometry (`TrimBox`, `BleedBox`), image DPI, embedded fonts, and color spaces.
* *Note:* Uploaded files are processed and unlinked immediately in the endpoint's `finally` block.

### 3. Die-Cut Contour Vectorization (`/api/contour/*`)
Managed in `backend/main.py`.

* **`POST /api/contour/upload`**: Ingests raster artwork or PDF and returns an image thumbnail along with detected dimensions.
* **`POST /api/contour/generate`**: Accepts thresholding mode, dilation/erosion offset (mm), smoothing factor, and area filtering. Runs `contour_engine.py` and returns the vectorized cut path as an SVG preview.
* **`GET /api/contour/export`**: Downloads the final cut path as a standalone SVG or PDF with designated spot-color die lines.

### 4. Book Scan Ingest & Cleanup
Managed by `backend/book_scan_api.py`.

* **`POST /init-session`**: Initializes a temporary book scan session and receives odd/even page scans.
* **`GET /page-thumbnail/{session_id}/{page_num}`**: Returns low-resolution raster thumbnail for the page lightbox UI.
* **`POST /reorder/{session_id}`**: Updates page sequence and spread assignments.
* **`POST /rotate/{session_id}/{page_num}`**: Rotates individual pages in 90° increments.
* **`DELETE /page/{session_id}/{page_num}`**: Removes blank or spoiled scan pages.
* **`POST /export/{session_id}`**: Compiles normalized pages with 3mm synthesized bleed into a unified publication PDF.

### 5. Settings & Preset Management (`/api/settings/*`)
Managed by `backend/settings_api.py`.

* **`GET /api/settings`**: Retrieves application settings, standard sheet sizes (A4, A3, SRA3, B2), roll widths, and studio default values from `settings.json`.
* **`PUT /api/settings`**: Persists updated machine configurations or custom substrate sizes.
* **`POST /api/settings/reset`**: Restores system defaults.
