import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';

// B80 removes only broad legacy/duplicate overlays that visually cover the
// integrated V57 terrain. Local structural foundations remain authoritative.
export const B80_SUPERSEDED_OVERSIZED_PADS = Object.freeze([
  'CIV_ROM_MANEUVER_PAD',
]);

export const B80_CIVIL_MATERIAL_PROFILES = Object.freeze({
  MAT_V57_CIVIL_COMPACTED_FILL: Object.freeze({
    color: Object.freeze([0.36, 0.27, 0.18]),
    roughness: 0.96,
    role: 'compacted-earth',
  }),
  MAT_V57_CIVIL_CONCRETE: Object.freeze({
    color: Object.freeze([0.43, 0.44, 0.42]),
    roughness: 0.91,
    role: 'industrial-concrete',
  }),
});

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

export function collectB80BoundaryEdges(indices = []) {
  const edges = new Map();
  const add = (a, b) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = `${lo}:${hi}`;
    const current = edges.get(key);
    if (current) current.count += 1;
    else edges.set(key, { a, b, count: 1 });
  };
  for (let index = 0; index + 2 < indices.length; index += 3) {
    const a = Number(indices[index]);
    const b = Number(indices[index + 1]);
    const c = Number(indices[index + 2]);
    add(a, b);
    add(b, c);
    add(c, a);
  }
  return [...edges.values()].filter((edge) => edge.count === 1);
}

export function selectB80OuterBoundaryEdges(boundaryEdges = []) {
  if (!boundaryEdges.length) return [];
  const edgesByVertex = new Map();
  boundaryEdges.forEach((edge, index) => {
    [edge.a, edge.b].forEach((vertex) => {
      const list = edgesByVertex.get(vertex) ?? [];
      list.push(index);
      edgesByVertex.set(vertex, list);
    });
  });
  const visited = new Set();
  const components = [];
  boundaryEdges.forEach((_, startIndex) => {
    if (visited.has(startIndex)) return;
    const queue = [startIndex];
    const component = [];
    visited.add(startIndex);
    while (queue.length) {
      const edgeIndex = queue.pop();
      const edge = boundaryEdges[edgeIndex];
      component.push(edge);
      [edge.a, edge.b].forEach((vertex) => {
        (edgesByVertex.get(vertex) ?? []).forEach((neighborIndex) => {
          if (visited.has(neighborIndex)) return;
          visited.add(neighborIndex);
          queue.push(neighborIndex);
        });
      });
    }
    components.push(component);
  });
  components.sort((a, b) => b.length - a.length);
  return components[0] ?? [];
}

function positionAt(positions, index, transform) {
  const offset = index * 3;
  return Vector3.TransformCoordinates(
    new Vector3(
      Number(positions[offset]) || 0,
      Number(positions[offset + 1]) || 0,
      Number(positions[offset + 2]) || 0,
    ),
    transform,
  );
}

function outwardPoint(point, center, outsetM, dropM) {
  const dx = point.x - center.x;
  const dz = point.z - center.z;
  const length = Math.hypot(dx, dz) || 1;
  return new Vector3(
    point.x + (dx / length) * outsetM,
    point.y - dropM,
    point.z + (dz / length) * outsetM,
  );
}

export function buildB80TerrainApronVertexData({
  positions,
  indices,
  transform = Matrix.Identity(),
  outsetM = 180,
  outerDropM = 6,
  curtainDepthM = 28,
} = {}) {
  if (!positions?.length || !indices?.length) return null;
  const allBoundaryEdges = collectB80BoundaryEdges(indices);
  const boundaryEdges = selectB80OuterBoundaryEdges(allBoundaryEdges);
  if (!boundaryEdges.length) return null;

  const uniqueBoundaryIndices = new Set();
  boundaryEdges.forEach(({ a, b }) => {
    uniqueBoundaryIndices.add(a);
    uniqueBoundaryIndices.add(b);
  });
  const boundaryPoints = new Map();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  uniqueBoundaryIndices.forEach((index) => {
    const point = positionAt(positions, index, transform);
    boundaryPoints.set(index, point);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  });
  const center = new Vector3((minX + maxX) / 2, minY, (minZ + maxZ) / 2);
  const curtainBottomY = minY - Math.max(8, Number(curtainDepthM) || 28);
  const resultPositions = [];
  const resultIndices = [];

  function addQuad(a, b, c, d) {
    const base = resultPositions.length / 3;
    [a, b, c, d].forEach((point) => {
      resultPositions.push(point.x, point.y, point.z);
    });
    resultIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  boundaryEdges.forEach(({ a, b }) => {
    const topA = boundaryPoints.get(a);
    const topB = boundaryPoints.get(b);
    if (!topA || !topB) return;
    const outerA = outwardPoint(topA, center, Math.max(25, outsetM), Math.max(0.5, outerDropM));
    const outerB = outwardPoint(topB, center, Math.max(25, outsetM), Math.max(0.5, outerDropM));
    addQuad(topA, topB, outerB, outerA);
    addQuad(
      outerA,
      outerB,
      new Vector3(outerB.x, curtainBottomY, outerB.z),
      new Vector3(outerA.x, curtainBottomY, outerA.z),
    );
  });

  const normals = new Array(resultPositions.length).fill(0);
  VertexData.ComputeNormals(resultPositions, resultIndices, normals);
  return Object.freeze({
    positions: resultPositions,
    indices: resultIndices,
    normals,
    boundaryEdgeCount: boundaryEdges.length,
    excludedInternalBoundaryEdgeCount: allBoundaryEdges.length - boundaryEdges.length,
    curtainBottomY,
    bounds: Object.freeze({ minX, maxX, minY, minZ, maxZ }),
  });
}

function hideOversizedPads(rootNodes) {
  const names = new Set(B80_SUPERSEDED_OVERSIZED_PADS);
  const hidden = [];
  rootNodes.forEach((root) => {
    visitHierarchy(root, (node) => {
      if (!node || !names.has(String(node.name ?? ''))) return;
      node.setEnabled?.(false);
      if ('isVisible' in node) node.isVisible = false;
      node.metadata = {
        ...(node.metadata ?? {}),
        b80SupersededOversizedPad: true,
      };
      hidden.push(node.name);
    });
  });
  return hidden;
}

function repairCivilMaterial(material, repaired) {
  if (!material || repaired.has(material)) return;
  const children = Array.isArray(material.subMaterials) ? material.subMaterials.filter(Boolean) : [];
  if (children.length) {
    children.forEach((child) => repairCivilMaterial(child, repaired));
    return;
  }
  const profile = B80_CIVIL_MATERIAL_PROFILES[String(material.name ?? '')];
  if (!profile) return;
  const color = new Color3(...profile.color);
  if ('albedoColor' in material) material.albedoColor = color;
  if ('diffuseColor' in material) material.diffuseColor = color;
  if ('metallic' in material) material.metallic = 0;
  if ('roughness' in material) material.roughness = profile.roughness;
  if ('specularColor' in material) material.specularColor = new Color3(0.02, 0.02, 0.018);
  if ('specularPower' in material) material.specularPower = 3;
  material.metadata = {
    ...(material.metadata ?? {}),
    b80CivilMaterialRepair: true,
    b80CivilRole: profile.role,
    visualBuild: 'B80',
  };
  repaired.add(material);
}

function repairCivilMaterials(rootNodes) {
  const repaired = new Set();
  rootNodes.forEach((root) => {
    visitHierarchy(root, (node) => {
      if (!('material' in (node ?? {}))) return;
      repairCivilMaterial(node.material, repaired);
    });
  });
  return [...repaired];
}

function createEarthMaterial(scene) {
  const material = new StandardMaterial('b80-terrain-edge-earth', scene);
  material.diffuseColor = new Color3(0.31, 0.235, 0.16);
  material.ambientColor = new Color3(0.085, 0.065, 0.045);
  material.specularColor = new Color3(0.015, 0.014, 0.012);
  material.specularPower = 2;
  material.backFaceCulling = false;
  material.metadata = {
    visualOnly: true,
    siteRevision: 'V57',
    visualBuild: 'B80',
    purpose: 'terrain edge continuation',
  };
  return material;
}

function createApronForTerrain(scene, host, root, terrainMesh, material) {
  const positions = terrainMesh.getVerticesData?.(VertexBuffer.PositionKind);
  const indices = terrainMesh.getIndices?.();
  if (!positions?.length || !indices?.length) return null;
  terrainMesh.computeWorldMatrix?.(true);
  host.computeWorldMatrix?.(true);
  const hostInverse = host.getWorldMatrix?.().clone?.().invert?.() ?? Matrix.Identity();
  const localToHost = terrainMesh.getWorldMatrix?.().multiply?.(hostInverse) ?? Matrix.Identity();
  const data = buildB80TerrainApronVertexData({
    positions,
    indices,
    transform: localToHost,
  });
  if (!data) return null;

  const mesh = new Mesh(`B80_TERRAIN_EDGE_CONTINUATION_${terrainMesh.name}`, scene);
  mesh.parent = root;
  const vertexData = new VertexData();
  vertexData.positions = data.positions;
  vertexData.indices = data.indices;
  vertexData.normals = data.normals;
  vertexData.applyToMesh(mesh, false);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  mesh.metadata = {
    visualOnly: true,
    siteRevision: 'V57',
    visualBuild: 'B80',
    v57AuthoritativeVisual: true,
    b80TerrainEdgeContinuation: true,
    sourceTerrain: terrainMesh.name,
    boundaryEdgeCount: data.boundaryEdgeCount,
    curtainBottomY: data.curtainBottomY,
  };
  return mesh;
}

export function applyB80TerrainCivilVisual({ scene, rootNodes = [], host } = {}) {
  if (!scene || !host) throw new TypeError('B80 terrain/civil visual requires scene and host.');
  const root = new TransformNode('B80_TERRAIN_CIVIL_CLOSURE', scene);
  root.parent = host;
  root.metadata = {
    visualOnly: true,
    siteRevision: 'V57',
    visualBuild: 'B80',
    v57AuthoritativeVisual: true,
  };

  const hiddenOversizedPads = hideOversizedPads(rootNodes);
  const repairedCivilMaterials = repairCivilMaterials(rootNodes);
  const terrainMeshes = [];
  rootNodes.forEach((sourceRoot) => {
    visitHierarchy(sourceRoot, (node) => {
      if (!String(node?.name ?? '').startsWith('V57_TERRAIN_INTEGRATED')) return;
      if (!node.getVerticesData || !node.getIndices) return;
      terrainMeshes.push(node);
    });
  });
  const material = createEarthMaterial(scene);
  const aprons = terrainMeshes
    .map((terrain) => createApronForTerrain(scene, host, root, terrain, material))
    .filter(Boolean);

  root.metadata.hiddenOversizedPads = [...hiddenOversizedPads];
  root.metadata.repairedCivilMaterialNames = repairedCivilMaterials.map((material) => material.name);
  root.metadata.terrainApronCount = aprons.length;
  host.metadata = {
    ...(host.metadata ?? {}),
    b80TerrainCivilClosure: true,
    b80HiddenOversizedPadCount: hiddenOversizedPads.length,
    b80RepairedCivilMaterialCount: repairedCivilMaterials.length,
    b80TerrainApronCount: aprons.length,
  };

  return {
    root,
    hiddenOversizedPads,
    repairedCivilMaterials,
    aprons,
    dispose() {
      root.dispose(false, true);
      material.dispose(false, true);
      aprons.length = 0;
    },
  };
}
