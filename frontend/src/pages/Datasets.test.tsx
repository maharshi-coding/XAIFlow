import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from '../layouts/WorkspaceProvider';
import Datasets from './Datasets';

vi.mock('../components/charts', () => ({
  DistributionChart: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('dataset inspection and target configuration', () => {
  it('renders real column metadata and preview, then persists the chosen target', async () => {
    const project = {
      id: 'project',
      name: 'Churn',
      description: '',
      created_at: '2026-01-01T00:00:00Z',
    };
    const dataset = {
      id: 'dataset',
      project_id: 'project',
      name: 'customers.csv',
      row_count: 100,
      column_count: 2,
      target_column: null as string | null,
      columns: [
        { name: 'tenure', dtype: 'int64', missing: 0, unique: 12 },
        { name: 'churn', dtype: 'int64', missing: 0, unique: 2 },
      ],
      statistics: {
        missing_values: 0,
        numeric: { tenure: { mean: 17.5, std: 4.5, min: 0, max: 60 } },
        class_distribution: {},
      },
      preview: [{ tenure: 12.123456789, churn: 1 }],
      created_at: project.created_at,
    };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (options?.method === 'PATCH') {
        dataset.target_column = JSON.parse(String(options.body)).target_column;
        return new Response(JSON.stringify(dataset));
      }
      if (String(url).endsWith('/projects')) return new Response(JSON.stringify([project]));
      return new Response(
        JSON.stringify(String(url).endsWith('/datasets/dataset') ? dataset : [dataset]),
      );
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <WorkspaceProvider>
            <Datasets />
          </WorkspaceProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Showing first 1 of 100 rows. Source data stays immutable.');
    expect(screen.getByRole('region', { name: 'Selected dataset' })).toHaveTextContent(
      'customers.csv',
    );
    expect(screen.getByRole('button', { name: 'Data preview' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('12.123')).toHaveAttribute('title', '12.123456789');
    expect(screen.getByRole('img', { name: 'Preview distribution of tenure' })).toBeInTheDocument();
    expect(screen.getByText(/Preview sample: first 1 of 100 rows/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Visualized feature'), { target: { value: 'churn' } });
    expect(screen.getByRole('img', { name: 'Preview distribution of churn' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Column statistics' }));
    expect(screen.getByRole('button', { name: 'Column statistics' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('region', { name: 'Column statistics' })).toBeInTheDocument();
    expect(screen.getByText('17.500')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Target column'), { target: { value: 'churn' } });
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          ([url, options]) =>
            url === '/api/v1/datasets/dataset' &&
            options?.method === 'PATCH' &&
            options.body === '{"target_column":"churn"}',
        ),
      ).toBe(true),
    );
    await screen.findByText('Target updated.');
    expect(screen.getByLabelText('Target column')).toHaveValue('churn');
    expect(screen.getByText('Target: churn')).toBeInTheDocument();
  });
});
