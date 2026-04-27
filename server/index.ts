import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  addPlayer,
  clearResult,
  createLobby,
  recordResult,
  removePlayer,
  startTournament,
} from '../src/bracket';
import type { ClientMsg, ServerMsg } from '../src/protocol';
import type { Tournament } from '../src/types';
import { dataFilePath, loadState, saveState } from './state';

const PORT = Number(process.env.PORT ?? 3939);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'pingpong123';
const STATIC_DIR = path.resolve('dist');

let tournament: Tournament | null = loadState();

const httpServer = http.createServer((req, res) => {
  const u = url.parse(req.url ?? '');
  if (u.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  serveStatic(req, res);
});

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  if (!fs.existsSync(STATIC_DIR)) {
    res.writeHead(404);
    res.end('No static build. Run `pnpm build` first.');
    return;
  }
  const u = url.parse(req.url ?? '');
  const reqPath = decodeURIComponent(u.pathname ?? '/');
  // Resolve and confine to STATIC_DIR.
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
    // SPA fallback — serve index.html for unknown paths.
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

const wss = new WebSocketServer({ noServer: true });
const authed = new WeakSet<WebSocket>();

httpServer.on('upgrade', (req, socket, head) => {
  const u = url.parse(req.url ?? '');
  if (u.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', ws => {
  send(ws, { type: 'state', tournament });
  ws.on('message', raw => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    handleMessage(ws, msg);
  });
});

function handleMessage(ws: WebSocket, msg: ClientMsg) {
  if (msg.type === 'auth') {
    if (typeof msg.password === 'string' && msg.password === ADMIN_PASSWORD) {
      authed.add(ws);
      send(ws, { type: 'auth-ok' });
    } else {
      send(ws, { type: 'auth-fail' });
    }
    return;
  }

  // Public mutation: anyone scanning the QR can add themselves to the lobby.
  if (msg.type === 'join') {
    try {
      if (!tournament || tournament.status !== 'lobby') {
        throw new Error('No lobby is open');
      }
      const before = tournament.players.length;
      tournament = addPlayer(tournament, msg.name);
      const newPlayer = tournament.players[before];
      saveState(tournament);
      send(ws, { type: 'joined', playerId: newPlayer.id });
      broadcast({ type: 'state', tournament });
    } catch (e) {
      send(ws, {
        type: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
    return;
  }

  if (!authed.has(ws)) {
    send(ws, { type: 'error', message: 'Not authenticated' });
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
    saveState(tournament);
    broadcast({ type: 'state', tournament });
  } catch (e) {
    send(ws, {
      type: 'error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function broadcast(msg: ServerMsg) {
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
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
  console.log(`[pingtour] http+ws on http://localhost:${PORT}`);
  console.log(`[pingtour] data file: ${dataFilePath()}`);
  if (ADMIN_PASSWORD === 'pingpong123') {
    console.log('[pingtour] using default ADMIN_PASSWORD — set $ADMIN_PASSWORD to change');
  }
});

const shutdown = () => {
  console.log('\n[pingtour] shutting down…');
  wss.close();
  httpServer.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
