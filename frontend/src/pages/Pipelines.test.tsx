import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from '../layouts/WorkspaceProvider';
import Pipelines from './Pipelines';

const project = {
  id: 'project',
  name: 'Research',
  description: '',
  created_at: '2026-10-06T12:00:00Z',
};
const catalog = [
  { type: 'dataset', label: 'Dataset Input', category: 'Data', parameters: { dataset_id: '' } },
  {
    type: 'random_forest',
    label: 'Random Forest',
    category: 'Models',
    parameters: { n_estimators: 100 },
  },
];
const pipeline = {
  id: 'pipeline',
  project_id: project.id,
  name: 'Churn',
  version: 1,
  created_at: project.created_at,
  definition: {
    nodes: [
      {
        id: 'forest',
        type: 'random_forest',
        label: 'Forest classifier',
        parameters: { n_estimators: 100 },
        position: { x: 0, y: 0 },
      },
    ],
    edges: [],
  },
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const path = String(url).split('?')[0];
    const value = path.endsWith('/projects')
      ? [project]
      : path.endsWith('/pipelines')
        ? [pipeline]
        : path.endsWith('/nodes')
          ? catalog
          : [];
    return new Response(JSON.stringify(value));
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderStudio() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <WorkspaceProvider>
          <Pipelines />
        </WorkspaceProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('pipeline keyboard interactions', () => {
  it('opens a selected stage from the native picker and keeps its accessible canvas label current', async () => {
    renderStudio();
    const picker = await screen.findByLabelText('Configure a stage');
    fireEvent.change(picker, { target: { value: 'forest' } });
    const label = await screen.findByLabelText('Node label');
    expect(label).toHaveValue('Forest classifier');
    await waitFor(() => expect(label).toHaveFocus());
    fireEvent.change(label, { target: { value: 'Churn forest' } });
    expect(screen.getByTestId('rf__node-forest')).toHaveAttribute(
      'aria-label',
      'Churn forest stage. Press Enter to configure.',
    );
    expect(screen.getByRole('option', { name: 'Churn forest' })).toHaveValue('forest');
  });
  it('opens settings when an existing React Flow stage is selected with Enter and closes them with Escape', async () => {
    renderStudio();
    const stage = await screen.findByTestId('rf__node-forest');
    stage.focus();
    fireEvent.keyDown(stage, { key: 'Enter' });
    expect(await screen.findByLabelText('Node label')).toHaveValue('Forest classifier');
    fireEvent.keyDown(stage, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByLabelText('Node label')).not.toBeInTheDocument());
  });

  it('returns focus to the library trigger when its close control is used', async () => {
    vi.stubGlobal('innerWidth', 375);
    renderStudio();
    const trigger = await screen.findByRole('button', { name: 'Add a stage' });
    fireEvent.click(trigger);
    const close = screen.getByRole('button', { name: 'Close stage library' });
    close.focus();
    fireEvent.click(close);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('returns focus to the stage after closing settings and allows keyboard reopening', async () => {
    renderStudio();
    const stage = await screen.findByTestId('rf__node-forest');
    fireEvent.keyDown(stage, { key: 'Enter' });
    await screen.findByLabelText('Node label');
    const close = screen.getByRole('button', { name: 'Close node settings' });
    close.focus();
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByLabelText('Node label')).not.toBeInTheDocument());
    expect(stage).toHaveFocus();
    fireEvent.keyDown(stage, { key: 'Enter' });
    expect(await screen.findByLabelText('Node label')).toHaveValue('Forest classifier');
  });

  it('focuses the new stage label after adding a stage from the mobile library', async () => {
    vi.stubGlobal('innerWidth', 375);
    renderStudio();
    fireEvent.click(await screen.findByRole('button', { name: 'Add a stage' }));
    const addStage = screen.getByRole('button', { name: 'Add Dataset Input stage' });
    addStage.focus();
    fireEvent.click(addStage, { detail: 0 });
    const label = await screen.findByLabelText('Node label');
    expect(label).toHaveValue('Dataset Input');
    await waitFor(() => expect(label).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Add a stage' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
