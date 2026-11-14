import os
import io
import math
import time
import struct
import sqlite3
import hashlib
import secrets
import base64
import json
import urllib.request
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from PIL import Image, ImageOps
import numpy as np
import cv2

try:
    import vtracer
    VTRACER_AVAILABLE = True
except ImportError:
    VTRACER_AVAILABLE = False

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


def load_env_file():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for fname in [".env", ".env.local"]:
        fpath = os.path.join(root_dir, fname)
        if os.path.exists(fpath):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            except Exception:
                pass


load_env_file()

TURSO_URL = os.environ.get("TURSO_DATABASE_URL") or os.environ.get("SQLITE_URL") or ""
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN") or os.environ.get("SQLITE_AUTH_TOKEN") or ""


def get_turso_endpoint() -> Optional[str]:
    url = (os.environ.get("TURSO_DATABASE_URL") or os.environ.get("SQLITE_URL") or TURSO_URL).strip()
    if not url:
        return None
    if url.startswith("libsql://"):
        url = "https://" + url[9:]
    if not url.endswith("/v2/pipeline"):
        url = url.rstrip("/") + "/v2/pipeline"
    return url


def execute_turso_sql(sql: str, args: list = []) -> Optional[list]:
    endpoint = get_turso_endpoint()
    if not endpoint:
        return None
    try:
        formatted_args = []
        for a in args:
            if a is None:
                formatted_args.append({"type": "null"})
            elif isinstance(a, int):
                formatted_args.append({"type": "integer", "value": str(a)})
            elif isinstance(a, float):
                formatted_args.append({"type": "float", "value": a})
            else:
                formatted_args.append({"type": "text", "value": str(a)})

        token = os.environ.get("TURSO_AUTH_TOKEN") or os.environ.get("SQLITE_AUTH_TOKEN") or TURSO_TOKEN
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        payload = {
            "requests": [
                {
                    "type": "execute",
                    "stmt": {
                        "sql": sql,
                        "args": formatted_args
                    }
                },
                {"type": "close"}
            ]
        }
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            result = data.get("results", [{}])[0].get("response", {}).get("result", {})
            cols = [c["name"] for c in result.get("cols", [])]
            rows = result.get("rows", [])
            output = []
            for r in rows:
                row_dict = {}
                for idx, cell in enumerate(r):
                    row_dict[cols[idx]] = cell.get("value")
                output.append(row_dict)
            return output
    except Exception as e:
        print("Turso sync notice:", e)
        return None


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

        # Seed Turso Cloud SQLite if endpoint is present
        if get_turso_endpoint():
            execute_turso_sql(
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
            for du in default_users:
                execute_turso_sql(
                    """
                    INSERT OR IGNORE INTO users (
                        id, name, email, company_name, printer_model,
                        role, plan, initials, avatar_color, created_at, password_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    list(du)
                )
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

        # Check Turso Cloud SQLite if configured
        if get_turso_endpoint():
            turso_existing = execute_turso_sql("SELECT id FROM users WHERE LOWER(email) = ?", [email_norm])
            if turso_existing and len(turso_existing) > 0:
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

        # Replicate to Turso Cloud SQLite
        if get_turso_endpoint():
            execute_turso_sql(
                """
                INSERT OR IGNORE INTO users (
                    id, name, email, company_name, printer_model,
                    role, plan, initials, avatar_color, created_at, password_hash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
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
                ]
            )

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

        # If not in local SQLite, query Turso Cloud SQLite if connected
        if not row and get_turso_endpoint():
            turso_rows = execute_turso_sql(
                "SELECT * FROM users WHERE LOWER(email) = ?", [email_norm]
            )
            if turso_rows and len(turso_rows) > 0:
                tu = turso_rows[0]
                conn.execute(
                    """
                    INSERT OR IGNORE INTO users (
                        id, name, email, company_name, printer_model,
                        role, plan, initials, avatar_color, created_at, password_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        tu.get("id"),
                        tu.get("name"),
                        tu.get("email"),
                        tu.get("company_name", ""),
                        tu.get("printer_model", ""),
                        tu.get("role", "shop_owner"),
                        tu.get("plan", "Pro Print House"),
                        tu.get("initials", "US"),
                        tu.get("avatar_color", "from-indigo-600 to-purple-600"),
                        tu.get("created_at", datetime.now(timezone.utc).isoformat()),
                        tu.get("password_hash", ""),
                    ),
                )
                conn.commit()
                row = conn.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email_norm,)).fetchone()

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

        if get_turso_endpoint():
            execute_turso_sql(
                """
                UPDATE users
                SET name = ?, company_name = ?, printer_model = ?, initials = ?
                WHERE id = ?
                """,
                [new_name, new_company, new_printer, new_initials, row["id"]]
            )

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

        new_hash = hash_password(payload.newPassword)
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (new_hash, row["id"]),
        )
        conn.commit()

        if get_turso_endpoint():
            execute_turso_sql(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                [new_hash, row["id"]]
            )

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

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
_sr_models_cache = {}

def get_super_res_model(model_name: str, scale: int):
    key = (model_name.lower(), scale)
    if key in _sr_models_cache:
        return _sr_models_cache[key]
    
    path = os.path.join(MODELS_DIR, f"{model_name.upper()}_x{scale}.pb")
    if not os.path.exists(path):
        path = os.path.join(MODELS_DIR, f"{model_name.lower()}_x{scale}.pb")
    if not os.path.exists(path):
        path = os.path.join(MODELS_DIR, f"FSRCNN_x{scale}.pb")
        model_name = "fsrcnn"

    if not os.path.exists(path):
        raise FileNotFoundError(f"Super-resolution model file not found: {path}")

    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(path)
    sr.setModel(model_name.lower(), scale)
    _sr_models_cache[key] = sr
    return sr


def perform_ai_superres(img_np: np.ndarray, factor: int = 2, sharpness: int = 50, model_name: str = "fsrcnn") -> Image.Image:
    h, w = img_np.shape[:2]
    target_w = w * factor
    target_h = h * factor

    has_alpha = (img_np.shape[2] == 4) if len(img_np.shape) > 2 else False
    if has_alpha:
        bgr = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
        alpha = img_np[:, :, 3]
        # Inpaint background to prevent edge halos / color fringing on transparent PNGs
        mask = (alpha == 0).astype(np.uint8) * 255
        if np.any(mask) and not np.all(mask):
            bgr_clean = cv2.inpaint(bgr, mask, 3, cv2.INPAINT_TELEA)
        else:
            bgr_clean = bgr
    else:
        bgr_clean = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR) if len(img_np.shape) > 2 else cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
        alpha = None

    sr = get_super_res_model(model_name, factor)

    # Super-resolve BGR using tiled windowed inference for large dimensions
    if h > 500 or w > 500:
        tile_size = 400
        overlap = 32
        out_bgr = np.zeros((target_h, target_w, 3), dtype=np.float32)
        weight_map = np.zeros((target_h, target_w, 1), dtype=np.float32)

        for y in range(0, h, tile_size - overlap):
            y_end = min(y + tile_size, h)
            y_start = max(0, y_end - tile_size)
            for x in range(0, w, tile_size - overlap):
                x_end = min(x + tile_size, w)
                x_start = max(0, x_end - tile_size)

                tile = bgr_clean[y_start:y_end, x_start:x_end]
                tile_up = sr.upsample(tile).astype(np.float32)

                th, tw = tile_up.shape[:2]
                wy = np.sin(np.linspace(0, np.pi, th)) ** 2
                wx = np.sin(np.linspace(0, np.pi, tw)) ** 2
                w_tile = (wy[:, None] * wx[None, :])[:, :, None] + 1e-4

                out_y1 = y_start * factor
                out_y2 = out_y1 + th
                out_x1 = x_start * factor
                out_x2 = out_x1 + tw

                out_bgr[out_y1:out_y2, out_x1:out_x2] += tile_up * w_tile
                weight_map[out_y1:out_y2, out_x1:out_x2] += w_tile

        bgr_up = np.clip(out_bgr / weight_map, 0, 255).astype(np.uint8)
    else:
        bgr_up = sr.upsample(bgr_clean)

    # Apply controlled unsharp masking on Luminance channel (LAB color space)
    if sharpness > 0:
        lab = cv2.cvtColor(bgr_up, cv2.COLOR_BGR2LAB)
        l, a_ch, b_ch = cv2.split(lab)
        amount = (sharpness / 100.0) * 1.5
        blurred = cv2.GaussianBlur(l, (0, 0), sigmaX=1.5)
        l_sharp = cv2.addWeighted(l, 1.0 + amount, blurred, -amount, 0)
        lab_sharp = cv2.merge([l_sharp, a_ch, b_ch])
        bgr_up = cv2.cvtColor(lab_sharp, cv2.COLOR_LAB2BGR)

    if has_alpha:
        alpha_up = cv2.resize(alpha, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
        final_rgba = cv2.merge([bgr_up[:, :, 0], bgr_up[:, :, 1], bgr_up[:, :, 2], alpha_up])
        out_img = Image.fromarray(cv2.cvtColor(final_rgba, cv2.COLOR_BGRA2RGBA))
    else:
        out_img = Image.fromarray(cv2.cvtColor(bgr_up, cv2.COLOR_BGR2RGB))

    return out_img


@app.post("/api/upscale")
async def upscale_image(
    file: UploadFile = File(...),
    factor: int = Form(2),
    sharpness: int = Form(50),
    model: str = Form("fsrcnn")
):
    """
    Genuine AI Super-Resolution (2x Super-Resolution & 4x Ultra-Resolution)
    using deep residual super-resolution models (FSRCNN / EDSR).
    Preserves transparent backgrounds, fine contours, and color balance.
    """
    if factor not in (2, 4):
        raise HTTPException(status_code=400, detail="Factor must be 2 or 4")

    sharpness = max(0, min(100, sharpness))
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")

    orig_w, orig_h = image.size
    rgba = image.convert('RGBA') if 'A' in image.getbands() or image.mode in ('RGBA', 'LA') else image.convert('RGB')
    img_np = np.array(rgba)

    try:
        upscaled_img = perform_ai_superres(img_np, factor=factor, sharpness=sharpness, model_name=model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI upscaling error: {str(e)}")

    buffer = io.BytesIO()
    upscaled_img.save(buffer, format="PNG")
    png_bytes = buffer.getvalue()
    b64_str = base64.b64encode(png_bytes).decode('ascii')

    return JSONResponse({
        "status": "success",
        "factor": factor,
        "sharpness": sharpness,
        "originalWidth": orig_w,
        "originalHeight": orig_h,
        "width": upscaled_img.width,
        "height": upscaled_img.height,
        "dataUrl": f"data:image/png;base64,{b64_str}"
    })


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

def generate_contour_svg(img_np: np.ndarray, colormode: str, smoothness: int, precision: int = 2) -> str:
    h, w = img_np.shape[:2]
    fmt = f"{{:.{precision}f}}"
    paths = []
    if colormode == "binary":
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGBA2GRAY) if img_np.shape[2] == 4 else img_np
        _, thresh = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY_INV)
        if img_np.shape[2] == 4:
            thresh[img_np[:, :, 3] < 128] = 0
        epsilon = max(0.5, (100 - smoothness) * 0.05 + 0.5)
        contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_TC89_KCOS)
        for cnt in contours:
            if cv2.contourArea(cnt) < 4:
                continue
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            if len(approx) < 3:
                continue
            d_parts = []
            for i, pt in enumerate(approx):
                px, py = pt[0][0], pt[0][1]
                cmd = "M" if i == 0 else "L"
                d_parts.append(f"{cmd} {fmt.format(px)} {fmt.format(py)}")
            d_parts.append("Z")
            paths.append(f'<path d="{" ".join(d_parts)}" fill="#000000"/>')
    else:
        rgb = cv2.cvtColor(img_np, cv2.COLOR_RGBA2RGB)
        pixels = rgb.reshape((-1, 3)).astype(np.float32)
        k = 16
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        _, labels, centers = cv2.kmeans(pixels, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
        centers = np.uint8(centers)
        segmented = centers[labels.flatten()].reshape(rgb.shape)
        alpha_mask = img_np[:, :, 3] > 64 if img_np.shape[2] == 4 else np.ones((h, w), dtype=bool)
        epsilon = max(0.8, (100 - smoothness) * 0.06 + 0.5)
        for color in centers:
            mask = np.all(segmented == color, axis=2) & alpha_mask
            mask_uint8 = (mask * 255).astype(np.uint8)
            contours, _ = cv2.findContours(mask_uint8, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            hex_color = f"#{color[0]:02x}{color[1]:02x}{color[2]:02x}"
            for cnt in contours:
                if cv2.contourArea(cnt) < 6:
                    continue
                approx = cv2.approxPolyDP(cnt, epsilon, True)
                if len(approx) < 3:
                    continue
                d_parts = []
                for i, pt in enumerate(approx):
                    px, py = pt[0][0], pt[0][1]
                    cmd = "M" if i == 0 else "L"
                    d_parts.append(f"{cmd} {fmt.format(px)} {fmt.format(py)}")
                d_parts.append("Z")
                paths.append(f'<path d="{" ".join(d_parts)}" fill="{hex_color}"/>')

    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
{''.join(paths)}
</svg>'''

@app.post("/api/vectorize")
async def vectorize_image(
    file: UploadFile = File(...),
    colormode: str = Form("color"),
    detail_level: str = Form("medium"),
    smoothness: int = Form(70),
    remove_background: bool = Form(True),
    optimize_paths: bool = Form(True)
):
    """
    Converts raster images (PNG, JPG, JPEG, WebP) into true SVG vector paths
    using VTracer (Rust-backed Bézier curve vectorization engine).
    Preserves fine colors, gradients, outlines, and details.
    """
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")

    rgba = image.convert('RGBA')
    img_np = np.array(rgba)
    h, w = img_np.shape[:2]

    # Handle Remove Background if requested and image is solid or non-alpha
    if remove_background:
        has_alpha = bool(np.any(img_np[:, :, 3] < 250))
        if not has_alpha and h > 2 and w > 2:
            corners = [img_np[0, 0, :3], img_np[0, w-1, :3], img_np[h-1, 0, :3], img_np[h-1, w-1, :3]]
            bg_color = np.mean(corners, axis=0).astype(int)
            rgb = img_np[:, :, :3].astype(float)
            dist = np.sqrt(np.sum((rgb - bg_color) ** 2, axis=2))
            tolerance = 28
            bg_candidate = (dist <= tolerance).astype(np.uint8)
            cv_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
            cv2.floodFill(bg_candidate, cv_mask, (0, 0), 2, tolerance, tolerance)
            cv2.floodFill(bg_candidate, cv_mask, (w - 1, 0), 2, tolerance, tolerance)
            cv2.floodFill(bg_candidate, cv_mask, (0, h - 1), 2, tolerance, tolerance)
            cv2.floodFill(bg_candidate, cv_mask, (w - 1, h - 1), 2, tolerance, tolerance)
            outer_bg = (bg_candidate == 2)
            img_np[outer_bg, 3] = 0
            rgba = Image.fromarray(img_np, 'RGBA')

    buf = io.BytesIO()
    rgba.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    detail_lower = detail_level.lower()
    if detail_lower == "high":
        filter_speckle = 1
        color_precision = 8
        layer_difference = 8
    elif detail_lower == "low":
        filter_speckle = 8
        color_precision = 6
        layer_difference = 28
    else:
        filter_speckle = 3
        color_precision = 7
        layer_difference = 16

    smoothness_clamped = max(0, min(100, smoothness))
    corner_th = int(30 + (smoothness_clamped / 100.0) * 60)
    length_th = float(2.0 + (smoothness_clamped / 100.0) * 5.0)
    splice_th = int(20 + (smoothness_clamped / 100.0) * 45)
    path_prec = 2 if optimize_paths else 4

    cm = "binary" if colormode.lower() in ("binary", "bw", "black-white", "monochrome") else "color"

    if VTRACER_AVAILABLE:
        try:
            svg_str = vtracer.convert_raw_image_to_svg(
                png_bytes,
                img_format="png",
                colormode=cm,
                filter_speckle=filter_speckle,
                color_precision=color_precision,
                layer_difference=layer_difference,
                mode="spline",
                corner_threshold=corner_th,
                length_threshold=length_th,
                splice_threshold=splice_th,
                path_precision=path_prec
            )
            if "<svg" in svg_str and "viewBox" not in svg_str:
                svg_str = re.sub(r'<svg([^>]*)width="([0-9.]+)"\s+height="([0-9.]+)"', rf'<svg\1width="\2" height="\3" viewBox="0 0 \2 \3"', svg_str)
            return Response(content=svg_str, media_type="image/svg+xml")
        except Exception as e:
            print(f"VTracer error: {e}")

    svg_str = generate_contour_svg(img_np, cm, smoothness_clamped, path_prec)
    if "<svg" in svg_str and "viewBox" not in svg_str:
        svg_str = re.sub(r'<svg([^>]*)width="([0-9.]+)"\s+height="([0-9.]+)"', rf'<svg\1width="\2" height="\3" viewBox="0 0 \2 \3"', svg_str)
    return Response(content=svg_str, media_type="image/svg+xml")

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

