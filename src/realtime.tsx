import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ApiRequest, MutationResponse, StateResponse } from './protocol';
import type { MatchScore, Tournament } from './types';

const POLL_INTERVAL_MS = 1500;

export type ConnectionState = 'connecting' | 'open' | 'closed';

interface RealtimeContextValue {
  tournament: Tournament | null;
  /** True once we've received the first state response. */
  ready: boolean;
  connection: ConnectionState;
  authed: boolean;
  authError: string | null;
  errors: string[];
  joinedPlayerId: string | null;

  login: (password: string) => Promise<void>;
  logout: () => void;

  // Admin
  createLobby: (name: string) => Promise<void>;
  removePlayer: (playerId: string) => Promise<void>;
  start: (shuffleSeeds: boolean) => Promise<void>;
  record: (matchId: string, winnerSide: 0 | 1, score: MatchScore) => Promise<void>;
  clear: (matchId: string) => Promise<void>;
  reset: () => Promise<void>;

  // Public
  join: (name: string) => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const ADMIN_FLAG_KEY = 'pingtour:admin-cookie:v1';

import amplifyOutputs from '../amplify_outputs.json';

function apiBase(): string {
  // 1. Explicit override wins (e.g. local testing against a non-default backend).
  const override = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (override) return override.replace(/\/$/, '');
  // 2. Amplify Gen 2 writes the Function URL into amplify_outputs.json
  //    during the backend deploy phase of `npx ampx pipeline-deploy`.
  const url = (amplifyOutputs as { custom?: { apiUrl?: string } }).custom
    ?.apiUrl;
  if (url) return url.replace(/\/$/, '');
  // 3. Same origin (dev: Vite proxies /api → 3939).
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

async function getState(): Promise<StateResponse> {
  const r = await fetch(`${apiBase()}/api/state`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`state HTTP ${r.status}`);
  return r.json();
}

async function postMutation(req: ApiRequest): Promise<MutationResponse> {
  const r = await fetch(`${apiBase()}/api/mutate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(req),
  });
  return r.json();
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [ready, setReady] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [authed, setAuthed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ADMIN_FLAG_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [joinedPlayerId, setJoinedPlayerId] = useState<string | null>(null);

  const versionRef = useRef(-1);

  const applyState = useCallback((res: StateResponse) => {
    setReady(true);
    setConnection('open');
    if (res.version !== versionRef.current) {
      versionRef.current = res.version;
      setTournament(res.tournament);
    }
  }, []);

  const applyMutation = useCallback((res: MutationResponse) => {
    if (res.tournament !== undefined && typeof res.version === 'number') {
      applyState({ tournament: res.tournament, version: res.version });
    }
  }, [applyState]);

  const pushError = useCallback((msg: string) => {
    setErrors(prev => [...prev.slice(-4), msg]);
  }, []);

  // Polling loop. Tight (~1.5s) when alive, with backoff on failures.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let consecutiveErrors = 0;

    const tick = async () => {
      if (stopped) return;
      try {
        const res = await getState();
        consecutiveErrors = 0;
        applyState(res);
      } catch {
        consecutiveErrors++;
        setConnection('closed');
      }
      if (stopped) return;
      const delay = consecutiveErrors > 0
        ? Math.min(15000, 1000 * 2 ** Math.min(consecutiveErrors, 4))
        : POLL_INTERVAL_MS;
      timer = setTimeout(tick, delay);
    };

    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [applyState]);

  const login = useCallback(async (password: string) => {
    setAuthError(null);
    const res = await postMutation({ type: 'auth', password });
    if (res.authFail) {
      setAuthError('Wrong password');
      setAuthed(false);
      try { sessionStorage.removeItem(ADMIN_FLAG_KEY); } catch { /* */ }
      return;
    }
    if (res.ok) {
      setAuthed(true);
      try { sessionStorage.setItem(ADMIN_FLAG_KEY, '1'); } catch { /* */ }
      applyMutation(res);
    } else if (res.error) {
      pushError(res.error);
    }
  }, [applyMutation, pushError]);

  const logout = useCallback(() => {
    setAuthed(false);
    try { sessionStorage.removeItem(ADMIN_FLAG_KEY); } catch { /* */ }
    // Cookie expiry is handled server-side or on next browser cleanup.
    document.cookie = 'pingtour_admin=; Path=/; Max-Age=0';
  }, []);

  const sendMutation = useCallback(async (req: ApiRequest) => {
    const res = await postMutation(req);
    if (!res.ok) {
      pushError(res.error ?? 'Request failed');
      if (res.error === 'Not authenticated') {
        setAuthed(false);
        try { sessionStorage.removeItem(ADMIN_FLAG_KEY); } catch { /* */ }
      }
      return;
    }
    applyMutation(res);
    if (req.type === 'join' && res.playerId) {
      setJoinedPlayerId(res.playerId);
    }
  }, [applyMutation, pushError]);

  const createLobby = useCallback(
    (name: string) => sendMutation({ type: 'create-lobby', name }),
    [sendMutation],
  );
  const removePlayer = useCallback(
    (playerId: string) => sendMutation({ type: 'remove-player', playerId }),
    [sendMutation],
  );
  const start = useCallback(
    (shuffleSeeds: boolean) => sendMutation({ type: 'start', shuffleSeeds }),
    [sendMutation],
  );
  const join = useCallback(async (name: string) => {
    setJoinedPlayerId(null);
    await sendMutation({ type: 'join', name });
  }, [sendMutation]);
  const record = useCallback(
    (matchId: string, winnerSide: 0 | 1, score: MatchScore) =>
      sendMutation({ type: 'record', matchId, winnerSide, score }),
    [sendMutation],
  );
  const clear = useCallback(
    (matchId: string) => sendMutation({ type: 'clear', matchId }),
    [sendMutation],
  );
  const reset = useCallback(() => sendMutation({ type: 'reset' }), [sendMutation]);

  const value: RealtimeContextValue = {
    tournament,
    ready,
    connection,
    authed,
    authError,
    errors,
    joinedPlayerId,
    login,
    logout,
    createLobby,
    removePlayer,
    start,
    join,
    record,
    clear,
    reset,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used inside <RealtimeProvider>');
  }
  return ctx;
}
