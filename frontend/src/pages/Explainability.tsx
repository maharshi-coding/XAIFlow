import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Box, FlaskConical, ScanEye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, scoped } from '../services/api';
import { useWorkspace } from '../hooks/useWorkspace';
import type { RegisteredModel, Run } from '../types/domain';
import { Badge, Card, Empty, ErrorState, Loading, PageHeader } from '../components/ui';
import { ExplanationView } from '../components/ExplanationView';
import { date, shortId, title } from '../utils/format';

export default function Explainability() {
  const { projectId } = useWorkspace();
  const [source, setSource] = useState<'runs' | 'models'>('runs');
  const [selectedId, setSelectedId] = useState('');
  const runs = useQuery({
    queryKey: ['runs', projectId],
    queryFn: () => api<Run[]>(scoped('/runs', projectId)),
  });
  const models = useQuery({
    queryKey: ['models', projectId],
    queryFn: () => api<RegisteredModel[]>(scoped('/models', projectId)),
  });
  const query = source === 'runs' ? runs : models;
  const entries =
    (source === 'runs' ? runs.data : models.data)?.filter(
      (entry) => !!entry.explanations?.length,
    ) ?? [];
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0];
  const displayName = (entry: Run | RegisteredModel) =>
    'version' in entry
      ? `${entry.name} · v${entry.version}`
      : `${entry.pipeline_name || 'Pipeline experiment'} · ${shortId(entry.id)}`;
  return (
    <>
      <PageHeader
        eyebrow="UNDERSTAND YOUR MODELS"
        title="Explainability"
        description="Inspect persisted SHAP and LIME explanations across experiments and registered model versions."
      />
      <div className="tabs page-tabs">
        <button
          aria-pressed={source === 'runs'}
          className={source === 'runs' ? 'active' : ''}
          onClick={() => {
            setSource('runs');
            setSelectedId('');
          }}
        >
          <FlaskConical size={16} />
          Experiments
        </button>
        <button
          aria-pressed={source === 'models'}
          className={source === 'models' ? 'active' : ''}
          onClick={() => {
            setSource('models');
            setSelectedId('');
          }}
        >
          <Box size={16} />
          Model versions
        </button>
      </div>
      {query.isLoading ? (
        <Loading label="Loading stored explanations" />
      ) : query.error ? (
        <ErrorState
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : !selected ? (
        <Card>
          <Empty
            title={`No explained ${source === 'runs' ? 'experiments' : 'model versions'} yet`}
            description="Add a SHAP or LIME stage after training and evaluation, then execute the workflow. Explanations remain linked to their source run and model."
            action={
              <Link to="/pipelines" className="button button-secondary">
                <ScanEye size={15} />
                Open pipeline studio
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="toolbar">
            <div className="select-with-icon">
              <ScanEye size={18} />
              <select
                aria-label="Explanation source"
                value={selected.id}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {displayName(entry)}
                  </option>
                ))}
              </select>
            </div>
            <Link
              className="button button-secondary"
              to={'version' in selected ? `/models/${selected.id}` : `/experiments/${selected.id}`}
            >
              View {'version' in selected ? 'model version' : 'experiment'}{' '}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <Card
            title={displayName(selected)}
            subtitle={`Persisted ${date(selected.created_at)} · ${title('version' in selected ? selected.algorithm : (selected.model_type ?? 'Model'))}`}
          >
            <div className="explanation-source-info">
              <Badge status={selected.status} />
              <span>{selected.explanations?.length} stored explanation(s)</span>
              {'run_id' in selected && (
                <Link className="text-link mono" to={`/experiments/${selected.run_id}`}>
                  Source run {shortId(selected.run_id)} <ArrowUpRight size={12} />
                </Link>
              )}
            </div>
          </Card>
          <ExplanationView key={selected.id} explanations={selected.explanations ?? []} />
        </>
      )}
    </>
  );
}
