# ============================================================
# Single-image CapRover deployment
# Runs: PostgreSQL 16 + Redis 7 + Nginx + Backend (Bun/NestJS)
# Managed by supervisord
# ============================================================

# ── Stage 1: Build frontend ──
FROM oven/bun:latest AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/bun.lockb ./
RUN bun install
COPY frontend/ .
RUN bun run build

# ── Stage 2: Build backend ──
FROM oven/bun:latest AS backend-builder
WORKDIR /app
COPY backend/package.json backend/bun.lock ./
RUN bun install
COPY backend/ .
RUN bun run build

# ── Stage 3: Final all-in-one image ──
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

# Install all services
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    lsb-release \
    supervisor \
    nginx \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install PostgreSQL 16
RUN echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/pgdg.gpg \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16 \
    && rm -rf /var/lib/apt/lists/*

# Install Redis 7
RUN apt-get update && apt-get install -y --no-install-recommends redis-server \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install Node.js 22 (required by Claude Code CLI)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for agent workspaces
RUN useradd -m -s /bin/bash runaagent \
    && mkdir -p /home/runaagent/.claude \
    && echo '{"ackTosVersion": "2025-02-24", "hasCompletedOnboarding": true}' > /home/runaagent/.claude/settings.json \
    && chown -R runaagent:runaagent /home/runaagent/.claude

# ── Copy backend ──
WORKDIR /app/backend
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/package.json ./

# ── Copy frontend static files ──
COPY --from=frontend-builder /app/dist /app/frontend/dist

# ── Create data directories ──
RUN mkdir -p /data/runa/uploads /data/postgres /tmp/runa-workspaces \
    && chown -R postgres:postgres /data/postgres \
    && chown -R runaagent:runaagent /tmp/runa-workspaces

# ── Nginx config ──
COPY <<'NGINX' /etc/nginx/sites-available/default
server {
    listen 80;
    server_name _;
    root /app/frontend/dist;
    index index.html;
    client_max_body_size 50M;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # WebSocket proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

# ── PostgreSQL config ──
RUN echo "data_directory = '/data/postgres'" >> /etc/postgresql/16/main/postgresql.conf \
    && echo "listen_addresses = '127.0.0.1'" >> /etc/postgresql/16/main/postgresql.conf \
    && echo "host all all 127.0.0.1/32 md5" >> /etc/postgresql/16/main/pg_hba.conf

# ── Redis config ──
RUN echo "bind 127.0.0.1" > /etc/redis/redis.conf \
    && echo "daemonize no" >> /etc/redis/redis.conf \
    && echo "dir /data/redis" >> /etc/redis/redis.conf \
    && mkdir -p /data/redis

# ── Supervisord config ──
COPY <<'SUPERVISOR' /etc/supervisor/conf.d/runa.conf
[supervisord]
nodaemon=true
logfile=/dev/stdout
logfile_maxbytes=0

[program:postgres]
command=/usr/lib/postgresql/16/bin/postgres -D /data/postgres -c config_file=/etc/postgresql/16/main/postgresql.conf
user=postgres
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=10

[program:redis]
command=/usr/bin/redis-server /etc/redis/redis.conf
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=20

[program:backend]
command=/root/.bun/bin/bun run start:prod
directory=/app/backend
autostart=true
autorestart=true
startsecs=5
startretries=10
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=30

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=40
SUPERVISOR

# ── Entrypoint script ──
COPY <<'ENTRYPOINT_SCRIPT' /entrypoint.sh
#!/bin/bash
set -e

# Initialize PostgreSQL data directory if empty
if [ ! -f /data/postgres/PG_VERSION ]; then
    echo "Initializing PostgreSQL database..."
    su - postgres -c "/usr/lib/postgresql/16/bin/initdb -D /data/postgres"

    # Start postgres temporarily to create the database
    su - postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /data/postgres -l /tmp/pg_init.log start -o '-c listen_addresses=127.0.0.1'"
    sleep 2

    su - postgres -c "psql -c \"ALTER USER postgres PASSWORD '${DATABASE_PASSWORD:-runa}';\""
    su - postgres -c "createuser -s ${DATABASE_USER:-runa} 2>/dev/null || true"
    su - postgres -c "psql -c \"ALTER USER ${DATABASE_USER:-runa} PASSWORD '${DATABASE_PASSWORD:-runa}';\""
    su - postgres -c "createdb -O ${DATABASE_USER:-runa} ${DATABASE_NAME:-runa} 2>/dev/null || true"

    su - postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /data/postgres stop"
    sleep 1
fi

chown -R postgres:postgres /data/postgres

exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
ENTRYPOINT_SCRIPT
RUN chmod +x /entrypoint.sh

# Default env vars for internal services
ENV DATABASE_HOST=127.0.0.1 \
    DATABASE_PORT=5432 \
    DATABASE_USER=runa \
    DATABASE_PASSWORD=runa \
    DATABASE_NAME=runa \
    REDIS_URL=redis://127.0.0.1:6379 \
    LOCAL_STORAGE_PATH=/data/runa/uploads

EXPOSE 80
VOLUME ["/data"]

ENTRYPOINT ["/entrypoint.sh"]
