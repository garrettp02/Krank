#!/usr/bin/env python3
"""Generate required PNG app icons from a source PNG without external deps.

Usage:
  python scripts/generate_icons.py "/path/to/source.png"
"""

from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path

TARGETS = (
    ("apple-touch-icon.png", 180),
    ("favicon-32.png", 32),
    ("icon-192.png", 192),
    ("icon-512.png", 512),
)


def read_png(path: Path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a PNG")

    i = 8
    chunks = []
    while i < len(data):
        ln = struct.unpack(">I", data[i : i + 4])[0]
        i += 4
        typ = data[i : i + 4]
        i += 4
        chunk = data[i : i + ln]
        i += ln
        i += 4  # crc
        chunks.append((typ, chunk))
        if typ == b"IEND":
            break

    ihdr = next(chunk for typ, chunk in chunks if typ == b"IHDR")
    w, h, bit_depth, color_type, comp, flt, interlace = struct.unpack(">IIBBBBB", ihdr)
    if bit_depth != 8 or interlace != 0 or comp != 0 or flt != 0 or color_type not in (2, 6):
        raise ValueError("Unsupported PNG format; expected non-interlaced 8-bit RGB/RGBA")

    raw = zlib.decompress(b"".join(chunk for typ, chunk in chunks if typ == b"IDAT"))
    channels = 4 if color_type == 6 else 3
    stride = w * channels
    bpp = channels

    rows = []
    prev = [0] * stride
    pos = 0

    for _ in range(h):
        filt = raw[pos]
        pos += 1
        scan = list(raw[pos : pos + stride])
        pos += stride

        recon = [0] * stride
        for x in range(stride):
            a = recon[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0

            if filt == 0:
                val = scan[x]
            elif filt == 1:
                val = (scan[x] + a) & 255
            elif filt == 2:
                val = (scan[x] + b) & 255
            elif filt == 3:
                val = (scan[x] + ((a + b) // 2)) & 255
            elif filt == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                val = (scan[x] + pr) & 255
            else:
                raise ValueError(f"Unsupported PNG filter: {filt}")

            recon[x] = val

        prev = recon

        if channels == 4:
            rows.append([tuple(recon[i : i + 4]) for i in range(0, stride, 4)])
        else:
            rows.append([tuple(recon[i : i + 3] + [255]) for i in range(0, stride, 3)])

    return rows


def resize_bilinear(pixels, tw: int, th: int):
    sh, sw = len(pixels), len(pixels[0])
    sx_ratio = (sw - 1) / (tw - 1) if tw > 1 else 0
    sy_ratio = (sh - 1) / (th - 1) if th > 1 else 0

    out = []
    for y in range(th):
        sy = y * sy_ratio
        y0 = int(sy)
        y1 = min(y0 + 1, sh - 1)
        wy = sy - y0

        row = []
        for x in range(tw):
            sx = x * sx_ratio
            x0 = int(sx)
            x1 = min(x0 + 1, sw - 1)
            wx = sx - x0

            p00 = pixels[y0][x0]
            p10 = pixels[y0][x1]
            p01 = pixels[y1][x0]
            p11 = pixels[y1][x1]

            row.append(
                tuple(
                    int(
                        round(
                            p00[c] * (1 - wx) * (1 - wy)
                            + p10[c] * wx * (1 - wy)
                            + p01[c] * (1 - wx) * wy
                            + p11[c] * wx * wy
                        )
                    )
                    for c in range(4)
                )
            )
        out.append(row)

    return out


def write_png(path: Path, pixels):
    h, w = len(pixels), len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter 0
        for px in row:
            raw.extend(px)

    compressed = zlib.compress(bytes(raw), 9)

    def chunk(typ: bytes, payload: bytes):
        crc = zlib.crc32(typ + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + typ + payload + struct.pack(">I", crc)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", compressed)
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    if len(sys.argv) != 2:
        print('Usage: python scripts/generate_icons.py "/path/to/source.png"')
        return 1

    source = Path(sys.argv[1])
    if not source.exists():
        print(f"Source image not found: {source}")
        return 1

    pixels = read_png(source)
    icons_dir = Path("icons")
    icons_dir.mkdir(exist_ok=True)

    for filename, size in TARGETS:
        out_path = icons_dir / filename
        write_png(out_path, resize_bilinear(pixels, size, size))
        print(f"Wrote {out_path} ({size}x{size})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
