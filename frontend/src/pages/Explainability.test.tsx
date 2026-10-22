import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from '../layouts/WorkspaceProvider';
import Explainability from './Explainability';

vi.mock('../components/ExplanationView', () => ({
  ExplanationView: ({
    explanations,
  }: {
    explanations: { explainer: string; sample_index: number }[];
  }) => (
    <div>
      Stored {explanations[0].explainer.toUpperCase()} sample {explanations[0].sample_index}
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('standalone explainability workspace', () => {
  it('switches between real experiment and registered version explanations with source lineage', async () => {
    const timestamp = '2026-01-01T00:00:00Z';
    const run = {
      id: 'run-id',
      pipeline_name: 'Churn classifier',
      model_type: 'random_forest',
      status: 'completed',
      created_at: timestamp,
      explanations: [{ explainer: 'shap', method: 'tree_shap', sample_index: 0 }],
    };
    const model = {
      id: 'model-id',
      run_id: 'run-id',
      name: 'Churn model',
      version: 2,
      algorithm: 'random_forest',
      status: 'approved',
      created_at: timestamp,
      explanations: [{ explainer: 'lime', method: 'local_surrogate', sample_index: 4 }],
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (url) =>
        new Response(
          JSON.stringify(
            String(url).endsWith('/runs') ? [run] : String(url).endsWith('/models') ? [model] : [],
          ),
        ),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <WorkspaceProvider>
            <Explainability />
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Stored SHAP sample 0');
    expect(screen.getByRole('link', { name: 'View experiment' })).toHaveAttribute(
      'href',
      '/experiments/run-id',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Model versions' }));
    await screen.findByText('Stored LIME sample 4');
    expect(screen.getByRole('option', { name: 'Churn model · v2' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View model version' })).toHaveAttribute(
      'href',
      '/models/model-id',
    );
    expect(screen.getByRole('link', { name: 'Source run run-id' })).toHaveAttribute(
      'href',
      '/experiments/run-id',
    );
  });
});
