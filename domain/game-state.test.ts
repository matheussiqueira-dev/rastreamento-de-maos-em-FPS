import { describe, expect, it } from 'vitest';
import { BASE_AMMO, MAX_HEALTH } from '../config/gameConfig';
import { GameStatus } from '../types';
import { createInitialState, gameReducer, GameAction } from './game-state';

const play = (...actions: GameAction[]) =>
  actions.reduce(gameReducer, gameReducer(createInitialState('CASUAL'), {
    type: 'START_MATCH',
    difficulty: 'CASUAL',
    startedAt: 1_000,
  }));

describe('gameReducer', () => {
  it('inicia a partida com estado limpo e horário de início', () => {
    const state = play();
    expect(state.status).toBe(GameStatus.PLAYING);
    expect(state.ammo).toBe(BASE_AMMO);
    expect(state.health).toBe(MAX_HEALTH);
    expect(state.stats.sessionStartedAt).toBe(1_000);
  });

  it('contabiliza disparos, acertos e sequências', () => {
    const state = play(
      { type: 'REGISTER_SHOT', didHit: true },
      { type: 'REGISTER_SHOT', didHit: true },
      { type: 'REGISTER_SHOT', didHit: false },
      { type: 'REGISTER_SHOT', didHit: true },
    );
    expect(state.ammo).toBe(BASE_AMMO - 4);
    expect(state.stats).toMatchObject({ shotsFired: 4, shotsHit: 3, currentStreak: 1, bestStreak: 2 });
  });

  it('ignora disparos sem munição e durante a recarga', () => {
    const empty = play(...Array.from({ length: BASE_AMMO + 3 }, () => ({ type: 'REGISTER_SHOT', didHit: false }) as const));
    expect(empty.ammo).toBe(0);
    expect(empty.stats.shotsFired).toBe(BASE_AMMO);

    const reloading = gameReducer(empty, { type: 'RELOAD_START' });
    expect(gameReducer(reloading, { type: 'REGISTER_SHOT', didHit: true })).toBe(reloading);
    expect(gameReducer(reloading, { type: 'RELOAD_COMPLETE' }).ammo).toBe(BASE_AMMO);
  });

  it('encerra a partida quando a vida chega a zero', () => {
    const state = play({ type: 'TAKE_DAMAGE', amount: MAX_HEALTH + 50, at: 9_000 });
    expect(state.health).toBe(0);
    expect(state.status).toBe(GameStatus.GAMEOVER);
    expect(state.stats.sessionEndedAt).toBe(9_000);
    expect(gameReducer(state, { type: 'TAKE_DAMAGE', amount: 10, at: 9_500 })).toBe(state);
  });

  it('não altera o estado enquanto pausado', () => {
    const paused = play({ type: 'PAUSE_MATCH' });
    expect(paused.status).toBe(GameStatus.PAUSED);
    expect(gameReducer(paused, { type: 'TAKE_DAMAGE', amount: 10, at: 2_000 })).toBe(paused);
    expect(gameReducer(paused, { type: 'ENEMY_DEFEATED', points: 100 })).toBe(paused);
    expect(gameReducer(paused, { type: 'RESUME_MATCH' }).status).toBe(GameStatus.PLAYING);
  });

  it('registra a maior onda alcançada', () => {
    const state = play({ type: 'SET_WAVE', wave: 4, at: 2_000 }, { type: 'SET_WAVE', wave: 3, at: 3_000 });
    expect(state.wave).toBe(3);
    expect(state.stats.highestWave).toBe(4);
  });
});
