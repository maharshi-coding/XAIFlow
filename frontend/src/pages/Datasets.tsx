import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Database, FileText, Table2, UploadCloud } from 'lucide-react';
import { DistributionChart } from '../components/charts';
import { FeatureDistribution } from '../components/FeatureDistribution';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAction } from '../hooks/useAction';
import { api, patch, post, scoped } from '../services/api';
import type { Dataset } from '../types/domain';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  Field,
  Loading,
  Metric,
  Modal,
  Notice,
  PageHeader,
} from '../components/ui';
import { date } from '../utils/format';

export default function Datasets() {
  const { projectId, projects } = useWorkspace();
  const action = useAction();
  const [selected, setSelected] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProject, setUploadProject] = useState(projectId ?? '');
  const [target, setTarget] = useState('');
  const [tab, setTab] = useState('preview');
  const viewId = useId();
  const datasets = useQuery({
    queryKey: ['datasets', projectId],
    queryFn: () => api<Dataset[]>(scoped('/datasets', projectId)),
  });
  const selectedId = datasets.data?.some((dataset) => dataset.id === selected)
    ? selected
    : datasets.data?.[0]?.id;
  const detail = useQuery({
    queryKey: ['dataset', selectedId],
    queryFn: () => api<Dataset>(`/datasets/${selectedId}`),
    enabled: !!selectedId,
  });
  const data = detail.data;
  const upload = async () => {
    if (!file || !uploadProject) return;
    const form = new FormData();
    form.set('file', file);
    form.set('project_id', uploadProject);
    if (target.trim()) form.set('target_column', target.trim());
    const result = await action.run(
      () => post<Dataset>('/datasets', form),
      'Dataset uploaded. Select the target before training.',
    );
    if (result) {
      setSelected(result.id);
      setUploadOpen(false);
      setFile(null);
    }
  };
  const classDistribution = Object.entries(data?.statistics?.class_distribution ?? {}).map(
    ([label, count]) => ({ label, count }),
  );
  return (
    <>
      <PageHeader
        eyebrow="DATA WORKBENCH"
        title="Datasets"
        description="Inspect immutable source data and choose what your model will predict."
        actions={
          <Button
            onClick={() => {
              setUploadProject(projectId ?? projects[0]?.id ?? '');
              setUploadOpen(true);
              action.clear();
            }}
            disabled={!projects.length}
          >
            <UploadCloud size={16} />
            Upload CSV
          </Button>
        }
      />
      <Notice error={!uploadOpen ? action.error : null} success={action.success} />
      {datasets.isLoading ? (
        <Loading />
      ) : datasets.error ? (
        <ErrorState
          error={datasets.error}
          retry={() => {
            void datasets.refetch();
          }}
        />
      ) : !datasets.data?.length ? (
        <Card>
          <Empty
            title="Bring your data into focus"
            description={
              projects.length
                ? 'Upload a CSV to inspect its columns, missing values, and target distribution.'
                : 'Create a project first, then upload a CSV dataset.'
            }
            action={
              projects.length ? (
                <Button
                  onClick={() => {
                    setUploadProject(projectId ?? projects[0].id);
                    setUploadOpen(true);
                  }}
                >
                  <UploadCloud size={16} />
                  Upload CSV
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="toolbar">
            <div className="select-with-icon">
              <Database size={17} />
              <select
                aria-label="Select dataset"
                value={selectedId}
                onChange={(event) => setSelected(event.target.value)}
              >
                {datasets.data.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
            </div>
            {data && <span className="muted">Uploaded {date(data.created_at)}</span>}
          </div>
          {detail.isLoading ? (
            <Loading />
          ) : detail.error ? (
            <ErrorState error={detail.error} />
          ) : (
            data && (
              <>
                <section className="resource-summary" aria-label="Selected dataset">
                  <span className="resource-icon" aria-hidden="true">
                    <FileText size={24} />
                  </span>
                  <div className="resource-copy">
                    <h2>{data.name}</h2>
                    <div className="resource-meta">
                      <span>
                        {projects.find((project) => project.id === data.project_id)?.name ??
                          'Project dataset'}
                      </span>
                      <span>
                        {data.row_count.toLocaleString()} rows · {data.column_count} columns
                      </span>
                      <span>Source CSV preserved</span>
                    </div>
                  </div>
                  <span className="resource-tag">
                    {data.target_column ? `Target: ${data.target_column}` : 'Target not selected'}
                  </span>
                </section>
                <div className="metrics-grid">
                  <Metric
                    label="Rows"
                    value={data.row_count.toLocaleString()}
                    detail="Original data preserved"
                    icon={<Table2 size={18} />}
                  />
                  <Metric
                    label="Columns"
                    value={data.column_count}
                    detail={`${Object.keys(data.statistics?.numeric ?? {}).length} numeric features`}
                    icon={<Database size={18} />}
                  />
                  <Metric
                    label="Missing values"
                    value={
                      data.statistics?.missing_values ??
                      data.columns.reduce((count, column) => count + column.missing, 0)
                    }
                    detail="Handle with a preprocessing node"
                    icon={<FileText size={18} />}
                  />
                  <div className="metric target-metric">
                    <span>TARGET COLUMN</span>
                    <select
                      aria-label="Target column"
                      value={data.target_column ?? ''}
                      onChange={(event) => {
                        void action.run(
                          () =>
                            patch(`/datasets/${data.id}`, { target_column: event.target.value }),
                          'Target updated.',
                        );
                      }}
                      disabled={action.pending}
                    >
                      <option value="" disabled>
                        Select a target
                      </option>
                      {data.columns.map((column) => (
                        <option key={column.name} value={column.name}>
                          {column.name}
                        </option>
                      ))}
                    </select>
                    <small>The label your model will learn</small>
                  </div>
                </div>
                <Card>
                  <div className="tabs" role="group" aria-label="Dataset view">
                    <button
                      type="button"
                      className={tab === 'preview' ? 'active' : ''}
                      aria-pressed={tab === 'preview'}
                      aria-controls={viewId}
                      onClick={() => setTab('preview')}
                    >
                      <Table2 size={16} />
                      Data preview
                    </button>
                    <button
                      type="button"
                      className={tab === 'statistics' ? 'active' : ''}
                      aria-pressed={tab === 'statistics'}
                      aria-controls={viewId}
                      onClick={() => setTab('statistics')}
                    >
                      <BarChart3 size={16} />
                      Column statistics
                    </button>
                  </div>
                  <div
                    id={viewId}
                    role="region"
                    aria-label={tab === 'preview' ? 'Data preview' : 'Column statistics'}
                  >
                    {tab === 'preview' ? (
                      <>
                        <div className="table-scroll">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                {data.columns.map((column) => (
                                  <th
                                    key={column.name}
                                    scope="col"
                                    className={
                                      column.name === data.target_column ? 'target-column' : ''
                                    }
                                  >
                                    {column.name}
                                    <small className="cell-sub">
                                      {column.dtype}
                                      {column.name === data.target_column ? ' · target' : ''}
                                    </small>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {data.preview?.map((row, index) => (
                                <tr key={index}>
                                  <td className="muted mono">{index + 1}</td>
                                  {data.columns.map((column) => (
                                    <td
                                      className={`mono ${column.name === data.target_column ? 'target-column' : ''}`}
                                      key={column.name}
                                      title={String(row[column.name] ?? 'null')}
                                    >
                                      {row[column.name] === null ? (
                                        <span className="missing">null</span>
                                      ) : typeof row[column.name] === 'number' ? (
                                        Number(row[column.name]).toLocaleString(undefined, {
                                          ...(Number.isInteger(row[column.name])
                                            ? {}
                                            : { maximumSignificantDigits: 5 }),
                                        })
                                      ) : (
                                        String(row[column.name] ?? '')
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="table-footer">
                          Showing first {data.preview?.length ?? 0} of{' '}
                          {data.row_count.toLocaleString()} rows. Source data stays immutable.
                        </div>
                      </>
                    ) : (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Column</th>
                              <th>Type</th>
                              <th>Missing</th>
                              <th>Unique</th>
                              <th>Mean</th>
                              <th>Std. dev.</th>
                              <th>Min</th>
                              <th>Max</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.columns.map((column) => {
                              const stats = data.statistics?.numeric?.[column.name];
                              return (
                                <tr key={column.name}>
                                  <td
                                    className={
                                      column.name === data.target_column ? 'target-column' : ''
                                    }
                                  >
                                    <strong>{column.name}</strong>
                                    {column.name === data.target_column && (
                                      <small className="cell-sub">Target column</small>
                                    )}
                                  </td>
                                  <td className="mono muted">{column.dtype}</td>
                                  <td>{column.missing}</td>
                                  <td>{column.unique}</td>
                                  {['mean', 'std', 'min', 'max'].map((key) => (
                                    <td className="mono" key={key}>
                                      {typeof stats?.[key] === 'number'
                                        ? stats[key]?.toFixed(3)
                                        : '—'}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </Card>
                {classDistribution.length > 0 && (
                  <Card
                    title="Target distribution"
                    subtitle={`Class counts for ${data.target_column}`}
                  >
                    <DistributionChart
                      data={classDistribution}
                      label={`Full target distribution for ${data.target_column}`}
                    />
                  </Card>
                )}
                <FeatureDistribution key={data.id} dataset={data} />
              </>
            )
          )}
        </>
      )}
      {uploadOpen && (
        <Modal title="Upload a dataset" onClose={() => setUploadOpen(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void upload();
            }}
          >
            <Field label="Project">
              <select
                value={uploadProject}
                onChange={(event) => setUploadProject(event.target.value)}
                required
              >
                <option value="" disabled>
                  Choose a project
                </option>
                {projects.map((project) => (
                  <option value={project.id} key={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="upload-zone">
              <UploadCloud size={30} />
              <strong>{file ? file.name : 'Choose a CSV file'}</strong>
              <span>Tabular data · original file stays unchanged</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
            </label>
            <Field
              label="Target column (optional)"
              hint="You can select the target after inspecting the dataset."
            >
              <input
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="e.g. churn"
              />
            </Field>
            <Notice error={action.error} />
            <div className="form-actions">
              <Button variant="secondary" type="button" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!file || !uploadProject} loading={action.pending}>
                Upload dataset
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
