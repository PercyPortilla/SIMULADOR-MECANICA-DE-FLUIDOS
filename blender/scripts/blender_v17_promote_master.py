from pathlib import Path
import json
import os

import bpy


PROJECT_ROOT = Path(
    os.environ.get(
        "PULPA_LAB_PROJECT_ROOT",
        Path.home() / "OneDrive" / "Desktop" / "CHATON" / "pulpa-v13-working" / "pulpa_audit",
    )
)
TARGET = PROJECT_ROOT / "blender" / "PULPA_LAB_BLENDER_MASTER_V17.blend"

EXPECTED_ROOTS = (
    "MILL-01",
    "SUMP-01",
    "SLURRY-PUMP-01",
    "CLASS-01",
    "LEACH-REACTOR",
    "CIP-ADSORPTION",
    "ELUTION-SKID",
    "EW-CELLS",
    "SMELTING-FURNACE",
    "ROM-HOPPER",
    "APRON-FEEDER",
    "PRIMARY-CRUSHER",
    "STOCKPILE-RECLAIM",
    "HAUL-TRUCK",
    "MINING-SHOVEL",
    "WHEEL-LOADER",
)

EXPECTED_ACTIONS = (
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
)

missing_roots = [name for name in EXPECTED_ROOTS if bpy.data.objects.get(name) is None]
if missing_roots:
    raise RuntimeError(f"Cannot promote V17 master; missing roots: {missing_roots}")

stale = bpy.data.actions.get("CIP_Agitators.001")
if stale and stale.users == 0:
    bpy.data.actions.remove(stale)

missing_actions = [name for name in EXPECTED_ACTIONS if bpy.data.actions.get(name) is None]
if missing_actions:
    raise RuntimeError(f"Cannot promote V17 master; missing actions: {missing_actions}")

scene = bpy.context.scene
scene["pulpa_lab_master_version"] = "V17"
scene["pulpa_lab_master_baseline"] = "V16 verified runtime assets"
scene["pulpa_lab_runtime"] = "Three.js + Blender hybrid"
scene["pulpa_lab_units"] = "metres"
scene["pulpa_lab_animation_policy"] = (
    "Blender clips for mechanical assets; Three.js semantic control where runtime-dependent"
)
scene.frame_start = 1
scene.frame_end = 960

bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))

result = {
    "saved": bpy.data.filepath,
    "objects": len(bpy.data.objects),
    "actions": len(bpy.data.actions),
    "action_names": sorted(action.name for action in bpy.data.actions),
    "collections": sorted(
        collection.name
        for collection in bpy.data.collections
        if collection.name in {
            "PULPA_LAB_ASSETS",
            "PROCESS_PLANT",
            "MINE_EQUIPMENT",
            "V15_HYBRID_MODULES",
        }
    ),
    "dirty": bpy.data.is_dirty,
}
print(json.dumps(result))
