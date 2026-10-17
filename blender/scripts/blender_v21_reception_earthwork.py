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
CONTRACT_PATH = PROJECT_ROOT / "blender" / "generated" / "v21-reception-earthwork-contract.json"
OUTPUT_PATH = PROJECT_ROOT / "public" / "models" / "pulpa-blender" / "RECEPTION-EARTHWORK-V21.glb"


MATERIALS = {
    "crest": (0.48, 0.34, 0.22, 1.0),
    "upper-slope": (0.36, 0.23, 0.14, 1.0),
    "berm": (0.43, 0.29, 0.17, 1.0),
    "toe-slope": (0.33, 0.22, 0.14, 1.0),
}


def make_material(name, color):
    material = bpy.data.materials.new(name=f"V21_{name.upper().replace('-', '_')}")
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.93
        bsdf.inputs["Metallic"].default_value = 0.0
    return material


def three_to_blender(point, visual_lift):
    x, y, z = point
    return (x, -z, y + visual_lift)


def build_band_mesh(band, cells, visual_lift, material, root):
    vertices = []
    faces = []
    for corners in cells:
        base = len(vertices)
        vertices.extend(three_to_blender(point, visual_lift) for point in corners)
        faces.append((base, base + 1, base + 2, base + 3))

    mesh = bpy.data.meshes.new(f"RECEPTION_EARTHWORK_V21_{band.upper().replace('-', '_')}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(f"RECEPTION-EARTHWORK-V21_{band.upper().replace('-', '_')}", mesh)
    obj.parent = root
    obj.data.materials.append(material)
    obj["pulpa_lab_visual_only"] = True
    obj["pulpa_lab_terrain_band"] = band
    obj["pulpa_lab_authoritative_height"] = False
    bpy.context.collection.objects.link(obj)
    return obj


def main():
    if not CONTRACT_PATH.exists():
        raise RuntimeError(f"Missing terrain contract: {CONTRACT_PATH}")

    payload = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    if payload.get("assetId") != "RECEPTION-EARTHWORK-V21":
        raise RuntimeError("Unexpected V21 terrain contract assetId")
    if payload.get("worldUnitsPerMeter") != 1:
        raise RuntimeError("V21 terrain contract must use one world unit per metre")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene["pulpa_lab_asset"] = payload["assetId"]
    scene["pulpa_lab_source"] = payload["source"]
    scene["pulpa_lab_visual_only"] = True
    scene["pulpa_lab_authoritative_height"] = False

    root = bpy.data.objects.new(payload["assetId"], None)
    root["pulpa_lab_visual_only"] = True
    root["pulpa_lab_authoritative_height"] = False
    root["pulpa_lab_world_units_per_meter"] = 1.0
    bpy.context.collection.objects.link(root)

    x_values = payload["grid"]["xValues"]
    z_values = payload["grid"]["zValues"]
    heights = payload["grid"]["heights"]
    bands = payload["grid"]["cellBands"]
    band_cells = {name: [] for name in MATERIALS}

    for zi, row in enumerate(bands):
        for xi, band in enumerate(row):
            if band not in band_cells:
                continue
            x0, x1 = x_values[xi], x_values[xi + 1]
            z0, z1 = z_values[zi], z_values[zi + 1]
            band_cells[band].append((
                (x0, heights[zi][xi], z0),
                (x1, heights[zi][xi + 1], z0),
                (x1, heights[zi + 1][xi + 1], z1),
                (x0, heights[zi + 1][xi], z1),
            ))

    materials = {name: make_material(name, color) for name, color in MATERIALS.items()}
    objects = []
    for band, cells in band_cells.items():
        if not cells:
            continue
        objects.append(build_band_mesh(band, cells, payload["visualLiftM"], materials[band], root))

    if not objects:
        raise RuntimeError("V21 terrain contract did not produce any visual earthwork cells")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_PATH),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_animations=False,
    )

    result = {
        "asset": payload["assetId"],
        "output": str(OUTPUT_PATH),
        "bytes": OUTPUT_PATH.stat().st_size,
        "objects": [obj.name for obj in objects],
        "cells": {band: len(cells) for band, cells in band_cells.items()},
        "visual_lift_m": payload["visualLiftM"],
        "authoritative_height": False,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
