#!/usr/bin/env python3
"""Build an archetype-scoped contact sheet from cropped per-ability card assets."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--owner", required=True)
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    abilities = [
        ability
        for sheet in manifest
        if sheet["owner"].lower() == args.owner.lower()
        for ability in sheet["abilities"]
    ]
    if not abilities:
        raise SystemExit(f"No ability cards for owner: {args.owner}")

    columns = 6
    cell = 180
    label_height = 26
    rows = math.ceil(len(abilities) / columns)
    canvas = Image.new("RGB", (columns * cell, rows * (cell + label_height)), (15, 14, 18))
    draw = ImageDraw.Draw(canvas)
    for index, ability in enumerate(abilities):
        x = (index % columns) * cell
        y = (index // columns) * (cell + label_height)
        source = args.input_dir / f"{ability['id']}-v1.webp"
        image = Image.open(source).convert("RGB").resize((cell, cell), Image.Resampling.LANCZOS)
        canvas.paste(image, (x, y))
        draw.text((x + 6, y + cell + 7), ability["name"][:27], fill=(236, 232, 224))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output, quality=91)


if __name__ == "__main__":
    main()
