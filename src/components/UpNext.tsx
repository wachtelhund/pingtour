import type { Match, Player } from '../types';
import { MatchCard } from './MatchCard';

interface Props {
  matches: Match[];
  playerById: Map<string, Player>;
  onMatchClick?: (m: Match) => void;
}

export function UpNext({ matches, playerById, onMatchClick }: Props) {
  if (matches.length === 0) {
    return (
      <div className="src-card p-6 text-center text-muted-fg">
        No matches ready right now.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulseRing" />
        <h2 className="text-sm uppercase tracking-wider text-muted-fg">
          Up next · {matches.length} match{matches.length === 1 ? '' : 'es'} ready
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {matches.slice(0, 9).map(m => (
          <MatchCard
            key={m.id}
            match={m}
            playerById={playerById}
            onClick={onMatchClick}
            size="md"
            highlight
          />
        ))}
      </div>
    </div>
  );
}
