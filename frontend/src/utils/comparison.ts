import { percent } from './format';

export function isRateMetric(metric: string) {
  return ['accuracy', 'precision', 'recall', 'f1', 'roc_auc'].includes(metric);
}
export function comparisonValue(metric: string, value: number) {
  return isRateMetric(metric)
    ? percent(value)
    : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
export function comparisonDelta(metric: string, delta: number) {
  const sign = delta >= 0 ? '+' : '';
  return isRateMetric(metric)
    ? `${sign}${(delta * 100).toFixed(2)} pp`
    : `${sign}${delta.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}
