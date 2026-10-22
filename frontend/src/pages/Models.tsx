import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, Download, GitCompareArrows, Rocket } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api, patch, scoped } from '../services/api';
import { useAction } from '../hooks/useAction';
import { useWorkspace } from '../hooks/useWorkspace';
import type { RegisteredModel } from '../types/domain';
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
import { MetricsGrid } from '../components/charts';
import { DeployModel } from '../components/DeployModel';
import { ExplanationView } from '../components/ExplanationView';
import { date, percent, shortId, title } from '../utils/format';

export default function Models() {
  const { projectId } = useWorkspace();
  const [deployModel, setDeployModel] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['models', projectId],
    queryFn: () => api<RegisteredModel[]>(scoped('/models', projectId)),
  });
  return (
    <>
      <PageHeader
        eyebrow="VERSION & SERVE"
        title="Model registry"
        description="Track model versions with complete training lineage and fitted preprocessing."
        actions={
          <Link to="/experiments" className="button button-secondary">
            Register from an experiment <ArrowUpRight size={15} />
          </Link>
        }
      />
      <Card
        title="Registered versions"
        subtitle="Every version points to the experiment that produced it"
      >
        {query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <ErrorState
            error={query.error}
            retry={() => {
              void query.refetch();
            }}
          />
        ) : !query.data?.length ? (
          <Empty
            title="Keep your trained models here"
            description="Run a pipeline with a Register Model stage, or register a completed experiment."
            action={
              <Link className="button button-secondary" to="/experiments">
                View experiments
              </Link>
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Algorithm</th>
                  <th>Framework</th>
                  <th>Status</th>
                  <th>Accuracy</th>
                  <th>Source run</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data.map((model) => (
                  <tr key={model.id}>
                    <td>
                      <Link to={`/models/${model.id}`} className="table-link">
                        {model.name}
                      </Link>
                      <small className="cell-sub mono">Version {model.version}</small>
                    </td>
                    <td>{title(model.algorithm)}</td>
                    <td>{model.framework}</td>
                    <td>
                      <Badge status={model.status} />
                    </td>
                    <td className="mono teal">{percent(model.metrics.accuracy)}</td>
                    <td>
                      <Link to={`/experiments/${model.run_id}`} className="mono text-link">
                        {shortId(model.run_id)}
                      </Link>
                    </td>
                    <td className="muted">{date(model.created_at)}</td>
                    <td>
                      <Button
                        variant="secondary"
                        disabled={model.status === 'archived'}
                        onClick={() => setDeployModel(model.id)}
                      >
                        <Rocket size={14} />
                        Deploy
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {deployModel && (
        <DeployModel
          models={query.data ?? []}
          initialModel={deployModel}
          onClose={() => setDeployModel(null)}
        />
      )}
    </>
  );
}

export function ModelDetail() {
  const { id } = useParams();
  const action = useAction();
  const [deploy, setDeploy] = useState(false);
  const [tab, setTab] = useState('details');
  const query = useQuery({
    queryKey: ['model', id],
    queryFn: () => api<RegisteredModel>(`/models/${id}`),
  });
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  const model = query.data!;
  return (
    <>
      <Link className="back-link" to="/models">
        <ArrowLeft size={15} />
        Model registry
      </Link>
      <PageHeader
        eyebrow={`MODEL VERSION ${model.version}`}
        title={model.name}
        description={`${title(model.algorithm)} · ${model.framework} · Created ${date(model.created_at)}`}
        actions={
          <>
            <select
              aria-label="Model lifecycle status"
              value={model.status}
              onChange={(event) => {
                void action.run(
                  () => patch(`/models/${id}`, { status: event.target.value }),
                  'Model status updated.',
                );
              }}
              disabled={action.pending}
            >
              {['candidate', 'approved', 'production', 'archived'].map((status) => (
                <option key={status} value={status}>
                  {title(status)}
                </option>
              ))}
            </select>
            <Button onClick={() => setDeploy(true)} disabled={model.status === 'archived'}>
              <Rocket size={15} />
              Deploy model
            </Button>
          </>
        }
      />
      <Notice error={action.error} success={action.success} />
      <div className="tabs page-tabs">
        <button
          aria-pressed={tab === 'details'}
          className={tab === 'details' ? 'active' : ''}
          onClick={() => setTab('details')}
        >
          Version details
        </button>
        <button
          aria-pressed={tab === 'xai'}
          className={tab === 'xai' ? 'active' : ''}
          onClick={() => setTab('xai')}
        >
          Explainability
        </button>
      </div>
      {tab === 'details' ? (
        <>
          <Card title="Evaluation metrics">
            <MetricsGrid metrics={model.metrics} />
          </Card>
          <div className="two-column">
            <Card title="Model lineage" subtitle="From source data to a registered version">
              <dl className="details-list">
                <dt>Version</dt>
                <dd>v{model.version}</dd>
                <dt>Status</dt>
                <dd>
                  <Badge status={model.status} />
                </dd>
                <dt>Produced by run</dt>
                <dd>
                  <Link className="text-link mono" to={`/experiments/${model.run_id}`}>
                    {shortId(model.run_id)} <ArrowUpRight size={13} />
                  </Link>
                </dd>
                <dt>Pipeline</dt>
                <dd>
                  <Link to="/pipelines">{shortId(model.pipeline_id)}</Link>
                </dd>
                <dt>Dataset</dt>
                <dd>
                  <Link to="/datasets">{shortId(model.dataset_id)}</Link>
                </dd>
                <dt>Artifact</dt>
                <dd>
                  <a className="text-link" href={`/api/v1/models/${id}/download`} download>
                    <Download size={14} />
                    Download model bundle
                  </a>
                </dd>
                <dt>XAI methods</dt>
                <dd>
                  {model.explanations
                    ?.map((item) => (item.explainer ?? item.method).toUpperCase())
                    .join(', ') || 'None recorded'}
                </dd>
              </dl>
              <div className="inline-actions">
                <Link to={`/experiments/${model.run_id}`} className="button button-secondary">
                  View run <ArrowUpRight size={14} />
                </Link>
                <Link
                  to={`/experiments?model=${model.algorithm}`}
                  className="button button-secondary"
                >
                  <GitCompareArrows size={14} />
                  Compare runs
                </Link>
              </div>
            </Card>
            <Card title="Model parameters" subtitle="Training settings for this version">
              <Code value={model.parameters ?? {}} />
            </Card>
          </div>
          <Card
            title="Saved preprocessing"
            subtitle="Applied identically to every inference request"
          >
            <Code value={model.preprocessing ?? []} />
          </Card>
          <Card title="Input schema" subtitle="Raw feature names and types expected by the model">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {model.input_schema?.map((feature) => (
                    <tr key={feature.name}>
                      <td className="mono">{feature.name}</td>
                      <td>{feature.dtype}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Deployment history">
            {model.deployments?.length ? (
              <div className="item-list">
                {model.deployments.map((deployment) => (
                  <Link
                    key={deployment.id}
                    to={`/deployments?id=${deployment.id}`}
                    className="list-row"
                  >
                    <div>
                      <strong>{deployment.name}</strong>
                      <small>{date(deployment.created_at)}</small>
                    </div>
                    <Badge status={deployment.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                title="This version hasn’t been deployed"
                description="Create a deployment to expose a monitored prediction endpoint."
              />
            )}
          </Card>
        </>
      ) : (
        <ExplanationView explanations={model.explanations ?? []} />
      )}
      {deploy && (
        <DeployModel models={[model]} initialModel={model.id} onClose={() => setDeploy(false)} />
      )}
    </>
  );
}
