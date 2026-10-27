import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';

const G = 9.80665;
const MODES = new Set(['realistic', 'didactic', 'presentation']);
const POINTS = Object.freeze({
  A: Object.freeze({ position: [184.0, 22.15, -90.0], elevationM: 22.99, diameterM: 0.30 }),
  B: Object.freeze({ position: [205.0, 25.15, -90.0], elevationM: 23.62, diameterM: 0.25 }),
  C: Object.freeze({ position: [228.2, 26.95, -103.1], elevationM: 26.84, diameterM: 0.25 }),
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function metadata(type, extra = {}) {
  return {
    visualOnly: true,
    visualBuild: 'B88',
    bernoulliEulerLab: true,
    labEnergyVisual: true,
    labEnergyType: type,
    ...extra,
  };
}

function makeMaterial(scene, name, color, alpha = 1, emissive = 0.12) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = color;
  result.ambientColor = color.scale(0.22);
  result.emissiveColor = color.scale(emissive);
  result.specularColor = Color3.Black();
  result.alpha = alpha;
  result.metadata = metadata('material');
  return result;
}

function velocityFromFlow(flowRateM3s, diameterM) {
  const q = finite(flowRateM3s);
  if (!(q > 0) || !(diameterM > 0)) return 0;
  return q / (Math.PI * diameterM * diameterM / 4);
}

function kineticHead(velocityMps) {
  return velocityMps * velocityMps / (2 * G);
}

function pressureHead(pressurePa, densityKgM3) {
  const density = finite(densityKgM3);
  if (!(density > 0)) return 0;
  return finite(pressurePa) / (density * G);
}

function visualHeight(valueM, maxHeight = 7.2) {
  const value = Math.max(0, finite(valueM));
  if (!(value > 0)) return 0.06;
  return Math.min(maxHeight, 0.18 + Math.log1p(value) * 1.45);
}

function createPanel(scene, parent, name, position, material, width = 9.4, height = 2.2) {
  const plane = CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
  plane.parent = parent;
  plane.position.copyFrom(Vector3.FromArray(position));
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.material = material;
  plane.metadata = metadata('readout-panel');

  let texture = null;
  if (typeof document !== 'undefined') {
    texture = new DynamicTexture(`${name}_TEXTURE`, { width: 1024, height: 256 }, scene, false);
    texture.hasAlpha = true;
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.opacityTexture = texture;
  }
  return { plane, texture, material, text: '' };
}

function writePanel(panel, text) {
  panel.text = text;
  panel.plane.metadata.labReadoutText = text;
  const texture = panel.texture;
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, 1024, 256);
  ctx.fillStyle = 'rgba(5, 16, 22, 0.90)';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = 'rgba(108, 210, 238, 0.75)';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 1008, 240);
  ctx.fillStyle = '#f3fbff';
  ctx.font = '600 45px Arial';
  ctx.textBaseline = 'middle';
  const lines = text.split('\n').slice(0, 3);
  lines.forEach((line, index) => ctx.fillText(line, 34, 62 + index * 70));
  texture.update(false);
}

function createBar(scene, parent, name, position, material, type) {
  const bar = CreateBox(name, { width: 1.15, height: 1, depth: 1.15 }, scene);
  bar.parent = parent;
  bar.position.copyFrom(Vector3.FromArray(position));
  bar.material = material;
  bar.isPickable = false;
  bar.metadata = metadata(type, { valueM: 0 });
  return bar;
}

function setBarValue(bar, valueM, baseY = 20.55) {
  const height = visualHeight(valueM);
  bar.scaling.y = height;
  bar.position.y = baseY + height * 0.5;
  bar.metadata.valueM = finite(valueM);
}

function createLossHotspot(scene, parent, name, position, material, subtype) {
  const hotspot = CreateSphere(name, { diameter: 0.72, segments: 20 }, scene);
  hotspot.parent = parent;
  hotspot.position.copyFrom(Vector3.FromArray(position));
  hotspot.material = material;
  hotspot.isPickable = false;
  hotspot.metadata = metadata('hydraulic-loss', { lossSubtype: subtype });
  return hotspot;
}

export function applyB88BernoulliEnergyVisual({ scene, parent } = {}) {
  if (!scene || !parent) throw new TypeError('B88 Bernoulli energy visual requires scene and parent.');

  const root = new TransformNode('B88-BERNOULLI-ENERGY-VISUAL', scene);
  root.parent = parent;
  root.metadata = metadata('root');

  const materials = {
    pressure: makeMaterial(scene, 'b88-energy-pressure', new Color3(0.10, 0.52, 0.95), 0.90, 0.30),
    kinetic: makeMaterial(scene, 'b88-energy-kinetic', new Color3(0.10, 0.88, 0.92), 0.90, 0.30),
    potential: makeMaterial(scene, 'b88-energy-potential', new Color3(0.20, 0.86, 0.42), 0.90, 0.24),
    pump: makeMaterial(scene, 'b88-energy-pump', new Color3(1.00, 0.62, 0.10), 0.92, 0.34),
    loss: makeMaterial(scene, 'b88-energy-loss', new Color3(0.96, 0.24, 0.10), 0.92, 0.38),
    panel: makeMaterial(scene, 'b88-energy-panel', new Color3(0.06, 0.12, 0.16), 0.96, 0.08),
  };

  const pointBars = {};
  const pointPanels = {};
  const pointOffsets = { A: -87.0, B: -86.5, C: -99.5 };
  Object.entries(POINTS).forEach(([id, point]) => {
    const x = point.position[0];
    const z = pointOffsets[id];
    pointBars[id] = {
      kinetic: createBar(scene, root, `B88_${id}_KINETIC_HEAD`, [x - 0.75, 20.55, z], materials.kinetic, 'kinetic-head'),
      potential: createBar(scene, root, `B88_${id}_POTENTIAL_HEAD`, [x + 0.75, 20.55, z], materials.potential, 'potential-head'),
    };
    pointPanels[id] = createPanel(
      scene,
      root,
      `B88_${id}_READOUT`,
      [x, Math.max(point.position[1] + 5.0, 27.0), z - 1.3],
      makeMaterial(scene, `b88-panel-${id.toLowerCase()}`, new Color3(0.06, 0.12, 0.16), 0.96, 0.08),
      8.4,
      2.05,
    );
    pointPanels[id].plane.metadata.labPoint = id;
  });

  const systemBars = {
    pressure: createBar(scene, root, 'B88_SYSTEM_PRESSURE_HEAD', [214.0, 20.55, -108.0], materials.pressure, 'pressure-drop-head'),
    pump: createBar(scene, root, 'B88_SYSTEM_PUMP_HEAD', [216.0, 20.55, -108.0], materials.pump, 'pump-head'),
    losses: createBar(scene, root, 'B88_SYSTEM_LOSS_HEAD', [218.0, 20.55, -108.0], materials.loss, 'loss-head'),
    static: createBar(scene, root, 'B88_SYSTEM_STATIC_HEAD', [220.0, 20.55, -108.0], materials.potential, 'static-head'),
  };
  const systemPanel = createPanel(scene, root, 'B88_SYSTEM_READOUT', [217.0, 29.5, -108.0], materials.panel, 13.5, 2.55);

  const lossHotspots = [
    createLossHotspot(scene, root, 'B88_LOSS_REDUCER', [203.8, 23.58, -90.01], materials.loss, 'reducer'),
    createLossHotspot(scene, root, 'B88_LOSS_VALVE', [213.62, 24.75, -91.72], materials.loss, 'valve'),
    createLossHotspot(scene, root, 'B88_LOSS_ELBOW', [221.1, 25.9, -97.2], materials.loss, 'elbow'),
  ];

  let mode = 'realistic';
  let metrics = Object.freeze({});

  function setMetrics(nextMetrics = {}) {
    metrics = Object.freeze({ ...nextMetrics });
    const flow = finite(metrics.flowRateM3s);
    const baseElevation = POINTS.A.elevationM;
    Object.entries(POINTS).forEach(([id, point]) => {
      const velocity = velocityFromFlow(flow, point.diameterM);
      const vHead = kineticHead(velocity);
      const zHead = Math.max(0, point.elevationM - baseElevation);
      setBarValue(pointBars[id].kinetic, vHead);
      setBarValue(pointBars[id].potential, zHead);
      pointBars[id].kinetic.metadata.velocityMps = velocity;
      pointBars[id].potential.metadata.elevationM = point.elevationM;
      writePanel(
        pointPanels[id],
        `${id} · V ${velocity.toFixed(2)} m/s · z ${point.elevationM.toFixed(2)} m\n`
        + `V²/2g ${vHead.toFixed(3)} m · Δz ${zHead.toFixed(2)} m\n`
        + 'P nodal: N/D (solver no la resuelve)',
      );
    });

    const pressureDropHeadM = pressureHead(metrics.pressureDropPa, metrics.densityKgM3);
    const pumpHeadM = finite(metrics.pumpHeadM);
    const lossHeadM = finite(metrics.totalLossHeadM);
    const staticHeadM = Math.max(0, finite(metrics.staticHeadM));
    setBarValue(systemBars.pressure, pressureDropHeadM);
    setBarValue(systemBars.pump, pumpHeadM);
    setBarValue(systemBars.losses, lossHeadM);
    setBarValue(systemBars.static, staticHeadM);

    writePanel(
      systemPanel,
      `Q ${(flow * 3600).toFixed(1)} m³/h · ρ ${finite(metrics.densityKgM3).toFixed(0)} kg/m³ · ${String(metrics.rheologyModel || '—')}\n`
      + `ΔP/ρg ${pressureDropHeadM.toFixed(2)} m · Hb ${pumpHeadM.toFixed(2)} m · hf ${lossHeadM.toFixed(2)} m\n`
      + `hest ${staticHeadM.toFixed(2)} m · P nodal A/B/C no inventada`,
    );
    root.metadata.metricsBasis = String(metrics.basis || 'transport-imposed-flow');
    return metrics;
  }

  function setMode(nextMode = 'realistic') {
    mode = MODES.has(nextMode) ? nextMode : 'realistic';
    const showEnergy = mode === 'didactic' || mode === 'presentation';
    Object.values(pointBars).forEach((bars) => Object.values(bars).forEach((bar) => bar.setEnabled(showEnergy)));
    Object.values(pointPanels).forEach((panel) => panel.plane.setEnabled(showEnergy));
    Object.values(systemBars).forEach((bar) => bar.setEnabled(showEnergy));
    systemPanel.plane.setEnabled(showEnergy);
    lossHotspots.forEach((hotspot) => hotspot.setEnabled(showEnergy));
    return mode;
  }

  setMetrics(metrics);
  setMode(mode);
  return {
    root,
    materials,
    pointBars,
    pointPanels,
    systemBars,
    systemPanel,
    lossHotspots,
    setMetrics,
    setMode,
    get metrics() { return metrics; },
    get mode() { return mode; },
    dispose() {
      Object.values(pointPanels).forEach((panel) => panel.texture?.dispose?.());
      systemPanel.texture?.dispose?.();
      root.dispose(false, true);
      Object.values(materials).forEach((entry) => entry.dispose(false, true));
      Object.values(pointPanels).forEach((panel) => panel.material.dispose(false, true));
    },
  };
}
