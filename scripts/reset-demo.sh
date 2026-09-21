#!/usr/bin/env bash
set -euo pipefail
echo "Resetting local demo board via API…"
curl -fsS -X POST "${CONSOLE_URL:-http://localhost:3000}/api/demo/reset" | python3 -m json.tool
echo
echo "Expected: 5 incidents in Triggered. Prefer INC-104 for rehearsed demos; INC-105 for guardrails."
