import { NextRequest, NextResponse } from 'next/server';
import { getCatalogItems } from '@/lib/catalog';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestedType = searchParams.get('type') || 'movie';
    const type = requestedType === 'series' ? 'series' : 'movie';
    const limit = Number(searchParams.get('limit') || '180');
    const query = searchParams.get('q') || '';
    const sort = searchParams.get('sort') || '';

    const items = await getCatalogItems(type, { query, limit, sort });
    return NextResponse.json(items, {
      headers: {
        ...corsHeaders,
        'Cache-Control': query
          ? 'public, max-age=300, stale-while-revalidate=900'
          : 'public, max-age=1800, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('[CATALOG] Node catalog error', error);
    return NextResponse.json(
      { ok: false, error: 'catalog_unavailable' },
      { status: 503, headers: corsHeaders }
    );
  }
}
