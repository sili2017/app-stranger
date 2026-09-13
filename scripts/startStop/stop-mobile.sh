#!/usr/bin/env bash
# Stops what start-mobile.sh adds on top of the backend stack: the cloudflared tunnel
# and the single-origin mobile proxy. Run stop.sh separately to tear down the backend.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PIDS="$ROOT/.tooling/pids"

stop_pidfile() {
  local name="$1" pidfile="$2"
  if [ -f "$pidfile" ]; then
    local pid
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $name (pid $pid)"
      kill "$pid" 2>/dev/null
    else
      echo "$name: pid file stale, nothing to stop"
    fi
    rm -f "$pidfile"
  else
    echo "$name: not running (no pid file)"
  fi
}

echo "==> cloudflared tunnel"
stop_pidfile "cloudflared" "$PIDS/cloudflared.pid"

echo "==> Mobile proxy"
stop_pidfile "mobile-proxy" "$PIDS/mobile-proxy.pid"
