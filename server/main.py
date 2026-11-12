import os
import io
import math
import time
import struct
import sqlite3
import hashlib
import secrets
from datetime import datetime, timezone
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
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dtf_users.db")


def hash_password(password: str, salt: Optional[str] = None) -> str:
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_hex = stored_hash.split("$", 1)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
        return secrets.compare_digest(dk.hex(), expected_hex)
    except Exception:
        return False


def get_initials(name: str) -> str:
    parts = name.strip().split()
    if not parts:
        return "US"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db() -> None:
    conn = get_db_connection()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                company_name TEXT NOT NULL,
                printer_model TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'shop_owner',
                plan TEXT NOT NULL DEFAULT 'Pro Print House',
                initials TEXT NOT NULL,
                avatar_color TEXT NOT NULL,
                created_at TEXT NOT NULL,
                password_hash TEXT NOT NULL
            )
            """
        )
        default_users = [
            (
                "user_ninad_pawar",
                "Ninad Pawar",
                "ninad@dtflayout.com",
                "Apex DTF Printworks",
                '24" Dual Epson i3200 (Hoson)',
                "shop_owner",
                "Industrial Enterprise",
                "NP",
                "from-purple-600 to-indigo-600",
                "2026-01-15T08:00:00Z",
                hash_password("password123"),
            ),
            (
                "user_demo_operator",
                "Alex Turner",
                "demo@dtflayout.com",
                "Metro Gang Sheets Co.",
                '22" 4-Head DTF Line (Maintop)',
                "operator",
                "Pro Print House",
                "AT",
                "from-blue-600 to-cyan-600",
                "2026-03-01T10:30:00Z",
                hash_password("demo123"),
            ),
        ]
        conn.executemany(
            """
            INSERT OR IGNORE INTO users (
                id, name, email, company_name, printer_model,
                role, plan, initials, avatar_color, created_at, password_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            default_users,
        )
        conn.commit()
    finally:
        conn.close()


init_auth_db()


def row_to_user_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "companyName": row["company_name"],
        "printerModel": row["printer_model"],
        "role": row["role"],
        "plan": row["plan"],
        "initials": row["initials"],
        "avatarColor": row["avatar_color"],
        "createdAt": row["created_at"],
    }


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    companyName: str = ""
    printerModel: str = '22" Direct-to-Film Production Roll'


class LoginRequest(BaseModel):
    email: str
    password: str


class UpdateProfileRequest(BaseModel):
    id: Optional[str] = None
    email: str
    name: Optional[str] = None
    companyName: Optional[str] = None
    printerModel: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    email: str
    currentPassword: str
    newPassword: str


@app.post("/api/auth/register")
def auth_register(payload: RegisterRequest):
    email_norm = payload.email.strip().lower()
    name_clean = payload.name.strip()
    if not name_clean:
        return {"success": False, "error": "Full name is required."}
    if not email_norm:
        return {"success": False, "error": "Email address is required."}
    if len(payload.password) < 6:
        return {"success": False, "error": "Password must be at least 6 characters long."}

    colors = [
        "from-indigo-600 to-purple-600",
        "from-blue-600 to-indigo-600",
        "from-emerald-600 to-teal-600",
        "from-amber-600 to-orange-600",
        "from-rose-600 to-pink-600",
    ]
    chosen_color = secrets.choice(colors)
    user_id = f"user_{int(time.time() * 1000)}_{secrets.token_hex(3)}"
    created_at = datetime.now(timezone.utc).isoformat()
    company_name = payload.companyName.strip() or "Independent Print Shop"
    printer_model = payload.printerModel.strip() or '22" Direct-to-Film Production Roll'
    initials = get_initials(name_clean)
    pw_hash = hash_password(payload.password)

    conn = get_db_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE LOWER(email) = ?", (email_norm,)
        ).fetchone()
        if existing:
            return {
                "success": False,
                "error": "An account with this email address already exists. Please log in.",
            }

        conn.execute(
            """
            INSERT INTO users (
                id, name, email, company_name, printer_model,
                role, plan, initials, avatar_color, created_at, password_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                name_clean,
                email_norm,
                company_name,
                printer_model,
                "shop_owner",
                "Pro Print House",
                initials,
                chosen_color,
                created_at,
                pw_hash,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return {"success": True, "user": row_to_user_dict(row)}
    finally:
        conn.close()


@app.post("/api/auth/login")
def auth_login(payload: LoginRequest):
    email_norm = payload.email.strip().lower()
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE LOWER(email) = ?", (email_norm,)
        ).fetchone()
        if not row:
            return {
                "success": False,
                "error": "No account found with this email. Please check your credentials or register.",
            }
        if not verify_password(payload.password, row["password_hash"]):
            return {
                "success": False,
                "error": "Invalid password. Please re-enter your password.",
            }
        return {"success": True, "user": row_to_user_dict(row)}
    finally:
        conn.close()


@app.post("/api/auth/profile")
def auth_update_profile(payload: UpdateProfileRequest):
    email_norm = payload.email.strip().lower()
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE LOWER(email) = ?", (email_norm,)
        ).fetchone()
        if not row:
            return {"success": False, "error": "User not found."}
        new_name = payload.name.strip() if payload.name else row["name"]
        new_company = payload.companyName.strip() if payload.companyName is not None else row["company_name"]
        new_printer = payload.printerModel.strip() if payload.printerModel is not None else row["printer_model"]
        new_initials = get_initials(new_name)
        conn.execute(
            """
            UPDATE users
            SET name = ?, company_name = ?, printer_model = ?, initials = ?
            WHERE id = ?
            """,
            (new_name, new_company, new_printer, new_initials, row["id"]),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
        return {"success": True, "user": row_to_user_dict(updated)}
    finally:
        conn.close()


@app.post("/api/auth/password")
def auth_change_password(payload: ChangePasswordRequest):
    if len(payload.newPassword) < 6:
        return {"success": False, "error": "New password must be at least 6 characters long."}
    email_norm = payload.email.strip().lower()
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE LOWER(email) = ?", (email_norm,)
        ).fetchone()
        if not row:
            return {"success": False, "error": "User not found."}
        if not verify_password(payload.currentPassword, row["password_hash"]):
            return {"success": False, "error": "Current password does not match records."}
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(payload.newPassword), row["id"]),
        )
        conn.commit()
        return {"success": True}
    finally:
        conn.close()

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

    width, height = image.size
    samples = 5 # CMYK + W1
    pixel_buf = bytearray(width * height * samples)

    # Convert RGBA to CMYK + W1
    p_idx = 0
    for y in range(height):
        for x in range(width):
            r, g, b, a = int(np_arr[y, x, 0]), int(np_arr[y, x, 1]), int(np_arr[y, x, 2]), int(np_arr[y, x, 3])
            if a < min_opacity_threshold:
                pixel_buf[p_idx:p_idx+5] = b'\x00\x00\x00\x00\x00'
            else:
                norm_r, norm_g, norm_b = r / 255.0, g / 255.0, b / 255.0
                k = 1.0 - max(norm_r, norm_g, norm_b)
                if k >= 0.999:
                    c, m, y_val, k_val = 0, 0, 0, 255
                else:
                    c = int(round(((1.0 - norm_r - k) / (1.0 - k)) * 255))
                    m = int(round(((1.0 - norm_g - k) / (1.0 - k)) * 255))
                    y_val = int(round(((1.0 - norm_b - k) / (1.0 - k)) * 255))
                    k_val = int(round(k * 255))
                w_val = int(choked_alpha[y, x])
                if w_val == 0 and a >= min_opacity_threshold:
                    w_val = 1
                pixel_buf[p_idx] = c
                pixel_buf[p_idx+1] = m
                pixel_buf[p_idx+2] = y_val
                pixel_buf[p_idx+3] = k_val
                pixel_buf[p_idx+4] = w_val
            p_idx += 5

    # Build 8BIM Photoshop Resource Block for "W1" Spot Channel (Resource 0x03EE: Alpha Channel Names)
    white_name = "W1"
    p_names = bytes([len(white_name)]) + white_name.encode('ascii')
    if len(p_names) % 2 != 0:
        p_names += b'\x00'
    ps_block = b'8BIM' + struct.pack('>H', 0x03EE) + b'\x00\x00' + struct.pack('>I', len(p_names)) + p_names

    # Build Little-Endian TIFF
    ifd_offset = 8
    num_entries = 16
    ifd_byte_length = 2 + num_entries * 12 + 4
    bits_offset = ifd_offset + ifd_byte_length
    xres_offset = bits_offset + samples * 2
    yres_offset = xres_offset + 8
    software = b"DTF Layout Pro - Precision RIP Multi-Channel TIFF Encoder\x00"
    software_offset = yres_offset + 8
    ps_offset = software_offset + len(software)
    data_offset = ps_offset + len(ps_block)
    if data_offset % 2 != 0:
        data_offset += 1
    total_file_size = data_offset + len(pixel_buf)

    buf = bytearray(total_file_size)
    struct.pack_into('<HHI', buf, 0, 0x4949, 42, ifd_offset)
    struct.pack_into('<H', buf, ifd_offset, num_entries)
    curr = ifd_offset + 2

    entries = [
        (256, 4, 1, width),
        (257, 4, 1, height),
        (258, 3, samples, bits_offset),
        (259, 3, 1, 1),
        (262, 3, 1, 5), # CMYK
        (273, 4, 1, data_offset),
        (277, 3, 1, samples),
        (278, 4, 1, height),
        (279, 4, 1, len(pixel_buf)),
        (282, 5, 1, xres_offset),
        (283, 5, 1, yres_offset),
        (284, 3, 1, 1),
        (296, 3, 1, 2),
        (305, 2, len(software), software_offset),
        (338, 3, 1, 2), # Inlined ExtraSamples = 2 (Unassociated Alpha / True Transparent Background)
        (34377, 1, len(ps_block), ps_offset)
    ]
    entries.sort(key=lambda e: e[0])
    for tag, t, count, val in entries:
        struct.pack_into('<HHII', buf, curr, tag, t, count, val)
        curr += 12
    struct.pack_into('<I', buf, curr, 0)

    for s in range(samples):
        struct.pack_into('<H', buf, bits_offset + s * 2, 8)
    struct.pack_into('<II', buf, xres_offset, dpi, 1)
    struct.pack_into('<II', buf, yres_offset, dpi, 1)
    buf[software_offset:software_offset+len(software)] = software
    buf[ps_offset:ps_offset+len(ps_block)] = ps_block
    buf[data_offset:data_offset+len(pixel_buf)] = pixel_buf

    filename = os.path.splitext(file.filename or "artwork")[0] + "_RIP_W1.tif"
    return Response(
        content=bytes(buf),
        media_type="image/tiff",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

