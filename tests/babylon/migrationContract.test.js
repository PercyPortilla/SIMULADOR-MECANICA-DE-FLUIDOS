import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORLD_UNITS_PER_METER } from '../../src/scene/config/siteDesign.js';

const rootDir = resolve(import.meta.dirname, '../..');

function collectFiles(directory) {
  const absolute = resolve(rootDir, directory);
  const entries = readdirSync(absolute);
  return entries.flatMap((entry) => {
    const path = join(absolute, entry);
    return statSync(path).isDirectory()
      ? collectFiles(relative(rootDir, path))
      : [path];
  });
}

describe('V31 Babylon migration contract', () => {
  it('keeps one world unit equal to one metre', () => {
    expect(WORLD_UNITS_PER_METER).toBe(1);
  });

  it('ships Babylon as the only production 3D renderer after parity closure', () => {
    const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
    expect(pkg.dependencies?.['@babylonjs/core']).toBeTruthy();
    expect(pkg.dependencies?.['@babylonjs/loaders']).toBeTruthy();
    expect(pkg.dependencies?.three).toBeUndefined();
  });

  it('keeps the whole production source tree free of Three.js imports', () => {
    const files = collectFiles('src').filter((path) => path.endsWith('.js'));
    expect(files.length).toBeGreaterThan(0);
    files.forEach((path) => {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toMatch(/from\s+['"]three(?:\/|['"])/);
      expect(source).not.toContain('three/addons');
      expect(source).not.toContain('THREE.');
    });
  });
});
