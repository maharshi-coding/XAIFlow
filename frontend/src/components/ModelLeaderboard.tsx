import { ArrowUpRight, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RegisteredModel } from '../types/domain';
import { Badge, Card, Empty } from './ui';
import { percent, title } from '../utils/format';
import { RadialGauge } from './motion/RadialGauge';
import { StatBar } from './motion/StatBar';

const FRAMEWORK_LABEL: Record<string, string> = {
  'scikit-learn': 'scikit-learn',
  sklearn: 'scikit-learn',
  pytorch: 'PyTorch',
};

/**
 * Ranks every registered model version by held-out accuracy and renders an
 * animated leaderboard. The top model is spotlit with a radial accuracy gauge;
 * the rest get fill bars. All figures are the models' real evaluation metrics.
 */
export function ModelLeaderboard({ models }: { models: RegisteredModel[] }) {
  const ranked = [...models]
    .filter((model) => typeof model.metrics?.accuracy === 'number')
    .sort((a, b) => (b.metrics.accuracy ?? 0) - (a.metrics.accuracy ?? 0));
  const champion = ranked[0];

  return (
    <Card
      className="leaderboard-card"
      title="Model leaderboard"
      subtitle="Registered versions ranked by held-out accuracy"
      action={
        <Link className="text-link" to="/models">
          Model registry <ArrowUpRight size={14} />
        </Link>
      }
    >
      {champion ? (
        <div className="leaderboard-body">
          <Link to={`/models/${champion.id}`} className="leaderboard-champion">
            <span className="champion-tag">
              <Crown size={14} aria-hidden="true" /> Champion
            </span>
            <RadialGauge
              value={champion.metrics.accuracy ?? 0}
              display={percent(champion.metrics.accuracy)}
              caption="accuracy"
            />
            <strong>{champion.name}</strong>
            <span className="champion-meta">
              {title(champion.algorithm)} ·{' '}
              {FRAMEWORK_LABEL[champion.framework] ?? champion.framework}
            </span>
            <div className="champion-stats">
              <div>
                <span>ROC-AUC</span>
                <strong className="mono">
                  {typeof champion.metrics.roc_auc === 'number'
                    ? champion.metrics.roc_auc.toFixed(3)
                    : '—'}
                </strong>
              </div>
              <div>
                <span>F1 score</span>
                <strong className="mono">{percent(champion.metrics.f1)}</strong>
              </div>
            </div>
          </Link>
          <ol className="leaderboard-list">
            {ranked.map((model, index) => (
              <li key={model.id}>
                <Link
                  to={`/models/${model.id}`}
                  className={`leaderboard-row ${index === 0 ? 'is-champion' : ''}`}
                >
                  <span className="leaderboard-rank mono">{index + 1}</span>
                  <span className="leaderboard-name">
                    <strong>{model.name}</strong>
                    <small>
                      {title(model.algorithm)} · v{model.version}
                    </small>
                  </span>
                  <span className="leaderboard-meter">
                    <StatBar
                      value={model.metrics.accuracy ?? 0}
                      tone={index === 0 ? 'teal' : 'muted'}
                      delay={index * 0.06}
                    />
                  </span>
                  <span className="leaderboard-value mono">{percent(model.metrics.accuracy)}</span>
                  <Badge status={model.status} />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <Empty
          title="No evaluated models yet"
          description="Run a pipeline with a Register Model stage to populate the leaderboard."
        />
      )}
    </Card>
  );
}
