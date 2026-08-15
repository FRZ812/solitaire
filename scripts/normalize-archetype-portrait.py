#!/usr/bin/env python3
"""Normalize one ImageGen archetype representative to the shared portrait canvas."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image
from PIL import ImageFilter


CANVAS = (960, 1280)
CONTENT = (920, 1390)


def remove_baked_checkerboard(image: Image.Image) -> Image.Image:
    """Recover alpha when ImageGen renders its transparency preview into RGB pixels."""
    rgba = image.convert("RGBA")
    alpha = np.asarray(rgba.getchannel("A"))
    if alpha.min() < 250:
        return rgba

    rgb = np.asarray(rgba)[..., :3]
    low = rgb.min(axis=2)
    chroma = rgb.max(axis=2) - low
    candidate = (low > 215) & (chroma < 24)
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
    soft_background = fringe & (low > 175) & (chroma < 52)
    recovered = np.full((height, width), 255, dtype=np.uint8)
    recovered[outside] = 0
    softness = np.clip((235 - low) * 5 + chroma * 2, 0, 255).astype(np.uint8)
    recovered[soft_background & ~outside] = softness[soft_background & ~outside]
    rgba.putalpha(Image.fromarray(recovered, "L"))
    return rgba


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    return bbox or (0, 0, image.width, image.height)


def normalize(source: Path, output: Path) -> None:
    image = remove_baked_checkerboard(Image.open(source))
    bbox = alpha_bbox(image)
    subject = image.crop(bbox)
    scale = min(CONTENT[0] / subject.width, CONTENT[1] / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)

    if subject.height > CANVAS[1] - 20:
        subject = subject.crop((0, 0, subject.width, CANVAS[1] - 20))
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    x = (CANVAS[0] - subject.width) // 2
    y = 20 if subject.height >= CANVAS[1] - 20 else CANVAS[1] - subject.height
    canvas.alpha_composite(subject, (x, y))

    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, "WEBP", lossless=True, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    normalize(args.source.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
