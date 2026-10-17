import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMineTerrain } from './environment/terrain.js';
import { createHaulRoads } from './environment/haulRoads.js';
import { createIndustrialPads } from './environment/industrialPads.js';
import { createCivilInfrastructure } from './environment/civilInfrastructure.js';
import { createMineProps } from './environment/mineProps.js';
import { getTerrainHeight, getTerrainZone, getZoneElevation } from './environment/terrainHeight.js';
import { getSiteOverviewBounds } from './config/siteDesign.js';
import { getPlantLayoutBounds, getPlantZone } from './layout/plantLayout.js';
import { createIntegratedPlant } from './integration/integratedPlant.js';
import { createIntegratedPiping } from './integration/integratedPiping.js';
import { getState, subscribe as subscribeState } from '../state/simulationState.js';
import { getProcessRoute } from '../process/processRoute.js';
import { createIntegratedMobile } from './integration/integratedMobile.js';
import { createPresetCameras } from './cameras/cameraPresets.js';
import { createPlantLabels, setInspectionTargetLabel, setPlantLabelsView, setPlantLabelsVisible, updatePlantLabels, updatePlantLabelsForCamera } from './labels/plantLabels.js';
import { applyIndustrialPaletteToScene, createIndustrialMaterial } from './materials/industrialMaterials.js';
import { createIntegratedAnimations } from './integration/integratedAnimations.js';
import { createEquipmentInspectionSystem } from './inspection/equipmentInspection.js';
import { createGeotechnicalSystem } from './geotech/geotechnicalSystem.js';
import { attachReceptionEarthworkBlenderOverlay } from './integration/blenderTerrainOverlay.js';

export const INSPECTION_CONTROL_LIMITS = Object.freeze({ minDistance: 0.8, maxDistance: 1200 });

function makeGroundTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const image = context.createImageData(canvas.width, canvas.height);
  const data = image.data;
  const hash01 = (x, y) => {
    let value = Math.imul((x + 17) ^ Math.imul(y + 31, 374761393), 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const broad = Math.sin(x * 0.026 + y * 0.019) * 0.55
        + Math.cos(x * 0.011 - y * 0.031 + 1.7) * 0.34;
      const medium = Math.sin(x * 0.091 + y * 0.063 + 0.8) * 0.22;
      const grain = (hash01(x, y) - 0.5) * 0.30;
      const fragment = hash01(x * 3 + 5, y * 5 + 11) > 0.985 ? -0.20 : 0;
      const tone = broad * 0.52 + medium * 0.31 + grain + fragment;

      data[index] = Math.max(0, Math.min(255, 235 + tone * 18));
      data[index + 1] = Math.max(0, Math.min(255, 229 + tone * 17));
      data[index + 2] = Math.max(0, Math.min(255, 217 + tone * 16));
      data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  // Soft geological streaks break the tile without creating the old dotted-grid look.
  context.globalAlpha = 0.11;
  context.strokeStyle = '#8a7b69';
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

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function makeConcreteTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#a2a5a2';
  context.fillRect(0, 0, 256, 256);
  const shades = ['#8f9492', '#9da19f', '#b0b2ae', '#858b89', '#babbb6'];
  for (let index = 0; index < 1500; index += 1) {
    const x = (index * 61) % 256;
    const y = (index * 107) % 256;
    context.globalAlpha = 0.12 + ((index * 7) % 16) / 100;
    context.fillStyle = shades[index % shades.length];
    context.fillRect(x, y, 0.5 + (index % 3) * 0.45, 0.5 + (index % 2) * 0.4);
  }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPlatformGrid(width = 34, depth = 19) {
  const grid = new THREE.Group();
  grid.name = 'platform-technical-grid';
  const material = new THREE.LineBasicMaterial({
    color: 0x526064,
    transparent: true,
    opacity: 0.22,
  });
  const halfWidth = width / 2 - 0.3;
  const halfDepth = depth / 2 - 0.3;
  const spacing = 1.5;
  const addLine = (start, end) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
    ]);
    grid.add(new THREE.Line(geometry, material));
  };
  for (let x = -halfWidth; x <= halfWidth + 0.001; x += spacing) {
    addLine([x, 0, -halfDepth], [x, 0, halfDepth]);
  }
  for (let z = -halfDepth; z <= halfDepth + 0.001; z += spacing) {
    addLine([-halfWidth, 0, z], [halfWidth, 0, z]);
  }
  // The caller positions this group directly on the engineering datum. Keeping
  // an extra legacy 0.36 m lift made the line grid float through equipment and
  // produced strong moire/z-fighting artifacts in the grinding close-up.
  grid.position.y = 0;
  return grid;
}


function createSkyDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec3 worldPosition;
      void main() {
        worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 worldPosition;
      void main() {
        float elevation = clamp(normalize(worldPosition).y, 0.0, 1.0);
        vec3 horizon = vec3(0.72, 0.70, 0.64);
        vec3 upperHaze = vec3(0.50, 0.61, 0.66);
        vec3 zenith = vec3(0.26, 0.39, 0.52);
        vec3 color = mix(horizon, upperHaze, smoothstep(0.0, 0.34, elevation));
        color = mix(color, zenith, smoothstep(0.32, 1.0, elevation));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(760, 48, 24), material);
  dome.name = 'blue-gray-sky-dome';
  dome.renderOrder = -10;
  return dome;
}



export function collectSceneResourceStats(root) {
  const geometries = new Set();
  const materials = new Set();
  const stats = {
    objects: 0,
    meshes: 0,
    instancedMeshes: 0,
    sprites: 0,
    shadowCasters: 0,
    shadowReceivers: 0,
    uniqueGeometries: 0,
    uniqueMaterials: 0,
  };
  root?.traverse?.((object) => {
    stats.objects += 1;
    if (object.isSprite) stats.sprites += 1;
    if (!object.isMesh) return;
    stats.meshes += 1;
    if (object.isInstancedMesh) stats.instancedMeshes += 1;
    if (object.castShadow) stats.shadowCasters += 1;
    if (object.receiveShadow) stats.shadowReceivers += 1;
    if (object.geometry) geometries.add(object.geometry);
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    mats.filter(Boolean).forEach((material) => materials.add(material));
  });
  stats.uniqueGeometries = geometries.size;
  stats.uniqueMaterials = materials.size;
  return Object.freeze(stats);
}

export function computeInspectionCameraDistance(size, fovDeg, aspect = 1, padding = 1.32) {
  const safeSize = size?.isVector3 ? size : new THREE.Vector3(...(size ?? [1, 1, 1]));
  const verticalFov = THREE.MathUtils.degToRad(Math.max(10, fovDeg));
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.25, aspect));
  const heightDistance = (safeSize.y * 0.5) / Math.tan(verticalFov / 2);
  const widthDistance = (Math.max(safeSize.x, safeSize.z) * 0.5) / Math.tan(horizontalFov / 2);
  const depthAllowance = Math.max(safeSize.x, safeSize.z) * 0.28;
  return Math.max(2.5, Math.max(heightDistance, widthDistance) * padding + depthAllowance);
}

export function createBaseScene() {
  const scene = new THREE.Scene();
  scene.fog = null;
  const environmentRoot = new THREE.Group();
  environmentRoot.name = 'environment-root';
  scene.add(environmentRoot);

  const skyDome = createSkyDome();
  environmentRoot.add(skyDome);

  const groundTexture = makeGroundTexture();
  const groundMaterial = createIndustrialMaterial('terrain', { color: 0xffffff, map: groundTexture });
  const ground = createMineTerrain(groundMaterial);
  environmentRoot.add(ground);
  const blenderTerrainOverlay = attachReceptionEarthworkBlenderOverlay({ parent: environmentRoot });

  const concreteTexture = makeConcreteTexture();
  const platform = new THREE.Group();
  platform.name = 'central-concrete-platform';
  const platformMaterial = createIndustrialMaterial('concrete', { color: 0x929691, map: concreteTexture });
  ['Z4', 'Z5'].forEach((zoneId) => {
    const zone = getPlantZone(zoneId);
    const slabThickness = 0.35;
    const slabCover = 0.08;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(zone.width - 3.0, slabThickness, zone.depth - 3.0),
      platformMaterial,
    );
    slab.name = `${zone.key}-equipment-foundation`;
    // Keep the engineered slab below the authoritative plant datum. V14 placed
    // its bottom at the datum, which buried the lower 0.35 m of MILL-01 and
    // CLASS-01. Local equipment plinths now provide the visible foundations.
    slab.position.set(zone.position.x, zone.elevation - slabCover - slabThickness / 2, zone.position.z);
    slab.userData.foundationTopY = zone.elevation - slabCover;
    slab.userData.engineeringDatumY = zone.elevation;
    slab.userData.coverM = slabCover;
    slab.userData.embeddedFoundation = true;
    slab.receiveShadow = true;
    slab.castShadow = true;
    platform.add(slab);
  });
  environmentRoot.add(platform);

  const grid = new THREE.Group();
  grid.name = 'platform-technical-grid';
  ['Z4', 'Z5'].forEach((zoneId) => {
    const zone = getPlantZone(zoneId);
    const zoneGrid = createPlatformGrid(zone.width - 3.6, zone.depth - 3.6);
    zoneGrid.name = `${zone.key}-technical-grid`;
    // A few millimetres above the slab avoids z-fighting while remaining on
    // the same engineering datum.
    zoneGrid.position.set(zone.position.x, zone.elevation + 0.015, zone.position.z);
    grid.add(zoneGrid);
  });
  environmentRoot.add(grid);

  const roadMaterial = createIndustrialMaterial('road');
  const haulRoads = createHaulRoads(roadMaterial);
  environmentRoot.add(haulRoads);

  const padMaterial = createIndustrialMaterial('concrete');
  const industrialPads = createIndustrialPads(padMaterial);
  environmentRoot.add(industrialPads);

  const civilInfrastructure = createCivilInfrastructure();
  environmentRoot.add(civilInfrastructure);

  const mineProps = createMineProps();
  environmentRoot.add(mineProps);

  const processRoute = getProcessRoute();
  environmentRoot.userData.processRouteId = processRoute.id;
  environmentRoot.userData.processRouteValidated = processRoute.validation.isValidated;
  environmentRoot.userData.processRouteTopologyValidated = processRoute.validation.topologyValidated === true;
  environmentRoot.userData.processRouteRenderable = processRoute.validation.canRender3D === true;

  const equipmentSystem = createIntegratedPlant();
  environmentRoot.add(equipmentSystem.root);

  const integratedPiping = createIntegratedPiping({
    equipmentSystem,
    pipe1State: getState().transport.pipe1,
  });
  environmentRoot.add(integratedPiping.root);

  const mobileEquipment = createIntegratedMobile({
    plantRoot: equipmentSystem.root,
    registry: equipmentSystem.registry,
  });

  const pipe1System = {
    root: integratedPiping.root,
    update: (pipeState) => integratedPiping.refreshPipe1(pipeState),
    dispose: () => {},
  };

  const mineralFrontEnd = {
    root: equipmentSystem.root,
    transferPoints: {
      receptionDischarge: equipmentSystem.getPortWorldPosition('APRON-FEEDER', 'dischargeOut'),
      crusherInlet: equipmentSystem.getPortWorldPosition('PRIMARY-CRUSHER', 'feedIn'),
      crusherDischarge: equipmentSystem.getPortWorldPosition('PRIMARY-CRUSHER', 'dischargeOut'),
      stockpileFeed: equipmentSystem.getPortWorldPosition('STOCKPILE-RECLAIM', 'feedIn'),
      stockpileReclaim: equipmentSystem.getPortWorldPosition('STOCKPILE-RECLAIM', 'reclaimOut'),
    },
  };
  const frontEndConveyors = {
    root: equipmentSystem.root,
    conveyor01: equipmentSystem.getEquipment('CV-01-FEEDER-TO-CRUSHER').group3D,
    conveyor02: equipmentSystem.getEquipment('CV-02-CRUSHER-TO-STOCKPILE').group3D,
  };
  const grindingFeedConveyor = {
    root: equipmentSystem.getEquipment('CV-03-STOCKPILE-TO-GRINDING').group3D,
    conveyor: equipmentSystem.getEquipment('CV-03-STOCKPILE-TO-GRINDING').group3D,
  };
  const grindingClassification = { root: integratedPiping.root };
  const leachingTrainPiping = { root: integratedPiping.root, refresh: () => {} };
  const pumpingStationConnection = { root: integratedPiping.root };
  const recoveryConnections = { root: integratedPiping.root, engine: integratedPiping.engine, groups: integratedPiping.groups };
  const processPipeRacks = integratedPiping.supportRoot;

  const geotechnicalSystem = createGeotechnicalSystem({ ground, industrialPads, haulRoads });
  environmentRoot.add(geotechnicalSystem.root);

  const plantLabels = createPlantLabels({ equipmentSystem });
  environmentRoot.add(plantLabels);

  const equipmentInspection = createEquipmentInspectionSystem({ environmentRoot });
  const industrialAnimations = createIntegratedAnimations({ equipmentSystem, mobileEquipment, pipingSystem: integratedPiping });

  const hemisphere = new THREE.HemisphereLight(0xc9d6dc, 0x8a765d, 1.26);
  hemisphere.name = 'ambient-industrial-light';
  environmentRoot.add(hemisphere);

  const directional = new THREE.DirectionalLight(0xfff0d2, 2.08);
  directional.name = 'mine-sun-key-light';
  directional.position.set(-210, 245, 150);
  directional.castShadow = true;
  directional.shadow.mapSize.set(2048, 2048);
  directional.shadow.camera.near = 18;
  directional.shadow.camera.far = 820;
  const siteBounds = getSiteOverviewBounds();
  const siteHalfWidth = (siteBounds.maxX - siteBounds.minX) * 0.56;
  const siteHalfDepth = Math.max(250, (siteBounds.maxZ - siteBounds.minZ) * 0.62);
  directional.shadow.camera.left = -siteHalfWidth;
  directional.shadow.camera.right = siteHalfWidth;
  directional.shadow.camera.top = siteHalfDepth;
  directional.shadow.camera.bottom = -siteHalfDepth;
  directional.shadow.bias = -0.00008;
  directional.shadow.normalBias = 0.04;
  const sunTarget = new THREE.Object3D();
  sunTarget.name = 'mine-sun-target';
  sunTarget.position.set((siteBounds.minX + siteBounds.maxX) / 2, 0, (siteBounds.minZ + siteBounds.maxZ) / 2);
  environmentRoot.add(sunTarget);
  directional.target = sunTarget;
  directional.userData.lightingRole = 'key-sun';
  environmentRoot.add(directional);

  // V24D: soft opposite fill prevents dark industrial steel from collapsing into black
  // while preserving directional modelling from the shadow-casting key light.
  const fill = new THREE.DirectionalLight(0xb8d0db, 0.52);
  fill.name = 'soft-fill-light';
  fill.position.set(260, 120, -180);
  fill.castShadow = false;
  fill.userData.lightingRole = 'cool-fill';
  environmentRoot.add(fill);

  const groundBounce = new THREE.DirectionalLight(0xd6b783, 0.25);
  groundBounce.name = 'warm-ground-bounce';
  groundBounce.position.set(90, 45, 110);
  groundBounce.castShadow = false;
  groundBounce.userData.lightingRole = 'ground-bounce';
  environmentRoot.add(groundBounce);

  return {
    scene,
    environmentRoot,
    skyDome,
    ground,
    blenderTerrainOverlay,
    platform,
    grid,
    haulRoads,
    industrialPads,
    civilInfrastructure,
    mineProps,
    processRoute,
    equipmentSystem,
    pipe1System,
    integratedPiping,
    mineralFrontEnd,
    frontEndConveyors,
    grindingFeedConveyor,
    grindingClassification,
    leachingTrainPiping,
    pumpingStationConnection,
    recoveryConnections,
    processPipeRacks,
    mobileEquipment,
    plantLabels,
    geotechnicalSystem,
    equipmentInspection,
    industrialAnimations,
    plantLayoutBounds: getPlantLayoutBounds(),
    getTerrainHeight,
    cameras: createPresetCameras(),
    inspectionControlLimits: INSPECTION_CONTROL_LIMITS,
    resourceStats: collectSceneResourceStats(environmentRoot),
    activeCamera: 'general',
  };
}

export function createBaseEnvironment({ canvas }) {
  const base = createBaseScene();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  let activeCamera = 'general';
  let labelsEnabled = true;
  let animationsEnabled = true;
  let animationFrame = null;
  let previousFrameTime = null;

  // V24B: Inspection is the only interactive/orbitable camera. Other presets remain fixed.
  const inspectionCamera = base.cameras.inspection;
  const inspectionControls = new OrbitControls(inspectionCamera, canvas);
  inspectionControls.enabled = false;
  inspectionControls.enableDamping = true;
  inspectionControls.dampingFactor = 0.08;
  inspectionControls.enablePan = true;
  inspectionControls.enableZoom = true;
  inspectionControls.enableRotate = true;
  inspectionControls.screenSpacePanning = true;
  inspectionControls.zoomToCursor = true;
  inspectionControls.zoomSpeed = 1.1;
  inspectionControls.panSpeed = 1.0;
  inspectionControls.rotateSpeed = 0.75;
  inspectionControls.minDistance = INSPECTION_CONTROL_LIMITS.minDistance;
  inspectionControls.maxDistance = INSPECTION_CONTROL_LIMITS.maxDistance;
  inspectionControls.minPolarAngle = 0.04;
  inspectionControls.maxPolarAngle = Math.PI * 0.92;
  inspectionControls.target.copy(inspectionCamera.userData.target);
  inspectionControls.update();
  function resize() {
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
    const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
    renderer.setSize(width, height, false);
    Object.values(base.cameras).forEach((camera) => {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
  }

  function applyLabelVisibility() {
    setPlantLabelsView(base.plantLabels, activeCamera);
    setPlantLabelsVisible(base.plantLabels, labelsEnabled);
    base.geotechnicalSystem.setLabelsVisible(labelsEnabled);
  }

  function setCamera(mode) {
    if (!Object.hasOwn(base.cameras, mode)) throw new RangeError(`Cámara no disponible: ${mode}.`);
    activeCamera = mode;
    inspectionControls.enabled = mode === 'inspection';
    base.equipmentInspection.contextOverlay.visible = mode === 'inspection' && Boolean(base.equipmentInspection.targetId);
    if (inspectionControls.enabled) inspectionControls.update();
    applyLabelVisibility();
    render();
  }

  function setLabelsVisible(visible) {
    labelsEnabled = Boolean(visible);
    applyLabelVisibility();
    render();
  }

  function render() {
    base.equipmentInspection.refreshContextOverlay?.();
    updatePlantLabelsForCamera(base.plantLabels, base.cameras[activeCamera]);
    base.geotechnicalSystem.updateForCamera(base.cameras[activeCamera]);
    renderer.render(base.scene, base.cameras[activeCamera]);
  }

  function setAnimationsEnabled(visible) {
    animationsEnabled = Boolean(visible);
    base.industrialAnimations.setEnabled(animationsEnabled);
    render();
  }

  function animate(timeMs) {
    const now = Number.isFinite(timeMs) ? timeMs : 0;
    const delta = previousFrameTime === null ? 0 : (now - previousFrameTime) / 1000;
    previousFrameTime = now;
    // Keep the scheduling loop cheap when both the process animation and the only
    // interactive camera are inactive. State/camera changes still call render()
    // explicitly, so a static preset no longer burns GPU frames unnecessarily.
    if (animationsEnabled || inspectionControls.enabled) {
      if (animationsEnabled) base.industrialAnimations.update(delta, base.cameras[activeCamera]);
      if (inspectionControls.enabled) inspectionControls.update();
      render();
    }
    animationFrame = requestAnimationFrame(animate);
  }

  let pipeRenderKey = JSON.stringify([
    getState().transport.pipe1.innerDiameterM,
    getState().transport.pipe1.lengthM,
    getState().transport.pipe1.material,
  ]);
  const unsubscribeState = subscribeState((state) => {
    const nextPipeRenderKey = JSON.stringify([
      state.transport.pipe1.innerDiameterM,
      state.transport.pipe1.lengthM,
      state.transport.pipe1.material,
    ]);
    if (nextPipeRenderKey !== pipeRenderKey) {
      pipeRenderKey = nextPipeRenderKey;
      base.pipe1System.update(state.transport.pipe1);
      base.equipmentInspection.refreshTargets?.();
      base.industrialAnimations.refreshRoutes?.();
    }
    updatePlantLabels(base.plantLabels, base.equipmentSystem);
    render();
  });

  resize();
  applyLabelVisibility();
  render();
  if (typeof requestAnimationFrame === 'function') animationFrame = requestAnimationFrame(animate);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(canvas.parentElement || canvas);

  return {
    ...base,
    renderer,
    get activeCamera() { return activeCamera; },
    setCamera,
    setLabelsVisible,
    get labelsVisible() { return labelsEnabled; },
    setAnimationsEnabled,
    setGeotechnicsVisible(visible) {
      base.geotechnicalSystem.setVisible(visible);
      render();
    },
    get geotechnicsVisible() { return base.geotechnicalSystem.visible; },
    setScenePalette(palette) {
      applyIndustrialPaletteToScene(base.environmentRoot, palette);
      render();
    },
    setProcessMetrics(metrics) {
      base.industrialAnimations.setProcessMetrics(metrics);
      render();
    },
    get animationsEnabled() { return animationsEnabled; },
    getInspectionTargets: () => base.equipmentInspection.getTargets(),
    setInspectionTarget(id) {
      const target = base.equipmentInspection.setTarget(id);
      base.equipmentInspection.contextOverlay.visible = activeCamera === 'inspection' && Boolean(target);
      const targetMeta = id ? base.equipmentInspection.getTargets().find((item) => item.id === id) : null;
      setInspectionTargetLabel(base.plantLabels, target, targetMeta?.label ?? id ?? '');
      setPlantLabelsView(base.plantLabels, activeCamera);
      if (target) {
        target.updateWorldMatrix?.(true, true);
        const bounds = new THREE.Box3().setFromObject(target);
        if (!bounds.isEmpty()) {
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          const radius = Math.max(1, size.length() * 0.5);
          const previousDirection = inspectionCamera.position.clone().sub(inspectionControls.target);
          if (previousDirection.lengthSq() < 1e-6) previousDirection.set(1, 0.65, 1);
          previousDirection.normalize();
          // Keep a modest downward component so the selected object is readable
          // without forcing a manual per-equipment camera offset.
          previousDirection.y = Math.max(previousDirection.y, 0.26);
          previousDirection.normalize();
          const distance = THREE.MathUtils.clamp(
            computeInspectionCameraDistance(size, inspectionCamera.fov, inspectionCamera.aspect),
            Math.max(3.5, radius * 1.15),
            120,
          );
          inspectionControls.target.copy(center);
          inspectionCamera.position.copy(center).add(previousDirection.multiplyScalar(distance));
          inspectionCamera.near = Math.max(0.04, distance / 320);
          inspectionControls.minDistance = Math.max(0.8, radius * 0.28);
          inspectionControls.maxDistance = Math.min(INSPECTION_CONTROL_LIMITS.maxDistance, Math.max(65, radius * 18));
          inspectionCamera.updateProjectionMatrix();
          inspectionControls.update();
        }
      }
      render();
      return target;
    },
    setInspectionMode(mode) {
      base.equipmentInspection.setMode(mode);
      render();
    },
    get inspectionTargetId() { return base.equipmentInspection.targetId; },
    get inspectionMode() { return base.equipmentInspection.mode; },
    inspectionControls,
    resize,
    render,
    dispose() {
      resizeObserver?.disconnect();
      unsubscribeState();
      if (animationFrame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(animationFrame);
      base.industrialAnimations.dispose();
      base.equipmentInspection.dispose();
      base.geotechnicalSystem.dispose();
      base.blenderTerrainOverlay.dispose();
      base.pipe1System.dispose();
      base.integratedPiping.dispose();
      inspectionControls.dispose();
      renderer.dispose();
      base.scene.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose();
      });
    },
  };
}
