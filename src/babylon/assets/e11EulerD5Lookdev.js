/**
 * E11 — non-destructive D5-style look-development for the REAL L394 Euler
 * Babylon AssetContainer. The signed GLB, CAD positions, scene controls and
 * solver are NEVER modified. Only Babylon material clones and existing light
 * settings are adjusted while the Euler view is visible.
 *
 * D5 is the visual reference, not a real-time renderer in the browser. No D5
 * scene file or exported texture is required at runtime.
 */

export const E11_EULER_D5_PROFILE = Object.freeze({
  exposure: 0.96,
  contrast: 1.16,
  lights: Object.freeze({
    'ambient-industrial-light': 0.98,
    'mine-sun-key-light': 1.42,
    'soft-fill-light': 0.46,
    'warm-ground-bounce': 0.21,
  }),
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Keep educational flow visibility, transparent surfaces and signals intact. */
export function classifyE11EulerSurface(name = '') {
  const value = String(name).toUpperCase();
  if (/SLURRY(?!_PIPE)|FLUID|OVERFLOW|UNDERFLOW|AIR_CORE|TRANSPARENT|MARKER|BACKLIT|OPAL|FIXTURE|SUMP_SURFACE|GAUGE/.test(value)) return null;
  if (/CONCRETE|SAG_ORE/.test(value)) return 'mineral';
  if (/RUBBER|LINER|ANTISLIP/.test(value)) return 'liner';
  if (/SILVER_SATIN/.test(value)) return 'satin';
  if (/GALV|STAINLESS|FASTENER|MACHINED/.test(value)) return 'galvanized';
  if (/NATIVE_SW2026|REAL_CAD_STEEL/.test(value)) return 'cad';
  if (/STEEL|GRAPHITE|SHELL|CHUTE|ANCHOR|SLURRY_PIPE|CAST_PUMP/.test(value)) return 'structural';
  if (/PAINT|POWDERCOAT|GUARD|VALVE|COPPER|INSPECTION_PANELS/.test(value)) return 'coated';
  return null;
}

function tuneMaterial(material, surface) {
  // Babylon PBRMaterial preserves the original GLB's albedo/normal textures,
  // alpha, render group and emissive channels through clone().
  const rough = Number(material.roughness);
  const metal = Number(material.metallic);
  if (!Number.isFinite(rough) || !Number.isFinite(metal)) return false;
  switch (surface) {
    case 'mineral':
      material.metallic = 0;
      material.roughness = Math.max(rough, .94);
      break;
    case 'liner':
      material.metallic = Math.min(metal, .14);
      material.roughness = Math.max(rough, .86);
      break;
    case 'satin':
      material.metallic = .68;
      material.roughness = .47;
      break;
    case 'galvanized':
      material.metallic = clamp(metal, .43, .70);
      material.roughness = Math.max(rough, .53);
      break;
    case 'structural':
      material.metallic = clamp(metal, .32, .67);
      material.roughness = Math.max(rough, .58);
      break;
    case 'coated':
      material.metallic = Math.min(metal, .38);
      material.roughness = Math.max(rough, .61);
      break;
    case 'cad':
      material.metallic = .61;
      material.roughness = .55;
      // Raw educational CAD is white-hot under the existing mine sun.
      // Reduce only the clone's base color; preserve genuine CAD geometry.
      if (typeof material.albedoColor?.scale === 'function') {
        material.albedoColor = material.albedoColor.scale(.87);
      }
      break;
    default:
      return false;
  }
  return true;
}

/**
 * Apply once on Euler enter; call restore() on EVERY exit, exception or
 * disposal. Never retune source GLB material instances in place.
 */
export function applyE11EulerD5Lookdev({ scene, container } = {}) {
  const replacedMeshes = new Map();
  const clonedMaterials = new Map();
  const originalLights = new Map();
  const processing = scene?.imageProcessingConfiguration;
  const imageBefore = processing ? {
    exposure: processing.exposure,
    contrast: processing.contrast,
  } : null;
  let active = false;
  let settingsChanged = false;

  function restore() {
    if (!active && !settingsChanged && !replacedMeshes.size && !originalLights.size) return;
    // Restore meshes first. Clones can then be disposed without leaving
    // a dangling Babylon material on a cached AssetContainer mesh.
    for (const [mesh, original] of replacedMeshes) mesh.material = original;
    replacedMeshes.clear();
    for (const cloned of clonedMaterials.values()) cloned.dispose?.();
    clonedMaterials.clear();
    for (const [light, intensity] of originalLights) light.intensity = intensity;
    originalLights.clear();
    if (processing && imageBefore) {
      processing.exposure = imageBefore.exposure;
      processing.contrast = imageBefore.contrast;
    }
    active = false;
    settingsChanged = false;
  }

  try {
    if (processing) {
      settingsChanged = true;
      processing.exposure = E11_EULER_D5_PROFILE.exposure;
      processing.contrast = E11_EULER_D5_PROFILE.contrast;
    }
    for (const light of scene?.lights ?? []) {
      const requested = E11_EULER_D5_PROFILE.lights[light.name];
      if (typeof requested !== 'number' || !Number.isFinite(light.intensity)) continue;
      originalLights.set(light, light.intensity);
      light.intensity = requested;
    }
    for (const mesh of container?.meshes ?? []) {
      // Babylon InstancedMesh gets its material from sourceMesh. Assigning to
      // each instance has no effect, triggers hundreds of console warnings,
      // and can inflate clone counts in a large authentic L384 import.
      if (mesh?.isAnInstance === true || mesh?.sourceMesh) continue;
      const original = mesh?.material;
      const surface = classifyE11EulerSurface(original?.name);
      if (!surface || !original || typeof original.clone !== 'function' ||
          typeof original.roughness !== 'number' || typeof original.metallic !== 'number' ||
          original.alpha < .999) continue;
      let clone = clonedMaterials.get(original);
      if (!clone) {
        clone = original.clone(`${original.name}_E11_D5_EULER_ONLY`);
        if (!clone) continue;
        if (!tuneMaterial(clone, surface)) { clone.dispose?.(); continue; }
        clonedMaterials.set(original, clone);
      }
      replacedMeshes.set(mesh, original);
      mesh.material = clone;
    }
    active = true;
  } catch (error) {
    restore();
    throw error;
  }

  return {
    restore,
    get status() {
      return Object.freeze({
        active,
        tunedMeshes: replacedMeshes.size,
        clonedMaterials: clonedMaterials.size,
        adjustedLights: originalLights.size,
        originalMaterialsUnchanged: true,
        uiModified: false,
        signedCadModified: false,
        solverModified: false,
      });
    },
  };
}
