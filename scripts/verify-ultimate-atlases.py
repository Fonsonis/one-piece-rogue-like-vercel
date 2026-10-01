"""Verify imported combat atlases and the unchanged idle pose."""
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1] / "public/art/characters"
CELL = 192


def check_variant(path: Path, base_path: Path) -> None:
    base = Image.open(base_path).convert("RGBA")
    variant = Image.open(path).convert("RGBA")
    if base.size != (CELL * 4, CELL) or variant.size != base.size:
        raise ValueError(f"Atlas dimensions differ: {path}")
    frame = lambda image, index: image.crop((index * CELL, 0, (index + 1) * CELL, CELL))
    if frame(variant, 0).tobytes() != frame(base, 0).tobytes():
        raise ValueError(f"Idle pose differs from base: {path}")
    for index in range(4):
        if frame(variant, index).getchannel("A").getbbox() is None:
            raise ValueError(f"Empty pose {index}: {path}")
    animated = [frame(variant, index) for index in (1, 2, 3)]
    for index, pose in enumerate(animated, start=1):
        if ImageChops.difference(pose, frame(base, index)).getbbox() is None:
            raise ValueError(f"Animation pose {index} has not changed: {path}")
    if len({pose.tobytes() for pose in animated}) != 3:
        raise ValueError(f"Animation poses are duplicated: {path}")


files = sorted((ROOT / "ultimates").glob("*.png"))
expected = {path.stem for path in ROOT.glob("*.png")} - {"luffy5"}
actual = {path.stem for path in files}
if actual != expected:
    raise ValueError(f"Ultimate coverage differs: missing={sorted(expected - actual)}, "
                     f"unexpected={sorted(actual - expected)}")
for path in files:
    check_variant(path, ROOT / path.name)
check_variant(ROOT / "attacks/luffy5.png", ROOT / "luffy5.png")
print(f"Verified {len(files)} ultimate atlases and the Gear 5 normal attack")
