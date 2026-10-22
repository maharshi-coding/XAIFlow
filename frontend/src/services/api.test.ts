import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, post, scoped } from './api';

afterEach(() => vi.restoreAllMocks());

describe('API transport', () => {
  it('sends JSON with the API namespace and propagates a structured server error', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: {
            code: 'INVALID_PIPELINE',
            message: 'A target column is required.',
            details: [{ node_id: 'input' }],
          },
        }),
        { status: 422 },
      ),
    );
    await expect(post('/pipelines/p1/runs')).rejects.toMatchObject({
      message: 'A target column is required.',
      status: 422,
      details: [{ node_id: 'input' }],
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/pipelines/p1/runs',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
  });
  it('leaves multipart content type to the browser so uploads receive a boundary', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"id":"dataset"}', { status: 201 }));
    const form = new FormData();
    form.set('file', new File(['target\n1'], 'dataset.csv'));
    form.set('project_id', 'project');
    await post('/datasets', form);
    const options = fetcher.mock.calls[0][1]!;
    expect(new Headers(options.headers).has('Content-Type')).toBe(false);
    expect(options.body).toBe(form);
  });
  it('handles a deleted resource without attempting to decode a response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api('/projects/p1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
  it('preserves HTTP status for an unavailable non-JSON response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unavailable', { status: 503, statusText: 'Service Unavailable' }),
    );
    await expect(api('/health')).rejects.toBeInstanceOf(ApiError);
  });
  it('adds encoded project scope while preserving existing query parameters', () => {
    expect(scoped('/runs?status=completed', 'project/one')).toBe(
      '/runs?status=completed&project_id=project%2Fone',
    );
    expect(scoped('/runs', null)).toBe('/runs');
  });
});
