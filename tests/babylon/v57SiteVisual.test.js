import { describe, expect, it, vi } from 'vitest';
import { CreateBox, NullEngine, Scene, TransformNode } from '@babylonjs/core';
import { attachBabylonV57SiteVisual } from '../../src/babylon/assets/v57SiteVisual.js';
import { V57_INSPECTION_NODE_ALIASES, V57_SITE_VISUAL_URL } from '../../src/scene/integration/v57Layout.js';

describe('Babylon V57 authoritative site visual', () => {
  it('loads the V57 full site, owns animations and marks imported nodes', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const root = new TransformNode('MILL-01_ROOT', scene);
    const mesh = CreateBox('MILL-01_SHELL_BODY', { size: 1 }, scene);
    mesh.parent = root;
    const animation = {
      isStarted: false,
      from: 1,
      to: 720,
      start: vi.fn(function start() { this.isStarted = true; }),
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
    };
    const container = {
      rootNodes: [root],
      animationGroups: [animation],
      addAllToScene: vi.fn(),
      dispose: vi.fn(),
    };
    const visual = attachBabylonV57SiteVisual({
      scene,
      loadContainer: vi.fn(async () => container),
    });
    await visual.ready;

    expect(visual.loaded).toBe(true);
    expect(visual.host.metadata.blenderVisualUrl).toBe(V57_SITE_VISUAL_URL);
    expect(visual.host.metadata.siteRevision).toBe('V57');
    expect(root.parent).toBe(visual.host);
    expect(root.metadata.v57AuthoritativeVisual).toBe(true);
    expect(mesh.metadata.v57AuthoritativeVisual).toBe(true);
    expect(visual.host.metadata.b71HydraulicStudy).toBeTruthy();
    expect(visual.setInspectionState({ targetId: 'MILL-01', mode: 'transparent' })).toEqual({
      targetId: 'MILL-01',
      mode: 'transparent',
    });
    expect(visual.inspectionState).toEqual({ targetId: 'MILL-01', mode: 'transparent' });
    expect(animation.start).toHaveBeenCalled();
    visual.setAnimationsEnabled(false);
    expect(animation.pause).toHaveBeenCalled();
    visual.dispose();
    expect(animation.stop).toHaveBeenCalled();
    engine.dispose();
  });

  it('maps inspection IDs to the authored V57 equipment hierarchy', () => {
    expect(V57_INSPECTION_NODE_ALIASES['ROM-HOPPER'].names).toContain('ROM-HOPPER_ROOT');
    expect(V57_INSPECTION_NODE_ALIASES['P-MILL-TO-SUMP'].names).toContain('V57_MILL_TO_SUMP_TRANSFER');
    expect(V57_INSPECTION_NODE_ALIASES['P-PUMP-TO-CYCLONES'].names).toContain('PIPE-1_ROOT');
    expect(V57_INSPECTION_NODE_ALIASES['MT-CIP-TO-ELUTION-CARBON'].names).toContain('V57_CIP01_TO_ELUTION_CARBON_ROOT');
    expect(V57_INSPECTION_NODE_ALIASES['MT-ELUTION-TO-CIP-BARREN-CARBON'].names).toContain('V57_REGEN_TO_CIP06_ROOT');
  });
});
