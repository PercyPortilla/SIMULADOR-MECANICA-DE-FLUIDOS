import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const v57Asset = path.join(
  root,
  'public',
  'models',
  'pulpa-v57',
  'PULPA_LAB_V57_FULL_SITE_FINAL.glb',
);
const expectedSha256 = 'F9E6597DC2A837734717E185E1D640B687D4C62E79323534A2CBE46F1D874B2C';
const packedDir = path.join(root, 'blender', 'web-assets', 'b63');
const packedPrefix = 'PULPA_LAB_V57_B63_FULL_SITE_FINAL.glb.gz.part';
const legacyRuntimeFiles = [
  path.join(root, 'public', 'models', 'pulpa-v56', 'PULPA_LAB_V56_FULL_SITE.glb'),
  path.join(root, 'public', 'models', 'pulpa-v56', 'PULPA_LAB_V56_FULL_SITE_PRE_FINAL.glb'),
];
const legacyProductionDirs = ['pulpa-v49', 'pulpa-v50', 'pulpa-v55', 'pulpa-v56'];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

let assetBuffer = existsSync(v57Asset) ? readFileSync(v57Asset) : null;
if (!assetBuffer || sha256(assetBuffer) !== expectedSha256) {
  const parts = readdirSync(packedDir)
    .filter((name) => name.startsWith(packedPrefix))
    .sort();
  if (!parts.length) {
    throw new Error('B63 production guard: packed V57/B63 asset parts are missing.');
  }
  const packed = Buffer.concat(parts.map((name) => readFileSync(path.join(packedDir, name))));
  assetBuffer = gunzipSync(packed);
  mkdirSync(path.dirname(v57Asset), { recursive: true });
  writeFileSync(v57Asset, assetBuffer);
  console.log(`B63 production guard: reconstructed V57/B63 from ${parts.length} packed parts`);
}

const digest = sha256(assetBuffer);
if (digest !== expectedSha256) {
  throw new Error(`B63 production guard: V57/B63 SHA-256 mismatch (${digest})`);
}

// Tests can restore the old uncompressed runtime GLB. Production/dev builds
// must never ship or reveal that runtime again. The historical compressed
// archive may remain in Git, but no browser code loads it.
legacyRuntimeFiles.forEach((filePath) => rmSync(filePath, { force: true }));

if (process.argv.includes('--prune-dist')) {
  const distModels = path.join(root, 'dist', 'models');
  legacyProductionDirs.forEach((dirName) => {
    rmSync(path.join(distModels, dirName), { recursive: true, force: true });
  });

  const distV57Asset = path.join(
    distModels,
    'pulpa-v57',
    'PULPA_LAB_V57_FULL_SITE_FINAL.glb',
  );
  if (!existsSync(distV57Asset)) {
    throw new Error(`B63 production guard: dist is missing authoritative V57/B63 asset: ${distV57Asset}`);
  }
  const distDigest = sha256(readFileSync(distV57Asset));
  if (distDigest !== expectedSha256) {
    throw new Error(`B63 production guard: dist V57/B63 SHA-256 mismatch (${distDigest})`);
  }
  console.log(`B63 production guard: pruned legacy dist model dirs (${legacyProductionDirs.join(', ')})`);
}

console.log(`B63 production guard: V57/B63 authoritative asset verified (${digest})`);
console.log('B63 production guard: uncompressed V56 runtime removed');
