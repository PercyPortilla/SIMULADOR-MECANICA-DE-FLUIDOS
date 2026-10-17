import * as THREE from 'three';

export const INSPECTION_MODES = Object.freeze(['normal', 'transparent', 'cutaway', 'interior']);

export function tagObject(object, { role = 'shell', lodTier = 0 } = {}) {
  object.userData.inspectionRole = role;
  object.userData.lodTier = lodTier;
  return object;
}

export function boxMesh(name, size, material, position = [0, 0, 0], options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2], 2, 2, 2), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return tagObject(mesh, options);
}

export function cylinderMesh(name, radiusTop, radiusBottom, height, material, position = [0, 0, 0], radialSegments = 32, options = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1, false), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return tagObject(mesh, options);
}

export function sphereMesh(name, radius, material, position = [0, 0, 0], options = {}) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return tagObject(mesh, options);
}

export function tubeBetween(name, a, b, radius, material, radialSegments = 16, options = {}) {
  const start = a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(...a);
  const end = b instanceof THREE.Vector3 ? b.clone() : new THREE.Vector3(...b);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const mesh = cylinderMesh(name, radius, radius, length, material, [0, 0, 0], radialSegments, options);
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

export function updateTubeBetween(mesh, a, b) {
  const start = a instanceof THREE.Vector3 ? a : new THREE.Vector3(...a);
  const end = b instanceof THREE.Vector3 ? b : new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const length = Math.max(1e-5, direction.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.scale.y = length / mesh.geometry.parameters.height;
}

function snapshotMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    object.userData.materialSnapshot = list.map((material) => ({
      material,
      transparent: material.transparent,
      opacity: material.opacity,
      depthWrite: material.depthWrite,
      clippingPlanes: material.clippingPlanes,
      side: material.side,
    }));
  });
}

function restoreMaterialSnapshots(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const snapshot = object.userData.materialSnapshot;
    if (!snapshot) return;
    snapshot.forEach(({ material, transparent, opacity, depthWrite, clippingPlanes, side }) => {
      material.transparent = transparent;
      material.opacity = opacity;
      material.depthWrite = depthWrite;
      material.clippingPlanes = clippingPlanes;
      material.side = side;
      material.needsUpdate = true;
    });
  });
}

export function applyInspectionMode(root, mode, cutPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)) {
  if (!INSPECTION_MODES.includes(mode)) throw new RangeError(`Unknown inspection mode: ${mode}`);
  if (!root.userData.hasInspectionSnapshot) {
    snapshotMaterials(root);
    root.userData.hasInspectionSnapshot = true;
  }
  restoreMaterialSnapshots(root);
  root.traverse((object) => {
    if (!object.isMesh) return;
    const role = object.userData.inspectionRole || 'shell';
    object.visible = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (mode === 'transparent' && role === 'shell') {
      materials.forEach((material) => {
        material.transparent = true;
        material.opacity = Math.min(material.opacity, 0.26);
        material.depthWrite = false;
        material.needsUpdate = true;
      });
    } else if (mode === 'cutaway' && role === 'shell') {
      materials.forEach((material) => {
        material.clippingPlanes = [cutPlane];
        material.clipShadows = true;
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      });
    } else if (mode === 'interior' && role === 'shell') {
      object.visible = false;
    }
  });
  root.userData.inspectionMode = mode;
}

function transformPort(root, port) {
  const position = new THREE.Vector3(...port.position);
  root.localToWorld(position);
  const quaternion = root.getWorldQuaternion(new THREE.Quaternion());
  const direction = new THREE.Vector3(...port.direction).applyQuaternion(quaternion).normalize();
  return {
    ...port,
    localPosition: [...port.position],
    localDirection: [...port.direction],
    position,
    direction,
  };
}

export function createAssetHandle({
  root,
  id,
  category,
  name,
  referenceClass,
  dimensions,
  ports = [],
  capabilities = {},
  update = () => {},
  lodDistances = [18, 45],
}) {
  let animationEnabled = true;
  let disposed = false;
  let elapsed = 0;
  let lastLodStateKey = null;
  const lodWorldPosition = new THREE.Vector3();
  root.name = id;
  root.userData.assetId = id;
  root.userData.category = category;
  root.userData.dimensions = dimensions;
  root.userData.referenceClass = referenceClass;
  root.userData.inspectionMode = 'normal';

  const handle = {
    id,
    root,
    metadata: Object.freeze({ id, category, name, referenceClass, dimensions: { ...dimensions }, capabilities: { ...capabilities }, ports: ports.map((p) => ({ ...p })) }),
    create: () => root,
    update(dt) {
      if (disposed || !animationEnabled || !Number.isFinite(dt) || dt <= 0) return;
      elapsed += dt;
      update(dt, elapsed, handle);
    },
    setAnimationEnabled(enabled) { animationEnabled = Boolean(enabled); },
    getAnimationEnabled() { return animationEnabled; },
    setInspectionMode(mode) { applyInspectionMode(root, mode); },
    getInspectionMode() { return root.userData.inspectionMode; },
    getPorts() { root.updateMatrixWorld(true); return ports.map((port) => transformPort(root, port)); },
    getDimensions() { return { ...dimensions }; },
    getBoundingBox() { root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(root); },
    updateLOD(camera) {
      if (!camera) return;
      const world = root.getWorldPosition(lodWorldPosition);
      const distance = camera.position.distanceTo(world);
      const tier = distance > lodDistances[1] ? 2 : distance > lodDistances[0] ? 1 : 0;
      const mode = root.userData.inspectionMode || 'normal';
      const visualStatus = root.userData.blenderVisualStatus || '';
      const contentRevision = Number(root.userData.lodContentRevision || 0);
      const stateKey = `${tier}|${mode}|${visualStatus}|${contentRevision}`;
      if (stateKey === lastLodStateKey) return;

      const stack = [root];
      while (stack.length) {
        const object = stack.pop();
        if (object !== root && object.userData?.blenderFallback && object.visible === false) continue;
        if (object.isMesh) {
          const objectTier = Number(object.userData.lodTier || 0);
          const inspectionVisible = !(mode === 'interior' && (object.userData.inspectionRole || 'shell') === 'shell');
          if (inspectionVisible) object.visible = objectTier <= (2 - tier);
        }
        for (let index = object.children.length - 1; index >= 0; index -= 1) stack.push(object.children[index]);
      }
      root.userData.activeLodTier = tier;
      lastLodStateKey = stateKey;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set();
      const materials = new Set();
      root.traverse((object) => {
        // Assets can contain Mesh, Line and Points helpers/interiors. Dispose every
        // owned geometry/material instead of leaking non-Mesh renderables.
        if (object.geometry) geometries.add(object.geometry);
        if (!object.material) return;
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.filter(Boolean).forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose?.());
      materials.forEach((material) => {
        for (const key of ['map', 'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap']) material[key]?.dispose?.();
        material.dispose?.();
      });
    },
  };
  return handle;
}

export function addBoltCircle(group, { radius = 0.5, count = 12, boltRadius = 0.035, y = 0, material, axis = 'y', lodTier = 1 } = {}) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const bolt = cylinderMesh(`bolt-${i}`, boltRadius, boltRadius, boltRadius * 1.8, material.clone(), [radius * Math.cos(angle), y, radius * Math.sin(angle)], 10, { role: 'structure', lodTier });
    if (axis === 'z') bolt.rotation.x = Math.PI / 2;
    if (axis === 'x') bolt.rotation.z = Math.PI / 2;
    group.add(bolt);
  }
}
