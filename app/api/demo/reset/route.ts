import { NextResponse } from 'next/server';
import { resetStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST() {
  resetStore();
  return NextResponse.json({
    ok: true,
    incidentsRestored: 5,
    runsCleared: true,
    message: 'Board reset — five seeded incidents in Triggered.',
  });
}
