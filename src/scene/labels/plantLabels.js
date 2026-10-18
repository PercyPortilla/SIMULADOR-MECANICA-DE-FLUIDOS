import * as THREE from 'three';
import { PLANT_ZONE_ORDER, getPlantZone } from '../layout/plantLayout.js';

const LABEL_ASPECT = 144 / 768;
const SMALL_LABEL_ASPECT = 104 / 520;
const OVERVIEW_CAMERAS = new Set(['general', 'top', 'oblique']);
const CAMERA_FOCUS_ZONES = Object.freeze({
  reception: Object.freeze(['Z1']),
  crushing: Object.freeze(['Z2', 'Z3']),
  grinding: Object.freeze(['Z4', 'Z5']),
  leaching: Object.freeze(['Z6', 'Z7']),
  recovery: Object.freeze(['Z8', 'Z7']),
});

const EQUIPMENT_LABELS = Object.freeze([
  { equipmentId: 'ROM-HOPPER', text: 'ROM', zoneId: 'Z1', lift: 7.4 },
  { equipmentId: 'APRON-FEEDER', text: 'APRON', zoneId: 'Z1', lift: 3.3 },
  { equipmentId: 'PRIMARY-CRUSHER', text: 'CHANCADORA', zoneId: 'Z2', lift: 8.2 },
  { equipmentId: 'STOCKPILE-RECLAIM', text: 'STOCKPILE', zoneId: 'Z3', lift: 11.2 },
  { equipmentId: 'MILL-01', text: 'MILL-01', zoneId: 'Z4', lift: 5.8 },
  { equipmentId: 'SLURRY-PUMP-01', text: 'P-CLASIF.', zoneId: 'Z5', lift: 3.4 },
  { equipmentId: 'CLASS-01', text: 'CICLONES', zoneId: 'Z5', lift: 8.0 },
  { equipmentId: 'R-01', text: 'R-01', zoneId: 'Z6', lift: 8.6 },
  { equipmentId: 'R-02', text: 'R-02', zoneId: 'Z6', lift: 8.6 },
  { equipmentId: 'R-03', text: 'R-03', zoneId: 'Z6', lift: 8.6 },
  { equipmentId: 'R-04', text: 'R-04', zoneId: 'Z6', lift: 8.6 },
  { equipmentId: 'PUMP-01', text: 'PUMP-01', zoneId: 'Z7', lift: 3.5 },
  { equipmentId: 'CIP-ADSORPTION', text: 'CIP', zoneId: 'Z8', lift: 4.2 },
  { equipmentId: 'ELUTION-SKID', text: 'ELUCIÓN', zoneId: 'Z8', lift: 4.2 },
  { equipmentId: 'EW-CELLS', text: 'EW', zoneId: 'Z8', lift: 3.0 },
  { equipmentId: 'SMELTING-FURNACE', text: 'FUNDICIÓN', zoneId: 'Z8', lift: 5.2 },
]);

function prepareTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function createLabelTexture(zone) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 144;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = 'rgba(0, 0, 0, 0.52)';
  context.shadowBlur = 10;
  context.fillStyle = 'rgba(8, 18, 23, 0.92)';
  context.roundRect(12, 12, canvas.width - 24, canvas.height - 24, 18);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(238, 228, 202, 0.78)';
  context.lineWidth = 3;
  context.stroke();

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#dce7ea';
  context.font = '700 25px sans-serif';
  context.fillText(zone.id, canvas.width / 2, 45);
  context.fillStyle = '#ffc568';
  context.font = '800 32px sans-serif';
  context.fillText(zone.name, canvas.width / 2, 95);

  return prepareTexture(new THREE.CanvasTexture(canvas));
}

function createSmallTexture(text, accent = '#ffc568', { inspection = false } = {}) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 104;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = 'rgba(0, 0, 0, 0.58)';
  context.shadowBlur = 9;
  context.fillStyle = inspection ? 'rgba(5, 24, 31, 0.95)' : 'rgba(8, 18, 23, 0.90)';
  context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 16);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = inspection ? 'rgba(109, 220, 232, 0.92)' : 'rgba(232, 236, 231, 0.66)';
  context.lineWidth = inspection ? 4 : 3;
  context.stroke();
  context.fillStyle = accent;
  const maxFontSize = inspection ? 35 : 34;
  const minFontSize = inspection ? 24 : 25;
  const maxTextWidth = canvas.width - 46;
  let fontSize = maxFontSize;
  context.font = `800 ${fontSize}px sans-serif`;
  while (fontSize > minFontSize && context.measureText(String(text)).width > maxTextWidth) {
    fontSize -= 1;
    context.font = `800 ${fontSize}px sans-serif`;
  }
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
  return prepareTexture(new THREE.CanvasTexture(canvas));
}

function getBaseLabelWidth(zone) {
  return Math.min(12.0, Math.max(7.2, zone.width * 0.48));
}

export function getLabelPresentationForCamera(zoneId, cameraId, kind = 'zone') {
  if (kind === 'inspection') {
    return Object.freeze({ visible: cameraId === 'inspection', opacity: cameraId === 'inspection' ? 1 : 0, scale: 1 });
  }
  if (kind === 'component') {
    return Object.freeze({ visible: cameraId === 'inspection', opacity: cameraId === 'inspection' ? 0.90 : 0, scale: 0.82 });
  }
  if (cameraId === 'inspection') {
    // V30 keeps Inspection intentionally uncluttered: the selected equipment
    // label and at most three semantic component labels are the only labels
    // allowed to survive this camera mode.
    if (kind === 'equipment') return Object.freeze({ visible: false, opacity: 0, scale: 0.72 });
    return Object.freeze({ visible: false, opacity: 0, scale: 0.72 });
  }
  const focusZones = CAMERA_FOCUS_ZONES[cameraId] ?? [];

  if (kind === 'equipment') {
    if (focusZones.includes(zoneId)) return Object.freeze({ visible: true, opacity: 0.98, scale: 1.08 });
    if (cameraId === 'general' || cameraId === 'oblique') return Object.freeze({ visible: true, opacity: 0.72, scale: 0.90 });
    if (cameraId === 'top') return Object.freeze({ visible: true, opacity: 0.70, scale: 0.88 });
    return Object.freeze({ visible: false, opacity: 0, scale: 0.7 });
  }

  if (OVERVIEW_CAMERAS.has(cameraId)) {
    return Object.freeze({ visible: true, opacity: cameraId === 'top' ? 0.82 : 0.90, scale: 1 });
  }
  if (focusZones.includes(zoneId)) {
    return Object.freeze({ visible: true, opacity: 0.98, scale: 1.10 });
  }
  return Object.freeze({ visible: true, opacity: 0.28, scale: 0.76 });
}

function createSprite(texture, { width, aspect, name, userData, opacity = 0.9 }) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = name;
  sprite.scale.set(width, width * aspect, 1);
  sprite.center.set(0.5, 0.08);
  sprite.renderOrder = 120;
  sprite.frustumCulled = true;
  sprite.userData = {
    ...userData,
    plantLabel: true,
    baseWidth: width,
    aspect,
    presentationScale: 1,
    presentationVisible: true,
    maxDistance: userData?.labelKind === 'zone' ? 980 : userData?.labelKind === 'inspection' ? Infinity : userData?.labelKind === 'component' ? 40 : 720,
  };
  return sprite;
}

function createZoneLabel(zone) {
  const texture = createLabelTexture(zone);
  if (!texture) return null;
  const width = getBaseLabelWidth(zone);
  const sprite = createSprite(texture, {
    width,
    aspect: LABEL_ASPECT,
    name: `${zone.id}-plant-label`,
    userData: { zoneId: zone.id, labelKind: 'zone' },
    opacity: 0.9,
  });
  sprite.position.set(zone.position.x, zone.elevation + 6.0, zone.position.z);
  return sprite;
}

function createEquipmentLabel(definition, equipmentSystem) {
  const texture = createSmallTexture(definition.text, definition.text === 'PIPE 1' ? '#ff7968' : '#ffc568');
  if (!texture) return null;
  const width = Math.max(3.4, Math.min(5.8, definition.text.length * 0.62 + 2.0));
  const sprite = createSprite(texture, {
    width,
    aspect: SMALL_LABEL_ASPECT,
    name: `${definition.equipmentId}-detail-label`,
    userData: { ...definition, labelKind: 'equipment' },
    opacity: 0.82,
  });
  const equipment = equipmentSystem?.getEquipment(definition.equipmentId);
  if (equipment) sprite.position.copy(equipment.group3D.position).add(new THREE.Vector3(0, definition.lift, 0));
  return sprite;
}

function createPipe1Label(equipmentSystem) {
  const definition = { equipmentId: 'PIPE-1-LABEL', text: 'PIPE 1', zoneId: 'Z6', lift: 1.25 };
  const sprite = createEquipmentLabel(definition, null);
  if (!sprite) return null;
  sprite.name = 'pipe1-detail-label';
  sprite.userData.dynamicPipe1 = true;
  updatePipe1Label(sprite, equipmentSystem);
  return sprite;
}

function updatePipe1Label(label, equipmentSystem) {
  if (!label || !equipmentSystem) return;
  const start = equipmentSystem.getPortWorldPosition('R-01', 'outlet');
  const end = equipmentSystem.getPortWorldPosition('R-02', 'inlet');
  label.position.copy(start).lerp(end, 0.5);
  label.position.y += label.userData.lift ?? 1.25;
}

function removeInspectionComponentLabels(group) {
  if (!group) return;
  [...group.children]
    .filter((child) => child.userData?.labelKind === 'component')
    .forEach((child) => {
      child.material?.map?.dispose?.();
      child.material?.dispose?.();
      group.remove(child);
    });
}

function componentLabelText(object) {
  const name = String(object?.name ?? '').trim();
  if (!name) return null;
  const semanticLabels = [
    [/impeller/i, 'IMPULSOR'],
    [/motor/i, 'MOTOR'],
    [/inlet|feed/i, 'ENTRADA'],
    [/outlet|discharge/i, 'SALIDA'],
    [/volute/i, 'VOLUTA'],
    [/casing|shell/i, 'CARCASA'],
    [/belt/i, 'FAJA'],
    [/drum/i, 'TAMBOR'],
    [/rotor/i, 'ROTOR'],
    [/chute/i, 'CHUTE'],
    [/tank/i, 'TANQUE'],
    [/cell/i, 'CELDA'],
  ];
  const semantic = semanticLabels.find(([pattern]) => pattern.test(name));
  return semantic?.[1] ?? null;
}

function createInspectionComponentLabels(group, target) {
  removeInspectionComponentLabels(group);
  if (!group || !target) return [];
  const candidates = [];
  target.traverse((object) => {
    if (!object?.isMesh || !object.visible || !object.name) return;
    const explicit = object.userData?.inspectionInterior === true
      || object.userData?.inspectionRole === 'interior'
      || object.userData?.inspectionRole === 'shell';
    const usefulName = /impeller|motor|inlet|outlet|shell|casing|volute|tank|cell|chute|drum|belt|rotor/i.test(object.name);
    if (!explicit && !usefulName) return;
    const bounds = new THREE.Box3().setFromObject(object);
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    const score = (explicit ? 10 : 0) + size.length();
    candidates.push({ object, bounds, score });
  });
  candidates.sort((a, b) => b.score - a.score);
  const used = new Set();
  const labels = [];
  for (const candidate of candidates) {
    if (labels.length >= 3) break;
    const text = componentLabelText(candidate.object);
    if (!text || text.length < 3 || used.has(text)) continue;
    used.add(text);
    const texture = createSmallTexture(text, '#d9edf0', { inspection: true });
    if (!texture) continue;
    const width = Math.max(2.5, Math.min(4.7, text.length * 0.28 + 1.55));
    const label = createSprite(texture, {
      width,
      aspect: SMALL_LABEL_ASPECT,
      name: `inspection-component-label-${labels.length + 1}`,
      userData: { labelKind: 'component', targetObject: candidate.object, text },
      opacity: 0.9,
    });
    label.renderOrder = 190;
    const center = candidate.bounds.getCenter(new THREE.Vector3());
    const size = candidate.bounds.getSize(new THREE.Vector3());
    label.position.set(center.x, candidate.bounds.max.y + Math.max(0.28, size.y * 0.10), center.z);
    group.add(label);
    labels.push(label);
  }
  return labels;
}

function getInspectionSelectionLabel(group) {
  return group?.getObjectByName?.('inspection-selection-label') ?? null;
}

function updateInspectionLabelPosition(label) {
  const target = label?.userData?.targetObject;
  if (!target) return;
  const focused = label.userData?.inspectionFraming;
  if (focused?.focused && focused.center && focused.size) {
    const center = new THREE.Vector3(...focused.center);
    const size = new THREE.Vector3(...focused.size);
    label.position.set(
      center.x,
      center.y + size.y / 2 + Math.max(0.90, size.y * 0.16),
      center.z,
    );
    return;
  }
  target.updateWorldMatrix?.(true, true);
  const bounds = new THREE.Box3().setFromObject(target);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  label.position.set(center.x, bounds.max.y + Math.max(0.65, size.y * 0.12), center.z);
}

export function setInspectionTargetLabel(group, target, text = '', framing = null) {
  if (!group) return null;
  const existing = getInspectionSelectionLabel(group);
  if (existing) {
    existing.material?.map?.dispose?.();
    existing.material?.dispose?.();
    group.remove(existing);
  }
  removeInspectionComponentLabels(group);
  group.userData.inspectionTargetId = target?.name ?? null;
  if (!target || !text) return null;
  const texture = createSmallTexture(text, '#7de3ed', { inspection: true });
  if (!texture) return null;
  const width = Math.max(3.8, Math.min(6.4, String(text).length * 0.34 + 2.0));
  const label = createSprite(texture, {
    width,
    aspect: SMALL_LABEL_ASPECT,
    name: 'inspection-selection-label',
    userData: {
      zoneId: null,
      labelKind: 'inspection',
      targetObject: target,
      text,
      inspectionFraming: framing
        ? {
          focused: framing.focused === true,
          center: framing.center?.toArray?.() ?? null,
          size: framing.size?.toArray?.() ?? null,
        }
        : null,
    },
    opacity: 1,
  });
  // Inspection framing already reserves space above the target. Use a less
  // bottom-heavy sprite anchor so long equipment names stay inside the viewport
  // instead of growing almost entirely upward and clipping at the top edge.
  label.center.set(0.5, 0.30);
  label.renderOrder = 200;
  group.add(label);
  updateInspectionLabelPosition(label);
  createInspectionComponentLabels(group, target);
  return label;
}

export function refreshInspectionComponentLabels(group) {
  if (!group) return [];
  const selection = getInspectionSelectionLabel(group);
  return createInspectionComponentLabels(group, selection?.userData?.targetObject ?? null);
}

export function createPlantLabels({ equipmentSystem } = {}) {
  const group = new THREE.Group();
  group.name = 'plant-labels';
  group.userData.labelsVisible = true;
  group.userData.cameraMode = 'general';
  group.userData.presentationMode = false;

  PLANT_ZONE_ORDER.forEach((zoneId) => {
    const label = createZoneLabel(getPlantZone(zoneId));
    if (label) group.add(label);
  });
  EQUIPMENT_LABELS.forEach((definition) => {
    const label = createEquipmentLabel(definition, equipmentSystem);
    if (label) group.add(label);
  });
  const pipe1 = createPipe1Label(equipmentSystem);
  if (pipe1) group.add(pipe1);
  return group;
}

export function updatePlantLabels(group, equipmentSystem) {
  if (!group || !equipmentSystem) return;
  group.children.forEach((label) => {
    if (label.userData.labelKind === 'inspection') {
      updateInspectionLabelPosition(label);
      return;
    }
    if (label.userData.labelKind === 'component') {
      updateInspectionLabelPosition(label);
      return;
    }
    if (label.userData.dynamicPipe1) {
      updatePipe1Label(label, equipmentSystem);
      return;
    }
    if (label.userData.labelKind !== 'equipment') return;
    const equipment = equipmentSystem.getEquipment(label.userData.equipmentId);
    if (!equipment) return;
    label.position.copy(equipment.group3D.position);
    label.position.y += label.userData.lift ?? 3;
  });
}

export function setPlantLabelsView(group, cameraId) {
  group.userData.cameraMode = cameraId;
  group.children.forEach((label) => {
    const profile = getLabelPresentationForCamera(label.userData.zoneId, cameraId, label.userData.labelKind);
    label.userData.presentationVisible = profile.visible;
    const priorityLabel = label.userData.labelKind === 'inspection' || label.userData.labelKind === 'component';
    const allowedByUser = group.userData.labelsVisible !== false || (group.userData.presentationMode === true && priorityLabel);
    label.visible = profile.visible && allowedByUser;
    label.material.opacity = profile.opacity;
    label.userData.presentationScale = profile.scale;
    if (cameraId === 'inspection' && label.userData.labelKind === 'equipment') label.userData.maxDistance = 36;
    else if (label.userData.labelKind === 'equipment') label.userData.maxDistance = 720;
  });
}

export function updatePlantLabelsForCamera(group, camera) {
  if (!group || !camera || !group.visible) return false;
  let changed = false;
  group.children.forEach((label) => {
    if (label.userData.labelKind === 'inspection' || label.userData.labelKind === 'component') updateInspectionLabelPosition(label);
    const distance = camera.position.distanceTo(label.position);
    const maxDistance = label.userData.maxDistance ?? Infinity;
    const priorityLabel = label.userData.labelKind === 'inspection' || label.userData.labelKind === 'component';
    const allowedByUser = group.userData.labelsVisible !== false || (group.userData.presentationMode === true && priorityLabel);
    const nextVisible = allowedByUser && (label.userData.presentationVisible ?? true) && distance <= maxDistance;
    if (label.visible !== nextVisible) changed = true;
    label.visible = nextVisible;
    if (!label.visible) return;
    const baseWidth = label.userData.baseWidth ?? label.scale.x;
    const aspect = label.userData.aspect ?? LABEL_ASPECT;
    const presentationScale = label.userData.presentationScale ?? 1;
    let distanceScale;
    if (label.userData.labelKind === 'zone') {
      distanceScale = THREE.MathUtils.clamp(distance / 150, 0.82, 4.8);
    } else if (label.userData.labelKind === 'inspection') {
      distanceScale = THREE.MathUtils.clamp(distance / 16, 0.66, 1.40);
    } else if (label.userData.labelKind === 'component') {
      distanceScale = THREE.MathUtils.clamp(distance / 12, 0.50, 1.05);
    } else {
      distanceScale = THREE.MathUtils.clamp(distance / 75, 0.82, 3.2);
    }
    const width = baseWidth * presentationScale * distanceScale;
    if (Math.abs(label.scale.x - width) > 1e-4) changed = true;
    label.scale.set(width, width * aspect, 1);
  });
  return changed;
}

export function setPlantLabelsVisible(group, visible) {
  const nextVisible = Boolean(visible);
  group.userData.labelsVisible = nextVisible;
  // Presentation is a focused teaching view. It may suppress ordinary labels
  // while still rendering the selected Inspection label/components even when
  // the user's general label toggle was off before entering the tour.
  group.visible = nextVisible || group.userData.presentationMode === true;
}

export function setPlantLabelsPresentationMode(group, active) {
  if (!group) return;
  group.userData.presentationMode = Boolean(active);
  group.visible = group.userData.labelsVisible !== false || group.userData.presentationMode;
}
