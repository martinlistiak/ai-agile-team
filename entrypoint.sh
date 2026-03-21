#!/bin/bash
set -e
nginx
cd /app/backend
./node_modules/.bin/typeorm migration:run -d dist/data-source.js
exec bun run start:prod
