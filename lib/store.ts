import { seedIncidents, type Incident, type IncidentOutcome } from './seed';

export type FeedItem =
  | { kind: 'prompt'; text: string; at: number }
  | { kind: 'text'; text: string; reasoning?: boolean; at: number }
  | {
      kind: 'tool';
      id?: string;
      name: string;
      input?: unknown;
      summary?: string;
      ok?: boolean;
      durationMs?: number;
      at: number;
    }
  | { kind: 'blocked'; detail: string; at: number }
  | { kind: 'log'; message: string; at: number }
  | { kind: 'done'; tokensIn: number; tokensOut: number; at: number };

export type RunRole = 'triage' | 'runbook';
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed';

export type Run = {
  id: string;
  incident: string;
  role: RunRole;
  status: RunStatus;
  startedAt: number;
  endedAt?: number;
  feed: FeedItem[];
  harnessSessionId?: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
  mode?: 'mars' | 'simulated' | 'replay';
};

type Store = {
  incidents: Incident[];
  runs: Run[];
};

declare global {
  // eslint-disable-next-line no-var
  var __opsStore: Store | undefined;
}

function empty(): Store {
  return { incidents: seedIncidents(), runs: [] };
}

export function getStore(): Store {
  if (!globalThis.__opsStore) globalThis.__opsStore = empty();
  return globalThis.__opsStore;
}

export function resetStore(): void {
  globalThis.__opsStore = empty();
}

export function getIncident(key: string): Incident | undefined {
  return getStore().incidents.find((i) => i.key === key);
}

export function getRun(id: string): Run | undefined {
  return getStore().runs.find((r) => r.id === id);
}

export function upsertRun(run: Run): void {
  const store = getStore();
  const idx = store.runs.findIndex((r) => r.id === run.id);
  if (idx === -1) store.runs.push(run);
  else store.runs[idx] = run;
}

export function updateRun(id: string, patch: Partial<Run>): void {
  const run = getRun(id);
  if (!run) return;
  Object.assign(run, patch);
}

export function appendFeed(runId: string, item: FeedItem): void {
  const run = getStore().runs.find((r) => r.id === runId);
  if (!run) return;

  if (item.kind === 'tool' && item.id) {
    const idx = run.feed.findIndex((f) => f.kind === 'tool' && f.id === item.id);
    if (idx >= 0) {
      const prev = run.feed[idx] as Extract<FeedItem, { kind: 'tool' }>;
      run.feed = [
        ...run.feed.slice(0, idx),
        {
          ...prev,
          ...item,
          name: item.name || prev.name,
          input: item.input ?? prev.input,
        },
        ...run.feed.slice(idx + 1),
      ];
      return;
    }
  }

  run.feed = [...run.feed, item];
}

export function setIncidentColumn(key: string, column: Incident['column']): void {
  const inc = getIncident(key);
  if (inc) inc.column = column;
}

export function setIncidentOutcome(key: string, outcome: IncidentOutcome): void {
  const inc = getIncident(key);
  if (inc) {
    inc.outcome = outcome;
    inc.notes = [
      ...inc.notes,
      {
        author: 'runbook',
        body: `Diagnosis posted · confidence ${(outcome.confidence * 100).toFixed(0)}% · est. MTTR ${outcome.estimatedMttrMinutes}m`,
        at: Date.now(),
      },
    ];
  }
}

export function addIncidentNote(key: string, note: Incident['notes'][number]): void {
  const inc = getIncident(key);
  if (inc) inc.notes = [...inc.notes, note];
}
