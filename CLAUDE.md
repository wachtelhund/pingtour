# Pingtour — agent notes

A real-time single-page React app for running a Sourceful ping-pong
tournament. TV at `/` (read-only display); phone at `/admin`
(password-gated, mobile-first score entry). State is held canonically by
a Node WebSocket server and broadcast to all connected clients.

## Architecture

```
server/
  index.ts        http + ws server, mutation handler, static file serving
  state.ts        load/save tournament JSON (atomic write via temp+rename)
src/
  protocol.ts     ClientMsg / ServerMsg types (shared with server)
  realtime.tsx    RealtimeProvider + useRealtime() hook (the only state source)
  router.ts       Tiny pathname router (useRoute, navigate)
  types.ts        Tournament, Match, Player, MatchScore
  scoring.ts      validateScore() — first-to-3, win-by-2 (deuce)
  bracket.ts      createTournament, recordResult, clearResult, seedOrder
  App.tsx         Routes between display and admin
  main.tsx        Entry — wraps App in <RealtimeProvider>
  components/
    OpenLobby      Empty-state form admin sees with no tournament
    LobbyAdmin     Admin's lobby view: player list, manual add, Start
    LobbyDisplay   TV's lobby view: QR code + player roster
    JoinView       Public /join page — scans land here from the QR
    TopBar         Display header for running tournament + "Admin" link
    UpNext         Read-only ready-match strip
    Bracket        Round-by-round columns
    MatchCard      Two-row card (display only by default)
    ScoreEntry     Modal that calls onRecord / onClear callbacks
    Standings      Sorted player table
    ConnectionBanner  Warning bar when WS not open
    Logo           Inline SVG mark
  admin/
    AdminLogin     Password form; sends {type:'auth'} via realtime
    AdminView      Routes between OpenLobby, LobbyAdmin, and the score-entry list
```

## Protocol

REST + polling. Clients hit `GET /api/state` every ~1.5s and `POST
/api/mutate` for changes (see `src/protocol.ts`). Admin auth is via an
HTTP-only cookie (`pingtour_admin`) issued by `POST /api/mutate` with
`{type:"auth"}`.

```
GET  /api/state                          → { tournament, version }
POST /api/mutate { type:"auth", password } → sets cookie + returns state
POST /api/mutate { type:"create-lobby"  } // requires admin cookie
POST /api/mutate { type:"remove-player" } // requires admin cookie
POST /api/mutate { type:"start" }         // requires admin cookie
POST /api/mutate { type:"join", name }    // PUBLIC — no auth
POST /api/mutate { type:"record" }        // requires admin cookie
POST /api/mutate { type:"clear" }         // requires admin cookie
POST /api/mutate { type:"reset" }         // requires admin cookie
```

`Tournament.status` cycles: `'lobby'` → `'running'` → `'complete'`.
A lobby has empty `matches` and `bracketSize === 0`. `startTournament()`
preserves the lobby's `id` and `createdAt` so QR codes remain valid.

Each successful mutation bumps an in-memory `version` counter. The
client tracks the last-seen version and only re-renders when it
changes, which makes the 1.5s poll cheap (just a tiny JSON if nothing's
changed, no React re-renders).

After applying a mutation, the server saves to `data/tournament.json` and
broadcasts the new `state` to every connected client (including the
sender). Clients are pure subscribers — they don't keep a separate local
copy of state to optimistic-update.

## Auth

- `ADMIN_PASSWORD` env var on the server (default `pingpong123`).
- Client POSTs `{type:'auth', password}`; on success the server issues
  an HTTP-only cookie `pingtour_admin=<random>` (24h max-age) and adds
  the token to its in-memory `adminSessions` set.
- Mutations check the cookie. The set is in-memory, so a server
  restart logs everyone out — fine for a single-day tournament.

## Domain rules

- Bracket size is `nextPowerOfTwo(playerCount)`. Byes go to the top
  seeds via standard tennis seed order — pairs in round 1 always sum to
  `bracketSize - 1`, so byes are spread across the bracket.
- A match is "ready" when both players are known, no winner is set, and
  it isn't a bye. Byes auto-advance the present player.
- Scoring: winner ≥ 3 AND ((winner == 3 AND loser ≤ 1) OR
  (loser ≥ 2 AND winner − loser == 2)). 3–2 is rejected.
- `clearResult` refuses to undo a match if the downstream match has
  already been decided (avoids cascading invalidations).

## Running

- Dev: `pnpm dev` runs Vite (5173) + tsx-watch server (3939) via
  concurrently. Vite's `server.proxy` forwards `/ws` to `:3939`.
- Production: `pnpm build && pnpm start` — the same Node server then
  serves both the static `dist/` and the WebSocket from one port.
- Persistence: `data/tournament.json` (path overridable with
  `DATA_FILE`). Atomic writes via `.tmp` + `rename`.

## Conventions

- Tailwind tokens (`bg-primary`, `border-border`, …) are wired to the
  Sourceful dark palette in `tailwind.config.js`. Don't hard-code hex.
- All server-mutating actions go through `useRealtime()` —
  never call `recordResult` etc. directly from a component.
- Bracket layout: flexbox columns with `justify-content: space-around`
  per round. Don't switch to absolute positioning without reason.
- Tests next to the file (`*.test.ts`). Run `pnpm test`.

## Theme reference

From `../flutter-app/lib/theme/colors.dart`:

- bg `#131313`, fg `#FFFFFF`
- primary `#00FF84` / primary-fg `#0A0A0A`
- secondary `#16191B`, muted `#1F2937`, accent `#1A3D1A`
- border `#374151`, ring `#00FF84`
- destructive `#FF0D0D`, warning `#F59E0B`, success `#0CF300`
- font: Satoshi (falls back to Inter in this web app)
