import * as THREE from 'three';
import { createEquipment } from './equipmentRegistry.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

export const DEFAULT_REACTOR_DIMENSIONS = Object.freeze({
  diameter: 7.0,
  shellHeight: 8.0,
  baseHeight: 0.55,
  platformHeight: 8.45,
});

function standardMaterial(color, options = {}) {
  return createIndustrialMaterial('processSteel', {
    color,
    roughness: options.roughness ?? 0.56,
    metalness: options.metalness ?? 0.34,
  });
}


function enableMeshShadows(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

function createRail(radius, y) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(64).map((point) => new THREE.Vector3(point.x, y, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color: 0xe0b845 }));
}

export function createLeachReactor({
  id = 'R-01',
  position,
  rotationY = 0,
  dimensions = DEFAULT_REACTOR_DIMENSIONS,
} = {}) {
  const dims = { ...DEFAULT_REACTOR_DIMENSIONS, ...dimensions };
  const radius = dims.diameter / 2;
  const group = new THREE.Group();
  group.name = id;
  group.userData.inspectableEquipment = true;

  const supportMaterial = standardMaterial(0x6d797d, { roughness: 0.72, metalness: 0.35 });
  const shellMaterial = standardMaterial(0x9aa4a6, { roughness: 0.5, metalness: 0.32 });
  const darkMetal = standardMaterial(0x526065, { roughness: 0.52, metalness: 0.5 });
  const safetyMaterial = standardMaterial(0xd4aa2c, { roughness: 0.6, metalness: 0.16 });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.08, radius * 1.08, dims.baseHeight, 40),
    supportMaterial,
  );
  base.name = `${id}-base`;
  base.position.y = dims.baseHeight / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, dims.shellHeight, 48),
    shellMaterial,
  );
  shell.name = `${id}-shell`;
  shell.userData.inspectionShell = true;
  shell.position.y = dims.baseHeight + dims.shellHeight / 2;
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  // Aros de rigidización del tanque: detalle repetible y liviano que mejora la escala industrial.
  [1.8, 4.0, 6.2].forEach((localY, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.005, 0.055, 8, 40),
      darkMetal,
    );
    ring.name = `${id}-shell-stiffener-${index + 1}`;
    ring.rotation.x = Math.PI / 2;
    ring.position.y = dims.baseHeight + localY;
    group.add(ring);
  });

  // Manhole lateral y pequeña plataforma local.
  const manway = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.18, 24),
    darkMetal,
  );
  manway.name = `${id}-manway`;
  manway.rotation.z = Math.PI / 2;
  manway.position.set(radius + 0.07, dims.baseHeight + 2.05, 0.9);
  group.add(manway);
  const manwayDeck = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.9), darkMetal);
  manwayDeck.name = `${id}-manway-deck`;
  manwayDeck.position.set(radius + 0.58, dims.baseHeight + 1.28, 0.9);
  group.add(manwayDeck);

  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, 0.22, 48),
    darkMetal,
  );
  lid.name = `${id}-lid`;
  lid.position.y = dims.baseHeight + dims.shellHeight + 0.11;
  lid.castShadow = true;
  group.add(lid);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.22, radius * 1.22, 0.18, 48),
    darkMetal,
  );
  platform.name = `${id}-service-platform`;
  platform.position.y = dims.platformHeight;
  platform.castShadow = true;
  group.add(platform);

  const agitatorAssembly = new THREE.Group();
  agitatorAssembly.name = `${id}-agitator-assembly`;
  agitatorAssembly.userData.agitatorAssembly = true;

  const agitatorShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, dims.shellHeight * 0.72, 18),
    darkMetal,
  );
  agitatorShaft.name = `${id}-agitator-shaft`;
  agitatorShaft.position.y = dims.baseHeight + dims.shellHeight * 0.72;
  agitatorAssembly.add(agitatorShaft);

  [dims.baseHeight + 1.45, dims.baseHeight + 3.0].forEach((y, levelIndex) => {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.28, 18), darkMetal);
    hub.name = `${id}-impeller-hub-${levelIndex + 1}`;
    hub.position.y = y;
    agitatorAssembly.add(hub);
    for (let bladeIndex = 0; bladeIndex < 4; bladeIndex += 1) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 0.62, 0.12, 0.34),
        safetyMaterial,
      );
      blade.name = `${id}-impeller-blade-${levelIndex + 1}-${bladeIndex + 1}`;
      blade.position.set(Math.cos(bladeIndex * Math.PI / 2) * radius * 0.34, y, Math.sin(bladeIndex * Math.PI / 2) * radius * 0.34);
      blade.rotation.y = bladeIndex * Math.PI / 2;
      blade.userData.inspectionInterior = true;
      agitatorAssembly.add(blade);
    }
  });
  group.add(agitatorAssembly);

  const slurryMaterial = new THREE.MeshStandardMaterial({
    color: 0x846a50,
    roughness: 0.84,
    metalness: 0,
    transparent: true,
    opacity: 0.82,
  });
  const slurrySurface = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.93, radius * 0.93, 0.16, 42),
    slurryMaterial,
  );
  slurrySurface.name = `${id}-slurry-surface`;
  slurrySurface.position.y = dims.baseHeight + dims.shellHeight * 0.78;
  slurrySurface.userData.inspectionInterior = true;
  slurrySurface.userData.slurrySurface = true;
  slurrySurface.visible = false;
  group.add(slurrySurface);

  // Internal baffles make the cutaway useful instead of revealing an empty cylinder.
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI / 2;
    const baffle = new THREE.Mesh(new THREE.BoxGeometry(0.14, dims.shellHeight * 0.72, radius * 0.48), darkMetal);
    baffle.name = `${id}-internal-baffle-${index + 1}`;
    baffle.position.set(Math.cos(angle) * radius * 0.78, dims.baseHeight + dims.shellHeight * 0.48, Math.sin(angle) * radius * 0.78);
    baffle.rotation.y = -angle;
    baffle.userData.inspectionInterior = true;
    baffle.visible = false;
    group.add(baffle);
  }

  const motor = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.9, 1.05),
    standardMaterial(0x5d6c72, { roughness: 0.55, metalness: 0.42 }),
  );
  motor.name = `${id}-agitator-motor`;
  motor.position.y = dims.platformHeight + 0.72;
  motor.castShadow = true;
  group.add(motor);

  const motorFan = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.2, 20),
    darkMetal,
  );
  motorFan.name = `${id}-agitator-motor-fan`;
  motorFan.rotation.z = Math.PI / 2;
  motorFan.position.set(0.68, dims.platformHeight + 0.72, 0);
  group.add(motorFan);

  const gearbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, 0.42, 24),
    safetyMaterial,
  );
  gearbox.name = `${id}-gearbox`;
  gearbox.position.y = dims.platformHeight + 0.22;
  group.add(gearbox);

  const rail = createRail(radius * 1.25, dims.platformHeight + 0.72);
  rail.name = `${id}-safety-rail`;
  group.add(rail);

  // V23F: detalle industrial moderado sin alterar puertos ni dimensiones funcionales.
  // Segundo nivel de baranda para que la plataforma se lea mejor a distancia.
  const midRail = createRail(radius * 1.25, dims.platformHeight + 0.38);
  midRail.name = `${id}-mid-safety-rail`;
  group.add(midRail);

  // Escalera vertical de mantenimiento pegada al tanque, dentro de su envolvente de servicio.
  const ladderZ = -(radius + 0.18);
  [-0.28, 0.28].forEach((x) => {
    const railMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, dims.platformHeight - 0.45, 0.055),
      safetyMaterial,
    );
    railMesh.name = `${id}-access-ladder-rail`;
    railMesh.position.set(x, (dims.platformHeight + 0.45) / 2, ladderZ);
    group.add(railMesh);
  });
  for (let y = 0.65; y < dims.platformHeight - 0.35; y += 0.42) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.045, 0.055), safetyMaterial);
    rung.name = `${id}-access-ladder-rung`;
    rung.position.set(0, y, ladderZ);
    group.add(rung);
  }

  // Cuatro ménsulas discretas bajo plataforma para reforzar lectura estructural.
  [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((angle) => {
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, radius * 0.62),
      darkMetal,
    );
    bracket.name = `${id}-platform-bracket`;
    bracket.position.set(
      Math.cos(angle) * radius * 0.78,
      dims.platformHeight - 0.28,
      Math.sin(angle) * radius * 0.78,
    );
    bracket.rotation.y = -angle;
    group.add(bracket);
  });

  const stanchionGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8);
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const post = new THREE.Mesh(stanchionGeometry, safetyMaterial);
    post.position.set(
      Math.cos(angle) * radius * 1.25,
      dims.platformHeight + 0.36,
      Math.sin(angle) * radius * 1.25,
    );
    group.add(post);
  }

  // Simplificación deliberada del tren: inlet y outlet comparten cota lateral para
  // permitir conexiones inter-etapa sin desplazar verticalmente los reactores del pad.
  const interstagePortHeight = dims.baseHeight + dims.shellHeight * 0.56;
  const inletPosition = [-(radius + 0.34), interstagePortHeight, 0];
  const outletPosition = [radius + 0.34, interstagePortHeight, 0];
  const nozzleMaterial = standardMaterial(0x78909a, { roughness: 0.48, metalness: 0.5 });
  [
    { name: 'inlet', position: inletPosition },
    { name: 'outlet', position: outletPosition },
  ].forEach(({ name, position }) => {
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.68, 20),
      nozzleMaterial,
    );
    nozzle.name = `${id}-${name}-nozzle`;
    nozzle.rotation.z = Math.PI / 2;
    nozzle.position.set(...position);
    nozzle.castShadow = true;
    group.add(nozzle);
  });

  // V24E: secondary maintenance details participate in the same shadow model as the vessel.
  enableMeshShadows(group);

  return createEquipment({
    id,
    type: 'leach-reactor',
    dimensions: dims,
    transform: { position, rotationY },
    ports: [
      {
        id: 'inlet',
        type: 'inlet',
        localPosition: inletPosition,
        direction: [-1, 0, 0],
        nominalDiameterM: 0.05,
      },
      {
        id: 'outlet',
        type: 'outlet',
        localPosition: outletPosition,
        direction: [1, 0, 0],
        nominalDiameterM: 0.05,
      },
    ],
    metadata: {
      label: id,
      zoneId: 'Z6',
      process: 'leaching',
    },
    group3D: group,
  });
}
