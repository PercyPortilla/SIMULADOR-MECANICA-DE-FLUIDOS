from __future__ import annotations

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
FILES = {
    "inspection": ROOT / "src/babylon/inspection/equipmentInspection.js",
    "runtime": ROOT / "src/babylon/runtime/baseEnvironment.js",
    "main": ROOT / "src/main.js",
    "tests": ROOT / "tests",
}

PATTERNS = {
    "inspection": [
        r"resolvePickTargetId",
        r"getPickableMeshCount",
        r"syncPickableMeshes",
        r"hoverOverlay",
        r"statusOverlay",
        r"setHoverTarget",
        r"setOperationalStatus",
        r"getTargetInfo",
        r"setTarget\(",
        r"contextOverlay",
    ],
    "runtime": [
        r"resolveBabylonInspectionPick",
        r"activateBabylonInspectionPick",
        r"createBabylonInspectionHoverPayload",
        r"setInspectionHoverHandler",
        r"setInspectionOperationalStatus",
        r"clearInspectionHover",
        r"pointermove",
        r"pointerleave",
        r"inspectionPickHandler",
        r"setInspectionTarget",
    ],
    "main": [
        r"selectInspectionTarget",
        r"setInspectionPickHandler",
        r"setInspectionHoverHandler",
        r"setInspectionOperationalStatus",
        r"inspection-hover-tooltip",
        r"inspectionTarget\?\.addEventListener",
    ],
}


def match_lines(path: Path, patterns: list[str]) -> list[str]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    compiled = [re.compile(pattern) for pattern in patterns]
    hits: list[str] = []
    for index, line in enumerate(lines, start=1):
        if any(pattern.search(line) for pattern in compiled):
            hits.append(f"{path.relative_to(ROOT)}:{index}: {line.strip()}")
    return hits


def main() -> None:
    print("B68 inspection audit")
    total = 0
    for key in ("inspection", "runtime", "main"):
        hits = match_lines(FILES[key], PATTERNS[key])
        total += len(hits)
        print(f"- {key}: {len(hits)} relevant hooks")
        for hit in hits[:12]:
            print(f"  {hit}")
        if len(hits) > 12:
            print(f"  ... {len(hits) - 12} more")

    test_files = sorted(FILES["tests"].rglob("*.test.js"))
    test_hits = []
    for path in test_files:
        text = path.read_text(encoding="utf-8")
        if re.search(r"Inspection|inspection|Pick|pick", text):
            test_hits.append(path.relative_to(ROOT).as_posix())

    print(f"- tests covering Inspection/picking: {len(test_hits)} files")
    for path in test_hits[:12]:
        print(f"  {path}")
    if len(test_hits) > 12:
        print(f"  ... {len(test_hits) - 12} more")
    print(f"Summary: {total} source hooks; {len(test_hits)} related test files.")


if __name__ == "__main__":
    main()
