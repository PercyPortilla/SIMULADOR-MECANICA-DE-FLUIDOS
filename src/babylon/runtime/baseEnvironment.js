import { Engine } from '@babylonjs/core/Engines/engine.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Scene } from '@babylonjs/core/scene.js';
import {
  CAMERA_PRESET_ORDER,
  INSPECTION_CAMERA_ID,
  applyBabylonCameraPresetRevision,
  createBabylonPresetCameras,
  setInspectionControlsAttached,
  clearBabylonInspectionCameraInertia,
} from '../cameras/cameraPresets.js';
import { attachBabylonReceptionEarthwork } from '../assets/receptionEarthwork.js';
import { attachBabylonV57SiteVisual } from '../assets/v57SiteVisual.js';
import { createBabylonMaterialTransportSystem } from '../conveying/materialTransportSystem.js';
import { createBabylonProcessEquipmentSystem } from '../equipment/processEquipmentSystem.js';
import { createBabylonCivilInfrastructure } from '../environment/civilInfrastructure.js';
import { createBabylonIndustrialPads, createBabylonPlantFoundations } from '../environment/industrialPads.js';
import { createBabylonMineProps } from '../environment/mineProps.js';
import { createBabylonOperationalSurfaceDetails } from '../environment/operationalSurfaceDetails.js';
import { createBabylonRoadNetwork } from '../environment/roadNetwork.js';
import { createBabylonTechnicalGrid } from '../environment/technicalGrid.js';
import { createBabylonGeotechnicalSystem } from '../geotechnical/geotechnicalSystem.js';
import { createBabylonEquipmentInspectionSystem } from '../inspection/equipmentInspection.js';
import { createBabylonIndustrialSafety } from '../infrastructure/industrialSafety.js';
import { createBabylonIndustrialInfrastructure } from '../infrastructure/industrialInfrastructure.js';
import { createBabylonProcessInstrumentation } from '../infrastructure/processInstrumentation.js';
import { createBabylonPlantLabels } from '../labels/plantLabels.js';
import { applyBabylonScenePalette } from '../materials/scenePalette.js';
import { createBabylonMobileEquipmentSystem } from '../mobile/mobileEquipmentSystem.js';
import { createBabylonPipingSystem } from '../piping/pipingSystem.js';
import { createBabylonMineTerrain } from '../terrain/mineTerrain.js';
import { SECONDARY_SHADOW_DETAIL } from '../../scene/performance/secondaryShadowPolicy.js';
import { getState, subscribe as subscribeState } from '../../state/simulationState.js';

export const BABYLON_WORLD_UNITS_PER_METER = 1;
export const BABYLON_VIEW_DECORATION_REFRESH_INTERVAL_MS = 125;

export const V50_MAJOR_SHADOW_EQUIPMENT_IDS = Object.freeze([
  'ROM-HOPPER', 'APRON-FEEDER', 'PRIMARY-CRUSHER', 'STOCKPILE-RECLAIM',
  'MILL-01', 'SUMP-01', 'SLURRY-PUMP-01', 'CLASS-01',
  'R-01', 'R-02', 'R-03', 'R-04', 'PUMP-01', 'CIP-ADSORPTION',
  'ELUTION-SKID', 'EW-CELLS', 'SMELTING-FURNACE',
  'TRUCK-01', 'TRUCK-02', 'TRUCK-03', 'LOADER-01', 'EXCAVATOR-01',
]);

function shadowMeshEntry(mesh) {
  if (!mesh?.isEnabled?.() || mesh.isVisible === false) return null;
  mesh.computeWorldMatrix?.(true);
  const extend = mesh.getBoundingInfo?.()?.boundingBox?.extendSizeWorld;
  const span = extend?.length?.() ?? 0;
  return Number.isFinite(span) ? { mesh, span } : null;
}

export function selectV50ShadowCasterMeshes(root, {
  maxCasters = 180,
  perEquipment = 2,
} = {}) {
  if (!root || maxCasters <= 0) return [];
  const allNodes = [root, ...(root.getDescendants?.(false) ?? [])];
  const allMeshes = root.getChildMeshes?.(false) ?? [];
  const selected = [];
  const seen = new Set();

  const add = (mesh) => {
    if (!mesh || seen.has(mesh) || selected.length >= maxCasters) return false;
    seen.add(mesh);
    selected.push(mesh);
    return true;
  };

  V50_MAJOR_SHADOW_EQUIPMENT_IDS.forEach((equipmentId) => {
    if (selected.length >= maxCasters) return;
    const equipmentRoot = allNodes.find((node) => node?.name === equipmentId);
    if (!equipmentRoot) return;
    const familyMeshes = [
      ...(equipmentRoot.getBoundingInfo && 'material' in equipmentRoot ? [equipmentRoot] : []),
      ...(equipmentRoot.getChildMeshes?.(false) ?? []),
    ]
      .map(shadowMeshEntry)
      .filter((entry) => entry && entry.span >= 0.25)
      .sort((a, b) => b.span - a.span)
      .slice(0, Math.max(1, perEquipment));
    familyMeshes.forEach(({ mesh }) => add(mesh));
  });

  const secondary = /(?:GROUND|ROAD|PAD|TERRACE|BENCH|BERM|SHOULDER|DRAIN|CULVERT|PIPE|FLANGE|VALVE|BOLT|RUNG|RAIL|ORE|SLURRY|SURFACE|SWIRL|TRACK|LINE|LABEL|SIGN)/i;
  const primary = /(?:TRUCK|EXCAVATOR|LOADER|ROM|FEEDER|CRUSHER|STOCKPILE|MILL|SUMP|PUMP|CLASS|CYCLONE|R-0[1-4]|CIP|ELUTION|EW|SMELTING|CONVEYOR|CV0[1-3]|BUILDING|HOUSE|TOWER|FRAME|SHELL|BODY|TANK|COLUMN|MOTOR|FURNACE)/i;
  allMeshes
    .map(shadowMeshEntry)
    .filter((entry) => entry && entry.span >= 0.45 && !seen.has(entry.mesh))
    .filter(({ mesh }) => !SECONDARY_SHADOW_DETAIL.test(String(mesh.name || '')))
    .filter(({ mesh }) => primary.test(String(mesh.name || '')) && !secondary.test(String(mesh.name || '')))
    .sort((a, b) => b.span - a.span)
    .some(({ mesh }) => {
      add(mesh);
      return selected.length >= maxCasters;
    });

  return selected;
}

function isSceneDisposed(scene) {
  if (!scene) return true;
  return typeof scene.isDisposed === 'function' ? scene.isDisposed() : Boolean(scene.isDisposed);
}

function emptyAssetContainer() {
  return {
    rootNodes: [],
    animationGroups: [],
    addAllToScene() {},
    dispose() {},
  };
}

export function computeBabylonInspectionCameraDistance(size, fovRadians, aspect = 1, padding = 1.70) {
  const safeSize = size instanceof Vector3 ? size : Vector3.FromArray(size ?? [1, 1, 1]);
  const verticalFov = Math.max(10 * Math.PI / 180, Number(fovRadians) || (52 * Math.PI / 180));
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.25, aspect));
  const heightDistance = (safeSize.y * 0.5) / Math.tan(verticalFov / 2);
  const widthDistance = (Math.max(safeSize.x, safeSize.z) * 0.5) / Math.tan(horizontalFov / 2);
  const depthAllowance = Math.max(safeSize.x, safeSize.z) * 0.28;
  return Math.max(2.5, Math.max(heightDistance, widthDistance) * padding + depthAllowance);
}

export function applyBabylonInspectionCameraFraming(camera, framing, {
  aspect = 1,
  minimumOnly = false,
  recenter = true,
} = {}) {
  if (!camera || !framing?.center || !framing?.size) return null;
  const center = framing.center instanceof Vector3 ? framing.center : Vector3.FromArray(framing.center);
  const size = framing.size instanceof Vector3 ? framing.size : Vector3.FromArray(framing.size);
  const radius = Math.max(1, size.length() * 0.5);
  const currentTarget = camera.target?.clone?.() ?? center.clone();
  const frameTarget = recenter ? center : currentTarget;
  const requiredDistance = Math.min(120, Math.max(
    Math.max(3.5, radius * 1.15),
    computeBabylonInspectionCameraDistance(size, camera.fov, aspect),
  ));
  const currentDistance = Number(camera.radius) || Vector3.Distance(camera.position, currentTarget);
  const distance = minimumOnly ? Math.max(currentDistance, requiredDistance) : requiredDistance;
  clearBabylonInspectionCameraInertia(camera);
  camera.setTarget?.(frameTarget);
  camera.radius = distance;
  camera.minZ = Math.max(0.04, distance / 320);
  camera.lowerRadiusLimit = Math.max(0.8, radius * 0.28);
  camera.upperRadiusLimit = Math.min(1200, Math.max(65, radius * 18));
  return Object.freeze({ distance, requiredDistance, radius });
}

export function captureBabylonOrbitCameraState(camera) {
  if (!camera) return null;
  return Object.freeze({
    target: Object.freeze(camera.target?.asArray?.() ?? [0, 0, 0]),
    position: Object.freeze(camera.position?.asArray?.() ?? [0, 0, 0]),
    alpha: Number(camera.alpha),
    beta: Number(camera.beta),
    radius: Number(camera.radius),
    lowerRadiusLimit: Number(camera.lowerRadiusLimit),
    upperRadiusLimit: Number(camera.upperRadiusLimit),
    minZ: Number(camera.minZ),
    maxZ: Number(camera.maxZ),
  });
}

export function restoreBabylonOrbitCameraState(camera, snapshot) {
  if (!camera || !snapshot) return false;
  clearBabylonInspectionCameraInertia(camera);
  camera.setTarget?.(Vector3.FromArray(snapshot.target));
  camera.setPosition?.(Vector3.FromArray(snapshot.position));
  if (Number.isFinite(snapshot.alpha)) camera.alpha = snapshot.alpha;
  if (Number.isFinite(snapshot.beta)) camera.beta = snapshot.beta;
  if (Number.isFinite(snapshot.radius)) camera.radius = snapshot.radius;
  camera.lowerRadiusLimit = Number.isFinite(snapshot.lowerRadiusLimit) ? snapshot.lowerRadiusLimit : null;
  camera.upperRadiusLimit = Number.isFinite(snapshot.upperRadiusLimit) ? snapshot.upperRadiusLimit : null;
  if (Number.isFinite(snapshot.minZ)) camera.minZ = snapshot.minZ;
  if (Number.isFinite(snapshot.maxZ)) camera.maxZ = snapshot.maxZ;
  return true;
}

export function resolveBabylonInspectionPick({
  scene,
  inspectionSystem,
  x,
  y,
  camera = scene?.activeCamera,
} = {}) {
  const resolveTargetId = inspectionSystem?.resolvePickTargetId;
  const pickX = Number(x);
  const pickY = Number(y);
  if (!scene?.pick || typeof resolveTargetId !== 'function' || !Number.isFinite(pickX) || !Number.isFinite(pickY)) {
    return null;
  }
  try {
    const pick = scene.pick(
      pickX,
      pickY,
      (mesh) => Boolean(resolveTargetId(mesh)),
      false,
      camera,
    );
    return pick?.hit ? (resolveTargetId(pick.pickedMesh) ?? null) : null;
  } catch {
    return null;
  }
}

export function shouldSuppressBabylonInspectionHoverDuringDrag({
  buttons = 0,
  pointerActive = false,
} = {}) {
  return !pointerActive && Number(buttons) !== 0;
}

export function activateBabylonInspectionPick({
  id,
  setTarget,
  setCamera,
  activeCamera = null,
  onPick = null,
} = {}) {
  if (!id || typeof setTarget !== 'function') return false;
  setTarget(id, { smooth: true });
  if (activeCamera !== INSPECTION_CAMERA_ID && typeof setCamera === 'function') {
    setCamera(INSPECTION_CAMERA_ID);
  }
  if (typeof onPick === 'function') {
    try {
      onPick(id);
    } catch (error) {
      console.error('[PULPA LAB B67] No se pudo sincronizar la selección Inspection.', error);
    }
  }
  return true;
}

export function createBabylonInspectionHoverPayload({ id, target, x, y } = {}) {
  const hoverX = Number(x);
  const hoverY = Number(y);
  if (!id || !target || !Number.isFinite(hoverX) || !Number.isFinite(hoverY)) return null;
  return Object.freeze({
    id,
    label: target.label || id,
    kind: target.kind || 'equipment',
    x: hoverX,
    y: hoverY,
  });
}

function createSky(scene) {
  const sky = MeshBuilder.CreateSphere('babylon-sky-dome', {
    diameter: 1520,
    segments: 48,
    sideOrientation: Mesh.BACKSIDE,
  }, scene);
  const material = new ShaderMaterial('babylon-sky-material', scene, {
    vertexSource: `
      precision highp float;
      attribute vec3 position;
      uniform mat4 world;
      uniform mat4 viewProjection;
      varying vec3 worldPosition;
      void main(void) {
        vec4 worldPos = world * vec4(position, 1.0);
        worldPosition = worldPos.xyz;
        gl_Position = viewProjection * worldPos;
      }
    `,
    fragmentSource: `
      precision highp float;
      varying vec3 worldPosition;
      void main(void) {
        float elevation = clamp(normalize(worldPosition).y, 0.0, 1.0);
        vec3 horizon = vec3(0.74, 0.79, 0.80);
        vec3 lowerSky = vec3(0.46, 0.64, 0.76);
        vec3 zenith = vec3(0.17, 0.36, 0.58);
        vec3 color = mix(horizon, lowerSky, smoothstep(0.0, 0.24, elevation));
        color = mix(color, zenith, smoothstep(0.22, 1.0, elevation));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  }, {
    attributes: ['position'],
    uniforms: ['world', 'viewProjection'],
  });
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  sky.material = material;
  sky.infiniteDistance = true;
  sky.isPickable = false;
  sky.metadata = {
    worldScaleMeters: BABYLON_WORLD_UNITS_PER_METER,
    role: 'sky',
    atmosphereProfile: 'clear-highland-blue',
    v30ShaderParity: true,
  };
  return sky;
}

function createV30GroundTexture(scene) {
  if (typeof document === 'undefined') return null;
  const texture = new DynamicTexture('babylon-v30-ground-texture', { width: 512, height: 512 }, scene, true);
  const context = texture.getContext();
  if (!context) {
    texture.dispose();
    return null;
  }
  const image = context.createImageData(512, 512);
  const data = image.data;
  const hash01 = (x, y) => {
    let value = Math.imul((x + 17) ^ Math.imul(y + 31, 374761393), 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };
  for (let y = 0; y < 512; y += 1) {
    for (let x = 0; x < 512; x += 1) {
      const index = (y * 512 + x) * 4;
      const broad = Math.sin(x * 0.026 + y * 0.019) * 0.55
        + Math.cos(x * 0.011 - y * 0.031 + 1.7) * 0.34;
      const medium = Math.sin(x * 0.091 + y * 0.063 + 0.8) * 0.22;
      const grain = (hash01(x, y) - 0.5) * 0.30;
      const fragment = hash01(x * 3 + 5, y * 5 + 11) > 0.985 ? -0.20 : 0;
      const tone = broad * 0.52 + medium * 0.31 + grain + fragment;
      data[index] = Math.max(0, Math.min(255, 194 + tone * 22));
      data[index + 1] = Math.max(0, Math.min(255, 174 + tone * 20));
      data[index + 2] = Math.max(0, Math.min(255, 142 + tone * 18));
      data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  context.globalAlpha = 0.10;
  context.strokeStyle = '#6f5c49';
  context.lineWidth = 1.1;
  for (let band = 0; band < 11; band += 1) {
    context.beginPath();
    const y0 = 25 + band * 43;
    for (let x = -20; x <= 532; x += 16) {
      const y = y0 + Math.sin(x * 0.022 + band * 1.4) * (4 + band % 3);
      if (x === -20) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.globalAlpha = 1;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = 12;
  texture.vScale = 8;
  texture.gammaSpace = true;
  texture.update(false);
  return texture;
}

function createLighting(scene) {
  const hemisphere = new HemisphericLight('ambient-industrial-light', new Vector3(0, 1, 0), scene);
  hemisphere.intensity = 0.85;
  hemisphere.diffuse = new Color3(0.79, 0.84, 0.86);
  hemisphere.groundColor = new Color3(0.54, 0.46, 0.36);

  const sunDirection = new Vector3(210, -245, -150).normalize();
  const sun = new DirectionalLight('mine-sun-key-light', sunDirection, scene);
  sun.position = new Vector3(-210, 245, 150);
  sun.intensity = 1.65;
  sun.diffuse = new Color3(1.0, 0.94, 0.82);

  const fill = new DirectionalLight('soft-fill-light', new Vector3(-260, -120, 180).normalize(), scene);
  fill.position = new Vector3(260, 120, -180);
  fill.intensity = 0.30;
  fill.diffuse = new Color3(0.72, 0.82, 0.86);

  const bounce = new DirectionalLight('warm-ground-bounce', new Vector3(-90, -45, -110).normalize(), scene);
  bounce.position = new Vector3(90, 45, 110);
  bounce.intensity = 0.15;
  bounce.diffuse = new Color3(0.84, 0.72, 0.51);

  return Object.freeze({ hemisphere, sun, fill, bounce });
}

function createTerrain(scene) {
  const material = new StandardMaterial('babylon-terrain-material', scene);
  material.diffuseColor = Color3.White();
  material.specularColor = new Color3(0.06, 0.065, 0.065);
  material.specularPower = 18;
  material.ambientColor = new Color3(0.22, 0.20, 0.17);
  material.diffuseTexture = createV30GroundTexture(scene);
  material.metadata = {
    ...(material.metadata ?? {}),
    scenePaletteRole: 'terrain',
    surfaceProfile: 'v30-compacted-weathered-rock',
    v30GroundTextureParity: Boolean(material.diffuseTexture),
  };
  const mesh = createBabylonMineTerrain({ scene, material });
  return Object.freeze({ mesh, material });
}

function createShadows(scene, sun, terrain) {
  const generator = new ShadowGenerator(2048, sun);
  generator.bias = 0.00008;
  generator.normalBias = 0.04;
  generator.usePercentageCloserFiltering = true;
  generator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  terrain.receiveShadows = true;
  scene.metadata.shadowMapSize = 2048;
  return generator;
}

export function createBabylonBaseScene(engine, { pipe1State = null } = {}) {
  if (!engine) throw new TypeError('Babylon base scene requires an Engine.');
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.fogMode = Scene.FOGMODE_NONE;
  scene.clearColor = new Color4(0.56, 0.65, 0.69, 1);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.05;
  scene.imageProcessingConfiguration.contrast = 1.12;
  scene.metadata = {
    ...(scene.metadata ?? {}),
    worldUnitsPerMeter: BABYLON_WORLD_UNITS_PER_METER,
    coordinateSystem: 'right-handed',
    fogEnabled: false,
    toneMapping: 'ACES',
    toneMappingExposure: 1.05,
    toneMappingContrast: 1.12,
    visualAuthority: 'V57/B63',
  };

  const sky = createSky(scene);
  const lights = createLighting(scene);
  const terrain = createTerrain(scene);
  const shadowGenerator = createShadows(scene, lights.sun, terrain.mesh);
  const roadNetwork = createBabylonRoadNetwork({ scene });
  const industrialPads = createBabylonIndustrialPads({ scene });
  const plantFoundations = createBabylonPlantFoundations({ scene });
  const civilInfrastructure = createBabylonCivilInfrastructure({ scene });
  const mineProps = createBabylonMineProps({ scene });
  const operationalSurfaceDetails = createBabylonOperationalSurfaceDetails({ scene });
  const industrialInfrastructure = createBabylonIndustrialInfrastructure({ scene });
  const technicalGrid = createBabylonTechnicalGrid({ scene });
  const industrialSafety = createBabylonIndustrialSafety({ scene });
  const v57SiteVisual = typeof window !== 'undefined'
    ? attachBabylonV57SiteVisual({ scene })
    : null;
  const authoritativeOnlyLoader = v57SiteVisual
    ? async (url, targetScene) => {
      await v57SiteVisual.ready;
      if (isSceneDisposed(targetScene)) return emptyAssetContainer();
      // B62: V57/B61 is the only visible 3D authority. Older GLBs must never
      // become a visual fallback when the final site is slow or unavailable.
      return emptyAssetContainer();
    }
    : null;
  const receptionEarthworkOverlay = typeof window !== 'undefined'
    ? attachBabylonReceptionEarthwork({
      scene,
      ...(authoritativeOnlyLoader ? { loadContainer: authoritativeOnlyLoader } : {}),
    })
    : null;
  const processEquipmentSystem = typeof window !== 'undefined'
    ? createBabylonProcessEquipmentSystem({
      scene,
      visualGeometry: false,
      ...(authoritativeOnlyLoader ? { loadContainer: authoritativeOnlyLoader } : {}),
    })
    : null;
  const processInstrumentation = processEquipmentSystem
    ? createBabylonProcessInstrumentation({ scene, equipmentSystem: processEquipmentSystem })
    : null;
  const pipingSystem = processEquipmentSystem
    ? createBabylonPipingSystem({ scene, equipmentSystem: processEquipmentSystem, pipe1State })
    : null;
  const materialTransportSystem = processEquipmentSystem
    ? createBabylonMaterialTransportSystem({ scene, equipmentSystem: processEquipmentSystem })
    : null;
  const mobileEquipmentSystem = typeof window !== 'undefined'
    ? createBabylonMobileEquipmentSystem({
      scene,
      ...(authoritativeOnlyLoader ? { loadContainer: authoritativeOnlyLoader } : {}),
    })
    : null;
  const equipmentInspection = typeof window !== 'undefined'
    ? createBabylonEquipmentInspectionSystem({ scene })
    : null;
  const plantLabels = typeof window !== 'undefined'
    ? createBabylonPlantLabels({ scene, equipmentSystem: processEquipmentSystem })
    : null;
  const geotechnicalSystem = typeof window !== 'undefined'
    ? createBabylonGeotechnicalSystem({
      scene,
      ground: terrain.mesh,
      industrialPads: industrialPads.root,
      haulRoads: roadNetwork.root,
    })
    : null;
  equipmentInspection?.contextOverlay?.setEnabled?.(false);
  equipmentInspection?.statusOverlay?.setEnabled?.(false);
  const cameras = createBabylonPresetCameras(scene);
  scene.activeCamera = cameras.general;
  scene.metadata.migrationStage = 'V31-BLOCK-2';
  scene.metadata.visualAuthority = 'V57/B63';

  return {
    scene,
    sky,
    lights,
    terrain: terrain.mesh,
    terrainMaterial: terrain.material,
    shadowGenerator,
    roadNetwork,
    industrialPads,
    plantFoundations,
    civilInfrastructure,
    mineProps,
    operationalSurfaceDetails,
    industrialInfrastructure,
    technicalGrid,
    industrialSafety,
    v57SiteVisual,
    receptionEarthworkOverlay,
    processEquipmentSystem,
    processInstrumentation,
    fixedEquipmentSystem: processEquipmentSystem?.fixed ?? null,
    supportEquipmentSystem: processEquipmentSystem?.support ?? null,
    pipingSystem,
    materialTransportSystem,
    mobileEquipmentSystem,
    equipmentInspection,
    plantLabels,
    geotechnicalSystem,
    cameras,
  };
}

export function createBabylonRuntime({
  canvas,
  engineOptions = {},
  engineFactory = (inputCanvas, options) => new Engine(inputCanvas, true, options, true),
} = {}) {
  if (!canvas) throw new TypeError('Babylon runtime requires a canvas.');
  const engine = engineFactory(canvas, {
    preserveDrawingBuffer: false,
    stencil: true,
    ...engineOptions,
  });
  if (!engine) throw new TypeError('Babylon runtime engineFactory must return an Engine-compatible object.');
  const initialState = getState();
  const base = createBabylonBaseScene(engine, { pipe1State: initialState.transport?.pipe1 ?? null });
  let activeCamera = 'general';
  let inspectionControlsAttached = false;
  let disposed = false;
  let renderLoopRunning = false;
  let renderRequested = true;
  let interactiveUntilMs = 0;
  let animationsEnabled = true;
  let previousFrameMs = null;
  let labelsEnabled = true;
  let presentationMode = false;
  let labViewActive = false;
  let labViewMode = 'realistic';
  let labViewFocus = 'overview';
  let labPreviousCamera = null;
  let labInspectionCameraSnapshot = null;
  let lastDecorationRefreshMs = -Infinity;
  let processFlowScale = 1;
  let processMetrics = Object.freeze({ flowRateM3s: 0, pressurePa: 0 });
  let activeScenePalette = Object.freeze({});
  let inspectionPickHandler = null;
  let inspectionHoverHandler = null;
  let inspectionHoverId = null;
  let inspectionPointerDown = null;
  let inspectionCameraTransition = null;
  let pipeRenderKey = JSON.stringify([
    initialState.transport?.pipe1?.innerDiameterM,
    initialState.transport?.pipe1?.lengthM,
    initialState.transport?.pipe1?.material,
    initialState.transport?.pipe1?.accessories?.valvesCount,
  ]);

  function setLegacyVisualsEnabled(enabled) {
    const nodes = [
      base.terrain,
      base.roadNetwork?.root,
      base.industrialPads?.root,
      base.plantFoundations?.root,
      base.civilInfrastructure?.root,
      base.mineProps?.root,
      base.operationalSurfaceDetails?.root,
      base.industrialInfrastructure?.root,
      base.technicalGrid?.root,
      base.industrialSafety?.root,
      base.receptionEarthworkOverlay?.host,
      base.processEquipmentSystem?.fixed?.root,
      base.processEquipmentSystem?.support?.root,
      base.processInstrumentation?.root,
      base.pipingSystem?.root,
      base.materialTransportSystem?.root,
      base.mobileEquipmentSystem?.root,
    ];
    nodes.forEach((node) => node?.setEnabled?.(Boolean(enabled)));
    base.scene.metadata.legacyVisualsEnabled = Boolean(enabled);
  }

  if (base.v57SiteVisual) {
    // B62 authoritative-only policy: do not expose the old procedural site even
    // temporarily while the V57/B61 GLB downloads or parses.
    setLegacyVisualsEnabled(false);
    // Retain functional registries, ports, connections and simulation handles.
    // Only the disabled, superseded render meshes are released.
    const discardLegacyMeshes = () => {
      base.scene.meshes.filter((mesh) => mesh !== base.sky
        && !mesh.metadata?.v57AuthoritativeVisual
        && mesh !== base.v57SiteVisual.host
        && !mesh.isEnabled()).forEach((mesh) => mesh.dispose(true, false));
    };
    discardLegacyMeshes();
    Promise.allSettled([
      base.processEquipmentSystem?.ready,
      base.mobileEquipmentSystem?.ready,
      base.receptionEarthworkOverlay?.ready,
    ]).then(() => { if (!disposed) discardLegacyMeshes(); });
    base.scene.metadata.activeVisualRevision = 'V57-loading';
  }

  function registerShadowCasters(root) {
    root?.getChildMeshes?.(false)?.forEach((mesh) => {
      if (!mesh.isEnabled?.() || mesh.isVisible === false) return;
      if (mesh.metadata?.inspectionInterior || mesh.metadata?.pipeParticleFlow) return;
      if (SECONDARY_SHADOW_DETAIL.test(String(mesh.name || ''))) return;
      base.shadowGenerator.addShadowCaster(mesh, false);
      mesh.receiveShadows = true;
    });
  }

  function registerV57ShadowCasters(root) {
    const candidates = selectV50ShadowCasterMeshes(root, { maxCasters: 180, perEquipment: 2 });
    candidates.forEach((mesh) => {
      base.shadowGenerator.addShadowCaster(mesh, false);
      mesh.receiveShadows = true;
    });
    if (base.v57SiteVisual?.host?.metadata) {
      base.v57SiteVisual.host.metadata.shadowCasterCount = candidates.length;
    }
    return candidates.length;
  }

  [
    base.roadNetwork?.root,
    base.industrialPads?.root,
    base.plantFoundations?.root,
    base.civilInfrastructure?.root,
    base.mineProps?.root,
    base.operationalSurfaceDetails?.root,
    base.industrialInfrastructure?.root,
    base.industrialSafety?.root,
    base.processInstrumentation?.root,
    base.materialTransportSystem?.root,
  ].forEach(registerShadowCasters);

  const nowMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()
  );

  function invalidateRender(interactiveForMs = 0) {
    if (disposed) return false;
    renderRequested = true;
    if (interactiveForMs > 0) {
      interactiveUntilMs = Math.max(interactiveUntilMs, nowMs() + interactiveForMs);
    }
    return true;
  }

  function beginSmoothInspectionFraming(framing, durationMs = 460) {
    if (!framing?.center || !framing?.size) return null;
    const camera = base.cameras.inspection;
    const startTarget = camera.target?.clone?.()
      ?? (framing.center.clone?.() ?? Vector3.FromArray(framing.center));
    const startRadius = Number(camera.radius) || 1;
    const result = applyBabylonInspectionCameraFraming(camera, framing, { aspect: renderAspect() });
    const endTarget = camera.target?.clone?.()
      ?? (framing.center.clone?.() ?? Vector3.FromArray(framing.center));
    const endRadius = Number(camera.radius) || startRadius;
    camera.setTarget?.(startTarget);
    camera.radius = startRadius;
    inspectionCameraTransition = {
      startedAtMs: nowMs(),
      durationMs: Math.max(120, Number(durationMs) || 460),
      startTarget,
      endTarget,
      startRadius,
      endRadius,
    };
    invalidateRender(inspectionCameraTransition.durationMs + 120);
    return result;
  }

  function updateInspectionCameraTransition(now) {
    const transition = inspectionCameraTransition;
    if (!transition) return false;
    const progress = Math.max(0, Math.min(1, (now - transition.startedAtMs) / transition.durationMs));
    const eased = 1 - ((1 - progress) ** 3);
    const camera = base.cameras.inspection;
    camera.setTarget?.(Vector3.Lerp(transition.startTarget, transition.endTarget, eased));
    camera.radius = transition.startRadius + (transition.endRadius - transition.startRadius) * eased;
    if (progress >= 1) inspectionCameraTransition = null;
    return true;
  }

  function pointerCoordinates(event) {
    const offsetX = Number(event?.offsetX);
    const offsetY = Number(event?.offsetY);
    if (Number.isFinite(offsetX) && Number.isFinite(offsetY)) return { x: offsetX, y: offsetY };
    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);
    const rect = canvas.getBoundingClientRect?.();
    if (!rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function setInspectionPickHandler(handler) {
    if (handler !== null && handler !== undefined && typeof handler !== 'function') {
      throw new TypeError('Inspection pick handler must be a function or null.');
    }
    inspectionPickHandler = handler ?? null;
    return inspectionPickHandler;
  }

  function setInspectionHoverHandler(handler) {
    if (handler !== null && handler !== undefined && typeof handler !== 'function') {
      throw new TypeError('Inspection hover handler must be a function or null.');
    }
    inspectionHoverHandler = handler ?? null;
    return inspectionHoverHandler;
  }

  function dispatchInspectionHover(id, point = null) {
    const nextId = id || null;
    const changed = nextId !== inspectionHoverId;
    inspectionHoverId = nextId;
    base.equipmentInspection?.setHoverTarget?.(nextId);
    if (canvas.style && changed) canvas.style.cursor = nextId ? 'pointer' : '';
    const target = nextId ? base.equipmentInspection?.getTargetInfo?.(nextId) : null;
    const payload = createBabylonInspectionHoverPayload({
      id: nextId,
      target,
      x: point?.x,
      y: point?.y,
    });
    if (typeof inspectionHoverHandler === 'function' && (payload || changed)) {
      try {
        inspectionHoverHandler(payload);
      } catch (error) {
        console.error('[PULPA LAB B68] No se pudo sincronizar el hover Inspection.', error);
      }
    }
    if (changed) invalidateRender(120);
    return payload;
  }

  function clearInspectionHover() {
    return dispatchInspectionHover(null, null);
  }

  function updateInspectionHover(event) {
    const point = pointerCoordinates(event);
    if (!point) return clearInspectionHover();
    const id = resolveBabylonInspectionPick({
      scene: base.scene,
      inspectionSystem: base.equipmentInspection,
      x: point.x,
      y: point.y,
      camera: base.scene.activeCamera,
    });
    return dispatchInspectionHover(id, point);
  }

  function beginInspectionPointer(event) {
    invalidateRender(420);
    if (event?.button !== undefined && event.button !== 0) {
      inspectionPointerDown = null;
      return;
    }
    const point = pointerCoordinates(event);
    if (!point) {
      inspectionPointerDown = null;
      return;
    }
    inspectionPointerDown = {
      pointerId: event?.pointerId ?? null,
      x: point.x,
      y: point.y,
      moved: false,
    };
  }

  function moveInspectionPointer(event) {
    if (activeCamera === INSPECTION_CAMERA_ID) invalidateRender(180);
    const pointer = inspectionPointerDown;
    // B77: ArcRotateCamera owns RMB/middle-button drag. Do not ray-pick hover
    // targets while any non-selection drag is in progress; that raycast made
    // fast panning feel sticky even after increasing panning sensitivity.
    if (shouldSuppressBabylonInspectionHoverDuringDrag({
      buttons: event?.buttons ?? 0,
      pointerActive: Boolean(pointer),
    })) {
      clearInspectionHover();
      return;
    }
    if (pointer) {
      if (pointer.pointerId !== null && event?.pointerId !== undefined && event.pointerId !== pointer.pointerId) return;
      const point = pointerCoordinates(event);
      if (!point) return;
      if (Math.hypot(point.x - pointer.x, point.y - pointer.y) > 6) pointer.moved = true;
      if (pointer.moved) {
        clearInspectionHover();
        return;
      }
    }
    updateInspectionHover(event);
  }

  function finishInspectionPointer(event) {
    invalidateRender(260);
    const pointer = inspectionPointerDown;
    inspectionPointerDown = null;
    if (!pointer || pointer.moved) return null;
    if (event?.button !== undefined && event.button !== 0) return null;
    if (pointer.pointerId !== null && event?.pointerId !== undefined && event.pointerId !== pointer.pointerId) return null;
    const point = pointerCoordinates(event);
    if (!point || Math.hypot(point.x - pointer.x, point.y - pointer.y) > 6) return null;
    const id = resolveBabylonInspectionPick({
      scene: base.scene,
      inspectionSystem: base.equipmentInspection,
      x: point.x,
      y: point.y,
      camera: base.scene.activeCamera,
    });
    if (!id) {
      dispatchInspectionHover(null, point);
      return null;
    }

    activateBabylonInspectionPick({
      id,
      setTarget: setInspectionTarget,
      setCamera,
      activeCamera,
      onPick: inspectionPickHandler,
    });
    dispatchInspectionHover(id, point);
    return id;
  }

  const interactionHandlers = {
    pointerdown: beginInspectionPointer,
    pointermove: moveInspectionPointer,
    pointerup: finishInspectionPointer,
    pointercancel: () => {
      inspectionPointerDown = null;
      clearInspectionHover();
      invalidateRender(120);
    },
    pointerleave: () => clearInspectionHover(),
    wheel: () => invalidateRender(320),
  };
  Object.entries(interactionHandlers).forEach(([type, handler]) => {
    canvas.addEventListener?.(type, handler, { passive: type === 'wheel' });
  });
  base.receptionEarthworkOverlay?.ready?.finally?.(() => {
    if (disposed) return;
    registerShadowCasters(base.receptionEarthworkOverlay?.host);
    invalidateRender(180);
  });
  base.v57SiteVisual?.ready?.then?.(() => {
    if (disposed) return;
    if (!base.v57SiteVisual?.loaded) {
      setLegacyVisualsEnabled(false);
      base.processEquipmentSystem?.setAnimationsEnabled?.(false);
      base.materialTransportSystem?.setAnimationsEnabled?.(false);
      base.mobileEquipmentSystem?.setEnabled?.(false);
      base.scene.metadata.activeVisualRevision = 'V57-error';
      applyBabylonCameraPresetRevision(base.cameras, 'V57');
      invalidateRender(300);
      return;
    }
    setLegacyVisualsEnabled(false);
    base.processEquipmentSystem?.setAnimationsEnabled?.(false);
    base.materialTransportSystem?.setAnimationsEnabled?.(false);
    base.mobileEquipmentSystem?.setEnabled?.(false);
    base.v57SiteVisual.setAnimationsEnabled(animationsEnabled);
    base.scene.metadata.activeVisualRevision = 'V57';
    applyBabylonCameraPresetRevision(base.cameras, 'V57');
    base.geotechnicalSystem?.setVisible?.(false);
    base.scene.metadata.v57ImportedRootCount = base.v57SiteVisual.host.metadata?.importedRootCount ?? 0;
    base.scene.metadata.v57ImportedMeshCount = base.v57SiteVisual.host.metadata?.importedMeshCount ?? 0;
    base.scene.metadata.v57ShadowCasterCount = registerV57ShadowCasters(base.v57SiteVisual.host);
    base.equipmentInspection?.refreshTargets?.();
    base.plantLabels?.updatePositions?.();
    invalidateRender(300);
  });
  base.processEquipmentSystem?.ready?.then?.(() => {
    if (disposed) return;
    base.processEquipmentSystem.setAnimationsEnabled(false);
    base.processEquipmentSystem.allVisuals().forEach((visual) => registerShadowCasters(visual.host));
    registerShadowCasters(base.pipingSystem?.root);
    base.scene.metadata.processEquipmentVisualsLoaded = base.processEquipmentSystem.loadedVisualCount;
    base.scene.metadata.pipingConnectionCount = base.pipingSystem?.connections?.size ?? 0;
    base.scene.metadata.pipingEndpointAudit = base.pipingSystem?.auditConnectionEndpoints?.() ?? [];
    base.scene.metadata.materialTransportEndpointAudit = base.materialTransportSystem?.auditConnectionEndpoints?.() ?? [];
    base.equipmentInspection?.refreshTargets?.();
    base.plantLabels?.updatePositions?.();
    invalidateRender(240);
  });
  base.mobileEquipmentSystem?.ready?.then?.(() => {
    if (disposed) return;
    base.mobileEquipmentSystem.setEnabled(false);
    registerShadowCasters(base.mobileEquipmentSystem.root);
    base.equipmentInspection?.refreshTargets?.();
    invalidateRender(240);
  });
  base.materialTransportSystem?.setAnimationsEnabled?.(false);
  const unsubscribeState = subscribeState((state) => {
    const nextPipeRenderKey = JSON.stringify([
      state.transport?.pipe1?.innerDiameterM,
      state.transport?.pipe1?.lengthM,
      state.transport?.pipe1?.material,
      state.transport?.pipe1?.accessories?.valvesCount,
    ]);
    if (nextPipeRenderKey !== pipeRenderKey) {
      pipeRenderKey = nextPipeRenderKey;
      base.pipingSystem?.refreshPipe1?.(state.transport?.pipe1);
      base.equipmentInspection?.refreshTargets?.();
      base.plantLabels?.updatePositions?.();
      base.scene.metadata.pipingEndpointAudit = base.pipingSystem?.auditConnectionEndpoints?.() ?? [];
      if (Object.keys(activeScenePalette).length) {
        applyBabylonScenePalette(base, activeScenePalette, {
          pipe1MaterialName: state.transport?.pipe1?.material ?? '',
        });
      }
    }
    refreshViewDecorations(true);
    invalidateRender(180);
  });

  function renderAspect() {
    const width = Math.max(1, Number(engine.getRenderWidth?.()) || Number(canvas.clientWidth) || 1);
    const height = Math.max(1, Number(engine.getRenderHeight?.()) || Number(canvas.clientHeight) || 1);
    return width / height;
  }

  function refreshViewDecorations(force = false) {
    const now = nowMs();
    if (!force && now - lastDecorationRefreshMs < BABYLON_VIEW_DECORATION_REFRESH_INTERVAL_MS) return false;
    base.plantLabels?.updatePositions?.();
    base.plantLabels?.updateForCamera?.(base.cameras[activeCamera]);
    if (base.geotechnicalSystem?.visible) {
      base.geotechnicalSystem.updateForCamera?.(base.cameras[activeCamera]);
    }
    if (activeCamera === INSPECTION_CAMERA_ID && base.equipmentInspection?.targetId) {
      base.equipmentInspection.refreshContextOverlay?.();
    }
    lastDecorationRefreshMs = now;
    return true;
  }

  function setCamera(id) {
    if (!CAMERA_PRESET_ORDER.includes(id)) throw new RangeError(`Cámara no disponible: ${id}.`);
    if (inspectionControlsAttached && id !== INSPECTION_CAMERA_ID) {
      setInspectionControlsAttached(base.cameras.inspection, canvas, false);
      inspectionControlsAttached = false;
    }
    if (id !== INSPECTION_CAMERA_ID) inspectionCameraTransition = null;
    activeCamera = id;
    base.scene.activeCamera = base.cameras[id];
    if (id === INSPECTION_CAMERA_ID && !inspectionControlsAttached) {
      clearBabylonInspectionCameraInertia(base.cameras.inspection);
      setInspectionControlsAttached(base.cameras.inspection, canvas, true);
      inspectionControlsAttached = true;
    }
    base.equipmentInspection?.contextOverlay?.setEnabled?.(
      id === INSPECTION_CAMERA_ID && Boolean(base.equipmentInspection?.targetId),
    );
    base.equipmentInspection?.statusOverlay?.setEnabled?.(
      id === INSPECTION_CAMERA_ID
      && Boolean(base.equipmentInspection?.targetId)
      && Boolean(base.equipmentInspection?.operationalStatus),
    );
    base.plantLabels?.setView?.(id);
    refreshViewDecorations(true);
    invalidateRender(120);
    return base.cameras[id];
  }

  function resize() {
    if (disposed) return false;
    engine.resize();
    if (activeCamera === INSPECTION_CAMERA_ID && base.equipmentInspection?.targetId) {
      const framing = base.equipmentInspection.getFraming?.(base.equipmentInspection.targetId);
      if (framing) {
        applyBabylonInspectionCameraFraming(base.cameras.inspection, framing, {
          aspect: renderAspect(),
          minimumOnly: true,
          recenter: false,
        });
      }
    }
    refreshViewDecorations(true);
    invalidateRender(120);
    return true;
  }

  function render() {
    if (disposed) return false;
    refreshViewDecorations(false);
    base.scene.render();
    renderRequested = false;
    return true;
  }

  function renderLoopTick() {
    if (disposed) return;
    const now = nowMs();
    const inspectionCamera = base.cameras.inspection;
    const inspectionTransitioning = updateInspectionCameraTransition(now);
    const inspectionHasInertia = activeCamera === INSPECTION_CAMERA_ID && [
      inspectionCamera?.inertialAlphaOffset,
      inspectionCamera?.inertialBetaOffset,
      inspectionCamera?.inertialRadiusOffset,
      inspectionCamera?.inertialPanningX,
      inspectionCamera?.inertialPanningY,
    ].some((value) => Math.abs(Number(value) || 0) > 1e-5);
    const interactive = activeCamera === INSPECTION_CAMERA_ID
      && (now < interactiveUntilMs || inspectionHasInertia || inspectionTransitioning);
    if (animationsEnabled) {
      const deltaSeconds = previousFrameMs === null ? 0 : Math.min(0.1, Math.max(0, (now - previousFrameMs) / 1000));
      previousFrameMs = now;
      base.v57SiteVisual?.update?.(deltaSeconds);
    } else {
      previousFrameMs = null;
    }
    if (!renderRequested && !interactive && !animationsEnabled) return;
    render();
  }

  function setAnimationsEnabled(enabled) {
    animationsEnabled = Boolean(enabled);
    previousFrameMs = null;
    base.v57SiteVisual?.setAnimationsEnabled?.(animationsEnabled);
    base.processEquipmentSystem?.setAnimationsEnabled?.(false);
    base.materialTransportSystem?.setAnimationsEnabled?.(false);
    base.mobileEquipmentSystem?.setEnabled?.(false);
    invalidateRender(180);
    return animationsEnabled;
  }

  function setLabelsVisible(visible) {
    labelsEnabled = Boolean(visible);
    base.plantLabels?.setVisible?.(labelsEnabled);
    base.geotechnicalSystem?.setLabelsVisible?.(labelsEnabled);
    refreshViewDecorations(true);
    invalidateRender(120);
    return labelsEnabled;
  }

  function setPresentationMode(active) {
    presentationMode = Boolean(active);
    base.plantLabels?.setPresentationMode?.(presentationMode);
    base.plantLabels?.setView?.(activeCamera);
    refreshViewDecorations(true);
    invalidateRender(120);
    return presentationMode;
  }

  function frameLabView(focus = 'overview') {
    const framings = base.v57SiteVisual?.labFramings;
    const framing = framings?.[focus] ?? framings?.overview;
    if (!framing) return null;
    labViewFocus = framings?.[focus] ? focus : 'overview';
    const camera = base.cameras.inspection;
    const center = Vector3.FromArray(framing.center);
    const position = Vector3.FromArray(framing.position);
    clearBabylonInspectionCameraInertia(camera);
    inspectionCameraTransition = null;
    camera.setTarget(center);
    camera.setPosition(position);
    const radius = Math.max(1, Vector3.Distance(position, center));
    camera.lowerRadiusLimit = Math.max(1.5, radius * 0.18);
    camera.upperRadiusLimit = Math.max(140, radius * 5.5);
    camera.minZ = Math.max(0.04, radius / 420);
    refreshViewDecorations(true);
    invalidateRender(260);
    return Object.freeze({
      focus: labViewFocus,
      center: Object.freeze([...framing.center]),
      position: Object.freeze([...framing.position]),
      radius,
    });
  }

  function setLabViewMode(mode = 'realistic') {
    labViewMode = ['realistic', 'didactic', 'presentation'].includes(mode)
      ? mode
      : 'realistic';
    base.v57SiteVisual?.setLabViewState?.({
      active: labViewActive,
      mode: labViewMode,
    });
    if (labViewActive && labViewMode === 'presentation') frameLabView('overview');
    refreshViewDecorations(true);
    invalidateRender(180);
    return labViewMode;
  }

  function setLabViewActive(active, { mode = labViewMode, focus = 'overview' } = {}) {
    const next = Boolean(active);
    if (next && !labViewActive) {
      labPreviousCamera = activeCamera;
      labInspectionCameraSnapshot = captureBabylonOrbitCameraState(base.cameras.inspection);
    }
    labViewMode = ['realistic', 'didactic', 'presentation'].includes(mode)
      ? mode
      : 'realistic';
    labViewActive = next;
    base.v57SiteVisual?.setLabViewState?.({
      active: labViewActive,
      mode: labViewMode,
    });
    if (labViewActive) {
      if (activeCamera !== INSPECTION_CAMERA_ID) setCamera(INSPECTION_CAMERA_ID);
      frameLabView(focus);
    } else {
      restoreBabylonOrbitCameraState(base.cameras.inspection, labInspectionCameraSnapshot);
      labInspectionCameraSnapshot = null;
      const restoreCamera = labPreviousCamera;
      labPreviousCamera = null;
      if (restoreCamera && restoreCamera !== activeCamera) setCamera(restoreCamera);
      else {
        refreshViewDecorations(true);
        invalidateRender(180);
      }
    }
    return labViewActive;
  }

  function setGeotechnicsVisible(visible) {
    const allowed = !base.v57SiteVisual;
    const nextVisible = Boolean(visible) && allowed;
    base.geotechnicalSystem?.setVisible?.(nextVisible);
    if (nextVisible) base.geotechnicalSystem?.updateForCamera?.(base.cameras[activeCamera]);
    refreshViewDecorations(true);
    invalidateRender(180);
    return Boolean(base.geotechnicalSystem?.visible);
  }

  function setProcessMetrics({
    flowRateM3s = 0,
    imposedFlowRateM3s = flowRateM3s,
    pressurePa = 0,
    velocityMps = 0,
    solidsMassFraction = 0,
    solidVolumeFraction = 0,
    densityKgM3 = 0,
    feedGoldKgH = 0,
    basis = 'transport-imposed-flow',
  } = {}) {
    const normalizedFlow = Number.isFinite(flowRateM3s) && flowRateM3s > 0 ? flowRateM3s : 0;
    const normalizedImposedFlow = Number.isFinite(imposedFlowRateM3s) && imposedFlowRateM3s > 0
      ? imposedFlowRateM3s
      : 0;
    const normalizedPressure = Number.isFinite(pressurePa) ? pressurePa : 0;
    const normalizedVelocity = Number.isFinite(velocityMps) ? velocityMps : 0;
    const normalizedSolids = Number.isFinite(solidsMassFraction)
      ? Math.max(0, Math.min(1, solidsMassFraction))
      : 0;
    const normalizedSolidVolume = Number.isFinite(solidVolumeFraction)
      ? Math.max(0, Math.min(1, solidVolumeFraction))
      : 0;
    const normalizedDensity = Number.isFinite(densityKgM3) && densityKgM3 > 0 ? densityKgM3 : 0;
    const normalizedGold = Number.isFinite(feedGoldKgH) && feedGoldKgH > 0 ? feedGoldKgH : 0;
    processFlowScale = normalizedFlow === 0
      ? 0
      : Math.max(0.25, Math.min(3, normalizedFlow / 0.03));
    processMetrics = Object.freeze({
      flowRateM3s: normalizedFlow,
      imposedFlowRateM3s: normalizedImposedFlow,
      pressurePa: normalizedPressure,
      velocityMps: normalizedVelocity,
      solidsMassFraction: normalizedSolids,
      solidVolumeFraction: normalizedSolidVolume,
      densityKgM3: normalizedDensity,
      feedGoldKgH: normalizedGold,
      basis: String(basis || 'transport-imposed-flow'),
    });
    base.v57SiteVisual?.setProcessMetrics?.(processMetrics);
    if (base.pipingSystem?.root) {
      base.pipingSystem.root.metadata = {
        ...(base.pipingSystem.root.metadata ?? {}),
        processFlowRateM3s: normalizedFlow,
        processPressurePa: normalizedPressure,
        visualFlowScale: processFlowScale,
      };
      base.pipingSystem.setFlowScale?.(processFlowScale);
    }
    try {
      const pump = base.processEquipmentSystem?.getEquipment?.('PUMP-01');
      if (pump?.root) {
        pump.root.metadata = {
          ...(pump.root.metadata ?? {}),
          operationalState: normalizedFlow > 0 ? 'operating' : 'standby',
          processFlowRateM3s: normalizedFlow,
          requiredPressurePa: normalizedPressure,
        };
      }
    } catch {
      // PUMP-01 may not exist during partial/null-engine migration tests.
    }
    invalidateRender(120);
    return processMetrics;
  }

  function setScenePalette(palette = {}) {
    activeScenePalette = Object.freeze({ ...palette });
    const result = applyBabylonScenePalette(base, activeScenePalette, {
      pipe1MaterialName: getState().transport?.pipe1?.material ?? '',
    });
    invalidateRender(120);
    return result;
  }

  function setInspectionTarget(id, { smooth = false } = {}) {
    if (!base.equipmentInspection) return null;
    const target = base.equipmentInspection.setTarget(id);
    base.v57SiteVisual?.setInspectionState?.({ targetId: id || null, mode: 'normal' });
    base.equipmentInspection.contextOverlay?.setEnabled?.(
      activeCamera === INSPECTION_CAMERA_ID && Boolean(target),
    );
    base.equipmentInspection.statusOverlay?.setEnabled?.(
      activeCamera === INSPECTION_CAMERA_ID
      && Boolean(target)
      && Boolean(base.equipmentInspection?.operationalStatus),
    );
    const targetMeta = id
      ? base.equipmentInspection.getTargets().find((item) => item.id === id)
      : null;
    const framing = target ? base.equipmentInspection.getFraming?.(id) : null;
    base.plantLabels?.setInspectionTarget?.(target, targetMeta?.label ?? id ?? '', framing);
    base.plantLabels?.setView?.(activeCamera);
    if (target && framing) {
      if (smooth) beginSmoothInspectionFraming(framing);
      else {
        inspectionCameraTransition = null;
        applyBabylonInspectionCameraFraming(base.cameras.inspection, framing, { aspect: renderAspect() });
      }
    } else {
      inspectionCameraTransition = null;
    }
    refreshViewDecorations(true);
    invalidateRender(smooth ? 620 : 180);
    return target;
  }

  function setInspectionOperationalStatus(status) {
    if (!base.equipmentInspection) return null;
    const normalized = base.equipmentInspection.setOperationalStatus?.(status) ?? null;
    base.equipmentInspection.statusOverlay?.setEnabled?.(
      activeCamera === INSPECTION_CAMERA_ID
      && Boolean(base.equipmentInspection?.targetId)
      && Boolean(normalized),
    );
    invalidateRender(140);
    return normalized;
  }

  function setInspectionMode(mode) {
    if (!base.equipmentInspection) return null;
    const appliedMode = base.equipmentInspection.setMode(mode) ?? mode;
    base.v57SiteVisual?.setInspectionState?.({
      targetId: base.equipmentInspection?.targetId ?? null,
      mode: appliedMode,
    });
    base.plantLabels?.refreshInspectionComponents?.();
    refreshViewDecorations(true);
    invalidateRender(180);
    return appliedMode;
  }

  function startRenderLoop() {
    if (disposed || renderLoopRunning) return false;
    renderLoopRunning = true;
    engine.runRenderLoop(renderLoopTick);
    invalidateRender();
    return true;
  }

  function stopRenderLoop() {
    if (!renderLoopRunning) return false;
    engine.stopRenderLoop(renderLoopTick);
    renderLoopRunning = false;
    return true;
  }

  function dispose() {
    if (disposed) return;
    stopRenderLoop();
    disposed = true;
    inspectionPickHandler = null;
    inspectionHoverHandler = null;
    inspectionPointerDown = null;
    inspectionCameraTransition = null;
    inspectionHoverId = null;
    base.equipmentInspection?.setHoverTarget?.(null);
    if (canvas.style) canvas.style.cursor = '';
    Object.entries(interactionHandlers).forEach(([type, handler]) => {
      canvas.removeEventListener?.(type, handler);
    });
    if (inspectionControlsAttached) {
      setInspectionControlsAttached(base.cameras.inspection, canvas, false);
      inspectionControlsAttached = false;
    }
    base.receptionEarthworkOverlay?.dispose?.();
    base.v57SiteVisual?.dispose?.();
    unsubscribeState?.();
    base.geotechnicalSystem?.dispose?.();
    base.plantLabels?.dispose?.();
    base.equipmentInspection?.dispose?.();
    base.mobileEquipmentSystem?.dispose?.();
    base.materialTransportSystem?.dispose?.();
    base.pipingSystem?.dispose?.();
    base.processEquipmentSystem?.dispose?.();
    base.processInstrumentation?.root?.dispose?.(false, true);
    base.industrialSafety?.root?.dispose?.(false, true);
    base.scene.dispose();
    engine.dispose();
  }

  return {
    ...base,
    engine,
    setCamera,
    resize,
    render,
    invalidateRender,
    setAnimationsEnabled,
    setLabelsVisible,
    setPresentationMode,
    setLabViewActive,
    setLabViewMode,
    frameLabView,
    setGeotechnicsVisible,
    setProcessMetrics,
    setScenePalette,
    getInspectionTargets: () => base.equipmentInspection?.getTargets?.() ?? [],
    setInspectionPickHandler,
    setInspectionHoverHandler,
    setInspectionTarget,
    setInspectionOperationalStatus,
    setInspectionMode,
    startRenderLoop,
    stopRenderLoop,
    dispose,
    get activeCamera() { return activeCamera; },
    get inspectionControlsAttached() { return inspectionControlsAttached; },
    get renderLoopRunning() { return renderLoopRunning; },
    get animationsEnabled() { return animationsEnabled; },
    get labelsVisible() { return labelsEnabled; },
    get presentationMode() { return presentationMode; },
    get labViewActive() { return labViewActive; },
    get labViewMode() { return labViewMode; },
    get labViewFocus() { return labViewFocus; },
    get geotechnicsVisible() { return Boolean(base.geotechnicalSystem?.visible); },
    get processMetrics() { return processMetrics; },
    get visualFlowScale() { return processFlowScale; },
    get scenePalette() { return activeScenePalette; },
    get inspectionTargetId() { return base.equipmentInspection?.targetId ?? null; },
    get inspectionHoverTargetId() { return inspectionHoverId; },
    get inspectionOperationalStatus() { return base.equipmentInspection?.operationalStatus ?? null; },
    get inspectionMode() { return base.equipmentInspection?.mode ?? 'normal'; },
    get inspectionCameraTransitionActive() { return Boolean(inspectionCameraTransition); },
    get disposed() { return disposed; },
  };
}

// Production-compatible adapter. It intentionally mirrors the lifecycle that
// V30 createBaseEnvironment provided so src/main.js only needs to switch the
// imported renderer implementation; the HTML/CSS and controller wiring remain
// renderer-neutral.
export function createBaseEnvironment({ canvas, ...options } = {}) {
  const runtime = createBabylonRuntime({ canvas, ...options });
  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => runtime.resize())
    : null;
  resizeObserver?.observe(canvas?.parentElement || canvas);
  const disposeRuntime = runtime.dispose;
  runtime.dispose = () => {
    resizeObserver?.disconnect();
    disposeRuntime();
  };
  runtime.resize();
  runtime.startRenderLoop();
  return runtime;
}
