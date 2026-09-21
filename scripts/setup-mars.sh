#!/usr/bin/env bash
#
# Stand up the MARS side of the Ops Runbook demo: two fresh webhook triggers
# (triage + runbook). Prints the environment variables the console needs.
#
# Prerequisites
#   - doctl beta build with `harness-runtime` (see ticket-to-PR README; release
#     builds of doctl do not yet ship this command)
#   - the right team selected (e.g. Solutions Demos)
#   - CONSOLE_URL set to the deployed app URL (or a tunnel for local testing)
#   - secret files present (see SECRET_DIR below)
#
set -euo pipefail
cd "$(dirname "$0")/.."

SECRET_DIR="${SECRET_DIR:-$HOME/.secrets}"
INFERENCE_KEY="$SECRET_DIR/do-inference.key"
CALLBACK_TOKEN="$SECRET_DIR/console-callback"

if [ -z "${CONSOLE_URL:-}" ]; then
  echo "set CONSOLE_URL to the console app base URL, e.g. https://xxx.ondigitalocean.app" >&2
  exit 1
fi
export CONSOLE_URL
export CONSOLE_HOST="${CONSOLE_URL#https://}"
CONSOLE_HOST="${CONSOLE_HOST#http://}"
export CONSOLE_HOST="${CONSOLE_HOST%%/*}"

for f in "$INFERENCE_KEY" "$CALLBACK_TOKEN"; do
  [ -f "$f" ] || { echo "missing secret file: $f" >&2; exit 1; }
done

if ! doctl harness-runtime triggers --help >/dev/null 2>&1; then
  cat >&2 <<'ERR'
doctl has no `harness-runtime` command.

Install the beta build that includes Managed Agents / Harness Runtime
(same prerequisite as mars-ticket-to-pr-console), then re-run this script.
ERR
  exit 1
fi

echo "==> console: $CONSOLE_URL (host $CONSOLE_HOST)"

SECRET_FLAGS=(
  --secret "HARNESS_INFERENCE_API_KEY=@$INFERENCE_KEY"
  --secret "CONSOLE_TOKEN=@$CALLBACK_TOKEN"
)

echo "==> creating the triage trigger (webhook, fresh, custom signature)"
TRIAGE_JSON="$(doctl harness-runtime triggers create \
  --kind webhook --name ops-incident-triage \
  --session-mode fresh --spec agents/triage.yaml \
  --provider custom \
  --prompt "$(cat prompts/triage.tmpl)" \
  --output-mode none \
  "${SECRET_FLAGS[@]}" -o json)"

echo "==> creating the runbook trigger (webhook, fresh, custom signature)"
RUNBOOK_JSON="$(doctl harness-runtime triggers create \
  --kind webhook --name ops-incident-runbook \
  --session-mode fresh --spec agents/runbook.yaml \
  --provider custom \
  --prompt "$(cat prompts/runbook.tmpl)" \
  --output-mode none \
  "${SECRET_FLAGS[@]}" -o json)"

read -r TRIAGE_TRIGGER_ID TRIAGE_SECRET <<<"$(python3 -c '
import json,sys
t=json.loads(sys.argv[1]); t=t[0] if isinstance(t,list) else t
print(t["trigger_id"], t.get("webhook_secret",""))' "$TRIAGE_JSON")"

read -r RUNBOOK_TRIGGER_ID RUNBOOK_SECRET <<<"$(python3 -c '
import json,sys
t=json.loads(sys.argv[1]); t=t[0] if isinstance(t,list) else t
print(t["trigger_id"], t.get("webhook_secret",""))' "$RUNBOOK_JSON")"

cat <<OUT

============================================================
Set these on the console app (App Platform > Settings > env)
or in .env.local for local development:

  DO_API_TOKEN=<DO PAT that can read agent sessions/executions>
  AGENT_CALLBACK_TOKEN=$(cat "$CALLBACK_TOKEN")
  MARS_TRIAGE_TRIGGER_ID=$TRIAGE_TRIGGER_ID
  MARS_TRIAGE_TRIGGER_SECRET=$TRIAGE_SECRET
  MARS_RUNBOOK_TRIGGER_ID=$RUNBOOK_TRIGGER_ID
  MARS_RUNBOOK_TRIGGER_SECRET=$RUNBOOK_SECRET
  INFERENCE_MODEL=deepseek-v4-pro

Webhook secrets are shown once. Save them now; to reissue:
  doctl harness-runtime triggers rotate-secret <trigger-id>

Without these variables the console still runs in simulated / replay mode.
============================================================
OUT
