import { spawnSync } from 'node:child_process';

const areas = {
  equipment: ['tests/babylon/equipmentVisual.test.js', 'tests/babylon/equipmentContractsParity.test.js'],
  roads: ['tests/babylon/primaryHaulRoad.test.js', 'tests/babylon/roadVisualDetails.test.js', 'tests/babylon/serviceRoads.test.js', 'tests/babylon/receptionEarthwork.test.js'],
  terrain: ['tests/babylon/mineTerrain.test.js', 'tests/babylon/minePropsOperationalSurface.test.js'],
  inspection: ['tests/babylon/equipmentInspection.test.js', 'tests/babylon/labelContracts.test.js', 'tests/babylon/cameraPresets.test.js'],
  piping: ['tests/babylon/pipingSystem.test.js', 'tests/babylon/pipeRacks.test.js', 'tests/babylon/industrialInfrastructure.test.js'],
  migration: ['tests/babylon/migrationContract.test.js'],
};

const area = process.argv.slice(2).find((arg) => !arg.startsWith('-')) ?? 'equipment';
const files = areas[area];
if (!files) {
  console.error(`Unknown audit area: ${area}`);
  console.error(`Choose one of: ${Object.keys(areas).join(', ')}`);
  process.exit(2);
}

const started = Date.now();
const result = spawnSync('npx', ['vitest', 'run', ...files, '--maxWorkers=1', '--testTimeout=15000'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`AUDIT area=${area} files=${files.length} duration_s=${seconds} exit=${result.status ?? 1}`);
process.exit(result.status ?? 1);
