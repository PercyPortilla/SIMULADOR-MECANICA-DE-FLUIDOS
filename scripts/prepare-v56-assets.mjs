import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const assets = [
  {
    label: 'V56 runtime GLB',
    compressed: path.join(root, 'public', 'models', 'pulpa-v56', 'PULPA_LAB_V56_FULL_SITE.glb.gz'),
    output: path.join(root, 'public', 'models', 'pulpa-v56', 'PULPA_LAB_V56_FULL_SITE.glb'),
    sha256: '17F2B8C5346DBEAC1BB8DDE7DAA61FEAE06DE8C2212D2F47486CFC582C3F1D53',
    required: true,
  },
  {
    label: 'V56 Blender master',
    compressed: path.join(root, 'blender', 'PULPA_LAB_BLENDER_MASTER_V56.blend.gz'),
    output: path.join(root, 'blender', 'PULPA_LAB_BLENDER_MASTER_V56.blend'),
    sha256: 'E81B6C7123F9C2BBADF11C4E0AD5B30AA288DF4933FC630CF9C2AB00AB8ECFD8',
    required: process.argv.includes('--restore-blend'),
  },
];

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function restore(asset) {
  if (!asset.required) return;
  if (!existsSync(asset.compressed)) {
    throw new Error(`${asset.label}: missing compressed source ${asset.compressed}`);
  }

  if (existsSync(asset.output)) {
    const current = readFileSync(asset.output);
    if (hash(current) === asset.sha256) {
      console.log(`${asset.label}: ready (${current.length} bytes)`);
      return;
    }
  }

  const restored = gunzipSync(readFileSync(asset.compressed));
  const digest = hash(restored);
  if (digest !== asset.sha256) {
    throw new Error(`${asset.label}: SHA-256 mismatch after decompression (${digest})`);
  }
  mkdirSync(path.dirname(asset.output), { recursive: true });
  writeFileSync(asset.output, restored);
  console.log(`${asset.label}: restored (${restored.length} bytes)`);
}

assets.forEach(restore);
