import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const v21Path = path.join(root, 'public', 'models', 'pulpa-blender', 'RECEPTION-EARTHWORK-V21.glb');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function resolveBlender() {
  const candidates = [
    process.env.BLENDER_EXE,
    process.platform === 'win32' ? 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe' : null,
    process.platform === 'darwin' ? '/Applications/Blender.app/Contents/MacOS/Blender' : null,
    process.platform === 'linux' ? '/usr/bin/blender' : null,
  ].filter(Boolean);
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) throw new Error('Blender no encontrado. Define BLENDER_EXE con la ruta del ejecutable de Blender 5.x.');
  return match;
}

function run(executable, args) {
  process.stdout.write(`\n> ${path.basename(executable)} ${args.join(' ')}\n`);
  execFileSync(executable, args, { cwd: root, stdio: 'inherit', env: process.env });
}

if (!fs.existsSync(v21Path)) throw new Error(`Baseline V21 no encontrado: ${v21Path}`);
const v21Before = sha256(v21Path);
const blender = resolveBlender();

run(process.execPath, ['tools/exportV26TerrainContract.mjs']);
run(blender, ['--background', '--python', 'blender/scripts/blender_v26_reception_earthwork.py']);
run(process.execPath, ['tools/validateV26ReceptionAsset.mjs']);

const v21After = sha256(v21Path);
if (v21After !== v21Before) {
  throw new Error(`Protección V21 falló: hash cambió de ${v21Before} a ${v21After}`);
}

console.log(JSON.stringify({
  ok: true,
  pipeline: 'RECEPTION-EARTHWORK-V26',
  blender,
  v21Protected: true,
  v21Sha256: v21After,
}, null, 2));
