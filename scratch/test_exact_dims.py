import time
import cv2
import numpy as np

sr2 = cv2.dnn_superres.DnnSuperResImpl_create()
sr2.readModel('server/models/FSRCNN_x2.pb')
sr2.setModel('fsrcnn', 2)

t0 = time.time()
img = np.zeros((1214, 1296, 3), dtype=np.uint8)
cv2.circle(img, (600, 600), 400, (200, 100, 50), -1)
res2 = sr2.upsample(img)
t1 = time.time()
print(f"2x upscale done in {t1-t0:.2f}s, shape: {res2.shape}")
assert res2.shape == (2428, 2592, 3)

sr4 = cv2.dnn_superres.DnnSuperResImpl_create()
sr4.readModel('server/models/FSRCNN_x4.pb')
sr4.setModel('fsrcnn', 4)

t0 = time.time()
res4 = sr4.upsample(img)
t1 = time.time()
print(f"4x upscale done in {t1-t0:.2f}s, shape: {res4.shape}")
assert res4.shape == (4856, 5184, 3)
print("1296x1214 exact dimension test PASSED!")

