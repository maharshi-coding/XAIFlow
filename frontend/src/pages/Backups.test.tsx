import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from '../layouts/WorkspaceProvider';
import Backups from './Backups';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('backup recovery summary', () => {
  it('shows persisted archive totals and opens the restored project using its returned ID', async () => {
    const project = {
      id: 'source-project',
      name: 'Churn research',
      description: '',
      created_at: '2026-01-01T00:00:00Z',
    };
    const recovered = { ...project, id: 'restored-project', name: 'Churn research restored' };
    const backup = {
      id: 'backup',
      project_id: project.id,
      name: 'churn.zip',
      size_bytes: 4096,
      created_at: project.created_at,
    };
    let restored = false;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (options?.method === 'POST' && String(url).endsWith('/backups/restore')) {
        restored = true;
        return new Response(
          JSON.stringify({
            project_id: recovered.id,
            project: recovered,
            restored_records: { datasets: 2, pipeline_runs: 4 },
            restored_artifacts: 7,
          }),
        );
      }
      if (String(url).endsWith('/projects')) {
        return new Response(JSON.stringify(restored ? [project, recovered] : [project]));
      }
      return new Response(JSON.stringify([backup]));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <WorkspaceProvider>
            <Backups />
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Saved archives');
    expect(screen.getByText('Archive storage')).toBeInTheDocument();
    expect(screen.getAllByText('4.0 KB')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Restore archive' }));
    const fileInput = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(fileInput, { target: { files: [new File(['archive'], 'churn.zip')] } });
    fireEvent.submit(screen.getByRole('button', { name: 'Validate & restore' }).closest('form')!);
    await screen.findByText('Restore completed');
    const datasets = screen.getByText('Datasets', { selector: 'dt' }).parentElement!;
    expect(within(datasets).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Runs', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('Verified artifacts', { selector: 'dt' })).toBeInTheDocument();
    const open = screen.getByRole('link', { name: 'Open restored project' });
    expect(open).toHaveAttribute('href', '/');
    fireEvent.click(open);
    await waitFor(() => expect(localStorage.getItem('xaiflow.project')).toBe(recovered.id));
    const restoreCall = fetcher.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(restoreCall?.[1]?.body).toBeInstanceOf(FormData);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
