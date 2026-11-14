import math

def pack_gang_sheet(assets, film_width_in=22, margin_mm=5, spacing_mm=5, fixed_length_in=39, length_mode='fixed'):
    film_width_mm = film_width_in * 25.4
    usable_width_mm = max(1.0, film_width_mm - margin_mm * 2)
    max_height_mm = fixed_length_in * 25.4

    items = []
    for a in assets:
        copies = max(1, a.get('copies', 1))
        for i in range(copies):
            items.append({
                'id': f"{a['id']}_copy_{i}",
                'assetId': a['id'],
                'copyIndex': i,
                'widthMm': a['targetWidthMm'],
                'heightMm': a['targetHeightMm'],
                'filename': a['filename'],
                'asset': a
            })

    internal_sheets = [{'sheetIndex': 0, 'placements': []}]
    current_sheet = 0
    cur_x = margin_mm
    cur_y = margin_mm
    cur_row_height = 0
    total_artwork_area = 0

    for item in items:
        item_w = item['widthMm']
        item_h = item['heightMm']
        if item_w > usable_width_mm:
            scale = usable_width_mm / item_w
            item_w = usable_width_mm
            item_h = item_h * scale

        total_artwork_area += item_w * item_h

        fits_in_current_row = (cur_x + item_w <= film_width_mm - margin_mm + 0.001)

        if fits_in_current_row:
            if cur_y + item_h > max_height_mm - margin_mm + 0.001 and cur_y > margin_mm:
                current_sheet += 1
                internal_sheets.append({'sheetIndex': current_sheet, 'placements': []})
                cur_x = margin_mm
                cur_y = margin_mm
                cur_row_height = item_h
            else:
                cur_row_height = max(cur_row_height, item_h)
        else:
            next_y = cur_y + cur_row_height + spacing_mm
            if next_y + item_h <= max_height_mm - margin_mm + 0.001:
                cur_y = next_y
                cur_x = margin_mm
                cur_row_height = item_h
            else:
                current_sheet += 1
                internal_sheets.append({'sheetIndex': current_sheet, 'placements': []})
                cur_x = margin_mm
                cur_y = margin_mm
                cur_row_height = item_h

        internal_sheets[current_sheet]['placements'].append({
            'id': item['id'],
            'copy': item['copyIndex'],
            'x': round(cur_x, 2),
            'y': round(cur_y, 2),
            'w': round(item_w, 2),
            'h': round(item_h, 2)
        })

        cur_x += item_w + spacing_mm

    return internal_sheets

# Test 1: User scenario - 24 copies then 25 copies
assets_24 = [
    {'id': 'labh', 'filename': 'LABH.png', 'targetWidthMm': 55.37, 'targetHeightMm': 36.83, 'copies': 24},
    {'id': 'kalash', 'filename': 'kalash 2.png', 'targetWidthMm': 55.37, 'targetHeightMm': 55.37, 'copies': 3}
]
res_24 = pack_gang_sheet(assets_24)
p_24 = res_24[0]['placements']
print(f"24 copies + 3 Kalash -> Total placements: {len(p_24)}")
print(f"Last item: {p_24[-1]}")

assets_25 = [
    {'id': 'labh', 'filename': 'LABH.png', 'targetWidthMm': 55.37, 'targetHeightMm': 36.83, 'copies': 25},
    {'id': 'kalash', 'filename': 'kalash 2.png', 'targetWidthMm': 55.37, 'targetHeightMm': 55.37, 'copies': 3}
]
res_25 = pack_gang_sheet(assets_25)
p_25 = res_25[0]['placements']
print(f"25 copies + 3 Kalash -> Total placements: {len(p_25)}")
# Item 28: Row 1 has 9 (items 0..8), Row 2 has 9 (items 9..17), Row 3 has 9 (items 18..26), Row 4 has item 27!
item_27 = p_25[27] # 28th item
print(f"Item 28 (first item of Row 4): x={item_27['x']}, y={item_27['y']}")
assert item_27['x'] == 5.0, f"Expected x=5.0, got {item_27['x']}"

print("All tests passed!")

