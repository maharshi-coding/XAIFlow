import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExplanationView } from './ExplanationView';
import type { FeatureContribution } from '../types/domain';

vi.mock('./charts', () => ({
  ContributionChart: ({ data }: { data: FeatureContribution[] }) => (
    <div aria-label="Contribution chart">{data.map((feature) => feature.feature).join(', ')}</div>
  ),
}));
afterEach(cleanup);

describe('normalized explanations', () => {
  const explanations = [
    {
      explainer: 'shap',
      method: 'tree_shap',
      sample_index: 0,
      predicted_class: 'churn',
      confidence: 0.91,
      feature_contributions: [{ feature: 'monthly_spend', value: 12.3456789, contribution: 0.23 }],
      global_importance: [{ feature: 'tenure', importance: 0.32 }],
    },
    {
      explainer: 'lime',
      method: 'local_surrogate',
      sample_index: 5,
      predicted_class: 'retained',
      confidence: 0.84,
      feature_contributions: [{ feature: 'contract', value: 'annual', contribution: -0.15 }],
    },
  ];

  it('shows the user-facing explainer, held sample, and attribution interpretation notice', () => {
    render(<ExplanationView explanations={explanations} />);
    expect(screen.getByRole('option', { name: 'SHAP · sample 0' })).toBeInTheDocument();
    expect(screen.getByText('churn')).toBeInTheDocument();
    expect(screen.getByText('91.0%')).toBeInTheDocument();
    expect(screen.getByText('12.35')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Feature attribution explains model behavior under the assumptions of the selected explanation method. It does not establish causation.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Global feature importance' })).toBeInTheDocument();
  });

  it('switches prediction and contribution details to the selected stored sample', () => {
    render(<ExplanationView explanations={explanations} />);
    fireEvent.change(screen.getByLabelText('Explanation sample'), { target: { value: '1' } });
    expect(screen.getByText('retained')).toBeInTheDocument();
    expect(screen.getByText('annual')).toBeInTheDocument();
    expect(screen.getByText('-0.15000')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Global feature importance' }),
    ).not.toBeInTheDocument();
  });
});
