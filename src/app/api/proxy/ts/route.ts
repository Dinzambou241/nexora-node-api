import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, corsOptions } from '@/lib/cors';

export function OPTIONS() {
  return corsOptions();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const referer = searchParams.get('referer');

  if (!url) {
    return new NextResponse('url manquante', { status: 400, headers: corsHeaders });
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    const decodedRef = referer ? decodeURIComponent(referer) : 'https://vidzy.live/';

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 Chrome/122.0.0.0',
      Referer: decodedRef,
      Origin: new URL(decodedRef).origin,
    };

    const range = request.headers.get('range');
    if (range) {
      headers['Range'] = range;
    }

    const r = await fetch(decodedUrl, { headers });

    if (!r.ok && r.status !== 206) {
      return new NextResponse('Erreur: ' + r.status, { status: r.status, headers: corsHeaders });
    }

    const ct = r.headers.get('content-type') || 'video/mp2t';
    const cl = r.headers.get('content-length');
    const cr = r.headers.get('content-range');

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': ct,
      'Cache-Control': 'public, max-age=31536000, immutable',
    };

    if (cl) {
      responseHeaders['Content-Length'] = cl;
    }
    if (cr) {
      responseHeaders['Content-Range'] = cr;
    }

    const buffer = await r.arrayBuffer();

    return new NextResponse(buffer, {
      status: cr ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (e: any) {
    return new NextResponse('Erreur: ' + e.message, { status: 500, headers: corsHeaders });
  }
}
