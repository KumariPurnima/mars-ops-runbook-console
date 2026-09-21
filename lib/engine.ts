import { consumeSession } from './consume';
import { chatCompletions, inferenceConfigured } from './ai';
import { fireTrigger, marsConfigured, waitForExecutionSession } from './mars';
import type { Incident, IncidentOutcome } from './seed';
import { buildScriptedRun } from './scenarios';
import {
  addIncidentNote,
  appendFeed,
  getIncident,
  getStore,
  setIncidentColumn,
  setIncidentOutcome,
  updateRun,
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

function conf(name: string): string | undefined {
  const v = process.env[name];
  return !v || v === 'REPLACE_ME' ? undefined : v;
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

function incidentPayload(incident: Incident, handoff?: string) {
  return {
    incident: {
      key: incident.key,
      severity: incident.severity,
      service: incident.service,
      summary: incident.summary,
      description: incident.description,
      reporter: incident.reporter,
      expects_blocked_action: Boolean(incident.expectsBlockedAction),
      triage_handoff: handoff ?? '',
    },
  };
}

async function attachMarsRun(opts: {
  role: 'triage' | 'runbook';
  incident: Incident;
  triggerId: string;
  secret: string;
  payload: unknown;
}): Promise<{ executionId: string }> {
  const { executionId } = await fireTrigger(opts.triggerId, opts.secret, opts.payload);

  const run: Run = {
    id: executionId,
    incident: opts.incident.key,
    role: opts.role,
    status: 'running',
    startedAt: Date.now(),
    feed: [],
    mode: 'mars',
    model: process.env.INFERENCE_MODEL ?? process.env.HARNESS_INFERENCE_MODEL ?? 'deepseek-v4-pro',
    tokensIn: 0,
    tokensOut: 0,
  };
  upsertRun(run);
  opts.incident.runIds = [...opts.incident.runIds, executionId];

  void (async () => {
    const sessionId = await waitForExecutionSession(opts.triggerId, executionId);
    if (!sessionId) {
      console.error(`[mars ${executionId}] execution never reported a session`);
      updateRun(executionId, { status: 'failed', error: 'the run never started a sandbox' });
      return;
    }
    console.log(`[mars ${executionId}] sandbox ${sessionId}`);
    updateRun(executionId, { harnessSessionId: sessionId });
    await consumeSession(executionId, sessionId, { triggerId: opts.triggerId });
  })();

  return { executionId };
}

/**
 * After triage completes on MARS, fire the runbook trigger.
 * Polls the store so we do not block the HTTP handler.
 */
function chainRunbookAfterTriage(incidentKey: string, triageExecutionId: string) {
  const runbookId = conf('MARS_RUNBOOK_TRIGGER_ID');
  const runbookSecret = conf('MARS_RUNBOOK_TRIGGER_SECRET');
  if (!runbookId || !runbookSecret) return;

  void (async () => {
    for (let i = 0; i < 180; i++) {
      await sleep(2000);
      const triage = getStore().runs.find((r) => r.id === triageExecutionId);
      if (!triage) return;
      if (triage.status === 'failed') return;
      if (triage.status !== 'completed') continue;

      const incident = getIncident(incidentKey);
      if (!incident) return;

      setIncidentColumn(incidentKey, 'mitigating');
      addIncidentNote(incidentKey, {
        author: 'system',
        body: 'Triage complete — firing MARS runbook agent.',
        at: Date.now(),
      });

      const handoff =
        incident.notes.filter((n) => n.author === 'triage').at(-1)?.body ??
        'See triage session feed for diagnosis.';

      try {
        const { executionId } = await attachMarsRun({
          role: 'runbook',
          incident,
          triggerId: runbookId,
          secret: runbookSecret,
          payload: incidentPayload(incident, handoff),
        });

        // When runbook finishes, apply a fallback outcome if the agent did not callback.
        void (async () => {
          for (let j = 0; j < 180; j++) {
            await sleep(2000);
            const rb = getStore().runs.find((r) => r.id === executionId);
            if (!rb) return;
            if (rb.status === 'failed') return;
            if (rb.status !== 'completed') continue;
            if (!incident.outcome) {
              setIncidentOutcome(incident.key, {
                ...fallbackOutcome(incident),
                tokensIn: rb.tokensIn ?? 0,
                tokensOut: rb.tokensOut ?? 0,
              });
            }
            if (!incident.expectsBlockedAction) setIncidentColumn(incident.key, 'resolved');
            return;
          }
        })();
      } catch (e) {
        addIncidentNote(incidentKey, {
          author: 'system',
          body: `Runbook trigger failed: ${e instanceof Error ? e.message : String(e)}`,
          at: Date.now(),
        });
      }
      return;
    }
  })();
}

async function dispatchMars(
  incident: Incident,
): Promise<{ triageId: string; runbookId: string }> {
  const triageIdEnv = conf('MARS_TRIAGE_TRIGGER_ID')!;
  const triageSecret = conf('MARS_TRIAGE_TRIGGER_SECRET')!;

  setIncidentColumn(incident.key, 'investigating');
  addIncidentNote(incident.key, {
    author: 'system',
    body: 'Dispatched to MARS triage agent (Harness Runtime).',
    at: Date.now(),
  });

  const { executionId } = await attachMarsRun({
    role: 'triage',
    incident,
    triggerId: triageIdEnv,
    secret: triageSecret,
    payload: incidentPayload(incident),
  });

  chainRunbookAfterTriage(incident.key, executionId);
  return { triageId: executionId, runbookId: '' };
}

async function dispatchSimulated(
  incident: Incident,
  opts?: { replay?: boolean },
): Promise<{ triageId: string; runbookId: string }> {
  const triageId = newId('triage');
  const runbookId = newId('runbook');
  const harnessSessionId = `hrs_${Math.random().toString(36).slice(2, 10)}`;
  const model = process.env.INFERENCE_MODEL ?? 'openai-gpt-4.1';
  const script = buildScriptedRun(incident);
  const useLive = !opts?.replay && inferenceConfigured();
  const mode = opts?.replay ? 'replay' : 'simulated';

  const triage: Run = {
    id: triageId,
    incident: incident.key,
    role: 'triage',
    status: 'running',
    startedAt: Date.now(),
    harnessSessionId,
    feed: [],
    model,
    mode,
  };
  upsertRun(triage);
  incident.runIds = [...incident.runIds, triageId];
  setIncidentColumn(incident.key, 'investigating');

  void (async () => {
    try {
      await playItems(triageId, script.triage);
      appendFeed(triageId, {
        kind: 'done',
        tokensIn: useLive ? 920 : 840,
        tokensOut: useLive ? 410 : 360,
        at: Date.now(),
      });
      updateRun(triageId, { status: 'completed', endedAt: Date.now() });

      setIncidentColumn(incident.key, 'mitigating');
      const runbook: Run = {
        id: runbookId,
        incident: incident.key,
        role: 'runbook',
        status: 'running',
        startedAt: Date.now(),
        harnessSessionId,
        feed: [],
        model,
        mode,
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
      updateRun(runbookId, {
        status: 'completed',
        endedAt: Date.now(),
        tokensIn: outcome.tokensIn,
        tokensOut: outcome.tokensOut,
      });

      setIncidentOutcome(incident.key, outcome);
      setIncidentColumn(incident.key, incident.expectsBlockedAction ? 'mitigating' : 'resolved');
    } catch (e) {
      appendFeed(runbookId, {
        kind: 'log',
        message: e instanceof Error ? e.message : String(e),
        at: Date.now(),
      });
      updateRun(runbookId, {
        status: 'failed',
        endedAt: Date.now(),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  })();

  return { triageId, runbookId };
}

export async function dispatchIncident(
  key: string,
  opts?: { replay?: boolean },
): Promise<{ triageId: string; runbookId: string; mode: 'mars' | 'simulated' | 'replay' }> {
  const incident = getIncident(key);
  if (!incident) throw new Error(`unknown incident ${key}`);

  if (opts?.replay) {
    const ids = await dispatchSimulated(incident, { replay: true });
    return { ...ids, mode: 'replay' };
  }

  if (marsConfigured()) {
    const ids = await dispatchMars(incident);
    return { ...ids, mode: 'mars' };
  }

  const ids = await dispatchSimulated(incident);
  return { ...ids, mode: 'simulated' };
}
