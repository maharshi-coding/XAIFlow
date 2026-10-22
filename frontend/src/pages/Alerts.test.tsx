import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from '../layouts/WorkspaceProvider';
import Alerts from './Alerts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
describe('persisted alert facts', () => {
  it('uses the backend title, description, source, metric, threshold, and observed value', async () => {
    const alert = {
      id: 'alert-id',
      project_id: 'project',
      title: 'Feature distribution changed',
      description: 'Maximum feature PSI exceeds the configured threshold.',
      message: 'Legacy message',
      source: 'deployment:deployment-id',
      metric: 'maximum_feature_psi',
      threshold: 0.2,
      observed_value: 0,
      severity: 'warning',
      status: 'open',
      kind: 'data_drift',
      details: { feature: 'tenure' },
      created_at: '2026-01-01T00:00:00Z',
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (url) => new Response(JSON.stringify(String(url).endsWith('/alerts') ? [alert] : [])),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <WorkspaceProvider>
            <Alerts />
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText(alert.title);
    expect(screen.getByText(alert.description)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show details for alert alert-id' }));
    expect(screen.getByText(alert.source)).toBeInTheDocument();
    expect(screen.getByText(alert.metric)).toBeInTheDocument();
    expect(screen.getByText('0.2')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/"feature": "tenure"/)).toBeInTheDocument();
  });
});
