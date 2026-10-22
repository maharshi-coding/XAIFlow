import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Bell, Check, CheckCheck, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, patch, scoped } from '../services/api';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAction } from '../hooks/useAction';
import type { Alert } from '../types/domain';
import {
  Badge,
  Button,
  Card,
  Code,
  Empty,
  ErrorState,
  Loading,
  Notice,
  PageHeader,
} from '../components/ui';
import { date, shortId, title } from '../utils/format';

export default function Alerts() {
  const { projectId } = useWorkspace();
  const action = useAction();
  const [status, setStatus] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['alerts', projectId],
    queryFn: () => api<Alert[]>(scoped('/alerts', projectId)),
    refetchInterval: 10000,
  });
  const alerts = query.data?.filter((alert) => status === 'all' || alert.status === status) ?? [];
  return (
    <>
      <PageHeader
        eyebrow="DETECT & ACT"
        title="Alert center"
        description="Persisted pipeline failures, inference errors, drift, and model degradation."
        actions={
          <span className="alert-total">
            <Bell size={17} />
            {query.data?.filter((alert) => alert.status === 'open').length ?? 0} open alerts
          </span>
        }
      />
      <Notice error={action.error} success={action.success} />
      <Card>
        <div className="filters">
          <strong>Alerts</strong>
          <select
            aria-label="Filter alert status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {['open', 'acknowledged', 'resolved'].map((item) => (
              <option key={item} value={item}>
                {title(item)}
              </option>
            ))}
          </select>
          <span className="muted">{alerts.length} results</span>
        </div>
        {query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} />
        ) : !alerts.length ? (
          <Empty
            title="All clear"
            description={
              status === 'all'
                ? 'Alerts will be created when a pipeline fails or monitoring thresholds are exceeded.'
                : 'No alerts match this status.'
            }
          />
        ) : (
          <div className="alert-list">
            {alerts.map((alert) => (
              <article className="alert-item" key={alert.id}>
                <div className="alert-content">
                  <span
                    className={`alert-icon ${alert.severity === 'critical' ? 'alert-critical' : ''}`}
                  >
                    <AlertTriangle size={19} />
                  </span>
                  <div>
                    <div className="alert-title">
                      <strong>{alert.title ?? title(alert.kind ?? alert.type ?? 'Alert')}</strong>
                      <Badge status={alert.severity} />
                      <Badge status={alert.status} />
                    </div>
                    <p>{alert.description ?? alert.message}</p>
                    <div className="alert-meta">
                      <span>{date(alert.created_at)}</span>
                      {alert.run_id && (
                        <Link to={`/experiments/${alert.run_id}`}>Run {shortId(alert.run_id)}</Link>
                      )}
                      {alert.deployment_id && (
                        <Link to={`/monitoring?id=${alert.deployment_id}`}>
                          Deployment {shortId(alert.deployment_id)}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="alert-actions">
                    {alert.status === 'open' && (
                      <Button
                        variant="secondary"
                        loading={action.pending}
                        onClick={() => {
                          void action.run(
                            () => patch(`/alerts/${alert.id}`, { status: 'acknowledged' }),
                            'Alert acknowledged.',
                          );
                        }}
                      >
                        <Check size={14} />
                        Acknowledge
                      </Button>
                    )}
                    {alert.status !== 'resolved' && (
                      <Button
                        variant="ghost"
                        loading={action.pending}
                        onClick={() => {
                          void action.run(
                            () => patch(`/alerts/${alert.id}`, { status: 'resolved' }),
                            'Alert resolved.',
                          );
                        }}
                      >
                        <CheckCheck size={15} />
                        Resolve
                      </Button>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`Show details for alert ${shortId(alert.id)}`}
                      aria-expanded={expanded === alert.id}
                      onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>
                </div>
                {expanded === alert.id && (
                  <div className="alert-details">
                    <dl className="alert-facts">
                      <dt>Source</dt>
                      <dd className="mono">
                        {alert.source ??
                          (alert.deployment_id
                            ? `deployment:${alert.deployment_id}`
                            : alert.run_id
                              ? `run:${alert.run_id}`
                              : '—')}
                      </dd>
                      <dt>Metric</dt>
                      <dd>{alert.metric ?? String(alert.details?.metric ?? '—')}</dd>
                      <dt>Threshold</dt>
                      <dd className="mono">
                        {(alert.threshold ?? alert.details?.threshold) != null
                          ? String(alert.threshold ?? alert.details?.threshold)
                          : '—'}
                      </dd>
                      <dt>Observed value</dt>
                      <dd className="mono">
                        {(alert.observed_value ?? alert.details?.observed_value) != null
                          ? String(alert.observed_value ?? alert.details?.observed_value)
                          : '—'}
                      </dd>
                    </dl>
                    <Code value={alert.details ?? {}} />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
