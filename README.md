# ESSR_PA (Print Automation & Prepress Suite)

A modular, high-performance web-to-print and prepress automation suite built with **Next.js 14** (React 18 / TypeScript strict / Tailwind CSS) and **FastAPI** (Python / PyMuPDF / OpenCV / NumPy).

---

## The Studios

* **Book Studio (`/book-studio`)**: Prioritized single-page and 2-up spread collation, left thumbnail deck, edge-to-edge high-res canvas, Space/O raw scan comparison overlay, paper whitening, deskewing, margin cleanup, and 3mm synthesized bleed generation.
* **Imposing Studio (`/imposing`)**: Unified collapsible studio shell, MaxRects gang runs, sheet/roll packing, margins, gaps, bleeds, live SVG visualizer, sheet efficiency HUD, cut marks, and print-ready PDF export.
* **Contour Cut Studio (`/contour`)**: Alpha/Otsu thresholding, dilation/erosion offsets, smooth cubic Bézier vectorization, and SVG spot-color die lines.
* **Flipbook Studio (`/flipbook`)**: 3D interactive virtual proofing (LTR/RTL, paperback/hardcover simulation).
* **PDF Preflight Center (`/preflight`)**: Executive inspection report cards for trim boxes, bleed tolerances, DPI, and color spaces.
* **Settings & Presets (`/settings`)**: Standard sheet dimensions (SRA3, A3, B2, etc.), roll widths, and studio defaults.

---

## Quickstart & Work Machine Setup Guide

### 1. Prerequisites (Any OS)
* **Git**: [git-scm.com](https://git-scm.com/)
* **Python 3.10+**: [python.org](https://www.python.org/downloads/) *(On Windows, check "Add Python to PATH")*
* **Node.js 18+ LTS** & **npm**: [nodejs.org](https://nodejs.org/)

Zero external database or message broker dependencies required (all task queues run via native in-process background tasks).

---

### 2. Setting Up on a New Machine (Work PC)

#### Step 1: Clone the Repository
```bash
git clone https://github.com/essammahammed2026-gif/-ESSR_PA-.git
cd -ESSR_PA-
```

#### Step 2: Set Up & Run the Backend (Terminal 1)

**Linux / macOS:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Windows (PowerShell / Command Prompt):**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Step 3: Set Up & Run the Frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev
```

#### Step 4: Open the App
* **Web UI:** [http://localhost:3000](http://localhost:3000)
* **Backend API & Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 3. One-Command Launch (Linux with systemd)
On Linux workstations with systemd user services, simply execute:
```bash
./start.sh
```
This automatically manages starting and focusing both the FastAPI backend and Next.js frontend.


---

## Documentation

Comprehensive documentation lives in the [`docs/`](./docs/) directory:

* [Architecture & Data Flow](./docs/architecture.md): Deep-dive into Next.js, Tauri, FastAPI, and storage lifecycles.
* [Prepress Engines Reference](./docs/engines.md): Algorithms, MaxRects bin-packing, Bézier die-line vectorization, and bleed synthesis.
* [API & Integration Guide](./docs/api.md): High-level pipeline endpoints and OpenAPI documentation details.
* [Contributing & Development Guidelines](./CONTRIBUTING.md): Code standards, verification commands, and contribution rules.
* [Changelog](./CHANGELOG.md): Record of changes, versioning, and feature roadmap.
