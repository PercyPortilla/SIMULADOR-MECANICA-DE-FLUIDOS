import { describe, expect, it, vi } from 'vitest';
import { CreateBox, NullEngine, Scene, TransformNode } from '@babylonjs/core';
import { attachBabylonV50SiteVisual } from '../../src/babylon/assets/v50SiteVisual.js';
import { V50_INSPECTION_NODE_ALIASES, V50_SITE_VISUAL_URL } from '../../src/scene/integration/v50Layout.js';

describe('Babylon V50 authoritative site visual', () => {
  it('loads the final Blender full-site as a visual-only V50 hierarchy and owns its animations', async () => {
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
    const visual = attachBabylonV50SiteVisual({
      scene,
      loadContainer: vi.fn(async () => container),
    });
    await visual.ready;

    expect(visual.loaded).toBe(true);
    expect(visual.host.metadata.blenderVisualUrl).toBe(V50_SITE_VISUAL_URL);
    expect(root.parent).toBe(visual.host);
    expect(root.metadata.v50AuthoritativeVisual).toBe(true);
    expect(mesh.metadata.v50AuthoritativeVisual).toBe(true);
    expect(animation.start).toHaveBeenCalled();
    visual.setAnimationsEnabled(false);
    expect(animation.pause).toHaveBeenCalled();
    visual.dispose();
    expect(animation.stop).toHaveBeenCalled();
    expect(container.dispose).toHaveBeenCalled();
    engine.dispose();
  });

  it('defines V49 aliases for every non-equipment circuit route', () => {
    expect(V50_INSPECTION_NODE_ALIASES['ROM-TO-FEEDER-CHUTE'].names).toContain('V49_ROM_TO_APRON_CHUTE');
    expect(V50_INSPECTION_NODE_ALIASES['CV-02-CRUSHER-TO-STOCKPILE'].prefixes).toContain('V49_CV02_');
    expect(V50_INSPECTION_NODE_ALIASES['P-MILL-TO-SUMP'].names).toContain('V49_PIPE_MILL_TO_SUMP');
    expect(V50_INSPECTION_NODE_ALIASES['MT-EW-TO-SMELTING-CATHODE'].names).toContain('V39_EW_SMELT_CART');
    expect(V50_INSPECTION_NODE_ALIASES['P-CYCLONE-UNDERFLOW-RETURN'].semanticOnly).toBe(true);
  });
});
