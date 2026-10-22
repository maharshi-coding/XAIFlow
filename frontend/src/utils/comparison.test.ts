import { describe, expect, it } from 'vitest';
import { comparisonDelta, comparisonValue, isRateMetric } from './comparison';

describe('experiment comparison metric units', () => {
  it('formats classification rates as percentages and changes as percentage points', () => {
    for (const metric of ['accuracy', 'precision', 'recall', 'f1', 'roc_auc']) {
      expect(isRateMetric(metric)).toBe(true);
      expect(comparisonValue(metric, 0.85)).toBe('85.0%');
      expect(comparisonDelta(metric, 0.05)).toBe('+5.00 pp');
      expect(comparisonDelta(metric, -0.01)).toBe('-1.00 pp');
    }
  });
  it('keeps sample counts and generic scalar metrics in their original units', () => {
    expect(isRateMetric('test_samples')).toBe(false);
    expect(comparisonValue('test_samples', 80)).toBe('80');
    expect(comparisonDelta('test_samples', 0)).toBe('+0');
    expect(comparisonDelta('test_samples', 20)).toBe('+20');
    expect(comparisonValue('loss', 0.12345)).toBe('0.1235');
    expect(comparisonDelta('loss', -0.025)).toBe('-0.025');
  });
});
