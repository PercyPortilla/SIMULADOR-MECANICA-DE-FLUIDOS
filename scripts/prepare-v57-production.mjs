import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const v57Asset = path.join(
  root,
  'public',
  'models',
  'pulpa-v57',
  'PULPA_LAB_V57_FULL_SITE_FINAL.glb',
);
const expectedSha256 = 'CDD2ED1C36865E28F11702CC411EE507B37AD0BA94774FD028CFF7E15EE2FC16';
const legacyRuntimeFiles = [
  path.join(root, 'public', 'models', 'pulpa-v56', 'PULPA_LAB_V56_FULL_SITE.glb'),
  path.join(root, 'public', 'models', 'pulpa-v56', 'PULPA_LAB_V56_FULL_SITE_PRE_FINAL.glb'),
];

if (!existsSync(v57Asset)) {
  throw new Error(`B62 production guard: missing authoritative V57 asset: ${v57Asset}`);
}

const digest = createHash('sha256').update(readFileSync(v57Asset)).digest('hex').toUpperCase();
if (digest !== expectedSha256) {
  throw new Error(`B62 production guard: V57/B61 SHA-256 mismatch (${digest})`);
}

// Tests can restore the old uncompressed runtime GLB. Production/dev builds
// must never ship or reveal that runtime again. The historical compressed
// archive may remain in Git, but no browser code loads it.
legacyRuntimeFiles.forEach((filePath) => rmSync(filePath, { force: true }));

console.log(`B62 production guard: V57/B61 authoritative asset verified (${digest})`);
console.log('B62 production guard: uncompressed V56 runtime removed');
