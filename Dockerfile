# ─── Stage 1: Install dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps
RUN npm install -g pnpm
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY apps/api ./apps/api

# Generate Prisma client then compile TypeScript
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api exec nest build

# ─── Stage 3: Production runner ──────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN npm install -g prisma@5.22.0
WORKDIR /app

# Only copy what the running process needs
COPY --from=builder /app/node_modules                    ./node_modules
COPY --from=builder /app/apps/api/dist                   ./dist
COPY --from=builder /app/apps/api/prisma                 ./prisma
COPY --from=builder /app/apps/api/package.json           ./package.json

# Entrypoint runs migrations then starts the server
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
