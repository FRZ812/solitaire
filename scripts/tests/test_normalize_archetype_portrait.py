"""Regression tests for the archetype portrait normalization pipeline."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


SCRIPT_PATH = Path(__file__).parents[1] / "normalize-archetype-portrait.py"
SPEC = importlib.util.spec_from_file_location("normalize_archetype_portrait", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - import setup guard
    raise RuntimeError(f"could not load {SCRIPT_PATH}")
portrait = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(portrait)


def synthetic_checker(period: int = 48, size: tuple[int, int] = (768, 768)) -> Image.Image:
    """Return a deterministic light, non-divisible checker-like source field."""

    rng = np.random.default_rng(812)
    tile = rng.integers(224, 249, size=(period, period), dtype=np.uint8)
    height, width = size[1], size[0]
    yy, xx = np.indices((height, width))
    rgb = np.repeat(tile[yy % period, xx % period, None], 3, axis=2)
    return Image.fromarray(rgb, "RGB")


class PortraitNormalizationTests(unittest.TestCase):
    def test_infers_full_checker_period(self) -> None:
        source = np.asarray(synthetic_checker().convert("RGB"), dtype=np.float32)

        self.assertEqual(portrait.infer_checker_period(source), 48)

    def test_recovers_subject_alpha_from_baked_light_checker(self) -> None:
        source = synthetic_checker()
        draw = ImageDraw.Draw(source)
        draw.ellipse((270, 205, 498, 710), fill=(36, 43, 58))

        recovered, period = portrait.recover_light_checker(source)
        alpha = np.asarray(recovered.getchannel("A"), dtype=np.uint8)

        self.assertEqual(period, 48)
        self.assertEqual(int(alpha[0, 0]), 0)
        self.assertGreaterEqual(int(alpha[384, 384]), 250)
        self.assertIsNotNone(recovered.getchannel("A").getbbox())

    def test_normalize_geometry_meets_canonical_contract(self) -> None:
        source = Image.new("RGBA", (512, 768), (0, 0, 0, 0))
        ImageDraw.Draw(source).rounded_rectangle(
            (58, 67, 468, 735),
            radius=42,
            fill=(38, 52, 76, 255),
        )

        normalized = portrait.normalize_geometry(source)
        report = portrait.metrics(normalized, checker_period=None)

        portrait.validate_contract(report)
        self.assertEqual(normalized.size, portrait.CANVAS_SIZE)
        self.assertEqual(report["cornerAlpha"], [0, 0, 0, 0])
        self.assertEqual(
            report["edgeAlphaPixels"],
            {"top": 0, "right": 0, "bottom": 0, "left": 0},
        )

    def test_premultiplied_resize_zeros_hidden_rgb(self) -> None:
        source = Image.new("RGBA", (8, 8), (250, 250, 250, 0))
        source.putpixel((3, 3), (12, 34, 56, 255))

        resized = np.asarray(portrait.resize_premultiplied(source, (32, 32)), dtype=np.uint8)
        transparent = resized[..., 3] == 0

        self.assertTrue(np.all(resized[transparent, :3] == 0))
        self.assertGreater(int(resized[..., 3].max()), 0)

    def test_removes_paper_white_crop_without_eroding_inboard_material(self) -> None:
        source = Image.new("RGBA", portrait.CANVAS_SIZE, (0, 0, 0, 0))
        draw = ImageDraw.Draw(source)
        draw.rectangle((100, 80, 860, 1250), fill=(37, 49, 63, 255))
        draw.rectangle((100, 650, 150, 1180), fill=(226, 217, 205, 255))
        draw.rectangle((180, 1130, 780, 1250), fill=(220, 213, 204, 255))
        draw.ellipse((680, 520, 760, 610), fill=(226, 190, 164, 255))

        cleaned = portrait.remove_paper_white_cutoff(source)
        alpha = np.asarray(cleaned.getchannel("A"), dtype=np.uint8)

        self.assertLess(int(alpha[900, 120]), 96)
        self.assertLess(int(alpha[1200, 400]), 96)
        self.assertEqual(int(alpha[565, 720]), 255)
        self.assertEqual(int(alpha[500, 400]), 255)
        self.assertTrue(np.all(np.asarray(cleaned)[alpha == 0, :3] == 0))

    def test_rejects_excess_paper_white_crop_paint(self) -> None:
        source = Image.new("RGBA", portrait.CANVAS_SIZE, (0, 0, 0, 0))
        ImageDraw.Draw(source).rectangle((77, 77, 882, 1254), fill=(37, 49, 63, 255))
        report = portrait.metrics(source, checker_period=None)
        report["paperWhiteCropPixels"] = portrait.MAX_PAPER_WHITE_CROP_PIXELS + 1

        with self.assertRaisesRegex(ValueError, "paper-white crop paint exceeds contract"):
            portrait.validate_contract(report)


if __name__ == "__main__":
    unittest.main()
