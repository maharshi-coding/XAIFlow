import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunPanel } from './RunPanel';
import type { Run } from '../../types/domain';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const baseRun: Run = {
  id: 'run-test',
  project_id: 'project',
  pipeline_id: 'pipeline',
  status: 'running',
  created_at: '2026-10-06T12:00:00Z',
  started_at: '2026-10-06T12:00:00Z',
  metrics: {},
  node_runs: [
    { node_id: 'data', label: 'Dataset Input', status: 'completed', duration: 0.1 },
    { node_id: 'model', label: 'Random Forest', status: 'running' },
    { node_id: 'evaluate', label: 'Evaluation', status: 'pending' },
  ],
};

function renderPanel(run: Run) {
  return render(
    <MemoryRouter>
      <RunPanel run={run} close={() => {}} />
    </MemoryRouter>,
  );
}

describe('execution progress', () => {
  it('exposes completed stage counts as an accessible progress bar', () => {
    renderPanel(baseRun);
    const progress = screen.getByRole('progressbar', { name: 'Pipeline execution progress' });
    expect(progress).toHaveAttribute('aria-valuenow', '1');
    expect(progress).toHaveAttribute('aria-valuemax', '3');
    expect(progress).toHaveAttribute('aria-valuetext', '1 of 3 stages completed');
    expect(screen.getByRole('list', { name: 'Stage execution status' })).toBeInTheDocument();
  });

  it('updates elapsed time while a run is active', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:10Z'));
    renderPanel(baseRun);
    expect(screen.getByText('10.0s')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('15.0s')).toBeInTheDocument();
  });

  it('uses the finish timestamp for a completed run with no stored duration', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T14:00:00Z'));
    renderPanel({ ...baseRun, status: 'completed', finished_at: '2026-10-06T12:00:02Z' });
    expect(screen.getByText('2.0s')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('2.0s')).toBeInTheDocument();
  });

  it('lets users stop following worker output while reading previous logs', () => {
    renderPanel(baseRun);
    const follow = screen.getByRole('button', { name: 'Following output' });
    expect(follow).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(follow);
    expect(screen.getByRole('button', { name: 'Follow output' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
