"""Build the Codex portrait atlases from individually authored portraits."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PORTRAIT_ROOT = ROOT / "src" / "assets" / "generated" / "character-portraits"
INDIVIDUAL_ROOT = PORTRAIT_ROOT / "codex-individual"
IMPORTANT_ATLAS = PORTRAIT_ROOT / "codex-important-atlas-v1.png"
SUCCESSOR_ATLAS = PORTRAIT_ROOT / "codex-successors-atlas-v1.png"

ATLAS_SIZE = 1254
DIVIDER_COLOR = (5, 20, 38)
DIVIDER_WIDTH = 4

IMPORTANT = (
    "demon-king",
    "vale-king-asar",
    "goblin-king",
    "selenyan-speaker",
    "glass-spire-master",
    "great-wyrm",
    "hawthorn-lord",
    "witch-queen",
    "crowsmoor-baron",
    "whitemarch-treasurer",
    "cinder-chapter-master",
    "stonebrook-hold-father",
    "halfborn-matriarch",
    "heron-master",
    "the-hag",
    "king-of-three",
)

SUCCESSORS = {
    (0, 0): "vale-king-asar-vi",
    (1, 0): "halfborn-matriarch-elect-brann",
    (2, 0): "stonebrook-hold-father-korro",
    (0, 1): "whitemarch-treasurer-halen",
    (2, 1): "cinder-chapter-master-tovar",
    (0, 2): "crowsmoor-baron-heir",
    (1, 2): "heron-master-apprentice",
}

SUCCESSOR_SEALS = ((1, 1), (2, 2))


def bounds(index: int, count: int) -> tuple[int, int]:
    """Return stable integer cell bounds for a dimension of ATLAS_SIZE."""
    start = int(index * ATLAS_SIZE / count + 0.5)
    end = int((index + 1) * ATLAS_SIZE / count + 0.5)
    return start, end


def load_portrait(name: str) -> Image.Image:
    path = INDIVIDUAL_ROOT / f"{name}.png"
    if not path.is_file():
        raise FileNotFoundError(f"Missing Codex portrait: {path}")
    return Image.open(path).convert("RGB")


def fitted_portrait(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    # Top-biased cover keeps hair, ears, crowns, and horns inside all UI crops.
    return ImageOps.fit(
        source,
        size,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.0),
    )


def write_webp_sources() -> None:
    for name in (*IMPORTANT, *SUCCESSORS.values()):
        portrait = fitted_portrait(load_portrait(name), (768, 960))
        portrait.save(INDIVIDUAL_ROOT / f"{name}.webp", "WEBP", quality=92, method=6)


def draw_grid(image: Image.Image, count: int) -> None:
    draw = ImageDraw.Draw(image)
    for index in range(1, count):
        edge, _ = bounds(index, count)
        draw.line(
            (edge, 0, edge, ATLAS_SIZE),
            fill=DIVIDER_COLOR,
            width=DIVIDER_WIDTH,
        )
        draw.line(
            (0, edge, ATLAS_SIZE, edge),
            fill=DIVIDER_COLOR,
            width=DIVIDER_WIDTH,
        )
    draw.rectangle(
        (0, 0, ATLAS_SIZE - 1, ATLAS_SIZE - 1),
        outline=DIVIDER_COLOR,
        width=DIVIDER_WIDTH,
    )


def build_important_atlas() -> None:
    atlas = Image.new("RGB", (ATLAS_SIZE, ATLAS_SIZE), DIVIDER_COLOR)
    for index, name in enumerate(IMPORTANT):
        column, row = index % 4, index // 4
        left, right = bounds(column, 4)
        top, bottom = bounds(row, 4)
        atlas.paste(fitted_portrait(load_portrait(name), (right - left, bottom - top)), (left, top))
    draw_grid(atlas, 4)
    atlas.save(IMPORTANT_ATLAS, "PNG", optimize=True)


def build_successor_atlas() -> None:
    if not SUCCESSOR_ATLAS.is_file():
        raise FileNotFoundError(
            "The existing successor atlas is required to preserve its heraldic cells."
        )

    previous = Image.open(SUCCESSOR_ATLAS).convert("RGB")
    if previous.size != (ATLAS_SIZE, ATLAS_SIZE):
        raise ValueError(f"Unexpected successor atlas dimensions: {previous.size}")

    preserved_seals: dict[tuple[int, int], Image.Image] = {}
    for column, row in SUCCESSOR_SEALS:
        left, right = bounds(column, 3)
        top, bottom = bounds(row, 3)
        preserved_seals[(column, row)] = previous.crop((left, top, right, bottom))

    atlas = Image.new("RGB", (ATLAS_SIZE, ATLAS_SIZE), DIVIDER_COLOR)
    for row in range(3):
        for column in range(3):
            left, right = bounds(column, 3)
            top, bottom = bounds(row, 3)
            name = SUCCESSORS.get((column, row))
            if name:
                cell = fitted_portrait(load_portrait(name), (right - left, bottom - top))
            else:
                cell = preserved_seals[(column, row)].resize(
                    (right - left, bottom - top), Image.Resampling.LANCZOS
                )
            atlas.paste(cell, (left, top))

    draw_grid(atlas, 3)
    atlas.save(SUCCESSOR_ATLAS, "PNG", optimize=True)


def main() -> None:
    INDIVIDUAL_ROOT.mkdir(parents=True, exist_ok=True)
    write_webp_sources()
    build_important_atlas()
    build_successor_atlas()


if __name__ == "__main__":
    main()
