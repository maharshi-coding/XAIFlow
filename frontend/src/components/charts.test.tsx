import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ClassDistributions } from './charts';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});
afterEach(cleanup);

describe('held-out class and prediction counts', () => {
  it('preserves actual and predicted counts for each held-out class', () => {
    render(
      <ClassDistributions
        metrics={{
          class_distribution: { retained: 12, churn: 8 },
          prediction_distribution: { retained: 10, churn: 10 },
        }}
      />,
    );
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('retained1210');
    expect(rows[2]).toHaveTextContent('churn810');
    expect(
      screen.getByRole('img', { name: 'Held-out class and prediction counts' }),
    ).toBeInTheDocument();
  });

  it('does not imply prediction counts when the server provides only actual class counts', () => {
    render(<ClassDistributions metrics={{ class_distribution: { retained: 12, churn: 8 } }} />);
    expect(screen.queryByRole('columnheader', { name: 'Predictions' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Actual labels' })).toBeInTheDocument();
  });
});
