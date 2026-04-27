import { useState } from 'react';
import type { Tournament } from '../types';
import { useRealtime } from '../realtime';
import { MAX_NAME_LENGTH } from '../bracket';
import { joinUrl } from '../publicUrl';

interface Props {
  tournament: Tournament;
}

export function LobbyAdmin({ tournament }: Props) {
  const { join, removePlayer, start, errors } = useRealtime();
  const [manualName, setManualName] = useState('');
  const [shuffle, setShuffle] = useState(true);

  const players = tournament.players;
  const canStart = players.length >= 2;
  const bracketSize = canStart
    ? Math.max(2, 2 ** Math.ceil(Math.log2(players.length)))
    : 0;
  const byes = bracketSize - players.length;
  const lastError = errors.at(-1) ?? null;

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const name = manualName.trim();
    if (!name) return;
    join(name);
    setManualName('');
  };

  const onStart = () => {
    if (!canStart) return;
    start(shuffle);
  };

  const url = joinUrl();

  return (
    <div className="space-y-5">
      <div className="src-card p-4 space-y-1">
        <div className="text-xs uppercase tracking-wider text-muted-fg">
          Lobby
        </div>
        <div className="text-lg font-semibold">{tournament.name}</div>
        <div className="text-sm text-muted-fg break-all">
          Players join at{' '}
          <span className="font-mono text-primary">{url}</span>
        </div>
      </div>

      <div>
        <h2 className="text-xs uppercase tracking-wider text-muted-fg mb-2">
          Players · {players.length}
        </h2>
        {players.length === 0 ? (
          <div className="src-card p-4 text-sm text-muted-fg text-center">
            No one has joined yet. Show the QR code on the TV.
          </div>
        ) : (
          <ul className="space-y-2">
            {players.map((p, i) => (
              <li
                key={p.id}
                className="src-card flex items-center gap-3 px-3 py-2"
              >
                <span className="text-xs text-muted-fg tabular-nums w-6">
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-medium">{p.name}</span>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded text-muted-fg hover:text-destructive hover:bg-destructive/10 transition"
                  onClick={() => removePlayer(p.id)}
                  aria-label={`Remove ${p.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={submitManual} className="src-card p-4 space-y-3">
        <label className="text-xs uppercase tracking-wider text-muted-fg block">
          Add manually
        </label>
        <div className="flex gap-2">
          <input
            className="src-input flex-1"
            placeholder="Name"
            value={manualName}
            maxLength={MAX_NAME_LENGTH}
            onChange={e => setManualName(e.target.value)}
          />
          <button
            type="submit"
            className="src-btn-primary"
            disabled={!manualName.trim()}
          >
            Add
          </button>
        </div>
        {lastError && (
          <div className="text-xs text-destructive">{lastError}</div>
        )}
      </form>

      <div className="src-card p-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={shuffle}
            onChange={e => setShuffle(e.target.checked)}
          />
          <span className="text-sm">
            Randomize seeding{' '}
            <span className="text-muted-fg">
              (uncheck to use join order)
            </span>
          </span>
        </label>

        {canStart && (
          <div className="text-xs text-muted-fg">
            Bracket of {bracketSize} · {byes} bye{byes === 1 ? '' : 's'}
          </div>
        )}

        <button
          type="button"
          className="src-btn-primary w-full h-12 text-base"
          disabled={!canStart}
          onClick={onStart}
        >
          {canStart
            ? `Start tournament with ${players.length} player${players.length === 1 ? '' : 's'} →`
            : 'Need at least 2 players'}
        </button>
      </div>
    </div>
  );
}
