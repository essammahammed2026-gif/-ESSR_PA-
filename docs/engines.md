# Prepress Engines

All core printing, geometry, computer vision, and document-transformation logic lives in `backend/engines/`. Engines are designed as pure functional modules decoupled from HTTP routing.

---

## Active Engine Catalog

### 1. Imposition & Packing (`sheet_packer.py`, `roll_packer.py`, `sheet_gang_exporter.py`)
* **Purpose:** Calculates optimal 2D layouts for ganging multiple jobs or step-and-repeat runs onto standard paper sheets or continuous wide-format rolls.
* **Algorithms & Logic:**
  * **`sheet_packer.py`:** Utilizes the **MaxRects (Maximal Rectangles)** bin-packing algorithm with Best Short Side Fit (BSSF) heuristics. Accounts for margins, gutter gaps, auto-rotation (90° orientation toggle), and calculates sheet utilization / waste percentages.
  * **`roll_packer.py`:** Optimizes placement along a fixed roll width (e.g., 600mm, 1000mm, 1600mm) while minimizing linear meter run length.
  * **`sheet_gang_exporter.py`:** Takes packing coordinate solutions and assembles a production-grade PDF using PyMuPDF (`fitz`). Injects dynamic trim marks, registration marks, folding marks, bleed lines, and sheet identifier slugs.

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
