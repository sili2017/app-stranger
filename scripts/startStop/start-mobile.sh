#!/usr/bin/env bash
# Starts the full local stack for testing on a physical phone, with the Flutter Web
# client fronted by ONE HTTPS origin (via a cloudflared quick tunnel) instead of the
# plain-HTTP LAN dev server start.sh normally launches.
#
# Why: the browser Geolocation API refuses to run at all on a plain-HTTP origin that
# isn't localhost (see lib/core/location_service.dart's insecureOrigin comment) — so
# "Use current location" silently does nothing when testing over http://<lan-ip>:8765
# from a phone. A single HTTPS origin also lets the client call every backend service
# through same-origin /api/<service>/ paths (mobile-proxy.js mirrors
# docker/nginx.conf's mapping), avoiding mixed-content blocking and the dev-only CORS
# every backend service ships with.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLING="$ROOT/.tooling"
LOGS="$TOOLING/logs"
PIDS="$TOOLING/pids"
mkdir -p "$LOGS" "$PIDS"

FLUTTER_BIN="$TOOLING/flutter/bin/flutter"
FLUTTER_DIR="$ROOT/apps/stranger_flutter"
PROXY_PORT="${MOBILE_PROXY_PORT:-8090}"

echo "==> Backend stack (Postgres, Redis, Kafka, domain services)"
"$ROOT/scripts/startStop/start.sh" --skip-flutter

echo "==> Building Flutter web (release, single-origin relative API paths)"
(cd "$FLUTTER_DIR" && "$FLUTTER_BIN" pub get >/dev/null)
(cd "$FLUTTER_DIR" && "$FLUTTER_BIN" build web --release \
  --dart-define=IDENTITY_BASE_URL=/api/identity-profile \
  --dart-define=OFFER_BASE_URL=/api/offer \
  --dart-define=DISCOVERY_BASE_URL=/api/discovery-location \
  --dart-define=PARTICIPATION_BASE_URL=/api/participation \
  --dart-define=MESSAGING_BASE_URL=/api/messaging \
  --dart-define=TRUST_SAFETY_BASE_URL=/api/trust-safety \
  --dart-define=ENTITLEMENTS_BASE_URL=/api/entitlements-billing \
  --dart-define=NOTIFICATION_BASE_URL=/api/notification \
  --dart-define=MEDIA_BASE_URL=/api/media)

echo "==> Mobile proxy (single origin, port $PROXY_PORT)"
pidfile="$PIDS/mobile-proxy.pid"
if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
  echo "already running (pid $(cat "$pidfile")) — restarting to pick up the new build"
  kill "$(cat "$pidfile")" 2>/dev/null || true
  sleep 1
fi
if lsof -ti tcp:"$PROXY_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PROXY_PORT is already in use by another process — set MOBILE_PROXY_PORT to a free port and re-run." >&2
  exit 1
fi
MOBILE_PROXY_PORT="$PROXY_PORT" nohup node "$ROOT/scripts/startStop/mobile-proxy.js" \
  > "$LOGS/mobile-proxy.log" 2>&1 & echo $! > "$pidfile"
disown

echo "==> HTTPS tunnel (cloudflared)"
tpidfile="$PIDS/cloudflared.pid"
if [ -f "$tpidfile" ] && kill -0 "$(cat "$tpidfile")" 2>/dev/null; then
  echo "already running (pid $(cat "$tpidfile"))"
else
  nohup cloudflared tunnel --url "http://localhost:$PROXY_PORT" \
    > "$LOGS/cloudflared.log" 2>&1 & echo $! > "$tpidfile"
  disown
fi

echo "==> Waiting for tunnel URL"
URL=""
for _ in $(seq 1 30); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOGS/cloudflared.log" 2>/dev/null | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done

echo
if [ -n "$URL" ]; then
  echo "Open this on your phone (any network — no shared Wi-Fi required): $URL"
else
  echo "Tunnel URL not detected yet — check $LOGS/cloudflared.log"
fi
echo "Local-only URL (no HTTPS, geolocation will NOT work from a phone): http://localhost:$PROXY_PORT"
echo "Tear down with scripts/startStop/stop-mobile.sh (and stop.sh for the backend stack)."
