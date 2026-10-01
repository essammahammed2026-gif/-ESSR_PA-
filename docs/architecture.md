# Architecture & System Design

ESSR_PA is a modular, high-performance prepress automation and web-to-print application designed for print shops, digital presses, and bindery operations.

---

## High-Level Topology

```text
+--------------------------------------------------------------+
|               Next.js 14 App Router (Port 3000)              |
|   React 18 * TypeScript Strict * Tailwind CSS * Lucide       |
|                                                              |
|   Studios:                                                   |
|   /             Command Center & Engine Heartbeat            |
|   /book-studio  Scanned Book Intake & Bleed Synthesis        |
|   /imposing     Gang Run / Step-and-Repeat Imposition        |
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
|                  FastAPI Backend (Port 8000)                 |
|   Uvicorn * PyMuPDF * OpenCV * NumPy * Pydantic              |
|                                                              |
|   Routers:                                                   |
|   main.py          /api/preflight, /api/contour, /api/flipbook|
|   imposing_api.py  /api/imposing (upload, preview, export)   |
|   book_scan_api.py /init-session, thumbnails, reorder, export|
|   settings_api.py  /api/settings (presets CRUD)              |
+------------------------------+-------------------------------+
                               |
                               | Async Task Delegation
                               v
+--------------------------------------------------------------+
|            Background Worker & Broker (Optional)             |
|   Celery Worker (concurrency=2) * Redis (redis://localhost)  |
|   Long-running rasterization, batch OCR, multi-page renders  |
+--------------------------------------------------------------+
```

---

## Core Components

### 1. Frontend (`frontend/`)
* **Framework:** Next.js 14 (App Router) with React 18 and strict TypeScript.
* **Styling & Components:** Tailwind CSS, shadcn/base-ui primitives, Lucide icons.
* **API Communication:** All requests route through `src/lib/api.ts` (`API_BASE_URL` dynamically configured via `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8000`).
* **Reactive Throttling:** Real-time sliders (margins, gaps, thresholds, offsets) are throttled using `src/lib/useDebounce.ts` (350ms) to prevent network flooding and server load spikes.

### 2. Backend (`backend/`)
* **API Framework:** FastAPI running on Uvicorn.
* **Prepress Engines (`backend/engines/`):** Pure functional modules executing geometry, computer vision, raster/vector transformations, and PDF synthesis.
* **API Documentation:** Interactive OpenAPI documentation is automatically served by FastAPI at `http://localhost:8000/docs`.

### 3. Asynchronous Worker (`celery_app.py`)
* Backed by Redis at `redis://localhost:6379/0`.
* Handles CPU-intensive tasks such as generating large multi-page flipbooks or heavy batch exports without blocking the main event loop.

---

## Data Flow & Storage Lifecycle

### Ephemeral Storage Policy
ESSR_PA follows a strict **zero-retention / ephemeral storage policy**:
* Files uploaded to `/temp_uploads/` are processed immediately.
* Endpoints like `/api/preflight` automatically clean up temporary files in a `finally` block upon completion.
* Generated export files (such as flipbook HTML assets or imposing PDFs) are stored temporarily in runtime directories (`backend/temp_uploads/` and `backend/public_flipbooks/`), which are ignored by version control.
* *Roadmap Goal:* Transition file processing to purely in-memory buffers or client-side storage to eliminate local disk reliance entirely.

### Persistent Application State
* Preset sizes (standard sheet sizes: SRA3, A3, A4, B2; continuous roll widths: 600mm, 1000mm, 1600mm; and studio defaults) are stored in `backend/settings.json`.
* State modifications are made through `settings_api.py` rather than direct manual edits.
