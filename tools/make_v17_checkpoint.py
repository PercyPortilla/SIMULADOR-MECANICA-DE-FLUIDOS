from __future__ import annotations

import hashlib
import os
import sys
import zipfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT_ROOT.parents[1] / "PULPA_LAB_CHECKPOINT_V17_BLENDER_MASTER_PRESENTATION.zip"
MANIFEST_NAME = "V17_RELEASE_MANIFEST_SHA256.txt"

EXCLUDED_DIRS = {".git", ".vite", "node_modules", "coverage", "__pycache__"}
EXCLUDED_NAMES = {MANIFEST_NAME, ".DS_Store"}

REQUIRED = [
    "CHECKPOINT.txt",
    "V17_BLENDER_MASTER_PRESENTATION_CHECKPOINT.md",
    "src/main.js",
    "src/styles.css",
    "src/ui/inspectionGuide.js",
    "blender/PULPA_LAB_BLENDER_MASTER_V17.blend",
    "blender/scripts/blender_v17_promote_master.py",
    "blender/scripts/blender_v17_master_audit.py",
    "public/models/pulpa-blender/MILL-01.glb",
    "public/models/pulpa-blender/APRON-FEEDER.glb",
    "public/models/pulpa-blender/CIP-ADSORPTION.glb",
    "public/models/pulpa-blender/PRIMARY-CRUSHER.glb",
    "dist/models/pulpa-blender/MILL-01.glb",
    "dist/models/pulpa-blender/APRON-FEEDER.glb",
    "dist/models/pulpa-blender/CIP-ADSORPTION.glb",
    "dist/models/pulpa-blender/PRIMARY-CRUSHER.glb",
    "qa-artifacts/v17-blender-master-audit.json",
    "qa-artifacts/v17-presentation-summary.json",
    "qa-artifacts/v17-presentation-desktop.png",
    "qa-artifacts/v17-presentation-mobile.png",
    "qa-artifacts/v17-animation-smoke-summary.json",
    "qa-artifacts/v17-calculation-guard.json",
    "qa-artifacts/v17-public-dist-glb-hashes.json",
    "qa-artifacts/v17-master-hash.json",
]

def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def included_files() -> list[Path]:
    files: list[Path] = []
    for root, dirs, names in os.walk(PROJECT_ROOT):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRS)
        root_path = Path(root)
        for name in sorted(names):
            if name in EXCLUDED_NAMES or name.lower().endswith(".zip"):
                continue
            files.append(root_path / name)
    return sorted(files, key=lambda item: item.relative_to(PROJECT_ROOT).as_posix())

def write_manifest(files: list[Path]) -> Path:
    manifest = PROJECT_ROOT / MANIFEST_NAME
    lines = ["# PULPA LAB V17 release manifest", "# SHA-256  relative/path"]
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
        if any(name.startswith("node_modules/") for name in names):
            raise RuntimeError("node_modules leaked into checkpoint")
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

