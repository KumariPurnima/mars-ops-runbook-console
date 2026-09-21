import type { Incident } from './seed';
import type { FeedItem } from './store';

/** Scripted harness-style timelines — one per role — for leadership demos. */
export function buildScriptedRun(incident: Incident): { triage: FeedItem[]; runbook: FeedItem[] } {
  const now = Date.now();
  const t = (offset: number) => now + offset;

  const triage: FeedItem[] = [
    {
      kind: 'prompt',
      at: t(0),
      text:
        `Harness Runtime session opened for ${incident.key}.\n` +
        `Service: ${incident.service} · Severity: ${incident.severity}\n` +
        `Goal: correlate signals, propose a diagnosis, hand off to the runbook agent.`,
    },
    {
      kind: 'log',
      at: t(1),
      message: `microVM ready · session ${incident.key.toLowerCase()} · resume latency target <200ms`,
    },
    {
      kind: 'text',
      at: t(2),
      reasoning: true,
      text:
        'Start with pages + deploy timeline, then logs, then change correlation. ' +
        'Do not mutate production without an approval gate.',
    },
    {
      kind: 'tool',
      at: t(3),
      name: 'metrics.query',
      input: { command: `m3:query service=${incident.service} window=15m` },
      summary:
        incident.key === 'INC-104'
          ? 'p99 edge latency 1.8s → 4.1s after 08:01 · 5xx rate 0.2% → 3.7%'
          : `Elevated error/latency band on ${incident.service} for ~12m`,
      ok: true,
      durationMs: 640,
    },
    {
      kind: 'tool',
      at: t(4),
      name: 'logs.search',
      input: { command: `doctl monitoring logs --service ${incident.service} --since 20m` },
      summary:
        incident.key === 'INC-102'
          ? 'Top signature: invalid_token_issuer × 14,208'
          : incident.key === 'INC-104'
            ? 'Top signature: upstream_reset × 2,441 · canary pods only'
            : 'Error cluster matched the page description',
      ok: true,
      durationMs: 1100,
    },
    {
      kind: 'tool',
      at: t(5),
      name: 'deploys.list',
      input: { command: `git log --oneline -n 5 -- ${incident.service}` },
      summary:
        incident.key === 'INC-104'
          ? '08:01 canary payments-edge@v2.18.4 (sha 9f3c1a2) — 10% traffic'
          : 'No deploy in last 45m · last change outside blast window',
      ok: true,
      durationMs: 380,
    },
    {
      kind: 'text',
      at: t(6),
      text:
        `**Triage complete.** Working theory for ${incident.key}: ` +
        (incident.key === 'INC-104'
          ? 'bad canary release driving edge 5xx. Recommend runbook: freeze → evidence → rollback approval → status note.'
          : `correlate ${incident.service} saturation with recent change/config drift. Handing to runbook agent.`),
    },
  ];

  const runbook: FeedItem[] = [
    {
      kind: 'prompt',
      at: t(10),
      text:
        `Continue session ${incident.key}. Produce an executable runbook, draft a postmortem, ` +
        `and request human approval for any write action.`,
    },
    {
      kind: 'tool',
      at: t(11),
      name: 'runbook.render',
      input: { path: `runbooks/${incident.service}.md` },
      summary: 'Loaded service runbook · 6 steps · 2 gated',
      ok: true,
      durationMs: 210,
    },
    {
      kind: 'tool',
      at: t(12),
      name: 'inference.chat',
      input: {
        command: 'POST https://inference.do-ai.run/v1/chat/completions',
        model: 'openai-gpt-4.1',
      },
      summary: 'Serverless Inference · diagnosis + customer status drafted · no GPU provisioned',
      ok: true,
      durationMs: 1800,
    },
  ];

  if (incident.expectsBlockedAction) {
    runbook.push({
      kind: 'tool',
      at: t(13),
      name: 'shell.exec',
      input: { command: 'rm -rf /var/log/legacy' },
      summary: 'denied by Harness policy',
      ok: false,
      durationMs: 40,
    });
    runbook.push({
      kind: 'blocked',
      at: t(14),
      detail:
        'Policy deny: recursive delete on host filesystem.\n' +
        'Agent did not attempt a workaround. Safer alternative proposed: rotate retention via logging API.',
    });
    runbook.push({
      kind: 'text',
      at: t(15),
      text:
        '**Guardrail held.** Destructive wipe blocked. Drafted a non-destructive mitigation and left the incident open for human decision.',
    });
  } else {
    runbook.push({
      kind: 'tool',
      at: t(13),
      name: 'action_gateway.request',
      input: {
        command: incident.key === 'INC-104' ? 'rollback canary payments-edge@v2.18.4' : `mitigate ${incident.service}`,
      },
      summary: 'Awaiting human approval · Action Gateway',
      ok: true,
      durationMs: 90,
    });
    runbook.push({
      kind: 'text',
      at: t(14),
      text:
        '**Runbook ready.** Evidence pack captured. Mitigation is gated. Postmortem skeleton and status note are in the Outcome panel — a human still owns the merge to production reality.',
    });
  }

  return { triage, runbook };
}
