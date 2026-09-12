#!/usr/bin/env bash
# Stops everything started by start.sh: Flutter web, all backend services, Redis, Postgres.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLING="$ROOT/.tooling"
PIDS="$TOOLING/pids"

PG_BIN="$TOOLING/postgres/bin"
PG_DATA="$TOOLING/pgdata"

REDIS_BIN="$TOOLING/redis-stable/src"
REDIS_PORT=6379

SERVICES=(identity-profile offer discovery-location participation messaging \
           trust-safety entitlements-billing notification media api-gateway)

stop_pidfile() {
  local name="$1" pidfile="$2"
  if [ -f "$pidfile" ]; then
    local pid
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $name (pid $pid)"
      kill "$pid" 2>/dev/null
      for _ in $(seq 1 10); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.5
      done
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
    else
      echo "$name: pid file stale, nothing to stop"
    fi
    rm -f "$pidfile"
  else
    echo "$name: not running (no pid file)"
  fi
}

kill_port() {
  local port="$1"
  lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null | while read -r pid; do
    kill "$pid" 2>/dev/null
  done
}

echo "==> Flutter web"
stop_pidfile "flutter-web" "$PIDS/flutter-web.pid"
kill_port 8765 # flutter run's dart child can outlive the tracked pid

echo "==> Backend services"
for svc in "${SERVICES[@]}"; do
  stop_pidfile "$svc" "$PIDS/$svc.pid"
done

echo "==> Redis"
if "$REDIS_BIN/redis-cli" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
  "$REDIS_BIN/redis-cli" -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
  echo "stopped"
else
  echo "not running"
fi

echo "==> Postgres"
if "$PG_BIN/pg_ctl" -D "$PG_DATA" status >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$PG_DATA" stop -m fast
else
  echo "not running"
fi

echo "Stack stopped."
