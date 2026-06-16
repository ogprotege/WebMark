#!/usr/bin/env python3
"""Generate WebMark PNG icons without any third-party imaging libraries.

Draws a simple, recognizable mark: a rounded "page" with a highlighter
stripe across it and a few text lines, on a brand-blue background.
Run from the repo root:  python3 tools/make_icons.py
"""
import os
import struct
import zlib

# Brand palette (R, G, B, A)
BLUE = (37, 99, 235, 255)      # background
PAGE = (255, 255, 255, 255)    # the note page
HILITE = (250, 204, 21, 255)   # highlighter yellow stripe
TEXT = (148, 163, 184, 255)    # faux text lines
CLEAR = (0, 0, 0, 0)


def blend(dst, src):
    """Alpha-composite src over dst."""
    sa = src[3] / 255.0
    da = dst[3] / 255.0
    out_a = sa + da * (1 - sa)
    if out_a == 0:
        return (0, 0, 0, 0)
    out = []
    for i in range(3):
        out.append(int((src[i] * sa + dst[i] * da * (1 - sa)) / out_a))
    out.append(int(out_a * 255))
    return tuple(out)


class Canvas:
    def __init__(self, size):
        self.size = size
        self.px = [[CLEAR for _ in range(size)] for _ in range(size)]

    def set(self, x, y, color):
        if 0 <= x < self.size and 0 <= y < self.size:
            self.px[y][x] = blend(self.px[y][x], color)

    def rrect(self, x0, y0, x1, y1, radius, color):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                # rounded corner test
                cx = cy = None
                if x < x0 + radius and y < y0 + radius:
                    cx, cy = x0 + radius, y0 + radius
                elif x > x1 - radius - 1 and y < y0 + radius:
                    cx, cy = x1 - radius - 1, y0 + radius
                elif x < x0 + radius and y > y1 - radius - 1:
                    cx, cy = x0 + radius, y1 - radius - 1
                elif x > x1 - radius - 1 and y > y1 - radius - 1:
                    cx, cy = x1 - radius - 1, y1 - radius - 1
                if cx is not None:
                    if (x - cx) ** 2 + (y - cy) ** 2 > radius ** 2:
                        continue
                self.set(x, y, color)

    def to_png(self):
        raw = bytearray()
        for row in self.px:
            raw.append(0)  # filter type 0
            for (r, g, b, a) in row:
                raw += bytes((r, g, b, a))
        comp = zlib.compress(bytes(raw), 9)

        def chunk(tag, data):
            c = struct.pack(">I", len(data)) + tag + data
            crc = zlib.crc32(tag + data) & 0xFFFFFFFF
            return c + struct.pack(">I", crc)

        sig = b"\x89PNG\r\n\x1a\n"
        ihdr = struct.pack(">IIBBBBB", self.size, self.size, 8, 6, 0, 0, 0)
        return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b"")


def draw(size):
    c = Canvas(size)
    s = size / 16.0  # scale factor relative to 16px design grid
    # background rounded square
    c.rrect(0, 0, size, size, max(2, int(3 * s)), BLUE)
    # the page
    px0, py0, px1, py1 = 3.5 * s, 2.5 * s, 12.5 * s, 13.5 * s
    c.rrect(px0, py0, px1, py1, max(1, int(1.5 * s)), PAGE)
    # text lines
    line_h = max(1, int(1 * s))
    gap = 2 * s
    tx0 = px0 + 1.4 * s
    tx1 = px1 - 1.4 * s
    y = py0 + 2 * s
    rows = 4
    for i in range(rows):
        end = tx1 if i % 2 == 0 else tx1 - 2.2 * s
        c.rrect(tx0, y, end, y + line_h, 0, TEXT)
        y += gap
    # highlighter stripe across one line
    hy = py0 + 2 * s + gap  # second line
    c.rrect(tx0 - 0.6 * s, hy - 0.6 * s, tx1 + 0.2 * s,
            hy + line_h + 0.6 * s, max(1, int(0.8 * s)),
            (HILITE[0], HILITE[1], HILITE[2], 200))
    return c.to_png()


def main():
    out = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(out, exist_ok=True)
    for size in (16, 32, 48, 128):
        data = draw(size)
        path = os.path.join(out, f"icon{size}.png")
        with open(path, "wb") as f:
            f.write(data)
        print(f"wrote {path} ({len(data)} bytes)")


if __name__ == "__main__":
    main()
