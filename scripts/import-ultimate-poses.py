"""Pack one generated four-pose ultimate sheet into 4×192 combat atlas.

Usage: python3 scripts/import-ultimate-poses.py <character-id> <source-image>

The four main bodies must be separate alpha-connected shapes. Detached fists,
swords and other fragments are grouped with the nearest body by x position.
This avoids slicing long limbs at fixed quarter-sheet boundaries and fails
when the four main bodies cannot be identified safely.
"""
from collections import deque
from pathlib import Path
import argparse

from PIL import Image, ImageChops, ImageFilter


CELL = 192
ROOT = Path(__file__).resolve().parents[1]


def components(alpha: Image.Image) -> list[tuple[int, tuple[int, int, int, int], Image.Image]]:
    width, height = alpha.size
    values = alpha.tobytes()
    seen = bytearray(width * height)
    found = []
    for start, value in enumerate(values):
        if value < 100 or seen[start]:
            continue
        queue = deque([start])
        seen[start] = 1
        pixels = []
        left, top, right, bottom = width, height, 0, 0
        while queue:
            index = queue.popleft()
            pixels.append(index)
            x, y = index % width, index // width
            left, top = min(left, x), min(top, y)
            right, bottom = max(right, x + 1), max(bottom, y + 1)
            for other in (index - 1, index + 1, index - width, index + width):
                if (0 <= other < width * height and not seen[other]
                        and values[other] >= 100 and abs(other % width - x) <= 1):
                    seen[other] = 1
                    queue.append(other)
        if len(pixels) >= 1500:
            mask = Image.new("L", (width, height))
            mask_values = bytearray(width * height)
            for index in pixels:
                mask_values[index] = 255
            mask.frombytes(bytes(mask_values))
            # Retain the original antialias edge around this component.
            mask = ImageChops.multiply(mask.filter(ImageFilter.MaxFilter(5)), alpha)
            found.append((len(pixels), (left, top, right, bottom), mask))
    return sorted(found, key=lambda item: item[0], reverse=True)


def pack(source: Path, destination: Path) -> None:
    image = Image.open(source).convert("RGBA")
    base_path = ROOT / "public/art/characters" / f"{destination.stem}.png"
    base = Image.open(base_path).convert("RGBA")
    if base.size != (CELL * 4, CELL):
        raise ValueError(f"Unexpected base atlas dimensions in {base_path}")
    pieces = components(image.getchannel("A"))
    if len(pieces) < 4:
        raise ValueError(f"Expected four separate poses; found {len(pieces)} in {source}")
    # Hands, swords and elastic fists can be disconnected from a body. Keep the
    # four largest silhouettes as anchors and group smaller pieces by x position.
    anchors = sorted(pieces[:4], key=lambda item: (item[1][0] + item[1][2]) / 2)
    centers = [(box[0] + box[2]) / 2 for _, box, _ in anchors]
    if any(right - left < image.width / 9 for left, right in zip(centers, centers[1:])):
        raise ValueError(f"Four pose bodies are not separated in {source}")
    masks = [mask for _, _, mask in anchors]
    for _, box, mask in pieces[4:]:
        center = (box[0] + box[2]) / 2
        owner = min(range(4), key=lambda index: abs(center - centers[index]))
        masks[owner] = ImageChops.lighter(masks[owner], mask)
    pieces = [(0, mask.getbbox(), mask) for mask in masks]
    scale = min(170 / max(box[2] - box[0] for _, box, _ in pieces),
                158 / max(box[3] - box[1] for _, box, _ in pieces))
    atlas = Image.new("RGBA", (CELL * 4, CELL))
    for frame, (_, box, mask) in enumerate(pieces):
        item = image.crop(box)
        item.putalpha(mask.crop(box))
        item = item.resize((round(item.width * scale), round(item.height * scale)),
                           Image.Resampling.NEAREST)
        atlas.alpha_composite(item, (frame * CELL + round((CELL - item.width) / 2),
                                     180 - item.height))
    # The first cell is the on-card idle pose; preserve it pixel for pixel.
    atlas.paste(base.crop((0, 0, CELL, CELL)), (0, 0))
    destination.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(destination, optimize=True)
    print(f"Packed {source} -> {destination} at scale {scale:.3f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("character_id")
    parser.add_argument("source_image", type=Path)
    args = parser.parse_args()
    pack(args.source_image, ROOT / "public/art/characters/ultimates" / f"{args.character_id}.png")
