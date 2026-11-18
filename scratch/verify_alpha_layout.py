"""
Pixel-level print-safety check for gang-sheet layouts produced by scratch/test_alpha_nesting.ts.

For every sheet it renders each placed design from the full-resolution trimmed PNG, stretched into
its box exactly as the exporter does (rotated 90 deg clockwise when `rotated`), then verifies:
  * every requested copy is placed exactly once,
  * every image box lies inside the sheet margins and no two image boxes overlap,
  * ink (ANY alpha > 0, max-pooled so faint pixels are never lost) never overlaps,
  * ink-to-ink clearance >= spacing (minus one verification pixel of tolerance).

usage: python verify_alpha_layout.py <designsDir> <layouts.json> [dpi]
"""
import json, sys
import numpy as np, cv2
from PIL import Image

designs_dir, layouts_path = sys.argv[1], sys.argv[2]
DPI = int(sys.argv[3]) if len(sys.argv) > 3 else 200
PX_MM = 25.4 / DPI
src = {}
fail = 0


def ink_mask(p):
    im = src.setdefault(p["assetId"], Image.open(f"{designs_dir}/{p['assetId']}.png").convert("RGBA"))
    bw, bh = (p["h"], p["w"]) if p["rotated"] else (p["w"], p["h"])
    ink = (np.array(im.getchannel("A")) > 0).astype(np.float32)
    # INTER_AREA of a 0/1 mask is > 0 wherever ANY source pixel is ink (max-pool semantics).
    a = cv2.resize(ink, (max(1, round(bw / PX_MM)), max(1, round(bh / PX_MM))), interpolation=cv2.INTER_AREA) > 0
    if p["rotated"]:
        a = np.rot90(a, -1)  # 90 deg clockwise, like translate(x+W,y); rotate(pi/2)
    return a


for L in json.load(open(layouts_path)):
    name = f'{L["scenario"]} [{L["engine"]}]'
    sp, m, W = L["spacingMm"], L["marginMm"], L["widthMm"]
    ids = [p["id"] for s in L["sheets"] for p in s["placements"]]
    errs = []
    if len(ids) != L["requested"] or len(set(ids)) != len(ids):
        errs.append(f"copies placed {len(ids)} unique {len(set(ids))} requested {L['requested']}")
    min_clear = 1e9
    for si, sh in enumerate(L["sheets"]):
        Lm = sh["lengthMm"]
        items = []
        for p in sh["placements"]:
            if p["x"] < m - 0.01 or p["y"] < m - 0.01 or p["x"] + p["w"] > W - m + 0.01 or p["y"] + p["h"] > Lm - m + 0.01:
                errs.append(f"sheet {si}: {p['id']} box outside margins")
            items.append((p, ink_mask(p), round(p["x"] / PX_MM), round(p["y"] / PX_MM)))
        # Box-level check: image boxes (incl. transparent padding) never overlap.
        P = sh["placements"]
        for i in range(len(P)):
            for j in range(i + 1, len(P)):
                a, b = P[i], P[j]
                g = max(b["x"] - (a["x"] + a["w"]), a["x"] - (b["x"] + b["w"]), b["y"] - (a["y"] + a["h"]), a["y"] - (b["y"] + b["h"]))
                if g < -0.01:
                    errs.append(f"sheet {si}: BOX OVERLAP {a['id']} / {b['id']} ({g:.2f} mm)")
        pad = int(np.ceil(sp / PX_MM)) + 2
        for i in range(len(items)):
            pi, mi, xi, yi = items[i]
            for j in range(i + 1, len(items)):
                pj, mj, xj, yj = items[j]
                # only pairs whose boxes come within the spacing of each other
                if xj > xi + mi.shape[1] + pad or xi > xj + mj.shape[1] + pad or yj > yi + mi.shape[0] + pad or yi > yj + mj.shape[0] + pad:
                    continue
                x0, y0 = min(xi, xj) - pad, min(yi, yj) - pad
                x1 = max(xi + mi.shape[1], xj + mj.shape[1]) + pad
                y1 = max(yi + mi.shape[0], yj + mj.shape[0]) + pad
                A = np.zeros((y1 - y0, x1 - x0), np.uint8)
                B = np.zeros_like(A)
                A[yi - y0:yi - y0 + mi.shape[0], xi - x0:xi - x0 + mi.shape[1]] = mi
                B[yj - y0:yj - y0 + mj.shape[0], xj - x0:xj - x0 + mj.shape[1]] = mj
                if (A & B).any():
                    errs.append(f"sheet {si}: INK OVERLAP {pi['id']} / {pj['id']}")
                    continue
                if not B.any() or not A.any():
                    continue
                dist = cv2.distanceTransform((1 - A).astype(np.uint8), cv2.DIST_L2, 5)
                d = float(dist[B > 0].min()) * PX_MM
                min_clear = min(min_clear, d)
                if d < sp - PX_MM * 1.5:
                    errs.append(f"sheet {si}: {pi['id']} / {pj['id']} clearance {d:.2f}mm < {sp}mm")
    status = "OK  " if not errs else "FAIL"
    fail += bool(errs)
    print(f"{status} {name}: {len(ids)} copies, {len(L['sheets'])} sheet(s), min ink clearance {min_clear:.2f} mm")
    for e in errs[:8]:
        print("      ", e)
print("ALL PASS" if not fail else f"{fail} layout(s) FAILED")
sys.exit(1 if fail else 0)
