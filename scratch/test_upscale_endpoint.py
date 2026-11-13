import sys, os
sys.path.insert(0, os.path.abspath("."))
from fastapi.testclient import TestClient
from server.main import app
import numpy as np
import cv2
import io

client = TestClient(app)

# 1. Test 1296x1214 with transparency
test_w, test_h = 1296, 1214
rgba = np.zeros((test_h, test_w, 4), dtype=np.uint8)
# Elephant / circle artwork
cv2.circle(rgba, (648, 607), 400, (255, 180, 50, 255), -1)
# Transparent hole
cv2.circle(rgba, (648, 607), 100, (0, 0, 0, 0), -1)

# Encode to PNG in memory
is_success, buffer = cv2.imencode(".png", rgba)
assert is_success

print(f"Original test image size: {test_w}x{test_h}")

# Test 2x Super-Resolution
res2 = client.post(
    "/api/upscale",
    files={"file": ("test.png", io.BytesIO(buffer), "image/png")},
    data={"factor": "2", "sharpness": "50", "model": "fsrcnn"}
)
assert res2.status_code == 200, f"Error: {res2.text}"
data2 = res2.json()
print("2x Super-Resolution Response:")
print(f"  Status: {data2['status']}")
print(f"  Width: {data2['width']} (Expected: 2592)")
print(f"  Height: {data2['height']} (Expected: 2428)")
assert data2['width'] == 2592
assert data2['height'] == 2428

# Test 4x Ultra-Resolution with 75% sharpness
res4 = client.post(
    "/api/upscale",
    files={"file": ("test.png", io.BytesIO(buffer), "image/png")},
    data={"factor": "4", "sharpness": "75", "model": "fsrcnn"}
)
assert res4.status_code == 200, f"Error: {res4.text}"
data4 = res4.json()
print("4x Ultra-Resolution Response:")
print(f"  Status: {data4['status']}")
print(f"  Width: {data4['width']} (Expected: 5184)")
print(f"  Height: {data4['height']} (Expected: 4856)")
assert data4['width'] == 5184
assert data4['height'] == 4856

print("ALL MANDATORY ENDPOINT BENCHMARKS PASSED PERFECTLY!")
