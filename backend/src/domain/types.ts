export type UserRole = 'PLAYER' | 'ADMIN';
export type DifficultyLevel = 'CASUAL' | 'TACTICAL' | 'INSANE';

export interface CalibrationSettings {
  movementCenterX: number;
  movementCenterY: number;
  movementDeadzone: number;
  fistStopThreshold: number;
  indexExtendedThreshold: number;
  fireCurlThreshold: number;
  openHandThreshold: number;
  smoothingFrames: number;
}

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface MatchRecord {
  id: string;
  userId: string;
  score: number;
  accuracy: number;
  difficulty: DifficultyLevel;
  durationMs: number;
  kills: number;
  highestWave: number;
  createdAt: string;
}

export interface CalibrationRecord extends CalibrationSettings {
  userId: string;
  updatedAt: string;
}

export interface OperationalMetrics {
  apiRequests: number;
  authFailures: number;
  matchesSubmitted: number;
}

export interface StoreState {
  users: UserRecord[];
  matches: MatchRecord[];
  calibrations: CalibrationRecord[];
  metrics: OperationalMetrics;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface MatchSummary {
  totalMatches: number;
  totalKills: number;
  bestScore: number;
  averageScore: number;
  averageAccuracy: number;
  averageDurationMs: number;
}
