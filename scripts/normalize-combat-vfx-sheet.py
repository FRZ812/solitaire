#!/usr/bin/env python3
"""Normalize one ImageGen 3x3 combat VFX sheet into a nine-frame WebP strip."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image
from PIL import ImageFilter


GRID_SIZE = 3
FRAME_COUNT = GRID_SIZE * GRID_SIZE


def recover_sheet_alpha(image: Image.Image) -> Image.Image:
    """Recover alpha if ImageGen bakes a neutral preview field into the sheet."""
    rgba = image.convert("RGBA")
    current_alpha = np.asarray(rgba.getchannel("A"))
    if current_alpha.min() < 250:
        return rgba

    rgb = np.asarray(rgba)[..., :3]
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]), axis=0)
    border_light = float(np.median(border.max(axis=1)))
    if border_light < 42:
        # Additive VFX occasionally arrive on black. Use emitted luminance as opacity so the
        # black field disappears without inventing a rectangular source-over sprite.
        alpha = np.clip(rgb.max(axis=2).astype(np.float32) * 1.45, 0, 255).astype(np.uint8)
        rgba.putalpha(Image.fromarray(alpha, "L"))
        return rgba

    low = rgb.min(axis=2)
    chroma = rgb.max(axis=2) - low
    candidate = (low > 212) & (chroma < 28)
    height, width = candidate.shape
    outside = np.zeros_like(candidate)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        if candidate[0, x]: queue.append((0, x))
        if candidate[height - 1, x]: queue.append((height - 1, x))
    for y in range(height):
        if candidate[y, 0]: queue.append((y, 0))
        if candidate[y, width - 1]: queue.append((y, width - 1))
    while queue:
        y, x = queue.popleft()
        if outside[y, x] or not candidate[y, x]:
            continue
        outside[y, x] = True
        if y: queue.append((y - 1, x))
        if y + 1 < height: queue.append((y + 1, x))
        if x: queue.append((y, x - 1))
        if x + 1 < width: queue.append((y, x + 1))

    outside_image = Image.fromarray((outside * 255).astype(np.uint8), "L")
    fringe = np.asarray(outside_image.filter(ImageFilter.MaxFilter(7))) > 0
    soft_background = fringe & (low > 170) & (chroma < 58)
    alpha = np.full((height, width), 255, dtype=np.uint8)
    alpha[outside] = 0
    softness = np.clip((235 - low) * 5 + chroma * 2, 0, 255).astype(np.uint8)
    alpha[soft_background & ~outside] = softness[soft_background & ~outside]
    rgba.putalpha(Image.fromarray(alpha, "L"))
    return rgba


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Crop a transparent 3x3 ImageGen sheet in reading order and pack its "
            "nine cells into one fixed-anchor horizontal WebP animation strip."
        )
    )
    parser.add_argument("--input", required=True, help="Source ImageGen PNG path.")
    parser.add_argument("--output", required=True, help="Destination WebP strip path.")
    parser.add_argument(
        "--frame-size",
        type=int,
        default=256,
        help="Square output size for every cropped frame. Default: 256.",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=90,
        help="WebP quality from 1 to 100. Default: 90.",
    )
    parser.add_argument(
        "--preview",
        help="Optional checkerboard PNG preview of the normalized 3x3 sequence.",
    )
    return parser.parse_args()


def crop_grid(sheet: Image.Image) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for row in range(GRID_SIZE):
        top = round(row * sheet.height / GRID_SIZE)
        bottom = round((row + 1) * sheet.height / GRID_SIZE)
        for column in range(GRID_SIZE):
            left = round(column * sheet.width / GRID_SIZE)
            right = round((column + 1) * sheet.width / GRID_SIZE)
            frames.append(sheet.crop((left, top, right, bottom)))
    return frames


def clean_transparent_rgb(frame: Image.Image) -> Image.Image:
    """Remove nearly transparent RGB noise so scaled WebP edges stay clean."""
    red, green, blue, alpha = frame.split()
    alpha = alpha.point(lambda value: 0 if value <= 2 else value)
    empty = Image.new("L", frame.size, 0)
    red = Image.composite(red, empty, alpha)
    green = Image.composite(green, empty, alpha)
    blue = Image.composite(blue, empty, alpha)
    return Image.merge("RGBA", (red, green, blue, alpha))


def normalize_frame(frame: Image.Image, frame_size: int) -> Image.Image:
    frame = clean_transparent_rgb(frame.convert("RGBA"))
    return frame.resize((frame_size, frame_size), Image.Resampling.LANCZOS)


def build_strip(frames: list[Image.Image], frame_size: int) -> Image.Image:
    strip = Image.new("RGBA", (frame_size * FRAME_COUNT, frame_size), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * frame_size, 0))
    return strip


def checkerboard(size: tuple[int, int], tile: int = 16) -> Image.Image:
    board = Image.new("RGBA", size, (235, 239, 243, 255))
    pixels = board.load()
    for y in range(size[1]):
        for x in range(size[0]):
            shade = 218 if ((x // tile) + (y // tile)) % 2 else 238
            pixels[x, y] = (shade, shade + 2, shade + 4, 255)
    return board


def write_preview(frames: list[Image.Image], frame_size: int, path: Path) -> None:
    gap = max(4, frame_size // 32)
    width = GRID_SIZE * frame_size + (GRID_SIZE - 1) * gap
    board = checkerboard((width, width))
    for index, frame in enumerate(frames):
        row, column = divmod(index, GRID_SIZE)
        board.alpha_composite(frame, (column * (frame_size + gap), row * (frame_size + gap)))
    path.parent.mkdir(parents=True, exist_ok=True)
    board.convert("RGB").save(path, format="PNG", optimize=True)


def main() -> None:
    args = parse_args()
    if args.frame_size < 1:
        raise SystemExit("--frame-size must be positive.")
    if not 1 <= args.quality <= 100:
        raise SystemExit("--quality must be between 1 and 100.")

    source = Path(args.input)
    if not source.is_file():
        raise SystemExit(f"Source sheet does not exist: {source}")

    sheet = recover_sheet_alpha(Image.open(source))
    if sheet.width < GRID_SIZE or sheet.height < GRID_SIZE:
        raise SystemExit("Source sheet is too small for a 3x3 grid.")

    frames = [normalize_frame(frame, args.frame_size) for frame in crop_grid(sheet)]
    strip = build_strip(frames, args.frame_size)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    strip.save(
        output,
        format="WEBP",
        quality=args.quality,
        method=6,
        exact=True,
    )

    if args.preview:
        write_preview(frames, args.frame_size, Path(args.preview))

    print(
        f"normalized {source.name}: {sheet.width}x{sheet.height} RGBA -> "
        f"{FRAME_COUNT} frames -> {strip.width}x{strip.height} {output}"
    )


if __name__ == "__main__":
    main()
