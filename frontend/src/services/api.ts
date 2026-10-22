const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    const detail = body.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : (detail?.message ??
          (Array.isArray(detail)
            ? detail.map((item: { msg: string }) => item.msg).join('; ')
            : 'Request failed.'));
    throw new ApiError(message, response.status, detail?.details ?? detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const remove = (path: string) => api<void>(path, { method: 'DELETE' });
export const scoped = (path: string, projectId: string | null) =>
  projectId
    ? `${path}${path.includes('?') ? '&' : '?'}project_id=${encodeURIComponent(projectId)}`
    : path;
export const downloadUrl = (path: string) => `${BASE}${path}`;
