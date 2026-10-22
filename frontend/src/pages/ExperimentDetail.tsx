import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import { ArrowLeft, Box, Download, RotateCcw, ScanEye, Terminal } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, post } from '../services/api';
import { useAction } from '../hooks/useAction';
import type { RegisteredModel, Run } from '../types/domain';
import {
  Badge,
  Button,
  Card,
  Code,
  Empty,
  ErrorState,
  Field,
  Loading,
  Modal,
  Notice,
  PageHeader,
} from '../components/ui';
import {
  ClassDistributions,
  ConfusionMatrix,
  MetricsGrid,
  RocCurve,
  Timeseries,
} from '../components/charts';
import { ExplanationView } from '../components/ExplanationView';
import { bytes, date, duration, shortId, title } from '../utils/format';
import { toFlow } from '../features/pipelines/graph';
import { StageNode } from '../features/pipelines/StageNode';

const nodeTypes = { stage: StageNode };

export default function ExperimentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const action = useAction();
  const [tab, setTab] = useState('results');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [modelName, setModelName] = useState('');
  const query = useQuery({
    queryKey: ['run', id],
    queryFn: () => api<Run>(`/runs/${id}`),
    refetchInterval: (query) =>
      ['queued', 'running'].includes(query.state.data?.status ?? '') ? 1500 : false,
  });
  if (query.isLoading) return <Loading label="Loading experiment" />;
  if (query.error)
    return (
      <ErrorState
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const run = query.data!;
  const graph = toFlow(run.definition ?? { nodes: [], edges: [] }, []);
  graph.nodes = graph.nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      status: run.node_runs?.find((entry) => entry.node_id === node.id)?.status,
    },
  }));
  return (
    <>
      <Link className="back-link" to="/experiments">
        <ArrowLeft size={15} />
        All experiments
      </Link>
      <PageHeader
        eyebrow={`EXPERIMENT ${shortId(run.id).toUpperCase()}`}
        title={run.pipeline_name || 'Pipeline experiment'}
        description={`${title(run.model_type ?? 'Pending training')} · ${date(run.created_at)} · ${duration(run.duration)}`}
        actions={
          <>
            <Badge status={run.status} />
            <Button
              variant="secondary"
              loading={action.pending}
              onClick={async () => {
                const result = await action.run(() => post<Run>(`/runs/${id}/rerun`));
                if (result) navigate(`/experiments/${result.id}`);
              }}
            >
              <RotateCcw size={15} />
              Re-run experiment
            </Button>
            <Button
              disabled={run.status !== 'completed'}
              onClick={() => {
                setModelName(run.pipeline_name || 'Classifier');
                setRegisterOpen(true);
                action.clear();
              }}
            >
              <Box size={15} />
              Register model
            </Button>
          </>
        }
      />
      <Notice error={!registerOpen ? (action.error ?? run.error) : null} success={action.success} />
      <div className="tabs page-tabs">
        <button
          aria-pressed={tab === 'results'}
          className={tab === 'results' ? 'active' : ''}
          onClick={() => setTab('results')}
        >
          Results & lineage
        </button>
        <button
          aria-pressed={tab === 'explanations'}
          className={tab === 'explanations' ? 'active' : ''}
          onClick={() => setTab('explanations')}
        >
          <ScanEye size={16} />
          Explainability <span className="count-chip">{run.explanations?.length ?? 0}</span>
        </button>
        <button
          aria-pressed={tab === 'logs'}
          className={tab === 'logs' ? 'active' : ''}
          onClick={() => setTab('logs')}
        >
          <Terminal size={16} />
          Execution logs
        </button>
      </div>
      {tab === 'results' && (
        <>
          <Card title="Classification metrics" subtitle="Held-out evaluation results">
            <MetricsGrid metrics={run.metrics} />
            {!Object.keys(run.metrics).length && (
              <p className="muted pad">Metrics appear after the evaluation stage completes.</p>
            )}
          </Card>
          <div className="two-column">
            <ConfusionMatrix metrics={run.metrics} />
            <Card title="Run lineage" subtitle="Trace this result to its source">
              <dl className="details-list">
                <dt>Run ID</dt>
                <dd className="mono">{run.id}</dd>
                <dt>Pipeline</dt>
                <dd>
                  <Link to="/pipelines">{run.pipeline_name || shortId(run.pipeline_id)}</Link>
                </dd>
                <dt>Dataset</dt>
                <dd>
                  <Link to="/datasets">{run.dataset_name ?? shortId(run.dataset_id)}</Link>
                </dd>
                <dt>Model algorithm</dt>
                <dd>{title(run.model_type ?? 'Pending')}</dd>
                <dt>Started</dt>
                <dd>{date(run.started_at)}</dd>
                <dt>Finished</dt>
                <dd>{date(run.finished_at)}</dd>
                <dt>Duration</dt>
                <dd>{duration(run.duration)}</dd>
              </dl>
            </Card>
          </div>
          {run.metrics.roc_curve && <RocCurve curve={run.metrics.roc_curve} />}
          <ClassDistributions metrics={run.metrics} />
          {!!run.result?.training_history?.length && (
            <Card title="Neural network training" subtitle="Recorded loss for each training epoch">
              <Timeseries
                data={run.result.training_history.map((point) => ({
                  ...point,
                  label: `Epoch ${point.epoch}`,
                }))}
                dataKey="loss"
                label="Training loss"
                color="#8c77b6"
              />
            </Card>
          )}
          <Card title="Execution graph" subtitle="Persisted stages and their execution states">
            <div className="read-only-flow">
              <ReactFlow
                nodes={graph.nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                minZoom={0.2}
              >
                <Background gap={20} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          </Card>
          <Card title="Stage execution" subtitle="Node timings and any failure details">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {run.node_runs?.map((node) => (
                    <tr key={node.node_id}>
                      <td>
                        <strong>{node.label || title(node.node_type ?? '')}</strong>
                      </td>
                      <td>
                        <Badge status={node.status} />
                      </td>
                      <td>{date(node.started_at)}</td>
                      <td className="mono">{duration(node.duration)}</td>
                      <td className="red">{node.error || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="two-column">
            <Card title="Model parameters" subtitle="Stored training configuration">
              <Code value={run.parameters ?? {}} />
            </Card>
            <Card title="Preprocessing" subtitle="Fitted transformation sequence">
              <Code value={run.preprocessing ?? []} />
            </Card>
          </div>
          <Card title="Artifacts" subtitle="Persisted outputs with verified downloads">
            {run.artifacts?.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Artifact</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {run.artifacts.map((artifact, i) => (
                      <tr key={artifact.id ?? i}>
                        <td>
                          <strong>{artifact.name}</strong>
                        </td>
                        <td>{title(artifact.kind ?? artifact.type ?? 'output')}</td>
                        <td className="mono">{bytes(artifact.size_bytes)}</td>
                        <td>
                          {artifact.download_url || artifact.id ? (
                            <a
                              className="text-link"
                              href={
                                artifact.download_url ?? `/api/v1/artifacts/${artifact.id}/download`
                              }
                              download
                            >
                              <Download size={15} />
                              Download
                            </a>
                          ) : (
                            <span className="muted">Download unavailable</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No artifacts yet"
                description="Models, evaluation results, and explanations appear after the corresponding stages complete."
              />
            )}
          </Card>
          <Card title="Execution environment">
            <Code value={run.environment ?? {}} />
          </Card>
        </>
      )}
      {tab === 'explanations' && <ExplanationView explanations={run.explanations ?? []} />}
      {tab === 'logs' && (
        <Card title="Execution logs" subtitle="Persisted worker output">
          <div className="full-logs" role="log">
            {run.logs?.length ? (
              run.logs.map((log, index) => (
                <div key={index}>
                  <time>{typeof log === 'string' ? '' : date(log.timestamp)}</time>
                  <span className="log-level">{typeof log === 'string' ? 'INFO' : log.level}</span>
                  <span>{typeof log === 'string' ? log : log.message}</span>
                </div>
              ))
            ) : (
              <p>Waiting for worker logs…</p>
            )}
          </div>
        </Card>
      )}
      {registerOpen && (
        <Modal title="Register a model version" onClose={() => setRegisterOpen(false)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const result = await action.run(() =>
                post<RegisteredModel>(`/runs/${id}/register`, { name: modelName }),
              );
              if (result) {
                setRegisterOpen(false);
                navigate(`/models/${result.id}`);
              }
            }}
          >
            <p className="modal-copy">
              Registration keeps the fitted model, preprocessing, evaluation metrics, and experiment
              lineage together.
            </p>
            <Field label="Model name" hint="Using an existing name creates the next version.">
              <input
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                required
              />
            </Field>
            <Notice error={action.error} />
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={action.pending}>
                Register version
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
