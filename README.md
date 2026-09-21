# MARS demo — Ops Runbook Agent (Incident Copilot)

A pager alert is dispatched to agents on **DigitalOcean Harness Runtime**. The
triage agent correlates metrics, logs, and deploys inside an isolated session.
The runbook agent drafts gated mitigations and a postmortem. Reasoning runs on
**Gradient Serverless Inference** (`inference.do-ai.run`) — no GPUs to
provision, no model servers to run. A human still owns every production change.

| | |
|---|---|
| **Owner** | @KumariPurnima |
| **Status** | Working — simulated + offline replay always; **live MARS** when triggers are configured via `scripts/setup-mars.sh` |
| **Last validated** | 2026-09-21 |
| **Live demo** | Run locally or deploy with `.do/app.yaml` |
| **Products shown** | Harness Runtime (MARS), Gradient Serverless Inference, Action Gateway (approvals), App Platform |
| **Companion demo** | [mars-ticket-to-pr-console](https://github.com/DO-Solutions/mars-ticket-to-pr-console) (engineering intake) |

## Executive summary

Traditional incident response burns the first ten minutes on tribal knowledge:
who has the runbook, which dashboard, which deploy caused this. This demo shows
the alternative DigitalOcean is building for customers:

1. **Signal in** — alert lands on the board (PagerDuty stand-in)
2. **Agent session** — Harness Runtime opens a durable Firecracker microVM
3. **Reasoning** — Serverless Inference synthesizes diagnosis without a GPU fleet
4. **Governed action** — Action Gateway holds write steps for human approval
5. **Close the loop** — postmortem draft and status note ready before the war room fills

> The board is a stand-in for PagerDuty / Opsgenie, because a demo cannot page a
> production on-call rotation. Everything past it is designed as the real path:
> durable sessions, allowlisted egress, denied destructive shell, approval-gated
> mitigations, and a plain `fetch` to Serverless Inference.

## What it demonstrates

- **Faster MTTR narrative** — diagnosis + runbook before humans finish joining the bridge
- **Durable + isolated execution** — Harness Runtime session language (microVM, resume target &lt;200ms)
- **Serverless model layer** — `lib/ai.ts` is a single authenticated `fetch` to `/v1/chat/completions`
- **Bounded autonomy** — `rm -rf`, secret writes, and production mutates are denied or require approval
- **Observable** — live feed of reasoning, tool calls, durations, and token accounting
- **Leadership-safe** — **replay (offline)** runs the rehearsed SEV-1 canary path with no network dependency

## Architecture

![Architecture](docs/architecture.svg)

Two agents share one conceptual harness session:

| Agent | Job |
|---|---|
| **Triage** | Correlate pager + metrics + logs + deploys → working diagnosis |
| **Runbook** | Produce gated steps, status note, postmortem skeleton |

## Repository layout

| Path | What it is |
|---|---|
| `agents/` | triage + runbook manifests (model, guardrails, egress) and skills |
| `prompts/` | prompt templates rendered per incident |
| `app/`, `components/`, `lib/` | the console — board, live feed, outcome, guardrails |
| `lib/ai.ts` | Serverless Inference client — plain `fetch`, no SDK |
| `scripts/reset-demo.sh` | returns the board to a known state |
| `scripts/deploy.sh` | push and optionally redeploy on App Platform |
| `docs/` | architecture diagram and troubleshooting |

## Seeded incidents

| Key | Severity | Why it exists |
|---|---|---|
| **INC-104** | SEV-1 | Rehearsed canary rollback story — use this for leadership demos |
| INC-101 | SEV-2 | Latency / pool saturation |
| INC-102 | SEV-1 | Auth issuer mismatch |
| INC-103 | SEV-3 | Queue backlog / early warning |
| **INC-105** | SEV-2 | Guardrail demo — asks for `rm -rf`, policy denies it |

## Setup

**Prerequisites:** Node 20+. For **live MARS**, a `doctl` beta build with
`harness-runtime` (same as ticket-to-PR) and Managed Agents enabled on the team.

### Console only (simulated / replay — works today)

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The header badge reads
**simulated** until MARS env vars are set.

### Live Harness Runtime (MARS)

```bash
# 1. secrets
mkdir -p ~/.secrets && chmod 700 ~/.secrets
printf '%s' '<model access key or DO PAT>' > ~/.secrets/do-inference.key
openssl rand -hex 24 > ~/.secrets/console-callback
chmod 600 ~/.secrets/*

# 2. deploy or tunnel the console, then:
CONSOLE_URL=https://<your-app>.ondigitalocean.app ./scripts/setup-mars.sh

# 3. paste the printed env vars into App Platform (or .env.local)
# 4. restart / redeploy — header badge should read "MARS live"
```

`setup-mars.sh` creates two **fresh** webhook triggers (`ops-incident-triage`,
`ops-incident-runbook`) from `agents/*.yaml` + `prompts/*.tmpl`. Dispatch fires
triage, attaches the session event stream, then chains the runbook trigger.

Agents POST summaries to `/api/agent/callback` with `AGENT_CALLBACK_TOKEN`.

### App Platform

```bash
doctl apps create --spec .do/app.yaml
# set DO_API_TOKEN, AGENT_CALLBACK_TOKEN, MARS_* secrets from setup-mars.sh
```

## Running the demo (7 minutes)

1. Open the console. Select **INC-104**.
2. Press **Dispatch incident copilot**.
3. Watch the **Triage agent** correlate canary metrics and logs.
4. Watch the **Runbook agent** draft gated rollback + postmortem in **Outcome**.
5. Flip to **Agents & guardrails** — show denied commands and allowlisted egress.
6. Optional: **INC-105** to prove a guardrail holds on an unattended run.
7. Before the next showing: **reset demo**.

If a live run is risky — a board meeting, a bad network — press
**replay (offline)**. Same UI, rehearsed path, no dependency on inference
availability.

### Talk track for CEO / CPTO / CRO

| Audience | Line |
|---|---|
| **CEO** | “First ten minutes of an incident, automated — humans start at decide, not dig.” |
| **CPTO** | “Harness Runtime is the durable isolated session; Serverless Inference is the model layer with no GPU ops.” |
| **CRO** | “Same platform story as ticket-to-PR: agents that ship work with guardrails customers will buy.” |

## Environment variables

| Variable | Purpose |
|---|---|
| `DO_API_TOKEN` | Reads MARS sessions, events, and trigger executions |
| `DO_API_KEY` | Optional Serverless Inference enrichment in simulated mode |
| `AGENT_CALLBACK_TOKEN` | Shared secret for `/api/agent/callback` |
| `MARS_TRIAGE_TRIGGER_ID` / `_SECRET` | Triage webhook trigger from `setup-mars.sh` |
| `MARS_RUNBOOK_TRIGGER_ID` / `_SECRET` | Runbook webhook trigger from `setup-mars.sh` |
| `INFERENCE_MODEL` | Model id (default `openai-gpt-4.1`; harness specs use `deepseek-v4-pro`) |
| `FORCE_REPLAY` | Set `1` to skip live inference enrichment |

## Relationship to ticket-to-PR

| Demo | Intake | Outcome |
|---|---|---|
| [mars-ticket-to-pr-console](https://github.com/DO-Solutions/mars-ticket-to-pr-console) | Jira / board ticket | Reviewed pull request |
| **mars-ops-runbook-console** (this repo) | Pager / incident | Gated runbook + postmortem |

Together they bookend the customer story: **build faster** and **recover faster**
on DigitalOcean’s agentic cloud.

## How MARS is used

| Piece | Role |
|---|---|
| `scripts/setup-mars.sh` | Creates Harness Runtime webhook triggers |
| `lib/mars.ts` | Signs + fires triggers; opens session event streams |
| `lib/consume.ts` | Folds MARS SSE events into the live feed |
| `agents/*.yaml` | Environment templates (model, egress, deny rules, skills) |
| `/api/agent/callback` | Agents report diagnosis / runbook outcome back to the board |

Without `MARS_*` env vars, dispatch stays on the **simulated** path so leadership
demos never depend on preview access or conference Wi‑Fi.

## Known limitations

**`doctl harness-runtime` is beta.** Release `doctl` (e.g. 1.169) does not ship
the command yet — use the same beta build as ticket-to-PR.

**In-memory board.** Process restart clears runs. Use **reset demo** before every
showing.

**Runbook chaining.** The console fires the runbook trigger after the triage
execution completes. Agents should still POST `/api/agent/callback` so the
Outcome panel gets structured JSON.

Everything else: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).
