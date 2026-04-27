import type { Tournament } from '../types';
import { Logo } from './Logo';
import { navigate } from '../router';

interface Props {
  tournament: Tournament;
}

export function TopBar({ tournament }: Props) {
  const total = tournament.matches.filter(m => !m.bye).length;
  const played = tournament.matches.filter(m => !m.bye && m.winner !== null).length;
  const pct = total === 0 ? 0 : Math.round((played / total) * 100);

  return (
    <header className="border-b border-border bg-secondary/40 backdrop-blur sticky top-0 z-30">
      <div className="px-6 py-3 flex items-center gap-4">
        <Logo size={28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-bold tracking-tight truncate">
              {tournament.name}
            </h1>
            <span className="text-xs uppercase tracking-wider text-muted-fg">
              {tournament.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="h-1 flex-1 max-w-[280px] bg-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-fg tabular-nums">
              {played}/{total} matches · {pct}%
            </span>
          </div>
        </div>
        <button
          type="button"
          className="src-btn-ghost"
          onClick={() => navigate('/admin')}
        >
          Admin
        </button>
      </div>
    </header>
  );
}
