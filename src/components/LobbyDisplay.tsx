import { QRCodeSVG } from 'qrcode.react';
import type { Tournament } from '../types';
import { joinUrl } from '../publicUrl';

interface Props {
  tournament: Tournament;
}

export function LobbyDisplay({ tournament }: Props) {
  const url = joinUrl();
  const players = tournament.players;
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 pt-8 pb-4 flex items-center justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-primary">
            Pingtour · lobby
          </div>
          <h1 className="text-4xl font-bold tracking-tight mt-2">
            {tournament.name}
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-6xl font-bold tabular-nums">
              {players.length}
            </div>
            <div className="text-sm uppercase tracking-wider text-muted-fg">
              joined
            </div>
          </div>
          <a href="/admin" className="src-btn-ghost text-xs">
            Admin
          </a>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8 p-8 pt-2">
        <section className="src-card p-6 flex flex-col items-center gap-4 self-start">
          <div className="text-xs uppercase tracking-wider text-muted-fg">
            Scan to join
          </div>
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG
              value={url}
              size={360}
              level="M"
              marginSize={1}
            />
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-fg">…or open</div>
            <div className="font-mono text-base text-primary break-all max-w-[360px]">
              {url}
            </div>
          </div>
        </section>

        <section className="src-card p-6 min-h-[400px]">
          <div className="text-sm uppercase tracking-wider text-muted-fg mb-4">
            Players
          </div>
          {players.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-fg">
              <div className="text-center space-y-2">
                <div className="text-4xl">🏓</div>
                <div>Waiting for the first player to scan in…</div>
              </div>
            </div>
          ) : (
            <ul
              className="grid gap-2"
              style={{
                gridTemplateColumns:
                  'repeat(auto-fill, minmax(220px, 1fr))',
              }}
            >
              {players.map((p, i) => (
                <li
                  key={p.id}
                  className="src-card bg-bg/40 px-4 py-3 flex items-center gap-3"
                >
                  <span className="text-xs text-muted-fg tabular-nums w-6">
                    {i + 1}
                  </span>
                  <span className="font-medium truncate">{p.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="px-8 pb-8 text-sm text-muted-fg">
        Waiting for the host to start the tournament…
      </footer>
    </div>
  );
}
