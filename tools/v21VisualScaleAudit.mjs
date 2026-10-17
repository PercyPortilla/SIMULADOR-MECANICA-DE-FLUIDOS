import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const assetRoot = path.join(projectRoot, 'public', 'models', 'pulpa-blender');

// References are [length, width, height] in metres. GLTFLoader exposes Blender
// exports in Three.js as X=length, Y=height, Z=width, so comparison below uses
// [box.x, box.z, box.y]. These are envelope checks, not rescale targets.
const REFERENCES = Object.freeze({
  'ROM-HOPPER.glb': [11.5, 9.2, 7.6],
  'APRON-FEEDER.glb': [8.4, 2.8, 1.85],
  'PRIMARY-CRUSHER.glb': [5.4, 4.2, 4.7],
  'STOCKPILE-RECLAIM.glb': [50.0, 40.0, 10.0],
  'MILL-01.glb': [10.6, 6.1, 5.65],
  'SUMP-01.glb': [5.1, 5.1, 3.3],
  'SLURRY-PUMP-01.glb': [4.8, 2.65, 2.55],
  'CLASS-01.glb': [5.4, 5.4, 5.4],
  'LEACH-REACTOR.glb': [7.6, 7.6, 8.8],
  'CIP-ADSORPTION.glb': [13.8, 7.4, 6.9],
  'ELUTION-SKID.glb': [9.4, 5.6, 6.4],
  'EW-CELLS.glb': [10.8, 5.8, 3.8],
  'SMELTING-FURNACE.glb': [7.4, 5.8, 8.9],
  'HAUL-TRUCK.glb': [10.0, 5.25, 5.05],
  'WHEEL-LOADER.glb': [12.0, 3.75, 4.25],
});

const MIN_RATIO = 0.65;
const MAX_RATIO = 1.65;

async function loadLocalGlb(filePath) {
  const raw = fs.readFileSync(filePath);
  const data = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(data, '', resolve, reject));
}

const checks = [];
for (const [filename, reference] of Object.entries(REFERENCES)) {
  const filePath = path.join(assetRoot, filename);
  const gltf = await loadLocalGlb(filePath);
  const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  const measured = [size.x, size.z, size.y];
  const ratios = measured.map((value, index) => value / reference[index]);
  checks.push({
    id: filename,
    referenceM: reference,
    measuredM: measured.map((value) => Number(value.toFixed(3))),
    ratios: ratios.map((value) => Number(value.toFixed(3))),
    ok: ratios.every((value) => value >= MIN_RATIO && value <= MAX_RATIO),
  });
}

// Mining shovel reference body length excludes boom/stick reach. Audit its full
// visual envelope separately so the articulated arm is not mistaken for a scale error.
{
  const filename = 'MINING-SHOVEL.glb';
  const gltf = await loadLocalGlb(path.join(assetRoot, filename));
  const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  const measured = [size.x, size.z, size.y];
  const ok = measured[0] >= 12 && measured[0] <= 18
    && measured[1] >= 6.5 && measured[1] <= 12
    && measured[2] >= 5.5 && measured[2] <= 10;
  checks.push({
    id: filename,
    referenceM: 'articulated envelope; 9.9 m catalog value is body length only',
    measuredM: measured.map((value) => Number(value.toFixed(3))),
    ok,
  });
}

const failed = checks.filter((item) => !item.ok);
console.log(JSON.stringify({
  units: 'metres',
  axisMapping: 'Three X=length, Z=width, Y=height',
  ratioEnvelope: [MIN_RATIO, MAX_RATIO],
  checks: checks.length,
  passed: checks.length - failed.length,
  failed,
  details: checks,
}, null, 2));
if (failed.length) process.exit(1);
