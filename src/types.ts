export type PlayerId = string;
export type MatchId = string;

export interface Player {
  id: PlayerId;
  name: string;
}

export interface MatchScore {
  /** Score for the player listed in `players[0]` */
  a: number;
  /** Score for the player listed in `players[1]` */
  b: number;
}

export interface Match {
  id: MatchId;
  /** 0 = first round, increasing toward final */
  round: number;
  /** Position within the round (top = 0) */
  slot: number;
  /** Both player slots; either may be null while still TBD */
  players: [PlayerId | null, PlayerId | null];
  /** Whichever side won, or null if not yet played */
  winner: 0 | 1 | null;
  /** Final score; null if not yet entered or this match was a bye */
  score: MatchScore | null;
  /** ISO timestamp when score was entered */
  completedAt: string | null;
  /** True when one slot is empty and the other auto-advances */
  bye: boolean;
}

export type TournamentStatus = 'lobby' | 'running' | 'complete';

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  createdAt: string;
  players: Player[];
  matches: Match[];
  /** Power-of-two bracket size (e.g., 64 for ≤64 players) */
  bracketSize: number;
  /** Final match id, for quick lookup of the winner */
  finalMatchId: MatchId | null;
}
