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
    // URLSearchParams already decodes query parameters once. Decoding again
    // corrupts signed CDN URLs containing escaped path or token characters.
    const decodedUrl = url;
    const decodedRef = referer || 'https://vidzy.live/';
    const upstreamUrl = new URL(decodedUrl);
    const refererUrl = new URL(decodedRef);
    if (!['http:', 'https:'].includes(upstreamUrl.protocol)) {
      return new NextResponse('protocole non autorise', { status: 400, headers: corsHeaders });
    }

    const r = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Chrome/122.0.0.0',
        Referer: decodedRef,
        Origin: refererUrl.origin,
      },
      cache: 'no-store',
      signal: request.signal,
    });

    if (!r.ok) {
      return new NextResponse('Erreur: ' + r.status, { status: r.status, headers: corsHeaders });
    }

    const text = await r.text();
    const refEnc = encodeURIComponent(decodedRef);

    const toAbsoluteUrl = (value: string) => new URL(value.trim(), decodedUrl).href;
    const proxyPlaylist = (value: string) => (
      `/api/proxy/m3u8?url=${encodeURIComponent(toAbsoluteUrl(value))}&referer=${refEnc}`
    );
    const proxyAsset = (value: string) => (
      `/api/proxy/ts?url=${encodeURIComponent(toAbsoluteUrl(value))}&referer=${refEnc}`
    );
    const isPlaylistUrl = (value: string) => /\.m3u8(?:[?#].*)?$/i.test(value.trim());
    const rewriteUriAttributes = (line: string) => line.replace(
      /URI=(["'])([^"']+)\1/gi,
      (match, quote: string, uri: string) => {
        if (/^(data:|blob:)/i.test(uri)) return match;
        const tagUsesPlaylist = /^#EXT-X-(MEDIA|I-FRAME-STREAM-INF)/i.test(line);
        const proxied = tagUsesPlaylist || isPlaylistUrl(uri)
          ? proxyPlaylist(uri)
          : proxyAsset(uri);
        return `URI=${quote}${proxied}${quote}`;
      }
    );

    let previousTag = '';
    const rewritten = text.split(/\r?\n/).map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        previousTag = trimmed;
        return rewriteUriAttributes(line);
      }

      const shouldProxyAsPlaylist = isPlaylistUrl(trimmed)
        || /^#EXT-X-(STREAM-INF|I-FRAME-STREAM-INF|MEDIA)/i.test(previousTag);
      previousTag = '';
      return shouldProxyAsPlaylist ? proxyPlaylist(trimmed) : proxyAsset(trimmed);
    }).join('\n');

    const isCompleteVod = /(?:^|\n)#EXT-X-ENDLIST(?:\r?\n|$)/i.test(text);
    return new NextResponse(rewritten, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.apple.mpegurl',
        // La playlist doit rester fraîche, mais un court cache évite de
        // refaire la même requête pour chaque client.
        'Cache-Control': isCompleteVod
          ? 'public, max-age=60, s-maxage=60'
          : 'no-store, no-cache, must-revalidate',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (e: any) {
    return new NextResponse('Erreur: ' + e.message, { status: 500, headers: corsHeaders });
  }
}
