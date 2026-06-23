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

    const r = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Chrome/122.0.0.0',
        Referer: decodedRef,
        Origin: new URL(decodedRef).origin,
      },
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
        const proxied = isPlaylistUrl(uri) ? proxyPlaylist(uri) : proxyAsset(uri);
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

    return new NextResponse(rewritten, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: any) {
    return new NextResponse('Erreur: ' + e.message, { status: 500, headers: corsHeaders });
  }
}
