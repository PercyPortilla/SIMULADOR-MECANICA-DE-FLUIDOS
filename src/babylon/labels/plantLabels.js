import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { PLANT_ZONE_ORDER, getPlantZone } from '../../scene/layout/plantLayout.js';
import {
  EQUIPMENT_LABEL_DEFINITIONS,
  LABEL_ASPECT,
  SMALL_LABEL_ASPECT,
  getLabelPresentationForCamera,
} from '../../scene/labels/labelContracts.js';

function createLabelTexture(scene, name, lines, { inspection = false, width = 520, height = 104 } = {}) {
  if (typeof document === 'undefined') return null;
  const texture = new DynamicTexture(`${name}-texture`, { width, height }, scene, true);
  texture.hasAlpha = true;
  const context = texture.getContext();
  context.clearRect(0, 0, width, height);
  context.fillStyle = inspection ? 'rgba(5,24,31,0.95)' : 'rgba(8,18,23,0.91)';
  context.strokeStyle = inspection ? 'rgba(109,220,232,0.92)' : 'rgba(232,236,231,0.66)';
  context.lineWidth = inspection ? 4 : 3;
  const margin = 8;
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(margin, margin, width - margin * 2, height - margin * 2, 16);
    context.fill();
    context.stroke();
  } else {
    context.fillRect(margin, margin, width - margin * 2, height - margin * 2);
    context.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
  }
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  if (lines.length === 2) {
    context.fillStyle = '#dce7ea';
    context.font = '700 25px sans-serif';
    context.fillText(lines[0], width / 2, height * 0.36);
    context.fillStyle = '#ffc568';
    context.font = '800 32px sans-serif';
    context.fillText(lines[1], width / 2, height * 0.68);
  } else {
    const text = String(lines[0] ?? '');
    context.fillStyle = inspection ? '#7de3ed' : '#ffc568';
    let fontSize = inspection ? 35 : 34;
    context.font = `800 ${fontSize}px sans-serif`;
    while (fontSize > 22 && context.measureText(text).width > width - 46) {
      fontSize -= 1;
      context.font = `800 ${fontSize}px sans-serif`;
    }
    context.fillText(text, width / 2, height / 2 + 1);
  }
  texture.update(false);
  // With billboard planes in a right-handed scene we see the plane's opposite
  // UV handedness. Mirror U once so text is not horizontally reversed.
  texture.uScale = -1;
  texture.uOffset = 1;
  return texture;
}

function createPlaneLabel(scene, root, {
  name,
  textLines,
  width,
  aspect,
  metadata,
  opacity = 0.9,
  inspection = false,
  textureSize = null,
}) {
  const texture = createLabelTexture(scene, name, textLines, {
    inspection,
    ...(textureSize ?? {}),
  });
  if (!texture) return null;
  const plane = CreatePlane(name, { width, height: width * aspect }, scene);
  plane.parent = root;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  // Babylon's built-in billboard basis is 180° around the plane normal in our
  // right-handed scene. Keep the billboard behavior but compensate so the
  // canvas text remains upright/readable from every camera preset.
  plane.rotation.z = Math.PI;
  plane.isPickable = false;
  plane.renderingGroupId = 3;
  plane.alwaysSelectAsActiveMesh = true;
  const labelMaterial = new StandardMaterial(`${name}-material`, scene);
  labelMaterial.diffuseTexture = texture;
  labelMaterial.emissiveTexture = texture;
  labelMaterial.emissiveColor = Color3.White();
  labelMaterial.diffuseColor = Color3.White();
  labelMaterial.specularColor = Color3.Black();
  labelMaterial.disableLighting = true;
  labelMaterial.backFaceCulling = false;
  labelMaterial.useAlphaFromDiffuseTexture = true;
  labelMaterial.alpha = opacity;
  labelMaterial.disableDepthWrite = true;
  plane.material = labelMaterial;
  plane.metadata = {
    ...metadata,
    plantLabel: true,
    baseWidth: width,
    aspect,
    presentationScale: 1,
    presentationVisible: true,
    maxDistance: metadata?.labelKind === 'zone'
      ? 980
      : metadata?.labelKind === 'inspection'
        ? Infinity
        : metadata?.labelKind === 'component'
          ? 40
          : 720,
  };
  return plane;
}

function hierarchyBounds(target) {
  const bounds = target?.getHierarchyBoundingVectors?.(true);
  if (!bounds?.min || !bounds?.max) return null;
  const size = bounds.max.subtract(bounds.min);
  if (![size.x, size.y, size.z].every(Number.isFinite) || size.lengthSquared() <= 1e-12) return null;
  return { min: bounds.min.clone(), max: bounds.max.clone(), size, center: Vector3.Center(bounds.min, bounds.max) };
}

function componentLabelText(mesh) {
  const name = String(mesh?.name ?? '').trim();
  const semanticLabels = [
    [/impeller/i, 'IMPULSOR'], [/motor/i, 'MOTOR'], [/inlet|feed/i, 'ENTRADA'],
    [/outlet|discharge/i, 'SALIDA'], [/volute/i, 'VOLUTA'], [/casing|shell/i, 'CARCASA'],
    [/belt/i, 'FAJA'], [/drum/i, 'TAMBOR'], [/rotor/i, 'ROTOR'], [/chute/i, 'CHUTE'],
    [/tank/i, 'TANQUE'], [/cell/i, 'CELDA'],
  ];
  return semanticLabels.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}

export function createBabylonPlantLabels({ scene, equipmentSystem } = {}) {
  if (!scene) throw new TypeError('Babylon labels require a Scene.');
  const root = new TransformNode('plant-labels', scene);
  root.metadata = { labelsVisible: true, cameraMode: 'general', presentationMode: false };
  const labels = [];
  let inspectionSelection = null;
  const componentLabels = [];

  if (typeof document !== 'undefined') {
    PLANT_ZONE_ORDER.forEach((zoneId) => {
      const zone = getPlantZone(zoneId);
      const baseWidth = Math.min(12.0, Math.max(7.2, zone.width * 0.48));
      const label = createPlaneLabel(scene, root, {
        name: `${zone.id}-plant-label`,
        textLines: [zone.id, zone.name],
        width: baseWidth,
        aspect: LABEL_ASPECT,
        metadata: { zoneId: zone.id, labelKind: 'zone' },
        textureSize: { width: 768, height: 144 },
      });
      if (label) {
        label.position.set(zone.position.x, zone.elevation + 6.0, zone.position.z);
        labels.push(label);
      }
    });
    EQUIPMENT_LABEL_DEFINITIONS.forEach((definition) => {
      const width = Math.max(3.4, Math.min(5.8, definition.text.length * 0.62 + 2.0));
      const label = createPlaneLabel(scene, root, {
        name: `${definition.equipmentId}-detail-label`,
        textLines: [definition.text],
        width,
        aspect: SMALL_LABEL_ASPECT,
        metadata: { ...definition, labelKind: 'equipment' },
        opacity: 0.82,
      });
      if (label) labels.push(label);
    });
    const pipe1 = createPlaneLabel(scene, root, {
      name: 'pipe1-detail-label',
      textLines: ['PIPE 1'],
      width: 5.7,
      aspect: SMALL_LABEL_ASPECT,
      metadata: { equipmentId: 'PIPE-1-LABEL', zoneId: 'Z6', lift: 1.25, labelKind: 'equipment', dynamicPipe1: true },
      opacity: 0.82,
    });
    if (pipe1) labels.push(pipe1);
  }

  function updatePositions() {
    labels.forEach((label) => {
      const metadata = label.metadata ?? {};
      if (metadata.dynamicPipe1) {
        try {
          const start = equipmentSystem?.getPortWorldPosition('R-01', 'outlet');
          const end = equipmentSystem?.getPortWorldPosition('R-02', 'inlet');
          if (start && end) {
            label.position.copyFrom(Vector3.Lerp(start, end, 0.5));
            label.position.y += metadata.lift ?? 1.25;
          }
        } catch {}
        return;
      }
      if (metadata.labelKind !== 'equipment' || !metadata.equipmentId) return;
      try {
        const equipment = equipmentSystem?.getEquipment(metadata.equipmentId);
        const position = equipment?.root?.getAbsolutePosition?.() ?? equipment?.group3D?.getAbsolutePosition?.();
        if (position) {
          label.position.copyFrom(position);
          label.position.y += metadata.lift ?? 3;
        }
      } catch {}
    });
  }

  function setView(cameraId) {
    root.metadata.cameraMode = cameraId;
    [...labels, ...(inspectionSelection ? [inspectionSelection] : []), ...componentLabels].forEach((label) => {
      const metadata = label.metadata ?? {};
      const profile = getLabelPresentationForCamera(metadata.zoneId, cameraId, metadata.labelKind);
      metadata.presentationVisible = profile.visible;
      metadata.presentationScale = profile.scale;
      if (label.material) label.material.alpha = profile.opacity;
      const priority = metadata.labelKind === 'inspection' || metadata.labelKind === 'component';
      const allowed = root.metadata.labelsVisible !== false || (root.metadata.presentationMode === true && priority);
      label.isVisible = profile.visible && allowed;
      metadata.maxDistance = cameraId === 'inspection' && metadata.labelKind === 'equipment' ? 36 : metadata.maxDistance;
    });
  }

  function setVisible(visible) {
    root.metadata.labelsVisible = Boolean(visible);
    root.setEnabled(Boolean(visible) || root.metadata.presentationMode === true);
    setView(root.metadata.cameraMode);
  }

  function setPresentationMode(active) {
    root.metadata.presentationMode = Boolean(active);
    root.setEnabled(root.metadata.labelsVisible !== false || root.metadata.presentationMode);
    setView(root.metadata.cameraMode);
  }

  function removeInspectionLabels() {
    if (inspectionSelection) {
      inspectionSelection.material?.diffuseTexture?.dispose?.();
      inspectionSelection.material?.dispose?.();
      inspectionSelection.dispose(false, false);
      inspectionSelection = null;
    }
    while (componentLabels.length) {
      const label = componentLabels.pop();
      label.material?.diffuseTexture?.dispose?.();
      label.material?.dispose?.();
      label.dispose(false, false);
    }
  }

  function updateInspectionLabelPosition(label) {
    const framing = label?.metadata?.inspectionFraming;
    const target = label?.metadata?.targetObject;
    if (!label || !target) return;
    if (framing?.center && framing?.size) {
      label.position.set(
        framing.center.x,
        framing.center.y + framing.size.y / 2 + Math.max(0.90, framing.size.y * 0.16),
        framing.center.z,
      );
      return;
    }
    const bounds = hierarchyBounds(target);
    if (!bounds) return;
    label.position.set(bounds.center.x, bounds.max.y + Math.max(0.65, bounds.size.y * 0.12), bounds.center.z);
  }

  function createComponentLabels(target) {
    if (typeof document === 'undefined' || !target) return;
    const candidates = target.getChildMeshes?.(false) ?? [];
    const used = new Set();
    for (const mesh of candidates) {
      if (componentLabels.length >= 3) break;
      const text = componentLabelText(mesh);
      if (!text || used.has(text)) continue;
      const bounds = hierarchyBounds(mesh);
      if (!bounds) continue;
      used.add(text);
      const label = createPlaneLabel(scene, root, {
        name: `inspection-component-label-${componentLabels.length + 1}`,
        textLines: [text],
        width: Math.max(2.5, Math.min(4.7, text.length * 0.28 + 1.55)),
        aspect: SMALL_LABEL_ASPECT,
        metadata: { labelKind: 'component', targetObject: mesh, text, zoneId: null },
        opacity: 0.9,
        inspection: true,
      });
      if (!label) continue;
      label.position.set(bounds.center.x, bounds.max.y + Math.max(0.28, bounds.size.y * 0.10), bounds.center.z);
      componentLabels.push(label);
    }
  }

  function setInspectionTarget(target, text = '', framing = null) {
    removeInspectionLabels();
    root.metadata.inspectionTargetId = target?.name ?? null;
    if (!target || !text || typeof document === 'undefined') return null;
    inspectionSelection = createPlaneLabel(scene, root, {
      name: 'inspection-selection-label',
      textLines: [text],
      width: Math.max(3.8, Math.min(6.4, String(text).length * 0.34 + 2.0)),
      aspect: SMALL_LABEL_ASPECT,
      metadata: {
        zoneId: null,
        labelKind: 'inspection',
        targetObject: target,
        text,
        inspectionFraming: framing ? {
          focused: framing.focused === true,
          center: framing.center?.clone?.() ?? null,
          size: framing.size?.clone?.() ?? null,
        } : null,
      },
      opacity: 1,
      inspection: true,
    });
    if (inspectionSelection) {
      updateInspectionLabelPosition(inspectionSelection);
      createComponentLabels(target);
      setView(root.metadata.cameraMode);
    }
    return inspectionSelection;
  }

  function refreshInspectionComponents() {
    const target = inspectionSelection?.metadata?.targetObject ?? null;
    if (!target) return [];
    while (componentLabels.length) {
      const label = componentLabels.pop();
      label.material?.diffuseTexture?.dispose?.();
      label.material?.dispose?.();
      label.dispose(false, false);
    }
    createComponentLabels(target);
    setView(root.metadata.cameraMode);
    return [...componentLabels];
  }

  function updateForCamera(camera) {
    if (!camera || !root.isEnabled()) return false;
    updatePositions();
    if (inspectionSelection) updateInspectionLabelPosition(inspectionSelection);
    let changed = false;
    [...labels, ...(inspectionSelection ? [inspectionSelection] : []), ...componentLabels].forEach((label) => {
      const metadata = label.metadata ?? {};
      const distance = Vector3.Distance(camera.position, label.position);
      const priority = metadata.labelKind === 'inspection' || metadata.labelKind === 'component';
      const allowed = root.metadata.labelsVisible !== false || (root.metadata.presentationMode === true && priority);
      const visible = allowed && (metadata.presentationVisible ?? true) && distance <= (metadata.maxDistance ?? Infinity);
      if (label.isVisible !== visible) changed = true;
      label.isVisible = visible;
      if (!visible) return;
      const baseWidth = metadata.baseWidth ?? 1;
      const presentationScale = metadata.presentationScale ?? 1;
      let distanceScale = 1;
      if (metadata.labelKind === 'zone') distanceScale = Math.max(0.82, Math.min(4.8, distance / 150));
      else if (metadata.labelKind === 'inspection') distanceScale = Math.max(0.66, Math.min(1.40, distance / 16));
      else if (metadata.labelKind === 'component') distanceScale = Math.max(0.50, Math.min(1.05, distance / 12));
      else distanceScale = Math.max(0.82, Math.min(3.2, distance / 75));
      const scale = presentationScale * distanceScale;
      if (Math.abs(label.scaling.x - scale) > 1e-4) changed = true;
      label.scaling.set(scale, scale, scale);
      metadata.renderedWidthM = baseWidth * scale;
    });
    return changed;
  }

  updatePositions();
  setView('general');
  return {
    root,
    labels,
    componentLabels,
    setView,
    setVisible,
    setPresentationMode,
    setInspectionTarget,
    refreshInspectionComponents,
    updatePositions,
    updateForCamera,
    get labelsVisible() { return root.metadata.labelsVisible !== false; },
    dispose() {
      removeInspectionLabels();
      labels.forEach((label) => {
        label.material?.diffuseTexture?.dispose?.();
        label.material?.dispose?.();
        label.dispose(false, false);
      });
      labels.length = 0;
      root.dispose();
    },
  };
}
