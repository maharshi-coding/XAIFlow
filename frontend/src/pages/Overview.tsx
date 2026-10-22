import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Database,
  FlaskConical,
  FolderOpen,
  GitBranch,
  Plus,
  Rocket,
  ScanEye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { api, scoped } from '../services/api';
import type { Overview as OverviewData, Run, RegisteredModel, Deployment } from '../types/domain';
import { Badge, Card, Empty, ErrorState, Loading, Metric, PageHeader } from '../components/ui';
import { date, duration, percent, shortId, title } from '../utils/format';
import { Timeseries } from '../components/charts';
import { HeroScene } from '../components/motion/HeroScene';
import { CountUp } from '../components/motion/CountUp';
import { TiltCard } from '../components/motion/TiltCard';
import { Reveal } from '../components/motion/Reveal';

export function RunsTable({ runs }: { runs: Run[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Experiment</th>
            <th>Algorithm</th>
            <th>Status</th>
            <th>Accuracy</th>
            <th>Duration</th>
            <th>Started</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td>
                <Link className="table-link" to={`/experiments/${run.id}`}>
                  {run.pipeline_name ?? `Run ${shortId(run.id)}`}
                </Link>
                <small className="cell-sub mono">{shortId(run.id)}</small>
              </td>
              <td>{run.model_type ? title(run.model_type) : 'Pending training'}</td>
              <td>
                <Badge status={run.status} />
              </td>
              <td className="mono">{percent(run.metrics?.accuracy)}</td>
              <td className="mono">{duration(run.duration)}</td>
              <td className="muted">{date(run.created_at)}</td>
              <td>
                <Link
                  to={`/experiments/${run.id}`}
                  aria-label={`Open experiment ${shortId(run.id)}`}
                  className="icon-button"
                >
                  <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Overview() {
  const { projectId, projects } = useWorkspace();
  const query = useQuery({
    queryKey: ['overview', projectId],
    queryFn: () => api<OverviewData>(scoped('/overview', projectId)),
    refetchInterval: 10000,
  });
  const models = useQuery({
    queryKey: ['models', projectId],
    queryFn: () => api<RegisteredModel[]>(scoped('/models', projectId)),
  });
  const deployments = useQuery({
    queryKey: ['deployments', projectId],
    queryFn: () => api<Deployment[]>(scoped('/deployments', projectId)),
  });
  const selectedProject = projects.find((project) => project.id === projectId);
  if (query.isLoading) return <Loading />;
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
  const runs = data.recent_runs ?? [];
  const counts = data.counts ?? {};
  const timeline = Array.from(
    runs
      .reduce((map, run) => {
        const day = new Date(run.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
        const previous = map.get(day) ?? { label: day, completed: 0, failed: 0 };
        if (run.status === 'completed') previous.completed += 1;
        if (run.status === 'failed') previous.failed += 1;
        map.set(day, previous);
        return map;
      }, new Map<string, { label: string; completed: number; failed: number }>())
      .values(),
  ).reverse();
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE OVERVIEW"
        title={selectedProject ? selectedProject.name : 'From data to decisions.'}
        description={
          selectedProject?.description ||
          'Build reproducible pipelines. Understand every prediction. Ship with confidence.'
        }
        actions={
          <Link className="button button-primary" to="/pipelines">
            <Plus size={16} />
            Build a pipeline
          </Link>
        }
      />
      <div className="metrics-grid">
        <Metric
          label="Projects"
          value={<CountUp value={counts.projects ?? projects.length} />}
          detail={projectId ? 'Current project scope' : 'Across your workspace'}
          icon={<FolderOpen size={19} />}
        />
        <Metric
          label="Datasets"
          value={<CountUp value={counts.datasets ?? 0} />}
          detail="Versioned source data"
          icon={<Database size={19} />}
        />
        <Metric
          label="Pipeline runs"
          value={<CountUp value={counts.runs ?? counts.pipeline_runs ?? 0} />}
          detail={`${counts.successful_runs ?? counts.completed_runs ?? runs.filter((run) => run.status === 'completed').length} successful · ${counts.failed_runs ?? runs.filter((run) => run.status === 'failed').length} failed`}
          icon={<FlaskConical size={19} />}
        />
        <Metric
          label="Registered models"
          value={<CountUp value={counts.models ?? counts.registered_models ?? models.data?.length ?? 0} />}
          detail={`${deployments.data?.filter((deployment) => deployment.status === 'active').length ?? 0} active deployments`}
          icon={<Box size={19} />}
        />
      </div>
      <section className="overview-hero" aria-label="Machine learning workflow">
        <div className="overview-hero-content">
          <span className="hero-kicker">
            <GitBranch size={15} aria-hidden="true" /> A CONNECTED ML WORKFLOW
          </span>
          <h2>
            Every step connected.
            <br />
            Every prediction understood.
          </h2>
          <p>
            Move from raw data to a served model, with evaluation and explanations along the way.
          </p>
          <Link to="/pipelines" className="button button-primary">
            Open pipeline studio <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="overview-hero-visual">
          <HeroScene
            fallback={
              <ol className="workflow-track" aria-label="Workflow stages">
                {[
                  { label: 'Dataset', icon: Database },
                  { label: 'Train', icon: FlaskConical },
                  { label: 'Explain', icon: ScanEye },
                  { label: 'Serve', icon: Rocket },
                ].map(({ label, icon: Icon }, index) => (
                  <li className="workflow-step" key={label}>
                    <span className="workflow-step-icon">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span className="workflow-step-number">0{index + 1}</span>
                    <strong>{label}</strong>
                  </li>
                ))}
              </ol>
            }
          />
          <div className="workflow-summary">
            <span>
              <i aria-hidden="true" />
              {counts.successful_runs ??
                runs.filter((run) => run.status === 'completed').length}{' '}
              completed experiments
            </span>
            <span>
              {deployments.data?.filter((deployment) => deployment.status === 'active').length ?? 0}{' '}
              active deployments
            </span>
          </div>
        </div>
      </section>
      <Reveal className="capability-showcase">
        <TiltCard className="showcase-card">
          <span className="showcase-icon">
            <GitBranch size={20} aria-hidden="true" />
          </span>
          <strong>Visual orchestration</strong>
          <p>
            Compose preprocessing, training, and serving as a validated DAG, then run it with live
            node-level status.
          </p>
        </TiltCard>
        <TiltCard className="showcase-card">
          <span className="showcase-icon">
            <ScanEye size={20} aria-hidden="true" />
          </span>
          <strong>Explainable by default</strong>
          <p>
            Real SHAP and LIME attributions travel with every model, as a first-class pipeline stage
            rather than an afterthought.
          </p>
        </TiltCard>
        <TiltCard className="showcase-card">
          <span className="showcase-icon">
            <Rocket size={20} aria-hidden="true" />
          </span>
          <strong>Deploy &amp; monitor</strong>
          <p>
            Promote a version, serve predictions over REST, and watch drift and degradation raise
            alerts automatically.
          </p>
        </TiltCard>
      </Reveal>
      <Card
        title="Recent experiments"
        subtitle="Execution history and model performance"
        action={
          <Link className="text-link" to="/experiments">
            View all <ArrowUpRight size={14} />
          </Link>
        }
      >
        {runs.length ? (
          <RunsTable runs={runs.slice(0, 6)} />
        ) : (
          <Empty
            title="Your first experiment starts here"
            description="Create a project, upload a CSV, and connect your first machine learning pipeline."
            action={
              <Link
                to={projects.length ? '/datasets' : '/projects'}
                className="button button-secondary"
              >
                {projects.length ? 'Upload a dataset' : 'Create a project'} <ArrowRight size={15} />
              </Link>
            }
          />
        )}
      </Card>
      <div className="two-column">
        <Card title="Execution activity" subtitle="Completed runs in the recent experiment history">
          {timeline.length ? (
            <Timeseries data={timeline} dataKey="completed" label="Completed runs" />
          ) : (
            <Empty
              title="No execution activity yet"
              description="Completed experiments will appear here automatically."
            />
          )}
        </Card>
        <Card
          title="Deployment health"
          subtitle="Models currently serving predictions"
          action={
            <Link className="text-link" to="/deployments">
              Manage <ArrowUpRight size={14} />
            </Link>
          }
        >
          {deployments.data?.length ? (
            <div className="item-list">
              {deployments.data.slice(0, 4).map((deployment) => (
                <Link to="/deployments" className="list-row" key={deployment.id}>
                  <span className="mini-icon">
                    <Rocket size={17} />
                  </span>
                  <div>
                    <strong>{deployment.name}</strong>
                    <small>Model version {deployment.model_version ?? '—'}</small>
                  </div>
                  <Badge status={deployment.status} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="Ready when your model is"
              description="Register a trained model and deploy it to start serving predictions."
            />
          )}
        </Card>
      </div>
      <div className="two-column">
        <Card title="Model performance" subtitle="Evaluation results from registered versions">
          {models.data?.length ? (
            <div className="item-list">
              {models.data.slice(0, 4).map((model) => (
                <Link key={model.id} to={`/models/${model.id}`} className="list-row">
                  <span className="mini-icon">
                    <Box size={17} />
                  </span>
                  <div>
                    <strong>
                      {model.name} <span className="muted">v{model.version}</span>
                    </strong>
                    <small>{title(model.algorithm)}</small>
                  </div>
                  <strong className="mono teal">{percent(model.metrics?.accuracy)}</strong>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="No registered models"
              description="Keep evaluated models in the registry to track their lineage and versions."
            />
          )}
        </Card>
        <Card
          title="Attention needed"
          subtitle="Recent monitoring and execution alerts"
          action={
            <Link to="/alerts" className="text-link">
              Alert center <ArrowUpRight size={14} />
            </Link>
          }
        >
          {data.recent_alerts?.length ? (
            <div className="item-list">
              {data.recent_alerts.slice(0, 4).map((alert) => (
                <Link to="/alerts" key={alert.id} className="list-row">
                  <div>
                    <strong>{alert.message}</strong>
                    <small>{date(alert.created_at)}</small>
                  </div>
                  <Badge status={alert.severity} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="healthy-state">
              <span className="healthy-dot" />
              <strong>All clear</strong>
              <p>No alerts have been raised in this workspace.</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
