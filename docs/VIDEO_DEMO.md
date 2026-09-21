# Video demo script — Ops Runbook Agent (Incident Copilot)

**Goal:** Show executives how easy incident management becomes when DigitalOcean
**Harness Runtime** runs the agent safely and **Serverless Inference** supplies
the model layer — with no GPUs to provision and humans still in control.

| | |
|---|---|
| **Length** | 3:00–4:00 (cutdown) · 6:00 (full walkthrough) |
| **Live URL** | https://mars-ops-runbook-console-xneb7.ondigitalocean.app |
| **Hero incident** | **INC-104** (SEV-1 canary) |
| **Guardrail beat** | **INC-105** (optional, 45s) |
| **Fallback** | **replay (offline)** if network / MARS is flaky |
| **Architecture** | [`docs/architecture.svg`](architecture.svg) |

---

## One-sentence story

> A pager fires → an agent on DigitalOcean Harness Runtime investigates in an
> isolated sandbox → Serverless Inference reasons over the evidence → a gated
> runbook and postmortem appear before the war room finishes joining — and a
> human still owns every production change.

---

## Pre-flight (5 minutes before record)

1. Open Chrome (or Edge) in a clean profile; zoom **110–125%** for screen-share.
2. Full-screen the live URL. Confirm header badge says **MARS live**.
3. Click **reset demo**. Confirm five incidents in **Triggered**.
4. Select **INC-104**. Do **not** dispatch until cameras roll.
5. Optional second tab: GitHub README architecture diagram (paused, for cutaway).
6. Close Slack / email notifications. Do Not Disturb on.
7. Mic check: say “Harness Runtime” and “Serverless Inference” clearly once.

**If badge says simulated:** stop and fix env, or plan to use **replay (offline)**
and narrate “captured real path” honestly.

---

## Recommended cut (≈ 3:30)

| Time | On screen | You say (talk track) |
|---|---|---|
| **0:00–0:20** | Title card or console hero | “Incident response still starts with tribal knowledge — who has the runbook, which dashboard, which deploy. We’re going to collapse that into minutes with DigitalOcean.” |
| **0:20–0:45** | Architecture diagram (README) | “Two products, one flow. **Harness Runtime** is where the agent runs — isolated Firecracker sessions, guardrails, durable work. **Serverless Inference** is how it thinks — `inference.do-ai.run`, no GPU fleet, no model servers.” |
| **0:45–1:05** | Incident board, pointer on INC-104 | “This board stands in for PagerDuty. INC-104: SEV-1 on payments-edge after a canary. One click dispatches the incident copilot.” |
| **1:05–1:15** | Click **Dispatch incident copilot** | “No SSH. No laptop agent. This fires a MARS webhook into Harness Runtime.” |
| **1:15–2:10** | Triage feed scrolling | “Watch the triage agent: metrics, logs, deploys — inside a sandbox, not on an engineer’s machine. Reasoning is Serverless Inference. You see every tool call and token count. That’s observability customers ask for.” |
| **2:10–2:50** | Runbook tab + Outcome panel | “When triage finishes, we chain the runbook agent. Outcome: diagnosis, confidence, gated steps, postmortem draft. Writes need human approval — autonomy with brakes.” |
| **2:50–3:15** | Agents & guardrails tab | “Deny rules and allowlisted egress are in the agent spec — `rm -rf`, secret mutates, production deletes. Easy to operate does not mean unbounded.” |
| **3:15–3:30** | Back to board / resolved | “By the time humans join the bridge, investigation and a draft plan already exist. That’s the MTTR story — and how easy DigitalOcean makes agentic incident management.” |

---

## Full walkthrough (≈ 6:00) — add these beats

### A. Ease / “before vs after” (30s)
- Before: 10+ minutes of dashboard hopping, Slack pings, “who owns payments-edge?”
- After: dispatch → diagnosis → gated runbook → postmortem skeleton.

### B. Why Harness Runtime (45s)
While the feed shows a live session id:
- Isolated microVM — agent-generated actions stay off laptops and shared jump boxes.
- Fresh session per run — clean slate, reproducible demos.
- Platform-native — same DigitalOcean account / App Platform console.

### C. Why Serverless Inference (30s)
Flip briefly to Agents & guardrails → “Model layer”:
- One endpoint: `inference.do-ai.run`
- No provisioning GPUs, no keeping model servers warm for rare SEV-1s.
- Same key path coding agents already use.

### D. Guardrail proof — INC-105 (45s) *(optional but powerful)*
1. Reset (or open INC-105).
2. Dispatch.
3. When feed shows **Blocked by policy** on `rm -rf`:  
   “Easy automation with hard limits. The agent refuses, proposes a safer path, and leaves the decision to a human.”

### E. Close for CEO / CPTO / CRO (20s)
| Audience | Line |
|---|---|
| CEO | “First ten minutes of an incident, automated — humans start at decide, not dig.” |
| CPTO | “Harness Runtime for safe execution; Serverless Inference for models; App Platform for the console.” |
| CRO | “A customer-ready ops story: faster MTTR with guardrails buyers trust.” |

---

## Shot list (editor)

1. Wide: console with board  
2. Cursor: Dispatch button  
3. Close-up: triage tool cards (metrics / logs / deploys)  
4. Tab switch: Runbook agent  
5. Outcome panel scroll (diagnosis → steps → postmortem)  
6. Agents & guardrails (deny list)  
7. Cutaway: architecture.svg  
8. Optional: INC-105 blocked card  
9. End card: live URL + “DigitalOcean Gradient AI / MARS”

**B-roll / lower thirds**
- “Harness Runtime — isolated agent sessions”  
- “Serverless Inference — no GPUs to manage”  
- “Human approval required for production writes”

---

## Recording tips

- Prefer **live MARS** for credibility; keep **replay (offline)** as take 2 insurance.
- Don’t talk over long silent model turns — cut jump-cuts or add soft music under “waiting for inference.”
- If a run exceeds ~3 minutes, narrate over a sped-up feed, then jump to Outcome.
- Never show secrets, `.env`, or full tokens on camera.
- End freeze-frame on Outcome with **INC-104 · resolved**.

---

## Day-of commands

```bash
# Confirm live
open https://mars-ops-runbook-console-xneb7.ondigitalocean.app

# Or reset via API before the take
curl -X POST https://mars-ops-runbook-console-xneb7.ondigitalocean.app/api/demo/reset
```

After the take: click **reset demo** so the next viewer starts clean.

---

## Suggested title / description (YouTube / Spaces)

**Title:** Incident Copilot on DigitalOcean — Harness Runtime + Serverless Inference  

**Description:**  
See how a SEV-1 pager becomes a diagnosis, gated runbook, and postmortem draft
using DigitalOcean Managed Agents (Harness Runtime) and Gradient Serverless
Inference — with no GPU fleet to run and humans still approving production changes.

Live demo: https://mars-ops-runbook-console-xneb7.ondigitalocean.app  
Repo: https://github.com/KumariPurnima/mars-ops-runbook-console
