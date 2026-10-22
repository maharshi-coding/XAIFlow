import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

vi.mock('../hooks/useWorkspace', () => ({
  useWorkspace: () => ({ projectId: null, selectProject: vi.fn(), projects: [] }),
}));
const originalMatchMedia = window.matchMedia;
beforeEach(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"status":"ok"}', { status: 200 }));
});
afterEach(() => {
  cleanup();
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});
function renderShell() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('mobile navigation', () => {
  it('opens a labeled drawer and restores menu focus on Escape', () => {
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    const navigation = document.getElementById('workspace-navigation');
    expect(navigation).toHaveAttribute('inert');
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Workspace navigation' })).toBeInTheDocument();
    expect(navigation).not.toHaveAttribute('inert');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(navigation).toHaveAttribute('inert');
  });
  it('keeps keyboard traversal inside the drawer', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = within(screen.getByRole('dialog', { name: 'Workspace navigation' }));
    drawer.getByRole('link', { name: 'API reference' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(drawer.getByRole('link', { name: 'XAIFlow overview' })).toHaveFocus();
  });
});
