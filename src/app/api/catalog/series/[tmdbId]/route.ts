import { NextRequest, NextResponse } from 'next/server';
import { getSeriesDetails } from '@/lib/catalog';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const { tmdbId } = await context.params;
    const details = await getSeriesDetails(tmdbId);
    // Build the JSON once and send an explicit length. This avoids leaving
    // large catalogue responses on an open chunked connection behind nginx.
    const body = JSON.stringify(details);
    return new NextResponse(body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': String(Buffer.byteLength(body, 'utf8')),
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('[CATALOG] Node series details error', error);
    return NextResponse.json(
      { ok: false, error: 'series_details_unavailable' },
      { status: 503, headers: corsHeaders }
    );
  }
}
