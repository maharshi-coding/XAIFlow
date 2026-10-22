import { useState } from 'react';
import { ScanEye } from 'lucide-react';
import type { Explanation } from '../types/domain';
import { Card, Empty } from './ui';
import { ContributionChart } from './charts';
import { percent } from '../utils/format';

export function ExplanationView({ explanations }: { explanations: Explanation[] }) {
  const [index, setIndex] = useState(0);
  const explanation = explanations[index] ?? explanations[0];
  if (!explanation)
    return (
      <Card>
        <Empty
          title="No explanations in this run"
          description="Add a SHAP or LIME stage after model evaluation to understand your predictions."
        />
      </Card>
    );
  const local =
    explanation.feature_contributions ?? explanation.contributions ?? explanation.features ?? [];
  const global = explanation.global_importance ?? explanation.global ?? [];
  return (
    <>
      <div className="explanation-toolbar">
        <div>
          <ScanEye size={19} />
          <strong>Prediction explanations</strong>
        </div>
        <select
          aria-label="Explanation sample"
          value={index}
          onChange={(event) => setIndex(Number(event.target.value))}
        >
          {explanations.map((item, i) => (
            <option key={i} value={i}>
              {(item.explainer ?? item.method)?.toUpperCase()} · sample {item.sample_index ?? i}
            </option>
          ))}
        </select>
      </div>
      <div className="explanation-context">
        <span>
          EXPLAINER <strong>{(explanation.explainer ?? explanation.method)?.toUpperCase()}</strong>
        </span>
        <span>
          SAMPLE <strong>{explanation.sample_index ?? index}</strong>
        </span>
        <span>
          PREDICTED CLASS{' '}
          <strong>{String(explanation.predicted_class ?? explanation.prediction ?? '—')}</strong>
        </span>
        <span>
          CONFIDENCE <strong>{percent(explanation.confidence ?? explanation.probability)}</strong>
        </span>
      </div>
      <p className="explanation-disclaimer">
        Feature attribution explains model behavior under the assumptions of the selected
        explanation method. It does not establish causation.
      </p>
      <div className={global.length ? 'two-column' : ''}>
        <Card title="Local feature contributions" subtitle="How each feature moves this prediction">
          <div className="chart-legend">
            <span>
              <i className="positive" />
              Positive contribution
            </span>
            <span>
              <i className="negative" />
              Negative contribution
            </span>
          </div>
          <ContributionChart data={local} />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Sample value</th>
                  <th>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {local.slice(0, 12).map((item, i) => (
                  <tr key={i}>
                    <td>{item.feature}</td>
                    <td className="mono">
                      {typeof item.value === 'number'
                        ? Number(item.value.toPrecision(4)).toString()
                        : String(item.value ?? '—')}
                    </td>
                    <td className={`mono ${(item.contribution ?? 0) >= 0 ? 'teal' : 'red'}`}>
                      {item.contribution?.toFixed(5)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {global.length > 0 && (
          <Card
            title="Global feature importance"
            subtitle="Average contribution magnitude across the explanation sample"
          >
            <ContributionChart data={global} signed={false} />
            <p className="chart-footnote">
              Aggregate attribution describes model behavior across sampled data. It does not
              establish causality.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
