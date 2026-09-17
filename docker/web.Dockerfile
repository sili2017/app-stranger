# syntax=docker/dockerfile:1
#
# Builds the Flutter web client and serves it via nginx, which also reverse-proxies
# /api/<service>/* to the internal backend containers. This keeps everything the
# browser talks to on ONE origin (https://<host>/), so the client needs no CORS at
# all — avoiding the dev-only `app.enableCors()` every backend service currently
# ships with (see each service's main.ts comment: "MUST NOT be carried into
# production"). It also means only port 80/443 needs to be reachable from outside
# the Docker network; the 9 domain services stay internal-only.

FROM ghcr.io/cirruslabs/flutter:stable AS build
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

# Defaults match docker/nginx.conf's proxy paths — override at build time if you
# expose the backend differently (e.g. a real domain per service).
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

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/stranger_flutter/build/web /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
