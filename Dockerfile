# ── Stage 1: Build frontend ──
FROM oven/bun:latest AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/bun.lock* frontend/bun.lockb* ./
RUN bun install --frozen-lockfile || bun install
COPY frontend/ .
RUN bun run build

# ── Stage 2: Build backend ──
FROM oven/bun:latest AS backend-builder
WORKDIR /app
COPY backend/package.json backend/bun.lock* backend/bun.lockb* ./
RUN bun install --frozen-lockfile || bun install
COPY backend/ .
RUN bun run build

# ── Stage 3: Final image ──
FROM oven/bun:latest

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

# Nginx config
RUN cat <<'NGINX' > /etc/nginx/sites-available/default
server {
    listen 80;
    server_name _;
    root /app/frontend/dist;
    index index.html;
    client_max_body_size 50M;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

# Entrypoint: start nginx + backend
RUN cat <<'ENTRYPOINT_SCRIPT' > /entrypoint.sh
#!/bin/bash
set -e
nginx
cd /app/backend
./node_modules/.bin/typeorm migration:run -d dist/data-source.js
exec bun run start:prod
ENTRYPOINT_SCRIPT
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
