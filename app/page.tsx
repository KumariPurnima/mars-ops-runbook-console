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
  const [status, setStatus] = useState<{ mars: boolean; inference: boolean }>({
    mars: false,
    inference: false,
  });

  const refresh = useCallback(async () => {
    try {
      const [i, r, s] = await Promise.all([
        fetch('/api/incidents', { cache: 'no-store' }).then((x) => x.json()),
        fetch('/api/runs', { cache: 'no-store' }).then((x) => x.json()),
        fetch('/api/status', { cache: 'no-store' }).then((x) => x.json()),
      ]);
      setIncidents(i.incidents ?? []);
      setRuns(r.runs ?? []);
      setStatus({ mars: Boolean(s.mars), inference: Boolean(s.inference) });
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
    <main className="min-h-screen hero-shell">
      <div className="p-5 max-w-[1800px] mx-auto">
        <header className="hero-band hero-rise rounded-2xl px-5 py-5 mb-5 relative z-[1]">
          <div className="relative z-[1] flex flex-wrap items-start gap-4">
            <div className="min-w-[280px] flex-1">
              <div className="brand-chip mb-3">
                <img
                  src="/brand/digitalocean-mark.png"
                  alt="DigitalOcean"
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                />
                <span className="text-sm font-semibold text-primary tracking-tight">DigitalOcean</span>
                <span className="mono text-[11px] text-cyan">Gradient AI · MARS</span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-2xl md:text-[1.85rem] font-semibold text-primary tracking-tight">
                  Ops Runbook Agent
                </h1>
                <span className="mono text-xs px-2.5 py-1 rounded-full border border-cyan/35 bg-cyan/10 text-cyan">
                  Incident Copilot
                </span>
                <span
                  className={`mono text-xs px-2.5 py-1 rounded-full border ${
                    status.mars
                      ? 'border-green/40 bg-green/10 text-green'
                      : 'border-amber/40 bg-amber/10 text-amber'
                  }`}
                  title={
                    status.mars
                      ? 'MARS triggers configured — dispatch fires Harness Runtime'
                      : 'MARS not configured — dispatch uses simulated / replay path'
                  }
                >
                  {status.mars ? 'MARS live' : 'simulated'}
                </span>
              </div>
              <p className="text-base text-secondary pt-2 max-w-2xl leading-relaxed">
                A pager alert becomes a diagnosis, gated runbook, and postmortem draft — worked by
                agents on DigitalOcean Harness Runtime and Serverless Inference.
              </p>
              <p className="credit-line text-sm text-muted pt-3">
                Architected by{' '}
                <span className="text-primary font-medium">Purnima Kumari</span>
                <span className="text-subtle">, Sr. Solution Architect II · DigitalOcean Shark</span>
              </p>
            </div>

            <div className="hidden md:flex items-end justify-center self-stretch px-2">
              <div className="sammy-sway" title="Sammy the Shark">
                <img
                  src="/brand/sammy.png"
                  alt="Sammy the Shark"
                  width={120}
                  height={108}
                  className="sammy-float h-[108px] w-auto drop-shadow-[0_12px_24px_rgba(0,128,255,0.25)] select-none"
                  draggable={false}
                />
              </div>
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-3 ml-auto">
              <nav
                className="flex items-center gap-1 p-1 rounded-xl border border-edge bg-ink/40"
                aria-label="Views"
              >
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
                    className={`text-sm px-3 py-1.5 rounded-lg transition ${
                      tab === id
                        ? 'bg-do-blue text-white font-medium shadow-[0_0_24px_rgba(0,128,255,0.25)]'
                        : 'text-muted hover:text-primary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  onClick={reset}
                  disabled={resetting}
                  title="Restore the five seeded incidents"
                  className="text-sm px-3 py-1.5 rounded-lg border border-edge text-muted hover:text-primary hover:border-edge-hi transition disabled:opacity-50"
                >
                  {resetting ? 'resetting…' : 'reset demo'}
                </button>
                <button
                  onClick={replay}
                  disabled={busy || resetting}
                  title="Replay the rehearsed SEV-1 canary incident offline"
                  className="text-sm px-3 py-1.5 rounded-lg border border-edge text-muted hover:text-primary hover:border-edge-hi transition disabled:opacity-50"
                >
                  replay (offline)
                </button>
                <button
                  onClick={dispatch}
                  disabled={!canDispatch}
                  className="text-base font-semibold px-4 py-2 rounded-lg bg-do-blue text-white hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-[0_8px_28px_rgba(0,128,255,0.35)]"
                >
                  {running
                    ? 'Agent working…'
                    : `Dispatch incident copilot${incident ? ` → ${incident.key}` : ''}`}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Sammy — gentle float under actions */}
          <div className="md:hidden relative z-[1] flex justify-center pt-3">
            <img
              src="/brand/sammy.png"
              alt="Sammy the Shark"
              width={88}
              height={80}
              className="sammy-float h-20 w-auto select-none"
              draggable={false}
            />
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
              <div className="mt-3 rounded-xl border border-edge bg-panel/90 p-3.5 backdrop-blur-sm">
                <div className="flex flex-wrap items-start gap-2.5">
                  <span className="mono text-base text-cyan">{incident.key}</span>
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

        <footer className="pt-6 pb-2 text-sm text-subtle text-center max-w-3xl mx-auto space-y-1.5">
          <p>
            The board stands in for PagerDuty — in production this is Action Gateway&apos;s alerting
            connector. Harness Runtime provides the durable isolated session; Serverless Inference
            powers reasoning with no GPU fleet. Humans still own production changes.
          </p>
          <p className="credit-line text-muted">
            Architected by Purnima Kumari, Sr. Solution Architect II · DigitalOcean Shark
          </p>
        </footer>
      </div>
    </main>
  );
}
