import { describe, expect, it } from 'vitest';
import { renderBalanceAndEnergy } from '../../src/ui/balancePanel.js';

describe('rendering of user-controlled hydraulic segment labels', () => {
  it('shows hostile segment names and labels as text, not executable markup', () => {
    const root = { innerHTML: '' };
    renderBalanceAndEnergy(root, {
      state: {},
      results: {
        transport: {
          distributedPressureDropPa: 60000,
          minorLossPressurePa: 10000,
          staticPressurePa: -5000,
          pressureDropPa: 65000,
          resultQuality: 'validated-laminar',
          settling: {
            status: '<iframe src=x>',
            limitingSegmentId: '<img src=x onerror=alert(1)>',
            note: '<svg onload=alert(1)>',
          },
          segments: [
            {
              id: '<img src=x onerror=alert(1)>',
              distributedPressureDropPa: 60000,
              minorLossPressurePa: 10000,
              staticPressurePa: -5000,
              pressureDropPa: 65000,
              accessoryBreakdown: [
                { type: '<script>attack()</script>', count: 2, k: 1.4, subtotal: 2.8 },
              ],
            },
          ],
        },
        pump: { modelStatus: '<script>attack()</script>' },
      },
    });

    expect(root.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(root.innerHTML).toContain('&lt;script&gt;attack()&lt;/script&gt;');
    expect(root.innerHTML).not.toContain('<img src=x');
    expect(root.innerHTML).not.toContain('<script>');
    expect(root.innerHTML).not.toContain('<svg onload');
    expect(root.innerHTML).not.toContain('<iframe src');
    expect(root.innerHTML).toContain('65.00');
  });
});
