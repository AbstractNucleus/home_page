#!/usr/bin/env bash
# Ping each subdomain over the public path (DNS + TLS + reverse proxy),
# write a JSON snapshot atomically. Any 2xx/3xx/4xx counts as up — that
# treats auth-gated services (401/403) as live, which is what we want
# for analytics/studio. 5xx, timeout, or connection refused = down.
#
# Usage: check-status.sh <out-path>
# Example cron: * * * * * bash /home/.../bin/check-status.sh /home/.../status/status.json
set -u

HOSTS=(
  dynmap.noelkleen.com
  party.noelkleen.com
  notes.noelkleen.com
  analytics.noelkleen.com
  studio.noelkleen.com
)

OUT="${1:-/tmp/status.json}"
TMP="${OUT}.tmp.$$"

mkdir -p "$(dirname "$OUT")"

now=$(date -u +%Y-%m-%dT%H:%M:%SZ)

{
  printf '{\n'
  printf '  "updated": "%s",\n' "$now"
  printf '  "sites": {\n'
  first=1
  for host in "${HOSTS[@]}"; do
    result=$(curl -sSL -o /dev/null -m 8 -w '%{http_code} %{time_total}' "https://$host/" 2>/dev/null || echo "000 0")
    code=$(printf '%s' "$result" | awk '{print $1}')
    t=$(printf '%s' "$result" | awk '{print $2}')
    ms=$(awk -v t="$t" 'BEGIN { printf "%d", t * 1000 }')
    if [ "$code" -ge 200 ] && [ "$code" -lt 500 ]; then
      up=true
    else
      up=false
    fi
    [ $first -eq 1 ] || printf ',\n'
    first=0
    printf '    "%s": {"up": %s, "code": %s, "ms": %s}' "$host" "$up" "$code" "$ms"
  done
  printf '\n  }\n}\n'
} > "$TMP"

mv "$TMP" "$OUT"
chmod 644 "$OUT"
