import base64
import gc
import json
import os
import zipfile
import traceback
from string import Template
import fitz

from engines.helpers import apply_print_binding_padding
from engines.resources import BLUEWHALE_SVG_LOGO

_HERE = os.path.dirname(os.path.abspath(__file__))
_TEMPLATE_PATH = os.path.join(_HERE, 'templates', 'flipbook.html')
try:
    with open(_TEMPLATE_PATH, 'r', encoding='utf-8') as _f:
        _FLIPBOOK_TEMPLATE = Template(_f.read())
except (FileNotFoundError, IOError):
    _FLIPBOOK_TEMPLATE = None

def generate_html_content(b64_pages, original_pdf_name, direction, binding_style, bg_texture, sound_enabled, page_w, page_h):
    dir_code = "rtl" if "RTL" in direction else "ltr"
    rtl_mode_class = "rtl-mode" if dir_code == "rtl" else ""

    binding = binding_style
    if "Hard Cover" in binding:
        spine_class = "spine-hard-cover"
        shadow_op = 0.65
    elif "Magazine" in binding:
        spine_class = "spine-magazine"
        shadow_op = 0.4
    elif "Spiral" in binding:
        spine_class = "spine-spiral"
        shadow_op = 0.5
    elif "Plastic Comb" in binding:
        spine_class = "spine-plastic-comb"
        shadow_op = 0.5
    elif "Double Wire" in binding:
        spine_class = "spine-wire-o"
        shadow_op = 0.5
    else:
        spine_class = "spine-soft-cover"
        shadow_op = 0.5

    if bg_texture == "Wooden Desk":
        bg_css = "background: radial-gradient(circle, #8b5a2b, #5c3a21);"
        color_css = "color: var(--text-slate-100);"
    elif bg_texture == "Minimalist Light":
        bg_css = "background-color: #f8fafc;"
        color_css = "color: #1e293b;"
    else:
        bg_css = "background-color: var(--bg-slate-950);"
        color_css = "color: var(--text-slate-100);"

    if _FLIPBOOK_TEMPLATE is None:
        raise ValueError("Flipbook HTML template not found!")

    return _FLIPBOOK_TEMPLATE.substitute(
        dir_code=dir_code,
        first_pdf_name=original_pdf_name,
        bg_css=bg_css,
        color_css=color_css,
        logo_svg=BLUEWHALE_SVG_LOGO,
        binding_style=binding_style,
        rtl_mode_class=rtl_mode_class,
        spine_class=spine_class,
        pages_json=json.dumps(b64_pages),
        page_w=page_w,
        page_h=page_h,
        shadow_op=shadow_op,
        sound_json=json.dumps(sound_enabled),
        is_rtl_json=json.dumps(dir_code == "rtl"),
    )

def _render_pdf_pages(pdf_paths, target_indices, dpi, export_mode, output_path, update_state=None, eco_mode=False):
    if update_state: update_state("Opening PDF documents...", 0)
    docs = []
    try:
        docs = [fitz.open(p) for p in pdf_paths]
    except Exception:
        for d in docs: d.close()
        raise

    page_refs = []
    for doc in docs:
        for p_num in range(len(doc)):
            page_refs.append((doc, p_num))

    if not target_indices:
        target_indices = list(range(len(page_refs)))

    total_pages = len(target_indices)
    b64_pages = []

    for current_page in range(total_pages):
        if update_state: update_state(f"Rendering page {current_page + 1} of {total_pages}...", int((current_page / total_pages) * 80))
        
        src_idx = target_indices[current_page]
        doc_obj, p_idx = page_refs[src_idx]
        page = doc_obj[p_idx]

        rect = page.rect
        scale = dpi / 72.0
        max_dim = 1100.0
        if rect.width * scale > max_dim or rect.height * scale > max_dim:
            scale = min(max_dim / rect.width, max_dim / rect.height)

        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_data = pix.tobytes("jpg", jpg_quality=72)

        if "Folder Assets" in export_mode:
            assets_dir = os.path.splitext(output_path)[0] + "_files"
            os.makedirs(assets_dir, exist_ok=True)
            img_filename = f"page_{current_page+1:04d}.jpg"
            img_filepath = os.path.join(assets_dir, img_filename)
            with open(img_filepath, "wb") as f:
                f.write(img_data)
            rel_path = f"{os.path.basename(assets_dir)}/{img_filename}"
            b64_pages.append(rel_path)
        else:
            b64_str = base64.b64encode(img_data).decode("utf-8")
            b64_pages.append(f"data:image/jpeg;base64,{b64_str}")

        if eco_mode:
            pix = None
            img_data = None
            gc.collect()

    if not b64_pages:
        raise ValueError("No pages were rendered.")

    original_pdf_name = os.path.basename(pdf_paths[0]) if pdf_paths else "Flipbook"
    first_doc_page = page_refs[target_indices[0]] if target_indices and page_refs else (docs[0], 0)
    page_w = int(first_doc_page[0][first_doc_page[1]].rect.width) if docs else 500
    page_h = int(first_doc_page[0][first_doc_page[1]].rect.height) if docs else 650

    for d in docs: d.close()

    return b64_pages, original_pdf_name, page_w, page_h

def generate_flipbook_task(task_id, state_dict, project_cache, pdf_paths, output_path, dpi=101, eco_mode=False, 
                           target_indices=None, direction="Left to Right (LTR)", 
                           binding_style="Soft Cover (Paperback)", 
                           export_mode="Folder Assets (Ultra-Fast & Light HTML)", 
                           mag_pad_choice="At the very end", add_flyleaves=False, 
                           bg_texture="Dark Mode", sound_enabled=False):
    
    def update_state(message, progress):
        state_dict[task_id] = {'state': 'PROGRESS', 'message': message, 'progress': progress}

    try:
        b64_pages, original_pdf_name, page_w, page_h = _render_pdf_pages(
            pdf_paths, target_indices, dpi, export_mode, output_path, update_state, eco_mode
        )

        project_cache[task_id] = {
            "pdf_paths": pdf_paths,
            "target_indices": target_indices,
            "b64_pages": b64_pages,
            "original_pdf_name": original_pdf_name,
            "page_w": page_w,
            "page_h": page_h,
            "output_path": output_path,
            
            # Save settings for export task
            "direction": direction,
            "binding_style": binding_style,
            "mag_pad_choice": mag_pad_choice,
            "add_flyleaves": add_flyleaves,
            "bg_texture": bg_texture,
            "sound_enabled": sound_enabled
        }

        update_state("Applying print binding padding & flyleaves...", 85)
        padded_pages = apply_print_binding_padding(list(b64_pages), binding_style, add_flyleaves, mag_pad_choice)

        update_state("Saving HTML flipbook output...", 95)
        html_content = generate_html_content(padded_pages, original_pdf_name, direction, binding_style, bg_texture, sound_enabled, page_w, page_h)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)
            
        state_dict[task_id] = {
            "state": "SUCCESS", 
            "result": {"success": True, "output": output_path, "message": "Flipbook generated successfully!"},
            "status": "Task completed!",
            "progress": 100
        }
    except Exception as e:
        state_dict[task_id] = {
            "state": "FAILURE", 
            "status": str(e),
            "progress": 0
        }

def export_flipbook_task(task_id, state_dict, project_cache, export_task_id, output_path, dpi, zip_output):
    def update_state(message, progress):
        state_dict[export_task_id] = {'state': 'PROGRESS', 'message': message, 'progress': progress}

    try:
        cached = project_cache[task_id]
        
        # Render at new DPI with Base64 mode
        b64_pages, original_pdf_name, page_w, page_h = _render_pdf_pages(
            cached["pdf_paths"], cached["target_indices"], dpi, "Standalone Base64 (Single HTML File)", output_path, update_state, False
        )
        
        update_state("Applying binding settings...", 85)
        padded_pages = apply_print_binding_padding(
            list(b64_pages), 
            cached["binding_style"], 
            cached["add_flyleaves"], 
            cached["mag_pad_choice"]
        )

        update_state("Generating standalone HTML...", 90)
        html_content = generate_html_content(
            padded_pages, original_pdf_name, 
            cached["direction"], cached["binding_style"], 
            cached["bg_texture"], cached["sound_enabled"], 
            page_w, page_h
        )
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        final_output = output_path
        if zip_output:
            update_state("Compressing into ZIP archive...", 95)
            zip_path = output_path.replace(".html", ".zip")
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(output_path, os.path.basename(output_path))
            final_output = zip_path
            os.remove(output_path) # Clean up the huge HTML file

        state_dict[export_task_id] = {
            "state": "SUCCESS", 
            "result": {"success": True, "output": final_output, "message": "Export completed successfully!"},
            "status": "Export completed!",
            "progress": 100
        }
    except Exception as e:
        state_dict[export_task_id] = {
            "state": "FAILURE", 
            "status": str(e),
            "progress": 0
        }
