import { describe, expect, it } from 'vitest';
import { createStage, fromFlow, starterDefinition, toFlow } from './graph';
import type { CatalogNode, Definition } from '../../types/domain';

const catalog: CatalogNode[] = [
  { type: 'dataset', label: 'Dataset Input', category: 'Data', parameters: { dataset_id: '' } },
  {
    type: 'split',
    label: 'Split',
    category: 'Preprocessing',
    parameters: { test_size: 0.2, random_state: 42 },
  },
  {
    type: 'random_forest',
    label: 'Random Forest',
    category: 'Models',
    parameters: { n_estimators: 100 },
  },
  {
    type: 'pytorch',
    label: 'Neural Network',
    category: 'Models',
    parameters: { hidden_dims: [32, 16] },
  },
  { type: 'evaluate', label: 'Evaluate', category: 'Evaluation', parameters: {} },
  { type: 'shap', label: 'SHAP', category: 'Explainability', parameters: { sample_index: 0 } },
  { type: 'lime', label: 'LIME', category: 'Explainability', parameters: { sample_index: 0 } },
  {
    type: 'register',
    label: 'Register',
    category: 'Model Operations',
    parameters: { name: 'Classifier' },
  },
];

describe('portable pipeline definitions', () => {
  it('round-trips the portable DAG without leaking UI selection or execution state', () => {
    const definition: Definition = {
      nodes: [
        {
          id: 'data',
          type: 'dataset',
          label: 'Source',
          parameters: { dataset_id: 'real-id' },
          position: { x: 12, y: 24 },
        },
        {
          id: 'train',
          type: 'random_forest',
          label: 'Classifier',
          parameters: { n_estimators: 200 },
          position: { x: 240, y: 24 },
        },
      ],
      edges: [{ id: 'connection', source: 'data', target: 'train' }],
    };
    const graph = toFlow(definition, catalog);
    graph.nodes[0].selected = true;
    graph.nodes[0].data.status = 'completed';
    expect(fromFlow(graph.nodes, graph.edges)).toEqual(definition);
  });
  it('retains dataset, algorithm, and registry configuration in a connected starter workflow', () => {
    const definition = starterDefinition(
      catalog,
      'uploaded-dataset',
      'random_forest',
      'Churn model',
    );
    expect(definition.nodes[0].parameters.dataset_id).toBe('uploaded-dataset');
    expect(
      definition.nodes.find((node) => node.type === 'random_forest')?.parameters.n_estimators,
    ).toBe(100);
    expect(definition.nodes.at(-1)?.parameters.name).toBe('Churn model');
    expect(definition.edges).toHaveLength(definition.nodes.length - 1);
    expect(
      definition.edges.every(
        (edge, index) =>
          edge.source === definition.nodes[index].id &&
          edge.target === definition.nodes[index + 1].id,
      ),
    ).toBe(true);
  });
  it('uses local LIME for the neural network and gives each added node independent defaults', () => {
    const definition = starterDefinition(catalog, 'dataset', 'pytorch', 'Network');
    expect(definition.nodes.some((node) => node.type === 'lime')).toBe(true);
    expect(definition.nodes.some((node) => node.type === 'shap')).toBe(false);
    const first = createStage(catalog[3], { x: 0, y: 0 });
    const second = createStage(catalog[3], { x: 0, y: 0 });
    (first.data.parameters.hidden_dims as number[]).push(8);
    expect(second.data.parameters.hidden_dims).toEqual([32, 16]);
    expect(first.id).not.toBe(second.id);
  });
});
