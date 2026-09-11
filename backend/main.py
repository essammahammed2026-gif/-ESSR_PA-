from fastapi import FastAPI
from settings_api import router as settings_router
from imposing_api import router as imposing_router
from fastapi import UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil
import os
import uuid
from typing import List
from engines.preflight import run_preflight
from engines.contour_engine import generate_contour_cut_svg
from engines.flipbook_worker import generate_flipbook_task, generate_html_content, export_flipbook_task
from engines.helpers import apply_print_binding_padding

app = FastAPI(title="ESSR PA API")
app.include_router(settings_router)
app.include_router(imposing_router)

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

TASK_STATES = {}
PROJECT_CACHE = {}

@app.get("/")
def read_root():
    return {"status": "ok", "message": "ESSR PA Backend Running"}

@app.post("/api/preflight")
async def analyze_pdfs(files: List[UploadFile] = File(...)):
    saved_paths = []
    try:
        for file in files:
            file_path = f"temp_uploads/{file.filename}"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_paths.append(file_path)
            
        result = run_preflight(saved_paths)
        return result
    finally:
        for path in saved_paths:
            if os.path.exists(path):
                os.remove(path)

@app.post("/api/flipbook")
async def create_flipbook(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
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
    
    for file in files:
        file_path = f"temp_uploads/{task_id}_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        saved_paths.append(file_path)
        
    output_filename = f"flipbook_{task_id}.html"
    output_path = f"public_flipbooks/{output_filename}"

    TASK_STATES[task_id] = {"state": "PENDING", "status": "Pending...", "progress": 0}


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
        
    return {"success": True, "output": cached["output_path"], "message": "Flipbook updated instantly!"}


@app.post("/api/flipbook/export")
async def export_flipbook(
    background_tasks: BackgroundTasks,
    task_id: str = Form(...),
    dpi: int = Form(150),
    zip_output: bool = Form(True)
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
        zip_output=zip_output
    )
    
    return {"task_id": export_task_id, "message": "Export started"}

@app.get("/api/tasks/{task_id}")
async def get_task_status(task_id: str):
    state = TASK_STATES.get(task_id)
    if state:
        return state
    return {"state": "UNKNOWN", "status": "Task not found", "progress": 0}



CONTOUR_CACHE = {}

@app.post("/api/contour/upload")
async def upload_contour_file(file: UploadFile = File(...)):
    try:
        os.makedirs("temp_uploads", exist_ok=True)
        file_id = str(uuid.uuid4())[:12]
        file_path = f"temp_uploads/{file_id}_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        CONTOUR_CACHE[file_id] = file_path
        return {"success": True, "file_id": file_id}
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
    pdf_page: int = Form(0)
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
            smoothing_factor=smoothing_factor
        )
        
        return {"success": True, "svg": svg_content}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
