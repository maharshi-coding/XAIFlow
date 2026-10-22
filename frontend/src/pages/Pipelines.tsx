import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  Boxes,
  CheckCircle2,
  ChevronDown,
  CirclePlay,
  Database,
  GitBranch,
  Maximize2,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Save,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAction } from '../hooks/useAction';
import { api, patch, post, remove, scoped } from '../services/api';
import type { CatalogNode, Dataset, Pipeline, Run, Validation } from '../types/domain';
import { Button, Empty, Field, Loading, Modal, Notice, PageHeader } from '../components/ui';
import {
  createStage,
  fromFlow,
  starterDefinition,
  toFlow,
  type FlowNode,
} from '../features/pipelines/graph';
import { StageNode } from '../features/pipelines/StageNode';
import { NodeConfig } from '../features/pipelines/NodeConfig';
import { RunPanel } from '../features/pipelines/RunPanel';
import '@xyflow/react/dist/style.css';

const nodeTypes = { stage: StageNode };

export default function Pipelines() {
  const workspace = useWorkspace();
  const action = useAction();
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nodes, setNodes, nodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, edgesChange] = useEdgesState<Edge>([]);
  const [flow, setFlow] = useState<ReactFlowInstance<FlowNode> | null>(null);
  const loaded = useRef<string | null>(null);
  const [search, setSearch] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(() => window.innerWidth > 768);
  const libraryTrigger = useRef<HTMLButtonElement>(null);
  const editorLayout = useRef<HTMLDivElement>(null);
  const focusSettingsFor = useRef<string | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [showRun, setShowRun] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProject, setNewProject] = useState(workspace.projectId ?? '');
  const [newDataset, setNewDataset] = useState('');
  const [template, setTemplate] = useState('random_forest');
  const [deleting, setDeleting] = useState(false);
  const pipelines = useQuery({
    queryKey: ['pipelines', workspace.projectId],
    queryFn: () => api<Pipeline[]>(scoped('/pipelines', workspace.projectId)),
  });
  const catalog = useQuery({ queryKey: ['nodes'], queryFn: () => api<CatalogNode[]>('/nodes') });
  const datasets = useQuery({
    queryKey: ['datasets', workspace.projectId],
    queryFn: () => api<Dataset[]>(scoped('/datasets', workspace.projectId)),
  });
  const newDatasets = useQuery({
    queryKey: ['datasets', newProject],
    queryFn: () => api<Dataset[]>(scoped('/datasets', newProject)),
    enabled: newOpen && !!newProject,
  });
  const currentId =
    pipelineId && pipelines.data?.some((pipeline) => pipeline.id === pipelineId)
      ? pipelineId
      : (pipelines.data?.[0]?.id ?? null);
  const currentPipeline = pipelines.data?.find((pipeline) => pipeline.id === currentId);
  const run = useQuery({
    queryKey: ['run', runId],
    queryFn: () => api<Run>(`/runs/${runId}`),
    enabled: !!runId,
    refetchInterval: (query) =>
      ['queued', 'running'].includes(query.state.data?.status ?? '') ? 1200 : false,
  });

  useEffect(() => {
    if (currentPipeline && catalog.data && loaded.current !== currentPipeline.id) {
      const graph = toFlow(currentPipeline.definition, catalog.data);
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setName(currentPipeline.name);
      setDirty(false);
      setSelectedNode(null);
      setValidation(null);
      setRunId(null);
      loaded.current = currentPipeline.id;
    }
    if (!currentPipeline && !pipelines.isLoading) {
      setNodes([]);
      setEdges([]);
      setName('');
      loaded.current = null;
    }
  }, [currentPipeline, catalog.data, pipelines.isLoading, setEdges, setNodes]);

  const connect = useCallback(
    (connection: Connection) => {
      setEdges((previous) =>
        addEdge({ ...connection, id: crypto.randomUUID(), type: 'smoothstep' }, previous),
      );
      setDirty(true);
      setValidation(null);
    },
    [setEdges],
  );
  const selectionChanged = useCallback(({ nodes: selected }: OnSelectionChangeParams<FlowNode>) => {
    setSelectedNode((previous) =>
      selected.some((node) => node.id === previous) ? previous : (selected[0]?.id ?? null),
    );
  }, []);
  useEffect(() => {
    if (focusSettingsFor.current === selectedNode) {
      editorLayout.current?.querySelector<HTMLInputElement>('.node-config input')?.focus();
      focusSettingsFor.current = null;
    }
  }, [selectedNode, libraryOpen]);
  function closeLibrary() {
    setLibraryOpen(false);
    libraryTrigger.current?.focus();
  }
  function closeSettings() {
    const stageElement = Array.from(
      editorLayout.current?.querySelectorAll<HTMLElement>('.react-flow__node') ?? [],
    ).find((element) => element.dataset.id === selectedNode);
    setSelectedNode(null);
    setNodes((previous) =>
      previous.map((node) => (node.selected ? { ...node, selected: false } : node)),
    );
    stageElement?.focus();
  }
  function configureStage(id: string) {
    focusSettingsFor.current = id || null;
    setSelectedNode(id || null);
    setNodes((previous) =>
      previous.map((node) => {
        const selected = node.id === id;
        return node.selected === selected ? node : { ...node, selected };
      }),
    );
  }
  const fitWorkflow = useCallback(() => {
    if (flow && nodes.length) {
      void flow.fitView({ padding: 0.08, maxZoom: 1.1, duration: 0 });
    }
  }, [flow, nodes.length]);
  useEffect(() => {
    if (!flow || !currentId || !nodes.length) return;
    // Wait for React Flow to measure custom nodes before framing a newly loaded graph.
    const frame = requestAnimationFrame(() => {
      void flow.fitView({ padding: 0.08, maxZoom: 1.1, duration: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [flow, currentId, nodes.length]);
  const activeNode = nodes.find((node) => node.id === selectedNode);
  const liveNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        ariaLabel: `${node.data.label} stage. Press Enter to configure.`,
        data: {
          ...node.data,
          status: run.data?.node_runs?.find((stage) => stage.node_id === node.id)?.status ?? 'idle',
          invalid: validation?.errors.some((error) => error.node_id === node.id) ?? false,
        },
      })),
    [nodes, run.data?.node_runs, validation],
  );
  const running = ['queued', 'running'].includes(run.data?.status ?? '');

  async function saveRaw() {
    if (!currentId) throw new Error('Create a pipeline before saving.');
    const saved = await patch<Pipeline>(`/pipelines/${currentId}`, {
      name,
      definition: fromFlow(nodes, edges),
    });
    setDirty(false);
    return saved;
  }
  async function validate() {
    const result = await action.run(async () => {
      await saveRaw();
      return post<Validation>(`/pipelines/${currentId}/validate`);
    });
    if (result) setValidation(result);
  }
  async function execute() {
    const result = await action.run(async () => {
      await saveRaw();
      const valid = await post<Validation>(`/pipelines/${currentId}/validate`);
      setValidation(valid);
      if (!valid.valid)
        throw new Error('Resolve the validation errors before executing this pipeline.');
      return post<Run>(`/pipelines/${currentId}/runs`);
    }, 'Execution submitted. Progress and logs update automatically.');
    if (result) {
      setRunId(result.id);
      setShowRun(true);
    }
  }
  function addStage(item: CatalogNode, position?: { x: number; y: number }) {
    const stage = createStage(
      item,
      position ?? { x: 80 + (nodes.length % 3) * 275, y: 80 + Math.floor(nodes.length / 3) * 165 },
    );
    stage.selected = true;
    setNodes((previous) => [
      ...previous.map((node) => (node.selected ? { ...node, selected: false } : node)),
      stage,
    ]);
    setSelectedNode(stage.id);
    setDirty(true);
    setValidation(null);
    if (window.innerWidth <= 768) {
      focusSettingsFor.current = stage.id;
      setLibraryOpen(false);
    }
  }
  async function createPipeline() {
    const definition =
      template === 'blank'
        ? { nodes: [], edges: [] }
        : starterDefinition(catalog.data ?? [], newDataset, template, newName);
    const result = await action.run(
      () => post<Pipeline>('/pipelines', { project_id: newProject, name: newName, definition }),
      'Pipeline created. Configure any stage to customize it.',
    );
    if (result) {
      setPipelineId(result.id);
      workspace.selectProject(newProject);
      setNewOpen(false);
    }
  }
  const openNew = () => {
    setNewName('');
    setNewProject(workspace.projectId ?? workspace.projects[0]?.id ?? '');
    setNewDataset('');
    setNewOpen(true);
    action.clear();
  };
  return (
    <div className="pipeline-page">
      <PageHeader
        eyebrow="VISUAL ORCHESTRATION"
        title="Pipeline studio"
        description="Connect reusable stages. Train, evaluate, and explain in one workflow."
        actions={
          <Button variant="secondary" onClick={openNew} disabled={!workspace.projects.length}>
            <Plus size={16} aria-hidden="true" />
            New pipeline
          </Button>
        }
      />
      <Notice error={!newOpen && !deleting ? action.error : null} success={action.success} />
      {(pipelines.error || catalog.error) && (
        <Notice error={(pipelines.error ?? catalog.error)?.message} />
      )}
      {pipelines.isLoading || catalog.isLoading ? (
        <Loading label="Loading pipeline studio" />
      ) : !currentPipeline ? (
        <div className="card">
          <Empty
            title="Build your first workflow"
            description={
              workspace.projects.length
                ? 'Start with a connected classification workflow or a blank canvas. Every stage is editable.'
                : 'Create a project and upload a dataset to start building.'
            }
            action={
              workspace.projects.length ? (
                <Button onClick={openNew}>
                  <GitBranch size={16} aria-hidden="true" />
                  Create pipeline
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="editor-toolbar">
            <div className="editor-identity">
              <GitBranch size={18} aria-hidden="true" />
              <select
                aria-label="Load pipeline"
                value={currentId ?? ''}
                onChange={(event) => {
                  setPipelineId(event.target.value);
                  setDirty(false);
                }}
              >
                {pipelines.data?.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} aria-hidden="true" />
              <span className="editor-version" title="Saved pipeline version">
                v{currentPipeline.version ?? 1}
              </span>
            </div>
            <div className="editor-toolbar-actions">
              <span className={`save-indicator ${dirty ? 'unsaved' : ''}`}>
                <i />
                {dirty ? 'Unsaved changes' : 'All changes saved'}
              </span>
              <Button
                variant="ghost"
                aria-label="Delete pipeline"
                onClick={() => {
                  action.clear();
                  setDeleting(true);
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void action.run(saveRaw, 'Pipeline saved.');
                }}
                loading={action.pending}
                disabled={!name.trim()}
              >
                <Save size={15} aria-hidden="true" />
                Save
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void validate();
                }}
                disabled={action.pending}
              >
                <CheckCircle2 size={15} aria-hidden="true" />
                Validate
              </Button>
              <Button
                onClick={() => {
                  void execute();
                }}
                loading={running}
                disabled={action.pending || running}
              >
                <CirclePlay size={15} aria-hidden="true" />
                {running ? 'Executing' : 'Run pipeline'}
              </Button>
            </div>
          </div>
          <div className="editor-panel-controls">
            <button
              ref={libraryTrigger}
              type="button"
              className="button button-ghost editor-panel-toggle"
              aria-expanded={libraryOpen}
              aria-controls="pipeline-node-library"
              onClick={() => setLibraryOpen(!libraryOpen)}
            >
              {libraryOpen ? (
                <PanelLeftClose size={17} aria-hidden="true" />
              ) : (
                <PanelLeft size={17} aria-hidden="true" />
              )}
              {libraryOpen ? 'Hide stage library' : 'Add a stage'}
            </button>
            <span className="canvas-counts">
              {nodes.length} stages <span aria-hidden="true">/</span> {edges.length} connections
            </span>
            <label className="stage-picker">
              <span>Configure a stage</span>
              <select
                value={selectedNode ?? ''}
                onChange={(event) => configureStage(event.target.value)}
              >
                <option value="">Choose a stage</option>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.data.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="ghost"
              onClick={fitWorkflow}
              disabled={!nodes.length}
              aria-label="Fit workflow to canvas"
            >
              <Maximize2 size={16} aria-hidden="true" />
              Fit workflow
            </Button>
          </div>
          <div
            ref={editorLayout}
            className={`editor-layout ${libraryOpen ? '' : 'library-collapsed'}`}
          >
            <aside
              id="pipeline-node-library"
              className={`node-palette ${libraryOpen ? 'palette-visible' : ''}`}
              aria-label="Stage library"
            >
              <div className="palette-heading">
                <Boxes size={18} aria-hidden="true" />
                <strong>Stage library</strong>
                <span>{catalog.data?.length}</span>
                <button
                  className="icon-button"
                  aria-label="Close stage library"
                  onClick={closeLibrary}
                >
                  <X size={17} />
                </button>
              </div>
              <p className="palette-intro">Choose a stage to add it to your workflow.</p>
              <div className="palette-search">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search node library"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a stage…"
                />
              </div>
              <div className="palette-scroll">
                {Array.from(new Set(catalog.data?.map((item) => item.category))).map((category) => {
                  const items =
                    catalog.data?.filter(
                      (item) =>
                        item.category === category &&
                        item.label.toLowerCase().includes(search.toLowerCase()),
                    ) ?? [];
                  return items.length ? (
                    <div key={category} className="palette-category">
                      <span>{category}</span>
                      {items.map((item) => (
                        <button
                          key={item.type}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('application/xaiflow-node', item.type);
                            event.dataTransfer.effectAllowed = 'move';
                          }}
                          onClick={() => addStage(item)}
                          aria-label={`Add ${item.label} stage`}
                          title={`Click to add or drag ${item.label} onto the canvas`}
                        >
                          <span
                            className={`palette-dot category-${category.toLowerCase().replace(/ /g, '-')}`}
                          />
                          <span>{item.label}</span>
                          <Plus size={15} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  ) : null;
                })}
                {!catalog.data?.some((item) =>
                  item.label.toLowerCase().includes(search.toLowerCase()),
                ) && (
                  <div className="palette-empty" role="status">
                    No matching stages. Try a different name.
                  </div>
                )}
              </div>
              <p className="palette-hint">
                Click to add, or drag onto the canvas. Select a stage to edit its settings and
                connections.
              </p>
            </aside>
            <div
              className="flow-container"
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                event.preventDefault();
                const item = catalog.data?.find(
                  (entry) => entry.type === event.dataTransfer.getData('application/xaiflow-node'),
                );
                if (item && flow)
                  addStage(item, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
              }}
            >
              <div className="canvas-label" aria-hidden="true">
                <span className="canvas-dot" />
                WORKFLOW CANVAS
                <span>Connect. Train. Explain.</span>
              </div>
              <ReactFlow<FlowNode>
                nodes={liveNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={(changes) => {
                  nodesChange(changes);
                  if (
                    changes.some(
                      (change) => change.type !== 'select' && change.type !== 'dimensions',
                    )
                  ) {
                    setDirty(true);
                    setValidation(null);
                  }
                }}
                onEdgesChange={(changes) => {
                  edgesChange(changes);
                  if (changes.some((change) => change.type !== 'select')) {
                    setDirty(true);
                    setValidation(null);
                  }
                }}
                onConnect={connect}
                onSelectionChange={selectionChanged}
                onInit={setFlow}
                onNodeClick={(_, node) => setSelectedNode(node.id)}
                onPaneClick={() => setSelectedNode(null)}
                fitView
                fitViewOptions={{ padding: 0.08, maxZoom: 1.1 }}
                minZoom={0.25}
                maxZoom={2}
                defaultEdgeOptions={{
                  type: 'smoothstep',
                  style: { stroke: 'var(--pipeline-edge, #8da8b1)', strokeWidth: 1.8 },
                }}
                deleteKeyCode={['Backspace', 'Delete']}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1}
                  color="var(--pipeline-grid, #ccd6df)"
                />
                <Controls position="bottom-left" />
                <MiniMap
                  position="bottom-right"
                  nodeColor={(node) => (node.data.status === 'completed' ? '#0d9488' : '#c0cbd5')}
                  pannable
                  zoomable
                />
              </ReactFlow>
              {!nodes.length && (
                <div className="canvas-empty">
                  <GitBranch size={30} aria-hidden="true" />
                  <strong>A blank canvas. A clear starting point.</strong>
                  <span>Open the stage library and add Dataset Input.</span>
                </div>
              )}
            </div>
            {activeNode && (
              <NodeConfig
                key={activeNode.id}
                node={activeNode}
                datasets={datasets.data ?? []}
                connectionOptions={{
                  incoming: nodes.filter(
                    (node) =>
                      node.id !== activeNode.id &&
                      node.data.stage !== 'deploy' &&
                      !edges.some(
                        (edge) => edge.source === node.id && edge.target === activeNode.id,
                      ),
                  ),
                  outgoing: nodes.filter(
                    (node) =>
                      node.id !== activeNode.id &&
                      node.data.stage !== 'dataset' &&
                      !edges.some(
                        (edge) => edge.source === activeNode.id && edge.target === node.id,
                      ),
                  ),
                  connect: (source, target) =>
                    connect({ source, target, sourceHandle: null, targetHandle: null }),
                }}
                update={(label, parameters) => {
                  setNodes((previous) =>
                    previous.map((node) =>
                      node.id === activeNode.id
                        ? { ...node, data: { ...node.data, label, parameters } }
                        : node,
                    ),
                  );
                  setDirty(true);
                  setValidation(null);
                }}
                duplicate={() => {
                  const clone: FlowNode = {
                    ...activeNode,
                    id: crypto.randomUUID(),
                    position: { x: activeNode.position.x + 35, y: activeNode.position.y + 130 },
                    data: structuredClone(activeNode.data),
                    selected: true,
                  };
                  setNodes((previous) => [
                    ...previous.map((node) =>
                      node.selected ? { ...node, selected: false } : node,
                    ),
                    clone,
                  ]);
                  setSelectedNode(clone.id);
                  setDirty(true);
                }}
                remove={() => {
                  setNodes((previous) => previous.filter((node) => node.id !== activeNode.id));
                  setEdges((previous) =>
                    previous.filter(
                      (edge) => edge.source !== activeNode.id && edge.target !== activeNode.id,
                    ),
                  );
                  setSelectedNode(null);
                  setDirty(true);
                  setValidation(null);
                }}
                close={closeSettings}
              />
            )}
          </div>
          <div className="editor-bottom">
            <label>
              Pipeline name{' '}
              <input
                aria-label="Pipeline name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <span>
              <Database size={13} aria-hidden="true" />
              Definitions saved as a portable DAG
            </span>
          </div>
          {validation && (
            <div
              className={`validation-result ${validation.valid ? 'validation-valid' : 'validation-invalid'}`}
              role={validation.valid ? 'status' : 'alert'}
            >
              <div>
                {validation.valid ? (
                  <CheckCircle2 size={17} aria-hidden="true" />
                ) : (
                  <TriangleAlert size={17} aria-hidden="true" />
                )}
                <strong>
                  {validation.valid
                    ? `Pipeline valid · ${validation.order?.length ?? nodes.length} stages in execution order`
                    : `${validation.errors.length} validation issue${validation.errors.length === 1 ? '' : 's'}`}
                </strong>
              </div>
              {!validation.valid && (
                <ul>
                  {validation.errors.map((error, index) => (
                    <li key={index}>
                      <button
                        onClick={() => {
                          if (error.node_id) {
                            setSelectedNode(error.node_id);
                            void flow?.fitView({
                              nodes: [{ id: error.node_id }],
                              padding: 0.2,
                              maxZoom: 1.1,
                            });
                          }
                        }}
                      >
                        <span className="mono">{error.code}</span>
                        {error.message}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {run.error && <Notice error={run.error.message} />}
          {run.data && showRun && <RunPanel run={run.data} close={() => setShowRun(false)} />}
          {run.data && !showRun && (
            <Button variant="secondary" onClick={() => setShowRun(true)}>
              Show execution progress
            </Button>
          )}
        </>
      )}
      {newOpen && (
        <Modal title="Create a pipeline" onClose={() => setNewOpen(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createPipeline();
            }}
          >
            <Field label="Pipeline name">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                required
                placeholder="e.g. Churn classifier"
              />
            </Field>
            <Field label="Project">
              <select
                value={newProject}
                onChange={(event) => {
                  setNewProject(event.target.value);
                  setNewDataset('');
                }}
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
            <Field
              label="Starting workflow"
              hint="Connected stages use backend defaults. Customize them on the canvas."
            >
              <select value={template} onChange={(event) => setTemplate(event.target.value)}>
                <option value="random_forest">Random Forest + SHAP</option>
                <option value="logistic_regression">Logistic Regression + SHAP</option>
                <option value="pytorch">PyTorch Neural Network + LIME</option>
                <option value="blank">Blank canvas</option>
              </select>
            </Field>
            {template !== 'blank' && (
              <Field label="Dataset">
                <select
                  value={newDataset}
                  onChange={(event) => setNewDataset(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select a dataset
                  </option>
                  {newDatasets.data
                    ?.filter((dataset) => dataset.project_id === newProject)
                    .map((dataset) => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.name}
                        {!dataset.target_column ? ' · select target before execution' : ''}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Notice error={action.error} />
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={action.pending}
                disabled={!newProject || !newName || (template !== 'blank' && !newDataset)}
              >
                Create pipeline
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && currentId && (
        <Modal title="Delete pipeline" onClose={() => setDeleting(false)}>
          <p className="modal-copy">
            Delete <strong>{currentPipeline?.name}</strong>? Stored experiment snapshots will remain
            available.
          </p>
          <Notice error={action.error} />
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={action.pending}
              onClick={async () => {
                const result = await action.run(async () => {
                  await remove(`/pipelines/${currentId}`);
                  return true;
                }, 'Pipeline deleted.');
                if (result) {
                  setDeleting(false);
                  setPipelineId(null);
                }
              }}
            >
              Delete pipeline
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
