import type { Node, Edge } from '@xyflow/react';
import type { CatalogNode, Definition, Parameters, PipelineNode } from '../../types/domain';

export interface FlowData extends Record<string, unknown> {
  stage: string;
  label: string;
  parameters: Parameters;
  category: string;
  status?: string;
  invalid?: boolean;
}
export type FlowNode = Node<FlowData, 'stage'>;
export function toFlow(
  definition: Definition,
  catalog: CatalogNode[],
): { nodes: FlowNode[]; edges: Edge[] } {
  return {
    nodes: definition.nodes.map((node) => ({
      id: node.id,
      type: 'stage',
      position: node.position,
      data: {
        stage: node.type,
        label: node.label,
        parameters: node.parameters,
        category: catalog.find((item) => item.type === node.type)?.category ?? 'Stage',
      },
    })),
    edges: definition.edges.map((edge) => ({ ...edge, type: 'smoothstep' })),
  };
}
export function fromFlow(nodes: FlowNode[], edges: Edge[]): Definition {
  return {
    nodes: nodes.map((node): PipelineNode => ({
      id: node.id,
      type: node.data.stage,
      label: node.data.label,
      parameters: node.data.parameters,
      position: node.position,
    })),
    edges: edges.map(({ id, source, target }) => ({ id, source, target })),
  };
}
export function createStage(item: CatalogNode, position: { x: number; y: number }): FlowNode {
  return {
    id: crypto.randomUUID(),
    type: 'stage',
    position,
    data: {
      stage: item.type,
      label: item.label,
      category: item.category,
      parameters: structuredClone(item.defaults ?? item.parameters ?? {}),
    },
  };
}
export function starterDefinition(
  catalog: CatalogNode[],
  datasetId: string,
  algorithm: string,
  modelName: string,
): Definition {
  const stages = [
    'dataset',
    'impute',
    'encode',
    'scale',
    'split',
    algorithm,
    'evaluate',
    algorithm === 'pytorch' ? 'lime' : 'shap',
    'register',
  ];
  const nodes = stages.flatMap((type, index) => {
    const item = catalog.find((entry) => entry.type === type);
    if (!item) return [];
    const node = createStage(item, {
      x: 80 + (index % 3) * 300,
      y: 80 + Math.floor(index / 3) * 175,
    });
    if (type === 'dataset') node.data.parameters.dataset_id = datasetId;
    if (type === 'register') node.data.parameters.name = modelName;
    return [node];
  });
  return fromFlow(
    nodes,
    nodes.slice(1).map((node, index) => ({
      id: crypto.randomUUID(),
      source: nodes[index].id,
      target: node.id,
    })),
  );
}
