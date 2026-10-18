from pathlib import Path
import json
import math
import os

import bpy
import numpy as np


PROJECT_ROOT = Path(
    os.environ.get(
        "PULPA_LAB_PROJECT_ROOT",
        Path(__file__).resolve().parents[2],
    )
)
CONTRACT_PATH = PROJECT_ROOT / "blender" / "generated" / "v26-reception-earthwork-contract.json"
TEXTURE_DIR = PROJECT_ROOT / "blender" / "generated" / "v26-reception-pbr"
OUTPUT_PATH = PROJECT_ROOT / "public" / "models" / "pulpa-blender" / "RECEPTION-EARTHWORK-V26.glb"
BUILD_REPORT_PATH = PROJECT_ROOT / "blender" / "generated" / "v26-reception-earthwork-build.json"


def three_to_blender(point, visual_lift=0.0):
    x, y, z = point
    return (x, -z, y + visual_lift)


def srgb_tuple(rgb):
    return tuple(max(0.0, min(1.0, float(c))) for c in rgb)


def terrain_height_sampler(payload):
    xs = payload["grid"]["xValues"]
    zs = payload["grid"]["zValues"]
    heights = payload["grid"]["heights"]
    step = float(payload["sampleStepM"])
    x0 = xs[0]
    z0 = zs[0]

    def sample(x, z):
        fx = max(0.0, min(len(xs) - 1.000001, (x - x0) / step))
        fz = max(0.0, min(len(zs) - 1.000001, (z - z0) / step))
        xi = min(len(xs) - 2, int(math.floor(fx)))
        zi = min(len(zs) - 2, int(math.floor(fz)))
        tx = fx - xi
        tz = fz - zi
        h00 = heights[zi][xi]
        h10 = heights[zi][xi + 1]
        h01 = heights[zi + 1][xi]
        h11 = heights[zi + 1][xi + 1]
        ha = h00 + (h10 - h00) * tx
        hb = h01 + (h11 - h01) * tx
        return ha + (hb - ha) * tz

    return sample


def fourier_field(xx, yy, seed, waves, min_wave_m, max_wave_m):
    rng = np.random.default_rng(seed)
    field = np.zeros_like(xx, dtype=np.float32)
    total = 0.0
    for index in range(waves):
        wavelength = float(rng.uniform(min_wave_m, max_wave_m))
        angle = float(rng.uniform(0.0, math.tau))
        phase = float(rng.uniform(0.0, math.tau))
        amplitude = 1.0 / (1.0 + index * 0.18)
        k = math.tau / max(wavelength, 0.01)
        field += amplitude * np.sin((xx * math.cos(angle) + yy * math.sin(angle)) * k + phase)
        total += amplitude
    field /= max(total, 1e-6)
    return np.clip(field, -1.0, 1.0)


def make_texture_arrays(profile, world_planar):
    resolution = int(world_planar["textureResolutionPx"])
    bounds = world_planar["boundsM"]
    x = np.linspace(bounds["xMin"], bounds["xMax"], resolution, dtype=np.float32)
    z = np.linspace(bounds["zMin"], bounds["zMax"], resolution, dtype=np.float32)
    xx, zz = np.meshgrid(x, z)
    seed = int(profile["seed"])

    broad = fourier_field(xx, zz, seed, 9, 7.0, 31.0)
    medium = fourier_field(xx, zz, seed + 37, 13, 1.8, 9.0)
    fine = fourier_field(xx, zz, seed + 83, 17, 0.55, 2.8)
    height_field = broad * 0.28 + medium * 0.42 + fine * 0.30
    color_field = np.clip(broad * 0.52 + medium * 0.33 + fine * 0.15, -1.0, 1.0)

    base = np.array(profile["baseColor"], dtype=np.float32)[None, None, :]
    variation = float(profile["colorVariation"])
    shade = 1.0 + color_field[..., None] * variation
    color = np.clip(base * shade, 0.02, 0.95)

    # Sparse aggregate/rock flecks use a second non-periodic field. They are
    # distributed over the full world projection once, never as a tiled stamp.
    fleck_field = fourier_field(xx, zz, seed + 211, 21, 0.35, 1.45)
    flecks = fleck_field > (0.68 if profile["label"].startswith("compacted") else 0.56)
    color[flecks] = np.clip(color[flecks] * 0.72 + 0.08, 0.02, 0.95)

    rough_min, rough_max = [float(v) for v in profile["roughness"]]
    rough_unit = np.clip(0.5 + 0.5 * (medium * 0.62 + fine * 0.38), 0.0, 1.0)
    roughness = rough_min + (rough_max - rough_min) * rough_unit

    pixel_dx = (bounds["xMax"] - bounds["xMin"]) / max(1, resolution - 1)
    pixel_dz = (bounds["zMax"] - bounds["zMin"]) / max(1, resolution - 1)
    grad_z, grad_x = np.gradient(height_field, pixel_dz, pixel_dx)
    strength = float(profile["normalStrength"])
    nx = -grad_x * strength
    ny = -grad_z * strength
    nz = np.ones_like(nx)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack((nx / norm, ny / norm, nz / norm), axis=-1) * 0.5 + 0.5

    ao_strength = float(profile["aoStrength"])
    cavity = np.clip(0.52 - (broad * 0.35 + medium * 0.45 + fine * 0.20), 0.0, 1.0)
    ao = np.clip(1.0 - ao_strength * cavity, 0.58, 1.0)
    return color, roughness, normal, ao


def save_rgba_png(name, rgb, alpha=None, non_color=False):
    height, width = rgb.shape[:2]
    image = bpy.data.images.new(name=name, width=width, height=height, alpha=True, float_buffer=False)
    if alpha is None:
        alpha = np.ones((height, width), dtype=np.float32)
    rgba = np.concatenate((rgb.astype(np.float32), alpha[..., None].astype(np.float32)), axis=-1)
    # Blender's image buffer starts at the bottom row.
    image.pixels.foreach_set(np.flipud(rgba).reshape(-1))
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    path = TEXTURE_DIR / f"{name}.png"
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image, path


def gray_to_rgb(values):
    return np.repeat(values[..., None], 3, axis=-1)


def ensure_gltf_material_output_group():
    name = "glTF Material Output"
    if name in bpy.data.node_groups:
        return bpy.data.node_groups[name]
    group = bpy.data.node_groups.new(name, "ShaderNodeTree")
    group.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    group.interface.new_socket("Thickness", in_out="INPUT", socket_type="NodeSocketFloat")
    group.interface.new_socket("Dispersion", in_out="INPUT", socket_type="NodeSocketFloat")
    group.interface.new_socket("Iridescence Factor", in_out="INPUT", socket_type="NodeSocketFloat")
    group.interface.new_socket("Iridescence Thickness Minimum", in_out="INPUT", socket_type="NodeSocketFloat")
    group.nodes.new("NodeGroupOutput")
    group.nodes.new("NodeGroupInput")
    return group


def build_pbr_material(band, profile, world_planar):
    safe = band.upper().replace("-", "_")
    material = bpy.data.materials.new(name=f"V26_{safe}_PBR")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    for node in list(nodes):
        nodes.remove(node)

    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Base Color"].default_value = (*srgb_tuple(profile["baseColor"]), 1.0)
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    color, roughness, normal, ao = make_texture_arrays(profile, world_planar)
    color_image, color_path = save_rgba_png(f"V26_{safe}_BASECOLOR", color, non_color=False)
    rough_image, rough_path = save_rgba_png(f"V26_{safe}_ROUGHNESS", gray_to_rgb(roughness), non_color=True)
    normal_image, normal_path = save_rgba_png(f"V26_{safe}_NORMAL", normal, non_color=True)
    ao_image, ao_path = save_rgba_png(f"V26_{safe}_AO", gray_to_rgb(ao), non_color=True)

    color_node = nodes.new("ShaderNodeTexImage")
    color_node.image = color_image
    color_node.extension = "EXTEND"
    color_node.interpolation = "Linear"
    links.new(color_node.outputs["Color"], bsdf.inputs["Base Color"])

    rough_node = nodes.new("ShaderNodeTexImage")
    rough_node.image = rough_image
    rough_node.extension = "EXTEND"
    rough_node.interpolation = "Linear"
    links.new(rough_node.outputs["Color"], bsdf.inputs["Roughness"])

    normal_tex = nodes.new("ShaderNodeTexImage")
    normal_tex.image = normal_image
    normal_tex.extension = "EXTEND"
    normal_tex.interpolation = "Linear"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 1.0
    links.new(normal_tex.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    ao_tex = nodes.new("ShaderNodeTexImage")
    ao_tex.image = ao_image
    ao_tex.extension = "EXTEND"
    ao_tex.interpolation = "Linear"
    gltf_settings = nodes.new("ShaderNodeGroup")
    gltf_settings.node_tree = ensure_gltf_material_output_group()
    links.new(ao_tex.outputs["Color"], gltf_settings.inputs["Occlusion"])

    material["pulpa_lab_material_revision"] = "V26"
    material["pulpa_lab_pbr_band"] = band
    material["pulpa_lab_world_planar"] = True
    material["pulpa_lab_texture_wrap"] = "clamp"
    return material, [color_path, rough_path, normal_path, ao_path]


def add_world_planar_uv(mesh, world_planar):
    bounds = world_planar["boundsM"]
    span_x = max(1e-6, bounds["xMax"] - bounds["xMin"])
    span_z = max(1e-6, bounds["zMax"] - bounds["zMin"])
    uv_layer = mesh.uv_layers.new(name="WORLD_XZ_V26")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            world_x = vertex.co.x
            world_z = -vertex.co.y
            u = (world_x - bounds["xMin"]) / span_x
            v = (world_z - bounds["zMin"]) / span_z
            uv_layer.data[loop_index].uv = (u, v)


def build_band_mesh(asset_id, band, cells, visual_lift, material, root, world_planar):
    vertices = []
    faces = []
    for corners in cells:
        base = len(vertices)
        vertices.extend(three_to_blender(point, visual_lift) for point in corners)
        faces.append((base, base + 1, base + 2, base + 3))
    safe = band.upper().replace("-", "_")
    mesh = bpy.data.meshes.new(f"{asset_id}_{safe}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    add_world_planar_uv(mesh, world_planar)
    obj = bpy.data.objects.new(f"{asset_id}_{safe}", mesh)
    obj.parent = root
    obj.data.materials.append(material)
    obj["pulpa_lab_visual_only"] = True
    obj["pulpa_lab_terrain_band"] = band
    obj["pulpa_lab_authoritative_height"] = False
    obj["pulpa_lab_uv_projection"] = "world-xz"
    bpy.context.collection.objects.link(obj)
    return obj


def make_overlay_material(name, alpha):
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    color = (0.20, 0.16, 0.12, float(alpha))
    material.diffuse_color = color
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.98
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Alpha"].default_value = float(alpha)
    if hasattr(material, "surface_render_method"):
        material.surface_render_method = "DITHERED"
    elif hasattr(material, "blend_method"):
        material.blend_method = "BLEND"
    material["pulpa_lab_visual_only"] = True
    material["pulpa_lab_traffic_overlay"] = True
    return material


def build_irregular_patch(overlay, sample_height, lift, root):
    cx, cz = overlay["center"]
    rx, rz = overlay["radiiM"]
    angle = math.radians(float(overlay.get("rotationDeg", 0.0)))
    rng = np.random.default_rng(int(overlay["seed"]))
    segments = 28
    ring = []
    for index in range(segments):
        theta = math.tau * index / segments
        jitter = 0.84 + float(rng.uniform(-0.08, 0.13))
        lx = math.cos(theta) * rx * jitter
        lz = math.sin(theta) * rz * (0.90 + float(rng.uniform(-0.07, 0.10)))
        x = cx + lx * math.cos(angle) - lz * math.sin(angle)
        z = cz + lx * math.sin(angle) + lz * math.cos(angle)
        ring.append((x, -z, sample_height(x, z) + lift))
    center = (cx, -cz, sample_height(cx, cz) + lift)
    vertices = [center, *ring]
    faces = []
    for index in range(segments):
        faces.append((0, 1 + index, 1 + ((index + 1) % segments)))
    mesh = bpy.data.meshes.new(f"{overlay['id']}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(overlay["id"], mesh)
    obj.parent = root
    obj.data.materials.append(make_overlay_material(f"V26_{overlay['id']}_MAT", overlay["alpha"]))
    obj["pulpa_lab_visual_only"] = True
    obj["pulpa_lab_overlay_type"] = "irregular-patch"
    bpy.context.collection.objects.link(obj)
    return obj


def build_ribbon(overlay, sample_height, lift, root):
    points = overlay["points"]
    width = float(overlay["widthM"])
    vertices = []
    for index, (x, z) in enumerate(points):
        if index == 0:
            dx, dz = points[1][0] - x, points[1][1] - z
        elif index == len(points) - 1:
            dx, dz = x - points[index - 1][0], z - points[index - 1][1]
        else:
            dx, dz = points[index + 1][0] - points[index - 1][0], points[index + 1][1] - points[index - 1][1]
        length = max(1e-6, math.hypot(dx, dz))
        nx, nz = -dz / length, dx / length
        for sign in (-1.0, 1.0):
            px = x + nx * width * 0.5 * sign
            pz = z + nz * width * 0.5 * sign
            vertices.append((px, -pz, sample_height(px, pz) + lift))
    faces = []
    for index in range(len(points) - 1):
        base = index * 2
        faces.append((base, base + 1, base + 3, base + 2))
    mesh = bpy.data.meshes.new(f"{overlay['id']}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(overlay["id"], mesh)
    obj.parent = root
    obj.data.materials.append(make_overlay_material(f"V26_{overlay['id']}_MAT", overlay["alpha"]))
    obj["pulpa_lab_visual_only"] = True
    obj["pulpa_lab_overlay_type"] = "ribbon"
    bpy.context.collection.objects.link(obj)
    return obj


def main():
    if not CONTRACT_PATH.exists():
        raise RuntimeError(f"Missing V26 terrain contract: {CONTRACT_PATH}")
    payload = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    if payload.get("assetId") != "RECEPTION-EARTHWORK-V26":
        raise RuntimeError("Unexpected V26 terrain contract assetId")
    if payload.get("worldUnitsPerMeter") != 1:
        raise RuntimeError("V26 terrain contract must use one world unit per metre")
    if payload.get("worldPlanar", {}).get("projection") != "world-xz":
        raise RuntimeError("V26 contract must request world-xz planar UVs")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene["pulpa_lab_asset"] = payload["assetId"]
    scene["pulpa_lab_source"] = payload["source"]
    scene["pulpa_lab_visual_only"] = True
    scene["pulpa_lab_authoritative_height"] = False
    scene["pulpa_lab_contract_hash"] = payload["contractHash"]

    root = bpy.data.objects.new(payload["assetId"], None)
    root["pulpa_lab_visual_only"] = True
    root["pulpa_lab_authoritative_height"] = False
    root["pulpa_lab_world_units_per_meter"] = 1.0
    root["pulpa_lab_contract_hash"] = payload["contractHash"]
    bpy.context.collection.objects.link(root)

    x_values = payload["grid"]["xValues"]
    z_values = payload["grid"]["zValues"]
    heights = payload["grid"]["heights"]
    bands = payload["grid"]["cellBands"]
    band_cells = {name: [] for name in payload["pbrProfiles"]}
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

    texture_paths = []
    materials = {}
    for band, profile in payload["pbrProfiles"].items():
        material, paths = build_pbr_material(band, profile, payload["worldPlanar"])
        materials[band] = material
        texture_paths.extend(paths)

    objects = []
    for band, cells in band_cells.items():
        if not cells:
            continue
        objects.append(build_band_mesh(
            payload["assetId"], band, cells, payload["visualLiftM"], materials[band], root, payload["worldPlanar"]
        ))
    if not objects:
        raise RuntimeError("V26 terrain contract did not produce earthwork cells")

    sample_height = terrain_height_sampler(payload)
    overlay_objects = []
    for overlay in payload.get("trafficOverlays", []):
        if overlay["type"] == "irregular-patch":
            overlay_objects.append(build_irregular_patch(overlay, sample_height, payload["overlayLiftM"], root))
        elif overlay["type"] == "ribbon":
            overlay_objects.append(build_ribbon(overlay, sample_height, payload["overlayLiftM"], root))
        else:
            raise RuntimeError(f"Unsupported V26 overlay type: {overlay['type']}")

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in [*objects, *overlay_objects]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_PATH),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_materials="EXPORT",
    )

    report = {
        "asset": payload["assetId"],
        "contract": str(CONTRACT_PATH),
        "contractHash": payload["contractHash"],
        "output": str(OUTPUT_PATH),
        "bytes": OUTPUT_PATH.stat().st_size,
        "objects": [obj.name for obj in objects],
        "overlays": [obj.name for obj in overlay_objects],
        "cells": {band: len(cells) for band, cells in band_cells.items()},
        "textures": [str(path) for path in texture_paths],
        "uvProjection": payload["worldPlanar"]["projection"],
        "textureResolutionPx": payload["worldPlanar"]["textureResolutionPx"],
        "textureWrap": payload["worldPlanar"]["wrap"],
        "authoritativeHeight": False,
    }
    BUILD_REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
