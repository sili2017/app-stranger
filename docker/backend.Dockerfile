# syntax=docker/dockerfile:1
#
# One image for all 9 domain services + the api-gateway. They share the same npm
# workspace (hoisted node_modules, one @stranger/ts-platform dependency), so a single
# parameterized image avoids maintaining 10 near-identical Dockerfiles: the builder
# stage compiles everything once, and SERVICE_NAME just selects which compiled
# entrypoint the final container runs. Build per service with:
#   docker build -f docker/backend.Dockerfile --build-arg SERVICE_NAME=identity-profile -t stranger/identity-profile .
#
# All 9 domain services use Prisma with a custom client output path
# (services/<name>/generated/prisma-client, see prisma/schema.prisma), which must be
# generated from inside a Linux build stage — never copy a host-built `generated/` or
# `dist/` into the context (see .dockerignore) or you'll ship macOS/Windows-native
# Prisma engine binaries into an Alpine container.

FROM node:18-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ts-platform/package.json packages/ts-platform/package.json
COPY packages/test-fixtures/package.json packages/test-fixtures/package.json
COPY services/identity-profile/package.json services/identity-profile/package.json
COPY services/offer/package.json services/offer/package.json
COPY services/discovery-location/package.json services/discovery-location/package.json
COPY services/participation/package.json services/participation/package.json
COPY services/messaging/package.json services/messaging/package.json
COPY services/trust-safety/package.json services/trust-safety/package.json
COPY services/entitlements-billing/package.json services/entitlements-billing/package.json
COPY services/notification/package.json services/notification/package.json
COPY services/media/package.json services/media/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN for s in identity-profile offer discovery-location participation messaging \
             trust-safety entitlements-billing notification media; do \
      npx prisma generate --schema=services/$s/prisma/schema.prisma; \
    done
# ts-platform must be built before the services that import its compiled dist/
RUN npm run build -w packages/ts-platform \
 && npm run build --workspaces --if-present

FROM node:18-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/services ./services
COPY docker/backend-entrypoint.sh /usr/local/bin/backend-entrypoint.sh
RUN chmod +x /usr/local/bin/backend-entrypoint.sh

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}
# Actual port is set per container via PORT env in docker-compose; EXPOSE here is
# documentation only and doesn't publish anything.

# Liveness only (any HTTP response, even a 404, means the server is up) — lets
# docker-compose's `web` container wait on `condition: service_healthy` instead of
# just service_started, so nginx isn't proxying to services still mid-boot/migrating.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/', r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/backend-entrypoint.sh"]
