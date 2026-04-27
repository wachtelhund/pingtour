import { useMemo } from 'react';
import type { Match, Player, Tournament } from '../types';
import { margin } from '../scoring';

interface Row {
  player: Player;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  marginSum: number;
  eliminated: boolean;
  finishedRound: number | null; // round of last loss; higher = went further
}

function buildStandings(t: Tournament): Row[] {
  const byId = new Map(t.players.map(p => [p.id, p]));
  const rows = new Map<string, Row>();
  for (const p of t.players) {
    rows.set(p.id, {
      player: p,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      marginSum: 0,
      eliminated: false,
      finishedRound: null,
    });
  }
  for (const m of t.matches) {
    if (m.bye || m.winner === null || !m.score) continue;
    const winnerId = m.players[m.winner]!;
    const loserId = m.players[m.winner === 0 ? 1 : 0]!;
    const w = rows.get(winnerId);
    const l = rows.get(loserId);
    if (!w || !l) continue;
    const winnerPts = m.winner === 0 ? m.score.a : m.score.b;
    const loserPts = m.winner === 0 ? m.score.b : m.score.a;
    w.wins++;
    w.pointsFor += winnerPts;
    w.pointsAgainst += loserPts;
    w.marginSum += margin(m.score, m.winner);
    l.losses++;
    l.pointsFor += loserPts;
    l.pointsAgainst += winnerPts;
    l.eliminated = true;
    l.finishedRound = m.round;
  }
  for (const r of rows.values()) {
    r.pointDiff = r.pointsFor - r.pointsAgainst;
    if (!r.eliminated) {
      // Active players "finish" at the latest round they've appeared in.
      const latest = latestRoundFor(t.matches, r.player.id);
      r.finishedRound = latest;
    }
  }
  return [...rows.values()].sort(rankCompare);
  // unused: byId — left for future expansion
  void byId;
}

function latestRoundFor(matches: Match[], pid: string): number {
  let latest = -1;
  for (const m of matches) {
    if (m.players.includes(pid) && m.round > latest) latest = m.round;
  }
  return latest;
}

function rankCompare(a: Row, b: Row): number {
  // Active players ahead of eliminated.
  if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
  // Within group: deeper round first.
  const ra = a.finishedRound ?? -1;
  const rb = b.finishedRound ?? -1;
  if (ra !== rb) return rb - ra;
  // Then more wins.
  if (a.wins !== b.wins) return b.wins - a.wins;
  // Then point differential.
  if (a.pointDiff !== b.pointDiff) return b.pointDiff - a.pointDiff;
  return a.player.name.localeCompare(b.player.name);
}

interface Props {
  tournament: Tournament;
}

export function Standings({ tournament }: Props) {
  const rows = useMemo(() => buildStandings(tournament), [tournament]);
  const champion =
    tournament.status === 'complete' && tournament.finalMatchId
      ? (() => {
          const f = tournament.matches.find(
            m => m.id === tournament.finalMatchId,
          );
          if (!f || f.winner === null) return null;
          return tournament.players.find(p => p.id === f.players[f.winner!]) ?? null;
        })()
      : null;

  return (
    <div className="space-y-4">
      {champion && (
        <div className="src-card p-5 border-primary shadow-glow">
          <div className="text-xs uppercase tracking-wider text-muted-fg">
            Champion
          </div>
          <div className="text-2xl font-bold text-primary mt-1">
            🏓 {champion.name}
          </div>
        </div>
      )}

      <div className="src-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm uppercase tracking-wider text-muted-fg">
            Standings
          </h3>
          <span className="text-xs text-muted-fg">
            {rows.filter(r => !r.eliminated).length} active
          </span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary text-muted-fg text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 w-8">#</th>
                <th className="text-left px-3 py-2">Player</th>
                <th className="text-right px-2 py-2">W</th>
                <th className="text-right px-2 py-2">L</th>
                <th className="text-right px-3 py-2">+/-</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.player.id}
                  className={[
                    'border-t border-border/40',
                    r.eliminated ? 'text-muted-fg' : '',
                  ].join(' ')}
                >
                  <td className="px-3 py-2 tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2 truncate max-w-[160px]">
                    {r.player.name}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.wins}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.losses}</td>
                  <td
                    className={[
                      'px-3 py-2 text-right tabular-nums',
                      r.pointDiff > 0 ? 'text-primary' : '',
                      r.pointDiff < 0 ? 'text-destructive' : '',
                    ].join(' ')}
                  >
                    {r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
