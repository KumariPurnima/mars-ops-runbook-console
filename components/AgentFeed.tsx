'use client';

import { useEffect, useRef, useState } from 'react';
import type { Run, FeedItem } from '@/lib/store';
import { Markdown } from './Markdown';

function duration(ms?: number): string | null {
  if (ms === undefined) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function describeInput(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  const i = input as Record<string, unknown>;
  const first = i.command ?? i.cmd ?? i.path ?? i.model ?? i.url;
  return typeof first === 'string' ? first : JSON.stringify(first ?? i);
}

function ToolCard({ item }: { item: Extract<FeedItem, { kind: 'tool' }> }) {
  const [open, setOpen] = useState(false);
  const pending = item.ok === undefined;
  const cmd = describeInput(item.input);
  const out = item.summary ?? '';
  const long = out.length > 300 || out.split('\n').length > 6;
  const shown = open || !long ? out : out.slice(0, 300);

  return (
    <div className="feed-item rounded-lg border border-edge bg-raised overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2 border-b border-edge">
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${
            pending ? 'bg-amber live-dot' : item.ok ? 'bg-green' : 'bg-red'
          }`}
          aria-hidden
        />
        <span className="mono text-sm text-primary font-medium">{item.name || 'tool'}</span>
        <span className="ml-auto flex items-center gap-2.5">
          {duration(item.durationMs) && (
            <span className="mono text-xs text-muted">{duration(item.durationMs)}</span>
          )}
          {pending && <span className="text-xs text-amber">running</span>}
          {!pending && !item.ok && <span className="text-xs text-red font-medium">blocked / failed</span>}
        </span>
      </div>
      {cmd && (
        <pre className="mono bg-code text-secondary px-3 py-2 whitespace-pre-wrap break-all border-b border-edge">
          {cmd}
        </pre>
      )}
      {out && (
        <div className="px-3 py-2">
          <pre className="mono text-muted whitespace-pre-wrap break-all">{shown}</pre>
          {long && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="mono text-xs text-blue hover:text-primary mt-1.5"
            >
              {open ? 'show less' : `show all (${out.length} chars)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Item({ item }: { item: FeedItem }) {
  switch (item.kind) {
    case 'prompt':
      return (
        <div className="feed-item rounded-lg border border-do-blue/60 bg-do-blue/10 px-3 py-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue pb-1.5">
            Prompt delivered
          </div>
          <div className="text-base leading-relaxed text-secondary whitespace-pre-wrap">{item.text}</div>
        </div>
      );
    case 'text':
      if (!item.text.trim()) return null;
      return item.reasoning ? (
        <div className="feed-item border-l-2 border-edge-hi pl-3">
          <div className="mono text-xs uppercase tracking-wider text-subtle pb-1">thinking</div>
          <div className="text-sm leading-relaxed text-muted whitespace-pre-wrap">{item.text}</div>
        </div>
      ) : (
        <div className="feed-item px-0.5">
          <Markdown text={item.text} />
        </div>
      );
    case 'tool':
      return <ToolCard item={item} />;
    case 'blocked':
      return (
        <div className="feed-item rounded-lg border border-red/60 bg-red/10 px-3 py-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-red pb-1.5">
            Blocked by policy
          </div>
          <div className="mono text-secondary whitespace-pre-wrap">{item.detail}</div>
        </div>
      );
    case 'log':
      return <div className="feed-item mono text-xs text-subtle px-0.5">{item.message}</div>;
    case 'done':
      return (
        <div className="feed-item rounded-lg border border-green/50 bg-green/10 px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-base font-semibold text-green">Run complete</span>
          <span className="mono text-sm text-secondary">
            {item.tokensIn.toLocaleString()} in / {item.tokensOut.toLocaleString()} out
          </span>
        </div>
      );
  }
}

export type FeedTab = { id: string; label: string; run?: Run };

function Elapsed({ run }: { run: Run }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (run.status !== 'running') return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [run.status]);
  const end = run.endedAt ?? now;
  const secs = Math.max(0, Math.round((end - run.startedAt) / 1000));
  const mins = Math.floor(secs / 60);
  return <span className="mono text-xs text-muted">{mins ? `${mins}m ${secs % 60}s` : `${secs}s`}</span>;
}

export function AgentFeed({ tabs }: { tabs: FeedTab[] }) {
  const active =
    tabs.find((t) => t.run?.status === 'running') ??
    tabs.find((t) => (t.run?.feed.length ?? 0) > 0) ??
    tabs[0];
  const [tabId, setTabId] = useState(active?.id ?? tabs[0]?.id);
  const run = tabs.find((t) => t.id === tabId)?.run ?? active?.run;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const live = tabs.find((t) => t.run?.status === 'running');
    if (live) setTabId(live.id);
  }, [tabs]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [run?.feed.length, run?.status]);

  return (
    <div className="rounded-lg border border-edge bg-panel overflow-hidden h-full flex flex-col">
      <div className="px-3 py-2 border-b border-edge bg-raised flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTabId(t.id)}
              aria-current={tabId === t.id}
              className={`text-sm px-2.5 py-1 rounded transition ${
                tabId === t.id ? 'bg-do-blue/20 text-primary font-medium' : 'text-muted hover:text-primary'
              }`}
            >
              {t.label}
              {t.run?.status === 'running' && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green live-dot" />
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {run?.harnessSessionId && (
            <span className="mono text-xs text-subtle">session {run.harnessSessionId}</span>
          )}
          {run?.model && <span className="mono text-xs text-muted">{run.model}</span>}
          {run && <Elapsed run={run} />}
        </div>
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {!run || run.feed.length === 0 ? (
          <div className="h-full min-h-[280px] flex items-center justify-center text-base text-subtle px-6 text-center">
            Dispatch an incident to watch triage and runbook agents work inside Harness Runtime.
            {run?.status === 'running' && (
              <span className="block pt-2 text-sm text-muted">Waiting for first event…</span>
            )}
          </div>
        ) : (
          run.feed.map((item, i) => <Item key={`${item.at}-${i}`} item={item} />)
        )}
      </div>
    </div>
  );
}
