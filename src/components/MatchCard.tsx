import type { Match, Player } from '../types';

interface Props {
  match: Match;
  playerById: Map<string, Player>;
  onClick?: (m: Match) => void;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
}

export function MatchCard({
  match,
  playerById,
  onClick,
  size = 'sm',
  highlight = false,
}: Props) {
  const [aId, bId] = match.players;
  const a = aId ? playerById.get(aId) : null;
  const b = bId ? playerById.get(bId) : null;
  const ready = a && b && match.winner === null && !match.bye;
  const decided = match.winner !== null;
  const interactive = !match.bye && (ready || decided) && !!onClick;

  const dims = {
    sm: 'min-w-[180px] text-xs',
    md: 'min-w-[260px] text-sm',
    lg: 'min-w-[360px] text-lg',
  }[size];

  const rowDims = {
    sm: 'h-7 px-3',
    md: 'h-9 px-4',
    lg: 'h-12 px-5',
  }[size];

  return (
    <button
      type="button"
      onClick={interactive ? () => onClick!(match) : undefined}
      disabled={!interactive}
      className={[
        'src-card overflow-hidden text-left transition w-full',
        dims,
        interactive ? 'cursor-pointer hover:border-primary/60' : 'cursor-default',
        highlight ? 'border-primary shadow-glow animate-pulseRing' : '',
        match.bye ? 'opacity-40' : '',
      ].join(' ')}
    >
      <Row
        label={a?.name ?? (match.bye ? '—' : 'TBD')}
        score={match.score?.a}
        winner={match.winner === 0}
        loser={decided && match.winner !== 0}
        rowDims={rowDims}
      />
      <div className="h-px bg-border" />
      <Row
        label={b?.name ?? (match.bye ? '—' : 'TBD')}
        score={match.score?.b}
        winner={match.winner === 1}
        loser={decided && match.winner !== 1}
        rowDims={rowDims}
      />
    </button>
  );
}

function Row({
  label,
  score,
  winner,
  loser,
  rowDims,
}: {
  label: string;
  score?: number;
  winner: boolean;
  loser: boolean;
  rowDims: string;
}) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-3',
        rowDims,
        winner ? 'bg-accent text-accent-fg font-semibold' : '',
        loser ? 'text-muted-fg' : '',
      ].join(' ')}
    >
      <span className="truncate">{label}</span>
      <span
        className={[
          'tabular-nums w-6 text-right',
          winner ? 'text-primary font-bold' : '',
        ].join(' ')}
      >
        {score ?? ''}
      </span>
    </div>
  );
}
