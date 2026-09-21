import { NextResponse } from 'next/server';
import { dispatchIncident } from '@/lib/engine';
import { getIncident } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const incident = getIncident(key);
  if (!incident) return NextResponse.json({ error: `unknown incident ${key}` }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { replay?: boolean };
  try {
    const ids = await dispatchIncident(key, { replay: body.replay ?? false });
    return NextResponse.json({ ok: true, ...ids });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
