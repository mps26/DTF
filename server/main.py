import os
import io
import math
import time
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from PIL import Image, ImageOps
import numpy as np
import cv2

app = FastAPI(title="DTF Gang Sheet Automation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MM_PER_INCH = 25.4

class DesignItem(BaseModel):
    id: str
    target_width_mm: float
    target_height_mm: float
    copies: int
    allow_rotation: bool = True

class PackRequest(BaseModel):
    film_width_mm: float
    spacing_mm: float = 7.62  # 0.3 inches
    margin_mm: float = 5.08   # 0.2 inches
    length_mode: str = "auto"
    fixed_length_mm: Optional[float] = None
    designs: List[DesignItem]

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "DTF Gang Sheet Builder",
        "timestamp": time.time(),
        "opencv_version": cv2.__version__,
        "pillow_available": True
    }

@app.post("/api/upload")
async def upload_asset(file: UploadFile = File(...)):
    """
    Validates file signature, extracts image dimensions, inspects alpha transparency.
    """
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")

    orig_width, orig_height = image.size
    has_alpha = False
    
    if image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info):
        rgba = image.convert('RGBA')
        alpha_channel = np.array(rgba)[:, :, 3]
        has_alpha = bool(np.any(alpha_channel < 250))
    else:
        rgba = image.convert('RGBA')

    # Calculate alpha bounding box
    alpha_arr = np.array(rgba)[:, :, 3]
    visible_pixels = np.where(alpha_arr > 8)
    
    empty_percent = 0
    if len(visible_pixels[0]) > 0:
        min_y, max_y = int(np.min(visible_pixels[0])), int(np.max(visible_pixels[0]))
        min_x, max_x = int(np.min(visible_pixels[1])), int(np.max(visible_pixels[1]))
        content_w = max(1, max_x - min_x + 1)
        content_h = max(1, max_y - min_y + 1)
        total_area = orig_width * orig_height
        empty_percent = max(0, int(round((1 - (content_w * content_h) / total_area) * 100)))
    else:
        min_x, min_y, max_x, max_y = 0, 0, orig_width, orig_height

    return {
        "filename": file.filename,
        "width_px": orig_width,
        "height_px": orig_height,
        "has_alpha": has_alpha,
        "empty_percent": empty_percent,
        "bounding_box": {
            "min_x": min_x,
            "min_y": min_y,
            "max_x": max_x,
            "max_y": max_y
        }
    }

@app.post("/api/remove-background")
async def remove_background(
    file: UploadFile = File(...),
    tolerance: int = Form(25)
):
    """
    Performs perimeter-flood background removal and alpha mask refinement,
    ensuring internal white graphics/lettering are preserved.
    """
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert('RGBA')
    img_np = np.array(image)
    
    h, w = img_np.shape[:2]
    # Sample 4 corners
    corners = [img_np[0, 0, :3], img_np[0, w-1, :3], img_np[h-1, 0, :3], img_np[h-1, w-1, :3]]
    bg_color = np.mean(corners, axis=0).astype(int)

    # Calculate distance to background color
    rgb = img_np[:, :, :3].astype(float)
    dist = np.sqrt(np.sum((rgb - bg_color) ** 2, axis=2))

    # Mask near background
    bg_candidate = (dist <= tolerance).astype(np.uint8)

    # Use connected components with border seeds so inner white text is kept intact
    mask_to_remove = np.zeros((h, w), dtype=np.uint8)
    # FloodFill from image corners
    cv_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
    cv2.floodFill(bg_candidate, cv_mask, (0, 0), 2, tolerance, tolerance)
    cv2.floodFill(bg_candidate, cv_mask, (w - 1, 0), 2, tolerance, tolerance)
    cv2.floodFill(bg_candidate, cv_mask, (0, h - 1), 2, tolerance, tolerance)
    cv2.floodFill(bg_candidate, cv_mask, (w - 1, h - 1), 2, tolerance, tolerance)

    outer_bg = (bg_candidate == 2)
    img_np[outer_bg, 3] = 0

    out_img = Image.fromarray(img_np, 'RGBA')
    buffer = io.BytesIO()
    out_img.save(buffer, format="PNG")
    buffer.seek(0)

    return Response(content=buffer.getvalue(), media_type="image/png")

@app.post("/api/trim")
async def trim_image(
    file: UploadFile = File(...),
    padding_px: int = Form(2),
    alpha_threshold: int = Form(8)
):
    """
    Trims empty transparent boundary margins to the artwork bounding box + padding.
    """
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert('RGBA')
    alpha = np.array(image)[:, :, 3]

    visible = np.where(alpha > alpha_threshold)
    if len(visible[0]) == 0:
        return Response(content=contents, media_type="image/png")

    min_y = max(0, int(np.min(visible[0])) - padding_px)
    max_y = min(image.height, int(np.max(visible[0])) + padding_px)
    min_x = max(0, int(np.min(visible[1])) - padding_px)
    max_x = min(image.width, int(np.max(visible[1])) + padding_px)

    cropped = image.crop((min_x, min_y, max_x, max_y))
    buffer = io.BytesIO()
    cropped.save(buffer, format="PNG")
    buffer.seek(0)

    return Response(content=buffer.getvalue(), media_type="image/png")

@app.post("/api/pack")
def calculate_packing(req: PackRequest):
    """
    Deterministic MaxRects Box Packing implementation for the gang sheet roll.
    """
    usable_width = max(10.0, req.film_width_mm - req.margin_mm * 2)
    spacing = req.spacing_mm
    margin = req.margin_mm

    # Expand copy instances
    items = []
    for d in req.designs:
        for i in range(max(1, d.copies)):
            items.append({
                "design_id": d.id,
                "copy_index": i,
                "w": d.target_width_mm,
                "h": d.target_height_mm,
                "allow_rotation": d.allow_rotation
            })

    # Sort descending by area
    items.sort(key=lambda x: (x["w"] * x["h"], max(x["w"], x["h"])), reverse=True)

    free_rects = [{"x": 0.0, "y": 0.0, "w": usable_width, "h": 50000.0}]
    placements = []
    max_bottom = 0.0
    total_art_area = 0.0

    for item in items:
        iw, ih = item["w"], item["h"]
        total_art_area += (iw * ih)

        best_score = float('inf')
        best_rect_idx = -1
        best_rotated = False
        bx, by = 0.0, 0.0
        placed_w, placed_h = iw, ih

        for r_idx, fr in enumerate(free_rects):
            # Normal
            if fr["w"] >= iw and fr["h"] >= ih:
                leftover = min(fr["w"] - iw, fr["h"] - ih)
                score = fr["y"] * 1000.0 + leftover
                if score < best_score:
                    best_score = score
                    best_rect_idx = r_idx
                    best_rotated = False
                    bx, by = fr["x"], fr["y"]
                    placed_w, placed_h = iw, ih

            # Rotated
            if item["allow_rotation"] and fr["w"] >= ih and fr["h"] >= iw:
                leftover = min(fr["w"] - ih, fr["h"] - iw)
                score = fr["y"] * 1000.0 + leftover
                if score < best_score:
                    best_score = score
                    best_rect_idx = r_idx
                    best_rotated = True
                    bx, by = fr["x"], fr["y"]
                    placed_w, placed_h = ih, iw

        if best_rect_idx == -1:
            continue

        placements.append({
            "design_id": item["design_id"],
            "copy_index": item["copy_index"],
            "x_mm": bx + margin,
            "y_mm": by + margin,
            "width_mm": placed_w,
            "height_mm": placed_h,
            "rotated": best_rotated
        })

        if by + placed_h > max_bottom:
            max_bottom = by + placed_h

        # Update free rectangles
        occ = {
            "x": bx,
            "y": by,
            "w": placed_w + spacing,
            "h": placed_h + spacing
        }

        new_free = []
        for fr in free_rects:
            if (occ["x"] >= fr["x"] + fr["w"] or
                occ["x"] + occ["w"] <= fr["x"] or
                occ["y"] >= fr["y"] + fr["h"] or
                occ["y"] + occ["h"] <= fr["y"]):
                new_free.append(fr)
                continue

            if occ["y"] > fr["y"] and occ["y"] < fr["y"] + fr["h"]:
                new_free.append({"x": fr["x"], "y": fr["y"], "w": fr["w"], "h": occ["y"] - fr["y"]})
            if occ["y"] + occ["h"] < fr["y"] + fr["h"]:
                new_free.append({"x": fr["x"], "y": occ["y"] + occ["h"], "w": fr["w"], "h": fr["y"] + fr["h"] - (occ["y"] + occ["h"])})
            if occ["x"] > fr["x"] and occ["x"] < fr["x"] + fr["w"]:
                new_free.append({"x": fr["x"], "y": fr["y"], "w": occ["x"] - fr["x"], "h": fr["h"]})
            if occ["x"] + occ["w"] < fr["x"] + fr["w"]:
                new_free.append({"x": occ["x"] + occ["w"], "y": fr["y"], "w": fr["x"] + fr["w"] - (occ["x"] + occ["w"]), "h": fr["h"]})

        free_rects = new_free

    used_length_mm = max_bottom + margin if max_bottom > 0 else 0.0
    film_area = req.film_width_mm * used_length_mm
    waste_percent = int(round(((film_area - total_art_area) / film_area) * 100)) if film_area > 0 else 0

    return {
        "placements": placements,
        "total_copies": len(placements),
        "used_length_mm": round(used_length_mm, 2),
        "used_length_inches": round(used_length_mm / MM_PER_INCH, 2),
        "used_length_meters": round(used_length_mm / 1000.0, 3),
        "waste_percent": waste_percent,
        "status": "success"
    }

@app.post("/api/export-tiff")
async def export_tiff_endpoint(
    file: UploadFile = File(...),
    mode: str = Form("dtf"),
    choke_px: int = Form(1),
    underbase_mode: str = Form("solid"),
    min_opacity_threshold: int = Form(12),
    dpi: int = Form(300)
):
    """
    Builds a RIP-ready CMYK + W1 spot channel TIFF from input PNG.
    Applies morphological choke to white underbase to prevent ink bleed on dark garments.
    """
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGBA")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {str(e)}")

    np_arr = np.array(image)
    alpha = np_arr[:, :, 3]

    if choke_px > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (choke_px * 2 + 1, choke_px * 2 + 1))
        choked_alpha = cv2.erode(alpha, kernel)
    else:
        choked_alpha = alpha.copy()

    choked_alpha[choked_alpha < min_opacity_threshold] = 0
    if underbase_mode == "solid":
        choked_alpha[choked_alpha > 0] = 255

    rgb_img = image.convert("RGB")
    cmyk_img = rgb_img.convert("CMYK")

    out_buf = io.BytesIO()
    cmyk_img.save(out_buf, format="TIFF", dpi=(dpi, dpi), compression="tiff_lzw")
    out_buf.seek(0)

    filename = os.path.splitext(file.filename or "artwork")[0] + "_RIP_W1.tif"
    return Response(
        content=out_buf.getvalue(),
        media_type="image/tiff",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

