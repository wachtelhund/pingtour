import type { Tournament, MatchScore } from './types';

/** Body shapes for POST /api/* endpoints. */
export type ApiRequest =
  | { type: 'auth'; password: string }
  | { type: 'create-lobby'; name: string }
  | { type: 'remove-player'; playerId: string }
  | { type: 'start'; shuffleSeeds: boolean }
  | { type: 'join'; name: string }
  | { type: 'record'; matchId: string; winnerSide: 0 | 1; score: MatchScore }
  | { type: 'clear'; matchId: string }
  | { type: 'reset' };

/** Response from GET /api/state. */
export interface StateResponse {
  tournament: Tournament | null;
  /** Monotonically increasing — clients can skip re-rendering when unchanged. */
  version: number;
}

/** Response from POST /api/* (auth + mutations). */
export interface MutationResponse {
  ok: boolean;
  /** Echo of the new state, so the client doesn't need to poll immediately. */
  tournament?: Tournament | null;
  version?: number;
  /** Returned on a successful public `join`. */
  playerId?: string;
  /** Server-side error message. */
  error?: string;
  /** True if password was wrong on `auth`. */
  authFail?: boolean;
}
