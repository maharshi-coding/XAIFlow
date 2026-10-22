import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArrowRight,
  Clock3,
  Download,
  HardDrive,
  Plus,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, post, scoped } from '../services/api';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAction } from '../hooks/useAction';
import type { Backup, Project } from '../types/domain';
import {
  Button,
  Card,
  Code,
  Empty,
  ErrorState,
  Field,
  Loading,
  Metric,
  Modal,
  Notice,
  PageHeader,
} from '../components/ui';
import { bytes, date, title } from '../utils/format';

interface Restored {
  project_id: string;
  project: Project;
  restored_records: Record<string, number>;
  restored_artifacts: number;
}

export default function Backups() {
  const workspace = useWorkspace();
  const action = useAction();
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [projectId, setProjectId] = useState(workspace.projectId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [restored, setRestored] = useState<Restored | null>(null);
  const query = useQuery({
    queryKey: ['backups', workspace.projectId],
    queryFn: () => api<Backup[]>(scoped('/backups', workspace.projectId)),
  });
  const archiveBytes = query.data?.reduce((total, backup) => total + (backup.size_bytes ?? 0), 0);
  const latestArchive = query.data?.reduce<Backup | undefined>(
    (latest, backup) =>
      !latest || new Date(backup.created_at) > new Date(latest.created_at) ? backup : latest,
    undefined,
  );
  return (
    <>
      <PageHeader
        eyebrow="PRESERVE & RECOVER"
        title="Backups"
        description="Preserve project metadata and artifacts in a verified, portable archive."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                action.clear();
                setRestoreOpen(true);
              }}
            >
              <UploadCloud size={15} />
              Restore archive
            </Button>
            <Button
              disabled={!workspace.projects.length}
              onClick={() => {
                setProjectId(workspace.projectId ?? workspace.projects[0]?.id ?? '');
                setCreateOpen(true);
                action.clear();
              }}
            >
              <Plus size={15} />
              Create backup
            </Button>
          </>
        }
      />
      <Notice error={!createOpen && !restoreOpen ? action.error : null} success={action.success} />
      <div className="backup-banner">
        <ShieldCheck size={24} />
        <div>
          <strong>Complete project recovery</strong>
          <p>
            Archives include metadata, datasets, fitted models, and explanations. Restore creates a
            separate project with remapped IDs.
          </p>
        </div>
      </div>
      {query.data && (
        <div className="summary-grid">
          <Metric
            label="Saved archives"
            value={query.data.length}
            detail={workspace.projectId ? 'For the selected project' : 'Across all projects'}
            icon={<Archive size={19} />}
          />
          <Metric
            label="Archive storage"
            value={bytes(archiveBytes)}
            detail="Compressed project files and metadata"
            icon={<HardDrive size={19} />}
          />
          <Metric
            label="Latest backup"
            value={latestArchive ? date(latestArchive.created_at) : 'None yet'}
            detail={
              latestArchive
                ? (latestArchive.name ?? 'Project archive')
                : 'Create your first archive'
            }
            icon={<Clock3 size={19} />}
          />
        </div>
      )}
      {restored && (
        <Card
          title="Restore completed"
          subtitle={`${restored.project.name} · ${restored.restored_artifacts} verified artifacts restored`}
        >
          <dl className="recovery-grid">
            {Object.entries(restored.restored_records).map(([record, count]) => (
              <div key={record}>
                <dt>{title(record)}</dt>
                <dd>{count.toLocaleString()}</dd>
              </div>
            ))}
            <div>
              <dt>Verified artifacts</dt>
              <dd>{restored.restored_artifacts.toLocaleString()}</dd>
            </div>
          </dl>
          <div className="recovery-actions">
            <Link
              to="/"
              className="button button-primary"
              onClick={() => workspace.selectProject(restored.project_id)}
            >
              Open restored project <ArrowRight size={16} />
            </Link>
          </div>
          <details className="diagnostics-disclosure">
            <summary>View restored record details</summary>
            <Code value={restored.restored_records} />
          </details>
        </Card>
      )}
      <Card title="Backup history" subtitle="Project archives with integrity checks">
        {query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} />
        ) : !query.data?.length ? (
          <Empty
            title="Keep your work recoverable"
            description="Create a backup after a successful experiment to preserve data, models, and execution history."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Archive</th>
                  <th>Project</th>
                  <th>Size</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data.map((backup) => (
                  <tr key={backup.id}>
                    <td>
                      <div className="table-icon">
                        <Archive size={17} />
                        <strong>{backup.name ?? 'Project archive'}</strong>
                      </div>
                    </td>
                    <td>
                      {workspace.projects.find((project) => project.id === backup.project_id)
                        ?.name ?? 'Project'}
                    </td>
                    <td className="mono">{bytes(backup.size_bytes)}</td>
                    <td>{date(backup.created_at)}</td>
                    <td>
                      <a
                        className="button button-secondary"
                        href={`/api/v1/backups/${backup.id}/download`}
                        download
                      >
                        <Download size={14} />
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {createOpen && (
        <Modal title="Create project backup" onClose={() => setCreateOpen(false)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const result = await action.run(
                () => post<Backup>('/backups', { project_id: projectId }),
                'Backup created and checked. Download it from the history below.',
              );
              if (result) setCreateOpen(false);
            }}
          >
            <Field label="Project">
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Select a project
                </option>
                {workspace.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>
            <p className="modal-copy">
              A backup captures the project’s current records and files, including pipeline
              definitions, completed runs, and model artifacts.
            </p>
            <Notice error={action.error} />
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button loading={action.pending} type="submit">
                Create archive
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {restoreOpen && (
        <Modal title="Restore a project archive" onClose={() => setRestoreOpen(false)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!file) return;
              const form = new FormData();
              form.set('file', file);
              const result = await action.run(
                () => post<Restored>('/backups/restore', form),
                'Restore completed. The recovered project is now selected.',
              );
              if (result) {
                workspace.selectProject(result.project_id);
                setRestored(result);
                setRestoreOpen(false);
                setFile(null);
              }
            }}
          >
            <p className="modal-copy">
              The server validates the manifest and artifact checksums before restoring the project.
              Existing projects are preserved.
            </p>
            <label className="upload-zone">
              <UploadCloud size={28} />
              <strong>{file?.name ?? 'Choose a XAIFlow archive'}</strong>
              <span>Verified ZIP backup</span>
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
            </label>
            <Notice error={action.error} />
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setRestoreOpen(false)}>
                Cancel
              </Button>
              <Button loading={action.pending} type="submit" disabled={!file}>
                Validate & restore
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
