import { useMemo } from 'react';
import { Bracket } from './components/Bracket';
import { TopBar } from './components/TopBar';
import { UpNext } from './components/UpNext';
import { Standings } from './components/Standings';
import { LobbyDisplay } from './components/LobbyDisplay';
import { JoinView } from './components/JoinView';
import { readyMatches } from './bracket';
import { useRoute } from './router';
import { useRealtime } from './realtime';
import { AdminLogin } from './admin/AdminLogin';
import { AdminView } from './admin/AdminView';
import { Logo } from './components/Logo';
import { ConnectionBanner } from './components/ConnectionBanner';

export default function App() {
  const path = useRoute();
  if (path === '/admin' || path.startsWith('/admin/')) {
    return <AdminRoute />;
  }
  if (path === '/join' || path.startsWith('/join/')) {
    return <JoinView />;
  }
  return <DisplayRoute />;
}

function AdminRoute() {
  const { authed } = useRealtime();
  return authed ? <AdminView /> : <AdminLogin />;
}

function DisplayRoute() {
  const { tournament, ready, connection } = useRealtime();

  const playerById = useMemo(() => {
    if (!tournament) return new Map();
    return new Map(tournament.players.map(p => [p.id, p]));
  }, [tournament]);

  const readyM = useMemo(
    () => (tournament && tournament.status !== 'lobby' ? readyMatches(tournament) : []),
    [tournament],
  );

  if (!ready) {
    return <Connecting />;
  }

  if (!tournament) {
    return (
      <>
        <ConnectionBanner connection={connection} />
        <NoTournament />
      </>
    );
  }

  if (tournament.status === 'lobby') {
    return (
      <>
        <ConnectionBanner connection={connection} />
        <LobbyDisplay tournament={tournament} />
      </>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <TopBar tournament={tournament} />
      <ConnectionBanner connection={connection} />

      <main className="flex-1 px-6 py-6 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6 min-w-0">
          <UpNext matches={readyM} playerById={playerById} />
          <section className="src-card p-4">
            <h2 className="text-sm uppercase tracking-wider text-muted-fg mb-3 px-1">
              Bracket
            </h2>
            <Bracket tournament={tournament} playerById={playerById} />
          </section>
        </div>

        <aside className="min-w-0">
          <Standings tournament={tournament} />
        </aside>
      </main>
    </div>
  );
}

function NoTournament() {
  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="src-card max-w-md w-full p-8 text-center space-y-4">
        <div className="flex justify-center">
          <Logo size={40} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Pingtour</h1>
        <p className="text-muted-fg">
          No tournament running. Open a lobby from the admin view.
        </p>
        <a href="/admin" className="src-btn-primary inline-flex">
          Go to admin →
        </a>
      </div>
    </div>
  );
}

function Connecting() {
  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="text-muted-fg flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulseRing" />
        Connecting to tournament server…
      </div>
    </div>
  );
}
