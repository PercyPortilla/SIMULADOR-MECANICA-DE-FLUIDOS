import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const contractPath = path.join(root, 'blender', 'generated', 'v26-reception-earthwork-contract.json');
const buildPath = path.join(root, 'blender', 'generated', 'v26-reception-earthwork-build.json');
const glbPath = path.join(root, 'public', 'models', 'pulpa-blender', 'RECEPTION-EARTHWORK-V26.glb');
const v21Path = path.join(root, 'public', 'models', 'pulpa-blender', 'RECEPTION-EARTHWORK-V21.glb');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readGlb(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.subarray(0, 4).toString() !== 'glTF') throw new Error('Not a GLB file');
  let offset = 12;
  let doc = null;
  let binary = null;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + length);
    if (type === 0x4E4F534A) doc = JSON.parse(chunk.toString('utf8').replace(/\0+$/g, ''));
    if (type === 0x004E4942) binary = chunk;
    offset += length;
  }
  if (!doc) throw new Error('GLB JSON chunk missing');
  if (!binary) throw new Error('GLB BIN chunk missing');
  return { doc, binary };
}

function readFloatAccessor(doc, binary, accessorIndex) {
  const accessor = doc.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
  if (accessor.componentType !== 5126) throw new Error(`Accessor ${accessorIndex} must use FLOAT components`);
  const componentsByType = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const components = componentsByType[accessor.type];
  if (!components) throw new Error(`Unsupported accessor type ${accessor.type}`);
  const view = doc.bufferViews?.[accessor.bufferView];
  if (!view) throw new Error(`Accessor ${accessorIndex} has no bufferView`);
  const elementBytes = components * 4;
  const stride = view.byteStride ?? elementBytes;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const values = [];
  for (let index = 0; index < accessor.count; index += 1) {
    const elementOffset = start + index * stride;
    const item = [];
    for (let component = 0; component < components; component += 1) {
      item.push(binary.readFloatLE(elementOffset + component * 4));
    }
    values.push(item);
  }
  return values;
}

for (const filePath of [contractPath, buildPath, glbPath, v21Path]) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing required file: ${filePath}`);
}

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const build = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
if (contract.assetId !== 'RECEPTION-EARTHWORK-V26') throw new Error('Unexpected V26 contract assetId');
if (contract.authoritative !== false || contract.visualOnly !== true) throw new Error('V26 must remain visual-only');
if (contract.worldUnitsPerMeter !== 1) throw new Error('V26 must use metre scale');
if (contract.worldPlanar?.projection !== 'world-xz' || contract.worldPlanar?.repeats !== false) throw new Error('V26 UV contract is not non-repeating world planar');
if (build.asset !== contract.assetId || build.contractHash !== contract.contractHash) throw new Error('Build report does not match contract');
if (build.textures?.length !== 16) throw new Error(`Expected 16 PBR texture files, got ${build.textures?.length ?? 0}`);
for (const texturePath of build.textures) {
  if (!fs.existsSync(texturePath) || fs.statSync(texturePath).size < 1024) throw new Error(`Texture missing or too small: ${texturePath}`);
}

const { doc, binary } = readGlb(glbPath);
const names = (doc.nodes ?? []).map((node) => node.name ?? '');
for (const band of ['CREST', 'UPPER_SLOPE', 'BERM', 'TOE_SLOPE']) {
  if (!names.some((name) => name.includes(`RECEPTION-EARTHWORK-V26_${band}`))) throw new Error(`Missing semantic band ${band}`);
}
for (const overlay of contract.trafficOverlays) {
  if (!names.includes(overlay.id)) throw new Error(`Missing traffic overlay ${overlay.id}`);
}
if ((doc.animations ?? []).length !== 0) throw new Error('V26 terrain asset must not contain animations');
if ((doc.images ?? []).length < 12) throw new Error(`Expected embedded PBR image set; GLB only has ${(doc.images ?? []).length}`);

const materials = doc.materials ?? [];
const terrainMaterials = materials.filter((material) => material.name?.startsWith('V26_') && material.name?.endsWith('_PBR'));
if (terrainMaterials.length !== 4) throw new Error(`Expected four band PBR materials, got ${terrainMaterials.length}`);
for (const material of terrainMaterials) {
  if (material.pbrMetallicRoughness?.baseColorTexture == null) throw new Error(`${material.name} missing baseColorTexture`);
  if (material.pbrMetallicRoughness?.metallicRoughnessTexture == null) throw new Error(`${material.name} missing metallicRoughnessTexture`);
  if (material.normalTexture == null) throw new Error(`${material.name} missing normalTexture`);
  if (material.occlusionTexture == null) throw new Error(`${material.name} missing occlusionTexture`);
}
for (const sampler of doc.samplers ?? []) {
  if (sampler.wrapS !== 33071 || sampler.wrapT !== 33071) throw new Error('V26 PBR sampler must use CLAMP_TO_EDGE on both axes');
}

const bandMeshes = (doc.meshes ?? []).filter((mesh) => mesh.name?.startsWith('RECEPTION-EARTHWORK-V26_'));
if (bandMeshes.length !== 4) throw new Error(`Expected four semantic V26 band meshes, got ${bandMeshes.length}`);
const mins = [Infinity, Infinity, Infinity];
const maxs = [-Infinity, -Infinity, -Infinity];
for (const mesh of bandMeshes) {
  for (const primitive of mesh.primitives ?? []) {
    if (primitive.attributes?.TEXCOORD_0 == null) throw new Error(`${mesh.name} is missing TEXCOORD_0`);
    const uvValues = readFloatAccessor(doc, binary, primitive.attributes.TEXCOORD_0);
    if (uvValues.some(([u, v]) => u < -1e-4 || v < -1e-4 || u > 1.0001 || v > 1.0001)) throw new Error(`${mesh.name} world-planar UVs leave the non-repeating 0..1 domain`);
    const accessor = doc.accessors?.[primitive.attributes?.POSITION];
    if (!accessor?.min || !accessor?.max) throw new Error(`${mesh.name} POSITION accessor has no bounds`);
    for (let axis = 0; axis < 3; axis += 1) {
      mins[axis] = Math.min(mins[axis], accessor.min[axis]);
      maxs[axis] = Math.max(maxs[axis], accessor.max[axis]);
    }
  }
}
const bounds = { min: mins, max: maxs };
const size = maxs.map((value, index) => value - mins[index]);
const expected = contract.worldPlanar.boundsM;
const expectedWidth = expected.xMax - expected.xMin;
const expectedDepth = expected.zMax - expected.zMin;
if (Math.abs(bounds.min[0] - expected.xMin) > 0.08 || Math.abs(bounds.max[0] - expected.xMax) > 0.08) throw new Error(`Unexpected X bounds: ${bounds.min[0]}..${bounds.max[0]}`);
if (Math.abs(bounds.min[2] - expected.zMin) > 0.12 || Math.abs(bounds.max[2] - expected.zMax) > 0.12) throw new Error(`Unexpected Z bounds: ${bounds.min[2]}..${bounds.max[2]}`);
if (Math.abs(size[0] - expectedWidth) > 0.12 || Math.abs(size[2] - expectedDepth) > 0.16) throw new Error(`Unexpected world footprint: ${size[0]} x ${size[2]}`);

console.log(JSON.stringify({
  ok: true,
  asset: contract.assetId,
  contractHash: contract.contractHash,
  glbBytes: fs.statSync(glbPath).size,
  glbSha256: sha256(glbPath),
  v21Sha256: sha256(v21Path),
  bounds: { min: bounds.min, max: bounds.max, size },
  pbrMaterials: terrainMaterials.map((material) => material.name),
  embeddedImages: (doc.images ?? []).length,
  texturesOnDisk: build.textures.length,
  overlays: contract.trafficOverlays.map((overlay) => overlay.id),
  animations: (doc.animations ?? []).length,
}, null, 2));
