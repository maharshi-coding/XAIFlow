export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type Parameters = Record<string, JsonValue>;
export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at?: string;
  status?: string;
}
export interface ColumnStat {
  name: string;
  dtype: string;
  missing: number;
  unique: number;
}
export interface DatasetStatistics {
  missing_values: number;
  numeric: Record<string, Record<string, number | null>>;
  class_distribution: Record<string, number>;
}
export interface Dataset {
  id: string;
  project_id: string;
  name: string;
  filename?: string;
  row_count: number;
  column_count: number;
  target_column: string | null;
  columns: ColumnStat[];
  preview?: Record<string, JsonValue>[];
  statistics?: DatasetStatistics;
  checksum?: string;
  created_at: string;
}
export interface PipelineNode {
  id: string;
  type: string;
  label: string;
  parameters: Parameters;
  position: { x: number; y: number };
}
export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
}
export interface Definition {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}
export interface Pipeline {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  definition: Definition;
  created_at: string;
  updated_at?: string;
  version?: number;
}
export interface CatalogNode {
  type: string;
  label: string;
  category: string;
  description?: string;
  defaults?: Parameters;
  parameters?: Parameters;
  schema?: Record<string, unknown>;
}
export interface ValidationIssue {
  node_id?: string;
  code: string;
  message: string;
}
export interface Validation {
  valid: boolean;
  errors: ValidationIssue[];
  order?: string[];
}
export interface FeatureContribution {
  feature: string;
  value?: JsonValue;
  contribution?: number;
  importance?: number;
}
export interface Explanation {
  method: string;
  explainer?: string;
  scope?: string;
  sample_index?: number;
  prediction?: JsonValue;
  predicted_class?: JsonValue;
  probability?: number;
  confidence?: number;
  contributions?: FeatureContribution[];
  feature_contributions?: FeatureContribution[];
  features?: FeatureContribution[];
  global_importance?: FeatureContribution[];
  local?: Explanation[];
  global?: FeatureContribution[];
  [key: string]: unknown;
}
export interface NodeRun {
  id?: string;
  node_id: string;
  node_type?: string;
  label?: string;
  status: string;
  started_at?: string;
  finished_at?: string;
  duration?: number;
  error?: string;
  output?: Parameters;
}
export interface LogEntry {
  timestamp?: string;
  level?: string;
  message: string;
  node_id?: string;
}
export interface Artifact {
  id?: string;
  name?: string;
  type?: string;
  kind?: string;
  path?: string;
  url?: string;
  download_url?: string;
  size_bytes?: number;
}
export interface Metrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  roc_auc?: number | null;
  confusion_matrix?: number[][];
  classes?: JsonValue[];
  roc_curve?: { fpr: number[]; tpr: number[] };
  class_distribution?: Record<string, number>;
  prediction_distribution?: Record<string, number>;
  [key: string]: JsonValue | undefined;
}
export interface Run {
  id: string;
  project_id: string;
  pipeline_id: string;
  pipeline_name?: string;
  dataset_id?: string;
  dataset_name?: string;
  model_type?: string;
  status: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  duration?: number;
  error?: string;
  metrics: Metrics;
  node_runs?: NodeRun[];
  logs?: (LogEntry | string)[];
  explanations?: Explanation[];
  artifacts?: Artifact[];
  definition?: Definition;
  parameters?: Parameters;
  preprocessing?: Parameters[];
  model_id?: string;
  environment?: Parameters;
  result?: {
    training_history?: { epoch: number; loss: number; accuracy?: number }[];
    training_duration?: number;
  };
}
export interface RegisteredModel {
  id: string;
  project_id: string;
  name: string;
  version: number;
  algorithm: string;
  framework: string;
  status: string;
  run_id: string;
  dataset_id?: string;
  pipeline_id?: string;
  created_at: string;
  metrics: Metrics;
  parameters?: Parameters;
  artifact_path?: string;
  explanations?: Explanation[];
  deployment_history?: Deployment[];
  deployments?: Deployment[];
  preprocessing?: Parameters[];
  input_schema?: ColumnStat[];
  baseline?: Parameters;
}
export interface Deployment {
  id: string;
  project_id: string;
  model_id: string;
  name: string;
  status: string;
  created_at: string;
  model_name?: string;
  model_version?: number;
  explanation_method?: string;
  feature_names?: string[];
  example_input?: Record<string, JsonValue>;
  endpoint?: string;
  predict_url?: string;
  model?: RegisteredModel;
  drift_threshold?: number;
  degradation_threshold?: number;
}
export interface Prediction {
  prediction: JsonValue;
  probabilities: Record<string, number>;
  confidence: number;
  explanation?: Explanation;
}
export interface PredictionResponse {
  predictions: Prediction[];
  model_id?: string;
  model_version?: number;
  latency_ms?: number;
  request_id?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface MonitoringPoint {
  created_at: string;
  request_count?: number;
  avg_latency_ms?: number;
  error_count?: number;
  drift_score?: number;
  [key: string]: unknown;
}
export interface DriftFeature {
  feature: string;
  psi: number;
  baseline_mean?: number;
  current_mean?: number;
  threshold?: number;
  drifted?: boolean;
}
export interface Monitoring {
  deployment_id: string;
  request_count: number;
  prediction_count?: number;
  avg_latency_ms: number;
  error_count: number;
  error_rate?: number;
  prediction_distribution?: Record<string, number>;
  history?: MonitoringPoint[];
  features?: DriftFeature[];
  drift_score?: number;
  drift_threshold?: number;
  baseline?: Parameters;
  performance?: Metrics;
  accuracy?: number;
  baseline_accuracy?: number;
  degradation?: number;
  alerts?: Alert[];
  [key: string]: unknown;
}
export interface Alert {
  id: string;
  project_id: string;
  deployment_id?: string;
  run_id?: string;
  kind?: string;
  type?: string;
  severity: string;
  status: string;
  message: string;
  created_at: string;
  details?: Parameters;
  title?: string;
  description?: string;
  source?: string;
  metric?: string;
  threshold?: number | null;
  observed_value?: number | null;
}
export interface Backup {
  id: string;
  project_id: string;
  created_at: string;
  name?: string;
  size_bytes?: number;
  status?: string;
  manifest?: Parameters;
}
export interface Overview {
  counts: Record<string, number>;
  recent_runs: Run[];
  recent_alerts: Alert[];
  projects?: Project[];
  model_performance?: RegisteredModel[];
  deployments?: Deployment[];
}
