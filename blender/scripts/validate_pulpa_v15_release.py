"""Validate the complete PULPA LAB V15 runtime GLB set.

The script is intentionally path-independent: by default it resolves the
project's public/models/pulpa-blender directory from its own location. An
alternate asset directory may be passed as argv[1].
"""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path


MAIN_FILES = {
    "APRON-FEEDER.glb",
    "CIP-ADSORPTION.glb",
    "CLASS-01.glb",
    "ELUTION-SKID.glb",
    "EW-CELLS.glb",
    "HAUL-TRUCK.glb",
    "LEACH-REACTOR.glb",
    "MILL-01.glb",
    "MINING-SHOVEL.glb",
    "PRIMARY-CRUSHER.glb",
    "ROM-HOPPER.glb",
    "SLURRY-PUMP-01.glb",
    "SMELTING-FURNACE.glb",
    "STOCKPILE-RECLAIM.glb",
    "SUMP-01.glb",
    "WHEEL-LOADER.glb",
}

MODULE_FILES = {
    "CONVEYOR-HEAD-MODULE.glb",
    "CONVEYOR-IDLER-MODULE.glb",
    "CONVEYOR-TAIL-MODULE.glb",
    "CONVEYOR-TRANSFER-HOOD.glb",
    "PIPE-FLANGE-MODULE.glb",
    "PIPE-SADDLE-MODULE.glb",
    "PIPE-VALVE-MODULE.glb",
}

REQUIRED_NODES = {
    "HAUL-TRUCK.glb": {
        "HAUL-TRUCK_DUMP_PIVOT",
        "HAUL-TRUCK_WHEEL_STEER_FL",
        "HAUL-TRUCK_WHEEL_STEER_FR",
        "HAUL-TRUCK_WHEEL_SPIN_FL",
        "HAUL-TRUCK_WHEEL_SPIN_FR",
        "HAUL-TRUCK_ORE_LOAD",
    },
    "APRON-FEEDER.glb": {"APRON-FEEDER_PANS_GROUP"},
    "PRIMARY-CRUSHER.glb": {"PRIMARY-CRUSHER_MOVING_JAW"},
    "MILL-01.glb": {"MILL-01_ROTATING_GROUP"},
    "SLURRY-PUMP-01.glb": {"SLURRY-PUMP-01_ROTATING_GROUP"},
}


def read_glb_json(path: Path) -> dict:
    raw = path.read_bytes()
    if len(raw) < 20 or raw[:4] != b"glTF":
        raise ValueError("invalid GLB magic/header")
    version, declared_length = struct.unpack_from("<II", raw, 4)
    if version != 2 or declared_length != len(raw):
        raise ValueError(f"invalid GLB version/length ({version=}, {declared_length=})")
    offset = 12
    while offset + 8 <= len(raw):
        chunk_length, chunk_type = struct.unpack_from("<II", raw, offset)
        offset += 8
        chunk = raw[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == 0x4E4F534A:
            return json.loads(chunk.rstrip(b" \t\r\n\0").decode("utf-8"))
    raise ValueError("JSON chunk missing")


def default_asset_dir() -> Path:
    project_root = Path(__file__).resolve().parents[2]
    return project_root / "public" / "models" / "pulpa-blender"


def main(asset_dir: Path) -> int:
    asset_dir = asset_dir.resolve()
    module_dir = asset_dir / "v15-modules"
    failures: list[str] = []
    records: dict[str, dict] = {}

    expected_paths = {
        **{name: asset_dir / name for name in MAIN_FILES},
        **{f"v15-modules/{name}": module_dir / name for name in MODULE_FILES},
    }

    for rel, path in sorted(expected_paths.items()):
        if not path.exists():
            failures.append(f"missing {rel}")
            continue
        try:
            doc = read_glb_json(path)
        except Exception as exc:  # report every corrupt file in one pass
            failures.append(f"{rel}: {exc}")
            continue
        node_names = {node.get("name", "") for node in doc.get("nodes", [])}
        records[rel] = {
            "bytes": path.stat().st_size,
            "nodes": len(node_names),
            "animations": [animation.get("name", "") for animation in doc.get("animations", [])],
        }
        filename = path.name
        for required in sorted(REQUIRED_NODES.get(filename, ())):
            if required not in node_names:
                failures.append(f"{rel}: missing semantic node {required}")

    discovered_main = {path.name for path in asset_dir.glob("*.glb")}
    discovered_modules = {path.name for path in module_dir.glob("*.glb")} if module_dir.exists() else set()
    extras_main = sorted(discovered_main - MAIN_FILES)
    extras_modules = sorted(discovered_modules - MODULE_FILES)
    if extras_main:
        failures.append(f"unexpected top-level GLBs: {extras_main}")
    if extras_modules:
        failures.append(f"unexpected V15 module GLBs: {extras_modules}")

    report = {
        "asset_dir": str(asset_dir),
        "expected_glbs": len(MAIN_FILES) + len(MODULE_FILES),
        "validated_glbs": len(records),
        "total_bytes": sum(item["bytes"] for item in records.values()),
        "files": records,
        "failures": failures,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == "__main__":
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else default_asset_dir()
    raise SystemExit(main(folder))
