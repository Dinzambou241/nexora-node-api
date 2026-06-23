import { NextRequest, NextResponse } from 'next/server';
import { getSeriesDetails } from '@/lib/catalog';

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
    return NextResponse.json(details, {
      headers: {
        ...corsHeaders,
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
