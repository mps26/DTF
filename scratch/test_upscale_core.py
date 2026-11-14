import os
import cv2
import numpy as np
from PIL import Image
import base64
import io

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "server", "models")

# Cache models in memory
_models_cache = {}

def get_super_res_model(model_name: str, scale: int):
    key = (model_name.lower(), scale)
    if key in _models_cache:
        return _models_cache[key]
    
    # Try exact path
    path = os.path.join(MODELS_DIR, f"{model_name.upper()}_x{scale}.pb")
    if not os.path.exists(path):
        path = os.path.join(MODELS_DIR, f"{model_name.lower()}_x{scale}.pb")
    if not os.path.exists(path):
        # Fallback to FSRCNN if EDSR not found or vice versa
        path = os.path.join(MODELS_DIR, f"FSRCNN_x{scale}.pb")
        model_name = "fsrcnn"

    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(path)
    sr.setModel(model_name.lower(), scale)
    _models_cache[key] = sr
    return sr

def upscale_image_core(img_np: np.ndarray, factor: int = 2, sharpness: int = 50, model_name: str = "fsrcnn"):
    h, w = img_np.shape[:2]
    target_w = w * factor
    target_h = h * factor

    has_alpha = (img_np.shape[2] == 4) if len(img_np.shape) > 2 else False
    if has_alpha:
        bgr = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
        alpha = img_np[:, :, 3]
        # Inpaint background to prevent edge fringing
        mask = (alpha == 0).astype(np.uint8) * 255
        if np.any(mask) and not np.all(mask):
            bgr_clean = cv2.inpaint(bgr, mask, 3, cv2.INPAINT_TELEA)
        else:
            bgr_clean = bgr
    else:
        bgr_clean = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR) if len(img_np.shape) > 2 else cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
        alpha = None

    sr = get_super_res_model(model_name, factor)

    # Super-resolve BGR
    # If image is very large, tile it
    if h > 500 or w > 500:
        # Tiled inference
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

    # Apply controlled unsharp masking in LAB Luminance channel
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

    assert out_img.width == target_w
    assert out_img.height == target_h
    return out_img

# Test 1296x1214 with factor 2 and 4
test_img = np.zeros((1214, 1296, 4), dtype=np.uint8)
cv2.circle(test_img, (600, 600), 400, (255, 100, 50, 255), -1)

res2 = upscale_image_core(test_img, factor=2, sharpness=50)
print(f"2x: {res2.width}x{res2.height}")
assert res2.width == 2592 and res2.height == 2428

res4 = upscale_image_core(test_img, factor=4, sharpness=75)
print(f"4x: {res4.width}x{res4.height}")
assert res4.width == 5184 and res4.height == 4856

print("ALL TEST SCENARIOS PASSED!")

