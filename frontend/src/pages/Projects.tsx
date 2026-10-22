import { useState } from 'react';
import { ArrowRight, Check, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAction } from '../hooks/useAction';
import { patch, post, remove } from '../services/api';
import type { Project } from '../types/domain';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorState,
  Field,
  Loading,
  Modal,
  Notice,
  PageHeader,
} from '../components/ui';
import { date } from '../utils/format';

export default function Projects() {
  const workspace = useWorkspace();
  const action = useAction();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Project | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const openForm = (project: Project | 'new') => {
    setEditing(project);
    setName(project === 'new' ? '' : project.name);
    setDescription(project === 'new' ? '' : project.description);
    action.clear();
  };
  const save = async () => {
    const result = await action.run(
      () =>
        editing === 'new'
          ? post<Project>('/projects', { name, description })
          : patch<Project>(`/projects/${(editing as Project).id}`, { name, description }),
      'Project saved.',
    );
    if (result) {
      setEditing(null);
      workspace.selectProject(result.id);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="ORGANIZE"
        title="Projects"
        description="A home for your datasets, pipelines, models, and experiments."
        actions={
          <Button onClick={() => openForm('new')}>
            <Plus size={16} />
            New project
          </Button>
        }
      />
      <Notice error={!editing && !deleting ? action.error : null} success={action.success} />
      {workspace.loading ? (
        <Loading />
      ) : workspace.error ? (
        <ErrorState error={workspace.error} retry={workspace.refresh} />
      ) : workspace.projects.length ? (
        <div className="project-grid">
          {workspace.projects.map((project) => (
            <Card
              key={project.id}
              className={`project-card ${workspace.projectId === project.id ? 'project-card-selected' : ''}`}
            >
              <div className="project-card-top">
                <span className="project-icon">
                  <FolderOpen size={23} />
                </span>
                <div className="project-status">
                  {workspace.projectId === project.id && (
                    <span className="scope-tag">
                      <Check size={13} aria-hidden="true" />
                      Selected workspace
                    </span>
                  )}
                  <Badge status={project.status ?? 'active'} />
                </div>
              </div>
              <h2>{project.name}</h2>
              <p>{project.description || 'No description added.'}</p>
              <small>Created {date(project.created_at)}</small>
              <div className="project-card-bottom">
                <Button
                  variant="ghost"
                  onClick={() => {
                    workspace.selectProject(project.id);
                    navigate('/');
                  }}
                >
                  Open project <ArrowRight size={16} />
                </Button>
                <div>
                  <button
                    className="icon-button"
                    aria-label={`Edit ${project.name}`}
                    onClick={() => openForm(project)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button destructive"
                    aria-label={`Delete ${project.name}`}
                    onClick={() => {
                      action.clear();
                      setDeleting(project);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            title="Create your first project"
            description="Keep each workflow organized with its own datasets, experiments, and model versions."
            action={
              <Button onClick={() => openForm('new')}>
                <Plus size={16} />
                New project
              </Button>
            }
          />
        </Card>
      )}
      {editing && (
        <Modal
          title={editing === 'new' ? 'Create a project' : 'Edit project'}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Field label="Project name">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={120}
                placeholder="e.g. Customer churn"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="What are you exploring?"
              />
            </Field>
            <Notice error={action.error} />
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={action.pending}>
                {editing === 'new' ? 'Create project' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete project" onClose={() => setDeleting(null)}>
          <p className="modal-copy">
            Delete <strong>{deleting.name}</strong> and all of its datasets, pipelines, runs,
            models, and deployments? This operation cannot be undone.
          </p>
          <Notice error={action.error} />
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={action.pending}
              onClick={async () => {
                const deleted = await action.run(async () => {
                  await remove(`/projects/${deleting.id}`);
                  return true;
                }, 'Project deleted.');
                if (deleted) setDeleting(null);
              }}
            >
              Delete project
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
