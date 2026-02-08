import { BASE_AMMO, MAX_HEALTH } from '../config/gameConfig';
import { DifficultyLevel, GameState, GameStatus, MatchStats } from '../types';

const createBaseStats = (): MatchStats => ({
  shotsFired: 0,
  shotsHit: 0,
  enemiesDefeated: 0,
  highestWave: 1,
  currentStreak: 0,
  bestStreak: 0,
  sessionStartedAt: null,
  sessionEndedAt: null,
});

export const createInitialState = (difficulty: DifficultyLevel = 'EASY'): GameState => ({
  ammo: BASE_AMMO,
  maxAmmo: BASE_AMMO,
  score: 0,
  health: MAX_HEALTH,
  status: GameStatus.MENU,
  isReloading: false,
  lastDamageTime: 0,
  isGameOver: false,
  wave: 1,
  difficulty,
  stats: createBaseStats(),
});

export type GameAction =
  | { type: 'START_MATCH'; difficulty: DifficultyLevel; startedAt: number }
  | { type: 'RETURN_MENU'; difficulty: DifficultyLevel }
  | { type: 'PAUSE_MATCH' }
  | { type: 'RESUME_MATCH' }
  | { type: 'REGISTER_SHOT'; didHit: boolean }
  | { type: 'RELOAD_START' }
  | { type: 'RELOAD_COMPLETE' }
  | { type: 'TAKE_DAMAGE'; amount: number; at: number }
  | { type: 'ENEMY_DEFEATED'; points: number }
  | { type: 'SET_WAVE'; wave: number; at: number };

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'START_MATCH':
      return {
        ...createInitialState(action.difficulty),
        status: GameStatus.PLAYING,
        difficulty: action.difficulty,
        stats: {
          ...createBaseStats(),
          sessionStartedAt: action.startedAt,
        },
      };
    case 'RETURN_MENU':
      return createInitialState(action.difficulty);
    case 'PAUSE_MATCH':
      if (state.status !== GameStatus.PLAYING) return state;
      return { ...state, status: GameStatus.PAUSED };
    case 'RESUME_MATCH':
      if (state.status !== GameStatus.PAUSED) return state;
      return { ...state, status: GameStatus.PLAYING };
    case 'REGISTER_SHOT':
      if (state.status !== GameStatus.PLAYING || state.isReloading || state.ammo <= 0) return state;
      return {
        ...state,
        ammo: state.ammo - 1,
        stats: {
          ...state.stats,
          shotsFired: state.stats.shotsFired + 1,
          shotsHit: state.stats.shotsHit + (action.didHit ? 1 : 0),
          currentStreak: action.didHit ? state.stats.currentStreak + 1 : 0,
          bestStreak: action.didHit
            ? Math.max(state.stats.bestStreak, state.stats.currentStreak + 1)
            : state.stats.bestStreak,
        },
      };
    case 'RELOAD_START':
      if (state.isReloading || state.ammo === state.maxAmmo || state.status !== GameStatus.PLAYING) return state;
      return { ...state, isReloading: true };
    case 'RELOAD_COMPLETE':
      if (!state.isReloading) return state;
      return { ...state, isReloading: false, ammo: state.maxAmmo };
    case 'TAKE_DAMAGE': {
      if (state.status !== GameStatus.PLAYING || state.health <= 0) return state;
      const newHealth = Math.max(0, state.health - action.amount);
      const defeated = newHealth <= 0;
      return {
        ...state,
        health: newHealth,
        lastDamageTime: action.at,
        status: defeated ? GameStatus.GAMEOVER : state.status,
        isGameOver: defeated,
        stats: defeated
          ? {
              ...state.stats,
              sessionEndedAt: action.at,
            }
          : state.stats,
      };
    }
    case 'ENEMY_DEFEATED':
      if (state.status !== GameStatus.PLAYING) return state;
      return {
        ...state,
        score: state.score + action.points,
        stats: {
          ...state.stats,
          enemiesDefeated: state.stats.enemiesDefeated + 1,
        },
      };
    case 'SET_WAVE':
      if (state.status === GameStatus.MENU) return state;
      return {
        ...state,
        wave: action.wave,
        stats: {
          ...state.stats,
          highestWave: Math.max(action.wave, state.stats.highestWave),
          sessionEndedAt: state.status === GameStatus.GAMEOVER ? action.at : state.stats.sessionEndedAt,
        },
      };
    default:
      return state;
  }
};
