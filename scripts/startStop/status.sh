#!/usr/bin/env bash
# Reports up/down status for every component of the local stack.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLING="$ROOT/.tooling"

PG_BIN="$TOOLING/postgres/bin"
PG_PORT=5544
PG_SOCK_DIR="$TOOLING/pg-run"

REDIS_BIN="$TOOLING/redis-stable/src"
REDIS_PORT=6379

SERVICES_IN_ORDER=(api-gateway identity-profile offer discovery-location \
  participation messaging trust-safety entitlements-billing notification media)
PORT_FOR() {
  case "$1" in
    api-gateway) echo 3000 ;;
    identity-profile) echo 3001 ;;
    offer) echo 3002 ;;
    discovery-location) echo 3003 ;;
    participation) echo 3004 ;;
    messaging) echo 3005 ;;
    trust-safety) echo 3006 ;;
    entitlements-billing) echo 3007 ;;
    notification) echo 3008 ;;
    media) echo 3009 ;;
  esac
}

printf "%-22s %-8s %s\n" "COMPONENT" "PORT" "STATUS"

if "$PG_BIN/pg_isready" -p "$PG_PORT" -h "$PG_SOCK_DIR" >/dev/null 2>&1; then
  printf "%-22s %-8s %s\n" "postgres" "$PG_PORT" "up"
else
  printf "%-22s %-8s %s\n" "postgres" "$PG_PORT" "down"
fi

if "$REDIS_BIN/redis-cli" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
  printf "%-22s %-8s %s\n" "redis" "$REDIS_PORT" "up"
else
  printf "%-22s %-8s %s\n" "redis" "$REDIS_PORT" "down"
fi

for svc in "${SERVICES_IN_ORDER[@]}"; do
  port="$(PORT_FOR "$svc")"
  if lsof -ti tcp:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    printf "%-22s %-8s %s\n" "$svc" "$port" "up"
  else
    printf "%-22s %-8s %s\n" "$svc" "$port" "down"
  fi
done

if lsof -ti tcp:8765 -sTCP:LISTEN >/dev/null 2>&1; then
  printf "%-22s %-8s %s\n" "flutter-web" "8765" "up"
else
  printf "%-22s %-8s %s\n" "flutter-web" "8765" "down"
fi
