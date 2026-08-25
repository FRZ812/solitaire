#!/usr/bin/env python3
"""Build a compact QA contact sheet for the generated archetype portraits."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--background",
        default="#1c191f",
        help="contact-sheet background as #RRGGBB",
    )
    args = parser.parse_args()

    background = args.background.removeprefix("#")
    if len(background) != 6:
        raise ValueError("--background must be #RRGGBB")
    background_rgb = tuple(int(background[index : index + 2], 16) for index in (0, 2, 4))

    files = sorted(
        source
        for pattern in ("*.png", "*.webp")
        for source in args.input.glob(pattern)
    )
    cell = (240, 320)
    columns = 4
    rows = max(1, (len(files) + columns - 1) // columns)
    sheet = Image.new(
        "RGBA",
        (cell[0] * columns, cell[1] * rows),
        (*background_rgb, 255),
    )
    draw = ImageDraw.Draw(sheet)
    for index, source in enumerate(files):
        x = (index % columns) * cell[0]
        y = (index // columns) * cell[1]
        portrait = Image.open(source).convert("RGBA").resize(cell, Image.Resampling.LANCZOS)
        sheet.alpha_composite(portrait, (x, y))
        draw.rectangle((x, y + 292, x + cell[0] - 1, y + cell[1] - 1), fill=(12, 11, 14, 220))
        draw.text((x + 8, y + 299), source.stem.replace("-portrait-v1", ""), fill="white")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(args.output, quality=92)


if __name__ == "__main__":
    main()
