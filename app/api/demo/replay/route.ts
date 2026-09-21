import { NextResponse } from 'next/server';
import { dispatchIncident } from '@/lib/engine';
import { resetStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Offline leadership path: reset, then replay the rehearsed SEV-1 canary incident. */
export async function POST() {
  resetStore();
  const ids = await dispatchIncident('INC-104', { replay: true });
  return NextResponse.json({
    ok: true,
    incident: 'INC-104',
    ...ids,
  });
}
