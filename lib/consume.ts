import { getExecution, openEventStream, parseEventStream, type MarsEvent } from './mars';
import { appendFeed, getRun, updateRun } from './store';

function isNoise(message: string): boolean {
  return (
    message.startsWith('unhandled:') ||
    message === 'session.diff' ||
    message === 'session_idle_awaiting_user'
  );
}

function looksBlocked(text: string): boolean {
  return (
    /prevents you from using this specific tool call/i.test(text) ||
    /"action"\s*:\s*"deny"/i.test(text) ||
    /\b(denied|blocked by policy|not permitted|permission denied)\b/i.test(text)
  );
}

/** Reduce one MARS event into the run's feed. Returns true if the run finished. */
export function applyEvent(runId: string, ev: MarsEvent): boolean {
  const at = ev.timestamp ? Date.parse(ev.timestamp) : Date.now();
  const d = (ev.data ?? {}) as Record<string, unknown>;

  switch (ev.type) {
    case 'run.started':
      updateRun(runId, { status: 'running' });
      if (typeof d.agent === 'string') {
        appendFeed(runId, { kind: 'prompt', text: d.agent, at });
      }
      return false;

    case 'run.token_delta':
      if (typeof d.text === 'string' && d.text.length) {
        appendFeed(runId, {
          kind: 'text',
          text: d.text,
          reasoning: Boolean(d.is_reasoning),
          at,
        });
      }
      return false;

    case 'run.tool_call_started':
      appendFeed(runId, {
        kind: 'tool',
        id: String(d.tool_call_id ?? ''),
        name: String(d.name ?? 'tool'),
        input: d.input,
        at,
      });
      return false;

    case 'run.tool_call_completed': {
      const summary = typeof d.summary === 'string' ? d.summary : undefined;
      appendFeed(runId, {
        kind: 'tool',
        id: String(d.tool_call_id ?? ''),
        name: '',
        input: undefined,
        ok: Boolean(d.ok),
        durationMs: typeof d.duration_ms === 'number' ? d.duration_ms : undefined,
        summary,
        at,
      });
      if (d.ok === false && summary && looksBlocked(summary)) {
        appendFeed(runId, { kind: 'blocked', detail: summary.slice(0, 400), at });
      }
      return false;
    }

    case 'run.usage_recorded': {
      const u = (d.usage ?? {}) as Record<string, number>;
      const r = getRun(runId);
      if (r) {
        updateRun(runId, {
          tokensIn: (r.tokensIn ?? 0) + (u.input_tokens ?? 0),
          tokensOut: (r.tokensOut ?? 0) + (u.output_tokens ?? 0),
        });
      }
      return false;
    }

    case 'run.log': {
      const message = String(d.message ?? '');
      if (message && !isNoise(message)) {
        appendFeed(runId, { kind: 'log', message, at });
        if (looksBlocked(message)) {
          appendFeed(runId, { kind: 'blocked', detail: message.slice(0, 400), at });
        }
      }
      return false;
    }

    case 'run.completed':
      appendFeed(runId, {
        kind: 'done',
        tokensIn: Number(d.total_tokens_in ?? 0),
        tokensOut: Number(d.total_tokens_out ?? 0),
        at,
      });
      updateRun(runId, {
        status: 'completed',
        endedAt: at,
        tokensIn: Number(d.total_tokens_in ?? 0),
        tokensOut: Number(d.total_tokens_out ?? 0),
      });
      return true;

    default:
      return false;
  }
}

/**
 * Follow a session event stream and fold events into the store.
 * Survives page reload and captures fresh-mode sessions before they are destroyed.
 */
export async function consumeSession(
  runId: string,
  sessionId: string,
  opts: { timeoutMs?: number; liveGateMs?: number; triggerId?: string } = {},
): Promise<void> {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), opts.timeoutMs ?? 15 * 60 * 1000);

  let live = false;
  let skipped = 0;
  let applied = 0;

  const gate = setTimeout(() => {
    if (!live) {
      live = true;
      console.warn(
        `[consume ${runId}] no live transition after ${(opts.liveGateMs ?? 90_000) / 1000}s; applying anyway`,
      );
    }
  }, opts.liveGateMs ?? 90_000);

  try {
    const res = await openEventStream(sessionId, { signal: ac.signal });
    if (!res.ok) {
      console.error(`[consume ${runId}] event stream ${res.status}`);
      updateRun(runId, { status: 'failed', error: `event stream ${res.status}` });
      return;
    }
    console.log(`[consume ${runId}] attached to ${sessionId}`);

    for await (const ev of parseEventStream(res)) {
      if (!live) {
        if (ev.type === 'stream.state' && (ev.data as { state?: string })?.state === 'live') {
          live = true;
          console.log(`[consume ${runId}] caught up after ${skipped} replayed frames`);
        } else {
          skipped++;
        }
        continue;
      }
      applied++;
      if (applyEvent(runId, ev)) {
        console.log(`[consume ${runId}] run completed (${applied} events applied)`);
        break;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('abort')) {
      console.error(`[consume ${runId}] stream error: ${msg}`);
      updateRun(runId, { error: msg });
    }
  } finally {
    clearTimeout(timeout);
    clearTimeout(gate);
    ac.abort();
  }

  const run = getRun(runId);
  if (!run || run.status !== 'running') return;

  const triggerId = opts.triggerId;
  if (!triggerId) {
    console.warn(`[consume ${runId}] stream ended, no trigger to reconcile against`);
    updateRun(runId, { error: 'event stream ended early; outcome unknown' });
    return;
  }

  for (let i = 0; i < 120; i++) {
    const ex = await getExecution(triggerId, runId);
    if (ex && ex.status !== 'running' && ex.status !== 'pending') {
      console.log(`[consume ${runId}] reconciled from execution: ${ex.status}`);
      updateRun(runId, {
        status: ex.status === 'succeeded' ? 'completed' : 'failed',
        endedAt: Date.now(),
        error: ex.status === 'failed' ? (ex.failure_reason ?? 'execution failed') : undefined,
      });
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  console.warn(`[consume ${runId}] execution still not terminal after 10 min`);
  updateRun(runId, { error: 'lost the event stream; still running per the platform' });
}
