'use client';

import { useCallback, useEffect, useState } from 'react';
import { IncidentBoard } from '@/components/IncidentBoard';
import { AgentFeed } from '@/components/AgentFeed';
import { Outcome } from '@/components/Outcome';
import { AgentsTab } from '@/components/AgentsTab';
import type { Incident } from '@/lib/seed';
import type { Run } from '@/lib/store';

type ResetSummary = {
  ok: boolean;
  incidentsRestored?: number;
  message?: string;
  error?: string;
};

export default function Page() {
  const [tab, setTab] = useState<'board' | 'agents'>('board');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<ResetSummary>();
  const [err, setErr] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const [i, r] = await Promise.all([
        fetch('/api/incidents', { cache: 'no-store' }).then((x) => x.json()),
        fetch('/api/runs', { cache: 'no-store' }).then((x) => x.json()),
      ]);
      setIncidents(i.incidents ?? []);
      setRuns(r.runs ?? []);
      if (!selected && i.incidents?.length) {
        const preferred =
          i.incidents.find((x: Incident) => x.key === 'INC-104') ?? i.incidents[0];
        setSelected(preferred.key);
      }
    } catch {
      /* next tick */
    }
  }, [selected]);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => void refresh(), 700);
    return () => clearInterval(iv);
  }, [refresh]);

  const incident = incidents.find((t) => t.key === selected);

  const pick = (role: 'triage' | 'runbook') => {
    const mine = runs.filter((r) => r.incident === selected && r.role === role);
    return (
      mine.find((r) => r.status === 'running' && r.feed.length > 0) ??
      mine.find((r) => r.feed.length > 0) ??
      mine.find((r) => r.status === 'running') ??
      mine[0]
    );
  };
  const triageRun = pick('triage');
  const runbookRun = pick('runbook');

  const dispatch = async () => {
    if (!incident) return;
    setBusy(true);
    setErr(undefined);
    try {
      const res = await fetch(`/api/incidents/${incident.key}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) setErr(body.error ?? 'dispatch failed');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const replay = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      const res = await fetch('/api/demo/replay', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) setErr(body.error ?? 'replay failed');
      else setSelected('INC-104');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const reset = async () => {
    setResetting(true);
    setResetResult(undefined);
    setErr(undefined);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      setResetResult(await res.json());
    } catch (e) {
      setResetResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setResetting(false);
      void refresh();
    }
  };

  const running = triageRun?.status === 'running' || runbookRun?.status === 'running';
  const canDispatch = incident && !busy && !resetting && !running;

  return (
    <main className="min-h-screen hero-glow">
      <div className="p-5 max-w-[1800px] mx-auto">
        <header className="flex flex-wrap items-center gap-4 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-primary">Ops Runbook Agent</h1>
              <span className="mono text-xs px-2 py-0.5 rounded border border-do-blue/40 bg-do-blue/10 text-blue">
                Incident Copilot
              </span>
            </div>
            <p className="text-sm text-muted pt-0.5 max-w-3xl">
              A pager alert becomes a diagnosis, gated runbook, and postmortem draft — worked by
              agents on DigitalOcean Harness Runtime and Serverless Inference
            </p>
          </div>

          <nav className="flex items-center gap-1 ml-2" aria-label="Views">
            {(
              [
                ['board', 'Incidents & runs'],
                ['agents', 'Agents & guardrails'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id}
                className={`text-base px-3 py-1.5 rounded transition ${
                  tab === id
                    ? 'bg-do-blue/20 text-primary font-medium'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button
              onClick={reset}
              disabled={resetting}
              title="Restore the five seeded incidents"
              className="text-sm px-3 py-1.5 rounded border border-edge text-muted hover:text-primary hover:border-edge-hi transition disabled:opacity-50"
            >
              {resetting ? 'resetting…' : 'reset demo'}
            </button>
            <button
              onClick={replay}
              disabled={busy || resetting}
              title="Replay the rehearsed SEV-1 canary incident offline"
              className="text-sm px-3 py-1.5 rounded border border-edge text-muted hover:text-primary hover:border-edge-hi transition disabled:opacity-50"
            >
              replay (offline)
            </button>
            <button
              onClick={dispatch}
              disabled={!canDispatch}
              className="text-base font-medium px-4 py-1.5 rounded bg-do-blue text-white hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              {running
                ? 'Agent working…'
                : `Dispatch incident copilot${incident ? ` → ${incident.key}` : ''}`}
            </button>
          </div>
        </header>

        {err && (
          <div className="mb-3 rounded-lg border border-red/60 bg-red/10 px-3 py-2.5 text-base text-red">
            {err}
          </div>
        )}

        {resetResult && (
          <div
            className={`mb-3 rounded-lg border px-3 py-2.5 text-base ${
              resetResult.ok
                ? 'border-green/50 bg-green/10 text-green'
                : 'border-red/60 bg-red/10 text-red'
            }`}
          >
            {resetResult.ok
              ? resetResult.message ??
                `Reset complete — ${resetResult.incidentsRestored ?? 0} incidents restored.`
              : `Reset failed: ${resetResult.error}`}
          </div>
        )}

        {tab === 'agents' ? (
          <AgentsTab />
        ) : (
          <>
            <IncidentBoard
              incidents={incidents}
              selected={selected}
              onSelect={setSelected}
            />

            {incident && (
              <div className="mt-3 rounded-lg border border-edge bg-panel p-3.5">
                <div className="flex flex-wrap items-start gap-2.5">
                  <span className="mono text-base text-blue">{incident.key}</span>
                  <span className="mono text-sm text-amber">{incident.severity}</span>
                  <span className="text-lg text-primary font-medium">{incident.summary}</span>
                  <span className="ml-auto text-sm text-muted">
                    {incident.service} · opened by {incident.reporter}
                  </span>
                </div>
                <p className="text-base leading-relaxed text-secondary pt-2.5 whitespace-pre-wrap">
                  {incident.description}
                </p>
                {incident.expectsBlockedAction && (
                  <div className="mt-2.5 rounded-md border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-amber">
                    This incident deliberately asks for something the agent policy denies. Watch the
                    feed refuse it — and watch what it proposes next.
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mt-3">
              <div className="xl:col-span-2 h-[640px]">
                <AgentFeed
                  tabs={[
                    { id: 'triage', label: 'Triage agent', run: triageRun },
                    { id: 'runbook', label: 'Runbook agent', run: runbookRun },
                  ]}
                />
              </div>
              <div className="h-[640px]">
                <Outcome incident={incident} />
              </div>
            </div>
          </>
        )}

        <footer className="pt-5 text-sm text-subtle text-center max-w-3xl mx-auto">
          The board stands in for PagerDuty — in production this is Action Gateway&apos;s alerting
          connector. Harness Runtime provides the durable isolated session; Serverless Inference
          powers reasoning with no GPU fleet. Humans still own production changes.
        </footer>
      </div>
    </main>
  );
}
