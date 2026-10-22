import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  FlaskConical,
  Gauge,
  Radio,
  Save,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, patch, post, scoped } from '../services/api';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAction } from '../hooks/useAction';
import type { Deployment, Monitoring as MonitoringData } from '../types/domain';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorState,
  Field,
  Loading,
  Metric,
  Notice,
  PageHeader,
} from '../components/ui';
import { Timeseries } from '../components/charts';
import { date, percent } from '../utils/format';

function DeploymentMonitoring({ deployment }: { deployment: Deployment }) {
  const action = useAction();
  const [shift, setShift] = useState(2.5);
  const [threshold, setThreshold] = useState(deployment.drift_threshold ?? 0.2);
  const [degradation, setDegradation] = useState(deployment.degradation_threshold ?? 0.1);
  const query = useQuery({
    queryKey: ['monitoring', deployment.id],
    queryFn: () => api<MonitoringData>(`/monitoring?deployment_id=${deployment.id}`),
    refetchInterval: 10000,
  });
  if (query.isLoading) return <Loading label="Loading deployment monitoring" />;
  if (query.error)
    return (
      <ErrorState
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const data = query.data!;
  const timeline = (data.history ?? []).map((point) => ({
    ...point,
    label: new Date(point.created_at).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));
  const distribution = Object.entries(data.prediction_distribution ?? {}).map(([label, count]) => ({
    label,
    count,
  }));
  return (
    <>
      <Notice error={action.error} success={action.success} />
      <div className="metrics-grid">
        <Metric
          label="Requests"
          value={data.request_count.toLocaleString()}
          detail={`${data.prediction_count ?? 0} predictions in monitored history`}
          icon={<Radio size={19} />}
        />
        <Metric
          label="Average latency"
          value={`${data.avg_latency_ms.toFixed(1)} ms`}
          detail="Includes requested explanation time"
          icon={<Gauge size={19} />}
        />
        <Metric
          label="Errors"
          value={data.error_count}
          detail={`${percent(data.error_rate)} request error rate`}
          icon={<AlertTriangle size={19} />}
        />
        <Metric
          label="Maximum drift (PSI)"
          value={(data.drift_score ?? 0).toFixed(3)}
          detail={`Threshold ${(data.drift_threshold ?? deployment.drift_threshold ?? 0.2).toFixed(2)}`}
          icon={<Activity size={19} />}
        />
      </div>
      <div className="two-column">
        <Card title="Request volume" subtitle="Persisted monitoring snapshots">
          {timeline.length ? (
            <Timeseries data={timeline} dataKey="request_count" label="Requests" />
          ) : (
            <Empty
              title="No prediction traffic yet"
              description="Send a prediction request to collect monitoring data."
            />
          )}
        </Card>
        <Card title="Latency" subtitle="Mean response time per recorded snapshot">
          {timeline.length ? (
            <Timeseries
              data={timeline}
              dataKey="avg_latency_ms"
              label="Latency (ms)"
              color="#5b7cbd"
            />
          ) : (
            <Empty
              title="Waiting for traffic"
              description="Latency is measured for every successful and failed request."
            />
          )}
        </Card>
      </div>
      <Card
        title="Feature distribution drift"
        subtitle="Population Stability Index against the original training dataset"
      >
        {data.features?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Baseline mean</th>
                  <th>Current mean</th>
                  <th>PSI</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {data.features.map((feature) => (
                  <tr key={feature.feature}>
                    <td>
                      <strong>{feature.feature}</strong>
                    </td>
                    <td className="mono">
                      {typeof feature.baseline_mean === 'number'
                        ? feature.baseline_mean.toFixed(3)
                        : 'Categorical'}
                    </td>
                    <td className="mono">
                      {typeof feature.current_mean === 'number'
                        ? feature.current_mean.toFixed(3)
                        : typeof feature.baseline_mean === 'number'
                          ? 'No numeric samples'
                          : 'Categorical'}
                    </td>
                    <td className={`mono ${feature.drifted ? 'red' : 'teal'}`}>
                      {feature.psi.toFixed(4)}
                    </td>
                    <td>
                      <Badge status={feature.drifted ? 'warning' : 'stable'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Baseline ready, awaiting observations"
            description="Raw prediction features will be compared with the training data distribution."
          />
        )}
      </Card>
      <div className="two-column">
        <Card
          title="Prediction distribution"
          subtitle="Observed class counts in monitored prediction traffic"
        >
          {distribution.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    isAnimationActive={false}
                    dataKey="count"
                    fill="var(--chart-primary)"
                    maxBarSize={60}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty
              title="No predictions yet"
              description="Class counts will appear when inference requests are recorded."
            />
          )}
        </Card>
        <Card
          title="Performance against baseline"
          subtitle="Observed accuracy requires ground truth labels"
        >
          <div className="performance-compare">
            <div>
              <span>Training baseline</span>
              <strong>{percent(data.baseline_accuracy)}</strong>
            </div>
            <div>
              <span>Observed accuracy</span>
              <strong>{percent(data.accuracy)}</strong>
            </div>
            <div>
              <span>Accuracy degradation</span>
              <strong className={(data.degradation ?? 0) > degradation ? 'red' : 'teal'}>
                {percent(data.degradation)}
              </strong>
            </div>
          </div>
          <p className="chart-footnote">
            Include a labels array in prediction requests to monitor accuracy. Feature drift can be
            measured without labels.
          </p>
        </Card>
      </div>
      <div className="two-column">
        <Card
          title="Controlled distribution shift"
          subtitle="Send modified source samples to demonstrate drift detection"
        >
          <div className="pad">
            <p className="muted">
              Numeric features shift by the selected number of standard deviations. The model
              predicts the changed data and records real monitoring results.
            </p>
            <Field label="Shift magnitude">
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={shift}
                onChange={(event) => setShift(Number(event.target.value))}
              />
            </Field>
            <Button
              disabled={deployment.status !== 'active'}
              loading={action.pending}
              onClick={() => {
                void action.run(
                  () => post(`/monitoring/${deployment.id}/simulate`, { shift }),
                  'Shifted samples predicted. Monitoring and alerts have refreshed.',
                );
              }}
            >
              <FlaskConical size={15} />
              {shift === 0 ? 'Send baseline samples' : 'Simulate drift'}
            </Button>
          </div>
        </Card>
        <Card
          title="Alert thresholds"
          subtitle="Configure drift and observed performance detection"
        >
          <form
            className="pad"
            onSubmit={(event) => {
              event.preventDefault();
              void action.run(
                () =>
                  patch(`/deployments/${deployment.id}`, {
                    drift_threshold: threshold,
                    degradation_threshold: degradation,
                  }),
                'Thresholds updated. New prediction traffic will use them.',
              );
            }}
          >
            <div className="form-grid">
              <Field label="Drift threshold (PSI)">
                <input
                  type="number"
                  min="0.01"
                  max="5"
                  step="0.05"
                  value={threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                  required
                />
              </Field>
              <Field label="Accuracy degradation">
                <input
                  type="number"
                  min="0.01"
                  max="1"
                  step="0.01"
                  value={degradation}
                  onChange={(event) => setDegradation(Number(event.target.value))}
                  required
                />
              </Field>
            </div>
            <Button variant="secondary" type="submit" loading={action.pending}>
              <Save size={15} />
              Save thresholds
            </Button>
          </form>
        </Card>
      </div>
      <Card
        title="Deployment alerts"
        action={
          <Link to="/alerts" className="text-link">
            Alert center <ArrowUpRight size={14} />
          </Link>
        }
      >
        {data.alerts?.length ? (
          <div className="item-list">
            {data.alerts.map((alert) => (
              <Link to="/alerts" className="list-row" key={alert.id}>
                <div>
                  <strong>{alert.message}</strong>
                  <small>{date(alert.created_at)}</small>
                </div>
                <Badge status={alert.status} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="healthy-state">
            <span className="healthy-dot" />
            <strong>No deployment alerts</strong>
            <p>Threshold breaches will appear here and in the alert center.</p>
          </div>
        )}
      </Card>
    </>
  );
}

export default function Monitoring() {
  const { projectId } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const deployments = useQuery({
    queryKey: ['deployments', projectId],
    queryFn: () => api<Deployment[]>(scoped('/deployments', projectId)),
  });
  const selected =
    deployments.data?.find((deployment) => deployment.id === params.get('id')) ??
    deployments.data?.[0];
  return (
    <>
      <PageHeader
        eyebrow="OBSERVE & RESPOND"
        title="Monitoring"
        description="Measure prediction traffic, compare feature distributions, and detect changes."
        actions={
          selected && (
            <Link className="button button-secondary" to={`/deployments?id=${selected.id}`}>
              Prediction console <ArrowUpRight size={15} />
            </Link>
          )
        }
      />
      {deployments.isLoading ? (
        <Loading />
      ) : deployments.error ? (
        <ErrorState error={deployments.error} />
      ) : !selected ? (
        <Card>
          <Empty
            title="Start with a deployed model"
            description="Deploy a registered model and send predictions to collect monitoring data."
            action={
              <Link to="/deployments" className="button button-secondary">
                View deployments
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="toolbar">
            <div className="select-with-icon">
              <Activity size={17} />
              <select
                aria-label="Monitored deployment"
                value={selected.id}
                onChange={(event) => setParams({ id: event.target.value })}
              >
                {deployments.data?.map((deployment) => (
                  <option key={deployment.id} value={deployment.id}>
                    {deployment.name}
                  </option>
                ))}
              </select>
            </div>
            <Badge status={selected.status} />
          </div>
          <DeploymentMonitoring key={selected.id} deployment={selected} />
        </>
      )}
    </>
  );
}
