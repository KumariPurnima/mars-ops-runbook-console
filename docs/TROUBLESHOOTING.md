# Troubleshooting

## The feed never starts

1. Confirm `npm run dev` is healthy and `/api/incidents` returns five items.
2. Click **reset demo**, then dispatch again.
3. For leadership rooms with flaky Wi‑Fi, use **replay (offline)** — it always runs `INC-104`.

## Inference errors when `DO_API_KEY` is set

Serverless Inference uses `https://inference.do-ai.run/v1/chat/completions`.

- Model access keys (`doo_v1_…`) or a DigitalOcean PAT both work against the public endpoint.
- If enrich fails, the demo still completes with the scripted outcome — look for inference errors only in server logs.
- Force offline behaviour with `FORCE_REPLAY=1`.

## Board state looks stale after a crash

In-memory store resets on process restart. That is intentional for a demo console.
Run **reset demo** to restore the five seeded incidents.

## Guardrail demo (`INC-105`) stays in Mitigating

Expected. The agent refuses `rm -rf` and leaves the incident open for a human decision.

## App Platform deploy

Use `.do/app.yaml`. Set `DO_API_KEY` as an encrypted app-level env var. Never commit keys.
