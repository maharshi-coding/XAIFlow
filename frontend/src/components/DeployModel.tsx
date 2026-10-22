import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '../services/api';
import { useAction } from '../hooks/useAction';
import type { Deployment, RegisteredModel } from '../types/domain';
import { Button, Field, Modal, Notice } from './ui';

export function DeployModel({
  models,
  initialModel,
  onClose,
}: {
  models: RegisteredModel[];
  initialModel?: string;
  onClose: () => void;
}) {
  const [modelId, setModelId] = useState(
    initialModel ?? models.find((model) => model.status !== 'archived')?.id ?? '',
  );
  const [name, setName] = useState('');
  const [explanation, setExplanation] = useState('lime');
  const [drift, setDrift] = useState(0.2);
  const [degradation, setDegradation] = useState(0.1);
  const action = useAction();
  const navigate = useNavigate();
  return (
    <Modal title="Deploy a model" onClose={onClose}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const deployment = await action.run(() =>
            post<Deployment>('/deployments', {
              model_id: modelId,
              name,
              explanation_method: explanation || null,
              drift_threshold: drift,
              degradation_threshold: degradation,
            }),
          );
          if (deployment) {
            onClose();
            navigate(`/deployments?id=${deployment.id}`);
          }
        }}
      >
        <p className="modal-copy">
          Serve a fitted model with its saved preprocessing and monitor every prediction request.
        </p>
        <Field label="Model version">
          <select value={modelId} onChange={(event) => setModelId(event.target.value)} required>
            <option value="" disabled>
              Select a registered model
            </option>
            {models
              .filter((model) => model.status !== 'archived')
              .map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} · v{model.version}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Deployment name">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Churn prediction API"
            required
          />
        </Field>
        <Field label="Default explanation method">
          <select value={explanation} onChange={(event) => setExplanation(event.target.value)}>
            <option value="lime">LIME</option>
            <option value="shap">SHAP</option>
            <option value="">On request only</option>
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Drift threshold (PSI)">
            <input
              type="number"
              step="0.05"
              min="0.01"
              max="5"
              value={drift}
              onChange={(event) => setDrift(Number(event.target.value))}
              required
            />
          </Field>
          <Field label="Degradation threshold">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="1"
              value={degradation}
              onChange={(event) => setDegradation(Number(event.target.value))}
              required
            />
          </Field>
        </div>
        <Notice error={action.error} />
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={action.pending} disabled={!modelId}>
            Create deployment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
