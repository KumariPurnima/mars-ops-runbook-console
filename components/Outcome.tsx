'use client';

import type { Incident } from '@/lib/seed';
import { Markdown } from './Markdown';

const NOTE_STYLE: Record<string, string> = {
  triage: 'text-blue',
  runbook: 'text-violet',
  system: 'text-muted',
  human: 'text-green',
};

const STEP_STYLE: Record<string, string> = {
  done: 'border-green/40 bg-green/10 text-green',
  pending: 'border-amber/40 bg-amber/10 text-amber',
  blocked: 'border-red/40 bg-red/10 text-red',
  approved: 'border-do-blue/40 bg-do-blue/10 text-blue',
};

export function Outcome({ incident }: { incident?: Incident }) {
  if (!incident) {
    return (
      <div className="rounded-lg border border-edge bg-panel p-6 text-center text-base text-subtle">
        Select an incident.
      </div>
    );
  }

  const o = incident.outcome;

  return (
    <div className="rounded-lg border border-edge bg-panel overflow-hidden flex flex-col h-full">
      <div className="px-3 py-2 border-b border-edge bg-raised flex items-center gap-2">
        <span className="text-sm font-semibold uppercase tracking-wider text-muted">Outcome</span>
        {o && (
          <span className="ml-auto mono text-xs text-muted">
            conf {(o.confidence * 100).toFixed(0)}% · MTTR ~{o.estimatedMttrMinutes}m
          </span>
        )}
      </div>

      <div className="p-3 space-y-3 overflow-y-auto">
        {!o ? (
          <div className="rounded-md border border-edge bg-raised p-3 text-sm text-muted leading-relaxed">
            When the runbook agent finishes, diagnosis, gated steps, and a postmortem draft land here.
            Humans still own production changes.
          </div>
        ) : (
          <>
            <div className="rounded-md border border-edge bg-raised p-2.5 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-subtle">Diagnosis</div>
              <p className="text-base text-primary leading-snug">{o.diagnosis}</p>
              <div className="text-sm text-secondary">
                <span className="text-muted">Root cause · </span>
                {o.rootCause}
              </div>
              <div className="text-sm text-secondary">
                <span className="text-muted">Blast radius · </span>
                {o.blastRadius}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-subtle pb-2">
                Runbook steps
              </div>
              <div className="space-y-2">
                {o.runbookSteps.map((s) => (
                  <div key={s.id} className="rounded-md border border-edge bg-raised p-2.5">
                    <div className="flex items-center gap-2 pb-1">
                      <span className="text-base text-primary font-medium">{s.title}</span>
                      <span className={`ml-auto mono text-xs px-1.5 py-px rounded border ${STEP_STYLE[s.status]}`}>
                        {s.status}
                        {s.requiresApproval ? ' · approval' : ''}
                      </span>
                    </div>
                    <p className="text-sm text-secondary leading-snug">{s.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-subtle pb-2">
                Postmortem draft
              </div>
              <div className="rounded-md border border-edge bg-raised p-2.5">
                <Markdown text={o.postmortemDraft} />
              </div>
            </div>

            <div className="mono text-xs text-subtle">
              tokens {o.tokensIn.toLocaleString()} in / {o.tokensOut.toLocaleString()} out · Serverless
              Inference
            </div>
          </>
        )}

        {incident.notes.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-subtle pb-2">Timeline</div>
            <div className="space-y-2">
              {incident.notes.map((n, i) => (
                <div key={i} className="text-sm leading-snug">
                  <span className={`mono text-xs ${NOTE_STYLE[n.author]}`}>{n.author}</span>
                  <span className="text-secondary"> — {n.body}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
