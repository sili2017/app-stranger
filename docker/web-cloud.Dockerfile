# syntax=docker/dockerfile:1
#
# Cloud-deployment counterpart to web.Dockerfile: same Flutter Web build, but served
# by Caddy instead of nginx so the edge gets automatic Let's Encrypt HTTPS for
# $SITE_ADDRESS (see docker/Caddyfile). Base URLs stay relative (/api/<service>) —
# same single-origin, no-CORS design as web.Dockerfile — so this image works behind
# whatever hostname docker-compose.cloud.yml's $SITE_ADDRESS ends up being; nothing
# domain-specific needs to be baked in here.

FROM ghcr.io/cirruslabs/flutter:stable AS build
WORKDIR /app
COPY apps/stranger_flutter/pubspec.yaml apps/stranger_flutter/pubspec.lock ./
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
COPY --from=build /app/build/web /usr/share/caddy
COPY docker/Caddyfile /etc/caddy/Caddyfile
