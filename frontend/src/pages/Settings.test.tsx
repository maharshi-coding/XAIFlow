import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from '../layouts/WorkspaceProvider';
import Settings from './Settings';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('workspace runtime capabilities', () => {
  it('groups the connected backend stages by their returned categories', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/health'))
        return new Response(
          JSON.stringify({ status: 'ok', database: 'connected', service: 'XAIFlow' }),
        );
      if (String(url).endsWith('/nodes'))
        return new Response(
          JSON.stringify([
            {
              type: 'dataset',
              label: 'Dataset input',
              category: 'Data',
              description: 'Read source data.',
            },
            { type: 'split', label: 'Train / test split', category: 'Preprocessing' },
            { type: 'scale', label: 'Feature scaling', category: 'Preprocessing' },
          ]),
        );
      return new Response('[]');
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <WorkspaceProvider>
            <Settings />
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const data = await screen.findByRole('region', { name: 'Data capabilities' });
    expect(within(data).getByText('1 stage')).toBeInTheDocument();
    expect(within(data).getByText('Read source data.')).toBeInTheDocument();
    const preprocessing = screen.getByRole('region', { name: 'Preprocessing capabilities' });
    expect(within(preprocessing).getByText('2 stages')).toBeInTheDocument();
    expect(within(preprocessing).getByText('Feature scaling')).toBeInTheDocument();
    expect(await screen.findByText('API connected')).toBeInTheDocument();
    expect(screen.getByText('View runtime diagnostics').parentElement).not.toHaveAttribute('open');
  });
});
