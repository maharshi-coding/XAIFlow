import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  LoaderCircle,
  Terminal,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { Run } from '../../types/domain';
import { Badge, Button, Notice } from '../../components/ui';
import { duration, percent, shortId, title } from '../../utils/format';

export function RunPanel({ run, close }: { run: Run; close: () => void }) {
  const nodes = run.node_runs ?? [];
  const running = nodes.find((node) => node.status === 'running');
  const completed = nodes.filter((node) => node.status === 'completed').length;
  const active = ['queued', 'running'].includes(run.status);
  const [clock, setClock] = useState(Date.now());
  const [followLogs, setFollowLogs] = useState(true);
  const logsRef = useRef<HTMLDivElement>(null);
  const elapsed =
    run.duration ??
    (run.started_at
      ? Math.max(
          0,
          ((run.finished_at ? new Date(run.finished_at).getTime() : clock) -
            new Date(run.started_at).getTime()) /
            1000,
        )
      : undefined);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (followLogs && logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [run.logs?.length, followLogs]);
  return (
    <section className="run-panel" aria-label="Pipeline execution">
      <div className="run-panel-top">
        <span>
          <Terminal size={18} aria-hidden="true" />
          <strong>Execution</strong>
          <span className="mono muted">{shortId(run.id)}</span>
          <Badge status={run.status} />
        </span>
        <span>
          <Link className="text-link" to={`/experiments/${run.id}`}>
            Open experiment <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <button className="icon-button" aria-label="Close execution panel" onClick={close}>
            <X size={17} />
          </button>
        </span>
      </div>
      <div className="run-progress-label" role="status" aria-live="polite" aria-atomic="true">
        <strong>
          {completed} of {nodes.length} stages completed
        </strong>
        <span>
          {run.status === 'completed'
            ? 'Workflow finished'
            : run.status === 'failed'
              ? 'Execution stopped'
              : active
                ? 'Live execution'
                : title(run.status)}
        </span>
      </div>
      <div
        className="run-progress-track"
        role="progressbar"
        aria-label="Pipeline execution progress"
        aria-valuemin={0}
        aria-valuemax={Math.max(nodes.length, 1)}
        aria-valuenow={completed}
        aria-valuetext={`${completed} of ${nodes.length} stages completed`}
      >
        <span style={{ width: `${nodes.length ? (completed / nodes.length) * 100 : 0}%` }} />
      </div>
      <div className="run-summary">
        <span>
          Current stage{' '}
          <strong>
            {running?.label ||
              running?.node_type ||
              (run.status === 'completed' ? 'All stages completed' : run.status)}
          </strong>
        </span>
        <span>
          Completed{' '}
          <strong>
            {completed}/{nodes.length}
          </strong>
        </span>
        <span>
          Failed <strong>{nodes.filter((node) => node.status === 'failed').length}</strong>
        </span>
        <span>
          Duration <strong>{duration(elapsed)}</strong>
        </span>
        {run.metrics?.accuracy !== undefined && (
          <span>
            Accuracy <strong className="teal">{percent(run.metrics.accuracy)}</strong>
          </span>
        )}
      </div>
      {nodes.length > 0 && (
        <ol className="run-stage-list" aria-label="Stage execution status">
          {nodes.map((node, index) => (
            <li
              key={node.node_id}
              className={`run-stage-item ${node.status === 'running' ? 'is-current' : ''}`}
            >
              <span className="run-stage-position">{String(index + 1).padStart(2, '0')}</span>
              {node.status === 'completed' ? (
                <CheckCircle2 size={15} className="teal" aria-hidden="true" />
              ) : node.status === 'running' ? (
                <LoaderCircle size={15} className="spin teal" aria-hidden="true" />
              ) : node.status === 'failed' ? (
                <TriangleAlert size={15} className="red" aria-hidden="true" />
              ) : (
                <Circle size={15} className="muted" aria-hidden="true" />
              )}
              <strong>{node.label ?? title(node.node_type ?? 'Stage')}</strong>
              <span>{title(node.status)}</span>
              {node.duration !== undefined && (
                <span className="mono muted">{duration(node.duration)}</span>
              )}
            </li>
          ))}
        </ol>
      )}
      <Notice error={run.error} />
      <div className="run-logs-heading">
        <span>
          <Terminal size={16} aria-hidden="true" /> Worker output
        </span>
        <Button
          variant="ghost"
          aria-pressed={followLogs}
          onClick={() => setFollowLogs(!followLogs)}
        >
          <ArrowDownToLine size={15} aria-hidden="true" />{' '}
          {followLogs ? 'Following output' : 'Follow output'}
        </Button>
      </div>
      <div
        className="execution-logs"
        ref={logsRef}
        role="log"
        aria-label="Execution logs"
        aria-live="polite"
        aria-relevant="additions"
      >
        {run.logs?.length ? (
          run.logs.map((log, index) => (
            <div key={index}>
              {typeof log !== 'string' && log.timestamp && (
                <time className="log-time" dateTime={log.timestamp}>
                  {new Date(log.timestamp).toLocaleTimeString(undefined, { hour12: false })}
                </time>
              )}
              <span className="log-level">
                {typeof log === 'string' ? 'INFO' : (log.level ?? 'INFO')}
              </span>
              <span className="log-message">{typeof log === 'string' ? log : log.message}</span>
            </div>
          ))
        ) : (
          <span className="muted">Waiting for the execution worker…</span>
        )}
      </div>
    </section>
  );
}
