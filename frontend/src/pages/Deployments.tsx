import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowUpRight, Braces, CirclePlay, FileInput, Plus, Rocket } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, patch, post, scoped } from '../services/api';
import { useAction } from '../hooks/useAction';
import { useWorkspace } from '../hooks/useWorkspace';
import type { Dataset, Deployment, PredictionResponse, RegisteredModel } from '../types/domain';
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
import { DeployModel } from '../components/DeployModel';
import { ExplanationView } from '../components/ExplanationView';
import { DeploymentTraffic } from '../components/DeploymentTraffic';
import { date, percent, shortId } from '../utils/format';

function PredictionConsole({ deployment }: { deployment: Deployment }) {
  const action = useAction();
  const [body, setBody] = useState('{\n  "rows": [],\n  "explain": "lime"\n}');
  const [result, setResult] = useState<PredictionResponse | null>(null);
  async function example() {
    const datasetId = deployment.model?.dataset_id;
    if (!datasetId) return;
    const dataset = await action.run(() => api<Dataset>(`/datasets/${datasetId}`));
    if (!dataset?.preview?.length) return;
    const row = { ...dataset.preview[0] };
    const actualLabel = dataset.target_column ? row[dataset.target_column] : undefined;
    if (dataset.target_column) delete row[dataset.target_column];
    setBody(
      JSON.stringify(
        {
          rows: [row],
          explain: deployment.explanation_method ?? 'lime',
          ...(actualLabel !== undefined ? { labels: [actualLabel] } : {}),
        },
        null,
        2,
      ),
    );
  }
  async function predict() {
    const response = await action.run(async () => {
      const parsed: unknown = JSON.parse(body);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        throw new Error('Provide a JSON object containing rows and optional explain / labels.');
      return post<PredictionResponse>(`/deployments/${deployment.id}/predict`, parsed);
    }, 'Prediction completed and recorded in monitoring.');
    if (response) setResult(response);
  }
  const explanations =
    result?.predictions.flatMap((prediction) =>
      prediction.explanation ? [prediction.explanation] : [],
    ) ?? [];
  return (
    <>
      <div className="two-column console-grid">
        <Card
          title="Prediction request"
          subtitle="Send raw features; saved preprocessing is applied automatically"
          action={
            <Button
              variant="ghost"
              onClick={() => {
                void example();
              }}
              disabled={!deployment.model?.dataset_id || action.pending}
            >
              <FileInput size={14} />
              Use dataset sample
            </Button>
          }
        >
          <div className="endpoint">
            <span>POST</span>
            <code>{deployment.predict_url ?? `/api/v1/deployments/${deployment.id}/predict`}</code>
          </div>
          <label className="sr-only" htmlFor="prediction-body">
            Prediction request JSON
          </label>
          <textarea
            id="prediction-body"
            className="request-editor"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            spellCheck={false}
          />
          <div className="console-footer">
            <span>
              Up to 10 rows with explanations, 1,000 without. Labels enable accuracy monitoring.
            </span>
            <Button
              loading={action.pending}
              disabled={deployment.status !== 'active'}
              onClick={() => {
                void predict();
              }}
            >
              <CirclePlay size={15} />
              Send request
            </Button>
          </div>
        </Card>
        <Card
          title="Response"
          subtitle={
            result
              ? `${result.predictions.length} prediction(s) · ${result.latency_ms?.toFixed(1)} ms · version ${result.model_version}`
              : 'Prediction metadata and explanations appear here'
          }
        >
          {result ? (
            <>
              <div className="prediction-results">
                {result.predictions.map((prediction, index) => (
                  <div className="prediction-row" key={index}>
                    <span>ROW {index + 1}</span>
                    <strong>Class {String(prediction.prediction)}</strong>
                    <span className="teal">{percent(prediction.confidence)} confidence</span>
                  </div>
                ))}
              </div>
              <Code value={result} />
            </>
          ) : (
            <Empty
              title="Ready for a request"
              description="Use a real dataset sample or write a JSON request to inspect model predictions."
            />
          )}
        </Card>
      </div>
      <Notice error={action.error} success={action.success} />
      {explanations.length > 0 && <ExplanationView explanations={explanations} />}
    </>
  );
}

export default function Deployments() {
  const { projectId } = useWorkspace();
  const action = useAction();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const query = useQuery({
    queryKey: ['deployments', projectId],
    queryFn: () => api<Deployment[]>(scoped('/deployments', projectId)),
  });
  const models = useQuery({
    queryKey: ['models', projectId],
    queryFn: () => api<RegisteredModel[]>(scoped('/models', projectId)),
  });
  const selected =
    query.data?.find((deployment) => deployment.id === params.get('id')) ?? query.data?.[0];
  return (
    <>
      <PageHeader
        eyebrow="MODEL SERVING"
        title="Deployments"
        description="Serve models through a monitored REST endpoint with prediction explanations."
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={!models.data?.some((model) => model.status !== 'archived')}
          >
            <Plus size={16} />
            New deployment
          </Button>
        }
      />
      <Notice error={action.error} success={action.success} />
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : !query.data?.length ? (
        <Card>
          <Empty
            title="Put a model to work"
            description="Deploy a registered model to send predictions and start monitoring its behavior."
            action={
              <Link className="button button-secondary" to="/models">
                Open model registry <ArrowUpRight size={15} />
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="deployment-grid">
            {query.data.map((deployment) => (
              <button
                className={`deployment-card ${selected?.id === deployment.id ? 'deployment-selected' : ''}`}
                aria-pressed={selected?.id === deployment.id}
                key={deployment.id}
                onClick={() => setParams({ id: deployment.id })}
              >
                <div>
                  <span className="mini-icon">
                    <Rocket size={18} />
                  </span>
                  <Badge status={deployment.status} />
                </div>
                <strong>{deployment.name}</strong>
                <span>
                  {deployment.model_name ?? 'Registered model'} · v{deployment.model_version ?? '—'}
                </span>
                <small>Created {date(deployment.created_at)}</small>
              </button>
            ))}
          </div>
          {selected && (
            <>
              <div className="toolbar">
                <div className="toolbar-title">
                  <Braces size={19} />
                  <strong>{selected.name}</strong>
                  <span className="mono muted">{shortId(selected.id)}</span>
                </div>
                <div className="inline-actions">
                  <select
                    aria-label="Deployment status"
                    value={selected.status}
                    disabled={action.pending}
                    onChange={(event) => {
                      void action.run(
                        () => patch(`/deployments/${selected.id}`, { status: event.target.value }),
                        'Deployment status updated.',
                      );
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                  <Link className="button button-secondary" to={`/monitoring?id=${selected.id}`}>
                    <Activity size={15} />
                    Monitoring
                  </Link>
                </div>
              </div>
              <DeploymentTraffic deploymentId={selected.id} />
              <PredictionConsole key={selected.id} deployment={selected} />
            </>
          )}
        </>
      )}
      {createOpen && (
        <DeployModel models={models.data ?? []} onClose={() => setCreateOpen(false)} />
      )}
    </>
  );
}
