import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Brain,
  CircleCheck,
  Database,
  GitBranch,
  Gauge,
  Rocket,
  ScanEye,
  Settings2,
} from 'lucide-react';
import { api } from '../services/api';
import type { CatalogNode } from '../types/domain';
import { Badge, Card, Code, Empty, ErrorState, Loading, PageHeader } from '../components/ui';
import { useWorkspace } from '../hooks/useWorkspace';

export default function Settings() {
  const { projectId, projects, selectProject } = useWorkspace();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<Record<string, unknown>>('/health'),
  });
  const catalog = useQuery({ queryKey: ['nodes'], queryFn: () => api<CatalogNode[]>('/nodes') });
  const categories = Array.from(new Set(catalog.data?.map((node) => node.category)));
  const categoryIcons = {
    Data: Database,
    Preprocessing: GitBranch,
    Models: Brain,
    Evaluation: Gauge,
    Explainability: ScanEye,
    'Model Operations': Rocket,
  };
  return (
    <>
      <PageHeader
        eyebrow="ENVIRONMENT"
        title="Workspace settings"
        description="Inspect the connected runtime and choose your default project scope."
      />
      <div className="two-column">
        <Card title="Project preferences" subtitle="Saved in this browser">
          <div className="pad">
            <label className="field">
              <span>Project scope</span>
              <select
                value={projectId ?? ''}
                onChange={(event) => selectProject(event.target.value || null)}
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="settings-note">
              The project scope filters datasets, pipelines, experiments, models, deployments,
              alerts, and backups.
            </p>
          </div>
        </Card>
        <Card title="Runtime health" subtitle="Live database and API connectivity">
          {health.isLoading ? (
            <Loading />
          ) : health.error ? (
            <ErrorState error={health.error} />
          ) : (
            <>
              <div className="runtime-summary">
                <CircleCheck size={19} />
                <div>
                  <strong>API connected</strong>
                  <p>Metadata persistence available</p>
                </div>
                <Badge status="ready" />
              </div>
              <details className="diagnostics-disclosure">
                <summary>View runtime diagnostics</summary>
                <Code value={health.data} />
              </details>
            </>
          )}
        </Card>
      </div>
      <Card
        title="Execution capabilities"
        subtitle="Reusable stages returned by the connected backend"
      >
        {catalog.isLoading ? (
          <Loading label="Loading execution capabilities" />
        ) : catalog.error ? (
          <ErrorState
            error={catalog.error}
            retry={() => {
              void catalog.refetch();
            }}
          />
        ) : !categories.length ? (
          <Empty
            title="No execution stages available"
            description="The connected backend has not returned any pipeline capabilities."
          />
        ) : (
          <div className="capability-groups">
            {categories.map((category) => {
              const stages = catalog.data?.filter((node) => node.category === category) ?? [];
              const Icon = categoryIcons[category as keyof typeof categoryIcons] ?? Settings2;
              return (
                <section key={category} aria-label={`${category} capabilities`}>
                  <div className="capability-group-heading">
                    <h3>{category}</h3>
                    <span>
                      {stages.length} {stages.length === 1 ? 'stage' : 'stages'}
                    </span>
                  </div>
                  <div className="capability-grid">
                    {stages.map((node) => (
                      <div key={node.type}>
                        <Icon size={18} aria-hidden="true" />
                        <strong>{node.label}</strong>
                        <span>{node.description ?? node.category}</span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Card>
      <Card
        title="Application configuration"
        subtitle="Runtime settings are provided through environment variables"
      >
        <div className="pad">
          <p className="settings-note">
            Database URL, artifact storage, upload limits, CORS origins, and worker settings are
            configured on the server. The API reference documents request schemas and available
            endpoints.
          </p>
          <a className="button button-secondary" href="/docs" target="_blank" rel="noreferrer">
            Open API reference <ArrowUpRight size={15} />
          </a>
        </div>
      </Card>
    </>
  );
}
