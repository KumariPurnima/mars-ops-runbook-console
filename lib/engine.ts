import { chatCompletions, inferenceConfigured } from './ai';
import type { Incident, IncidentOutcome } from './seed';
import { buildScriptedRun } from './scenarios';
import {
  appendFeed,
  getIncident,
  getStore,
  setIncidentColumn,
  setIncidentOutcome,
  upsertRun,
  type FeedItem,
  type Run,
} from './store';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function feedOf(runId: string): FeedItem[] {
  return getStore().runs.find((r) => r.id === runId)?.feed ?? [];
}

async function playItems(runId: string, items: FeedItem[], pace = true) {
  for (const item of items) {
    appendFeed(runId, { ...item, at: Date.now() });
    if (pace) await sleep(item.kind === 'tool' ? 420 : item.kind === 'text' ? 280 : 160);
  }
}

function fallbackOutcome(incident: Incident): IncidentOutcome {
  return {
    diagnosis:
      incident.key === 'INC-104'
        ? 'Canary v2.18.4 correlates with 5xx burn; rollback is the lowest-risk mitigation.'
        : `Primary signal points to ${incident.service}; see agent feed for correlated evidence.`,
    confidence: incident.key === 'INC-104' ? 0.86 : 0.72,
    rootCause:
      incident.key === 'INC-104'
        ? 'Faulty canary release of payments-edge introducing elevated edge 5xx'
        : 'Pending confirmation from deeper log correlation',
    blastRadius: `${incident.service} · ${incident.severity}`,
    runbookSteps: [
      {
        id: 's1',
        title: 'Freeze deploys',
        detail: 'Pause continuous delivery for the affected service family.',
        requiresApproval: false,
        status: 'done',
      },
      {
        id: 's2',
        title: 'Capture evidence pack',
        detail: 'Snapshot metrics, recent deploys, and top error signatures.',
        requiresApproval: false,
        status: 'done',
      },
      {
        id: 's3',
        title: 'Execute mitigation',
        detail: incident.expectsBlockedAction
          ? 'Safer alternative: rotate log retention — destructive wipe denied by policy.'
          : 'Rollback canary / scale pool / flip feature flag — requires human approval.',
        requiresApproval: true,
        status: incident.expectsBlockedAction ? 'blocked' : 'pending',
      },
      {
        id: 's4',
        title: 'Draft status + postmortem',
        detail: 'Customer-ready status note and postmortem skeleton prepared.',
        requiresApproval: false,
        status: 'done',
      },
    ],
    postmortemDraft:
      `## Incident ${incident.key}\n\n**Summary:** ${incident.summary}\n\n` +
      `**Impact:** ${incident.severity} on ${incident.service}\n\n` +
      `**Timeline:** Detection → triage agent → runbook agent → human decision\n\n` +
      `**Action items:** Confirm mitigation owner · schedule follow-up review\n`,
    tokensIn: 1840,
    tokensOut: 960,
    estimatedMttrMinutes: incident.severity === 'SEV-1' ? 18 : 35,
  };
}

async function enrichWithInference(
  incident: Incident,
  base: IncidentOutcome,
): Promise<IncidentOutcome> {
  if (!inferenceConfigured()) return base;
  try {
    const result = await chatCompletions([
      {
        role: 'system',
        content:
          'You are an SRE incident commander writing for executives. Reply with compact JSON only: ' +
          '{"diagnosis":string,"rootCause":string,"blastRadius":string,"postmortemDraft":string,"confidence":number,"estimatedMttrMinutes":number}',
      },
      {
        role: 'user',
        content: `Incident ${incident.key} (${incident.severity}) on ${incident.service}:\n${incident.summary}\n\n${incident.description}`,
      },
    ]);
    const match = result.content.match(/\{[\s\S]*\}/);
    if (!match) {
      return { ...base, tokensIn: result.tokensIn, tokensOut: result.tokensOut };
    }
    const parsed = JSON.parse(match[0]) as Partial<IncidentOutcome>;
    return {
      ...base,
      diagnosis: parsed.diagnosis ?? base.diagnosis,
      rootCause: parsed.rootCause ?? base.rootCause,
      blastRadius: parsed.blastRadius ?? base.blastRadius,
      postmortemDraft: parsed.postmortemDraft ?? base.postmortemDraft,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : base.confidence,
      estimatedMttrMinutes:
        typeof parsed.estimatedMttrMinutes === 'number'
          ? parsed.estimatedMttrMinutes
          : base.estimatedMttrMinutes,
      tokensIn: result.tokensIn || base.tokensIn,
      tokensOut: result.tokensOut || base.tokensOut,
    };
  } catch {
    return base;
  }
}

export async function dispatchIncident(
  key: string,
  opts?: { replay?: boolean },
): Promise<{ triageId: string; runbookId: string }> {
  const incident = getIncident(key);
  if (!incident) throw new Error(`unknown incident ${key}`);

  const triageId = newId('triage');
  const runbookId = newId('runbook');
  const harnessSessionId = `hrs_${Math.random().toString(36).slice(2, 10)}`;
  const model = process.env.INFERENCE_MODEL ?? 'openai-gpt-4.1';
  const script = buildScriptedRun(incident);
  const useLive = !opts?.replay && inferenceConfigured();

  const triage: Run = {
    id: triageId,
    incident: key,
    role: 'triage',
    status: 'running',
    startedAt: Date.now(),
    harnessSessionId,
    feed: [],
    model,
  };
  upsertRun(triage);
  incident.runIds = [...incident.runIds, triageId];
  setIncidentColumn(key, 'investigating');

  void (async () => {
    try {
      await playItems(triageId, script.triage);
      appendFeed(triageId, {
        kind: 'done',
        tokensIn: useLive ? 920 : 840,
        tokensOut: useLive ? 410 : 360,
        at: Date.now(),
      });
      upsertRun({
        ...triage,
        status: 'completed',
        endedAt: Date.now(),
        feed: feedOf(triageId),
      });

      setIncidentColumn(key, 'mitigating');
      const runbook: Run = {
        id: runbookId,
        incident: key,
        role: 'runbook',
        status: 'running',
        startedAt: Date.now(),
        harnessSessionId,
        feed: [],
        model,
      };
      upsertRun(runbook);
      incident.runIds = [...incident.runIds, runbookId];

      await playItems(runbookId, script.runbook);

      let outcome = fallbackOutcome(incident);
      if (useLive) outcome = await enrichWithInference(incident, outcome);

      appendFeed(runbookId, {
        kind: 'done',
        tokensIn: outcome.tokensIn,
        tokensOut: outcome.tokensOut,
        at: Date.now(),
      });
      upsertRun({
        ...runbook,
        status: 'completed',
        endedAt: Date.now(),
        feed: feedOf(runbookId),
      });

      setIncidentOutcome(key, outcome);
      setIncidentColumn(key, incident.expectsBlockedAction ? 'mitigating' : 'resolved');
    } catch (e) {
      appendFeed(runbookId, {
        kind: 'log',
        message: e instanceof Error ? e.message : String(e),
        at: Date.now(),
      });
      upsertRun({
        id: runbookId,
        incident: key,
        role: 'runbook',
        status: 'failed',
        startedAt: Date.now(),
        endedAt: Date.now(),
        feed: feedOf(runbookId),
      });
    }
  })();

  return { triageId, runbookId };
}
