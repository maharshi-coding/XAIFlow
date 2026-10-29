import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CheckCircle2,
  FlaskConical,
  Gauge,
  GitCompareArrows,
  Layers3,
  Search,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, scoped } from '../services/api';
import { useWorkspace } from '../hooks/useWorkspace';
import type { Run } from '../types/domain';
import {
  Badge,
  Button,
  Card,
  Code,
  Empty,
  ErrorState,
  Field,
  Loading,
  Metric,
  Modal,
  PageHeader,
} from '../components/ui';
import { CountUp } from '../components/motion/CountUp';
import { date, duration, percent, shortId, title } from '../utils/format';
import { comparisonDelta, comparisonValue, isRateMetric } from '../utils/comparison';

interface Comparison {
  runs: Run[];
  metric_names: string[];
  primary_metric: string;
  baseline_run_id: string;
  deltas: { run_id: string; metrics: Record<string, number> }[];
}

function CompareRuns({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const [primary, setPrimary] = useState('f1');
  const query = useQuery({
    queryKey: ['comparison', ids, primary],
    queryFn: () => api<Comparison>(`/runs/compare?ids=${ids.join(',')}&primary_metric=${primary}`),
  });
  return (
    <Modal title="Compare experiments" onClose={onClose} wide>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        query.data && (
          <>
            <Field label="Primary metric">
              <select value={primary} onChange={(event) => setPrimary(event.target.value)}>
                {['accuracy', 'precision', 'recall', 'f1', 'roc_auc'].map((metric) => (
                  <option key={metric} value={metric}>
                    {title(metric)}
                  </option>
                ))}
              </select>
            </Field>
            <p className="muted comparison-note">
              Changes are relative to the first selected run. Higher classification metrics indicate
              an improvement for that metric.
            </p>
            <div className="table-scroll">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Metric / configuration</th>
                    {query.data.runs.map((run) => (
                      <th key={run.id}>
                        <Link to={`/experiments/${run.id}`}>{shortId(run.id)}</Link>
                        <small className="cell-sub">
                          {title(run.model_type ?? 'Unknown model')}
                        </small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.data.metric_names.map((metric) => (
                    <tr key={metric} className={metric === primary ? 'primary-metric-row' : ''}>
                      <td>
                        <strong>{title(metric)}</strong>
                        {metric === primary && (
                          <small className="cell-sub teal">Primary metric</small>
                        )}
                      </td>
                      {query.data!.runs.map((run, index) => {
                        const value = run.metrics[metric];
                        const delta = query.data!.deltas.find((item) => item.run_id === run.id)
                          ?.metrics[metric];
                        return (
                          <td key={run.id} className="mono">
                            {typeof value === 'number' ? comparisonValue(metric, value) : '—'}
                            {index > 0 && delta !== undefined && (
                              <small
                                className={`cell-sub ${isRateMetric(metric) ? (delta >= 0 ? 'teal' : 'red') : 'muted'}`}
                              >
                                {comparisonDelta(metric, delta)}
                              </small>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td>Run duration</td>
                    {query.data.runs.map((run) => (
                      <td className="mono" key={run.id}>
                        {duration(run.duration)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Training duration</td>
                    {query.data.runs.map((run) => (
                      <td className="mono" key={run.id}>
                        {duration(
                          run.node_runs?.find((node) => node.node_type === run.model_type)
                            ?.duration,
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Dataset</td>
                    {query.data.runs.map((run) => (
                      <td className="mono" key={run.id}>
                        {shortId(run.dataset_id)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>XAI methods</td>
                    {query.data.runs.map((run) => (
                      <td key={run.id}>
                        {run.explanations
                          ?.map((item) => (item.explainer ?? item.method).toUpperCase())
                          .join(', ') || 'None'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Artifacts</td>
                    {query.data.runs.map((run) => (
                      <td key={run.id}>
                        {run.artifacts?.map((item) => item.kind ?? item.type).join(', ') || 'None'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Model parameters</td>
                    {query.data.runs.map((run) => (
                      <td key={run.id}>
                        <Code value={run.parameters} />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Preprocessing</td>
                    {query.data.runs.map((run) => (
                      <td key={run.id}>
                        <Code value={run.preprocessing} />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </Modal>
  );
}

export default function Experiments() {
  const { projectId } = useWorkspace();
  const [selected, setSelected] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  const [status, setStatus] = useState('all');
  const [searchParams] = useSearchParams();
  const [algorithm, setAlgorithm] = useState(searchParams.get('model') ?? 'all');
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['runs', projectId],
    queryFn: () => api<Run[]>(scoped('/runs', projectId)),
    refetchInterval: 5000,
  });
  const allRuns = query.data ?? [];
  const runs = allRuns.filter(
    (run) =>
      (status === 'all' || run.status === status) &&
      (algorithm === 'all' || run.model_type === algorithm) &&
      `${run.pipeline_name} ${run.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  const completedRuns = allRuns.filter((run) => run.status === 'completed');
  const bestAccuracy = completedRuns.reduce(
    (best, run) => Math.max(best, run.metrics?.accuracy ?? 0),
    0,
  );
  const algorithmCount = new Set(allRuns.map((run) => run.model_type).filter(Boolean)).size;
  return (
    <>
      <PageHeader
        eyebrow="TRACK & COMPARE"
        title="Experiments"
        description="Every execution is a reproducible snapshot of your data, configuration, and results."
        actions={
          <Button
            variant="secondary"
            disabled={selected.length < 2}
            onClick={() => setCompare(true)}
          >
            <GitCompareArrows size={16} />
            Compare {selected.length ? `(${selected.length})` : 'runs'}
          </Button>
        }
      />
      {allRuns.length > 0 && (
        <div className="metrics-grid">
          <Metric
            label="Total experiments"
            value={<CountUp value={allRuns.length} />}
            detail="Tracked pipeline executions"
            icon={<FlaskConical size={19} />}
          />
          <Metric
            label="Completed"
            value={<CountUp value={completedRuns.length} />}
            detail={`${allRuns.length - completedRuns.length} not completed`}
            icon={<CheckCircle2 size={19} />}
            trend={
              allRuns.length
                ? {
                    label: `${Math.round((completedRuns.length / allRuns.length) * 100)}% success`,
                    tone: completedRuns.length === allRuns.length ? 'up' : 'flat',
                  }
                : undefined
            }
          />
          <Metric
            label="Best accuracy"
            value={<CountUp value={bestAccuracy * 100} decimals={1} suffix="%" />}
            detail="Across completed runs"
            icon={<Gauge size={19} />}
          />
          <Metric
            label="Algorithms"
            value={<CountUp value={algorithmCount} />}
            detail="Distinct model families tried"
            icon={<Layers3 size={19} />}
          />
        </div>
      )}
      <Card>
        <div className="filters">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search experiments"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search experiments…"
            />
          </div>
          <select
            aria-label="Filter experiment status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {['queued', 'running', 'completed', 'failed'].map((item) => (
              <option value={item} key={item}>
                {title(item)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter algorithm"
            value={algorithm}
            onChange={(event) => setAlgorithm(event.target.value)}
          >
            <option value="all">All algorithms</option>
            {Array.from(new Set(query.data?.map((run) => run.model_type).filter(Boolean))).map(
              (item) => (
                <option value={item} key={item}>
                  {title(item!)}
                </option>
              ),
            )}
          </select>
          <span className="muted">{runs.length} runs</span>
        </div>
        {query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <ErrorState
            error={query.error}
            retry={() => {
              void query.refetch();
            }}
          />
        ) : !runs.length ? (
          <Empty
            title={query.data?.length ? 'No matching experiments' : 'No experiments yet'}
            description={
              query.data?.length
                ? 'Adjust the filters to find another run.'
                : 'Execute a pipeline to start tracking metrics, explanations, and model artifacts.'
            }
            action={
              <Link to="/pipelines" className="button button-secondary">
                Open pipeline studio
              </Link>
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="checkbox-col">Select</th>
                  <th>Experiment</th>
                  <th>Algorithm</th>
                  <th>Status</th>
                  <th>Accuracy</th>
                  <th>F1 score</th>
                  <th>Duration</th>
                  <th>Started</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className={selected.includes(run.id) ? 'selected-row' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select run ${shortId(run.id)} for comparison`}
                        checked={selected.includes(run.id)}
                        onChange={(event) =>
                          setSelected((ids) =>
                            event.target.checked
                              ? [...ids, run.id]
                              : ids.filter((id) => id !== run.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <Link className="table-link" to={`/experiments/${run.id}`}>
                        {run.pipeline_name || 'Untitled pipeline'}
                      </Link>
                      <small className="cell-sub mono">{shortId(run.id)}</small>
                    </td>
                    <td>{run.model_type ? title(run.model_type) : '—'}</td>
                    <td>
                      <Badge status={run.status} />
                    </td>
                    <td className="mono">{percent(run.metrics.accuracy)}</td>
                    <td className="mono">{percent(run.metrics.f1)}</td>
                    <td className="mono">{duration(run.duration)}</td>
                    <td className="muted">{date(run.created_at)}</td>
                    <td>
                      <Link
                        to={`/experiments/${run.id}`}
                        aria-label={`View run ${shortId(run.id)}`}
                      >
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {compare && <CompareRuns ids={selected} onClose={() => setCompare(false)} />}
    </>
  );
}
