import crypto from 'node:crypto';

const API = 'https://api.digitalocean.com/v2/agents';

function token(): string {
  const t = process.env.DO_API_TOKEN;
  if (!t) throw new Error('DO_API_TOKEN is not set');
  return t;
}

export function marsConfigured(): boolean {
  const id = process.env.MARS_TRIAGE_TRIGGER_ID;
  const secret = process.env.MARS_TRIAGE_TRIGGER_SECRET;
  const tok = process.env.DO_API_TOKEN;
  const bad = (v?: string) => !v || v === 'REPLACE_ME';
  return !bad(id) && !bad(secret) && !bad(tok);
}

/**
 * Sign and fire a MARS webhook trigger (custom provider).
 * Signature covers the exact bytes sent — never re-serialise after signing.
 */
export async function fireTrigger(
  triggerId: string,
  secret: string,
  payload: unknown,
): Promise<{ executionId: string }> {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');

  const res = await fetch(`${API}/triggers/${triggerId}/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DigitalOcean-Signature': `t=${ts},v1=${sig}`,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`trigger fire failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { execution_id: string };
  return { executionId: json.execution_id };
}

export type Execution = {
  execution_id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  session_id?: string;
  failure_reason?: string;
  created_at?: string;
};

export async function listExecutions(triggerId: string): Promise<Execution[]> {
  const res = await fetch(`${API}/triggers/${triggerId}/executions`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { executions?: Execution[] } | Execution[];
  return Array.isArray(json) ? json : (json.executions ?? []);
}

export async function getExecution(
  triggerId: string,
  executionId: string,
): Promise<Execution | undefined> {
  const all = await listExecutions(triggerId);
  return all.find((e) => e.execution_id === executionId);
}

export async function waitForExecutionSession(
  triggerId: string,
  executionId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<string | null> {
  const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
  while (Date.now() < deadline) {
    const ex = await getExecution(triggerId, executionId);
    if (ex?.session_id) return ex.session_id;
    if (ex && (ex.status === 'failed' || ex.status === 'succeeded') && !ex.session_id) return null;
    await new Promise((r) => setTimeout(r, opts.intervalMs ?? 1000));
  }
  return null;
}

export async function setTriggerStatus(
  triggerId: string,
  status: 'active' | 'paused',
): Promise<string | null> {
  try {
    const res = await fetch(`${API}/triggers/${triggerId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok ? null : `could not set trigger ${status} (${res.status})`;
  } catch (e) {
    return `could not set trigger ${status}: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function openEventStream(
  sessionId: string,
  opts: { replayOnly?: boolean; signal?: AbortSignal } = {},
): Promise<Response> {
  const qs = opts.replayOnly ? '?replay_only=true' : '';
  return fetch(`${API}/sessions/${sessionId}/events${qs}`, {
    headers: { Authorization: `Bearer ${token()}`, Accept: 'text/event-stream' },
    cache: 'no-store',
    signal: opts.signal,
  });
}

export type MarsEvent = {
  event_id?: string;
  session_id?: string;
  seq?: number;
  timestamp?: string;
  type: string;
  data?: Record<string, unknown>;
};

export async function* parseEventStream(res: Response): AsyncGenerator<MarsEvent> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          yield JSON.parse(line.slice(6)) as MarsEvent;
        } catch {
          /* skip partial frames */
        }
      }
    }
  }
}
