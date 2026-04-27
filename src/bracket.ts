import type { Match, MatchScore, Player, PlayerId, Tournament } from './types';
import { validateScore } from './scoring';

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

/**
 * Standard tennis-style seed order: pairs in the first round always sum to
 * `size - 1`, so the top seed faces the lowest, etc. Built recursively so
 * winners only meet "later" seeds in deeper rounds.
 */
export function seedOrder(size: number): number[] {
  if (size <= 1) return [0];
  const half = seedOrder(size / 2);
  const out: number[] = [];
  for (const s of half) {
    out.push(s);
    out.push(size - 1 - s);
  }
  return out;
}

function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface CreateOptions {
  shuffleSeeds?: boolean;
  rng?: () => number;
}

export function createTournament(
  name: string,
  players: Player[],
  opts: CreateOptions = {},
): Tournament {
  if (players.length < 2) {
    throw new Error('Need at least 2 players to start a tournament');
  }
  const ordered = opts.shuffleSeeds === false
    ? [...players]
    : shuffle(players, opts.rng);
  const bracketSize = Math.max(2, nextPowerOfTwo(ordered.length));
  const seedToPlayer: (PlayerId | null)[] = Array.from(
    { length: bracketSize },
    (_, seed) => ordered[seed]?.id ?? null,
  );
  const order = seedOrder(bracketSize);
  // bracket position bp -> player at seed `order[bp]`
  const slots: (PlayerId | null)[] = order.map(s => seedToPlayer[s]);
  const matches = buildMatches(slots, bracketSize);
  const finalMatch = matches.find(m => m.round === Math.log2(bracketSize) - 1) ?? null;
  return {
    id: cryptoRandomId(),
    name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: ordered,
    matches,
    bracketSize,
    finalMatchId: finalMatch?.id ?? null,
  };
}

export const MAX_NAME_LENGTH = 40;

/** Create an empty lobby that players can join until the admin starts it. */
export function createLobby(name: string): Tournament {
  return {
    id: cryptoRandomId(),
    name: name.trim() || 'Pingtour',
    status: 'lobby',
    createdAt: new Date().toISOString(),
    players: [],
    matches: [],
    bracketSize: 0,
    finalMatchId: null,
  };
}

/** Add a player to a lobby. Throws on validation errors. */
export function addPlayer(t: Tournament, rawName: string): Tournament {
  if (t.status !== 'lobby') {
    throw new Error('Tournament has already started');
  }
  const name = rawName.trim();
  if (!name) throw new Error('Name is required');
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Name too long (max ${MAX_NAME_LENGTH} characters)`);
  }
  const lower = name.toLowerCase();
  if (t.players.some(p => p.name.toLowerCase() === lower)) {
    throw new Error('That name is already taken');
  }
  return {
    ...t,
    players: [...t.players, { id: cryptoRandomId(), name }],
  };
}

/** Remove a player from a lobby. */
export function removePlayer(t: Tournament, playerId: PlayerId): Tournament {
  if (t.status !== 'lobby') {
    throw new Error('Cannot remove players after the tournament has started');
  }
  return { ...t, players: t.players.filter(p => p.id !== playerId) };
}

/** Convert a lobby into a running tournament by building the bracket. */
export function startTournament(
  t: Tournament,
  opts: CreateOptions = {},
): Tournament {
  if (t.status !== 'lobby') {
    throw new Error('Tournament has already started');
  }
  if (t.players.length < 2) {
    throw new Error('Need at least 2 players to start a tournament');
  }
  // Reuse createTournament's bracket generation, but preserve the lobby's
  // identity (id, createdAt, name) so links/QR codes don't change.
  const built = createTournament(t.name, t.players, opts);
  return { ...built, id: t.id, createdAt: t.createdAt };
}

function buildMatches(slots: (PlayerId | null)[], size: number): Match[] {
  const totalRounds = Math.log2(size);
  const matches: Match[] = [];
  for (let round = 0; round < totalRounds; round++) {
    const inRound = size / 2 ** (round + 1);
    for (let slot = 0; slot < inRound; slot++) {
      matches.push({
        id: `r${round}-s${slot}`,
        round,
        slot,
        players: round === 0
          ? [slots[2 * slot] ?? null, slots[2 * slot + 1] ?? null]
          : [null, null],
        winner: null,
        score: null,
        completedAt: null,
        bye: false,
      });
    }
  }
  // Round-0 byes only: a first-round match with exactly one player auto-
  // advances. With nextPowerOfTwo + standard seed order, double-byes can't
  // occur (the seed pairs always sum to size-1, and N > size/2 by construction
  // of nextPowerOfTwo), so we don't need to cascade beyond round 0.
  for (const m of matches) {
    if (m.round !== 0) continue;
    const [a, b] = m.players;
    if (a !== null && b !== null) continue;
    if (a === null && b === null) continue; // shouldn't happen — leave inert
    m.bye = true;
    m.winner = a !== null ? 0 : 1;
    const winnerId = (a ?? b)!;
    advanceWinner(matches, m, winnerId, totalRounds);
  }
  return matches;
}

function advanceWinner(
  matches: Match[],
  from: Match,
  winnerId: PlayerId,
  totalRounds: number,
): void {
  if (from.round + 1 >= totalRounds) return;
  const nextSlot = Math.floor(from.slot / 2);
  const nextPos = (from.slot % 2) as 0 | 1;
  const next = matches.find(
    m => m.round === from.round + 1 && m.slot === nextSlot,
  );
  if (!next) return;
  next.players[nextPos] = winnerId;
}

export interface RecordResult {
  matchId: string;
  winnerSide: 0 | 1;
  score: MatchScore;
}

/**
 * Records a result for a match and advances the winner. Returns the new
 * tournament state. Throws if the match isn't ready or score is invalid.
 */
export function recordResult(t: Tournament, r: RecordResult): Tournament {
  const matches = t.matches.map(m => ({ ...m, players: [...m.players] as Match['players'] }));
  const m = matches.find(x => x.id === r.matchId);
  if (!m) throw new Error('Match not found');
  if (m.players[0] === null || m.players[1] === null) {
    throw new Error('Match is not ready: missing player');
  }
  if (m.bye) throw new Error('Cannot record a result on a bye');
  const winnerScore = r.winnerSide === 0 ? r.score.a : r.score.b;
  const loserScore = r.winnerSide === 0 ? r.score.b : r.score.a;
  const v = validateScore(winnerScore, loserScore);
  if (!v.ok) throw new Error(v.reason ?? 'Invalid score');
  m.winner = r.winnerSide;
  m.score = r.score;
  m.completedAt = new Date().toISOString();
  const winnerId = m.players[r.winnerSide]!;
  const totalRounds = Math.log2(t.bracketSize);
  advanceWinner(matches, m, winnerId, totalRounds);
  const status: Tournament['status'] =
    t.finalMatchId &&
    matches.find(x => x.id === t.finalMatchId)?.winner !== null
      ? 'complete'
      : 'running';
  return { ...t, matches, status };
}

/** Reset a previously-recorded match (does not unwind downstream matches). */
export function clearResult(t: Tournament, matchId: string): Tournament {
  const matches = t.matches.map(m => ({ ...m, players: [...m.players] as Match['players'] }));
  const m = matches.find(x => x.id === matchId);
  if (!m) throw new Error('Match not found');
  if (m.bye) throw new Error('Cannot clear a bye');
  // Find downstream match and remove the advanced player from it.
  const totalRounds = Math.log2(t.bracketSize);
  if (m.round + 1 < totalRounds && m.winner !== null) {
    const nextSlot = Math.floor(m.slot / 2);
    const nextPos = (m.slot % 2) as 0 | 1;
    const next = matches.find(
      x => x.round === m.round + 1 && x.slot === nextSlot,
    );
    if (next) {
      // If the next match has already been played, abort — too risky.
      if (next.winner !== null) {
        throw new Error('Cannot edit: downstream match already decided');
      }
      next.players[nextPos] = null;
    }
  }
  m.winner = null;
  m.score = null;
  m.completedAt = null;
  return { ...t, matches, status: 'running' };
}

/** Matches that are ready to play (both players known, not yet decided). */
export function readyMatches(t: Tournament): Match[] {
  return t.matches.filter(
    m =>
      !m.bye &&
      m.winner === null &&
      m.players[0] !== null &&
      m.players[1] !== null,
  );
}

export function activePlayers(t: Tournament): PlayerId[] {
  // A player is "active" if they have not lost a non-bye match.
  const eliminated = new Set<PlayerId>();
  for (const m of t.matches) {
    if (m.bye || m.winner === null) continue;
    const loserId = m.players[m.winner === 0 ? 1 : 0];
    if (loserId) eliminated.add(loserId);
  }
  return t.players.map(p => p.id).filter(id => !eliminated.has(id));
}

export function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
