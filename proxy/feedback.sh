#!/bin/sh
# Rückmeldungen der Tester vom Worker holen oder als gelesen markieren.
#   proxy/feedback.sh            ungelesene Einträge
#   proxy/feedback.sh all        alle Einträge
#   proxy/feedback.sh ack ID …   Einträge als gelesen markieren (IDs aus der Liste, z. B. fb:0001791540000000-ab12cd)
# Das Geheimnis FEEDBACK_TOKEN steht in proxy/.dev.vars (nicht im Git); FEEDBACK_URL überschreibt den Worker.
set -e
cd "$(dirname "$0")"
TOKEN=$(grep '^FEEDBACK_TOKEN=' .dev.vars 2>/dev/null | cut -d= -f2- | tr -d '\r\n')
[ -n "$TOKEN" ] || { echo "FEEDBACK_TOKEN fehlt in proxy/.dev.vars" >&2; exit 1; }
URL="${FEEDBACK_URL:-https://wetter-nina-proxy.anferny-wetter.workers.dev}"
pretty() { if command -v python3 >/dev/null 2>&1; then python3 -m json.tool; else cat; fi; }
case "${1:-}" in
  ack)
    shift
    ids=$(printf '%s\n' "$@" | sed 's/.*/"&"/' | paste -sd, -)
    curl -sS -X POST "$URL/feedback/ack" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"ids\":[$ids]}"; echo ;;
  all) curl -sS "$URL/feedback?all=1" -H "Authorization: Bearer $TOKEN" | pretty ;;
  *)   curl -sS "$URL/feedback" -H "Authorization: Bearer $TOKEN" | pretty ;;
esac
