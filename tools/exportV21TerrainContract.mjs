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
const outputPath = path.join(projectRoot, 'blender', 'generated', 'v21-reception-earthwork-contract.json');
const stepM = 1.0;

function axis(min, max, step) {
  const values = [];
  for (let value = min; value < max - 1e-9; value += step) values.push(Number(value.toFixed(6)));
  values.push(Number(max.toFixed(6)));
  return values;
}

const [centerX, centerZ] = RECEPTION_EARTHWORK.center;
const [crestWidth, crestDepth] = RECEPTION_EARTHWORK.crestSizeM;
const southExtent = RECEPTION_EARTHWORK.upperSlopeRunM
  + RECEPTION_EARTHWORK.bermWidthM
  + RECEPTION_EARTHWORK.toeSlopeRunM;
const xMin = centerX - crestWidth / 2 - southExtent;
const xMax = centerX + crestWidth / 2;
const zMin = centerZ - crestDepth / 2 - southExtent;
const zMax = centerZ + crestDepth / 2;
const xValues = axis(xMin, xMax, stepM);
const zValues = axis(zMin, zMax, stepM);

const heights = zValues.map((z) => xValues.map((x) => Number(getTerrainHeight(x, z).toFixed(6))));
const cellBands = zValues.slice(0, -1).map((z0, zi) => xValues.slice(0, -1).map((x0, xi) => {
  const x1 = xValues[xi + 1];
  const z1 = zValues[zi + 1];
  return getReceptionEarthworkBand((x0 + x1) / 2, (z0 + z1) / 2);
}));

const payload = {
  version: 'V21',
  assetId: 'RECEPTION-EARTHWORK-V21',
  source: 'src/scene/environment/terrainHeight.js#getTerrainHeight',
  authoritative: false,
  visualOnly: true,
  worldUnitsPerMeter: WORLD_UNITS_PER_METER,
  sampleStepM: stepM,
  visualLiftM: 0.035,
  earthwork: RECEPTION_EARTHWORK,
  grid: {
    xValues,
    zValues,
    heights,
    cellBands,
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  xSamples: xValues.length,
  zSamples: zValues.length,
  cells: cellBands.flat().filter(Boolean).length,
  bounds: { xMin, xMax, zMin, zMax },
}));
