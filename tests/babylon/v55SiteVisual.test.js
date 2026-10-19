import { describe, expect, it, vi } from 'vitest';
import { CreateBox, NullEngine, Scene, TransformNode } from '@babylonjs/core';
import { attachBabylonV55SiteVisual } from '../../src/babylon/assets/v55SiteVisual.js';
import { V55_INSPECTION_NODE_ALIASES, V55_SITE_VISUAL_URL } from '../../src/scene/integration/v55Layout.js';

describe('Babylon V55 authoritative site visual', () => {
  it('loads the V55 full site, owns its animations and marks imported nodes', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const root = new TransformNode('ROM-HOPPER', scene);
    const mesh = CreateBox('ROM-HOPPER_BODY', { size: 1 }, scene);
    mesh.parent = root;
    const animation = {
      isStarted: false,
      from: 1,
      to: 2900,
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
    const visual = attachBabylonV55SiteVisual({
      scene,
      loadContainer: vi.fn(async () => container),
    });
    await visual.ready;

    expect(visual.loaded).toBe(true);
    expect(visual.host.metadata.blenderVisualUrl).toBe(V55_SITE_VISUAL_URL);
    expect(visual.host.metadata.siteRevision).toBe('V55');
    expect(root.parent).toBe(visual.host);
    expect(root.metadata.v55AuthoritativeVisual).toBe(true);
    expect(mesh.metadata.v55AuthoritativeVisual).toBe(true);
    expect(animation.start).toHaveBeenCalled();
    visual.setAnimationsEnabled(false);
    expect(animation.pause).toHaveBeenCalled();
    visual.dispose();
    expect(animation.stop).toHaveBeenCalled();
    expect(container.dispose).toHaveBeenCalled();
    engine.dispose();
  });

  it('maps inspection routes to the corrected V51/V52 V55 geometry', () => {
    expect(V55_INSPECTION_NODE_ALIASES['ROM-TO-FEEDER-CHUTE'].names).toContain('V51_ROM_TO_APRON_CHUTE_BOTTOM');
    expect(V55_INSPECTION_NODE_ALIASES['P-MILL-TO-SUMP'].names).toContain('V52_PIPE_MILL_TO_SUMP');
    expect(V55_INSPECTION_NODE_ALIASES['P-CYCLONE-UNDERFLOW-RETURN'].names).toContain('V52_PIPE_CLASS_UNDERFLOW_TO_MILL');
    expect(V55_INSPECTION_NODE_ALIASES['P-PUMP-01-TO-CIP'].names).toContain('V52_PIPE_PUMP_TO_CIP');
    expect(V55_INSPECTION_NODE_ALIASES['P-ELUTION-TO-EW'].names).toContain('V52_PIPE_ELUTION_TO_EW');
    expect(V55_INSPECTION_NODE_ALIASES['MT-EW-TO-SMELTING-CATHODE'].names).toContain('V39_EW_SMELT_CART');
    expect(V55_INSPECTION_NODE_ALIASES['MT-ELUTION-TO-CIP-BARREN-CARBON'].semanticOnly).toBe(true);
  });
});
