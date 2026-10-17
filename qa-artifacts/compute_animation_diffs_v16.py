from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


ROOT = Path(__file__).resolve().parent


def compare(a_path: Path, b_path: Path) -> dict:
    with Image.open(a_path).convert("RGB") as a, Image.open(b_path).convert("RGB") as b:
        if a.size != b.size:
            raise RuntimeError(f"Image size mismatch: {a_path.name} vs {b_path.name}")
        diff = ImageChops.difference(a, b)
        histogram = diff.histogram()
        pixels = a.width * a.height
        # Exact changed-pixel count: any RGB channel differs.
        rgb = diff.load()
        changed = sum(
            1
            for y in range(a.height)
            for x in range(a.width)
            if rgb[x, y] != (0, 0, 0)
        )
        stat = ImageStat.Stat(diff)
        rms = math.sqrt(sum(value * value for value in stat.rms) / len(stat.rms))
        return {
            "changed_pixels": changed,
            "changed_pct": round(changed * 100 / pixels, 4),
            "rms": round(rms, 4),
        }


def closeup_key(path: Path) -> str:
    return path.stem[:-2]


def runtime_key(path: Path) -> str:
    stem = path.stem[:-2]
    if stem.endswith("-on"):
        return stem[:-3]
    if stem.endswith("-off"):
        return stem[:-4] + "_off"
    return stem


def summarize(directory: Path, key_fn) -> dict:
    summary = {}
    for a_path in sorted(directory.glob("*-a.png")):
        b_path = a_path.with_name(a_path.name.replace("-a.png", "-b.png"))
        if not b_path.exists():
            continue
        summary[key_fn(a_path)] = compare(a_path, b_path)
    return summary


closeup_dir = ROOT / "v16-animation-closeups"
runtime_dir = ROOT / "v16-animation-runtime"
closeups = summarize(closeup_dir, closeup_key)
runtime = summarize(runtime_dir, runtime_key)

(closeup_dir / "pixel-diff-summary.json").write_text(
    json.dumps(closeups, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
(runtime_dir / "pixel-diff-summary.json").write_text(
    json.dumps(runtime, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)

result = {
    "closeups": closeups,
    "runtime": runtime,
    "closeups_all_moving": bool(closeups) and all(v["changed_pixels"] > 0 for v in closeups.values()),
    "animations_off_static": runtime.get("grinding_off", {}).get("changed_pixels") == 0,
}
(ROOT / "v16-animation-final-diff-summary.json").write_text(
    json.dumps(result, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
print(json.dumps(result, indent=2, ensure_ascii=False))
