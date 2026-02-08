import React from 'react';
import { DIFFICULTY_PROFILES } from '../config/gameConfig';
import { SessionInsights } from '../domain/session-analytics';
import { formatDuration } from '../domain/time';

interface SessionInsightsPanelProps {
  insights: SessionInsights;
}

const formatSessionDate = (timestamp: number) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);

const SessionInsightsPanel: React.FC<SessionInsightsPanelProps> = ({ insights }) => {
  if (!insights.totalSessions) {
    return (
      <aside className="session-insights empty" aria-live="polite">
        <small>Analytics de sessão</small>
        <h3>Sem histórico ainda</h3>
        <p>Finalize uma partida para liberar recomendações de dificuldade e tendência de desempenho.</p>
      </aside>
    );
  }

  const recommendedProfile = DIFFICULTY_PROFILES[insights.recommendedDifficulty];

  return (
    <aside className="session-insights" aria-live="polite">
      <div className="session-insights-head">
        <small>Analytics de sessão</small>
        <p>Baseado nas últimas partidas locais registradas.</p>
      </div>

      <div className="session-metric-grid">
        <article>
          <span>Partidas</span>
          <strong>{insights.totalSessions}</strong>
        </article>
        <article>
          <span>Precisão média</span>
          <strong>{insights.averageAccuracy.toFixed(1)}%</strong>
        </article>
        <article>
          <span>Duração média</span>
          <strong>{formatDuration(insights.averageDurationMs)}</strong>
        </article>
        <article>
          <span>Melhor score</span>
          <strong>{insights.bestScore.toLocaleString('pt-BR')}</strong>
        </article>
      </div>

      <p className="session-recommendation">
        Recomendação atual: <strong>{recommendedProfile.label}</strong> (onda máxima {insights.bestWave})
      </p>

      <ul className="session-recent-list">
        {insights.recentSessions.slice(0, 3).map((session) => (
          <li key={session.id}>
            <div>
              <strong>{formatSessionDate(session.endedAt)}</strong>
              <span>{DIFFICULTY_PROFILES[session.difficulty].label}</span>
            </div>
            <p>
              {session.score.toLocaleString('pt-BR')} pts • {session.accuracy.toFixed(1)}% • onda {session.highestWave}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default SessionInsightsPanel;
