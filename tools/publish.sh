#!/usr/bin/env bash
# =========================================================================
# tools/publish.sh — check then publish Volcano on start.ng
# -------------------------------------------------------------------------
# Run this AFTER you have pushed the repo to GitHub:
#
#     bash tools/publish.sh
#
# It calls POST /games/check first (so nothing broken ever reaches players),
# then POST /games/publish, and prints the one-time approve link the first
# time. Only needs curl. Override the defaults with env vars if you rename
# the repo or the game:
#
#     REPO_URL=https://github.com/you/other-repo NAME=other bash tools/publish.sh
# =========================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Jaylinka/volcano}"
NAME="${NAME:-volcano}"
API="https://api.start.ng"
BODY=$(printf '{"repo_url":"%s","name":"%s"}' "$REPO_URL" "$NAME")

line() { printf '%s\n' "----------------------------------------------------------"; }

line
echo "Checking $REPO_URL (game name: $NAME)"
line
CHECK=$(curl -sS -X POST "$API/games/check" \
  -H 'Content-Type: application/json' -d "$BODY" \
  -w $'\n%{http_code}')
CODE=$(printf '%s' "$CHECK" | tail -n1)
printf '%s\n' "$CHECK" | sed '$d'
echo

if [ "$CODE" != "200" ]; then
  echo "The check did not pass (HTTP $CODE)."
  echo "Fix everything listed above, push again, and re-run this script."
  exit 1
fi

echo "Check passed. Publishing..."
line
PUB=$(curl -sS -X POST "$API/games/publish" \
  -H 'Content-Type: application/json' -d "$BODY" \
  -w $'\n%{http_code}')
PCODE=$(printf '%s' "$PUB" | tail -n1)
printf '%s\n' "$PUB" | sed '$d'
echo

case "$PCODE" in
  202)
    APPROVE=$(printf '%s' "$PUB" | tr -d '\n' | sed -n 's/.*"approve_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    line
    echo "This is a NEW game: it needs one approval."
    if [ -n "$APPROVE" ]; then
      echo
      echo "    Open this link to sign in with start.ng and put it live:"
      echo
      echo "    $APPROVE"
      echo
      echo "(One use, valid 30 days. If it expires, run this script again.)"
    fi
    ;;
  200)
    line
    echo "Updated and live on start.ng."
    ;;
  *)
    line
    echo "Publish replied HTTP $PCODE — see the reply above."
    exit 1
    ;;
esac
