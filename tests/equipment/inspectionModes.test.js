import { describe, expect, it } from 'vitest';
import { createLeachReactorAsset } from '../../src/equipment/leaching/leachReactor.js';

function shells(root) {
  const result = [];
  root.traverse((object) => {
    if (object.isMesh && object.userData.inspectionRole === 'shell') result.push(object);
  });
  return result;
}

describe('Equipment inspection modes', () => {
  it('supports normal, transparent, cutaway and interior', () => {
    const reactor = createLeachReactorAsset();
    reactor.setInspectionMode('transparent');
    expect(shells(reactor.root).some((mesh) => mesh.material.transparent && mesh.material.opacity <= 0.26)).toBe(true);
    reactor.setInspectionMode('cutaway');
    expect(shells(reactor.root).some((mesh) => Array.isArray(mesh.material.clippingPlanes) && mesh.material.clippingPlanes.length === 1)).toBe(true);
    reactor.setInspectionMode('interior');
    expect(shells(reactor.root).every((mesh) => mesh.visible === false)).toBe(true);
    reactor.setInspectionMode('normal');
    expect(shells(reactor.root).every((mesh) => mesh.visible === true)).toBe(true);
    reactor.dispose();
  });
});
