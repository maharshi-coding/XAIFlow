import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from '../layouts/WorkspaceProvider';
import Projects from './Projects';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function renderProjects() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <WorkspaceProvider>
          <Projects />
        </WorkspaceProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('project creation', () => {
  it('creates the submitted project through the API and selects its persisted UUID', async () => {
    let created = false;
    const project = {
      id: 'project-uuid',
      name: 'Churn research',
      description: 'Explain customer churn',
      created_at: '2026-01-01T00:00:00Z',
    };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
      if (options?.method === 'POST') {
        created = true;
        return new Response(JSON.stringify(project), { status: 201 });
      }
      return new Response(JSON.stringify(created ? [project] : []), { status: 200 });
    });
    renderProjects();
    await screen.findByText('Create your first project');
    fireEvent.click(screen.getAllByRole('button', { name: 'New project' })[0]);
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: project.name } });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: project.description },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(localStorage.getItem('xaiflow.project')).toBe(project.id));
    expect(fetcher.mock.calls.find(([, options]) => options?.method === 'POST')?.[1]?.body).toBe(
      JSON.stringify({ name: project.name, description: project.description }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Selected workspace')).toBeInTheDocument();
  });
  it('keeps the entered form open and displays the server rejection', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) =>
      options?.method === 'POST'
        ? new Response(JSON.stringify({ detail: { message: 'Project name already exists.' } }), {
            status: 409,
          })
        : new Response('[]'),
    );
    renderProjects();
    await screen.findByText('Create your first project');
    fireEvent.click(screen.getAllByRole('button', { name: 'New project' })[0]);
    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: 'Existing project' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Project name already exists.');
    expect(screen.getByLabelText('Project name')).toHaveValue('Existing project');
    expect(localStorage.getItem('xaiflow.project')).toBeNull();
  });
});
