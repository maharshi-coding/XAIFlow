import type { JsonValue } from '../types/domain';

export interface DistributionBin {
  label: string;
  count: number;
}

export function previewDistribution(values: JsonValue[], numeric: boolean): DistributionBin[] {
  if (!numeric) {
    const counts = new Map<string, number>();
    values.forEach((value) => {
      const label = value === null ? '(missing)' : String(value);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts, ([label, count]) => ({ label, count })).sort(
      (a, b) => b.count - a.count,
    );
  }
  const observations = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  if (!observations.length) return [];
  const min = Math.min(...observations),
    max = Math.max(...observations);
  const format = (value: number) => Number(value.toPrecision(4)).toString();
  if (min === max) return [{ label: format(min), count: observations.length }];
  const count = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(observations.length))));
  const width = (max - min) / count;
  const bins = Array.from({ length: count }, (_, index) => ({
    label: `${format(min + width * index)}–${format(min + width * (index + 1))}`,
    count: 0,
  }));
  observations.forEach((value) => {
    bins[Math.min(count - 1, Math.floor((value - min) / width))].count += 1;
  });
  return bins;
}
