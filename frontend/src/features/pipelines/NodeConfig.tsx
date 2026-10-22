import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, GitBranch, Plus, Trash2, X } from 'lucide-react';
import type { Dataset, JsonValue, Parameters } from '../../types/domain';
import type { FlowNode } from './graph';
import { Button, Field, Notice } from '../../components/ui';
import { title } from '../../utils/format';

function ArrayInput({
  value,
  onCommit,
}: {
  value: JsonValue[];
  onCommit: (value: number[]) => void;
}) {
  const [draft, setDraft] = useState(value.join(', '));
  const [invalid, setInvalid] = useState(false);
  const commit = () => {
    const parts = draft.split(',').map((entry) => entry.trim());
    const values = parts.map(Number);
    if (parts.some((part) => !part) || !values.every(Number.isFinite)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onCommit(values);
  };
  return (
    <>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
        aria-invalid={invalid}
        placeholder="32, 16"
      />
      {invalid && <small className="red">Enter comma-separated finite numbers.</small>}
    </>
  );
}

export function NodeConfig({
  node,
  datasets,
  update,
  duplicate,
  remove,
  close,
  connectionOptions,
}: {
  node: FlowNode;
  datasets: Dataset[];
  update: (label: string, parameters: Parameters) => void;
  duplicate: () => void;
  remove: () => void;
  close: () => void;
  connectionOptions?: {
    incoming: FlowNode[];
    outgoing: FlowNode[];
    connect: (source: string, target: string) => void;
  };
}) {
  const [advanced, setAdvanced] = useState(false);
  const [json, setJson] = useState(JSON.stringify(node.data.parameters, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const stageName =
    { pytorch: 'PyTorch Neural Network', shap: 'SHAP Explanation', lime: 'LIME Explanation' }[
      node.data.stage
    ] ?? title(node.data.stage);
  const numericKeys = useRef(new Set(['max_depth']));
  Object.entries(node.data.parameters).forEach(([key, value]) => {
    if (typeof value === 'number') numericKeys.current.add(key);
  });
  function setParameter(key: string, value: JsonValue) {
    update(node.data.label, { ...node.data.parameters, [key]: value });
  }
  const choices = (key: string) =>
    key === 'strategy'
      ? ['mean', 'median', 'most_frequent', 'drop']
      : key === 'method' && node.data.stage === 'encode'
        ? ['onehot', 'ordinal']
        : key === 'method' && node.data.stage === 'scale'
          ? ['standard', 'minmax']
          : key === 'solver'
            ? ['lbfgs', 'liblinear', 'saga']
            : key === 'class_weight'
              ? ['', 'balanced']
              : key === 'explanation_method'
                ? ['', 'shap', 'lime']
                : null;
  return (
    <aside
      className="node-config"
      aria-label="Stage settings"
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <div className="config-heading">
        <div>
          <span className="eyebrow">STAGE SETTINGS</span>
          <h3>{stageName}</h3>
          <span className="config-category">{node.data.category}</span>
        </div>
        <button className="icon-button" onClick={close} aria-label="Close node settings">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="config-content">
        <p className="config-help">Changes stay in your workflow draft until you save or run.</p>
        <Field label="Node label">
          <input
            value={node.data.label}
            onChange={(event) => update(event.target.value, node.data.parameters)}
          />
        </Field>
        {Object.entries(node.data.parameters).map(([key, value]) => (
          <Field
            key={key}
            label={title(key)}
            hint={key === 'random_state' ? 'Fixed seed for reproducible runs.' : undefined}
          >
            {key === 'dataset_id' ? (
              <select
                value={String(value)}
                onChange={(event) => setParameter(key, event.target.value)}
              >
                <option value="">Select dataset</option>
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                    {dataset.target_column ? ` → ${dataset.target_column}` : ' · no target'}
                  </option>
                ))}
              </select>
            ) : typeof value === 'boolean' ? (
              <select
                value={String(value)}
                onChange={(event) => setParameter(key, event.target.value === 'true')}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : choices(key) ? (
              <select
                value={value === null ? '' : String(value)}
                onChange={(event) => setParameter(key, event.target.value || null)}
              >
                {choices(key)!.map((option) => (
                  <option key={option} value={option}>
                    {option ? title(option) : 'None'}
                  </option>
                ))}
              </select>
            ) : Array.isArray(value) ? (
              <ArrayInput
                key={JSON.stringify(value)}
                value={value}
                onCommit={(values) => setParameter(key, values)}
              />
            ) : (
              <input
                type={numericKeys.current.has(key) ? 'number' : 'text'}
                step="any"
                value={value === null ? '' : String(value)}
                onChange={(event) =>
                  setParameter(
                    key,
                    numericKeys.current.has(key)
                      ? event.target.value === ''
                        ? null
                        : Number(event.target.value)
                      : event.target.value,
                  )
                }
              />
            )}
          </Field>
        ))}
        {!Object.keys(node.data.parameters).length && (
          <p className="config-info">
            This stage uses the artifacts produced by its upstream node. No additional parameters
            are required.
          </p>
        )}
        <button
          className="text-link advanced-toggle"
          aria-expanded={advanced}
          aria-controls={`advanced-${node.id}`}
          onClick={() => {
            setAdvanced(!advanced);
            setJson(JSON.stringify(node.data.parameters, null, 2));
          }}
        >
          Advanced parameters
          {advanced ? (
            <ChevronUp size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
        </button>
        {advanced && (
          <div id={`advanced-${node.id}`}>
            <Field label="Parameters JSON">
              <textarea
                className="mono"
                rows={8}
                value={json}
                onChange={(event) => setJson(event.target.value)}
                spellCheck={false}
              />
            </Field>
            <Notice error={error} />
            <Button
              variant="secondary"
              onClick={() => {
                try {
                  const parsed: unknown = JSON.parse(json);
                  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')
                    throw new Error('Parameters must be a JSON object.');
                  update(node.data.label, parsed as Parameters);
                  setError(null);
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : 'Invalid JSON');
                }
              }}
            >
              Apply JSON
            </Button>
          </div>
        )}
        {connectionOptions && (
          <div className="config-connection-editor">
            <h4 className="config-section-label">
              <GitBranch size={16} aria-hidden="true" /> Connections
            </h4>
            <p className="config-help">Connect stages here or use the canvas handles.</p>
            {node.data.stage !== 'dataset' && (
              <>
                <Field label="Connect from stage">
                  <select value={source} onChange={(event) => setSource(event.target.value)}>
                    <option value="">Select an upstream stage</option>
                    {connectionOptions.incoming.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.data.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button
                  variant="secondary"
                  disabled={!source}
                  onClick={() => {
                    connectionOptions.connect(source, node.id);
                    setSource('');
                  }}
                >
                  <Plus size={15} aria-hidden="true" /> Add incoming connection
                </Button>
              </>
            )}
            {node.data.stage !== 'deploy' && (
              <>
                <Field label="Connect to stage">
                  <select value={target} onChange={(event) => setTarget(event.target.value)}>
                    <option value="">Select a downstream stage</option>
                    {connectionOptions.outgoing.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.data.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button
                  variant="secondary"
                  disabled={!target}
                  onClick={() => {
                    connectionOptions.connect(node.id, target);
                    setTarget('');
                  }}
                >
                  <Plus size={15} aria-hidden="true" /> Add outgoing connection
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="config-footer">
        <Button variant="secondary" onClick={duplicate}>
          <Copy size={15} aria-hidden="true" />
          Duplicate
        </Button>
        <Button variant="danger" onClick={remove}>
          <Trash2 size={15} aria-hidden="true" />
          Remove
        </Button>
      </div>
    </aside>
  );
}
