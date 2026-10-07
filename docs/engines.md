# Prepress Engines

All core printing, geometry, computer vision, and document-transformation logic lives in `backend/engines/`. Engines are designed as pure functional modules decoupled from HTTP routing.

---

## Active Engine Catalog

### 1. Imposition & Packing (`sheet_packer.py`, `roll_packer.py`, `sheet_gang_exporter.py`)
* **Purpose:** Calculates optimal 2D layouts for ganging multiple jobs or step-and-repeat runs onto standard paper sheets or continuous wide-format rolls.
* **Algorithms & Logic:**
  * **`sheet_packer.py`:** Utilizes the **MaxRects (Maximal Rectangles)** bin-packing algorithm with Best Short Side Fit (BSSF) heuristics. Supports dual job modes via `job_mode` (`"book"` vs `"gang"`): in `"book"` mode, items are sorted strictly by sequential ID (`item_id` ascending) to preserve numerical page sequence (1, 2, 3...) across generated press sheets, while in `"gang"` mode, items are sorted by area descending to maximize paper yield. Supports optional manual grid overrides (`rows`, `cols`) allowing press operators to fix row and column layouts directly instead of dynamic bin packing. Accounts for margins, gutter gaps, auto-rotation (90° orientation toggle), uniform piece orientation enforcement for straight-line Polar guillotine cutting, and calculates sheet utilization / waste percentages. Passes per-item `fit_mode` (`stretch`, `fit`, `crop`), `fill_color`, and `page_rotation` (`none`, `cw`, `ccw`) downstream to placed items.
  * **`roll_packer.py`:** Optimizes placement along a fixed roll width (e.g., 600mm, 1000mm, 1600mm) while minimizing linear meter run length. Shares the same item-level aspect ratio logic and sequential page expansion.
  * **`sheet_gang_exporter.py`:** Takes packing coordinate solutions and assembles production-grade PDFs using PyMuPDF (`fitz`) or layered SVGs (`export_svg`). Implements three distinct fit rendering modes:
    - **Stretch**: Direct force-fit into target W×H bounds without aspect constraint.
    - **Fit (Scale)**: Proportionate scaling with letterbox/pillarbox background color fill (`fill_color`).
    - **Crop**: Centered proportional scaling to fill target dimensions entirely, clipping boundary excess via source-space coordinate math (`_crop_clip_rect`) in vector PDFs and SVG clip-paths.
    - **Page Rotation (Opposing Orientations Only)**: Compares each page's aspect orientation ($W > H$ vs. $H > W$) against the user-configured target trim dimensions (`target_w_mm` vs `target_h_mm`), independent of whether the bin packer auto-rotated the slot on the sheet. Only pages whose orientation opposes the target slot (e.g. landscape pages inside a portrait book) are rotated 90° CW or CCW; pages that already match the target aspect remain unrotated.
    - **Bleed Synthesis (`none`, `solid`, `mirror` + `inside` | `outside`)**: 
      - *Inside Bleed*: Retains fixed target trim boundaries while insetting artwork content by the configured bleed margin (e.g. 2.5 mm).
      - *Outside Bleed*: Retains content at target size and expands the overall sheet cut box by 2× bleed margin; cut contours and prepress crop marks align directly to the finished trim box (`content_rect`).
      - Supports solid background extension with selectable RGB color, or reflective edge pixel synthesis via OpenCV `BORDER_REFLECT_101` (mirroring the outer 2–3mm strip outward for press cutting safety).
    Injects dynamic trim marks, registration marks, folding marks, bleed lines, optional cut outline box borders, and sheet identifier slugs. In SVG export mode, generates distinct `Artwork` and `CutContour` vector layers with base64-embedded assets for digital CNC and flatbed cutting tables. Automatically decodes and resolves modern web image formats (AVIF, WEBP) via OpenCV before injecting standard streams. When exporting multi-page book signatures or runs, draws vector pages directly from the original document tree (`show_pdf_page()`) at 100% full press resolution, completely bypassing low-resolution preview thumbnails.
  * **Lazy On-Demand Previews (`GET /api/imposing/thumbnail/{file_id}/{page_num}`):** Handles large publications (e.g. 3,000 pages) by rendering lightweight (72 DPI, 0.35 scale, ~15KB) cached JPEG thumbnails exclusively for the pages currently active in the operator's viewport, preventing browser and server memory exhaustion. Background thread pre-generates remaining pages sequentially on upload.

### 2. Die-Cut Contour Generation (`contour_engine.py`)
* **Purpose:** Detects boundary artwork and automatically vectorizes smooth cut paths (die lines) for digital cutting plotters (Zünd, Kongsberg, Roland, Graphtec).
* **Pipeline:**
  1. **Image Ingest:** Renders input artwork or PDF pages at 300 DPI.
  2. **Alpha & Color Masking:** Extracts alpha transparency channels or applies Otsu / adaptive binary thresholding (via OpenCV `cv2`).
  3. **Contour Extraction & Filtering:** Finds external and internal contours (`findContours`), filtering out artifacts below user-specified minimum areas.
  4. **Morphological Offsets (Dilation / Erosion):** Expands or contracts the contour path in millimeters to produce bleed or inset cuts.
  5. **Cubic Bézier Approximation:** Converts rough polyline pixel boundaries into smooth, continuous Bézier spline curves.
  6. **Export:** Generates an SVG or PDF with a designated spot-color stroke (e.g. 100% Magenta `#FF00FF` labeled `CutContour` or `KissCut`) without rasterizing or flattening the artwork.

### 3. Book Scan Processor (`book_scan_engine.py`)
* **Purpose:** Ingests raw book scans from flatbed scanners, dual overhead scanners, or smartphone cameras.
* **Pipeline:**
  * **Spread Splitting:** Identifies vertical book gutters and splits two-page spreads into discrete left/right pages.
  * **Deskewing & Cropping:** Detects text-block orientation via Radon/Hough line transforms and rectifies page skew.
  * **Contrast & Margin Normalization:** Removes dark scan edges and optimizes legibility.
  * **Bleed Synthesis:** Synthesizes a 3mm outer bleed extension using mirror-edge pixel padding for safe binding and guillotine trimming.

### 4. PDF Preflight Analyzer (`preflight.py`)
* **Purpose:** Inspects incoming PDF assets before production to prevent costly press downtime and print defects.
* **Inspections:**
  * **Page Geometry:** Reads `MediaBox`, `TrimBox`, `BleedBox`, `CropBox`, and `ArtBox`. Verifies trim consistency across all pages.
  * **Bleed Verification:** Confirms whether artwork extends past the trim boundary by the required 2mm–3mm tolerance.
  * **Resolution (DPI):** Scans embedded raster images and reports effective DPI, flagging low-resolution assets (< 300 DPI for offset, < 150 DPI for large format).
  * **Color Space Detection:** Identifies color models (CMYK, RGB, Spot/Pantone, Grayscale) and flags unseparated RGB elements.
  * **Font Embedding:** Checks if all document typefaces are fully embedded or subsetted.

### 5. Virtual 3D Proofing (`flipbook_worker.py`)
* **Purpose:** Generates interactive 3D virtual page-turn proofing previews for print customer sign-off.
* **Features:**
  * Supports softcover (paperback) and hardcover simulations.
  * Configurable binding direction: Left-to-Right (LTR) and Right-to-Left (RTL, for Arabic/Hebrew publications).
  * Applies realistic binding gutters and spine creep adjustments via `helpers.apply_print_binding_padding`.
  * Outputs standalone HTML5 bundles using `templates/flipbook.html`.
