import os
import uuid
import fitz
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from engines.sheet_packer import MaxRectsSheetPacker, SheetArtworkSpec, SingleSheetResult
from engines.roll_packer import MeterSegmentPacker, ArtworkSpec as RollArtworkSpec, MeterSegmentPackingResult
from engines.sheet_gang_exporter import SheetGangExporter


router = APIRouter()

class ImposingItem(BaseModel):
    file_id: str
    copies: int
    name: str
    w: Optional[float] = None
    h: Optional[float] = None

class ImposingRequest(BaseModel):
    items: List[ImposingItem]
    mode: str = "Sheet"
    sheet_w: float = 320.0
    sheet_h: float = 450.0
    margin: float = 10.0
    gap: float = 5.0
    draw_border: bool = False
    border_color: str = "#000000"
    crop_marks: bool = False
    align: str = "Left"
    nesting_mode: str = "Grid"
    auto_rotate_sheet: bool = True

def get_dimensions_mm(file_path: str):
    # Try pdf first
    if file_path.lower().endswith(".pdf"):
        doc = fitz.open(file_path)
        rect = doc[0].rect
        return (rect.width / 72.0) * 25.4, (rect.height / 72.0) * 25.4
    else:
        import cv2
        img = cv2.imread(file_path)
        if img is not None:
            # Assume 300 DPI if unknown
            h, w = img.shape[:2]
            return (w / 300.0) * 25.4, (h / 300.0) * 25.4
    return 100.0, 100.0

@router.post("/api/imposing/upload")
async def upload_imposing_file(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1].lower()
    if not ext: ext = ".pdf"
    file_path = f"temp_uploads/{file_id}{ext}"
    
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
        
    w, h = get_dimensions_mm(file_path)
    
    # Generate thumbnail
    thumb_path = f"temp_uploads/{file_id}_thumb.png"
    try:
        if ext == ".pdf":
            doc = fitz.open(file_path)
            pix = doc[0].get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
            pix.save(thumb_path)
        else:
            import cv2
            img = cv2.imread(file_path)
            if img is not None:
                h_img, w_img = img.shape[:2]
                scale = min(400 / w_img, 400 / h_img)
                if scale < 1:
                    img = cv2.resize(img, (int(w_img*scale), int(h_img*scale)))
                cv2.imwrite(thumb_path, img)
            else:
                raise Exception("Not an image")
    except:
        thumb_path = ""
    
    return {
        "success": True, 
        "file_id": f"{file_id}{ext}", 
        "name": file.filename, 
        "w": round(w, 2), 
        "h": round(h, 2),
        "thumb": f"{file_id}_thumb.png" if thumb_path else ""
    }

def apply_alignment(items, sheet_w, margin, align):
    if not items or align == "Left":
        return
    max_x = max(i.x_mm + i.w_mm for i in items)
    usable_w = sheet_w - (margin * 2)
    content_w = max_x - margin
    if content_w >= usable_w - 0.1: return
    shift = 0
    if align == "Center": shift = (usable_w - content_w) / 2.0
    elif align == "Right": shift = usable_w - content_w
    for i in items:
        i.x_mm += shift

@router.post("/api/imposing/preview")
def preview_imposing(req: ImposingRequest):
    try:
        if req.mode == "Sheet":
            specs = []
            for item in req.items:
                path = f"temp_uploads/{item.file_id}"
                w = item.w if item.w is not None else get_dimensions_mm(path)[0]
                h = item.h if item.h is not None else get_dimensions_mm(path)[1]
                specs.append(SheetArtworkSpec(
                    name=item.name,
                    piece_w_mm=w, piece_h_mm=h,
                    quantity=item.copies,
                    pdf_path=path
                ))
            
            results = MaxRectsSheetPacker.pack_sheets(
                sheet_w_mm=req.sheet_w, sheet_h_mm=req.sheet_h,
                margin_l_mm=req.margin, margin_r_mm=req.margin,
                margin_t_mm=req.margin, margin_b_mm=req.margin,
                gap_mm=req.gap,
                artworks=specs,
                allow_rotation=True
            )
            
            pages = len(results)
            efficiency = (sum(r.efficiency_pct for r in results) / pages) if pages > 0 else 0
            
            # Simple visualization data
            # Return bounding boxes of ALL pages to render in frontend!
            preview_pages = []
            for res in results:
                boxes = []
                thumb_map = {item.name: item.file_id.split('.')[0] + '_thumb.png' for item in req.items}
                for placed in res.placed_items:
                    boxes.append({
                        "x": placed.x_mm, "y": placed.y_mm, "w": placed.w_mm, "h": placed.h_mm, "rotated": getattr(placed, 'rotated', False),
                        "thumb": thumb_map.get(placed.name, "")
                    })
                preview_pages.append({
                    "w": req.sheet_w, "h": req.sheet_h, "boxes": boxes
                })
                    
            return {
                "success": True,
                "stats": {
                    "pages": pages,
                    "avg_efficiency": round(efficiency, 1)
                },
                "preview_pages": preview_pages
            }
        else:
            # Roll Mode
            specs = []
            for item in req.items:
                path = f"temp_uploads/{item.file_id}"
                w = item.w if item.w is not None else get_dimensions_mm(path)[0]
                h = item.h if item.h is not None else get_dimensions_mm(path)[1]
                specs.append(RollArtworkSpec(
                    name=item.name,
                    w_mm=w, h_mm=h,
                    quantity=item.copies,
                    path=path
                ))
                
            res = MeterSegmentPacker.pack_multi_artworks(
                roll_width_mm=req.sheet_w, # sheet_w acts as roll width
                segment_limit_mm=req.sheet_h,
                margin_l_mm=req.margin, margin_r_mm=req.margin,
                margin_t_mm=req.margin, margin_b_mm=req.margin,
                gap_mm=req.gap,
                artworks=specs
            )
            
            # Preview ALL segments
            preview_pages = []
            for seg in res.segments:
                boxes = []
                thumb_map = {item.name: item.file_id.split('.')[0] + '_thumb.png' for item in req.items}
                for placed in seg.items:
                    boxes.append({
                        "x": placed.x_mm, "y": placed.y_mm, "w": placed.w_mm, "h": placed.h_mm, "rotated": getattr(placed, 'rotated', False),
                        "thumb": thumb_map.get(placed.name, "")
                    })
                preview_pages.append({
                    "w": req.sheet_w, "h": seg.segment_length_mm, "boxes": boxes
                })
                    
            return {
                "success": True,
                "stats": {
                    "total_length_m": round(res.total_roll_length_mm / 1000.0, 2),
                    "segments": len(res.segments),
                    "avg_efficiency": round(res.total_used_item_m2 / res.total_invoiced_m2 * 100, 1) if res.total_invoiced_m2 > 0 else 0
                },
                "preview_pages": preview_pages
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/api/imposing/export")
def export_imposing(req: ImposingRequest):
    try:
        out_path = f"temp_uploads/imposing_export_{uuid.uuid4().hex[:8]}.pdf"
        
        if req.mode == "Sheet":
            specs = []
            for item in req.items:
                path = f"temp_uploads/{item.file_id}"
                w = item.w if item.w is not None else get_dimensions_mm(path)[0]
                h = item.h if item.h is not None else get_dimensions_mm(path)[1]
                specs.append(SheetArtworkSpec(
                    name=item.name, piece_w_mm=w, piece_h_mm=h,
                    quantity=item.copies, pdf_path=path
                ))
            
            results = MaxRectsSheetPacker.pack_sheets(
                sheet_w_mm=req.sheet_w, sheet_h_mm=req.sheet_h,
                margin_l_mm=req.margin, margin_r_mm=req.margin,
                margin_t_mm=req.margin, margin_b_mm=req.margin,
                gap_mm=req.gap, artworks=specs, allow_rotation=True
            )
            
            SheetGangExporter.export_pdf(
                sheet_results=results,
                output_pdf_path=out_path,
                show_crop_marks=req.crop_marks,
                show_reg_marks=False,
                draw_cut_contour=False,
                draw_border=req.draw_border,
                border_color=req.border_color
            )
        else:
            # Roll Mode export - we can just use fitz to create one massive page per segment!
            specs = []
            for item in req.items:
                path = f"temp_uploads/{item.file_id}"
                w = item.w if item.w is not None else get_dimensions_mm(path)[0]
                h = item.h if item.h is not None else get_dimensions_mm(path)[1]
                specs.append(RollArtworkSpec(
                    name=item.name, piece_w_mm=w, piece_h_mm=h,
                    quantity=item.copies
                ))
                
            res = MeterSegmentPacker.pack_multi_artworks(
                roll_width_mm=req.sheet_w, segment_limit_mm=req.sheet_h,
                margin_l_mm=req.margin, margin_r_mm=req.margin,
                margin_t_mm=req.margin, margin_b_mm=req.margin,
                gap_mm=req.gap, artworks=specs
            )
            
            doc = fitz.open()
            for seg in res.segments:
                page = doc.new_page(width=(req.sheet_w / 25.4 * 72.0), height=(seg.segment_length_mm / 25.4 * 72.0))
                for placed in seg.items:
                    try:
                        path_map = {item.name: f'temp_uploads/{item.file_id}' for item in req.items}
                        src_doc = fitz.open(path_map[placed.name])
                        src_page = src_doc[0]
                        rect = fitz.Rect(
                            placed.x_mm / 25.4 * 72.0,
                            placed.y_mm / 25.4 * 72.0,
                            (placed.x_mm + placed.w_mm) / 25.4 * 72.0,
                            (placed.y_mm + placed.h_mm) / 25.4 * 72.0
                        )
                        page.show_pdf_page(rect, src_doc, 0, clip=src_page.rect)
                    except:
                        pass # Ignore if not PDF or missing
                    
                    shape = page.new_shape()
                    if req.draw_border:
                        def hex_to_rgb(h):
                            h = h.lstrip('#')
                            return tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4)) if len(h)==6 else (0,0,0)
                        shape.draw_rect(rect)
                        shape.finish(color=hex_to_rgb(req.border_color), width=1.0, stroke_opacity=1.0)
                        
                    if req.crop_marks:
                        off = 1.5 * (72.0 / 25.4)
                        mlen = 3.0 * (72.0 / 25.4)
                        ix_pt, iy_pt = rect.x0, rect.y0
                        iw_pt, ih_pt = rect.width, rect.height
                        # Top-left corner
                        shape.draw_line(fitz.Point(ix_pt - off, iy_pt), fitz.Point(ix_pt - off - mlen, iy_pt))
                        shape.draw_line(fitz.Point(ix_pt, iy_pt - off), fitz.Point(ix_pt, iy_pt - off - mlen))
                        # Top-right corner
                        shape.draw_line(fitz.Point(ix_pt + iw_pt + off, iy_pt), fitz.Point(ix_pt + iw_pt + off + mlen, iy_pt))
                        shape.draw_line(fitz.Point(ix_pt + iw_pt, iy_pt - off), fitz.Point(ix_pt + iw_pt, iy_pt - off - mlen))
                        # Bottom-left corner
                        shape.draw_line(fitz.Point(ix_pt - off, iy_pt + ih_pt), fitz.Point(ix_pt - off - mlen, iy_pt + ih_pt))
                        shape.draw_line(fitz.Point(ix_pt, iy_pt + ih_pt + off), fitz.Point(ix_pt, iy_pt + ih_pt + off + mlen))
                        # Bottom-right corner
                        shape.draw_line(fitz.Point(ix_pt + iw_pt + off, iy_pt + ih_pt), fitz.Point(ix_pt + iw_pt + off + mlen, iy_pt + ih_pt))
                        shape.draw_line(fitz.Point(ix_pt + iw_pt, iy_pt + ih_pt + off), fitz.Point(ix_pt + iw_pt, iy_pt + ih_pt + off + mlen))
                        shape.finish(color=(0, 0, 0), width=0.2, stroke_opacity=1.0)
                    shape.commit()
            doc.save(out_path)
            
        return FileResponse(out_path, filename="Imposed_Print_File.pdf", media_type="application/pdf")
    except Exception as e:
        return {"success": False, "error": str(e)}

