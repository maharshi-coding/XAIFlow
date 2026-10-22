import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  BrainCircuit,
  Check,
  Circle,
  Database,
  Gauge,
  GitBranch,
  Layers3,
  LoaderCircle,
  Rocket,
  ScanEye,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';
import type { FlowNode } from './graph';
import { title } from '../../utils/format';

export function StageNode({ data, selected }: NodeProps<FlowNode>) {
  const Icon =
    data.stage === 'dataset'
      ? Database
      : data.stage === 'split'
        ? GitBranch
        : ['logistic_regression', 'random_forest', 'pytorch'].includes(data.stage)
          ? BrainCircuit
          : data.stage === 'evaluate'
            ? Gauge
            : ['shap', 'lime'].includes(data.stage)
              ? ScanEye
              : data.stage === 'register'
                ? Layers3
                : data.stage === 'deploy'
                  ? Rocket
                  : SlidersHorizontal;
  const configured = data.stage !== 'dataset' || !!data.parameters.dataset_id;
  const detail =
    data.stage === 'split'
      ? `${Math.round(Number(data.parameters.test_size ?? 0.2) * 100)}% holdout · seed ${data.parameters.random_state ?? 42}`
      : data.stage === 'random_forest'
        ? `${data.parameters.n_estimators ?? 100} trees · depth ${data.parameters.max_depth ?? 'unlimited'}`
        : data.stage === 'pytorch'
          ? `${data.parameters.epochs ?? 30} epochs · ${Array.isArray(data.parameters.hidden_dims) ? data.parameters.hidden_dims.join(' → ') : 'Neural layers'}`
          : data.stage === 'logistic_regression'
            ? `${data.parameters.solver ?? 'lbfgs'} · C = ${data.parameters.C ?? 1}`
            : data.stage === 'impute'
              ? `${title(String(data.parameters.strategy ?? 'median'))} imputation`
              : ['encode', 'scale'].includes(data.stage)
                ? title(String(data.parameters.method ?? 'Default transformation'))
                : data.stage === 'select'
                  ? `${data.parameters.k ?? 5} selected features`
                  : data.stage === 'shap'
                    ? `Sample ${data.parameters.sample_index ?? 0} · global attribution`
                    : data.stage === 'lime'
                      ? `Sample ${data.parameters.sample_index ?? 0} · local attribution`
                      : data.stage === 'evaluate'
                        ? 'Held-out classification metrics'
                        : data.stage === 'dataset'
                          ? configured
                            ? 'Dataset source selected'
                            : 'Choose a dataset in settings'
                          : String(data.parameters.name ?? 'Model operations');
  return (
    <div
      className={`stage-node ${selected ? 'stage-selected' : ''} ${data.invalid ? 'stage-invalid' : ''} stage-${data.status ?? 'idle'}`}
    >
      {data.stage !== 'dataset' && (
        <Handle type="target" position={Position.Left} aria-label="Input connection" />
      )}
      <div className="stage-heading">
        <span className={`stage-icon category-${data.category.toLowerCase().replace(/ /g, '-')}`}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="stage-category">{data.category}</span>
        {data.status === 'running' && (
          <LoaderCircle size={16} className="spin teal" aria-hidden="true" />
        )}
        {data.status === 'completed' && <Check size={16} className="teal" aria-hidden="true" />}
        {(data.invalid || data.status === 'failed') && (
          <TriangleAlert size={16} className="red" aria-hidden="true" />
        )}
      </div>
      <strong className="stage-title">{data.label}</strong>
      <span className="stage-detail">{detail}</span>
      <div className="stage-meta">
        {data.invalid ? (
          <>
            <TriangleAlert size={12} aria-hidden="true" /> Needs attention
          </>
        ) : data.status && data.status !== 'idle' ? (
          <>
            <Circle size={7} fill="currentColor" aria-hidden="true" />
            {title(data.status)}
          </>
        ) : (
          <>
            <span className={configured ? 'configured-dot' : 'unconfigured-dot'} />
            {configured ? 'Ready to configure' : 'Dataset required'}
          </>
        )}
      </div>
      {data.stage !== 'deploy' && (
        <Handle type="source" position={Position.Right} aria-label="Output connection" />
      )}
    </div>
  );
}
