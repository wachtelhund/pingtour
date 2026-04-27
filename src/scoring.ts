import type { MatchScore } from './types';

export const TARGET_SCORE = 3;

export interface ScoreValidation {
  ok: boolean;
  reason?: string;
}

/**
 * Ping pong scoring (best-of-one game): first to TARGET_SCORE points,
 * but a player must win by 2. If both reach TARGET_SCORE - 1, play
 * continues until someone leads by 2.
 */
export function validateScore(winner: number, loser: number): ScoreValidation {
  if (!Number.isInteger(winner) || !Number.isInteger(loser)) {
    return { ok: false, reason: 'Scores must be whole numbers' };
  }
  if (winner < 0 || loser < 0) {
    return { ok: false, reason: 'Scores cannot be negative' };
  }
  if (winner <= loser) {
    return { ok: false, reason: 'Winner must score more than loser' };
  }
  if (winner < TARGET_SCORE) {
    return { ok: false, reason: `Winner needs at least ${TARGET_SCORE} points` };
  }

  // Standard win: reached target before loser hit deuce threshold.
  if (winner === TARGET_SCORE && loser < TARGET_SCORE - 1) {
    return { ok: true };
  }

  // Deuce win: both reached TARGET_SCORE - 1, then someone led by 2.
  if (loser >= TARGET_SCORE - 1 && winner - loser === 2) {
    return { ok: true };
  }

  if (winner === TARGET_SCORE && loser === TARGET_SCORE - 1) {
    return {
      ok: false,
      reason: `At ${TARGET_SCORE - 1}–${TARGET_SCORE - 1} you must win by 2`,
    };
  }

  return { ok: false, reason: 'Win must be by exactly 2 once tied at deuce' };
}

/** Margin (winner - loser). Used as a standings tiebreaker. */
export function margin(score: MatchScore, winnerSide: 0 | 1): number {
  return winnerSide === 0 ? score.a - score.b : score.b - score.a;
}
