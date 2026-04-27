import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ClientMsg, ServerMsg } from './protocol';
import type { MatchScore, Tournament } from './types';

const PASSWORD_STORAGE_KEY = 'pingtour:admin-password:v1';

export type ConnectionState = 'connecting' | 'open' | 'closed';

interface RealtimeContextValue {
  tournament: Tournament | null;
  /** True once the server has sent its first state message. */
  ready: boolean;
  connection: ConnectionState;
  authed: boolean;
  authError: string | null;
  errors: string[];
  /** Set after a successful public `join` so the join page can show "you're in". */
  joinedPlayerId: string | null;

  login: (password: string) => void;
  logout: () => void;

  // Admin
  createLobby: (name: string) => void;
  removePlayer: (playerId: string) => void;
  start: (shuffleSeeds: boolean) => void;
  record: (matchId: string, winnerSide: 0 | 1, score: MatchScore) => void;
  clear: (matchId: string) => void;
  reset: () => void;

  // Public
  join: (name: string) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function wsUrl(): string {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [ready, setReady] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [joinedPlayerId, setJoinedPlayerId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const queueRef = useRef<ClientMsg[]>([]);

  const send = useCallback((msg: ClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      queueRef.current.push(msg);
    }
  }, []);

  useEffect(() => {
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      setConnection('connecting');
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        // If this effect was already torn down (StrictMode double-mount, or
        // a stale connection hand-off), don't let a dead socket touch shared
        // state — the live socket from the next effect run owns it.
        if (closed) return;
        reconnectAttemptsRef.current = 0;
        setConnection('open');
        const stored = sessionStorage.getItem(PASSWORD_STORAGE_KEY);
        if (stored) {
          ws.send(JSON.stringify({ type: 'auth', password: stored } satisfies ClientMsg));
        }
        for (const m of queueRef.current.splice(0)) {
          ws.send(JSON.stringify(m));
        }
      };

      ws.onclose = () => {
        if (closed) return;
        if (wsRef.current === ws) wsRef.current = null;
        setConnection('closed');
        setAuthed(false);
        const attempt = ++reconnectAttemptsRef.current;
        const delay = Math.min(15000, 500 * 2 ** Math.min(attempt, 5));
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose will fire after this — let it handle reconnection.
      };

      ws.onmessage = ev => {
        if (closed) return;
        let msg: ServerMsg;
        try {
          msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
        } catch {
          return;
        }
        if (msg.type === 'state') {
          setTournament(msg.tournament);
          setReady(true);
        } else if (msg.type === 'auth-ok') {
          setAuthed(true);
          setAuthError(null);
        } else if (msg.type === 'auth-fail') {
          setAuthed(false);
          setAuthError('Wrong password');
          sessionStorage.removeItem(PASSWORD_STORAGE_KEY);
        } else if (msg.type === 'error') {
          setErrors(prev => [...prev.slice(-4), msg.message]);
        } else if (msg.type === 'joined') {
          setJoinedPlayerId(msg.playerId);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const login = useCallback(
    (password: string) => {
      setAuthError(null);
      sessionStorage.setItem(PASSWORD_STORAGE_KEY, password);
      send({ type: 'auth', password });
    },
    [send],
  );

  const logout = useCallback(() => {
    sessionStorage.removeItem(PASSWORD_STORAGE_KEY);
    setAuthed(false);
    setAuthError(null);
  }, []);

  const createLobby = useCallback(
    (name: string) => send({ type: 'create-lobby', name }),
    [send],
  );

  const removePlayer = useCallback(
    (playerId: string) => send({ type: 'remove-player', playerId }),
    [send],
  );

  const start = useCallback(
    (shuffleSeeds: boolean) => send({ type: 'start', shuffleSeeds }),
    [send],
  );

  const join = useCallback(
    (name: string) => {
      setJoinedPlayerId(null);
      send({ type: 'join', name });
    },
    [send],
  );

  const record = useCallback(
    (matchId: string, winnerSide: 0 | 1, score: MatchScore) => {
      send({ type: 'record', matchId, winnerSide, score });
    },
    [send],
  );

  const clear = useCallback(
    (matchId: string) => send({ type: 'clear', matchId }),
    [send],
  );

  const reset = useCallback(() => send({ type: 'reset' }), [send]);

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
