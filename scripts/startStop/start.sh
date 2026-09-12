#!/usr/bin/env bash
# Starts the full local stack (Postgres, Redis, all backend services, Flutter web)
# using the same local-binary setup documented in specs/tasks.md "Running locally".
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLING="$ROOT/.tooling"
LOGS="$TOOLING/logs"
PIDS="$TOOLING/pids"
mkdir -p "$LOGS" "$PIDS"

PG_BIN="$TOOLING/postgres/bin"
PG_DATA="$TOOLING/pgdata"
PG_SOCK_DIR="$TOOLING/pg-run"
PG_PORT=5544

REDIS_BIN="$TOOLING/redis-stable/src"
REDIS_CONF="$TOOLING/redis.conf"
REDIS_PORT=6379

FLUTTER_BIN="$TOOLING/flutter/bin/flutter"
FLUTTER_PORT=8765
FLUTTER_HOST=127.0.0.1
FLUTTER_DIR="$ROOT/apps/stranger_flutter"

SERVICES=(identity-profile offer discovery-location participation messaging \
           trust-safety entitlements-billing notification media api-gateway)

BUILD=false
SKIP_FLUTTER=false
for arg in "$@"; do
  case "$arg" in
    --build) BUILD=true ;;
    --skip-flutter) SKIP_FLUTTER=true ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

echo "==> Postgres ($PG_PORT)"
if "$PG_BIN/pg_ctl" -D "$PG_DATA" status >/dev/null 2>&1; then
  echo "already running"
else
  mkdir -p "$PG_SOCK_DIR"
  "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$TOOLING/postgres.log" \
    -o "-p $PG_PORT -k $PG_SOCK_DIR" start
fi
"$PG_BIN/pg_isready" -p "$PG_PORT" -h "$PG_SOCK_DIR" >/dev/null

echo "==> Redis ($REDIS_PORT)"
if "$REDIS_BIN/redis-cli" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
  echo "already running"
else
  "$REDIS_BIN/redis-server" "$REDIS_CONF" --daemonize yes --logfile "$TOOLING/redis.log"
fi

if [ "$BUILD" = true ]; then
  echo "==> Building all services"
  (cd "$ROOT" && npm run build)
else
  for svc in "${SERVICES[@]}"; do
    if [ ! -f "$ROOT/services/$svc/dist/main.js" ]; then
      echo "==> No build output for $svc, building all services"
      (cd "$ROOT" && npm run build)
      break
    fi
  done
fi

echo "==> Backend services"
for svc in "${SERVICES[@]}"; do
  pidfile="$PIDS/$svc.pid"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "$svc already running (pid $(cat "$pidfile"))"
    continue
  fi
  (cd "$ROOT/services/$svc" && nohup node dist/main.js > "$LOGS/$svc.log" 2>&1 & echo $! > "$pidfile")
  echo "$svc started (pid $(cat "$pidfile"), log $LOGS/$svc.log)"
done

if [ "$SKIP_FLUTTER" = false ]; then
  echo "==> Flutter web ($FLUTTER_PORT)"
  pidfile="$PIDS/flutter-web.pid"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "flutter-web already running (pid $(cat "$pidfile"))"
  else
    (cd "$FLUTTER_DIR" && "$FLUTTER_BIN" pub get >/dev/null)
    (cd "$FLUTTER_DIR" && nohup "$FLUTTER_BIN" run -d web-server \
      --web-port="$FLUTTER_PORT" --web-hostname="$FLUTTER_HOST" \
      > "$LOGS/flutter-web.log" 2>&1 & echo $! > "$pidfile")
    echo "flutter-web starting (pid $(cat "$pidfile")) — tail $LOGS/flutter-web.log for readiness"
  fi
fi

echo
echo "Stack up. Backend: gateway 3000, identity-profile 3001, offer 3002,"
echo "discovery-location 3003, participation 3004, messaging 3005, trust-safety 3006,"
echo "entitlements-billing 3007, notification 3008, media 3009."
if [ "$SKIP_FLUTTER" = false ]; then
  echo "Flutter web: http://$FLUTTER_HOST:$FLUTTER_PORT (first load takes ~30s to compile)."
fi
echo "Run scripts/startStop/status.sh to check, stop.sh to tear down."
