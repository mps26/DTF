import os
import cv2
import numpy as np
from PIL import Image

def test_pipeline(scale=2, model_type="fsrcnn"):
    model_path = f"server/models/{model_type.upper()}_x{scale}.pb"
    if not os.path.exists(model_path):
        model_path = f"server/models/{model_type.lower()}_x{scale}.pb"
    
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(model_path)
    sr.setModel(model_type.lower(), scale)

    # Create synthetic transparent image
    w, h = 1296, 1214
    # For quick test, let's use a 300x280 test image and scale
    test_w, test_h = 300, 280
    img = np.zeros((test_h, test_w, 4), dtype=np.uint8)
    cv2.circle(img, (150, 140), 100, (255, 180, 50, 255), -1)
    cv2.putText(img, "DTF TEST", (80, 140), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255, 255), 2)
    # Some transparent areas
    cv2.circle(img, (150, 140), 30, (0, 0, 0, 0), -1)

    bgr = img[:, :, :3]
    alpha = img[:, :, 3]

    # Inpaint background to avoid edge fringing
    mask = (alpha == 0).astype(np.uint8) * 255
    if np.any(mask):
        bgr_clean = cv2.inpaint(bgr, mask, 3, cv2.INPAINT_TELEA)
    else:
        bgr_clean = bgr

    # AI Super Resolution
    bgr_up = sr.upsample(bgr_clean)

    # Alpha upsample
    target_w, target_h = test_w * scale, test_h * scale
    alpha_up = cv2.resize(alpha, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)

    # Sharpness (50%)
    lab = cv2.cvtColor(bgr_up, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    blurred = cv2.GaussianBlur(l, (0, 0), sigmaX=1.5)
    amount = 0.5 * 1.5
    l_sharp = cv2.addWeighted(l, 1.0 + amount, blurred, -amount, 0)
    lab_sharp = cv2.merge([l_sharp, a, b])
    bgr_sharp = cv2.cvtColor(lab_sharp, cv2.COLOR_LAB2BGR)

    final_rgba = cv2.merge([bgr_sharp[:, :, 0], bgr_sharp[:, :, 1], bgr_sharp[:, :, 2], alpha_up])
    print(f"Model: {model_type} x{scale} -> Output Shape: {final_rgba.shape}, Target: ({target_h}, {target_w}, 4)")
    assert final_rgba.shape == (target_h, target_w, 4)

test_pipeline(2, "fsrcnn")
test_pipeline(4, "fsrcnn")
test_pipeline(2, "edsr")
print("ALL TESTS PASSED!")

