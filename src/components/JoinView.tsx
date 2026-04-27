import { useEffect, useMemo, useState } from 'react';
import { useRealtime } from '../realtime';
import { ConnectionBanner } from './ConnectionBanner';
import { Logo } from './Logo';
import { MAX_NAME_LENGTH } from '../bracket';

const LOCAL_KEY = 'pingtour:joined-player:v1';

interface JoinedRef {
  tournamentId: string;
  playerId: string;
  name: string;
}

function loadJoined(): JoinedRef | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as JoinedRef) : null;
  } catch {
    return null;
  }
}

function saveJoined(j: JoinedRef | null) {
  try {
    if (j === null) localStorage.removeItem(LOCAL_KEY);
    else localStorage.setItem(LOCAL_KEY, JSON.stringify(j));
  } catch {
    /* ignore */
  }
}

export function JoinView() {
  const { tournament, ready, connection, errors, join, joinedPlayerId } =
    useRealtime();
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const remembered = useMemo<JoinedRef | null>(loadJoined, []);

  // Persist a successful join so a reload keeps you on the "you're in" screen.
  useEffect(() => {
    if (joinedPlayerId && tournament) {
      saveJoined({
        tournamentId: tournament.id,
        playerId: joinedPlayerId,
        name: name.trim(),
      });
    }
  }, [joinedPlayerId, tournament, name]);

  if (!ready) {
    return (
      <Shell>
        <div className="text-muted-fg flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulseRing" />
          Connecting…
        </div>
      </Shell>
    );
  }

  if (!tournament) {
    return (
      <Shell>
        <div className="src-card p-6 text-center space-y-2 max-w-sm w-full">
          <h2 className="text-lg font-semibold">No tournament yet</h2>
          <p className="text-muted-fg text-sm">
            Wait for the host to open the lobby, then come back to this page.
          </p>
        </div>
      </Shell>
    );
  }

  // Player previously joined this same lobby — show "you're in" state.
  const livePlayer =
    remembered && remembered.tournamentId === tournament.id
      ? tournament.players.find(p => p.id === remembered.playerId)
      : null;
  const recentlyJoined =
    joinedPlayerId &&
    tournament.players.find(p => p.id === joinedPlayerId);
  const me = recentlyJoined ?? livePlayer ?? null;

  if (tournament.status !== 'lobby') {
    return (
      <Shell>
        <ConnectionBanner connection={connection} />
        <div className="src-card p-6 text-center space-y-3 max-w-sm w-full">
          <div className="text-3xl">🏓</div>
          <h2 className="text-xl font-semibold">{tournament.name}</h2>
          <p className="text-muted-fg text-sm">
            {tournament.status === 'complete'
              ? 'Tournament has finished. See the bracket on the main display.'
              : 'Tournament is already underway. Watch the bracket on the main display.'}
          </p>
          <a className="src-btn-primary inline-flex" href="/">
            View bracket →
          </a>
        </div>
      </Shell>
    );
  }

  if (me) {
    return (
      <Shell>
        <ConnectionBanner connection={connection} />
        <div className="src-card p-6 text-center space-y-3 max-w-sm w-full">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-semibold">You're in, {me.name}!</h2>
          <p className="text-muted-fg text-sm">
            {tournament.players.length} player
            {tournament.players.length === 1 ? '' : 's'} in the lobby
          </p>
          <p className="text-xs text-muted-fg">
            Wait for the host to start the tournament.
          </p>
        </div>
      </Shell>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitted(true);
    join(name);
  };

  const liveError = submitted ? (errors.at(-1) ?? null) : null;

  return (
    <Shell>
      <ConnectionBanner connection={connection} />
      <form
        onSubmit={submit}
        className="src-card p-6 space-y-5 max-w-sm w-full"
      >
        <div className="text-center space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-fg">
            Joining
          </div>
          <h2 className="text-xl font-bold">{tournament.name}</h2>
          <p className="text-xs text-muted-fg">
            {tournament.players.length} already in
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Your name</label>
          <input
            autoFocus
            className="src-input text-base h-12"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={e => {
              setName(e.target.value);
              if (submitted) setSubmitted(false);
            }}
            placeholder="Your name"
          />
          {liveError && (
            <div className="text-sm text-destructive">{liveError}</div>
          )}
        </div>

        <button
          type="submit"
          className="src-btn-primary w-full h-12 text-base"
          disabled={!name.trim() || connection !== 'open'}
        >
          Join tournament
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      <div className="px-6 py-6 flex items-center gap-3 max-w-sm mx-auto">
        <Logo size={28} />
        <div>
          <div className="text-base font-bold tracking-tight">Pingtour</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-fg">
            Join lobby
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 pb-12">
        {children}
      </div>
    </div>
  );
}
