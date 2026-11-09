"""Generate icons/icon{16,48,128}.png using only the Python standard library."""

import struct
import zlib
from pathlib import Path

BACKGROUND = (0xFB, 0x54, 0x2B)
GLYPH = (0xFF, 0xFF, 0xFF)
SUPERSAMPLE = 4
CORNER_RADIUS = 0.22

# Transparent padding per icon size. The Web Store wants 96px artwork inside the 128px icon.
SIZES = {16: 0, 48: 2, 128: 16}

# Fast-forward glyph, in artwork units (0..1).
TRIANGLES = [
    ((0.21, 0.25), (0.21, 0.75), (0.51, 0.50)),
    ((0.49, 0.25), (0.49, 0.75), (0.79, 0.50)),
]


def in_triangle(x, y, tri):
    (x1, y1), (x2, y2), (x3, y3) = tri
    d1 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2)
    d2 = (x - x3) * (y2 - y3) - (x2 - x3) * (y - y3)
    d3 = (x - x1) * (y3 - y1) - (x3 - x1) * (y - y1)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def in_rounded_square(x, y):
    r = CORNER_RADIUS
    dx = max(r - x, 0, x - (1 - r))
    dy = max(r - y, 0, y - (1 - r))
    return dx * dx + dy * dy <= r * r


def render(size, padding):
    art = size - 2 * padding
    total = SUPERSAMPLE * SUPERSAMPLE
    rows = []
    for py in range(size):
        row = bytearray([0])  # PNG filter type: none
        for px in range(size):
            shape = glyph = 0
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    x = (px + (sx + 0.5) / SUPERSAMPLE - padding) / art
                    y = (py + (sy + 0.5) / SUPERSAMPLE - padding) / art
                    if not (0 <= x <= 1 and 0 <= y <= 1 and in_rounded_square(x, y)):
                        continue
                    shape += 1
                    if any(in_triangle(x, y, t) for t in TRIANGLES):
                        glyph += 1
            if shape:
                mix = glyph / shape
                color = [round(b + (g - b) * mix) for b, g in zip(BACKGROUND, GLYPH)]
            else:
                color = [0, 0, 0]
            row.extend(color + [round(255 * shape / total)])
        rows.append(bytes(row))
    return b"".join(rows)


def png(size, pixels):
    def chunk(kind, data):
        crc = struct.pack(">I", zlib.crc32(kind + data))
        return struct.pack(">I", len(data)) + kind + data + crc

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(pixels, 9))
        + chunk(b"IEND", b"")
    )


def main():
    out_dir = Path(__file__).resolve().parent.parent / "icons"
    out_dir.mkdir(exist_ok=True)
    for size, padding in SIZES.items():
        path = out_dir / f"icon{size}.png"
        path.write_bytes(png(size, render(size, padding)))
        print(path)


if __name__ == "__main__":
    main()
