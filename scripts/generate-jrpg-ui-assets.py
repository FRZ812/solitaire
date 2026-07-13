"""Generate the custom 16-bit JRPG asset pack used by the game UI.

Run from the repository root:
    python scripts/generate-jrpg-ui-assets.py

The illustrations are deliberately built on a small pixel canvas and enlarged
with nearest-neighbour sampling. Regional scene plates are also colour-reduced
and re-sampled so every biome shares the same crisp console-era treatment.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets" / "generated"
SCALE = 3


def scale_and_save(image: Image.Image, name: str, scale: int = SCALE) -> Path:
    target = OUT / name
    image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST).save(target, optimize=True)
    return target


def vertical_gradient(size: tuple[int, int], stops: list[tuple[int, str]]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    stops = sorted(stops)
    for y in range(height):
        for index in range(len(stops) - 1):
            y0, c0 = stops[index]
            y1, c1 = stops[index + 1]
            if y0 <= y <= y1:
                break
        else:
            y0, c0 = stops[-1]
            y1, c1 = stops[-1]
        a = 0 if y1 == y0 else (y - y0) / (y1 - y0)
        rgb0 = tuple(int(c0[i : i + 2], 16) for i in (1, 3, 5))
        rgb1 = tuple(int(c1[i : i + 2], 16) for i in (1, 3, 5))
        color = tuple(round(rgb0[channel] * (1 - a) + rgb1[channel] * a) for channel in range(3))
        draw.line((0, y, width, y), fill=color)
    return image


def draw_mountains(draw: ImageDraw.ImageDraw, y: int, color: str, peaks: list[tuple[int, int]], width: int, bottom: int) -> None:
    points = [(0, bottom), (0, y)]
    for x, height in peaks:
        points.extend([(max(0, x - 18), y), (x, y - height), (min(width, x + 22), y)])
    points.extend([(width, y), (width, bottom)])
    draw.polygon(points, fill=color)


def generate_title() -> Path:
    random.seed(1601)
    w, h = 240, 426
    image = vertical_gradient((w, h), [(0, "#101b3b"), (150, "#29496b"), (250, "#b06d61"), (425, "#07101c")])
    draw = ImageDraw.Draw(image)

    # Star field and a single guiding star.
    for _ in range(54):
        x = random.randrange(8, w - 8)
        y = random.randrange(8, 166)
        shade = random.choice(["#d5d8d7", "#9eb8c2", "#f3dfa4"])
        draw.point((x, y), fill=shade)
        if random.random() > 0.86:
            draw.point((x + 1, y), fill=shade)
    draw.polygon([(184, 30), (186, 35), (191, 37), (186, 39), (184, 45), (182, 39), (177, 37), (182, 35)], fill="#ffe39a")
    draw.point((184, 37), fill="#fff7cf")

    # Layered mountain silhouettes and dawn rim light.
    draw_mountains(draw, 223, "#5a6d78", [(27, 46), (74, 72), (119, 50), (167, 84), (219, 55)], w, 340)
    draw_mountains(draw, 246, "#263f52", [(10, 34), (55, 68), (103, 46), (151, 73), (205, 51)], w, 352)
    draw.line((0, 246, w, 246), fill="#d58f67", width=1)

    # White citadel: tiny, readable 16-bit silhouette.
    city_y = 245
    draw.rectangle((88, city_y - 18, 158, city_y + 18), fill="#c9c9bd")
    draw.rectangle((99, city_y - 34, 113, city_y + 18), fill="#d8d5c5")
    draw.rectangle((130, city_y - 42, 144, city_y + 18), fill="#e2ddca")
    draw.rectangle((116, city_y - 25, 128, city_y + 18), fill="#bebfb6")
    draw.polygon([(99, city_y - 34), (106, city_y - 47), (113, city_y - 34)], fill="#d8d5c5")
    draw.polygon([(130, city_y - 42), (137, city_y - 58), (144, city_y - 42)], fill="#e2ddca")
    draw.rectangle((136, city_y - 10, 139, city_y + 4), fill="#e6ae58")
    for x in range(93, 155, 10):
        draw.rectangle((x, city_y - 11, x + 2, city_y - 7), fill="#e8ba68")
    draw.rectangle((82, city_y + 16, 165, city_y + 21), fill="#7e7165")

    # Mist bands deliberately blocky.
    for y, color in [(272, "#506373"), (287, "#354b5e"), (301, "#263b4e")]:
        points = [(0, y)]
        for x in range(0, w + 20, 20):
            points.append((x, y + random.randrange(-4, 5)))
        points += [(w, y + 22), (0, y + 22)]
        draw.polygon(points, fill=color)

    # Foreground pine silhouettes.
    draw.rectangle((0, 314, w, h), fill="#091524")
    for x, base, height in [(15, 346, 60), (34, 358, 82), (207, 355, 74), (228, 344, 58)]:
        draw.rectangle((x - 1, base - height // 3, x + 1, base), fill="#050d16")
        for dy, half in [(height, 4), (height - 12, 9), (height - 25, 13), (height - 40, 17)]:
            cy = base - dy + 18
            draw.polygon([(x, cy - 18), (x - half, cy + 12), (x + half, cy + 12)], fill="#07111b")

    # Winding gold-edged road.
    draw.polygon([(98, h), (145, h), (134, 367), (120, 329), (111, 306), (105, 306), (111, 335), (119, 372)], fill="#584b46")
    draw.line([(99, h), (111, 372), (110, 337), (104, 306)], fill="#c49a5a", width=2)
    draw.line([(145, h), (134, 367), (120, 329), (112, 306)], fill="#c49a5a", width=2)

    # Lone adventurer with cloak and sword.
    px, py = 118, 350
    draw.rectangle((px - 2, py - 14, px + 2, py - 10), fill="#c7a477")
    draw.rectangle((px - 3, py - 18, px + 3, py - 14), fill="#171924")
    draw.polygon([(px - 5, py - 11), (px + 5, py - 11), (px + 9, py + 13), (px - 9, py + 13)], fill="#293d52")
    draw.polygon([(px, py - 10), (px + 7, py + 13), (px - 1, py + 13)], fill="#3c5870")
    draw.line((px + 7, py - 6, px + 13, py + 10), fill="#bbc6c2", width=1)
    draw.point((px + 13, py + 10), fill="#f0d18b")

    # Pixel vignette, stepped rather than blurred.
    for inset, color in [(0, "#050a14"), (3, "#08101c"), (7, "#0a1422")]:
        draw.rectangle((inset, inset, w - 1 - inset, h - 1 - inset), outline=color, width=1)

    return scale_and_save(image, "jrpg-title-backdrop.png")


def generate_battle() -> Path:
    random.seed(1602)
    w, h = 240, 426
    image = vertical_gradient((w, h), [(0, "#07142b"), (185, "#123149"), (425, "#07111b")])
    draw = ImageDraw.Draw(image)

    # Moon and crisp beams.
    draw.ellipse((156, 24, 196, 64), fill="#b8ced0")
    draw.rectangle((169, 31, 194, 56), fill="#dce2d5")
    draw.polygon([(174, 60), (196, 60), (151, 319), (102, 319)], fill="#183a4c")

    # Distant trees.
    for x in range(-8, w + 12, 17):
        top = random.randrange(72, 128)
        draw.rectangle((x + 6, top + 20, x + 9, 293), fill="#0b2027")
        for y, half in [(top, 12), (top + 18, 17), (top + 38, 20)]:
            draw.polygon([(x + 7, y), (x - half + 7, y + 28), (x + half + 7, y + 28)], fill="#0c2630")

    # Ruined shrine columns and arch.
    stone_dark, stone, stone_light = "#344454", "#536474", "#7d8790"
    for x in (34, 186):
        draw.rectangle((x, 130, x + 21, 330), fill=stone_dark)
        draw.rectangle((x + 4, 130, x + 16, 330), fill=stone)
        draw.rectangle((x + 4, 132, x + 7, 328), fill=stone_light)
        draw.rectangle((x - 4, 126, x + 25, 135), fill=stone_dark)
        draw.rectangle((x - 2, 127, x + 23, 130), fill=stone_light)
    draw.arc((45, 84, 207, 246), 180, 360, fill=stone, width=13)
    draw.arc((49, 89, 203, 240), 180, 360, fill=stone_light, width=3)
    draw.polygon([(73, 113), (95, 100), (109, 108), (123, 95), (148, 105), (169, 95), (190, 116)], fill=stone_dark)

    # Moss blocks.
    for _ in range(48):
        x = random.choice(list(range(33, 57)) + list(range(185, 210)))
        y = random.randrange(135, 325)
        draw.rectangle((x, y, x + random.randrange(1, 4), y + 1), fill=random.choice(["#375b46", "#4f7450", "#718552"]))

    # Battle ground tiles, intentionally quiet in the center.
    draw.polygon([(0, 310), (240, 286), (240, 426), (0, 426)], fill="#0b1922")
    for y in range(318, 426, 18):
        draw.line((0, y, w, y - 18), fill="#172833")
    for x in range(-20, 270, 32):
        draw.line((x, 304, x + 24, h), fill="#12232e")

    # Braziers at the edges.
    for x in (23, 216):
        draw.rectangle((x - 7, 291, x + 7, 295), fill="#6b4937")
        draw.rectangle((x - 4, 295, x + 4, 311), fill="#3a3130")
        draw.rectangle((x - 1, 311, x + 1, 324), fill="#2a2729")
        draw.polygon([(x - 5, 291), (x, 277), (x + 5, 291)], fill="#dc6f3e")
        draw.polygon([(x - 2, 290), (x + 1, 281), (x + 3, 291)], fill="#ffd36a")
        draw.rectangle((x - 11, 274, x + 11, 302), outline="#a44e35", width=1)

    # Pixel border and floor foreground.
    draw.rectangle((0, 0, w - 1, h - 1), outline="#050914", width=3)
    draw.line((0, 421, w, 421), fill="#5a3e35", width=2)
    return scale_and_save(image, "jrpg-battle-backdrop.png")


def generate_atlas() -> Path:
    random.seed(1603)
    size = 256
    image = Image.new("RGB", (size, size), "#0b2138")
    draw = ImageDraw.Draw(image)

    # Tiny ocean dither.
    for _ in range(1800):
        x, y = random.randrange(size), random.randrange(size)
        draw.point((x, y), fill=random.choice(["#0d2940", "#11334a", "#174158"]))

    # Abstract landmasses (no labels; map UI supplies all waypoints).
    land = [(22, 71), (47, 34), (86, 44), (109, 72), (137, 58), (172, 76), (207, 67), (232, 97), (220, 133), (236, 171), (205, 211), (161, 224), (122, 201), (83, 218), (48, 190), (27, 147)]
    draw.polygon(land, fill="#355c49", outline="#d0a65d")
    draw.line(land + [land[0]], fill="#6d8058", width=2)

    # Biome patches.
    draw.polygon([(32, 80), (75, 48), (108, 77), (85, 122), (44, 119)], fill="#416b4d")
    draw.polygon([(117, 73), (173, 70), (206, 96), (179, 132), (130, 118)], fill="#53694b")
    draw.polygon([(54, 140), (115, 123), (153, 159), (122, 203), (72, 194)], fill="#6d6247")
    draw.polygon([(160, 139), (217, 126), (224, 171), (191, 211), (144, 190)], fill="#3f5c5a")

    # Mountains and forests.
    for _ in range(34):
        x, y = random.randrange(48, 212), random.randrange(70, 197)
        if image.getpixel((x, y))[1] < 60:
            continue
        if random.random() < 0.5:
            draw.polygon([(x, y - 4), (x - 4, y + 3), (x + 4, y + 3)], fill="#8c8872")
            draw.point((x, y - 3), fill="#d4c69e")
        else:
            draw.polygon([(x, y - 4), (x - 3, y + 3), (x + 3, y + 3)], fill="#183b33")

    # Roads and river.
    draw.line([(42, 107), (83, 132), (118, 113), (154, 151), (204, 165)], fill="#4b392d", width=4)
    draw.line([(42, 107), (83, 132), (118, 113), (154, 151), (204, 165)], fill="#d3a857", width=1)
    draw.line([(91, 55), (100, 86), (95, 119), (113, 151), (108, 197)], fill="#4c9aac", width=3)
    draw.point((101, 87), fill="#a1d1c8")

    # Compass rose.
    cx, cy = 222, 29
    draw.ellipse((cx - 15, cy - 15, cx + 15, cy + 15), outline="#b99456")
    draw.polygon([(cx, cy - 13), (cx + 3, cy), (cx, cy + 13), (cx - 3, cy)], fill="#d5b66f")
    draw.polygon([(cx - 13, cy), (cx, cy - 3), (cx + 13, cy), (cx, cy + 3)], fill="#7d603d")
    draw.rectangle((2, 2, size - 3, size - 3), outline="#6d5639", width=2)
    return scale_and_save(image, "jrpg-atlas-texture.png")


def generate_pattern() -> Path:
    image = Image.new("RGB", (16, 16), "#0a1626")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 15, 15), outline="#101f33")
    draw.line((0, 15, 15, 0), fill="#0d1b2e")
    draw.point((3, 4), fill="#20314a")
    draw.point((12, 11), fill="#182b42")
    target = OUT / "jrpg-ui-pattern.png"
    image.save(target, optimize=True)
    return target


def pixelate_regional_scenes() -> list[Path]:
    outputs: list[Path] = []
    for source in sorted(OUT.glob("scene-*-v2.webp")):
        target = source.with_name(source.stem.replace("-v2", "-pixel") + ".webp")
        image = Image.open(source).convert("RGB")
        image = ImageEnhance.Color(image).enhance(1.08)
        image = ImageEnhance.Contrast(image).enhance(1.07)
        small = image.resize((235, 418), Image.Resampling.LANCZOS)
        # A fixed adaptive palette makes broad shapes read like hand-authored tiles.
        reduced = small.quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
        enlarged = reduced.resize(image.size, Image.Resampling.NEAREST)
        enlarged.save(target, "WEBP", lossless=True, method=6)
        outputs.append(target)
    return outputs


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    outputs = [generate_title(), generate_battle(), generate_atlas(), generate_pattern()]
    outputs.extend(pixelate_regional_scenes())
    print(f"Generated {len(outputs)} JRPG assets:")
    for path in outputs:
        print(f"  {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
