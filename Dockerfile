# Pin amd64 so images built on Apple Silicon run on typical x86_64 hosts (CapRover, VPS).
# ── Stage 1: Build frontend ──
FROM --platform=linux/amd64 oven/bun:latest AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/bun.lock* frontend/bun.lockb* ./
RUN bun install --frozen-lockfile || bun install
COPY frontend/ .
RUN bun run build

# ── Stage 2: Build backend ──
FROM --platform=linux/amd64 oven/bun:latest AS backend-builder
WORKDIR /app
COPY backend/package.json backend/bun.lock* backend/bun.lockb* ./
RUN bun install --frozen-lockfile || bun install
COPY backend/ .
RUN bun run build

# ── Stage 3: Final image ──
FROM --platform=linux/amd64 oven/bun:latest

RUN apt-get update && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy backend
WORKDIR /app/backend
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/package.json ./

# Copy frontend static files
COPY --from=frontend-builder /app/dist /app/frontend/dist

# Nginx config + entrypoint as real files (avoids heredoc issues)
COPY nginx.conf /etc/nginx/sites-available/default
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
