import type { Tournament, MatchScore } from './types';

/**
 * Messages from client to server.
 *
 * `join` is the only mutation that does NOT require an authenticated
 * connection — anyone with the public link can add themselves to a lobby.
 * Every other mutation requires `auth` to have succeeded first.
 */
export type ClientMsg =
  // Auth
  | { type: 'auth'; password: string }
  // Lobby — admin-only
  | { type: 'create-lobby'; name: string }
  | { type: 'remove-player'; playerId: string }
  | { type: 'start'; shuffleSeeds: boolean }
  // Lobby — public (no auth)
  | { type: 'join'; name: string }
  // Running tournament — admin-only
  | {
      type: 'record';
      matchId: string;
      winnerSide: 0 | 1;
      score: MatchScore;
    }
  | { type: 'clear'; matchId: string }
  | { type: 'reset' };

/** Messages from server to client. */
export type ServerMsg =
  | { type: 'state'; tournament: Tournament | null }
  | { type: 'auth-ok' }
  | { type: 'auth-fail' }
  | { type: 'error'; message: string }
  /**
   * Confirms a public `join` request and returns the new player's id so the
   * joining client can show "you're in" UX without guessing.
   */
  | { type: 'joined'; playerId: string };
