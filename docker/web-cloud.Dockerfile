# syntax=docker/dockerfile:1
#
# Cloud-deployment counterpart to web.Dockerfile: same Flutter Web build, but served
# by Caddy instead of nginx so the edge gets automatic Let's Encrypt HTTPS for
# $SITE_ADDRESS (see docker/Caddyfile). Base URLs stay relative (/api/<service>) —
# same single-origin, no-CORS design as web.Dockerfile — so this image works behind
# whatever hostname docker-compose.cloud.yml's $SITE_ADDRESS ends up being; nothing
# domain-specific needs to be baked in here.
#
# Flutter version is pinned explicitly (not `:stable`) — that floating tag lagged
# behind an SDK release this pubspec needs (flutter_localizations' intl pin was
# still 0.20.2 there, but pubspec.yaml requires intl ^0.20.3), confirmed via a
# failed build in .github/workflows/deploy.yml. Bump deliberately, not by drifting.

FROM ghcr.io/cirruslabs/flutter:3.44.0 AS build
# pubspec.yaml's stranger_design_system dependency is `path:
# ../../packages/dart-design-system`, resolved relative to this app's own directory
# — the real repo layout has to be preserved under the build context (not flattened
# into /app) or `flutter pub get` can't find it.
WORKDIR /repo
COPY apps/stranger_flutter/pubspec.yaml apps/stranger_flutter/pubspec.lock apps/stranger_flutter/
COPY packages/dart-design-system packages/dart-design-system
WORKDIR /repo/apps/stranger_flutter
RUN flutter pub get
COPY apps/stranger_flutter .

ARG IDENTITY_BASE_URL=/api/identity-profile
ARG OFFER_BASE_URL=/api/offer
ARG DISCOVERY_BASE_URL=/api/discovery-location
ARG PARTICIPATION_BASE_URL=/api/participation
ARG MESSAGING_BASE_URL=/api/messaging
ARG TRUST_SAFETY_BASE_URL=/api/trust-safety
ARG ENTITLEMENTS_BASE_URL=/api/entitlements-billing
ARG NOTIFICATION_BASE_URL=/api/notification
ARG MEDIA_BASE_URL=/api/media

RUN flutter build web --release \
      --dart-define=IDENTITY_BASE_URL=${IDENTITY_BASE_URL} \
      --dart-define=OFFER_BASE_URL=${OFFER_BASE_URL} \
      --dart-define=DISCOVERY_BASE_URL=${DISCOVERY_BASE_URL} \
      --dart-define=PARTICIPATION_BASE_URL=${PARTICIPATION_BASE_URL} \
      --dart-define=MESSAGING_BASE_URL=${MESSAGING_BASE_URL} \
      --dart-define=TRUST_SAFETY_BASE_URL=${TRUST_SAFETY_BASE_URL} \
      --dart-define=ENTITLEMENTS_BASE_URL=${ENTITLEMENTS_BASE_URL} \
      --dart-define=NOTIFICATION_BASE_URL=${NOTIFICATION_BASE_URL} \
      --dart-define=MEDIA_BASE_URL=${MEDIA_BASE_URL}

FROM caddy:2-alpine AS runtime
COPY --from=build /repo/apps/stranger_flutter/build/web /usr/share/caddy
COPY docker/Caddyfile /etc/caddy/Caddyfile
