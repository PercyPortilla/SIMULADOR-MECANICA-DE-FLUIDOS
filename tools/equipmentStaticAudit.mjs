import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const equipmentRoot = path.join(root, 'src', 'equipment');
const requiredAssetFiles = [
  'mining/haulTruck.js',
  'mining/miningShovel.js',
  'mining/wheelLoader.js',
  'crushing/romHopper.js',
  'crushing/apronFeeder.js',
  'crushing/jawCrusher.js',
  'conveying/conveyor.js',
  'grinding/ballMill.js',
  'classification/slurryPump.js',
  'classification/cycloneCluster.js',
  'leaching/leachReactor.js',
  'recovery/cip.js',
  'recovery/elution.js',
  'recovery/electrowinning.js',
  'recovery/smeltingFurnace.js',
];
const forbiddenTokens = ['terrainHeight', 'baseEnvironment', 'haulRoad', 'cameraPresets', 'simulationState', 'processRoute'];
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
}
walk(equipmentRoot);
const checks = [];
const push = (id, ok, details) => checks.push({ id, ok, details });
for (const rel of requiredAssetFiles) {
  const full = path.join(equipmentRoot, rel);
  push(`asset:${rel}`, fs.existsSync(full), fs.existsSync(full) ? 'present' : 'missing');
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, 'utf8');
  push(`contract:${rel}`, text.includes('createAssetHandle'), 'uses common isolated asset contract');
  for (const token of forbiddenTokens) push(`isolated:${rel}:${token}`, !text.includes(token), token);
}
const equipmentText = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
push('single-loop-assets', !equipmentText.includes('requestAnimationFrame'), 'assets expose update(dt) and contain no requestAnimationFrame');
const mill = fs.readFileSync(path.join(equipmentRoot, 'grinding/ballMill.js'), 'utf8');
push('mill-static-group', mill.includes("staticGroup.name = 'mill-static-group'"), 'staticGroup present');
push('mill-rotating-group', mill.includes("rotatingGroup.name = 'mill-rotating-group'"), 'rotatingGroup present');
push('mill-local-axis', mill.includes('rotatingGroup.rotation.x -= dt'), 'rotation applied to rotatingGroup local X');
push('mill-no-root-rotation', !/root\.rotation\.[xyz]\s*[+\-]?=/.test(mill), 'mill root is not animated');
const lab = fs.readFileSync(path.join(root, 'src', 'equipmentLab.js'), 'utf8');
push('lab-one-loop', (lab.match(/requestAnimationFrame\(/g) || []).length === 1, 'Equipment Lab has exactly one animation loop');
push('lab-4k', lab.includes('3840, 2160'), '4K QA capture implemented');
push('lab-clipping', lab.includes('localClippingEnabled = true'), 'cutaway clipping enabled');
const catalog = fs.readFileSync(path.join(equipmentRoot, 'catalog/equipmentCatalog.js'), 'utf8');
push('catalog-15', (catalog.match(/category:/g) || []).length === 15, '15 catalog entries');
const summary = {
  generatedAt: new Date().toISOString(),
  equipmentJsFiles: files.length,
  requiredAssets: requiredAssetFiles.length,
  checks: checks.length,
  passed: checks.filter((c) => c.ok).length,
  failed: checks.filter((c) => !c.ok),
  sha256: crypto.createHash('sha256').update(equipmentText).digest('hex'),
};
console.log(JSON.stringify(summary, null, 2));
if (summary.failed.length) process.exit(1);
