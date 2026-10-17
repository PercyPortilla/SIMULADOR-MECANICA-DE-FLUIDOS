from pathlib import Path
import json
import os
import re
import struct

import bpy


PROJECT_ROOT = Path(
    os.environ.get(
        "PULPA_LAB_PROJECT_ROOT",
        Path.home() / "OneDrive" / "Desktop" / "CHATON" / "pulpa-v13-working" / "pulpa_audit",
    )
)
ASSET_ROOT = PROJECT_ROOT / "public" / "models" / "pulpa-blender"
OUTPUT = PROJECT_ROOT / "qa-artifacts" / "v17-blender-master-audit.json"

ROOT_TO_GLB = {
    "MILL-01": "MILL-01.glb",
    "SUMP-01": "SUMP-01.glb",
    "SLURRY-PUMP-01": "SLURRY-PUMP-01.glb",
    "CLASS-01": "CLASS-01.glb",
    "LEACH-REACTOR": "LEACH-REACTOR.glb",
    "CIP-ADSORPTION": "CIP-ADSORPTION.glb",
    "ELUTION-SKID": "ELUTION-SKID.glb",
    "EW-CELLS": "EW-CELLS.glb",
    "SMELTING-FURNACE": "SMELTING-FURNACE.glb",
    "ROM-HOPPER": "ROM-HOPPER.glb",
    "APRON-FEEDER": "APRON-FEEDER.glb",
    "PRIMARY-CRUSHER": "PRIMARY-CRUSHER.glb",
    "STOCKPILE-RECLAIM": "STOCKPILE-RECLAIM.glb",
    "HAUL-TRUCK": "HAUL-TRUCK.glb",
    "MINING-SHOVEL": "MINING-SHOVEL.glb",
    "WHEEL-LOADER": "WHEEL-LOADER.glb",
}

EXPECTED_ACTIONS = {
    "APRON_FEEDER_PanLoop",
    "APRON_FEEDER_Sprocket_01",
    "APRON_FEEDER_Sprocket_02",
    "CIP_ADSORPTION_Agitator_01",
    "CIP_ADSORPTION_Agitator_02",
    "CIP_ADSORPTION_Agitator_03",
    "CIP_ADSORPTION_Agitator_04",
    "LEACH_REACTOR_Agitator",
    "MILL-01_Rotation",
    "MINING_SHOVEL_Boom",
    "MINING_SHOVEL_Bucket",
    "MINING_SHOVEL_Slew",
    "MINING_SHOVEL_Stick",
    "PRIMARY_CRUSHER_Eccentric",
    "PRIMARY_CRUSHER_Flywheel_01",
    "PRIMARY_CRUSHER_Flywheel_02",
    "PRIMARY_CRUSHER_JawOscillation",
    "SLURRY-PUMP-01_ShaftRotation",
    "SMELTING_FURNACE_Tilt",
    "WHEEL_LOADER_Arms",
    "WHEEL_LOADER_Articulation",
    "WHEEL_LOADER_Bucket",
    "WHEEL_LOADER_Wheel_FL",
    "WHEEL_LOADER_Wheel_FR",
    "WHEEL_LOADER_Wheel_RL",
    "WHEEL_LOADER_Wheel_RR",
}

REQUIRED_SEMANTIC_NODES = (
    "APRON-FEEDER_PANS_GROUP",
    "PRIMARY-CRUSHER_MOVING_JAW",
    "MILL-01_ROTATING_GROUP",
    "SLURRY-PUMP-01_ROTATING_GROUP",
    "LEACH-REACTOR_ROTATING_GROUP",
    "SMELTING-FURNACE_TILT_PIVOT",
    "HAUL-TRUCK_DUMP_PIVOT",
    "HAUL-TRUCK_WHEEL_STEER_FL",
    "HAUL-TRUCK_WHEEL_SPIN_RR2",
    "MINING-SHOVEL_BOOM_PIVOT",
    "WHEEL-LOADER_ARM_PIVOT",
)


def read_glb_json(path: Path):
    raw = path.read_bytes()
    if len(raw) < 20 or raw[:4] != b"glTF":
        raise ValueError(f"{path.name}: invalid GLB")
    offset = 12
    while offset + 8 <= len(raw):
        chunk_len, chunk_type = struct.unpack_from("<II", raw, offset)
        offset += 8
        chunk = raw[offset:offset + chunk_len]
        offset += chunk_len
        if chunk_type == 0x4E4F534A:
            return json.loads(chunk.rstrip(b" \t\r\n\0").decode("utf-8"))
    raise ValueError(f"{path.name}: JSON chunk missing")


roots = {}
failures = []
for root_name, filename in ROOT_TO_GLB.items():
    root = bpy.data.objects.get(root_name)
    path = ASSET_ROOT / filename
    if root is None:
        failures.append(f"missing master root {root_name}")
        continue
    if not path.exists():
        failures.append(f"missing runtime GLB {filename}")
        continue
    glb = read_glb_json(path)
    master_nodes = 1 + len(root.children_recursive)
    glb_nodes = len(glb.get("nodes", []))
    if master_nodes != glb_nodes:
        failures.append(f"{root_name}: master nodes {master_nodes} != GLB nodes {glb_nodes}")
    roots[root_name] = {
        "master_nodes": master_nodes,
        "glb_nodes": glb_nodes,
        "glb_animations": len(glb.get("animations", [])),
    }

action_names = {action.name for action in bpy.data.actions}
missing_actions = sorted(EXPECTED_ACTIONS - action_names)
unexpected_actions = sorted(action_names - EXPECTED_ACTIONS)
if missing_actions:
    failures.append(f"missing actions: {missing_actions}")
if unexpected_actions:
    failures.append(f"unexpected actions: {unexpected_actions}")

zero_user_actions = sorted(action.name for action in bpy.data.actions if action.users == 0)
if zero_user_actions:
    failures.append(f"zero-user actions: {zero_user_actions}")

main_asset_objects = set()
for root_name in ROOT_TO_GLB:
    root = bpy.data.objects.get(root_name)
    if root is not None:
        main_asset_objects.add(root)
        main_asset_objects.update(root.children_recursive)

main_asset_names = {obj.name for obj in main_asset_objects}
duplicate_named_objects = []
for obj in main_asset_objects:
    match = re.search(r"\.\d{3}$", obj.name)
    if not match:
        continue
    base_name = obj.name[:-4]
    if base_name in main_asset_names:
        duplicate_named_objects.append(obj.name)
duplicate_named_objects.sort()
if duplicate_named_objects:
    failures.append(f"duplicate-style object names: {duplicate_named_objects[:20]}")

missing_semantic_nodes = [
    name for name in REQUIRED_SEMANTIC_NODES if bpy.data.objects.get(name) is None
]
if missing_semantic_nodes:
    failures.append(f"missing semantic nodes: {missing_semantic_nodes}")

required_collections = {
    "PULPA_LAB_ASSETS",
    "PROCESS_PLANT",
    "MINE_EQUIPMENT",
    "V15_HYBRID_MODULES",
}
missing_collections = sorted(
    name for name in required_collections if bpy.data.collections.get(name) is None
)
if missing_collections:
    failures.append(f"missing collections: {missing_collections}")

scene = bpy.context.scene
metadata = {
    "master_version": scene.get("pulpa_lab_master_version"),
    "runtime": scene.get("pulpa_lab_runtime"),
    "units": scene.get("pulpa_lab_units"),
    "frame_range": [scene.frame_start, scene.frame_end],
}
if metadata["master_version"] != "V17":
    failures.append("scene metadata master_version is not V17")

report = {
    "status": "PASS" if not failures else "FAIL",
    "filepath": bpy.data.filepath,
    "objects": len(bpy.data.objects),
    "actions": len(bpy.data.actions),
    "roots": roots,
    "missing_actions": missing_actions,
    "unexpected_actions": unexpected_actions,
    "zero_user_actions": zero_user_actions,
    "duplicate_named_objects": duplicate_named_objects,
    "missing_semantic_nodes": missing_semantic_nodes,
    "missing_collections": missing_collections,
    "metadata": metadata,
    "failures": failures,
}
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))

if failures:
    raise RuntimeError("V17 master audit failed: " + "; ".join(failures))
