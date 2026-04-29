import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';
import {
  addPlayer,
  clearResult,
  createLobby,
  recordResult,
  removePlayer,
  startTournament,
} from '../src/bracket';
import type { ApiRequest, MutationResponse, StateResponse } from '../src/protocol';
import type { Tournament } from '../src/types';
import { dataFilePath, loadState, saveState } from './state';

const PORT = Number(process.env.PORT ?? 3939);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'pingpong123';
const STATIC_DIR = path.resolve('dist');

let tournament: Tournament | null = loadState();
let version = 0;

/** Cookie-based admin sessions, kept in memory. */
const adminSessions = new Set<string>();

const httpServer = http.createServer(async (req, res) => {
  try {
    const u = url.parse(req.url ?? '');
    const pathname = u.pathname ?? '/';

    if (pathname === '/healthz') {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (pathname === '/api/state' && req.method === 'GET') {
      sendJson<StateResponse>(res, 200, { tournament, version });
      return;
    }
    if (pathname === '/api/mutate' && req.method === 'POST') {
      const body = await readJson<ApiRequest>(req);
      handleMutation(req, res, body);
      return;
    }

    serveStatic(req, res);
  } catch (e) {
    console.error('[pingtour] handler error:', e);
    sendJson(res, 500, { ok: false, error: 'Internal server error' });
  }
});

function handleMutation(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  msg: ApiRequest,
) {
  // Auth + public join are special-cased before the auth gate.
  if (msg.type === 'auth') {
    if (typeof msg.password === 'string' && msg.password === ADMIN_PASSWORD) {
      const token = crypto.randomBytes(24).toString('hex');
      adminSessions.add(token);
      res.setHeader(
        'Set-Cookie',
        `pingtour_admin=${token}; Path=/; SameSite=Lax; HttpOnly; Max-Age=86400`,
      );
      sendMutation(res, { ok: true, tournament, version });
      return;
    }
    sendMutation(res, { ok: false, authFail: true });
    return;
  }

  if (msg.type === 'join') {
    try {
      if (!tournament || tournament.status !== 'lobby') {
        throw new Error('No lobby is open');
      }
      const before = tournament.players.length;
      tournament = addPlayer(tournament, msg.name);
      const newPlayer = tournament.players[before];
      bumpAndPersist();
      sendMutation(res, {
        ok: true,
        tournament,
        version,
        playerId: newPlayer.id,
      });
    } catch (e) {
      sendMutation(res, {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return;
  }

  // Everything else requires the admin cookie.
  if (!isAdmin(req)) {
    sendMutation(res, { ok: false, error: 'Not authenticated' });
    return;
  }

  try {
    if (msg.type === 'create-lobby') {
      tournament = createLobby(msg.name);
    } else if (msg.type === 'remove-player') {
      if (!tournament) throw new Error('No tournament running');
      tournament = removePlayer(tournament, msg.playerId);
    } else if (msg.type === 'start') {
      if (!tournament) throw new Error('No lobby to start');
      tournament = startTournament(tournament, {
        shuffleSeeds: msg.shuffleSeeds,
      });
    } else if (msg.type === 'record') {
      if (!tournament) throw new Error('No tournament running');
      tournament = recordResult(tournament, {
        matchId: msg.matchId,
        winnerSide: msg.winnerSide,
        score: msg.score,
      });
    } else if (msg.type === 'clear') {
      if (!tournament) throw new Error('No tournament running');
      tournament = clearResult(tournament, msg.matchId);
    } else if (msg.type === 'reset') {
      tournament = null;
    }
    bumpAndPersist();
    sendMutation(res, { ok: true, tournament, version });
  } catch (e) {
    sendMutation(res, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

function bumpAndPersist() {
  version++;
  saveState(tournament);
}

function isAdmin(req: http.IncomingMessage): boolean {
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(/(?:^|;\s*)pingtour_admin=([^;]+)/);
  return match ? adminSessions.has(match[1]) : false;
}

async function readJson<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw || '{}') as T;
}

function sendJson<T>(res: http.ServerResponse, status: number, body: T) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function sendMutation(res: http.ServerResponse, body: MutationResponse) {
  sendJson(res, body.ok ? 200 : 400, body);
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  if (!fs.existsSync(STATIC_DIR)) {
    res.writeHead(404);
    res.end('No static build. Run `pnpm build` first.');
    return;
  }
  const u = url.parse(req.url ?? '');
  const reqPath = decodeURIComponent(u.pathname ?? '/');
  const candidate = path.normalize(path.join(STATIC_DIR, reqPath));
  if (!candidate.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  let target = candidate;
  let stat: fs.Stats | null = null;
  try {
    stat = fs.statSync(target);
  } catch {
    stat = null;
  }
  if (stat?.isDirectory()) {
    target = path.join(target, 'index.html');
    try {
      stat = fs.statSync(target);
    } catch {
      stat = null;
    }
  }
  if (!stat) {
    target = path.join(STATIC_DIR, 'index.html');
    try {
      stat = fs.statSync(target);
    } catch {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
  }
  res.writeHead(200, { 'content-type': contentType(target) });
  fs.createReadStream(target).pipe(res);
}

function contentType(p: string): string {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.ico': return 'image/x-icon';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  }
}

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[pingtour] port ${PORT} is already in use. Set $PORT to a free port.`,
    );
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, () => {
  console.log(`[pingtour] http on http://localhost:${PORT}`);
  console.log(`[pingtour] data file: ${dataFilePath()}`);
  if (ADMIN_PASSWORD === 'pingpong123') {
    console.log('[pingtour] using default ADMIN_PASSWORD — set $ADMIN_PASSWORD to change');
  }
});

const shutdown = () => {
  console.log('\n[pingtour] shutting down…');
  httpServer.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
