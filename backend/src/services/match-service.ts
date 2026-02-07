import { nanoid } from 'nanoid';
import { MatchRecord } from '../domain/types.js';
import { StoreRepository } from '../infrastructure/store/store-repository.js';
import { AppError } from '../shared/app-error.js';

interface MatchInput {
  score: number;
  accuracy: number;
  difficulty: 'CASUAL' | 'TACTICAL' | 'INSANE';
  durationMs: number;
  kills: number;
  highestWave: number;
}

export class MatchService {
  constructor(private readonly repository: StoreRepository) {}

  async submitMatch(userId: string, payload: MatchInput) {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new AppError('Usuário não encontrado.', 404, 'NOT_FOUND');

    const now = new Date().toISOString();
    const match: MatchRecord = {
      id: nanoid(),
      userId,
      score: payload.score,
      accuracy: Number(payload.accuracy.toFixed(2)),
      difficulty: payload.difficulty,
      durationMs: payload.durationMs,
      kills: payload.kills,
      highestWave: payload.highestWave,
      createdAt: now,
    };

    await this.repository.insertMatch(match);
    return match;
  }
}
