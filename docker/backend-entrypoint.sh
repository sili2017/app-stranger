#!/bin/sh
# Applies pending Prisma migrations (no-op if already applied — safe on every
# restart) for services that own a database, then starts the service named by
# SERVICE_NAME (baked into the image at build time). api-gateway has no schema, so
# migrate deploy is skipped for it automatically.
set -e

SERVICE_DIR="services/${SERVICE_NAME}"

if [ ! -f "$SERVICE_DIR/dist/main.js" ]; then
  echo "[entrypoint] $SERVICE_DIR/dist/main.js not found — bad SERVICE_NAME or build?" >&2
  exit 1
fi

if [ -f "$SERVICE_DIR/prisma/schema.prisma" ]; then
  echo "[entrypoint] Running prisma migrate deploy for ${SERVICE_NAME}"
  npx prisma migrate deploy --schema="$SERVICE_DIR/prisma/schema.prisma"
fi

echo "[entrypoint] Starting ${SERVICE_NAME}"
exec node "$SERVICE_DIR/dist/main.js"
