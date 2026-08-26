#!/usr/bin/env python3
"""Recover and normalize ImageGen archetype cutouts for combat-cell use.

The preferred source is now an opaque portrait on a uniform high-chroma matte.
That keeps paper-white paint out of the generated silhouette and lets this tool
derive alpha deterministically.  Legacy baked-checker sources remain supported.
Both paths decontaminate the antialias edge, preserve the authored aspect ratio,
and validate framing before a portrait can be wired into the game.
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
TARGET_HEIGHT_RATIO = 0.92
MAX_TARGET_HEIGHT_RATIO = 0.97
MIN_TARGET_WIDTH_RATIO = 0.72
MAX_TARGET_WIDTH_RATIO = 0.94
TARGET_TOP = 0.06
ALPHA_BBOX_THRESHOLD = 8
CHECKER_RESIDUAL_THRESHOLD = 18
CHROMA_BACKGROUND_DISTANCE = 10
CHROMA_FOREGROUND_DISTANCE = 42
CHROMA_FOREGROUND_EXCESS = 52
MIN_SOURCE_TOP_CLEARANCE_RATIO = 0.01
MIN_SOURCE_SIDE_CLEARANCE_RATIO = 0.01
MAX_PALE_LOW_ALPHA_FRINGE_PIXELS = 64
MAX_CHROMA_FRINGE_PIXELS = 64
MAX_SEMITRANSPARENT_VISIBLE_RATIO = 0.03
ALPHA_CRISP_LOW = 112
ALPHA_CRISP_HIGH = 208
PAPER_WHITE_CLEANUP_PASSES = 4


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


def infer_chroma_matte(rgb: np.ndarray) -> np.ndarray:
    """Infer a uniform matte from the outer border and reject noisy backdrops."""

    height, width, _ = rgb.shape
    band = max(8, round(min(height, width) * 0.015))
    border = np.concatenate(
        (
            rgb[:band].reshape(-1, 3),
            # The horizontal bottom edge is the one intentional portrait crop,
            # so lower clothing may occupy it.  Infer only from the mandatory
            # top and full-height side safety bands.
            rgb[band:, :band].reshape(-1, 3),
            rgb[band:, -band:].reshape(-1, 3),
        ),
        axis=0,
    )
    matte = np.median(border, axis=0)
    residual = np.sqrt(np.mean((border - matte) ** 2, axis=1))
    stable_ratio = float(np.mean(residual <= CHROMA_BACKGROUND_DISTANCE))
    chroma = float(matte.max() - matte.min())
    if chroma < 170:
        raise ValueError(f"source border is not a high-chroma matte (chroma {chroma:.1f})")
    if stable_ratio < 0.92:
        raise ValueError(
            "source border is not uniformly keyed "
            f"({stable_ratio:.1%} within {CHROMA_BACKGROUND_DISTANCE} RGB distance)"
        )
    return matte.astype(np.float32)


def _matte_excess(rgb: np.ndarray, matte: np.ndarray) -> tuple[np.ndarray, float]:
    """Return the keyed-channel excess for green, magenta, or another RGB matte."""

    dominant = int(np.argmax(matte))
    weakest = int(np.argmin(matte))
    if dominant == 1 and matte[1] - max(matte[0], matte[2]) >= 150:
        return rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2]), float(
            matte[1] - max(matte[0], matte[2])
        )
    if weakest == 1 and min(matte[0], matte[2]) - matte[1] >= 150:
        return np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1], float(
            min(matte[0], matte[2]) - matte[1]
        )
    other_channels = [index for index in range(3) if index != dominant]
    return rgb[..., dominant] - np.maximum(
        rgb[..., other_channels[0]], rgb[..., other_channels[1]]
    ), float(
        matte[dominant] - max(matte[other_channels[0]], matte[other_channels[1]])
    )


def recover_chroma_matte(source: Image.Image) -> tuple[Image.Image, list[int]]:
    """Recover alpha from a uniform saturated matte without retaining key spill."""

    rgb = np.asarray(source.convert("RGB"), dtype=np.float32)
    matte = infer_chroma_matte(rgb)
    distance = np.sqrt(np.mean((rgb - matte) ** 2, axis=2))
    excess, matte_excess = _matte_excess(rgb, matte)
    if matte_excess < 150:
        raise ValueError("chroma matte does not have enough keyed-channel separation")

    distance_alpha = np.clip(
        (distance - CHROMA_BACKGROUND_DISTANCE)
        / (CHROMA_FOREGROUND_DISTANCE - CHROMA_BACKGROUND_DISTANCE),
        0,
        1,
    )
    excess_alpha = np.clip(
        (matte_excess - excess) / (matte_excess - CHROMA_FOREGROUND_EXCESS),
        0,
        1,
    )
    alpha = np.minimum(distance_alpha, excess_alpha)

    # Limit the recovered edge to the central authored cutout.  The generous
    # dilation retains thin hair, bowstrings, and antialiasing while excluding
    # isolated matte compression speckles.
    confident_subject = central_subject_component(
        (distance >= CHROMA_FOREGROUND_DISTANCE)
        & (excess <= CHROMA_FOREGROUND_EXCESS)
    )
    support = np.asarray(
        Image.fromarray(np.uint8(confident_subject) * 255, "L").filter(
            ImageFilter.MaxFilter(11)
        ),
        dtype=np.uint8,
    ) > 0
    alpha[~support] = 0
    alpha = np.asarray(
        Image.fromarray(np.uint8(np.clip(alpha * 255, 0, 255)), "L").filter(
            ImageFilter.GaussianBlur(0.35)
        ),
        dtype=np.float32,
    ) / 255
    alpha[alpha < (3 / 255)] = 0

    alpha_3 = alpha[..., None]
    recovered = np.zeros_like(rgb)
    visible = alpha > 0
    recovered[visible] = np.clip(
        (rgb[visible] - (1 - alpha_3[visible]) * matte) / alpha_3[visible],
        0,
        255,
    )
    rgba = np.dstack((np.uint8(recovered), np.uint8(np.clip(alpha * 255, 0, 255))))
    result = decontaminate_chroma_fringe(
        Image.fromarray(rgba, "RGBA"),
        matte,
    )
    return result, [int(round(value)) for value in matte]


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


def decontaminate_fringe(
    image: Image.Image,
    extra_matte_mask: np.ndarray | None = None,
) -> Image.Image:
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
    if extra_matte_mask is not None:
        if extra_matte_mask.shape != alpha.shape:
            raise ValueError("extra matte mask must match the image dimensions")
        pale_edge_matte |= extra_matte_mask
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


def decontaminate_chroma_fringe(
    image: Image.Image,
    matte: np.ndarray,
    threshold: float = 20,
    radius: int = 31,
) -> Image.Image:
    """Replace residual keyed hues near transparency with local material color."""

    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8)
    alpha = rgba[..., 3]
    key_excess, _ = _matte_excess(rgba[..., :3].astype(np.float32), matte)
    near_transparent = np.asarray(
        Image.fromarray((alpha == 0).astype(np.uint8) * 255, "L").filter(
            ImageFilter.MaxFilter(radius)
        ),
        dtype=np.uint8,
    ) > 0
    chroma_spill = (alpha > 0) & near_transparent & (key_excess > threshold)
    return decontaminate_fringe(image, extra_matte_mask=chroma_spill)


def _crop_zone(alpha: np.ndarray) -> np.ndarray:
    """Return the outer side and lower bands where editorial crop paint can occur."""

    visible_y, visible_x = np.nonzero(alpha > ALPHA_BBOX_THRESHOLD)
    if not len(visible_x):
        raise ValueError("portrait has no visible alpha")
    left, right = int(visible_x.min()), int(visible_x.max()) + 1
    top, bottom = int(visible_y.min()), int(visible_y.max()) + 1
    height, width = alpha.shape
    yy, xx = np.indices(alpha.shape)
    side_band = max(1, round(width * 0.10))
    lower_band = max(1, round(height * 0.18))
    side_crop = (
        ((xx <= left + side_band) | (xx >= right - side_band))
        & (yy >= top + (bottom - top) * 0.30)
    )
    lower_crop = yy >= bottom - lower_band
    return side_crop | lower_crop


def _boundary_depth(alpha: np.ndarray, max_depth: int = 48) -> np.ndarray:
    """Approximate pixel depth from the alpha boundary using repeated erosion."""

    visible = alpha > ALPHA_BBOX_THRESHOLD
    current = Image.fromarray(np.uint8(visible) * 255, "L")
    depth = np.zeros(alpha.shape, dtype=np.uint8)
    unresolved = visible.copy()
    for value in range(1, max_depth + 1):
        eroded = np.asarray(current.filter(ImageFilter.MinFilter(3)), dtype=np.uint8) > 0
        ring = unresolved & ~eroded
        depth[ring] = value
        unresolved &= eroded
        if not np.any(unresolved):
            break
        current = Image.fromarray(np.uint8(eroded) * 255, "L")
    depth[unresolved] = max_depth + 1
    return depth


def _crop_edge_weight(alpha: np.ndarray) -> np.ndarray:
    """Weight editorial wash by proximity to the visible side or lower crop."""

    visible_y, visible_x = np.nonzero(alpha > ALPHA_BBOX_THRESHOLD)
    if not len(visible_x):
        raise ValueError("portrait has no visible alpha")
    left, right = int(visible_x.min()), int(visible_x.max()) + 1
    top, bottom = int(visible_y.min()), int(visible_y.max()) + 1
    height, width = alpha.shape
    yy, xx = np.indices(alpha.shape)
    side_band = max(1, round(width * 0.10))
    lower_band = max(1, round(height * 0.18))

    left_weight = np.clip((left + side_band - xx) / side_band, 0, 1)
    right_weight = np.clip((xx - (right - side_band - 1)) / side_band, 0, 1)
    side_weight = np.maximum(left_weight, right_weight)
    side_weight *= yy >= top + (bottom - top) * 0.30
    lower_weight = np.clip((yy - (bottom - lower_band - 1)) / lower_band, 0, 1)
    return np.maximum(side_weight, lower_weight) * (alpha > 0)


def _lower_crop_weight(alpha: np.ndarray) -> np.ndarray:
    """Return a short ramp over the final painted portion of the lower crop."""

    visible_y, visible_x = np.nonzero(alpha > ALPHA_BBOX_THRESHOLD)
    if not len(visible_x):
        raise ValueError("portrait has no visible alpha")
    bottom = int(visible_y.max()) + 1
    band = max(1, round(alpha.shape[0] * 0.08))
    yy = np.indices(alpha.shape)[0]
    return np.clip((yy - (bottom - band - 1)) / band, 0, 1) * (alpha > 0)


def _paper_white_crop_score(
    rgba: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Score tinted or neutral whitewash relative to the adjacent material."""

    alpha = rgba[..., 3]
    crop_zone = _crop_zone(alpha)
    broad_target = (alpha > 0) & crop_zone
    rgb = rgba[..., :3].astype(np.float32)
    local_color = _local_subject_color(
        rgb,
        alpha,
        broad_target,
        blur_radius=max(48, round(min(alpha.shape) * 0.08)),
    )

    minimum = rgb.min(axis=2)
    maximum = np.maximum(rgb.max(axis=2), 1)
    saturation = (rgb.max(axis=2) - minimum) / maximum
    local_minimum = local_color.min(axis=2)
    local_maximum = np.maximum(local_color.max(axis=2), 1)
    local_saturation = (local_color.max(axis=2) - local_minimum) / local_maximum
    luminance = rgb.mean(axis=2)
    local_luminance = local_color.mean(axis=2)
    luminance_excess = np.clip((luminance - local_luminance - 4) / 54, 0, 1)
    paper_score = np.clip((minimum - 78) / 145, 0, 1) * np.clip(
        (0.78 - saturation) / 0.68,
        0,
        1,
    )
    relative_light = np.clip((luminance - local_luminance - 6) / 72, 0, 1)
    relative_desaturation = np.clip(
        (local_saturation - saturation + 0.04) / 0.32,
        0,
        1,
    )
    whitewash_score = np.maximum(
        paper_score * luminance_excess,
        relative_light * relative_desaturation,
    )
    return crop_zone, whitewash_score, local_color


def _local_subject_color(
    colors: np.ndarray,
    alpha: np.ndarray,
    target: np.ndarray,
    blur_radius: int | None = None,
) -> np.ndarray:
    """Estimate material color from opaque non-target pixels around the crop."""

    weight = ((alpha >= 224) & ~target).astype(np.float32)
    weight_u8 = np.uint8(np.clip(weight * 255, 0, 255))
    blur_radius = blur_radius or max(1, round(min(alpha.shape) * 0.019))
    blurred_weight = np.asarray(
        Image.fromarray(weight_u8, "L").filter(ImageFilter.GaussianBlur(blur_radius)),
        dtype=np.float32,
    ) / 255
    result = colors.astype(np.float32).copy()
    usable = blurred_weight > 0.001
    for channel in range(3):
        weighted_channel = np.uint8(
            np.clip(colors[..., channel].astype(np.float32) * weight, 0, 255)
        )
        blurred_channel = np.asarray(
            Image.fromarray(weighted_channel, "L").filter(ImageFilter.GaussianBlur(blur_radius)),
            dtype=np.float32,
        )
        result[..., channel][usable] = blurred_channel[usable] / blurred_weight[usable]
    return result


def _effective_crop_whitewash_score(
    rgba: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Combine relative edge wash with absolute paper paint at the lower crop."""

    alpha = rgba[..., 3]
    crop_zone, relative_score, local_colors = _paper_white_crop_score(rgba)
    boundary_depth = _boundary_depth(alpha)
    alpha_boundary_weight = np.clip((49 - boundary_depth) / 48, 0, 1) ** 0.65
    boundary_weight = np.maximum(alpha_boundary_weight, _crop_edge_weight(alpha))

    rgb = rgba[..., :3].astype(np.float32)
    minimum = rgb.min(axis=2)
    maximum = np.maximum(rgb.max(axis=2), 1)
    saturation = (rgb.max(axis=2) - minimum) / maximum
    absolute_paper = np.clip((minimum - 96) / 124, 0, 1) * np.clip(
        (0.52 - saturation) / 0.44,
        0,
        1,
    )
    lower_paper = absolute_paper * np.sqrt(_lower_crop_weight(alpha))
    score = np.maximum(relative_score * boundary_weight, lower_paper)
    return score * crop_zone, local_colors


def _legacy_alpha(alpha_float: np.ndarray) -> np.ndarray:
    """Narrow soft generated coverage to the legacy cutout antialias range."""

    crisp = np.clip(
        (alpha_float - ALPHA_CRISP_LOW) / (ALPHA_CRISP_HIGH - ALPHA_CRISP_LOW),
        0,
        1,
    )
    crisp = crisp * crisp * (3 - 2 * crisp)
    return np.uint8(np.round(crisp * 255))


def remove_paper_white_cutoff(image: Image.Image) -> Image.Image:
    """Replace broad painted crop haze with a crisp legacy-style alpha edge.

    Generated watercolor edges can contain opaque neutral or tinted whitewash.
    Against Solitaire's dark field it reads as a spectral clothing cutoff. The
    correction measures brightness and desaturation relative to adjacent material,
    contracts only the lower/outer painted haze, then narrows antialiasing to match
    the clean legacy character cutouts. Faces, hands, top hair, and central equipment
    remain outside the correction zone.
    """

    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    alpha = rgba[..., 3]
    rgb = rgba[..., :3]
    whitewash_score, local_colors = _effective_crop_whitewash_score(rgba)
    target = (alpha > 0) & (whitewash_score >= 0.02)
    if not np.any(target):
        whitewash_score = np.zeros(alpha.shape, dtype=np.float32)

    rgb_float = rgb.astype(np.float32)
    mix = np.clip(whitewash_score * 1.15, 0, 1)[..., None]
    rgb_float[target] = (
        rgb_float[target] * (1 - mix[target]) + local_colors[target] * mix[target]
    )
    alpha_float = alpha.astype(np.float32)
    alpha_float *= 1 - np.clip(whitewash_score * 4.0, 0, 0.99)
    rgba[..., :3] = np.uint8(np.clip(rgb_float, 0, 255))
    rgba[..., 3] = _legacy_alpha(alpha_float)
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def finish_lower_crop(image: Image.Image) -> Image.Image:
    """Give lower garments one clean fade before the combat HUD overlap."""

    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    alpha_float = rgba[..., 3].astype(np.float32)
    lower_weight = _lower_crop_weight(rgba[..., 3])
    lower_matte = np.clip((0.82 - lower_weight) / 0.50, 0, 1) ** 1.7
    rgba[..., 3] = _legacy_alpha(alpha_float * lower_matte)
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def alpha_bbox(image: Image.Image, threshold: int = ALPHA_BBOX_THRESHOLD) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A").point(lambda value: 255 if value > threshold else 0)
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("portrait has no visible alpha")
    return bbox


def source_clearance_ratios(image: Image.Image) -> dict[str, float]:
    """Measure the authored matte border before canonical geometry scaling."""

    left, top, right, _bottom = alpha_bbox(image)
    width, height = image.size
    return {
        "top": round(top / height, 4),
        "left": round(left / width, 4),
        "right": round((width - right) / width, 4),
    }


def validate_source_clearance(ratios: dict[str, float]) -> None:
    """Reject sources clipped at the top or either side before padding can hide it."""

    if ratios["top"] < MIN_SOURCE_TOP_CLEARANCE_RATIO:
        raise ValueError(
            "source subject lacks top matte clearance: "
            f"{ratios['top']} < {MIN_SOURCE_TOP_CLEARANCE_RATIO}"
        )
    for side in ("left", "right"):
        if ratios[side] < MIN_SOURCE_SIDE_CLEARANCE_RATIO:
            raise ValueError(
                f"source subject lacks {side} matte clearance: "
                f"{ratios[side]} < {MIN_SOURCE_SIDE_CLEARANCE_RATIO}"
            )


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


def normalize_geometry(
    image: Image.Image,
    *,
    allow_bottom_crop_for_width: bool = False,
) -> Image.Image:
    bbox = alpha_bbox(image)
    subject = image.crop(bbox)
    source_width, source_height = subject.size
    target_height = round(CANVAS_SIZE[1] * TARGET_HEIGHT_RATIO)
    scale = target_height / source_height
    target_width = round(source_width * scale)
    maximum_width = round(CANVAS_SIZE[0] * MAX_TARGET_WIDTH_RATIO)
    if target_width > maximum_width:
        scale = maximum_width / source_width
        target_width = maximum_width
        target_height = round(source_height * scale)
    minimum_width = round(CANVAS_SIZE[0] * MIN_TARGET_WIDTH_RATIO)
    maximum_height = round(CANVAS_SIZE[1] * MAX_TARGET_HEIGHT_RATIO)
    if target_width < minimum_width:
        minimum_scale = minimum_width / source_width
        minimum_height = round(source_height * minimum_scale)
        if minimum_height <= maximum_height or allow_bottom_crop_for_width:
            # Scale uniformly: narrow authored silhouettes become readable
            # without the horizontal widening that distorted earlier assets.
            # With the explicit crop option, excess height may cross only the
            # authorized bottom edge; the fixed top placement and width cap
            # preserve the face, upper silhouette, and top/side clearances.
            scale = minimum_scale
            target_width = minimum_width
            target_height = minimum_height
    subject = resize_premultiplied(subject, (target_width, target_height))
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    left = (CANVAS_SIZE[0] - target_width) // 2
    top = round(CANVAS_SIZE[1] * TARGET_TOP)
    canvas.alpha_composite(subject, (left, top))
    rgba = np.asarray(canvas, dtype=np.uint8).copy()
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def metrics(
    image: Image.Image,
    checker_period: int | None,
    matte_color: list[int] | None = None,
    source_clearance: dict[str, float] | None = None,
) -> dict[str, object]:
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
    chroma_fringe_pixels = 0
    if matte_color is not None:
        matte = np.asarray(matte_color, dtype=np.float32)
        key_excess, _ = _matte_excess(rgba[..., :3].astype(np.float32), matte)
        near_transparent = np.asarray(
            Image.fromarray((alpha == 0).astype(np.uint8) * 255, "L").filter(
                ImageFilter.MaxFilter(21)
            ),
            dtype=np.uint8,
        ) > 0
        chroma_fringe_pixels = int(
            np.count_nonzero((alpha > 0) & near_transparent & (key_excess > 52))
        )
    whitewash_score, _ = _effective_crop_whitewash_score(rgba)
    paper_white_crop = (alpha > 0) & (whitewash_score >= 0.36)
    visible_pixels = int(np.count_nonzero(alpha > 0))
    semitransparent_pixels = int(np.count_nonzero((alpha > 0) & (alpha < 255)))
    return {
        "size": [width, height],
        "checkerPeriod": checker_period,
        "matteColor": matte_color,
        "sourceClearanceRatios": source_clearance,
        "alphaExtrema": [int(alpha.min()), int(alpha.max())],
        "transparentPixels": int(np.sum(alpha == 0)),
        "semiTransparentPixels": semitransparent_pixels,
        "semiTransparentVisibleRatio": round(
            semitransparent_pixels / max(visible_pixels, 1),
            4,
        ),
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
        "chromaFringePixels": chroma_fringe_pixels,
        "paperWhiteCropPixels": int(np.count_nonzero(paper_white_crop)),
    }


def validate_contract(report: dict[str, object]) -> None:
    ratios = report["bboxRatios"]
    if report["size"] != list(CANVAS_SIZE):
        raise ValueError(f"expected {CANVAS_SIZE[0]}x{CANVAS_SIZE[1]} output")
    if not 0.68 <= ratios["width"] <= 0.95:
        raise ValueError(f"alpha width ratio out of contract: {ratios['width']}")
    if not 0.87 <= ratios["height"] <= 0.94:
        raise ValueError(f"alpha height ratio out of contract: {ratios['height']}")
    if any(report["cornerAlpha"]):
        raise ValueError("portrait corners must be transparent")
    if any(report["edgeAlphaPixels"].values()):
        raise ValueError(f"portrait touches canvas edge: {report['edgeAlphaPixels']}")
    if report["paleLowAlphaFringePixels"] > MAX_PALE_LOW_ALPHA_FRINGE_PIXELS:
        raise ValueError(
            "pale low-alpha crop fringe exceeds contract: "
            f"{report['paleLowAlphaFringePixels']} > "
            f"{MAX_PALE_LOW_ALPHA_FRINGE_PIXELS}"
        )
    if report["chromaFringePixels"] > MAX_CHROMA_FRINGE_PIXELS:
        raise ValueError(
            "key-color fringe exceeds contract: "
            f"{report['chromaFringePixels']} > {MAX_CHROMA_FRINGE_PIXELS}"
        )
    if report["semiTransparentVisibleRatio"] > MAX_SEMITRANSPARENT_VISIBLE_RATIO:
        raise ValueError(
            "alpha fringe is broader than the legacy cutout contract: "
            f"{report['semiTransparentVisibleRatio']} > "
            f"{MAX_SEMITRANSPARENT_VISIBLE_RATIO}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    recovery = parser.add_mutually_exclusive_group()
    recovery.add_argument(
        "--recover-light-checker",
        action="store_true",
        help="recover alpha from an opaque light checker before normalization",
    )
    recovery.add_argument(
        "--recover-chroma-matte",
        action="store_true",
        help="recover alpha from a uniform high-chroma matte before normalization",
    )
    parser.add_argument(
        "--allow-bottom-crop-for-width",
        action="store_true",
        help=(
            "uniformly scale an unusually tall, narrow subject to the minimum "
            "readable width and allow only excess lower clothing to cross the "
            "bottom crop"
        ),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    checker_period: int | None = None
    matte_color: list[int] | None = None
    source_clearance: dict[str, float] | None = None
    if args.recover_light_checker:
        source, checker_period = recover_light_checker(source)
    elif args.recover_chroma_matte:
        source, matte_color = recover_chroma_matte(source)
        source_clearance = source_clearance_ratios(source)
        validate_source_clearance(source_clearance)
    elif source.getchannel("A").getextrema() == (255, 255):
        raise ValueError(
            "opaque source requires --recover-chroma-matte or --recover-light-checker"
        )

    normalized = normalize_geometry(
        source,
        allow_bottom_crop_for_width=args.allow_bottom_crop_for_width,
    )
    if not args.recover_chroma_matte:
        for _ in range(PAPER_WHITE_CLEANUP_PASSES):
            normalized = remove_paper_white_cutoff(normalized)
        normalized = normalize_geometry(
            normalized,
            allow_bottom_crop_for_width=args.allow_bottom_crop_for_width,
        )
    normalized = finish_lower_crop(normalized)
    if matte_color is not None:
        normalized = decontaminate_chroma_fringe(
            normalized,
            np.asarray(matte_color, dtype=np.float32),
        )
    report = metrics(
        normalized,
        checker_period,
        matte_color=matte_color,
        source_clearance=source_clearance,
    )
    validate_contract(report)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    normalized.save(args.output, "PNG", optimize=True)
    report["sha256"] = hashlib.sha256(args.output.read_bytes()).hexdigest()
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
