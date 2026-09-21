import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getStore().runs.find((r) => r.id === id);
  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(run);
}
