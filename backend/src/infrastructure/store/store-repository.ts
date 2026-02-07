import {
  CalibrationRecord,
  CalibrationSettings,
  DifficultyLevel,
  MatchRecord,
  MatchSummary,
  OperationalMetrics,
  PublicUser,
  UserRecord,
} from '../../domain/types.js';
import { JsonFileStore } from './json-file-store.js';

interface LeaderboardFilters {
  limit: number;
  difficulty?: DifficultyLevel;
  days?: number;
}

const nowMinusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.getTime();
};

const toPublicUser = (user: UserRecord): PublicUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt,
});

export class StoreRepository {
  constructor(private readonly store: JsonFileStore) {}

  getPublicUser(user: UserRecord) {
    return toPublicUser(user);
  }

  async findUserByEmail(email: string) {
    return this.store.read((state) => state.users.find((user) => user.email === email) ?? null);
  }

  async findUserById(userId: string) {
    return this.store.read((state) => state.users.find((user) => user.id === userId) ?? null);
  }

  async createUser(user: UserRecord) {
    await this.store.write((state) => {
      state.users.push(user);
    });
    return user;
  }

  async updateUserLogin(userId: string, at: string) {
    await this.store.write((state) => {
      const user = state.users.find((entry) => entry.id === userId);
      if (!user) return;
      user.lastLoginAt = at;
      user.updatedAt = at;
    });
  }

  async insertMatch(match: MatchRecord) {
    await this.store.write((state) => {
      state.matches.push(match);
      state.metrics.matchesSubmitted += 1;
    });
    return match;
  }

  async listMatchesByUser(userId: string, limit: number) {
    return this.store.read((state) =>
      state.matches
        .filter((match) => match.userId === userId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit),
    );
  }

  async getMatchSummary(userId: string, days: number): Promise<MatchSummary> {
    return this.store.read((state) => {
      const cutoff = nowMinusDays(days);
      const matches = state.matches.filter(
        (match) => match.userId === userId && Date.parse(match.createdAt) >= cutoff,
      );

      if (matches.length === 0) {
        return {
          totalMatches: 0,
          totalKills: 0,
          bestScore: 0,
          averageScore: 0,
          averageAccuracy: 0,
          averageDurationMs: 0,
        };
      }

      const totalScore = matches.reduce((sum, match) => sum + match.score, 0);
      const totalAccuracy = matches.reduce((sum, match) => sum + match.accuracy, 0);
      const totalDuration = matches.reduce((sum, match) => sum + match.durationMs, 0);
      const totalKills = matches.reduce((sum, match) => sum + match.kills, 0);
      const bestScore = matches.reduce((best, match) => Math.max(best, match.score), 0);

      return {
        totalMatches: matches.length,
        totalKills,
        bestScore,
        averageScore: Number((totalScore / matches.length).toFixed(2)),
        averageAccuracy: Number((totalAccuracy / matches.length).toFixed(2)),
        averageDurationMs: Math.round(totalDuration / matches.length),
      };
    });
  }

  async getLeaderboard(filters: LeaderboardFilters) {
    return this.store.read((state) => {
      const cutoff = filters.days ? nowMinusDays(filters.days) : null;

      const filtered = state.matches.filter((match) => {
        if (filters.difficulty && match.difficulty !== filters.difficulty) return false;
        if (cutoff && Date.parse(match.createdAt) < cutoff) return false;
        return true;
      });

      const byUser = new Map<
        string,
        { userId: string; displayName: string; bestScore: number; bestAccuracy: number; totalMatches: number }
      >();

      for (const match of filtered) {
        const user = state.users.find((entry) => entry.id === match.userId);
        if (!user) continue;

        const current = byUser.get(match.userId);
        if (!current) {
          byUser.set(match.userId, {
            userId: match.userId,
            displayName: user.displayName,
            bestScore: match.score,
            bestAccuracy: match.accuracy,
            totalMatches: 1,
          });
          continue;
        }

        current.totalMatches += 1;
        if (match.score > current.bestScore) {
          current.bestScore = match.score;
          current.bestAccuracy = match.accuracy;
        }
      }

      return Array.from(byUser.values())
        .sort((a, b) => b.bestScore - a.bestScore || b.bestAccuracy - a.bestAccuracy)
        .slice(0, filters.limit);
    });
  }

  async getCalibration(userId: string) {
    return this.store.read((state) => state.calibrations.find((entry) => entry.userId === userId) ?? null);
  }

  async upsertCalibration(userId: string, calibration: CalibrationSettings) {
    const updatedAt = new Date().toISOString();
    await this.store.write((state) => {
      const existing = state.calibrations.find((entry) => entry.userId === userId);
      if (existing) {
        Object.assign(existing, calibration, { updatedAt });
        return;
      }

      const newRecord: CalibrationRecord = {
        userId,
        updatedAt,
        ...calibration,
      };
      state.calibrations.push(newRecord);
    });

    return this.getCalibration(userId);
  }

  async incrementAuthFailures() {
    await this.store.write((state) => {
      state.metrics.authFailures += 1;
    });
  }

  async getMetrics(): Promise<OperationalMetrics> {
    return this.store.read((state) => ({ ...state.metrics }));
  }

  async getTotals() {
    return this.store.read((state) => ({
      users: state.users.length,
      matches: state.matches.length,
      calibrations: state.calibrations.length,
    }));
  }
}
