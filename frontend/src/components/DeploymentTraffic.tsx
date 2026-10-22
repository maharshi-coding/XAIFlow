import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Gauge, Radio } from 'lucide-react';
import { api } from '../services/api';
import type { Monitoring } from '../types/domain';
import { Card, Empty, ErrorState, Loading, Metric } from './ui';
import { Timeseries } from './charts';
import { date, percent } from '../utils/format';

export function DeploymentTraffic({ deploymentId }: { deploymentId: string }) {
  const query = useQuery({
    queryKey: ['monitoring', deploymentId],
    queryFn: () => api<Monitoring>(`/monitoring?deployment_id=${deploymentId}`),
    refetchInterval: 10000,
  });
  if (query.isLoading) return <Loading label="Loading deployment traffic" />;
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
  const history = (data.history ?? []).map((point) => ({
    ...point,
    label: new Date(point.created_at).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));
  const latest = data.history?.at(-1);
  return (
    <>
      <div className="metrics-grid">
        <Metric
          label="Serving requests"
          value={data.request_count.toLocaleString()}
          detail="Recorded deployment traffic"
          icon={<Radio size={18} />}
        />
        <Metric
          label="Recent latency"
          value={`${data.avg_latency_ms.toFixed(1)} ms`}
          detail="Mean over monitored request history"
          icon={<Gauge size={18} />}
        />
        <Metric
          label="Serving errors"
          value={data.error_count}
          detail={`${percent(data.error_rate)} request error rate`}
          icon={<AlertTriangle size={18} />}
        />
        <Metric
          label="Predictions served"
          value={(data.prediction_count ?? 0).toLocaleString()}
          detail={
            latest ? `Last activity ${date(latest.created_at)}` : 'Awaiting prediction activity'
          }
          icon={<Activity size={18} />}
        />
      </div>
      <Card
        title="Recent prediction activity"
        subtitle="Actual cumulative prediction counts from recorded monitoring snapshots"
      >
        {history.length ? (
          <Timeseries data={history} dataKey="prediction_count" label="Predictions served" />
        ) : (
          <Empty
            title="No recorded prediction activity"
            description="Send a request in the console below to collect deployment traffic and latency."
          />
        )}
      </Card>
    </>
  );
}
