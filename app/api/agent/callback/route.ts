import { NextResponse } from 'next/server';
import type { IncidentOutcome } from '@/lib/seed';
import {
  addIncidentNote,
  getIncident,
  setIncidentColumn,
  setIncidentOutcome,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

type Payload = {
  incident?: string;
  author?: 'triage' | 'runbook';
  status?: string;
  body?: string;
  outcome?: Partial<IncidentOutcome> & {
    runbookSteps?: IncidentOutcome['runbookSteps'];
  };
};

/** Agents post here from inside their Harness Runtime sandbox. */
export async function POST(req: Request) {
  const expected = process.env.AGENT_CALLBACK_TOKEN;
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let p: Payload;
  try {
    p = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const key = (p.incident ?? '').trim().toUpperCase();
  const incident = key ? getIncident(key) : undefined;
  if (!incident) {
    return NextResponse.json({ error: `unknown incident ${key}` }, { status: 404 });
  }

  const author = p.author === 'runbook' ? 'runbook' : 'triage';
  addIncidentNote(key, {
    author,
    body: (p.body ?? '').slice(0, 4000) || '(no summary provided)',
    at: Date.now(),
  });

  if (author === 'triage' && p.status === 'diagnosis_ready') {
    setIncidentColumn(key, 'mitigating');
  }

  if (p.outcome && author === 'runbook') {
    const base: IncidentOutcome = {
      diagnosis: p.outcome.diagnosis ?? incident.summary,
      confidence: typeof p.outcome.confidence === 'number' ? p.outcome.confidence : 0.7,
      rootCause: p.outcome.rootCause ?? 'see agent feed',
      blastRadius: p.outcome.blastRadius ?? `${incident.service} · ${incident.severity}`,
      runbookSteps: p.outcome.runbookSteps?.length
        ? p.outcome.runbookSteps
        : [
            {
              id: 's1',
              title: 'Review agent runbook',
              detail: p.body ?? 'See timeline',
              requiresApproval: true,
              status: 'pending',
            },
          ],
      postmortemDraft: p.outcome.postmortemDraft ?? `## Incident ${key}\n\nDrafted by runbook agent.\n`,
      tokensIn: p.outcome.tokensIn ?? 0,
      tokensOut: p.outcome.tokensOut ?? 0,
      estimatedMttrMinutes: p.outcome.estimatedMttrMinutes ?? 25,
    };
    setIncidentOutcome(key, base);
    if (!incident.expectsBlockedAction) setIncidentColumn(key, 'resolved');
  }

  return NextResponse.json({ ok: true });
}
