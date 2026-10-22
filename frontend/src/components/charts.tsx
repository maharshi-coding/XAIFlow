import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { FeatureContribution, Metrics } from '../types/domain';
import { Card } from './ui';
import { percent } from '../utils/format';
import type { DistributionBin } from '../utils/distribution';

export function DistributionChart({ data, label }: { data: DistributionBin[]; label: string }) {
  return (
    <div className="chart" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 10, right: 24, top: 12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ borderRadius: 10, borderColor: 'var(--border)', fontSize: 13 }}
          />
          <Bar
            isAnimationActive={false}
            dataKey="count"
            name="Observed rows"
            fill="var(--chart-primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={70}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClassDistributions({ metrics }: { metrics: Metrics }) {
  const actual = metrics.class_distribution,
    predicted = metrics.prediction_distribution;
  if (!actual && !predicted) return null;
  const labels = Array.from(
    new Set([...Object.keys(actual ?? {}), ...Object.keys(predicted ?? {})]),
  );
  const data = labels.map((label) => ({
    label,
    actual: actual?.[label] ?? 0,
    predicted: predicted?.[label] ?? 0,
  }));
  return (
    <Card
      title="Held-out class and prediction distribution"
      subtitle="Observed test labels compared with model predictions"
    >
      <div className="chart-legend">
        {actual && (
          <span>
            <i style={{ background: 'var(--chart-secondary)' }} />
            Actual classes
          </span>
        )}
        {predicted && (
          <span>
            <i className="positive" />
            Predicted classes
          </span>
        )}
      </div>
      <div className="chart" role="img" aria-label="Held-out class and prediction counts">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 10, right: 24, top: 12 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: 10, borderColor: 'var(--border)', fontSize: 13 }}
            />
            {actual && (
              <Bar
                isAnimationActive={false}
                dataKey="actual"
                name="Actual classes"
                fill="var(--chart-secondary)"
                radius={[3, 3, 0, 0]}
                maxBarSize={55}
              />
            )}
            {predicted && (
              <Bar
                isAnimationActive={false}
                dataKey="predicted"
                name="Predicted classes"
                fill="var(--chart-primary)"
                radius={[3, 3, 0, 0]}
                maxBarSize={55}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Class</th>
              {actual && <th>Actual labels</th>}
              {predicted && <th>Predictions</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                {actual && <td className="mono">{item.actual}</td>}
                {predicted && <td className="mono">{item.predicted}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function MetricsGrid({ metrics }: { metrics: Metrics }) {
  return (
    <div className="evaluation-metrics">
      {(['accuracy', 'precision', 'recall', 'f1', 'roc_auc'] as const).map((key) => (
        <div key={key}>
          <span>{key.replace('_', ' ').toUpperCase()}</span>
          <strong>{percent(metrics[key])}</strong>
        </div>
      ))}
    </div>
  );
}
export function ContributionChart({
  data,
  signed = true,
}: {
  data: FeatureContribution[];
  signed?: boolean;
}) {
  const chart = data
    .map((item) => ({ ...item, contribution: item.contribution ?? item.importance ?? 0 }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 12)
    .reverse();
  if (!chart.length)
    return <p className="muted pad">No feature contributions available for this explanation.</p>;
  return (
    <div style={{ height: Math.max(200, chart.length * 33) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart} layout="vertical" margin={{ left: 4, right: 25, top: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--chart-grid)" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="feature" width={130} tick={{ fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: 'var(--surface-subtle)' }}
            formatter={(value: number) => value.toFixed(4)}
          />
          <Bar dataKey="contribution" radius={[0, 3, 3, 0]}>
            {chart.map((item) => (
              <Cell
                key={item.feature}
                fill={
                  signed && item.contribution < 0 ? 'var(--chart-negative)' : 'var(--chart-primary)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ConfusionMatrix({ metrics }: { metrics: Metrics }) {
  const matrix = metrics.confusion_matrix;
  if (!matrix?.length) return null;
  const max = Math.max(1, ...matrix.flat());
  return (
    <Card title="Confusion matrix" subtitle="Actual class by predicted class">
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th>Actual / predicted</th>
              {matrix.map((_, index) => (
                <th key={index}>{String(metrics.classes?.[index] ?? index)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <th>{String(metrics.classes?.[i] ?? i)}</th>
                {row.map((value, j) => (
                  <td
                    key={j}
                    style={{
                      background: `rgba(8,127,117,${0.06 + (0.65 * value) / max})`,
                      color: 'var(--text)',
                    }}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
export function Timeseries({
  data,
  dataKey,
  label,
  color = 'var(--chart-primary)',
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="chart" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 15, top: 10, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={20} />
          <YAxis tick={{ fontSize: 12 }} width={40} />
          <Tooltip
            contentStyle={{ borderRadius: 10, borderColor: 'var(--border)', fontSize: 13 }}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke={color}
            strokeWidth={2.5}
            dot={data.length < 12}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RocCurve({ curve }: { curve: NonNullable<Metrics['roc_curve']> }) {
  const points = curve.fpr.map((fpr, index) => ({ fpr, tpr: curve.tpr[index] }));
  return (
    <Card title="ROC curve" subtitle="True positive rate against false positive rate">
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ left: 5, right: 25, top: 10, bottom: 15 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="fpr"
              domain={[0, 1]}
              tick={{ fontSize: 12 }}
              label={{
                value: 'False positive rate',
                position: 'insideBottom',
                offset: -10,
                fontSize: 12,
              }}
            />
            <YAxis type="number" domain={[0, 1]} tick={{ fontSize: 12 }} width={45} />
            <Tooltip formatter={(value: number) => value.toFixed(4)} />
            <Line
              isAnimationActive={false}
              type="stepAfter"
              dataKey="tpr"
              name="True positive rate"
              stroke="var(--chart-primary)"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
