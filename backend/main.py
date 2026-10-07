from fastapi import FastAPI
from settings_api import router as settings_router
from imposing_api import router as imposing_router, _pregen_all_thumbnails
from book_scan_api import router as book_scan_router
from fastapi import UploadFile, File, Form, BackgroundTasks, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil
import os
import uuid
import fitz
import cv2
from typing import List
from engines.preflight import run_preflight
from engines.contour_engine import generate_contour_cut_svg, analyze_image_for_contour
from engines.flipbook_worker import generate_flipbook_task, generate_html_content, export_flipbook_task
from engines.helpers import apply_print_binding_padding
from engines.asset_inspector import analyze_universal_asset
from engines.report_generator import generate_prepress_report_pdf
import time
from typing import List, Dict, Any

import signal
import threading

app = FastAPI(title="Flint Prepress API")
app.include_router(settings_router)
app.include_router(imposing_router)
app.include_router(book_scan_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("temp_uploads", exist_ok=True)
os.makedirs("public_flipbooks", exist_ok=True)

app.mount("/temp_uploads", StaticFiles(directory="temp_uploads"), name="temp_uploads")
app.mount("/flipbooks", StaticFiles(directory="public_flipbooks"), name="flipbooks")

TASK_STATES: Dict[str, Any] = {}
PROJECT_CACHE: Dict[str, Any] = {}
CONTOUR_CACHE: Dict[str, str] = {}
CONTOUR_PREVIEWS: Dict[str, str] = {}
INSPECT_CACHE: Dict[str, Any] = {}
CACHE_TIMESTAMPS: Dict[str, float] = {}

CACHE_TTL_SECONDS = 7200  # 2 hours eviction window

def evict_stale_caches():
    """Prunes in-memory caches and temporary files to prevent OOM on low-memory systems."""
    now = time.time()
    stale_keys = [k for k, ts in CACHE_TIMESTAMPS.items() if now - ts > CACHE_TTL_SECONDS]
    for k in stale_keys:
        CACHE_TIMESTAMPS.pop(k, None)
        PROJECT_CACHE.pop(k, None)
        INSPECT_CACHE.pop(k, None)
        TASK_STATES.pop(k, None)
        f_path = CONTOUR_CACHE.pop(k, None)
        if f_path and os.path.exists(f_path):
            try:
                os.remove(f_path)
            except OSError:
                pass
        p_path = CONTOUR_PREVIEWS.pop(k, None)
        if p_path and os.path.exists(p_path.lstrip("/")):
            try:
                os.remove(p_path.lstrip("/"))
            except OSError:
                pass

@app.get("/")
def read_root():
    evict_stale_caches()
    return {"status": "ok", "message": "Flint Prepress API Running"}

@app.post("/api/inspect")
async def inspect_asset(file: UploadFile = File(...)):
    """
    Universal ingest & triage endpoint:
    Saves file to temp_uploads, extracts prepress metrics (pages, dimensions, colorspace),
    generates a high-resolution preview thumbnail, and registers the file for immediate
    handover across Imposing, Contour, Flipbook, and Book Studio.
    """
    os.makedirs("temp_uploads", exist_ok=True)
    file_id = str(uuid.uuid4())[:12]
    ext = os.path.splitext(file.filename)[1].lower()
    if not ext:
        ext = ".pdf"
    
    full_file_id = f"{file_id}{ext}"
    file_path = f"temp_uploads/{full_file_id}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    CACHE_TIMESTAMPS[file_id] = time.time()
    CACHE_TIMESTAMPS[full_file_id] = time.time()
    CONTOUR_CACHE[file_id] = file_path
    CONTOUR_CACHE[full_file_id] = file_path

    # Run pure analysis engine
    analysis = analyze_universal_asset(file_path, file.filename)
    analysis["file_id"] = full_file_id
    analysis["file_path"] = file_path

    # Generate preview thumbnail
    thumb_p0_filename = f"{file_id}_thumb_p0.jpg"
    thumb_p0_disk_path = f"temp_uploads/{thumb_p0_filename}"
    thumb_filename = f"{file_id}_thumb.jpg"
    thumb_disk_path = f"temp_uploads/{thumb_filename}"
    try:
        if ext == ".pdf":
            doc = fitz.open(file_path)
            num_pages = len(doc)
            if num_pages > 0:
                pix = doc[0].get_pixmap(matrix=fitz.Matrix(0.72, 0.72))
                pix.save(thumb_p0_disk_path)
                pix.save(thumb_disk_path)
                analysis["thumbnail_url"] = f"/temp_uploads/{thumb_filename}"
            doc.close()

            # For multi-page PDFs (books), pre-generate ALL remaining page thumbnails
            # in background thread for instant disk cache hits in Imposing Studio
            if num_pages > 1:
                t = threading.Thread(
                    target=_pregen_all_thumbnails,
                    args=(file_path, full_file_id, num_pages),
                    daemon=True,
                    name=f"thumb-pregen-{file_id}"
                )
                t.start()
        else:
            img = cv2.imread(file_path)
            if img is not None:
                h_img, w_img = img.shape[:2]
                scale = min(720.0 / max(1, w_img), 720.0 / max(1, h_img))
                if scale < 1.0:
                    img = cv2.resize(img, (int(w_img * scale), int(h_img * scale)))
                cv2.imwrite(thumb_p0_disk_path, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
                cv2.imwrite(thumb_disk_path, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
                analysis["thumbnail_url"] = f"/temp_uploads/{thumb_filename}"
    except Exception as e_thumb:
        print(f"Notice: thumbnail generation failed: {e_thumb}")

    if "pages" in analysis and analysis["pages"]:
        for page_item in analysis["pages"]:
            p_num = page_item["page_num"]
            page_item["thumb_url"] = f"/api/imposing/thumbnail/{full_file_id}/{p_num}"
    else:
        analysis["pages"] = [{
            "page_num": 0,
            "width_mm": analysis.get("width_mm", 0.0),
            "height_mm": analysis.get("height_mm", 0.0),
            "aspect_ratio": analysis.get("aspect_ratio", 1.0),
            "thumb_url": f"/api/imposing/thumbnail/{full_file_id}/0"
        }]

    INSPECT_CACHE[full_file_id] = analysis
    INSPECT_CACHE[file_id] = analysis

    return {
        "success": True,
        "analysis": analysis
    }

@app.get("/api/inspect/report-pdf/{file_id}")
async def get_report_pdf(file_id: str):
    """
    Generates and downloads an executive A4 Prepress Quality Audit Report PDF.
    """
    analysis = INSPECT_CACHE.get(file_id)
    if not analysis:
        # Check if file exists on disk and re-inspect
        file_path = f"temp_uploads/{file_id}"
        if not os.path.exists(file_path):
            for test_ext in [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".webp"]:
                if os.path.exists(f"temp_uploads/{file_id}{test_ext}"):
                    file_path = f"temp_uploads/{file_id}{test_ext}"
                    break
        if os.path.exists(file_path):
            analysis = analyze_universal_asset(file_path, os.path.basename(file_path))
            INSPECT_CACHE[file_id] = analysis

    if not analysis:
        raise HTTPException(status_code=404, detail="Analyzed asset not found")

    pdf_bytes = generate_prepress_report_pdf(analysis)
    safe_name = os.path.splitext(analysis.get("filename", "Artwork"))[0].replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Prepress_Audit_Report_{safe_name}.pdf"'
        }
    )

@app.post("/api/inspect/export-report-pdf")
async def export_report_pdf(request: Request):
    """
    Exports an executive PDF Prepress Report from client-provided analysis payload or cached ID.
    """
    data = await request.json()
    analysis = data.get("analysis")
    if not analysis and "file_id" in data:
        fid = data["file_id"]
        analysis = INSPECT_CACHE.get(fid)
        if not analysis:
            file_path = f"temp_uploads/{fid}"
            if os.path.exists(file_path):
                analysis = analyze_universal_asset(file_path, os.path.basename(file_path))

    if not analysis:
        raise HTTPException(status_code=400, detail="Missing analysis data for PDF report generation")

    pdf_bytes = generate_prepress_report_pdf(analysis)
    safe_name = os.path.splitext(analysis.get("filename", "Artwork"))[0].replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Prepress_Audit_Report_{safe_name}.pdf"'
        }
    )

@app.post("/api/preflight")
async def analyze_pdfs(
    files: List[UploadFile] = File(default=[]),
    existing_file_id: str = Form(None)
):
    saved_paths = []
    to_delete = []
    try:
        if files:
            for file in files:
                file_path = f"temp_uploads/{file.filename}"
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                saved_paths.append(file_path)
                to_delete.append(file_path)
        elif existing_file_id:
            file_path = f"temp_uploads/{existing_file_id}"
            if not os.path.exists(file_path):
                for test_ext in [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".webp"]:
                    if os.path.exists(f"temp_uploads/{existing_file_id}{test_ext}"):
                        file_path = f"temp_uploads/{existing_file_id}{test_ext}"
                        break
            if os.path.exists(file_path):
                saved_paths.append(file_path)

        if not saved_paths:
            raise HTTPException(status_code=400, detail="No files provided for preflight")
            
        result = run_preflight(saved_paths)
        return result
    finally:
        for path in to_delete:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass

@app.post("/api/flipbook")
async def create_flipbook(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(default=[]),
    existing_file_id: str = Form(None),
    dpi: int = Form(101),
    eco_mode: bool = Form(False),
    direction: str = Form("Left to Right (LTR)"),
    binding_style: str = Form("Soft Cover (Paperback)"),
    export_mode: str = Form("Folder Assets (Ultra-Fast & Light HTML)"),
    mag_pad_choice: str = Form("At the very end"),
    add_flyleaves: bool = Form(False),
    bg_texture: str = Form("Dark Mode"),
    sound_enabled: bool = Form(False),
    page_range: str = Form(""),
):
    saved_paths = []
    task_id = str(uuid.uuid4())[:12]
    
    if files:
        for file in files:
            file_path = f"temp_uploads/{task_id}_{file.filename}"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_paths.append(file_path)
    elif existing_file_id:
        file_path = f"temp_uploads/{existing_file_id}"
        if not os.path.exists(file_path):
            for test_ext in [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".webp"]:
                if os.path.exists(f"temp_uploads/{existing_file_id}{test_ext}"):
                    file_path = f"temp_uploads/{existing_file_id}{test_ext}"
                    break
        if os.path.exists(file_path):
            saved_paths.append(file_path)

    if not saved_paths:
        raise HTTPException(status_code=400, detail="No files provided for flipbook")
        
    output_filename = f"flipbook_{task_id}.html"
    output_path = f"public_flipbooks/{output_filename}"

    TASK_STATES[task_id] = {"state": "PENDING", "status": "Pending...", "progress": 0}
    CACHE_TIMESTAMPS[task_id] = time.time()


    target_indices = None
    if page_range and page_range.lower() != "all":
        try:
            target_indices = []
            for part in page_range.split(","):
                part = part.strip()
                if "-" in part:
                    start, end = part.split("-")
                    target_indices.extend(range(int(start) - 1, int(end)))
                else:
                    target_indices.append(int(part) - 1)
        except Exception:
            target_indices = None

    background_tasks.add_task(
        generate_flipbook_task,
        task_id=task_id,
        state_dict=TASK_STATES,
        project_cache=PROJECT_CACHE,
        pdf_paths=saved_paths,
        output_path=output_path,
        dpi=dpi,
        eco_mode=eco_mode,
        target_indices=target_indices,
        direction=direction,
        binding_style=binding_style,
        export_mode=export_mode,
        mag_pad_choice=mag_pad_choice,
        add_flyleaves=add_flyleaves,
        bg_texture=bg_texture,
        sound_enabled=sound_enabled
    )
    
    return {"task_id": task_id, "message": "Flipbook generation started"}

@app.post("/api/flipbook/update")
async def update_flipbook(
    task_id: str = Form(...),
    direction: str = Form("Left to Right (LTR)"),
    binding_style: str = Form("Soft Cover (Paperback)"),
    mag_pad_choice: str = Form("At the very end"),
    add_flyleaves: bool = Form(False),
    bg_texture: str = Form("Dark Mode"),
    sound_enabled: bool = Form(False),
    page_range: str = Form(""),
):
    if task_id not in PROJECT_CACHE:
        raise HTTPException(status_code=404, detail="Project cache not found")
        
    CACHE_TIMESTAMPS[task_id] = time.time()
    cached = PROJECT_CACHE[task_id]
    
    # 1. Padding
    padded_pages = apply_print_binding_padding(list(cached["b64_pages"]), binding_style, add_flyleaves, mag_pad_choice)
    
    # 2. HTML Generation
    html_content = generate_html_content(
        b64_pages=padded_pages, 
        original_pdf_name=cached["original_pdf_name"], 
        direction=direction, 
        binding_style=binding_style, 
        bg_texture=bg_texture, 
        sound_enabled=sound_enabled, 
        page_w=cached["page_w"], 
        page_h=cached["page_h"]
    )
    
    # 3. Write
    with open(cached["output_path"], "w", encoding="utf-8") as f:
        f.write(html_content)
        
    cached["direction"] = direction
    cached["binding_style"] = binding_style
    cached["mag_pad_choice"] = mag_pad_choice
    cached["add_flyleaves"] = add_flyleaves
    cached["bg_texture"] = bg_texture
    cached["sound_enabled"] = sound_enabled

    return {"success": True, "output": cached["output_path"], "message": "Flipbook updated instantly!"}


@app.post("/api/flipbook/export")
async def export_flipbook(
    background_tasks: BackgroundTasks,
    task_id: str = Form(...),
    dpi: int = Form(150),
    export_format: str = Form("zip"),
    video_res: str = Form("720")
):
    if task_id not in PROJECT_CACHE:
        raise HTTPException(status_code=404, detail="Project cache not found")
        
    export_task_id = str(uuid.uuid4())[:12]
    output_filename = f"flipbook_export_{export_task_id}.html"
    output_path = f"public_flipbooks/{output_filename}"

    TASK_STATES[export_task_id] = {"state": "PENDING", "status": "Preparing export...", "progress": 0}

    background_tasks.add_task(
        export_flipbook_task,
        task_id=task_id,
        state_dict=TASK_STATES,
        project_cache=PROJECT_CACHE,
        export_task_id=export_task_id,
        output_path=output_path,
        dpi=dpi,
        export_format=export_format,
        video_res=video_res
    )
    
    return {"task_id": export_task_id, "message": "Export started"}

@app.get("/api/tasks/{task_id}")
async def get_task_status(task_id: str):
    state = TASK_STATES.get(task_id)
    if state:
        return state
    return {"state": "UNKNOWN", "status": "Task not found", "progress": 0}



@app.post("/api/contour/upload")
async def upload_contour_file(file: UploadFile = File(...)):
    try:
        os.makedirs("temp_uploads", exist_ok=True)
        file_id = str(uuid.uuid4())[:12]
        ext = os.path.splitext(file.filename)[1].lower()
        file_path = f"temp_uploads/{file_id}_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        CONTOUR_CACHE[file_id] = file_path
        CACHE_TIMESTAMPS[file_id] = time.time()

        # Generate lightweight downsampled raster for ultra-fast, low-memory browser proofing
        preview_filename = f"{file_id}_preview.png"
        preview_disk_path = f"temp_uploads/{preview_filename}"
        try:
            if ext == ".pdf":
                doc = fitz.open(file_path)
                if len(doc) > 0:
                    pix = doc[0].get_pixmap(matrix=fitz.Matrix(0.5, 0.5), alpha=True)
                    pix.save(preview_disk_path)
                doc.close()
            else:
                img_cv = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)
                if img_cv is not None:
                    h_cv, w_cv = img_cv.shape[:2]
                    max_dim = 1200.0
                    if max(w_cv, h_cv) > max_dim:
                        scale = max_dim / float(max(w_cv, h_cv))
                        resized = cv2.resize(img_cv, (int(w_cv * scale), int(h_cv * scale)), interpolation=cv2.INTER_AREA)
                        cv2.imwrite(preview_disk_path, resized)
                    else:
                        cv2.imwrite(preview_disk_path, img_cv)
            if os.path.exists(preview_disk_path):
                CONTOUR_PREVIEWS[file_id] = f"/temp_uploads/{preview_filename}"
        except Exception as e_prev:
            print("Notice: could not generate downsampled preview:", e_prev)
        
        # Analyze uploaded artwork and suggest optimal settings
        analysis = analyze_image_for_contour(file_path)
        
        return {
            "success": True, 
            "file_id": file_id,
            "filename": file.filename,
            "width": analysis.get("width", 0),
            "height": analysis.get("height", 0),
            "has_alpha": analysis.get("has_alpha", False),
            "bg_type": analysis.get("bg_type", "unknown"),
            "suggested_options": analysis.get("suggested_options", {})
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/contour/generate")
async def generate_contour(
    file_id: str = Form(None),
    file: UploadFile = File(None),
    offset_val: float = Form(0.0),
    offset_unit: str = Form("mm"),
    threshold: int = Form(20),
    smoothing_factor: float = Form(2.0),
    dpi: int = Form(300),
    stroke_color: str = Form("#FF00FE"),
    stroke_width: float = Form(1.0),
    keep_holes: bool = Form(False),
    add_white_matte: bool = Form(False),
    pdf_page: int = Form(0),
    preview_mode: bool = Form(True)
):
    try:
        if file_id and file_id in CONTOUR_CACHE:
            file_path = CONTOUR_CACHE[file_id]
        elif file:
            os.makedirs("temp_uploads", exist_ok=True)
            file_path = f"temp_uploads/{uuid.uuid4()}_{file.filename}"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        else:
            return {"success": False, "error": "No file provided"}

        # In preview mode, use the lightweight downscaled preview raster URL instead of encoding 20-50MB base64
        preview_url = CONTOUR_PREVIEWS.get(file_id) if (preview_mode and file_id) else None

        svg_content = generate_contour_cut_svg(
            img_path=file_path,
            offset_val=offset_val,
            offset_unit=offset_unit,
            threshold=threshold,
            dpi=dpi,
            stroke_color=stroke_color,
            stroke_width=stroke_width,
            keep_holes=keep_holes,
            add_white_matte=add_white_matte,
            pdf_page=pdf_page,
            smoothing_factor=smoothing_factor,
            preview_url=preview_url
        )
        
        return {"success": True, "svg": svg_content}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@app.get("/api/contour/export")
async def export_contour_svg(
    file_id: str,
    offset_val: float = 0.0,
    offset_unit: str = "mm",
    threshold: int = 20,
    smoothing_factor: float = 2.0,
    dpi: int = 300,
    stroke_color: str = "#FF00FE",
    stroke_width: float = 1.0,
    keep_holes: bool = False,
    add_white_matte: bool = False,
    pdf_page: int = 0
):
    if file_id not in CONTOUR_CACHE:
        raise HTTPException(status_code=404, detail="Artwork file not found or expired")
    file_path = CONTOUR_CACHE[file_id]
    from fastapi import Response
    svg_content = generate_contour_cut_svg(
        img_path=file_path,
        offset_val=offset_val,
        offset_unit=offset_unit,
        threshold=threshold,
        dpi=dpi,
        stroke_color=stroke_color,
        stroke_width=stroke_width,
        keep_holes=keep_holes,
        add_white_matte=add_white_matte,
        pdf_page=pdf_page,
        smoothing_factor=smoothing_factor,
        preview_url=None # Full standalone SVG with embedded artwork for RIP / Plotter
    )
    return Response(
        content=svg_content,
        media_type="image/svg+xml",
        headers={"Content-Disposition": f'attachment; filename="cut_contour_{file_id}.svg"'}
    )

@app.post("/api/shutdown")
def shutdown_app():
    """Trigger graceful shutdown of Flint services."""
    def _delayed_exit():
        time.sleep(0.5)
        # Cleanly stop systemd services and any background workers
        os.system("systemctl --user stop flint-backend flint-frontend 2>/dev/null || true")
        os.system("pkill -9 -f 'uvicorn.*8000' 2>/dev/null || true")
        os.system("pkill -9 -f 'next-server' 2>/dev/null || true")
        os.system("pkill -9 -f 'next dev' 2>/dev/null || true")
        try:
            os.kill(os.getpid(), signal.SIGKILL)
        except OSError:
            pass

    threading.Thread(target=_delayed_exit, daemon=True).start()
    return {"status": "shutting_down", "message": "Flint services are stopping..."}

