#!/usr/bin/env python3
"""Build a smooth combat-VFX atlas by interpolating one generated raster keyframe."""

from __future__ import annotations

import argparse
from collections import deque
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extract one cell from a generated 2x2 keyframe sheet, animate its transform "
            "through authored keyframes, and pack the rendered frames into a compact atlas."
        )
    )
    parser.add_argument("--source-sheet", required=True)
    parser.add_argument("--cell-index", type=int, default=3, choices=range(4))
    parser.add_argument("--output", required=True)
    parser.add_argument("--frame-dir")
    parser.add_argument("--preview")
    parser.add_argument("--animated-preview")
    parser.add_argument("--frame-size", type=int, default=512)
    parser.add_argument("--frame-count", type=int, default=24)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--columns", type=int, default=6)
    return parser.parse_args()


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - (2.0 * value))


def clean_transparent_rgb(image: Image.Image) -> Image.Image:
    red, green, blue, alpha = image.convert("RGBA").split()
    alpha = alpha.point(lambda value: 0 if value <= 2 else value)
    empty = Image.new("L", image.size, 0)
    return Image.merge(
        "RGBA",
        (
            Image.composite(red, empty, alpha),
            Image.composite(green, empty, alpha),
            Image.composite(blue, empty, alpha),
            alpha,
        ),
    )


def keep_major_alpha_components(image: Image.Image) -> Image.Image:
    """Remove disconnected generation specks while preserving the authored stroke."""
    rgba = image.convert("RGBA")
    alpha = np.asarray(rgba.getchannel("A"))
    foreground = alpha > 4
    visited = np.zeros_like(foreground, dtype=bool)
    components: list[list[tuple[int, int]]] = []
    height, width = foreground.shape

    for seed_y, seed_x in np.argwhere(foreground):
        if visited[seed_y, seed_x]:
            continue
        queue: deque[tuple[int, int]] = deque([(int(seed_y), int(seed_x))])
        visited[seed_y, seed_x] = True
        component: list[tuple[int, int]] = []
        while queue:
            y, x = queue.popleft()
            component.append((y, x))
            for next_y in range(max(0, y - 1), min(height, y + 2)):
                for next_x in range(max(0, x - 1), min(width, x + 2)):
                    if foreground[next_y, next_x] and not visited[next_y, next_x]:
                        visited[next_y, next_x] = True
                        queue.append((next_y, next_x))
        components.append(component)

    if not components:
        return rgba
    largest = max(len(component) for component in components)
    kept = np.zeros_like(foreground, dtype=np.uint8)
    minimum = max(24, round(largest * 0.035))
    for component in components:
        if len(component) < minimum:
            continue
        for y, x in component:
            kept[y, x] = 255

    # Restore the anti-aliased fringe around every retained component.
    keep_mask = Image.fromarray(kept, "L").filter(ImageFilter.MaxFilter(9))
    filtered_alpha = Image.fromarray(alpha, "L")
    filtered_alpha = Image.composite(filtered_alpha, Image.new("L", rgba.size, 0), keep_mask)
    rgba.putalpha(filtered_alpha)
    return clean_transparent_rgb(rgba)


def crop_source_cell(sheet: Image.Image, cell_index: int) -> Image.Image:
    row, column = divmod(cell_index, 2)
    left = round(column * sheet.width / 2)
    right = round((column + 1) * sheet.width / 2)
    top = round(row * sheet.height / 2)
    bottom = round((row + 1) * sheet.height / 2)
    cell = keep_major_alpha_components(
        clean_transparent_rgb(sheet.crop((left, top, right, bottom)))
    )
    alpha_box = cell.getchannel("A").getbbox()
    if not alpha_box:
        raise SystemExit("Selected keyframe cell is fully transparent.")
    padding = max(6, round(max(cell.size) * 0.02))
    bounds = (
        max(0, alpha_box[0] - padding),
        max(0, alpha_box[1] - padding),
        min(cell.width, alpha_box[2] + padding),
        min(cell.height, alpha_box[3] + padding),
    )
    return cell.crop(bounds)


def horizontalize(sprite: Image.Image) -> Image.Image:
    horizontal = clean_transparent_rgb(
        sprite.rotate(-45, resample=Image.Resampling.BICUBIC, expand=True)
    )
    bounds = horizontal.getchannel("A").getbbox()
    if not bounds:
        raise SystemExit("Rotated keyframe has no visible pixels.")
    return horizontal.crop(bounds)


KEYFRAMES = (
    # frame, length, thickness, opacity, forward advance, brightness, glow
    # Anticipation is invisible. The slash then reaches nearly full length in one
    # frame, peaks once, and keeps its silhouette while the afterimage dissipates.
    # Never progressively extend or retract the blade trail: that reads as carving.
    (0, 0.08, 0.72, 0.00, 0.00, 0.78, 0.00),
    (7, 0.08, 0.72, 0.00, 0.00, 0.82, 0.00),
    (8, 0.14, 0.76, 0.28, 0.00, 0.92, 0.03),
    (9, 0.92, 0.92, 0.82, 0.01, 1.08, 0.12),
    (10, 1.00, 1.00, 1.00, 0.02, 1.24, 0.22),
    (11, 1.00, 1.04, 0.66, 0.06, 1.10, 0.13),
    (12, 0.99, 1.07, 0.38, 0.11, 0.98, 0.07),
    (13, 0.99, 1.10, 0.19, 0.17, 0.90, 0.03),
    (14, 0.98, 1.12, 0.08, 0.23, 0.84, 0.01),
    (15, 0.98, 1.14, 0.02, 0.29, 0.80, 0.00),
    (16, 0.98, 1.14, 0.00, 0.33, 0.78, 0.00),
    (23, 0.98, 1.14, 0.00, 0.33, 0.78, 0.00),
)


def properties_for_frame(frame: int, frame_count: int) -> tuple[float, ...]:
    scale = (frame_count - 1) / 23 if frame_count > 1 else 1
    authored_frame = frame / scale
    for left, right in zip(KEYFRAMES, KEYFRAMES[1:]):
        if authored_frame <= right[0]:
            span = max(1e-6, right[0] - left[0])
            phase = smoothstep((authored_frame - left[0]) / span)
            return tuple(
                left[index] + ((right[index] - left[index]) * phase)
                for index in range(1, len(left))
            )
    return tuple(KEYFRAMES[-1][1:])


def multiply_alpha(image: Image.Image, opacity: float) -> Image.Image:
    result = image.copy()
    result.putalpha(result.getchannel("A").point(lambda value: round(value * opacity)))
    return result


def tint_from_alpha(alpha: Image.Image, color: tuple[int, int, int], opacity: float) -> Image.Image:
    tint = Image.new("RGBA", alpha.size, (*color, 0))
    tint.putalpha(alpha.point(lambda value: round(value * opacity)))
    return tint


def render_frame(
    horizontal: Image.Image,
    frame: int,
    frame_count: int,
    frame_size: int,
) -> Image.Image:
    length, thickness, opacity, advance, brightness, glow = properties_for_frame(
        frame, frame_count
    )
    canvas = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    if opacity <= 0.001:
        return canvas

    max_length = frame_size * 0.58
    target_width = max(2, round(max_length * length))
    aspect = horizontal.height / max(1, horizontal.width)
    target_height = max(2, round(max_length * aspect * thickness))
    transformed = horizontal.resize(
        (target_width, target_height), Image.Resampling.LANCZOS
    )
    transformed = ImageEnhance.Brightness(transformed).enhance(brightness)
    transformed = clean_transparent_rgb(
        transformed.rotate(-45, resample=Image.Resampling.BICUBIC, expand=True)
    )
    transformed = multiply_alpha(transformed, opacity)

    direction = (math.sqrt(0.5), math.sqrt(0.5))
    origin = (frame_size * 0.25, frame_size * 0.25)
    center_distance = (target_width / 2) + (advance * max_length)
    center = (
        origin[0] + (direction[0] * center_distance),
        origin[1] + (direction[1] * center_distance),
    )
    position = (
        round(center[0] - (transformed.width / 2)),
        round(center[1] - (transformed.height / 2)),
    )

    if glow > 0:
        blurred_alpha = transformed.getchannel("A").filter(
            ImageFilter.GaussianBlur(max(2, round(frame_size * 0.012)))
        )
        glow_layer = tint_from_alpha(blurred_alpha, (232, 238, 244), glow)
        canvas.alpha_composite(glow_layer, position)
    canvas.alpha_composite(transformed, position)
    return clean_transparent_rgb(canvas)


def pack_atlas(frames: list[Image.Image], columns: int, frame_size: int) -> Image.Image:
    rows = math.ceil(len(frames) / columns)
    atlas = Image.new(
        "RGBA", (columns * frame_size, rows * frame_size), (0, 0, 0, 0)
    )
    for index, frame in enumerate(frames):
        row, column = divmod(index, columns)
        atlas.alpha_composite(frame, (column * frame_size, row * frame_size))
    return atlas


def main() -> None:
    args = parse_args()
    if args.frame_size < 64 or args.frame_count < 2 or args.fps < 1 or args.columns < 1:
        raise SystemExit("Invalid animation dimensions or timing.")

    sheet = Image.open(args.source_sheet).convert("RGBA")
    source = horizontalize(crop_source_cell(sheet, args.cell_index))
    frames = [
        render_frame(source, frame, args.frame_count, args.frame_size)
        for frame in range(args.frame_count)
    ]

    if args.frame_dir:
        frame_dir = Path(args.frame_dir)
        frame_dir.mkdir(parents=True, exist_ok=True)
        for index, frame in enumerate(frames):
            frame.save(frame_dir / f"frame-{index:02d}.png", optimize=True)

    atlas = pack_atlas(frames, args.columns, args.frame_size)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, format="WEBP", quality=92, method=6, exact=True)

    if args.preview:
        preview = atlas.resize(
            (atlas.width // 2, atlas.height // 2), Image.Resampling.LANCZOS
        )
        preview_path = Path(args.preview)
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        preview.save(preview_path, format="PNG", optimize=True)

    if args.animated_preview:
        animated_path = Path(args.animated_preview)
        animated_path.parent.mkdir(parents=True, exist_ok=True)
        frames[0].save(
            animated_path,
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=round(1000 / args.fps),
            loop=0,
            lossless=True,
            method=6,
        )

    print(
        f"interpolated {args.frame_count} frames at {args.frame_size}px, "
        f"packed {args.columns} columns into {atlas.width}x{atlas.height}: {output}"
    )


if __name__ == "__main__":
    main()
