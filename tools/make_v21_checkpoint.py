from __future__ import annotations

import hashlib
import os
import sys
import zipfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT_ROOT.parents[1] / "PULPA_LAB_CHECKPOINT_V21_TERRAIN_ANIMATION_HARDENING.zip"
MANIFEST_NAME = "V21_RELEASE_MANIFEST_SHA256.txt"

EXCLUDED_DIRS = {".git", ".vite", "node_modules", "coverage", "__pycache__", ".vercel"}
EXCLUDED_NAMES = {MANIFEST_NAME, ".DS_Store", "Thumbs.db", ".env", ".env.local"}

REQUIRED = [
    "CHECKPOINT.txt",
    "V21_TERRAIN_ANIMATION_HARDENING_CHECKPOINT.md",
    "README.md",
    ".gitignore",
    ".github/workflows/ci.yml",
    "src/scene/integration/blenderVisualReplacement.js",
    "src/scene/integration/blenderTerrainOverlay.js",
    "src/scene/environment/terrainHeight.js",
    "src/scene/environment/terrain.js",
    "src/scene/config/siteDesign.js",
    "src/equipment/crushing/romHopper.js",
    "src/scene/integration/supportEquipment.js",
    "src/scene/integration/integratedPlant.js",
    "tests/scene/blenderAnimationPlayback.test.js",
    "tests/scene/blenderTerrainV21.test.js",
    "tests/scene/terrain.test.js",
    "tests/scene/siteScale.test.js",
    "tests/scene/industrialAnimations.test.js",
    "tests/equipment/materialTransport.test.js",
    "tools/exportV21TerrainContract.mjs",
    "tools/v21VisualScaleAudit.mjs",
    "blender/scripts/blender_v21_reception_earthwork.py",
    "blender/generated/v21-reception-earthwork-contract.json",
    "public/models/pulpa-blender/RECEPTION-EARTHWORK-V21.glb",
    "blender/PULPA_LAB_BLENDER_MASTER_V17.blend",
    "qa-artifacts/v21-calculation-guard.json",
    "qa-artifacts/v21-source-diff-v20.json",
    "qa-artifacts/v21-public-dist-glb-hashes.json",
    "qa-artifacts/v21-master-hash.json",
    "qa-artifacts/v21-scale-audit.json",
    "qa-artifacts/v21-terrain-animation/summary.json",
    "qa-artifacts/v21-terrain-animation/pixel-diff.json",
    "qa-artifacts/v21-terrain-animation/http-smoke.json",
    "qa-artifacts/v21-terrain-animation/reception-earthwork.png",
    "qa-artifacts/v21-terrain-animation/MILL-01-on-a.png",
    "qa-artifacts/v21-terrain-animation/PUMP-01-on-a.png",
    "qa-artifacts/cdp_v21_terrain_animation_probe.mjs",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def should_exclude_file(path: Path) -> bool:
    name = path.name
    if name in EXCLUDED_NAMES or name.lower().endswith((".zip", ".pyc", ".log")):
        return True
    if name == ".env" or name.startswith(".env."):
        return True
    return False


def included_files() -> list[Path]:
    files: list[Path] = []
    for root, dirs, names in os.walk(PROJECT_ROOT):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRS)
        root_path = Path(root)
        for name in sorted(names):
            path = root_path / name
            if should_exclude_file(path):
                continue
            files.append(path)
    return sorted(files, key=lambda item: item.relative_to(PROJECT_ROOT).as_posix())


def write_manifest(files: list[Path]) -> Path:
    manifest = PROJECT_ROOT / MANIFEST_NAME
    lines = ["# PULPA LAB V21 release manifest", "# SHA-256  relative/path"]
    for path in files:
        rel = path.relative_to(PROJECT_ROOT).as_posix()
        lines.append(f"{sha256(path)}  {rel}")
    manifest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return manifest


def validate_required() -> None:
    missing = [rel for rel in REQUIRED if not (PROJECT_ROOT / rel).is_file()]
    if missing:
        raise RuntimeError(f"Missing required release files: {missing}")


def make_zip(output: Path) -> dict:
    validate_required()
    files = included_files()
    manifest = write_manifest(files)
    archive_files = files + [manifest]
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in archive_files:
            archive.write(path, path.relative_to(PROJECT_ROOT).as_posix())
    with zipfile.ZipFile(output, "r") as archive:
        bad = archive.testzip()
        names = set(archive.namelist())
        if bad:
            raise RuntimeError(f"ZIP integrity failure at {bad}")
        forbidden = [n for n in names if n.startswith(("node_modules/", ".git/", ".vercel/")) or "/__pycache__/" in n or Path(n).name.startswith(".env")]
        if forbidden:
            raise RuntimeError(f"Forbidden files leaked into checkpoint: {forbidden[:10]}")
        missing_in_zip = [rel for rel in REQUIRED if rel not in names]
        if missing_in_zip:
            raise RuntimeError(f"Required files missing from ZIP: {missing_in_zip}")
    return {
        "path": str(output),
        "files": len(archive_files),
        "uncompressed_bytes": sum(path.stat().st_size for path in archive_files),
        "zip_bytes": output.stat().st_size,
        "sha256": sha256(output),
        "manifest_sha256": sha256(manifest),
        "zip_test": "PASS",
    }


if __name__ == "__main__":
    destination = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    summary = make_zip(destination)
    for key, value in summary.items():
        print(f"{key}={value}")
