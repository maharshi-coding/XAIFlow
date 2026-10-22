import { useState } from 'react';
import type { Dataset } from '../types/domain';
import { previewDistribution } from '../utils/distribution';
import { Card, Empty } from './ui';
import { DistributionChart } from './charts';

export function FeatureDistribution({ dataset }: { dataset: Dataset }) {
  const [selected, setSelected] = useState('');
  const feature =
    dataset.columns.find((column) => column.name === selected) ??
    dataset.columns.find((column) => column.name !== dataset.target_column) ??
    dataset.columns[0];
  const numeric = feature && /int|float|numeric|double|decimal/i.test(feature.dtype);
  const values = (dataset.preview ?? []).map((row) => row[feature?.name] ?? null);
  const bins = previewDistribution(values, !!numeric);
  return (
    <Card
      title="Feature distribution"
      subtitle="Explore values in the dataset preview"
      action={
        feature && (
          <select
            className="feature-select"
            aria-label="Visualized feature"
            value={feature.name}
            onChange={(event) => setSelected(event.target.value)}
          >
            {dataset.columns.map((column) => (
              <option key={column.name} value={column.name}>
                {column.name}
              </option>
            ))}
          </select>
        )
      }
    >
      {bins.length ? (
        <DistributionChart data={bins} label={`Preview distribution of ${feature.name}`} />
      ) : (
        <Empty
          title="No observed feature values"
          description="Choose a column with non-missing values in the preview sample."
        />
      )}
      <p className="chart-footnote">
        Preview sample: first {values.length} of {dataset.row_count.toLocaleString()} rows.{' '}
        {numeric
          ? 'Numeric bins exclude missing values.'
          : 'Category counts include missing values.'}{' '}
        This chart describes the preview sample; column statistics above describe the full dataset.
      </p>
    </Card>
  );
}
