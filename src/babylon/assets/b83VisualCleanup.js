import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';

const RETIRED_VARIANT_PATTERN = /(?:ROTATION_WITNESS|_TRANSPARENT_|TRANSPARENT_|_CUT(?:_|$)|CUTAWAY)/i;
const INTERNAL_FLUID_PATTERN = /(?:_FLUID(?:_|$)|PROCESS_FLUID$)/i;

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

export function classifyB83NodeName(name = '') {
  const value = String(name);
  if (RETIRED_VARIANT_PATTERN.test(value)) return 'retired-variant';
  if (INTERNAL_FLUID_PATTERN.test(value)) return 'inspection-interior';
  return null;
}

export function applyB83VisualCleanup({ scene, rootNodes = [], host } = {}) {
  if (!scene || !host) throw new TypeError('B83 visual cleanup requires scene and host.');
  const root = new TransformNode('B83_VISUAL_CLEANUP', scene);
  root.parent = host;
  root.metadata = {
    visualOnly: true,
    siteRevision: 'V57',
    visualBuild: 'B83',
    v57AuthoritativeVisual: true,
  };

  const snapshots = [];
  const retired = [];
  const interior = [];
  rootNodes.forEach((sourceRoot) => {
    visitHierarchy(sourceRoot, (node) => {
      if (!node || !('isVisible' in node)) return;
      const classification = classifyB83NodeName(node.name);
      if (!classification) return;
      snapshots.push({
        node,
        isVisible: node.isVisible,
        visibility: node.visibility,
        metadata: { ...(node.metadata ?? {}) },
      });
      node.isVisible = false;
      node.visibility = 0;
      if (classification === 'retired-variant') {
        node.metadata = {
          ...(node.metadata ?? {}),
          b83RetiredVisualVariant: true,
          inspectionExcluded: true,
          visualBuild: 'B83',
        };
        retired.push(node);
      } else {
        node.metadata = {
          ...(node.metadata ?? {}),
          b83InspectionInterior: true,
          inspectionInterior: true,
          inspectionRole: 'interior',
          visualBuild: 'B83',
        };
        interior.push(node);
      }
    });
  });

  root.metadata.retiredVariantCount = retired.length;
  root.metadata.hiddenInteriorCount = interior.length;
  host.metadata = {
    ...(host.metadata ?? {}),
    b83VisualCleanup: true,
    b83RetiredVariantCount: retired.length,
    b83HiddenInteriorCount: interior.length,
  };

  return {
    root,
    retired,
    interior,
    dispose() {
      snapshots.forEach((snapshot) => {
        const { node } = snapshot;
        if (!node || node.isDisposed?.()) return;
        node.isVisible = snapshot.isVisible;
        node.visibility = snapshot.visibility;
        node.metadata = { ...snapshot.metadata };
      });
      root.dispose(false, true);
      snapshots.length = 0;
      retired.length = 0;
      interior.length = 0;
    },
  };
}
