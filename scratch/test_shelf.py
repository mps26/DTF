# Test sequential shelf packing

def test_shelf_pack():
    film_width = 558.8  # 22 inches in mm
    margin = 5.0
    spacing = 5.0
    usable_width = film_width - margin * 2

    # Dimensions from screenshot
    # LABH is 2.18" wide (55.37mm), 1.45" high (36.83mm)
    # Kalash is 2.18" wide (55.37mm), 2.18" high (55.37mm)
    w_labh, h_labh = 55.37, 36.83
    w_kalash, h_kalash = 55.37, 55.37

    # Create items list in sequence:
    # 25 copies of LABH, 3 copies of Kalash
    items = []
    # In screenshot: 6 LABH, then 3 Kalash, then remaining LABH
    for i in range(6):
        items.append(('LABH', w_labh, h_labh, i))
    for i in range(3):
        items.append(('Kalash', w_kalash, h_kalash, i))
    for i in range(6, 25):
        items.append(('LABH', w_labh, h_labh, i))

    placements = []
    cur_x = margin
    cur_y = margin
    shelf_h = 0
    row = 1

    for name, w, h, idx in items:
        # Check if fits in current row
        if cur_x + w > margin + usable_width + 0.01:
            # Advance to next row
            cur_y += shelf_h + spacing
            cur_x = margin
            shelf_h = 0
            row += 1

        placements.append({
            'name': name,
            'idx': idx,
            'row': row,
            'x': round(cur_x, 2),
            'y': round(cur_y, 2),
            'w': w,
            'h': h
        })

        cur_x += w + spacing
        shelf_h = max(shelf_h, h)

    last = placements[-1]
    print(f"Total items placed: {len(placements)}")
    print(f"Last item: {last['name']} #{last['idx']} at row {last['row']}, x={last['x']}, y={last['y']}")
    assert last['row'] == 4
    assert abs(last['x'] - margin) < 0.1, f"Expected x to be at left margin {margin}, got {last['x']}"
    print("SUCCESS: Last item starts at the left margin of row 4!")

test_shelf_pack()

