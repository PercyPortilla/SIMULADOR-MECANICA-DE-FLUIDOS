import * as THREE from 'three';

function seededUnit(index, seed = 1) {
  const value = Math.sin((index + 1) * (12.9898 + seed * 0.371)) * 43758.5453;
  return value - Math.floor(value);
}

export function createSuspendedSolidsCloud({
  name = 'slurry-suspended-solids',
  radius = 1,
  height = 1,
  count = 64,
  color = 0xffd89a,
  size = 0.045,
  opacity = 0.5,
  seed = 1,
  y = 0,
} = {}) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radial = Math.sqrt(seededUnit(i * 3, seed)) * radius;
    const angle = seededUnit(i * 3 + 1, seed) * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radial;
    positions[i * 3 + 1] = (seededUnit(i * 3 + 2, seed) - 0.5) * height;
    positions[i * 3 + 2] = Math.sin(angle) * radial;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = name;
  points.position.y = y;
  points.frustumCulled = true;
  points.userData.inspectionRole = 'interior';
  points.userData.inspectionInterior = true;
  points.userData.suspendedSolids = true;
  return points;
}

export function animateSuspendedSolids(points, dt, elapsed, { speed = 0.06, phase = 0 } = {}) {
  if (!points) return;
  points.rotation.y += dt * speed;
  points.position.x = Math.sin(elapsed * 0.31 + phase) * 0.015;
  points.position.z = Math.cos(elapsed * 0.27 + phase) * 0.015;
}
