#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git push origin HEAD
if command -v doctl >/dev/null 2>&1; then
  echo "Triggering App Platform redeploy if an app is linked…"
  doctl apps list --format ID,Spec.Name --no-header | awk '/mars-ops-runbook/ {print $1}' | while read -r id; do
    [ -n "$id" ] && doctl apps create-deployment "$id" --wait=false
  done
fi
echo "Done."
