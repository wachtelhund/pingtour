# Pingtour

Real-time single-elimination ping pong tournament dashboard, themed after
Sourceful. Built for company tournaments with 50–70 players. The TV shows
the bracket and standings on `/`; the tournament admin enters scores from
their phone on `/admin`. State is shared between clients over WebSocket.

## Features

- **Three routes** — `/` is the read-only TV display, `/admin` is the
  password-gated, mobile-first score-entry panel, `/join` is the public
  signup page (no password) that players reach by scanning a QR code.
- **Lobby flow** — admin opens a lobby; the TV shows a QR code; players
  scan, type a name, and appear in the lobby in real time. Admin can also
  add players manually for anyone without a phone, then hits **Start
  tournament** to build the bracket.
- **Real-time sync** — every mutation is pushed to all connected clients
  over WebSocket; the TV updates instantly.
- **Auto-sized bracket** — next power of two; byes given to top seeds via
  standard tennis seed order.
- Tap any ready or completed match in `/admin` to record / edit the result.
- Quick-pick buttons for common results (3–0, 3–1, 4–2, 5–3) plus custom
  score entry, all validated against ping pong rules (first-to-3, win-by-2).
- Live standings with point differential.
- State persists to a JSON file on the server; survives restarts.

## Run-of-show

1. Admin opens `http://<host>:3939/admin`, signs in.
2. Admin enters a tournament name, clicks **Open lobby**.
3. TV is on `http://<host>:3939/` — a giant QR code appears.
4. Players scan, type their name, see "You're in".
5. When everyone's in, admin taps **Start tournament**. The TV switches to
   the bracket; the admin view switches to score entry.

## Architecture

```
┌──────────────┐  ws://…/ws    ┌────────────────────┐
│  TV display  │ ◀──────────▶  │                    │
│      /       │   broadcast   │   Node WS server   │
└──────────────┘   state       │   (server/)        │
┌──────────────┐               │                    │  data/tournament.json
│ Phone admin  │ ◀──────────▶  │   ws + http static │ ─────────────────────
│   /admin     │  mutations    └────────────────────┘
└──────────────┘
```

- Server holds canonical tournament state, persists it to
  `data/tournament.json` after every mutation, and broadcasts the new
  state to all connected clients.
- All write paths (create tournament, record result, clear result, reset)
  require an authenticated WebSocket connection. Auth is per-connection,
  established by sending the password.
- The same logic (`src/bracket.ts`, `src/scoring.ts`) runs on both client
  (for live UI feedback) and server (for canonical validation).

## Run (development)

```sh
pnpm install
pnpm dev          # runs Vite (5173) and the API server (3939) in parallel
```

Open the TV display at `http://localhost:5173/` and the admin at
`http://localhost:5173/admin`. Vite proxies the WebSocket through, so both
clients use the same origin.

```sh
pnpm test         # vitest
pnpm build        # production build → dist/
pnpm start        # run the server in production mode (serves dist/)
```

## Run (production / on the office network)

After `pnpm build`, run the server alone — it serves the static frontend
**and** the WebSocket from a single port:

```sh
ADMIN_PASSWORD='your-password' pnpm start
```

By default it listens on `:3939`. From other devices on the LAN
(your phone, the TV's browser), open `http://<laptop-lan-ip>:3939`.

### Environment variables

Server-side (read by `server/index.ts`):

| Variable         | Default                  | Purpose                              |
| ---------------- | ------------------------ | ------------------------------------ |
| `PORT`           | `3939`                   | HTTP + WS port                       |
| `ADMIN_PASSWORD` | `pingpong123`            | Password required to enter scores    |
| `DATA_FILE`      | `data/tournament.json`   | Where canonical state is persisted   |

Client-side (read by Vite at build / dev startup; put in `.env.local`):

| Variable               | Default                  | Purpose                                                    |
| ---------------------- | ------------------------ | ---------------------------------------------------------- |
| `VITE_PUBLIC_BASE_URL` | `window.location.origin` | URL embedded in the join QR code, if it should differ from the URL the TV uses (e.g. when phones can't reach the TV's local network and need an ngrok tunnel instead). Restart `pnpm dev` after changing. |

The default password prints a warning at startup. **Change it before the
tournament:** `ADMIN_PASSWORD='something' pnpm start`. The password is
checked server-side, so it isn't bundled into the JS.

## Deploy

### Option A — Fly.io (recommended)

The repo ships with a `Dockerfile` and `fly.toml` that deploy the Node
server (which serves both the static frontend and the WebSocket) with
a 1GB persistent volume mounted at `/data` for the tournament JSON.

One-time setup:

```sh
# Install flyctl: https://fly.io/docs/flyctl/install/
flyctl auth signup            # or `flyctl auth login`

# Pick a unique name. Update `app = "..."` in fly.toml to match.
flyctl apps create pingtour-<your-suffix>

# Persistent volume for the state file.
flyctl volumes create pingtour_data --region arn --size 1

# Set the admin password as a secret (encrypted, not bundled).
flyctl secrets set ADMIN_PASSWORD='something-strong'

flyctl deploy
```

After the first deploy:

```sh
flyctl deploy                 # ship a new version
flyctl logs                   # follow runtime logs
flyctl ssh console            # shell into the VM
flyctl secrets set ADMIN_PASSWORD='new'   # rotate the password
```

The app will be at `https://<your-app-name>.fly.dev/`. Update
`VITE_PUBLIC_BASE_URL` in `.env.local` to that URL **before deploying**
so the QR code on the TV encodes the public domain instead of
`localhost` — the env var is baked into the bundle at build time.

The default `fly.toml` keeps the machine awake
(`min_machines_running = 1`) so WebSocket connections don't drop
mid-tournament. Flip `auto_stop_machines = "stop"` and
`min_machines_running = 0` if you want it to sleep when idle (cheaper,
but every cold start drops live clients).

### Option B — laptop + tunnel (zero deploy)

Run the production server on the laptop driving the TV and tunnel it:

```sh
pnpm build
ADMIN_PASSWORD='your-password' pnpm start            # http+ws on :3939
# in another terminal:
cloudflared tunnel --url http://localhost:3939       # or: ngrok http 3939
```

Set `VITE_PUBLIC_BASE_URL` to the tunnel URL in `.env.local` and
rebuild so the QR points at the tunnel, not at `localhost`.

### Option C — any Docker host

```sh
docker build -t pingtour .
docker run -p 3939:3939 -v $(pwd)/data:/data \
  -e ADMIN_PASSWORD='your-password' pingtour
```

The image is ~200MB.

## Tournament rules

Best-of-one game per match. Ping pong scoring:

- First to **3** points wins.
- Must win by **2**: at 2–2 the game continues until someone leads by 2
  (4–2, 5–3, 6–4, …).
- 3–2 is **not** a valid score (the deuce rule kicks in at 2–2).

Enforced by `src/scoring.ts` and covered by unit tests. The server
re-validates every recorded result, so even a misbehaving client can't
push an invalid score.

## Stack

- Vite + React + TypeScript (frontend)
- Node + `ws` library (backend)
- Tailwind CSS — Sourceful palette (dark `#131313` / primary `#00FF84`)
- Vitest for unit tests
- No database; state in `data/tournament.json` (atomic writes via temp+rename)
