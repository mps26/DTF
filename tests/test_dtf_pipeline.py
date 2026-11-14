import math
import unittest
import numpy as np
from PIL import Image

MM_PER_INCH = 25.4

def calculate_effective_dpi(pixels: int, target_inches: float) -> int:
    return int(round(pixels / target_inches))

def unit_to_mm(value: float, unit: str) -> float:
    if unit == 'inch':
        return value * MM_PER_INCH
    elif unit == 'cm':
        return value * 10.0
    elif unit == 'meter':
        return value * 1000.0
    return value

def pack_maxrects_mock(items, film_width_mm, spacing_mm=7.62, margin_mm=5.08):
    usable_width = film_width_mm - margin_mm * 2
    free_rects = [{"x": 0.0, "y": 0.0, "w": usable_width, "h": 50000.0}]
    placements = []
    max_bottom = 0.0

    for item in items:
        iw, ih = item["w"], item["h"]
        best_score = float('inf')
        bx, by = 0.0, 0.0
        placed_w, placed_h = iw, ih

        for fr in free_rects:
            if fr["w"] >= iw and fr["h"] >= ih:
                score = fr["y"] * 1000.0 + min(fr["w"] - iw, fr["h"] - ih)
                if score < best_score:
                    best_score = score
                    bx, by = fr["x"], fr["y"]
                    placed_w, placed_h = iw, ih

        placements.append({
            "id": item["id"],
            "x": bx + margin_mm,
            "y": by + margin_mm,
            "w": placed_w,
            "h": placed_h
        })

        if by + placed_h > max_bottom:
            max_bottom = by + placed_h

        occ = {"x": bx, "y": by, "w": placed_w + spacing_mm, "h": placed_h + spacing_mm}
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

    used_length_mm = max_bottom + margin_mm
    return placements, used_length_mm

class TestDTFPipeline(unittest.TestCase):
    def test_dpi_calculation(self):
        # Section 16 Blueprint Worked Example:
        # Source 1254 x 1254 px, Target 2.18 inches -> 575 DPI
        dpi = calculate_effective_dpi(1254, 2.18)
        self.assertEqual(dpi, 575)

    def test_unit_conversion(self):
        # 11.5 inches to mm
        mm = unit_to_mm(11.5, 'inch')
        self.assertAlmostEqual(mm, 292.1, places=1)

    def test_om_ten_copies_packing(self):
        # 10 copies of 2.18 x 2.18 inches (55.37 mm)
        w_mm = unit_to_mm(2.18, 'inch')
        h_mm = unit_to_mm(2.18, 'inch')
        items = [{"id": f"om_copy_{i}", "w": w_mm, "h": h_mm} for i in range(10)]
        film_w = unit_to_mm(11.5, 'inch')
        spacing = unit_to_mm(0.3, 'inch')

        placements, used_length_mm = pack_maxrects_mock(items, film_w, spacing)
        self.assertEqual(len(placements), 10)
        self.assertTrue(used_length_mm > 0)
        # Verify no items overlap
        for i in range(len(placements)):
            for j in range(i + 1, len(placements)):
                p1, p2 = placements[i], placements[j]
                overlap = not (
                    p1["x"] + p1["w"] <= p2["x"] or
                    p2["x"] + p2["w"] <= p1["x"] or
                    p1["y"] + p1["h"] <= p2["y"] or
                    p2["y"] + p2["h"] <= p1["y"]
                )
                self.assertFalse(overlap, f"Overlap between {p1['id']} and {p2['id']}")

    def test_alpha_bounding_box_and_trim(self):
        # Create a 200x200 transparent image with a 100x100 white square in center
        arr = np.zeros((200, 200, 4), dtype=np.uint8)
        arr[50:150, 50:150, :3] = 255
        arr[50:150, 50:150, 3] = 255

        visible = np.where(arr[:, :, 3] > 8)
        min_y, max_y = int(np.min(visible[0])), int(np.max(visible[0]))
        min_x, max_x = int(np.min(visible[1])), int(np.max(visible[1]))

        self.assertEqual(min_y, 50)
        self.assertEqual(max_y, 149)
        self.assertEqual(min_x, 50)
        self.assertEqual(max_x, 149)

        # Empty percentage should be (200*200 - 100*100) / (200*200) = 75%
        content_area = 100 * 100
        total_area = 200 * 200
        empty_percent = round((1 - content_area / total_area) * 100)
        self.assertEqual(empty_percent, 75)

if __name__ == '__main__':
    unittest.main()

