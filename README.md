# ESSR_PA (Print Automation & Prepress Suite)

ESSR_PA is a modular, high-performance prepress automation and web-to-print application built with a **FastAPI (Python)** backend and a **Next.js 14 (React / Tailwind CSS / TypeScript)** frontend.

---

## 🏛️ System Architecture

```
                      +-----------------------------+
                      |   Next.js 14 Frontend UI    |
                      |  (React, Tailwind, Lucide)  |
                      |    http://localhost:3000    |
                      +--------------+--------------+
                                     |
                                REST API
                                     |
                                     v
                      +-----------------------------+
                      |      FastAPI Backend        |
                      |   http://localhost:8000     |
                      +--------------+--------------+
                                     |
       +-----------------------------+-----------------------------+
       |                             |                             |
       v                             v                             v
+---------------+            +---------------+             +---------------+
| Imposing &    |            | Contour Cut   |             | 3D Flipbook   |
| Gang Packing  |            | SVG Generator |             | Engine        |
| (PyMuPDF,     |            | (OpenCV,      |             | (PyMuPDF,     |
|  MaxRects,    |            |  Shapely,     |             |  StPageFlip,  |
|  Roll Packer) |            |  Cubic Bezier)|             |  Puppeteer)   |
+---------------+            +---------------+             +---------------+
```

---

## 📂 Repository Structure

- [**`backend/`**](file:///home/essam/Projects/ESSR_PA/backend/)
  - [`main.py`](file:///home/essam/Projects/ESSR_PA/backend/main.py): FastAPI application root, static mounts (`/temp_uploads`, `/flipbooks`), preflight endpoints, flipbook generation & export task routes, and contour generation endpoints.
  - [`imposing_api.py`](file:///home/essam/Projects/ESSR_PA/backend/imposing_api.py): Endpoints for file uploads, sheet & roll imposition, grid nesting, cut marks, bleed borders, and PDF gang export.
  - [`settings_api.py`](file:///home/essam/Projects/ESSR_PA/backend/settings_api.py): Reads and updates sheet definitions stored in [`settings.json`](file:///home/essam/Projects/ESSR_PA/backend/settings.json).
  - [`settings.json`](file:///home/essam/Projects/ESSR_PA/backend/settings.json): Persistent lightweight database storing available media/sheet formats (`A4`, `A3`, `SRA3`, custom sheets).
  - [`celery_app.py`](file:///home/essam/Projects/ESSR_PA/backend/celery_app.py): Celery async task queue configuration using Redis broker/backend.
  - [**`engines/`**](file:///home/essam/Projects/ESSR_PA/backend/engines/): Core calculation, computer vision, and geometry engines:
    - [`sheet_packer.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/sheet_packer.py): MaxRects bin packing algorithm for sheet layouts.
    - [`roll_packer.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/roll_packer.py): Continuous roll & meter segment packing algorithm.
    - [`sheet_gang_exporter.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/sheet_gang_exporter.py): PyMuPDF-based generation of print-ready gang PDFs with cut marks and borders.
    - [`contour_engine.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/contour_engine.py): Computer vision contour extraction, thresholding, Shapely polygon smoothing/offsetting, and cubic Bézier SVG path generation.
    - [`flipbook_worker.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/flipbook_worker.py): Asynchronous PDF rasterizer, StPageFlip HTML/JS builder, zip archiver, and MP4/WebM video renderer.
    - [`preflight.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/preflight.py): Preflight checker for resolution, colorspace, page dimensions, and font status.
    - [`cover_builder.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/cover_builder.py), [`vdp_engine.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/vdp_engine.py), [`barcode_sheet_engine.py`](file:///home/essam/Projects/ESSR_PA/backend/engines/barcode_sheet_engine.py): Additional prepress utilities (spine & cover calculations, variable data, barcodes).

- [**`frontend/`**](file:///home/essam/Projects/ESSR_PA/frontend/)
  - [`src/app/settings/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/settings/page.tsx): Full System Settings UI for managing sheet & roll media dimensions, imposing parameters, contour cutting preferences, and 3D flipbook rasterization defaults.
  - [`src/app/imposing/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/imposing/page.tsx): Imposition & Gang Sheet UI (interactive sheet preview, file list, rotation, margins, gap controls, dynamic preset manager).
  - [`src/app/contour/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/contour/page.tsx): Contour cut creator UI (live thresholding, offset adjustment, smoothing, white matte, SVG download).
  - [`src/app/flipbook/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/flipbook/page.tsx): 3D Flipbook viewer & exporter UI (binding options, page range filtering, live updates, video/zip export).
  - [`src/app/preflight/page.tsx`](file:///home/essam/Projects/ESSR_PA/frontend/src/app/preflight/page.tsx): Preflight report dashboard.

- [`start.sh`](file:///home/essam/Projects/ESSR_PA/start.sh): Unified runner that starts FastAPI, Celery worker, and Next.js dev server with signal handling (`SIGINT`).

---

## 🚀 Running the Application

### 1. Unified Launch (Recommended)
```bash
./start.sh
```

### 2. Manual Launch
- **Backend**:
  ```bash
  cd backend
  source .venv/bin/activate
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```
- **Celery Worker** (optional, for distributed tasks):
  ```bash
  cd backend
  source .venv/bin/activate
  celery -A celery_app worker --loglevel=info
  ```
- **Frontend**:
  ```bash
  cd frontend
  npm run dev
  ```

---

## 🗄️ Database & Persistence State

- **Sheet Presets Database**: Lightweight JSON file at [`backend/settings.json`](file:///home/essam/Projects/ESSR_PA/backend/settings.json), handled through [`backend/settings_api.py`](file:///home/essam/Projects/ESSR_PA/backend/settings_api.py).
- **Task & Cache State**: In-memory dictionaries in [`backend/main.py`](file:///home/essam/Projects/ESSR_PA/backend/main.py) (`TASK_STATES`, `PROJECT_CACHE`, `CONTOUR_CACHE`).
- **Temporary Uploads**: Handled inside `backend/temp_uploads/` (git-ignored, automatically cleaned or pruned).
- **Public Flipbooks**: Rendered HTML and exported videos/zips saved to `backend/public_flipbooks/` (served statically at `/flipbooks/`).
