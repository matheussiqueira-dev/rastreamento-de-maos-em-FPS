import { DifficultyLevel } from '../types';

export interface SessionSnapshot {
  id: number;
  endedAt: number;
  score: number;
  accuracy: number;
  kills: number;
  highestWave: number;
  durationMs: number;
  difficulty: DifficultyLevel;
}

export interface SessionInsights {
  totalSessions: number;
  averageAccuracy: number;
  averageDurationMs: number;
  bestScore: number;
  bestWave: number;
  recentSessions: SessionSnapshot[];
  recommendedDifficulty: DifficultyLevel;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isDifficultyLevel = (value: unknown): value is DifficultyLevel =>
  value === 'EASY' || value === 'CASUAL' || value === 'TACTICAL' || value === 'INSANE';

export const isSessionSnapshot = (value: unknown): value is SessionSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Record<string, unknown>;
  return (
    isFiniteNumber(snapshot.id) &&
    isFiniteNumber(snapshot.endedAt) &&
    isFiniteNumber(snapshot.score) &&
    isFiniteNumber(snapshot.accuracy) &&
    isFiniteNumber(snapshot.kills) &&
    isFiniteNumber(snapshot.highestWave) &&
    isFiniteNumber(snapshot.durationMs) &&
    isDifficultyLevel(snapshot.difficulty)
  );
};

export const isSessionHistory = (value: unknown): value is SessionSnapshot[] =>
  Array.isArray(value) && value.every(isSessionSnapshot);

const calculateRecommendedDifficulty = (input: {
  totalSessions: number;
  averageAccuracy: number;
  bestWave: number;
}): DifficultyLevel => {
  if (input.totalSessions < 3) return 'CASUAL';
  if (input.averageAccuracy >= 86 && input.bestWave >= 9) return 'INSANE';
  if (input.averageAccuracy >= 68 && input.bestWave >= 5) return 'TACTICAL';
  if (input.averageAccuracy < 42) return 'EASY';
  return 'CASUAL';
};

export const appendSessionHistory = (
  history: SessionSnapshot[],
  newSnapshot: SessionSnapshot,
  maxItems = 20,
): SessionSnapshot[] =>
  [newSnapshot, ...history]
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, maxItems);

export const deriveSessionInsights = (history: SessionSnapshot[]): SessionInsights => {
  if (!history.length) {
    return {
      totalSessions: 0,
      averageAccuracy: 0,
      averageDurationMs: 0,
      bestScore: 0,
      bestWave: 0,
      recentSessions: [],
      recommendedDifficulty: 'CASUAL',
    };
  }

  const recentSessions = [...history].sort((a, b) => b.endedAt - a.endedAt).slice(0, 5);
  const totalScore = recentSessions.reduce((sum, session) => sum + session.score, 0);
  const totalAccuracy = recentSessions.reduce((sum, session) => sum + session.accuracy, 0);
  const totalDuration = recentSessions.reduce((sum, session) => sum + session.durationMs, 0);
  const bestScore = history.reduce((best, session) => Math.max(best, session.score), 0);
  const bestWave = history.reduce((best, session) => Math.max(best, session.highestWave), 0);
  const averageAccuracy = Number((totalAccuracy / recentSessions.length).toFixed(1));
  const averageDurationMs = Math.round(totalDuration / recentSessions.length);

  return {
    totalSessions: history.length,
    averageAccuracy,
    averageDurationMs,
    bestScore,
    bestWave,
    recentSessions,
    recommendedDifficulty: calculateRecommendedDifficulty({
      totalSessions: history.length,
      averageAccuracy,
      bestWave,
    }),
  };
};
