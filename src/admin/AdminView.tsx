import { useMemo, useState } from 'react';
import { useRealtime } from '../realtime';
import { readyMatches } from '../bracket';
import { ScoreEntry } from '../components/ScoreEntry';
import { LobbyAdmin } from '../components/LobbyAdmin';
import { OpenLobby } from '../components/OpenLobby';
import { Logo } from '../components/Logo';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { navigate } from '../router';
import type { Match, Player, Tournament } from '../types';

export function AdminView() {
  const {
    tournament,
    ready,
    connection,
    errors,
    record,
    clear,
    reset,
    logout,
  } = useRealtime();
  const [editing, setEditing] = useState<Match | null>(null);

  const playerById = useMemo<Map<string, Player>>(() => {
    if (!tournament) return new Map();
    return new Map(tournament.players.map(p => [p.id, p]));
  }, [tournament]);

  // Keep `editing` in sync with the latest server state — when the server
  // broadcasts a new tournament, we want the modal to reflect the updated
  // match (e.g. cleared result) without closing.
  const liveEditing = useMemo<Match | null>(() => {
    if (!editing || !tournament) return null;
    return tournament.matches.find(m => m.id === editing.id) ?? null;
  }, [editing, tournament]);

  if (!ready) {
    return (
      <Frame onReset={null} onLogout={logout}>
        <ConnectionBanner connection={connection} />
        <div className="p-8 text-center text-muted-fg">
          Connecting to tournament server…
        </div>
      </Frame>
    );
  }

  if (!tournament) {
    return (
      <Frame onReset={null} onLogout={logout}>
        <ConnectionBanner connection={connection} />
        <main className="px-4 py-4 max-w-2xl mx-auto">
          <OpenLobby />
        </main>
      </Frame>
    );
  }

  const onReset = () => {
    if (
      confirm('Discard the current tournament and start over? This cannot be undone.')
    ) {
      reset();
    }
  };

  if (tournament.status === 'lobby') {
    return (
      <Frame title={tournament.name} onReset={onReset} onLogout={logout}>
        <ConnectionBanner connection={connection} />
        <main className="px-4 py-4 max-w-2xl mx-auto">
          <LobbyAdmin tournament={tournament} />
        </main>
      </Frame>
    );
  }

  const readyM = readyMatches(tournament);
  const completed = tournament.matches
    .filter(m => !m.bye && m.winner !== null && m.completedAt)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  return (
    <Frame title={tournament.name} onReset={onReset} onLogout={logout}>
      <ConnectionBanner connection={connection} />

      <main className="px-4 py-4 max-w-2xl mx-auto space-y-6">
        <ProgressStrip tournament={tournament} />

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-fg mb-2">
            Up next · {readyM.length}
          </h2>
          {readyM.length === 0 ? (
            <div className="src-card p-4 text-sm text-muted-fg text-center">
              {tournament.status === 'complete'
                ? 'Tournament complete 🏆'
                : 'No matches ready right now.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {readyM.map(m => (
                <MatchRow
                  key={m.id}
                  match={m}
                  playerById={playerById}
                  onTap={() => setEditing(m)}
                />
              ))}
            </ul>
          )}
        </section>

        {completed.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-wider text-muted-fg mb-2">
              Recently played · tap to edit
            </h2>
            <ul className="space-y-2">
              {completed.slice(0, 20).map(m => (
                <MatchRow
                  key={m.id}
                  match={m}
                  playerById={playerById}
                  onTap={() => setEditing(m)}
                />
              ))}
            </ul>
            {completed.length > 20 && (
              <p className="text-xs text-muted-fg mt-2 text-center">
                Showing 20 of {completed.length} played matches
              </p>
            )}
          </section>
        )}

        <ErrorList errors={errors} />
      </main>

      <ScoreEntry
        open={liveEditing !== null}
        match={liveEditing}
        playerById={playerById}
        onClose={() => setEditing(null)}
        onRecord={(matchId, side, score) => record(matchId, side, score)}
        onClear={matchId => clear(matchId)}
        error={errors.at(-1) ?? null}
      />
    </Frame>
  );
}

function Frame({
  children,
  onReset,
  title,
  onLogout,
}: {
  children: React.ReactNode;
  onReset: (() => void) | null;
  title?: string;
  onLogout: () => void;
}) {
  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-secondary/60 backdrop-blur sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <Logo size={26} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold tracking-tight truncate">
              {title ? title : 'Pingtour Admin'}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-fg">
              Admin
            </div>
          </div>
          <button
            type="button"
            className="src-btn-ghost text-xs px-3 py-1.5"
            onClick={() => navigate('/')}
          >
            Display
          </button>
          {onReset && (
            <button
              type="button"
              className="src-btn-ghost text-xs px-3 py-1.5"
              onClick={onReset}
            >
              Reset
            </button>
          )}
          <button
            type="button"
            className="src-btn-ghost text-xs px-3 py-1.5"
            onClick={onLogout}
          >
            Lock
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}

function ProgressStrip({ tournament }: { tournament: Tournament }) {
  const total = tournament.matches.filter(m => !m.bye).length;
  const played = tournament.matches.filter(m => !m.bye && m.winner !== null).length;
  const pct = total === 0 ? 0 : Math.round((played / total) * 100);
  return (
    <div className="src-card p-3 flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-muted-fg tabular-nums whitespace-nowrap">
        {played}/{total} · {pct}%
      </div>
    </div>
  );
}

function MatchRow({
  match,
  playerById,
  onTap,
}: {
  match: Match;
  playerById: Map<string, Player>;
  onTap: () => void;
}) {
  const a = match.players[0] ? playerById.get(match.players[0]!) : null;
  const b = match.players[1] ? playerById.get(match.players[1]!) : null;
  const decided = match.winner !== null;
  return (
    <li>
      <button
        type="button"
        onClick={onTap}
        className="src-card w-full p-3 text-left hover:border-primary/60 active:scale-[0.99] transition"
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-fg">
            Round {match.round + 1} · #{match.slot + 1}
          </span>
          {decided ? (
            <span className="text-[10px] uppercase tracking-wider text-muted-fg">
              tap to edit
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
              ready
            </span>
          )}
        </div>
        <PlayerLine
          name={a?.name ?? 'TBD'}
          score={match.score?.a}
          isWinner={match.winner === 0}
          isLoser={decided && match.winner !== 0}
        />
        <PlayerLine
          name={b?.name ?? 'TBD'}
          score={match.score?.b}
          isWinner={match.winner === 1}
          isLoser={decided && match.winner !== 1}
        />
      </button>
    </li>
  );
}

function PlayerLine({
  name,
  score,
  isWinner,
  isLoser,
}: {
  name: string;
  score?: number;
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-3 py-1',
        isWinner ? 'font-semibold text-primary' : '',
        isLoser ? 'text-muted-fg' : '',
      ].join(' ')}
    >
      <span className="truncate text-base">{name}</span>
      <span className="tabular-nums text-base w-6 text-right">
        {score ?? ''}
      </span>
    </div>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  const last = errors.at(-1)!;
  return (
    <div className="src-card border-destructive/60 p-3 text-sm text-destructive">
      Server: {last}
    </div>
  );
}
