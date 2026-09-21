# MARS demo — Ops Runbook Agent (Incident Copilot)

A pager alert is dispatched to agents on **DigitalOcean Harness Runtime**. The
triage agent correlates metrics, logs, and deploys inside an isolated session.
The runbook agent drafts gated mitigations and a postmortem. Reasoning runs on
**Gradient Serverless Inference** (`inference.do-ai.run`) — no GPUs to
provision, no model servers to run. A human still owns every production change.

| | |
|---|---|
| **Owner** | @KumariPurnima |
| **Status** | Working — console + offline replay ready; live Harness attach is documented for Private Preview teams |
| **Last validated** | 2026-09-21 |
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

**Prerequisites:** Node 20+, and optionally a DigitalOcean Model Access Key or PAT
for live inference enrichment.

```bash
cp .env.example .env.local
# optional — enables live Serverless Inference enrichment
# DO_API_KEY=doo_v1_...   or a DigitalOcean PAT
# INFERENCE_MODEL=openai-gpt-4.1

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### App Platform

```bash
doctl apps create --spec .do/app.yaml
# then set DO_API_KEY as a secret on the app
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
| `DO_API_KEY` | Bearer token for `https://inference.do-ai.run` (optional; replay works without it) |
| `INFERENCE_MODEL` | Model id from `/v1/models` (default `openai-gpt-4.1`) |
| `FORCE_REPLAY` | Set `1` to skip live inference enrichment even when a key is present |

## Relationship to ticket-to-PR

| Demo | Intake | Outcome |
|---|---|---|
| [mars-ticket-to-pr-console](https://github.com/DO-Solutions/mars-ticket-to-pr-console) | Jira / board ticket | Reviewed pull request |
| **mars-ops-runbook-console** (this repo) | Pager / incident | Gated runbook + postmortem |

Together they bookend the customer story: **build faster** and **recover faster**
on DigitalOcean’s agentic cloud.

## Known limitations

**Console simulation vs attached Harness sessions.** This repository ships a
leadership-grade console with faithful manifests, a live feed, offline replay,
and optional Serverless Inference enrichment. Wiring dispatch to a Private
Preview Harness Runtime trigger (as `setup-mars.sh` does in ticket-to-PR) is the
next integration step for teams with MARS enabled — the manifests under
`agents/` are written for that path.

**In-memory board.** Process restart clears runs. Use **reset demo** before every
showing.

Everything else: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).
