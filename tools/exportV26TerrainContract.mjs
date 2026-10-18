import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RECEPTION_EARTHWORK,
  WORLD_UNITS_PER_METER,
} from '../src/scene/config/siteDesign.js';
import {
  getReceptionEarthworkBand,
  getTerrainHeight,
} from '../src/scene/environment/terrainHeight.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const outputPath = path.join(projectRoot, 'blender', 'generated', 'v26-reception-earthwork-contract.json');
const stepM = 1.0;

function axis(min, max, step) {
  const values = [];
  for (let value = min; value < max - 1e-9; value += step) values.push(Number(value.toFixed(6)));
  values.push(Number(max.toFixed(6)));
  return values;
}

const [centerX, centerZ] = RECEPTION_EARTHWORK.center;
const [crestWidth, crestDepth] = RECEPTION_EARTHWORK.crestSizeM;
const earthworkRun = RECEPTION_EARTHWORK.upperSlopeRunM
  + RECEPTION_EARTHWORK.bermWidthM
  + RECEPTION_EARTHWORK.toeSlopeRunM;
const xMin = centerX - crestWidth / 2 - earthworkRun;
const xMax = centerX + crestWidth / 2;
const zMin = centerZ - crestDepth / 2 - earthworkRun;
const zMax = centerZ + crestDepth / 2;
const xValues = axis(xMin, xMax, stepM);
const zValues = axis(zMin, zMax, stepM);
const heights = zValues.map((z) => xValues.map((x) => Number(getTerrainHeight(x, z).toFixed(6))));
const cellBands = zValues.slice(0, -1).map((z0, zi) => xValues.slice(0, -1).map((x0, xi) => {
  const x1 = xValues[xi + 1];
  const z1 = zValues[zi + 1];
  return getReceptionEarthworkBand((x0 + x1) / 2, (z0 + z1) / 2);
}));

const pbrProfiles = {
  crest: {
    label: 'compacted-granular-rom-platform',
    baseColor: [0.50, 0.44, 0.36],
    colorVariation: 0.16,
    roughness: [0.90, 0.98],
    normalStrength: 0.55,
    aoStrength: 0.22,
    seed: 2601,
  },
  'upper-slope': {
    label: 'exposed-compacted-fill-and-rock',
    baseColor: [0.35, 0.31, 0.27],
    colorVariation: 0.24,
    roughness: [0.94, 1.0],
    normalStrength: 1.15,
    aoStrength: 0.34,
    seed: 2602,
  },
  berm: {
    label: 'compacted-catch-berm-gravel',
    baseColor: [0.46, 0.40, 0.33],
    colorVariation: 0.19,
    roughness: [0.93, 1.0],
    normalStrength: 0.78,
    aoStrength: 0.26,
    seed: 2603,
  },
  'toe-slope': {
    label: 'mixed-earth-rock-toe-transition',
    baseColor: [0.30, 0.29, 0.27],
    colorVariation: 0.27,
    roughness: [0.92, 1.0],
    normalStrength: 1.28,
    aoStrength: 0.38,
    seed: 2604,
  },
};

// Traffic overlays are unique world-space features, not tiled decals. Blender
// samples their Y from this same contract, so they remain visual-only and never
// become a second height authority.
const trafficOverlays = [
  {
    id: 'ROM-DUMP-APRON-WEAR',
    type: 'irregular-patch',
    center: [-123.0, -29.0],
    radiiM: [14.2, 10.2],
    rotationDeg: -3.5,
    alpha: 0.16,
    seed: 2611,
  },
  {
    id: 'ROM-HOPPER-FINES-STAIN',
    type: 'irregular-patch',
    center: [-114.7, -31.2],
    radiiM: [4.9, 3.0],
    rotationDeg: 8.0,
    alpha: 0.16,
    seed: 2612,
  },
  {
    id: 'ROM-TIRE-RIBBON-INNER',
    type: 'ribbon',
    widthM: 0.70,
    alpha: 0.22,
    points: [[-135.0, -41.0], [-131.8, -36.2], [-128.0, -32.7], [-124.5, -29.4], [-121.8, -26.3], [-120.4, -23.4]],
  },
  {
    id: 'ROM-TIRE-RIBBON-OUTER',
    type: 'ribbon',
    widthM: 0.76,
    alpha: 0.20,
    points: [[-133.5, -42.1], [-130.1, -37.3], [-126.0, -33.8], [-122.3, -30.6], [-119.5, -27.0], [-118.4, -23.8]],
  },
];

const contractCore = {
  version: 'V26',
  assetId: 'RECEPTION-EARTHWORK-V26',
  source: 'src/scene/environment/terrainHeight.js#getTerrainHeight',
  sourceBandClassifier: 'src/scene/environment/terrainHeight.js#getReceptionEarthworkBand',
  authoritative: false,
  visualOnly: true,
  worldUnitsPerMeter: WORLD_UNITS_PER_METER,
  sampleStepM: stepM,
  visualLiftM: 0.035,
  overlayLiftM: 0.058,
  earthwork: RECEPTION_EARTHWORK,
  worldPlanar: {
    projection: 'world-xz',
    wrap: 'clamp',
    textureResolutionPx: 512,
    boundsM: { xMin, xMax, zMin, zMax },
    repeats: false,
  },
  pbrProfiles,
  trafficOverlays,
  grid: { xValues, zValues, heights, cellBands },
};

const contractHash = crypto.createHash('sha256').update(JSON.stringify(contractCore)).digest('hex');
const payload = { ...contractCore, contractHash };

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  assetId: payload.assetId,
  contractHash,
  xSamples: xValues.length,
  zSamples: zValues.length,
  cells: cellBands.flat().filter(Boolean).length,
  bounds: { xMin, xMax, zMin, zMax },
  trafficOverlays: trafficOverlays.length,
}));
