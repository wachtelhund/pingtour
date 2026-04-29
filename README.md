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
- **Near-real-time sync** — clients poll `/api/state` every 1.5s; the
  TV updates within ~2 seconds of any admin score entry.
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
| `VITE_PUBLIC_BASE_URL` | `window.location.origin` | URL embedded in the join QR code, if it should differ from the URL the TV uses (e.g. when phones can't reach the TV's local network and need a tunnel instead). |
| `VITE_API_URL`         | same origin as the page  | API base URL. Only needed for split deploys where the frontend and the backend live on different origins. Example: `https://pingtour-xxxx.onrender.com`. |

Both are baked into the JS bundle at `pnpm build` time. Restart `pnpm dev`
or rerun the build after changing.

The default password prints a warning at startup. **Change it before the
tournament:** `ADMIN_PASSWORD='something' pnpm start`. The password is
checked server-side, so it isn't bundled into the JS.

## Deploy

### Recommended — AWS Amplify Gen 2 (everything in one app)

The repo is set up as a Gen 2 Amplify app:

```
amplify/
  backend.ts                 // CDK stack: Lambda + Function URL + DynamoDB
  functions/api/
    resource.ts              // Function definition
    handler.ts               // Lambda handler — same logic as server/
amplify.yml                  // backend phase + frontend phase
amplify_outputs.json         // stub; overwritten by deploy with real URL
```

The Amplify build runs the backend phase first (`npx ampx
pipeline-deploy`), which provisions the Lambda + DynamoDB and writes the
Function URL into `amplify_outputs.json`. Then the frontend phase builds
the React bundle, which imports that JSON to know where to fetch.

#### One-time: enable Gen 2 backend on the Amplify app

In the Amplify Console, the app needs an IAM service role with
permission to deploy CDK stacks. If your existing Amplify app was set
up before Gen 2 (just hosting), the first build will fail with a
permission error. Fix:

1. Amplify Console → your app → **App settings → IAM roles** →
   **Edit** → click **Create and use a new service role** (or attach
   `AmplifyBackendDeployFullAccess`).
2. Trigger another build.

#### Deploy

After pushing this branch:

1. Amplify auto-builds. Watch the build log in the Amplify Console — the
   "Backend" phase deploys CDK, the "Build" phase compiles the frontend.
   First-time backend deploy takes ~3–5 minutes.
2. After it's green, set the **SPA rewrite** in **App settings →
   Rewrites and redirects**:

   | Source | Target | Type |
   |---|---|---|
   | `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json\|webp)$)([^.]+$)/>` | `/index.html` | `200 (Rewrite)` |

3. Set this env var in **App settings → Environment variables** so the
   QR encodes the public URL:

   ```
   VITE_PUBLIC_BASE_URL = https://main.<your-app-id>.amplifyapp.com
   ```

   Trigger one more redeploy so it's baked into the bundle.

That's the deploy. Open the Amplify URL on the TV, `/admin` on your
phone, password `pingpong123`. State persists in DynamoDB, survives
Lambda cold starts.

#### Changing the admin password

Edit `ADMIN_PASSWORD` in `amplify/functions/api/resource.ts`, push.
(Yes, it's in source — for a casual office tournament that's fine. To
keep it out of git, replace with a `secret('admin_password')` reference
and set the secret via `npx ampx sandbox secret set admin_password`.)

### Local dev

```sh
pnpm install
pnpm dev          # Vite (5173) + local Node server (3939) in parallel
```

The local Node server (`server/index.ts`) provides the same REST API on
`localhost:3939`, so dev doesn't need DynamoDB or any AWS access. The
frontend hits `/api` via the Vite proxy.

### Alternatives

If you don't want Amplify, the same code runs as a single container on:

- **Any Docker host** — `docker compose up -d --build` with the
  included `Dockerfile`. State goes to a local volume.
- **Render** — connect the repo, free tier, auto-detects the
  `Dockerfile`.
- **DigitalOcean Droplet** — `bash deploy/bootstrap.sh` then
  `docker compose up -d --build`.

In those cases set `ADMIN_PASSWORD` as the only env var; everything else
defaults sensibly.

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
