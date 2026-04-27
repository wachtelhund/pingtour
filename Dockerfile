# syntax=docker/dockerfile:1.7

# ─── Stage 1: build the static frontend ───────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
COPY server ./server

RUN pnpm build

# ─── Stage 2: small runtime image ─────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Production install (skips devDeps — tsx and ws are in `dependencies`)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

# App code: built frontend + TS server source (run directly via tsx)
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY src ./src
COPY tsconfig*.json ./

ENV NODE_ENV=production
ENV PORT=3939
ENV DATA_FILE=/data/tournament.json

EXPOSE 3939

# Healthcheck — Fly also has its own, but this helps for `docker run` locally.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O - http://127.0.0.1:3939/healthz || exit 1

CMD ["pnpm", "start"]
