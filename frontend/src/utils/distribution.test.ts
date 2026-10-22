import { describe, expect, it } from 'vitest';
import { previewDistribution } from './distribution';

describe('preview feature distributions', () => {
  it('counts finite numeric observations exactly once, including the maximum endpoint', () => {
    const bins = previewDistribution([-4, -2, 0, 2, 4, null, 'invalid'], true);
    expect(bins.reduce((count, bin) => count + bin.count, 0)).toBe(5);
    expect(bins.at(-1)?.count).toBeGreaterThan(0);
    expect(bins.some((bin) => bin.label.includes('-4'))).toBe(true);
  });
  it('handles a constant numeric feature without manufacturing a wider distribution', () => {
    expect(previewDistribution([3, 3, null, 3], true)).toEqual([{ label: '3', count: 3 }]);
    expect(previewDistribution([null, 'not numeric'], true)).toEqual([]);
  });
  it('preserves observed category counts and makes missing values explicit', () => {
    expect(previewDistribution(['annual', 'monthly', 'annual', null], false)).toEqual([
      { label: 'annual', count: 2 },
      { label: 'monthly', count: 1 },
      { label: '(missing)', count: 1 },
    ]);
  });
});
