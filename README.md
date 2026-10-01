# ESSR_PA (Print Automation & Prepress Suite)

A modular, high-performance web-to-print and prepress automation suite built with **Next.js 14** (React 18 / TypeScript strict / Tailwind CSS) and **FastAPI** (Python / PyMuPDF / OpenCV / NumPy).

---

## The Studios

* **Book Studio (`/book-studio`)**: Dual scanner intake (odds/evens), spread splitting, deskewing, margin cleanup, and 3mm synthesized bleed generation.
* **Imposing Studio (`/imposing`)**: MaxRects gang runs, sheet/roll packing, margins, gaps, bleeds, live SVG visualizer, sheet efficiency HUD, cut marks, and print-ready PDF export.
* **Contour Cut Studio (`/contour`)**: Alpha/Otsu thresholding, dilation/erosion offsets, smooth cubic Bézier vectorization, and SVG spot-color die lines.
* **Flipbook Studio (`/flipbook`)**: 3D interactive virtual proofing (LTR/RTL, paperback/hardcover simulation).
* **PDF Preflight Center (`/preflight`)**: Executive inspection report cards for trim boxes, bleed tolerances, DPI, and color spaces.
* **Settings & Presets (`/settings`)**: Standard sheet dimensions (SRA3, A3, B2, etc.), roll widths, and studio defaults.

---

## Quickstart (Under 5 Minutes)

### Prerequisites
* **Python 3.10+** (with virtual environment in `backend/.venv`)
* **Node.js 18+** & **npm**
* **Redis** (for background Celery tasks)

### One-Command Launch (Unified)
The project includes an all-in-one runner that spins up FastAPI, Next.js, Redis, and Celery concurrently:

```bash
./start.sh
```

* **Frontend:** [http://localhost:3000](http://localhost:3000)
* **Backend API:** [http://localhost:8000](http://localhost:8000)
* **Interactive API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

### Manual Setup

#### 1. Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

*(Optional) Start async Celery worker in a separate terminal:*
```bash
celery -A celery_app worker --concurrency=2 --loglevel=info
```

#### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Documentation

Comprehensive documentation lives in the [`docs/`](./docs/) directory:

* [Architecture & Data Flow](./docs/architecture.md): Deep-dive into Next.js, FastAPI, Celery, and storage lifecycles.
* [Prepress Engines Reference](./docs/engines.md): Algorithms, MaxRects bin-packing, Bézier die-line vectorization, and bleed synthesis.
* [API & Integration Guide](./docs/api.md): High-level pipeline endpoints and OpenAPI documentation details.
* [Contributing & Development Guidelines](./CONTRIBUTING.md): Code standards, verification commands, and contribution rules.
* [Changelog](./CHANGELOG.md): Record of changes, versioning, and feature roadmap.
