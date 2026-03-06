"""
Digital Detective -- Icon Generator
Generates PNG icons for the Chrome extension from icon.svg.

Run this script once before loading the extension:
    python create_icons.py

Requires: Pillow   (pip install pillow)
          cairosvg (pip install cairosvg)   <- preferred, preserves SVG quality
 - OR -  Pillow only (renders a flat red square as placeholder)
"""
import os
import struct
import zlib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ICONS_DIR  = os.path.join(SCRIPT_DIR, 'icons')
SVG_PATH   = os.path.join(SCRIPT_DIR, 'icon.svg')
SIZES      = [16, 48, 128]

os.makedirs(ICONS_DIR, exist_ok=True)


def try_cairosvg():
    """Convert SVG -> PNG using cairosvg (best quality)."""
    try:
        import cairosvg
        for size in SIZES:
            out = os.path.join(ICONS_DIR, f'icon{size}.png')
            cairosvg.svg2png(url=SVG_PATH, write_to=out, output_width=size, output_height=size)
            print(f'  [cairosvg] icon{size}.png')
        return True
    except ImportError:
        return False


def try_pillow():
    """Convert SVG -> PNG using Pillow + svglib (second-best)."""
    try:
        from svglib.svglib import svg2rlg
        from reportlab.graphics import renderPM
        from PIL import Image
        import io
        drawing = svg2rlg(SVG_PATH)
        if not drawing:
            return False
        for size in SIZES:
            buf = io.BytesIO()
            drawing.width  = size
            drawing.height = size
            renderPM.drawToFile(drawing, buf, fmt='PNG')
            buf.seek(0)
            img = Image.open(buf).convert('RGBA').resize((size, size), Image.LANCZOS)
            img.save(os.path.join(ICONS_DIR, f'icon{size}.png'))
            print(f'  [svglib]   icon{size}.png')
        return True
    except ImportError:
        return False


def make_command_icon_png(size, bg=(0, 0, 0, 0), fg=(221, 18, 52, 255)):
    """
    Pure stdlib: generate a PNG icon (no external deps).
    Draws a simplified command key symbol in red on transparent background.
    """
    import math

    width = height = size
    pixels = [[list(bg) for _ in range(width)] for _ in range(height)]

    def set_px(x, y, color):
        if 0 <= x < width and 0 <= y < height:
            pixels[y][x] = list(color)

    def draw_circle(cx, cy, radius, color):
        r2 = radius * radius
        xmin = int(math.floor(cx - radius))
        xmax = int(math.ceil(cx + radius))
        ymin = int(math.floor(cy - radius))
        ymax = int(math.ceil(cy + radius))
        for y in range(ymin, ymax + 1):
            for x in range(xmin, xmax + 1):
                dx = (x + 0.5) - cx
                dy = (y + 0.5) - cy
                if dx * dx + dy * dy <= r2:
                    set_px(x, y, color)

    def draw_filled_circle(cx, cy, radius, color):
        draw_circle(cx, cy, radius, color)

    def draw_line(x0, y0, x1, y1, thickness, color):
        length = math.hypot(x1 - x0, y1 - y0)
        steps = max(1, int(length * 4))
        for i in range(steps + 1):
            t = i / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            draw_circle(x, y, thickness / 2.0, color)

    def draw_arc(cx, cy, radius, start_deg, end_deg, thickness, color):
        arc_len = math.radians(abs(end_deg - start_deg)) * radius
        steps = max(1, int(arc_len * 2))
        for i in range(steps + 1):
            t = i / steps
            deg = start_deg + (end_deg - start_deg) * t
            rad = math.radians(deg)
            x = cx + radius * math.cos(rad)
            y = cy + radius * math.sin(rad)
            draw_circle(x, y, thickness / 2.0, color)

    scale = size / 48.0
    stroke = max(1.0, 3.2 * scale)
    r = 4.0 * scale

    def S(v):
        return v * scale

    # Inner square outline
    x0, y0 = S(17), S(17)
    x1, y1 = S(31), S(31)
    draw_line(x0, y0, x1, y0, stroke, fg)
    draw_line(x1, y0, x1, y1, stroke, fg)
    draw_line(x1, y1, x0, y1, stroke, fg)
    draw_line(x0, y1, x0, y0, stroke, fg)

    # Top-left loop
    draw_line(S(17), S(17), S(13), S(17), stroke, fg)
    draw_line(S(17), S(17), S(17), S(13), stroke, fg)
    draw_arc(S(13), S(13), r, 90, 0, stroke, fg)

    # Top-right loop
    draw_line(S(31), S(17), S(35), S(17), stroke, fg)
    draw_line(S(31), S(17), S(31), S(13), stroke, fg)
    draw_arc(S(35), S(13), r, 90, 180, stroke, fg)

    # Bottom-left loop
    draw_line(S(17), S(31), S(13), S(31), stroke, fg)
    draw_line(S(17), S(31), S(17), S(35), stroke, fg)
    draw_arc(S(13), S(35), r, 270, 0, stroke, fg)

    # Bottom-right loop
    draw_line(S(31), S(31), S(35), S(31), stroke, fg)
    draw_line(S(31), S(31), S(31), S(35), stroke, fg)
    draw_arc(S(35), S(35), r, 270, 180, stroke, fg)

    # Version badge (v1.2 -> "12")
    badge_r = max(2, int(size * 0.16))
    badge_cx = size - badge_r - 1
    badge_cy = size - badge_r - 1
    draw_filled_circle(badge_cx, badge_cy, badge_r, fg)

    digit_map = {
        '1': [
            "010",
            "110",
            "010",
            "010",
            "111",
        ],
        '2': [
            "111",
            "001",
            "111",
            "100",
            "111",
        ],
    }
    cell = max(1, int(size / 24))
    text = "12"
    digit_w = 3 * cell
    digit_h = 5 * cell
    gap = cell
    total_w = digit_w * len(text) + gap * (len(text) - 1)
    total_h = digit_h
    start_x = int(round(badge_cx - total_w / 2))
    start_y = int(round(badge_cy - total_h / 2))
    for idx, ch in enumerate(text):
        pattern = digit_map.get(ch)
        if not pattern:
            continue
        base_x = start_x + idx * (digit_w + gap)
        base_y = start_y
        for ry, row in enumerate(pattern):
            for rx, col in enumerate(row):
                if col != '1':
                    continue
                px = base_x + rx * cell
                py = base_y + ry * cell
                for yy in range(cell):
                    for xx in range(cell):
                        set_px(px + xx, py + yy, (255, 255, 255, 255))

    def chunk(ctype, data):
        raw = ctype + data
        return struct.pack('>I', len(data)) + raw + struct.pack('>I', zlib.crc32(raw) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    raw = b''.join(
        b'\x00' + bytes([c for px in row for c in px])
        for row in pixels
    )
    idat = zlib.compress(raw)

    return (
        b'\x89PNG\r\n\x1a\n' +
        chunk(b'IHDR', ihdr) +
        chunk(b'IDAT', idat) +
        chunk(b'IEND', b'')
    )


def make_placeholder_icons():
    """Fallback: stdlib-rendered command-key icons."""
    for size in SIZES:
        path = os.path.join(ICONS_DIR, f'icon{size}.png')
        with open(path, 'wb') as f:
            f.write(make_command_icon_png(size))
        print(f'  [stdlib]   icon{size}.png  (command-key fallback)')


if __name__ == '__main__':
    print('Digital Detective -- generating icons...\n')

    if try_cairosvg():
        print('\nDone! Icons generated from SVG (cairosvg).')
    elif try_pillow():
        print('\nDone! Icons generated from SVG (svglib + Pillow).')
    else:
        print('cairosvg and svglib not found -- generating fallback icons.\n')
        print('To install cairosvg:  pip install cairosvg')
        print('To install svglib:    pip install svglib reportlab pillow\n')
        make_placeholder_icons()
        print('\nDone! Fallback icons created.')
        print('Replace them with proper PNGs converted from icon.svg for best results.')
