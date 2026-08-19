#!/usr/bin/env python3
"""Recover and normalize ImageGen archetype cutouts for combat-cell use.

The built-in image generator occasionally bakes its transparency checker into
an opaque PNG.  This tool models that repeating light checker from the source
corner, recovers a decontaminated alpha edge, and places the subject on the
canonical 960x1280 portrait canvas.  It also validates the framing contract so
an out-of-scale portrait fails before it can be wired into the game.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


CANVAS_SIZE = (960, 1280)
TARGET_BBOX = (0.84, 0.92)
TARGET_TOP = 0.06
ALPHA_BBOX_THRESHOLD = 8
CHECKER_RESIDUAL_THRESHOLD = 18


def _period_score(gray: np.ndarray, period: int) -> float:
    horizontal = np.mean(np.abs(gray[:, period:] - gray[:, :-period]))
    vertical = np.mean(np.abs(gray[period:, :] - gray[:-period, :]))
    return float(horizontal + vertical)


def infer_checker_period(rgb: np.ndarray) -> int:
    """Find the repeating checker period from the unobstructed top-left field."""

    height, width, _ = rgb.shape
    # Keep period inference inside the guaranteed transparent safety margin.
    # Tall inboard props can enter a 320px corner sample even when the actual
    # top-left field is clean, which corrupts the periodicity score.
    corner = min(192, height // 4, width // 4)
    if corner < 96:
        raise ValueError("source is too small to infer a checker background")
    gray = rgb[:corner, :corner].mean(axis=2)
    # ImageGen's baked checker varies with output dimensions.  Portrait runs
    # have produced full two-tile periods from 30 through the low seventies.
    candidates = [(period, _period_score(gray, period)) for period in range(24, 97)]
    period, score = min(candidates, key=lambda item: item[1])
    if score > 12:
        raise ValueError(f"no stable light-checker period found (best score {score:.2f})")
    return period


def checker_template(rgb: np.ndarray, period: int) -> np.ndarray:
    """Average clean corner samples into one coordinate-aware checker period."""

    height, width, _ = rgb.shape
    corner = min(360, height // 3, width // 3)
    patch = rgb[:corner, :corner]
    luminance = patch.mean(axis=2)
    chroma = patch.max(axis=2) - patch.min(axis=2)
    usable = (luminance >= 215) & (chroma <= 28)
    yy, xx = np.indices((corner, corner))
    sums = np.zeros((period, period, 3), dtype=np.float64)
    counts = np.zeros((period, period, 1), dtype=np.float64)
    np.add.at(sums, (yy[usable] % period, xx[usable] % period), patch[usable])
    np.add.at(counts, (yy[usable] % period, xx[usable] % period), 1)
    if np.any(counts == 0):
        raise ValueError("checker template has unsampled coordinates")
    return (sums / counts).astype(np.float32)


def repeated_checker(template: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    height, width = shape
    period = template.shape[0]
    yy, xx = np.indices((height, width))
    return template[yy % period, xx % period]


def exterior_background(raw_foreground: np.ndarray) -> np.ndarray:
    """Flood the background while leaving enclosed equipment/pose gaps distinct."""

    height, width = raw_foreground.shape
    exterior = np.zeros_like(raw_foreground, dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def seed(y: int, x: int) -> None:
        if not raw_foreground[y, x] and not exterior[y, x]:
            exterior[y, x] = True
            queue.append((y, x))

    for x in range(width):
        seed(0, x)
        seed(height - 1, x)
    for y in range(1, height - 1):
        seed(y, 0)
        seed(y, width - 1)

    while queue:
        y, x = queue.popleft()
        if y and not raw_foreground[y - 1, x] and not exterior[y - 1, x]:
            exterior[y - 1, x] = True
            queue.append((y - 1, x))
        if y + 1 < height and not raw_foreground[y + 1, x] and not exterior[y + 1, x]:
            exterior[y + 1, x] = True
            queue.append((y + 1, x))
        if x and not raw_foreground[y, x - 1] and not exterior[y, x - 1]:
            exterior[y, x - 1] = True
            queue.append((y, x - 1))
        if x + 1 < width and not raw_foreground[y, x + 1] and not exterior[y, x + 1]:
            exterior[y, x + 1] = True
            queue.append((y, x + 1))
    return exterior


def central_subject_component(mask: np.ndarray) -> np.ndarray:
    """Keep the one connected cutout and reject checker-compression speckles."""

    height, width = mask.shape
    center_y, center_x = height // 2, width // 2
    if mask[center_y, center_x]:
        seed = (center_y, center_x)
    else:
        points = np.argwhere(mask)
        if not len(points):
            raise ValueError("checker recovery found no foreground subject")
        distances = (points[:, 0] - center_y) ** 2 + (points[:, 1] - center_x) ** 2
        seed = tuple(int(value) for value in points[int(np.argmin(distances))])

    component = np.zeros_like(mask, dtype=bool)
    component[seed] = True
    queue: deque[tuple[int, int]] = deque([seed])
    neighbors = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))
    while queue:
        y, x = queue.popleft()
        for dy, dx in neighbors:
            next_y, next_x = y + dy, x + dx
            if (
                0 <= next_y < height
                and 0 <= next_x < width
                and mask[next_y, next_x]
                and not component[next_y, next_x]
            ):
                component[next_y, next_x] = True
                queue.append((next_y, next_x))
    return component


def recover_light_checker(source: Image.Image) -> tuple[Image.Image, int]:
    rgb = np.asarray(source.convert("RGB"), dtype=np.float32)
    period = infer_checker_period(rgb)
    background = repeated_checker(checker_template(rgb, period), rgb.shape[:2])
    distance = np.sqrt(np.mean((rgb - background) ** 2, axis=2))

    # The learned checker residual is normally below five, while ImageGen's
    # JPEG-like ringing around enclosed gaps can reach the mid teens.  Eighteen
    # still leaves deliberate dark hair, chains, and painted highlights far
    # above the matte while excluding those compressed checker islands.
    raw_foreground = central_subject_component(distance > CHECKER_RESIDUAL_THRESHOLD)
    exterior = exterior_background(raw_foreground)
    enclosed = ~exterior
    foreground_image = Image.fromarray(raw_foreground.astype(np.uint8) * 255, "L")
    expanded_subject = foreground_image.filter(ImageFilter.MaxFilter(7))
    subject_support = np.asarray(expanded_subject, dtype=np.uint8) > 0
    closed_subject = np.asarray(
        expanded_subject.filter(ImageFilter.MinFilter(7)),
        dtype=np.uint8,
    ) > 0
    interior = np.asarray(
        Image.fromarray(enclosed.astype(np.uint8) * 255, "L").filter(ImageFilter.MinFilter(5)),
        dtype=np.uint8,
    ) > 0
    protected_subject = interior & closed_subject

    denominator = np.maximum(background, 1)
    darker_difference = np.maximum((background - rgb) / denominator, 0).max(axis=2)
    edge_alpha = np.clip(darker_difference * 1.04, 0, 1)

    alpha = edge_alpha
    alpha[interior & (distance > 12)] = 1
    # Treat the learned checker's full residual band as transparent everywhere,
    # including enclosed gaps between hair, fingers, chains, and bent arms.  The
    # former three-point cutoff left compressed checker islands inside those
    # pockets even though the same pixels were correctly excluded from the
    # foreground component above.
    alpha[distance <= CHECKER_RESIDUAL_THRESHOLD] = 0
    alpha[exterior & (distance <= CHECKER_RESIDUAL_THRESHOLD)] = 0
    # Pale skin and polished metal can locally resemble the light checker.  A
    # small low-distance island fully surrounded by high-confidence subject
    # pixels is material, not background; restore it after the global matte
    # cutoff.  Large enclosed pose gaps remain outside the seven-pixel support
    # band and stay transparent.
    alpha[protected_subject] = 1
    alpha[~enclosed & ~subject_support] = 0
    alpha = np.asarray(
        Image.fromarray(np.uint8(np.clip(alpha * 255, 0, 255)), "L").filter(
            ImageFilter.GaussianBlur(0.45)
        ),
        dtype=np.float32,
    ) / 255
    alpha[alpha < (3 / 255)] = 0

    # Reverse the light matte on semitransparent pixels before resizing.
    alpha_3 = alpha[..., None]
    recovered = np.zeros_like(rgb)
    visible = alpha > 0
    recovered[visible] = np.clip(
        (rgb[visible] - (1 - alpha_3[visible]) * background[visible]) / alpha_3[visible],
        0,
        255,
    )
    rgba = np.dstack((np.uint8(recovered), np.uint8(np.clip(alpha * 255, 0, 255))))
    return decontaminate_fringe(Image.fromarray(rgba, "RGBA")), period


def decontaminate_fringe(image: Image.Image) -> Image.Image:
    """Pull subject colors through semitransparent edges without changing alpha."""

    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    alpha = rgba[..., 3]
    colors = rgba[..., :3].astype(np.float32)
    transparent = Image.fromarray((alpha == 0).astype(np.uint8) * 255, "L")
    near_transparent = np.asarray(transparent.filter(ImageFilter.MaxFilter(31)), dtype=np.uint8) > 0
    chroma = rgba[..., :3].max(axis=2) - rgba[..., :3].min(axis=2)
    pale_edge_matte = (
        (alpha > 0)
        & near_transparent
        & (rgba[..., :3].min(axis=2) >= 120)
        & (chroma <= 55)
    )
    known = (alpha >= 192) & ~pale_edge_matte
    pending = ((alpha > 0) & ~known) | pale_edge_matte

    for _ in range(48):
        if not np.any(pending):
            break
        sums = np.zeros_like(colors)
        counts = np.zeros(alpha.shape, dtype=np.float32)
        for dy, dx in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
            shifted_known = np.roll(np.roll(known, dy, axis=0), dx, axis=1)
            shifted_colors = np.roll(np.roll(colors, dy, axis=0), dx, axis=1)
            if dy < 0:
                shifted_known[dy:, :] = False
            elif dy > 0:
                shifted_known[:dy, :] = False
            if dx < 0:
                shifted_known[:, dx:] = False
            elif dx > 0:
                shifted_known[:, :dx] = False
            sums += shifted_colors * shifted_known[..., None]
            counts += shifted_known
        fill = pending & (counts > 0)
        colors[fill] = sums[fill] / counts[fill, None]
        known[fill] = True
        pending[fill] = False

    rgba[..., :3] = np.uint8(np.clip(colors, 0, 255))
    rgba[alpha == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def alpha_bbox(image: Image.Image, threshold: int = ALPHA_BBOX_THRESHOLD) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A").point(lambda value: 255 if value > threshold else 0)
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("portrait has no visible alpha")
    return bbox


def resize_premultiplied(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32)
    alpha = rgba[..., 3:4] / 255
    premultiplied = rgba[..., :3] * alpha
    channels: list[np.ndarray] = []
    for index in range(3):
        channel = Image.fromarray(premultiplied[..., index], "F").resize(size, Image.Resampling.LANCZOS)
        channels.append(np.asarray(channel, dtype=np.float32))
    resized_alpha_image = Image.fromarray(alpha[..., 0], "F").resize(size, Image.Resampling.LANCZOS)
    resized_alpha = np.clip(np.asarray(resized_alpha_image, dtype=np.float32), 0, 1)
    stacked = np.stack(channels, axis=2)
    rgb = np.zeros_like(stacked)
    visible = resized_alpha > 1e-4
    rgb[visible] = np.clip(stacked[visible] / resized_alpha[visible, None], 0, 255)
    result = np.dstack((np.uint8(rgb), np.uint8(resized_alpha * 255)))
    result[result[..., 3] == 0, :3] = 0
    return Image.fromarray(result, "RGBA")


def normalize_geometry(image: Image.Image) -> Image.Image:
    bbox = alpha_bbox(image)
    subject = image.crop(bbox)
    target_width = round(CANVAS_SIZE[0] * TARGET_BBOX[0])
    target_height = round(CANVAS_SIZE[1] * TARGET_BBOX[1])
    subject = resize_premultiplied(subject, (target_width, target_height))
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    left = (CANVAS_SIZE[0] - target_width) // 2
    top = round(CANVAS_SIZE[1] * TARGET_TOP)
    canvas.alpha_composite(subject, (left, top))
    rgba = np.asarray(canvas, dtype=np.uint8).copy()
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def metrics(image: Image.Image, checker_period: int | None) -> dict[str, object]:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8)
    alpha = rgba[..., 3]
    left, top, right, bottom = alpha_bbox(image)
    width, height = image.size
    pale_fringe = (
        (alpha > 0)
        & (alpha <= 64)
        & (rgba[..., :3].min(axis=2) >= 210)
        & ((rgba[..., :3].max(axis=2) - rgba[..., :3].min(axis=2)) <= 20)
    )
    return {
        "size": [width, height],
        "checkerPeriod": checker_period,
        "alphaExtrema": [int(alpha.min()), int(alpha.max())],
        "transparentPixels": int(np.sum(alpha == 0)),
        "semiTransparentPixels": int(np.sum((alpha > 0) & (alpha < 255))),
        "opaquePixels": int(np.sum(alpha == 255)),
        "bbox": [left, top, right - 1, bottom - 1],
        "bboxRatios": {
            "width": round((right - left) / width, 4),
            "height": round((bottom - top) / height, 4),
            "left": round(left / width, 4),
            "top": round(top / height, 4),
            "right": round((width - right) / width, 4),
            "bottom": round((height - bottom) / height, 4),
        },
        "edgeAlphaPixels": {
            "top": int(np.count_nonzero(alpha[0, :])),
            "right": int(np.count_nonzero(alpha[:, -1])),
            "bottom": int(np.count_nonzero(alpha[-1, :])),
            "left": int(np.count_nonzero(alpha[:, 0])),
        },
        "cornerAlpha": [
            int(alpha[0, 0]),
            int(alpha[0, -1]),
            int(alpha[-1, 0]),
            int(alpha[-1, -1]),
        ],
        "paleLowAlphaFringePixels": int(np.count_nonzero(pale_fringe)),
    }


def validate_contract(report: dict[str, object]) -> None:
    ratios = report["bboxRatios"]
    if report["size"] != list(CANVAS_SIZE):
        raise ValueError(f"expected {CANVAS_SIZE[0]}x{CANVAS_SIZE[1]} output")
    if not 0.82 <= ratios["width"] <= 0.86:
        raise ValueError(f"alpha width ratio out of contract: {ratios['width']}")
    if not 0.90 <= ratios["height"] <= 0.94:
        raise ValueError(f"alpha height ratio out of contract: {ratios['height']}")
    if any(report["cornerAlpha"]):
        raise ValueError("portrait corners must be transparent")
    if any(report["edgeAlphaPixels"].values()):
        raise ValueError(f"portrait touches canvas edge: {report['edgeAlphaPixels']}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--recover-light-checker",
        action="store_true",
        help="recover alpha from an opaque light checker before normalization",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    checker_period: int | None = None
    if args.recover_light_checker:
        source, checker_period = recover_light_checker(source)
    elif source.getchannel("A").getextrema() == (255, 255):
        raise ValueError("opaque source requires --recover-light-checker")

    normalized = normalize_geometry(source)
    report = metrics(normalized, checker_period)
    validate_contract(report)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    normalized.save(args.output, "PNG", optimize=True)
    report["sha256"] = hashlib.sha256(args.output.read_bytes()).hexdigest()
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
