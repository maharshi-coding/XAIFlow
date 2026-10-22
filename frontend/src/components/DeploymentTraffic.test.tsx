import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeploymentTraffic } from './DeploymentTraffic';

vi.mock('./charts', () => ({
  Timeseries: ({ data, dataKey }: { data: Record<string, unknown>[]; dataKey: string }) => (
    <div aria-label="Prediction activity series">
      {data.map((point) => String(point[dataKey])).join(', ')}
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('selected deployment traffic', () => {
  it('shows recorded serving data and refreshes after prediction cache invalidation', async () => {
    let predictionCount = 2;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            deployment_id: 'deployment',
            request_count: predictionCount,
            prediction_count: predictionCount,
            avg_latency_ms: 18.456,
            error_count: 0,
            error_rate: 0,
            history: [{ created_at: '2026-01-01T00:00:00Z', prediction_count: predictionCount }],
          }),
        ),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DeploymentTraffic deploymentId="deployment" />
      </QueryClientProvider>,
    );
    await screen.findByText('18.5 ms');
    expect(screen.getByLabelText('Prediction activity series')).toHaveTextContent('2');
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/monitoring?deployment_id=deployment',
      expect.anything(),
    );
    predictionCount = 3;
    await client.invalidateQueries();
    await waitFor(() =>
      expect(screen.getByLabelText('Prediction activity series')).toHaveTextContent('3'),
    );
  });
});
