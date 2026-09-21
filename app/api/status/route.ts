import { NextResponse } from 'next/server';
import { marsConfigured } from '@/lib/mars';
import { inferenceConfigured } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    mars: marsConfigured(),
    inference: inferenceConfigured(),
    model: process.env.INFERENCE_MODEL ?? null,
  });
}
