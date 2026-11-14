import os
import cv2
import numpy as np

def upscale_image_tiled(bgr, sr, scale, tile_size=400, overlap=32):
    h, w = bgr.shape[:2]
    target_h, target_w = h * scale, w * scale

    # If small enough, run direct
    if h <= tile_size and w <= tile_size:
        return sr.upsample(bgr)

    output = np.zeros((target_h, target_w, 3), dtype=np.float32)
    weight_map = np.zeros((target_h, target_w, 1), dtype=np.float32)

    y_steps = list(range(0, h, tile_size - overlap))
    x_steps = list(range(0, w, tile_size - overlap))

    for y in y_steps:
        y_end = min(y + tile_size, h)
        y_start = max(0, y_end - tile_size)
        for x in x_steps:
            x_end = min(x + tile_size, w)
            x_start = max(0, x_end - tile_size)

            tile = bgr[y_start:y_end, x_start:x_end]
            tile_up = sr.upsample(tile).astype(np.float32)

            th, tw = tile_up.shape[:2]
            # Create a 2D cosine / linear window for seamless blending
            wy = np.sin(np.linspace(0, np.pi, th)) ** 2
            wx = np.sin(np.linspace(0, np.pi, tw)) ** 2
            w_tile = (wy[:, None] * wx[None, :])[:, :, None] + 1e-4

            out_y1 = y_start * scale
            out_y2 = out_y1 + th
            out_x1 = x_start * scale
            out_x2 = out_x1 + tw

            output[out_y1:out_y2, out_x1:out_x2] += tile_up * w_tile
            weight_map[out_y1:out_y2, out_x1:out_x2] += w_tile

    output = np.clip(output / weight_map, 0, 255).astype(np.uint8)
    return output

sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel('server/models/FSRCNN_x2.pb')
sr.setModel('fsrcnn', 2)

img = np.random.randint(0, 255, (600, 600, 3), dtype=np.uint8)
res = upscale_image_tiled(img, sr, 2, tile_size=300, overlap=32)
print('Tiled upscale shape:', res.shape)
assert res.shape == (1200, 1200, 3)
print('TILED TEST PASSED!')

