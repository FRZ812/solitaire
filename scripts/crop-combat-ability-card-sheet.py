#!/usr/bin/env python3
"""Crop one nine-up ImageGen ability-card sheet using its manifest cell mapping."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--sheet-id", required=True)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--size", type=int, default=512)
    parser.add_argument("--quality", type=int, default=92)
    args = parser.parse_args()

    sheets = json.loads(args.manifest.read_text(encoding="utf-8"))
    sheet_entry = next((entry for entry in sheets if entry["id"] == args.sheet_id), None)
    if not sheet_entry:
        raise SystemExit(f"Unknown sheet id: {args.sheet_id}")

    source = Image.open(args.input).convert("RGB")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for ability in sheet_entry["abilities"]:
        row = ability["row"] - 1
        column = ability["column"] - 1
        left = round(column * source.width / 3)
        right = round((column + 1) * source.width / 3)
        top = round(row * source.height / 3)
        bottom = round((row + 1) * source.height / 3)
        card = source.crop((left, top, right, bottom)).resize(
            (args.size, args.size), Image.Resampling.LANCZOS
        )
        destination = args.output_dir / f"{ability['id']}-v1.webp"
        card.save(destination, "WEBP", quality=args.quality, method=6)
        written.append(destination.name)

    print(f"cropped {len(written)} cards from {args.sheet_id}: {', '.join(written)}")


if __name__ == "__main__":
    main()
