import { useMemo } from 'react';
import type { Match, Player, Tournament } from '../types';
import { MatchCard } from './MatchCard';

interface Props {
  tournament: Tournament;
  playerById: Map<string, Player>;
  onMatchClick?: (m: Match) => void;
}

const ROUND_LABELS_BY_REMAINING: Record<number, string> = {
  1: 'Final',
  2: 'Semifinals',
  4: 'Quarterfinals',
  8: 'Round of 16',
  16: 'Round of 32',
  32: 'Round of 64',
  64: 'Round of 128',
};

function roundLabel(round: number, totalRounds: number, matchesInRound: number): string {
  if (round === totalRounds - 1) return 'Final';
  return ROUND_LABELS_BY_REMAINING[matchesInRound] ?? `Round ${round + 1}`;
}

export function Bracket({ tournament, playerById, onMatchClick }: Props) {
  const totalRounds = Math.log2(tournament.bracketSize);

  const matchesByRound = useMemo(() => {
    const m = new Map<number, Match[]>();
    for (let r = 0; r < totalRounds; r++) m.set(r, []);
    for (const match of tournament.matches) {
      m.get(match.round)!.push(match);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.slot - b.slot);
    return m;
  }, [tournament.matches, totalRounds]);

  const readyIds = useMemo(() => {
    return new Set(
      tournament.matches
        .filter(
          m =>
            !m.bye &&
            m.winner === null &&
            m.players[0] !== null &&
            m.players[1] !== null,
        )
        .map(m => m.id),
    );
  }, [tournament.matches]);

  return (
    <div className="overflow-x-auto pb-6">
      <div className="flex gap-6 min-h-[600px] px-2">
        {Array.from({ length: totalRounds }, (_, round) => {
          const ms = matchesByRound.get(round) ?? [];
          const isFinal = round === totalRounds - 1;
          return (
            <div key={round} className="flex flex-col min-w-[200px]">
              <div className="text-xs uppercase tracking-wider text-muted-fg mb-3 px-1">
                {roundLabel(round, totalRounds, ms.length)}
              </div>
              <div className="bracket-col flex-1 gap-2">
                {ms.map(match => (
                  <div key={match.id} className="flex items-center">
                    <MatchCard
                      match={match}
                      playerById={playerById}
                      onClick={onMatchClick}
                      size={isFinal ? 'md' : 'sm'}
                      highlight={readyIds.has(match.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
