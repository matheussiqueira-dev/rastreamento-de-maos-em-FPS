import { describe, expect, it } from 'vitest';
import { DifficultyLevel } from '../types';
import {
  appendSessionHistory,
  deriveSessionInsights,
  isSessionHistory,
  SessionSnapshot,
} from './session-analytics';

const session = (id: number, overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  id,
  endedAt: id,
  score: 1_000,
  accuracy: 50,
  kills: 5,
  highestWave: 2,
  durationMs: 60_000,
  difficulty: 'CASUAL' as DifficultyLevel,
  ...overrides,
});

describe('session analytics', () => {
  it('recomenda CASUAL até haver histórico suficiente', () => {
    expect(deriveSessionInsights([]).recommendedDifficulty).toBe('CASUAL');
    expect(deriveSessionInsights([session(1, { accuracy: 99, highestWave: 20 })]).recommendedDifficulty).toBe('CASUAL');
  });

  it('recomenda dificuldades conforme precisão e onda máxima', () => {
    const expert = [1, 2, 3].map((id) => session(id, { accuracy: 90, highestWave: 10 }));
    const tactical = [1, 2, 3].map((id) => session(id, { accuracy: 70, highestWave: 5 }));
    const beginner = [1, 2, 3].map((id) => session(id, { accuracy: 30 }));
    expect(deriveSessionInsights(expert).recommendedDifficulty).toBe('INSANE');
    expect(deriveSessionInsights(tactical).recommendedDifficulty).toBe('TACTICAL');
    expect(deriveSessionInsights(beginner).recommendedDifficulty).toBe('EASY');
  });

  it('calcula médias sobre as 5 sessões mais recentes e recordes sobre todo o histórico', () => {
    const history = [
      session(1, { score: 9_999, accuracy: 0, highestWave: 12 }),
      ...[2, 3, 4, 5, 6].map((id) => session(id, { accuracy: 80 })),
    ];
    const insights = deriveSessionInsights(history);
    expect(insights.averageAccuracy).toBe(80);
    expect(insights.bestScore).toBe(9_999);
    expect(insights.bestWave).toBe(12);
    expect(insights.recentSessions.map((entry) => entry.id)).toEqual([6, 5, 4, 3, 2]);
  });

  it('mantém o histórico ordenado e limitado', () => {
    const history = Array.from({ length: 20 }, (_, index) => session(index + 1));
    const next = appendSessionHistory(history, session(100));
    expect(next).toHaveLength(20);
    expect(next[0].id).toBe(100);
    expect(next.at(-1)?.id).toBe(2);
  });

  it('rejeita histórico corrompido no localStorage', () => {
    expect(isSessionHistory([session(1)])).toBe(true);
    expect(isSessionHistory([{ ...session(1), difficulty: 'GODMODE' }])).toBe(false);
    expect(isSessionHistory([{ ...session(1), score: Number.NaN }])).toBe(false);
    expect(isSessionHistory('not-an-array')).toBe(false);
  });
});
