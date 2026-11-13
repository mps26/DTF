# Simulate TypeScript packing algorithm in Python

def pack_gang_sheet(assets, film_width_in=22, margin_mm=5, spacing_mm=5, fixed_length_in=39):
    film_width_mm = film_width_in * 25.4
    usable_width_mm = film_width_mm - margin_mm * 2
    max_height_mm = fixed_length_in * 25.4

    items = []
    for a in assets:
        copies = a.get('copies', 1)
        for i in range(copies):
            items.append({
                'id': f"{a['id']}_copy_{i}",
                'assetId': a['id'],
                'copyIndex': i,
                'widthMm': a['targetWidthMm'],
                'heightMm': a['targetHeightMm'],
                'filename': a['filename']
            })

    sheets = [{'sheetIndex': 0, 'placements': []}]
    cur_sheet = 0
    cur_x = margin_mm
    cur_y = margin_mm
    cur_shelf_h = 0

    for item in items:
        w = min(usable_width_mm, item['widthMm'])
        h = item['heightMm']

        # Check if item exceeds current row
        if cur_x + w > margin_mm + usable_width_mm + 0.001 and cur_x > margin_mm:
            next_y = cur_y + cur_shelf_h + spacing_mm
            if next_y + h > max_height_mm - margin_mm + 0.001:
                cur_sheet += 1
                sheets.append({'sheetIndex': cur_sheet, 'placements': []})
                cur_y = margin_mm
                cur_x = margin_mm
                cur_shelf_h = h
            else:
                cur_y = next_y
                cur_x = margin_mm
                cur_shelf_h = h
        else:
            cur_shelf_h = max(cur_shelf_h, h)

        sheets[cur_sheet]['placements'].append({
            'item': item['filename'],
            'copy': item['copyIndex'],
            'x': round(cur_x, 2),
            'y': round(cur_y, 2),
            'w': w,
            'h': h
        })

        cur_x += w + spacing_mm

    return sheets

# Run test matching user's scenario
assets = [
    {'id': 'labh', 'filename': 'LABH.png', 'targetWidthMm': 55.37, 'targetHeightMm': 36.83, 'copies': 25},
    {'id': 'kalash', 'filename': 'kalash 2.png', 'targetWidthMm': 55.37, 'targetHeightMm': 55.37, 'copies': 3}
]

res = pack_gang_sheet(assets)
placements = res[0]['placements']
print(f"Total placed: {len(placements)}")
row1 = [p for p in placements if abs(p['y'] - 5.0) < 1]
row2 = [p for p in placements if abs(p['y'] - (5 + 36.83 + 5)) < 1]
print(f"Row 1 count: {len(row1)}, first item x={row1[0]['x']}")
last_item = placements[-1]
print(f"Last item: {last_item['item']} #{last_item['copy']}, x={last_item['x']}, y={last_item['y']}")
assert last_item['x'] == 5.0, f"Expected last item to be at left margin x=5.0, but got x={last_item['x']}"
print("TEST SUCCESSFUL: Last item is at the left of the new row!")

