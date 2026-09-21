import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { incidents } = getStore();
  return NextResponse.json({
    incidents,
    products: ['Harness Runtime', 'Serverless Inference', 'Action Gateway'],
  });
}
