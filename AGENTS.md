# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

Runa is an AI-powered Agile project management platform with three main services:

| Service | Stack | Port | Dev command |
|---------|-------|------|-------------|
| Backend | NestJS 11, TypeORM, PostgreSQL, Redis (Bull) | 3001 | `cd backend && bun run start:dev` |
| Frontend | React 19, Vite 6, Tailwind CSS 4 | 3000 | `cd frontend && bun run dev --host 0.0.0.0` |
| MCP Server | Express 5, MCP SDK (optional) | - | `cd mcp-server && bun run build` |

### Prerequisites (provided by update script)

- **Bun** (primary package manager and runtime)
- **Node.js 22** (required by NestJS CLI for `nest build`/`nest start`)
- **Docker** (for Postgres 16 and Redis 7 containers)

### Starting services

1. **Start Docker daemon** (if not already running): `sudo dockerd &>/tmp/dockerd.log &` then `sudo chmod 666 /var/run/docker.sock`
2. **Start Postgres + Redis**: `cd /workspace && docker compose up -d postgres redis`
3. **Create storage dir** (first time only): `sudo mkdir -p /data/runa/uploads && sudo chown -R $(whoami):$(whoami) /data/runa`
4. **Create `.env`** (first time only): Copy `.env.example` to `.env`, then change `DATABASE_HOST` to `localhost`, `REDIS_URL` to `redis://localhost:6379`, and ensure `ENCRYPTION_KEY` has a value (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
5. **Copy `.env` to backend**: `cp /workspace/.env /workspace/backend/.env` (NestJS ConfigModule reads `.env` from working directory)
6. **Start backend**: `cd /workspace/backend && bun run start:dev`
7. **Start frontend**: `cd /workspace/frontend && bun run dev --host 0.0.0.0`

### Non-obvious gotchas

- The backend's NestJS `ConfigModule.forRoot()` loads `.env` from the current working directory, not the repo root. You must copy `.env` into `backend/` or set env vars explicitly when running the backend outside Docker Compose.
- `synchronize: true` is enabled in non-production mode (app.module.ts), so tables auto-create on startup. No need to run migrations in dev.
- The `FileStorageService` creates `/data/runa/uploads` on startup. This directory must exist and be writable or the backend will crash with `EACCES`.
- The `SubscriptionActiveGuard` blocks most API operations unless the user has `subscriptionStatus = 'trialing'` or `'active'`, or belongs to a team. For local dev, set this directly in Postgres: `docker exec workspace-postgres-1 psql -U runa -d runa -c "UPDATE users SET \"subscriptionStatus\" = 'trialing' WHERE email = 'your@email.com';"`
- Frontend Vite dev server proxies `/api` and `/socket.io` to the backend (default `http://localhost:3001`, override with `VITE_API_PROXY_TARGET` env var).

### Testing

- **Backend tests**: `cd backend && bun run test` (Jest, runs in-band)
- **Frontend tests**: `cd frontend && bun run test` (Vitest with `--run` flag)
- **Frontend lint**: `cd frontend && bun run lint` (ESLint; pre-existing warnings/errors exist in the repo)

### Health check

```
curl http://localhost:3001/api/health
# Returns: {"status":"ok","db":"up","redis":"up"}
```
