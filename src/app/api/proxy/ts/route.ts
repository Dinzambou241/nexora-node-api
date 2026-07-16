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
    // URLSearchParams already performs the required query decoding.
    const decodedUrl = url;
    const decodedRef = referer || 'https://vidzy.live/';
    const upstreamUrl = new URL(decodedUrl);
    const refererUrl = new URL(decodedRef);
    if (!['http:', 'https:'].includes(upstreamUrl.protocol)) {
      return new NextResponse('protocole non autorise', { status: 400, headers: corsHeaders });
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 Chrome/122.0.0.0',
      Referer: decodedRef,
      Origin: refererUrl.origin,
      Accept: '*/*',
      'Accept-Encoding': 'identity',
    };

    const range = request.headers.get('range');
    if (range) {
      headers['Range'] = range;
    }

    const r = await fetch(decodedUrl, {
      headers,
      cache: 'no-store',
      signal: request.signal,
    });

    if (!r.ok && r.status !== 206) {
      return new NextResponse('Erreur: ' + r.status, { status: r.status, headers: corsHeaders });
    }

    const ct = r.headers.get('content-type') || 'video/mp2t';
    const cl = r.headers.get('content-length');
    const cr = r.headers.get('content-range');

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': ct,
      'Accept-Ranges': 'bytes',
      'Cache-Control': r.headers.get('cache-control') || 'public, max-age=86400, immutable',
      'X-Accel-Buffering': 'no',
    };

    if (cl) {
      responseHeaders['Content-Length'] = cl;
    }
    if (cr) {
      responseHeaders['Content-Range'] = cr;
    }
    const etag = r.headers.get('etag');
    const lastModified = r.headers.get('last-modified');
    if (etag) responseHeaders.ETag = etag;
    if (lastModified) responseHeaders['Last-Modified'] = lastModified;

    // Relayer le flux directement évite de charger chaque segment en mémoire
    // avant de commencer son envoi au lecteur.
    return new NextResponse(r.body, {
      status: r.status,
      headers: responseHeaders,
    });
  } catch (e: any) {
    return new NextResponse('Erreur: ' + e.message, { status: 500, headers: corsHeaders });
  }
}
