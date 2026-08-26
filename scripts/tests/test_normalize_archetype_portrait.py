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


def synthetic_chroma(
    matte: tuple[int, int, int] = (0, 255, 0),
    size: tuple[int, int] = (768, 1024),
) -> Image.Image:
    """Return an opaque keyed portrait source with a softly antialiased edge."""

    source = Image.new("RGB", size, matte)
    subject = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(subject)
    draw.rounded_rectangle(
        (104, 82, 664, 1008),
        radius=86,
        fill=(45, 52, 66, 255),
    )
    subject = subject.filter(portrait.ImageFilter.GaussianBlur(0.6))
    source.paste(subject.convert("RGB"), mask=subject.getchannel("A"))
    return source


class PortraitNormalizationTests(unittest.TestCase):
    def test_recovers_subject_alpha_from_green_chroma_matte(self) -> None:
        recovered, matte = portrait.recover_chroma_matte(synthetic_chroma())
        alpha = np.asarray(recovered.getchannel("A"), dtype=np.uint8)
        rgba = np.asarray(recovered, dtype=np.uint8)

        self.assertEqual(matte, [0, 255, 0])
        self.assertEqual(int(alpha[0, 0]), 0)
        self.assertGreaterEqual(int(alpha[512, 384]), 250)
        self.assertTrue(np.all(rgba[alpha == 0, :3] == 0))
        normalized = portrait.finish_lower_crop(portrait.normalize_geometry(recovered))
        report = portrait.metrics(normalized, checker_period=None, matte_color=matte)
        self.assertLessEqual(
            report["chromaFringePixels"],
            portrait.MAX_CHROMA_FRINGE_PIXELS,
        )

    def test_recovers_subject_alpha_from_magenta_chroma_matte(self) -> None:
        recovered, matte = portrait.recover_chroma_matte(
            synthetic_chroma(matte=(255, 0, 255))
        )
        alpha = np.asarray(recovered.getchannel("A"), dtype=np.uint8)

        self.assertEqual(matte, [255, 0, 255])
        self.assertEqual(int(alpha[0, 0]), 0)
        self.assertGreaterEqual(int(alpha[512, 384]), 250)

    def test_rejects_chroma_source_without_side_clearance(self) -> None:
        source = Image.new("RGBA", (512, 768), (0, 0, 0, 0))
        ImageDraw.Draw(source).rectangle((0, 40, 500, 767), fill=(42, 48, 60, 255))
        ratios = portrait.source_clearance_ratios(source)

        with self.assertRaisesRegex(ValueError, "left matte clearance"):
            portrait.validate_source_clearance(ratios)

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
        source_bbox = portrait.alpha_bbox(source)
        normalized_bbox = portrait.alpha_bbox(normalized)
        source_ratio = (source_bbox[2] - source_bbox[0]) / (source_bbox[3] - source_bbox[1])
        normalized_ratio = (normalized_bbox[2] - normalized_bbox[0]) / (
            normalized_bbox[3] - normalized_bbox[1]
        )

        portrait.validate_contract(report)
        self.assertEqual(normalized.size, portrait.CANVAS_SIZE)
        self.assertAlmostEqual(normalized_ratio, source_ratio, delta=0.01)
        self.assertEqual(report["cornerAlpha"], [0, 0, 0, 0])
        self.assertEqual(
            report["edgeAlphaPixels"],
            {"top": 0, "right": 0, "bottom": 0, "left": 0},
        )

    def test_narrow_portrait_scales_uniformly_to_readable_width(self) -> None:
        source = Image.new("RGBA", (500, 800), (0, 0, 0, 0))
        ImageDraw.Draw(source).rectangle((55, 50, 443, 749), fill=(45, 52, 66, 255))
        source_bbox = portrait.alpha_bbox(source)
        source_ratio = (source_bbox[2] - source_bbox[0]) / (
            source_bbox[3] - source_bbox[1]
        )

        normalized = portrait.normalize_geometry(source)
        normalized_bbox = portrait.alpha_bbox(normalized)
        normalized_ratio = (normalized_bbox[2] - normalized_bbox[0]) / (
            normalized_bbox[3] - normalized_bbox[1]
        )

        self.assertGreaterEqual(
            (normalized_bbox[2] - normalized_bbox[0]) / portrait.CANVAS_SIZE[0],
            0.68,
        )
        self.assertAlmostEqual(normalized_ratio, source_ratio, delta=0.01)

    def test_tall_narrow_portrait_can_use_authorized_bottom_crop(self) -> None:
        source = Image.new("RGBA", (500, 900), (0, 0, 0, 0))
        ImageDraw.Draw(source).rectangle((105, 35, 394, 899), fill=(45, 52, 66, 255))

        normalized = portrait.finish_lower_crop(
            portrait.normalize_geometry(source, allow_bottom_crop_for_width=True)
        )
        report = portrait.metrics(normalized, checker_period=None)

        portrait.validate_contract(report)
        self.assertGreaterEqual(report["bboxRatios"]["width"], 0.68)
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

    def test_finishes_lower_crop_before_hud_overlap(self) -> None:
        source = Image.new("RGBA", portrait.CANVAS_SIZE, (0, 0, 0, 0))
        ImageDraw.Draw(source).rectangle((100, 80, 860, 1250), fill=(52, 61, 74, 255))

        finished = portrait.finish_lower_crop(source)
        alpha = np.asarray(finished.getchannel("A"), dtype=np.uint8)

        self.assertEqual(int(alpha[1160, 400]), 255)
        self.assertEqual(int(alpha[1240, 400]), 0)

    def test_rejects_pale_low_alpha_crop_fringe(self) -> None:
        source = Image.new("RGBA", portrait.CANVAS_SIZE, (0, 0, 0, 0))
        ImageDraw.Draw(source).rectangle((77, 77, 882, 1254), fill=(37, 49, 63, 255))
        report = portrait.metrics(source, checker_period=None)
        report["paleLowAlphaFringePixels"] = (
            portrait.MAX_PALE_LOW_ALPHA_FRINGE_PIXELS + 1
        )

        with self.assertRaisesRegex(ValueError, "pale low-alpha crop fringe exceeds contract"):
            portrait.validate_contract(report)

    def test_rejects_key_color_fringe(self) -> None:
        source = Image.new("RGBA", portrait.CANVAS_SIZE, (0, 0, 0, 0))
        ImageDraw.Draw(source).rectangle((77, 77, 882, 1254), fill=(37, 49, 63, 255))
        report = portrait.metrics(source, checker_period=None)
        report["chromaFringePixels"] = portrait.MAX_CHROMA_FRINGE_PIXELS + 1

        with self.assertRaisesRegex(ValueError, "key-color fringe exceeds contract"):
            portrait.validate_contract(report)

    def test_rejects_broad_semitransparent_fringe(self) -> None:
        source = Image.new("RGBA", portrait.CANVAS_SIZE, (0, 0, 0, 0))
        ImageDraw.Draw(source).rectangle((77, 77, 882, 1254), fill=(37, 49, 63, 255))
        report = portrait.metrics(source, checker_period=None)
        report["semiTransparentVisibleRatio"] = (
            portrait.MAX_SEMITRANSPARENT_VISIBLE_RATIO + 0.001
        )

        with self.assertRaisesRegex(ValueError, "alpha fringe is broader"):
            portrait.validate_contract(report)


if __name__ == "__main__":
    unittest.main()
