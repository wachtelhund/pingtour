import { describe, expect, it } from 'vitest';
import {
  activePlayers,
  addPlayer,
  createLobby,
  createTournament,
  nextPowerOfTwo,
  readyMatches,
  recordResult,
  removePlayer,
  seedOrder,
  startTournament,
} from './bracket';
import type { Player } from './types';

const mkPlayers = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i + 1}` }));

const noShuffle = { shuffleSeeds: false } as const;

describe('nextPowerOfTwo', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 8],
    [50, 64],
    [64, 64],
    [65, 128],
    [70, 128],
  ])('nextPowerOfTwo(%i) === %i', (n, expected) => {
    expect(nextPowerOfTwo(n)).toBe(expected);
  });
});

describe('seedOrder', () => {
  it('size 8 matches standard tennis order', () => {
    expect(seedOrder(8)).toEqual([0, 7, 3, 4, 1, 6, 2, 5]);
  });

  it('every first-round pair sums to size - 1', () => {
    for (const size of [2, 4, 8, 16, 64]) {
      const o = seedOrder(size);
      for (let i = 0; i < o.length; i += 2) {
        expect(o[i] + o[i + 1]).toBe(size - 1);
      }
    }
  });
});

describe('createTournament', () => {
  it('throws with fewer than 2 players', () => {
    expect(() => createTournament('x', mkPlayers(1))).toThrow();
  });

  it('produces a power-of-two bracket', () => {
    const t = createTournament('x', mkPlayers(50), noShuffle);
    expect(t.bracketSize).toBe(64);
    // Total matches = bracketSize - 1
    expect(t.matches.length).toBe(63);
  });

  it('marks byes for top seeds when player count is not a power of two', () => {
    const t = createTournament('x', mkPlayers(5), noShuffle);
    expect(t.bracketSize).toBe(8);
    const round0 = t.matches.filter(m => m.round === 0);
    expect(round0).toHaveLength(4);
    const byes = round0.filter(m => m.bye);
    expect(byes).toHaveLength(3);
    // Top seed (p0) must have advanced via bye
    const r1 = t.matches.filter(m => m.round === 1);
    const advancedIds = r1.flatMap(m => m.players).filter(Boolean);
    expect(advancedIds).toContain('p0');
  });

  it('handles 50-player bracket without double-byes (every bye match has exactly 1 player)', () => {
    const t = createTournament('x', mkPlayers(50), noShuffle);
    const round0Byes = t.matches.filter(m => m.round === 0 && m.bye);
    for (const m of round0Byes) {
      const filled = m.players.filter(p => p !== null).length;
      expect(filled).toBe(1);
    }
  });
});

describe('recordResult and advancement', () => {
  it('advances the winner to the next round', () => {
    const t = createTournament('x', mkPlayers(4), noShuffle);
    const r0 = t.matches.filter(m => m.round === 0);
    const t2 = recordResult(t, {
      matchId: r0[0].id,
      winnerSide: 0,
      score: { a: 3, b: 1 },
    });
    const m1 = t2.matches.find(m => m.round === 1)!;
    expect(m1.players[0]).toBe(t.matches[0].players[0]);
  });

  it('marks tournament complete when final is decided', () => {
    const t = createTournament('x', mkPlayers(4), noShuffle);
    let cur = t;
    // Play both semis
    for (const m of cur.matches.filter(m => m.round === 0)) {
      cur = recordResult(cur, { matchId: m.id, winnerSide: 0, score: { a: 3, b: 0 } });
    }
    expect(cur.status).toBe('running');
    const final = cur.matches.find(m => m.id === cur.finalMatchId)!;
    cur = recordResult(cur, { matchId: final.id, winnerSide: 1, score: { a: 1, b: 3 } });
    expect(cur.status).toBe('complete');
  });

  it('rejects 3–2 scores', () => {
    const t = createTournament('x', mkPlayers(4), noShuffle);
    const r0 = t.matches.filter(m => m.round === 0)[0];
    expect(() =>
      recordResult(t, { matchId: r0.id, winnerSide: 0, score: { a: 3, b: 2 } }),
    ).toThrow(/win by 2/i);
  });
});

describe('lobby flow', () => {
  it('creates an empty lobby in lobby status', () => {
    const t = createLobby('Test Open');
    expect(t.status).toBe('lobby');
    expect(t.players).toEqual([]);
    expect(t.matches).toEqual([]);
    expect(t.bracketSize).toBe(0);
  });

  it('falls back to a default name when given empty/whitespace', () => {
    expect(createLobby('   ').name).toBe('Pingtour');
  });

  it('addPlayer trims and rejects empties, length, and duplicates', () => {
    let t = createLobby('x');
    t = addPlayer(t, '  Alice  ');
    expect(t.players[0].name).toBe('Alice');
    expect(() => addPlayer(t, 'alice')).toThrow(/already taken/i);
    expect(() => addPlayer(t, '')).toThrow(/required/i);
    expect(() => addPlayer(t, 'x'.repeat(41))).toThrow(/too long/i);
  });

  it('rejects addPlayer on a running tournament', () => {
    const t = createTournament('x', [
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
    ], { shuffleSeeds: false });
    expect(() => addPlayer(t, 'c')).toThrow(/already started/i);
  });

  it('removePlayer drops the matching id and is a no-op for unknown', () => {
    let t = addPlayer(addPlayer(createLobby('x'), 'A'), 'B');
    const aliceId = t.players[0].id;
    t = removePlayer(t, aliceId);
    expect(t.players.map(p => p.name)).toEqual(['B']);
    t = removePlayer(t, 'no-such-id');
    expect(t.players).toHaveLength(1);
  });

  it('startTournament builds a bracket and preserves lobby identity', () => {
    let lobby = createLobby('Test Open');
    for (const n of ['A', 'B', 'C', 'D']) lobby = addPlayer(lobby, n);
    const started = startTournament(lobby, { shuffleSeeds: false });
    expect(started.status).toBe('running');
    expect(started.bracketSize).toBe(4);
    expect(started.matches).toHaveLength(3);
    expect(started.id).toBe(lobby.id);
    expect(started.createdAt).toBe(lobby.createdAt);
    expect(started.players.map(p => p.name)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('startTournament rejects fewer than 2 players', () => {
    const lobby = addPlayer(createLobby('x'), 'A');
    expect(() => startTournament(lobby)).toThrow(/at least 2/i);
  });

  it('startTournament rejects on a non-lobby tournament', () => {
    const lobby = addPlayer(addPlayer(createLobby('x'), 'A'), 'B');
    const started = startTournament(lobby, { shuffleSeeds: false });
    expect(() => startTournament(started)).toThrow(/already started/i);
  });
});

describe('readyMatches and activePlayers', () => {
  it('readyMatches lists only matches with both players present and undecided', () => {
    const t = createTournament('x', mkPlayers(5), noShuffle);
    const ready = readyMatches(t);
    // 5 players, bracket 8 → 1 real first-round match (3 byes)
    expect(ready.length).toBeGreaterThanOrEqual(1);
    for (const m of ready) {
      expect(m.players[0]).not.toBeNull();
      expect(m.players[1]).not.toBeNull();
      expect(m.winner).toBeNull();
      expect(m.bye).toBe(false);
    }
  });

  it('activePlayers excludes losers', () => {
    const t = createTournament('x', mkPlayers(4), noShuffle);
    const r0 = t.matches.filter(m => m.round === 0)[0];
    const t2 = recordResult(t, {
      matchId: r0.id,
      winnerSide: 0,
      score: { a: 3, b: 0 },
    });
    const loserId = r0.players[1]!;
    expect(activePlayers(t2)).not.toContain(loserId);
  });
});
