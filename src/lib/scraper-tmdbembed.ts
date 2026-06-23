type MediaType = 'movie' | 'series';

type TmdbEmbedStream = {
  title?: string;
  url?: string;
  quality?: string;
  provider?: string;
  headers?: Record<string, string>;
  language?: string;
  lang?: string;
  label?: string;
  subtitles?: TmdbEmbedSubtitle[] | Record<string, string> | string;
  subtitle?: string;
  tracks?: TmdbEmbedSubtitle[];
  captions?: TmdbEmbedSubtitle[];
};

type TmdbEmbedSubtitle = {
  url?: string;
  file?: string;
  src?: string;
  label?: string;
  lang?: string;
  language?: string;
  kind?: string;
  type?: string;
};

type TmdbEmbedResponse = {
  success?: boolean;
  tmdbId?: string;
  imdbId?: string | null;
  count?: number;
  providerTimings?: Record<string, number | null>;
  streams?: TmdbEmbedStream[];
  error?: string;
  message?: string;
};

type FrenchConfidence = 'verified' | 'multi' | 'audio-track' | 'subtitle-track' | 'unverified';

type TmdbEmbedOptions = {
  allowNonFrench?: boolean;
};

export type TmdbEmbedSource = {
  ok: boolean;
  erreur?: string;
  titre: string;
  provider: 'tmdbembed';
  saison?: number;
  episode?: number;
  upstreamProviders?: string[];
  requiresLanguageConfirmation?: boolean;
  languageWarning?: string;
  hosters?: Array<{
    nom: string;
    lang: string;
    embedUrl: string | null;
    directUrl: string | null;
    m3u8: string | null;
    proxyM3U8: string | null;
    proxyTS: string | null;
    source: string;
    upstreamProvider: string;
    quality: string | null;
    languageTrust: FrenchConfidence;
    canSelectFrenchAudio: boolean;
    canSelectFrenchSubtitles: boolean;
    preferredAudioLanguage: 'fr' | null;
    preferredSubtitleLanguage: 'fr' | null;
    subtitles: Array<{
      url: string;
      lang: string;
      label: string;
    }>;
  }>;
};

const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const REQUEST_TIMEOUT_MS = Number(process.env.TMDB_EMBED_TIMEOUT_MS || 20_000);
const MANIFEST_TIMEOUT_MS = Number(process.env.TMDB_EMBED_MANIFEST_TIMEOUT_MS || 6_000);
const MAX_MANIFEST_INSPECTIONS = Number(process.env.TMDB_EMBED_MAX_MANIFEST_INSPECTIONS || 5);
const FRENCH_RE = /\b(vf|vff|fr|fra|fre|french|francais|fran[cç]ais|truefrench)\b/i;
const MULTI_RE = /\b(multi|dual[\s-]?audio|multi[\s-]?audio|multi[\s-]?lang)\b/i;

function baseUrl() {
  return (process.env.TMDB_EMBED_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export function tmdbEmbedEnabled() {
  return process.env.TMDB_EMBED_ENABLED !== 'false';
}

function controllerWithTimeout(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
}

function streamText(stream: TmdbEmbedStream) {
  return [
    stream.title,
    stream.quality,
    stream.provider,
    stream.language,
    stream.lang,
    stream.label,
  ].filter(Boolean).join(' ');
}

function subtitleText(subtitle: TmdbEmbedSubtitle | string) {
  if (typeof subtitle === 'string') return subtitle;
  return [
    subtitle.label,
    subtitle.lang,
    subtitle.language,
    subtitle.kind,
    subtitle.type,
    subtitle.url,
    subtitle.file,
    subtitle.src,
  ].filter(Boolean).join(' ');
}

function subtitleUrl(subtitle: TmdbEmbedSubtitle | string) {
  if (typeof subtitle === 'string') return subtitle;
  return subtitle.url || subtitle.file || subtitle.src || '';
}

function streamSubtitles(stream: TmdbEmbedStream): TmdbEmbedSubtitle[] {
  const result: TmdbEmbedSubtitle[] = [];
  const append = (value: unknown) => {
    if (!value) return;
    if (typeof value === 'string') {
      result.push({ url: value });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
        if (typeof entry === 'string') {
          result.push({ lang: key, label: key, url: entry });
        } else if (entry && typeof entry === 'object') {
          result.push({ lang: key, label: key, ...(entry as TmdbEmbedSubtitle) });
        }
      });
    }
  };

  append(stream.subtitles);
  append(stream.subtitle);
  append(stream.tracks);
  append(stream.captions);
  return result.filter((subtitle) => subtitleUrl(subtitle));
}

function frenchSubtitlesFromMetadata(stream: TmdbEmbedStream) {
  return streamSubtitles(stream)
    .filter((subtitle) => FRENCH_RE.test(subtitleText(subtitle)))
    .map((subtitle) => ({
      url: subtitleUrl(subtitle),
      lang: 'fr',
      label: subtitle.label || subtitle.language || subtitle.lang || 'Francais',
    }));
}

function frenchConfidenceFromMetadata(stream: TmdbEmbedStream): FrenchConfidence | null {
  const text = streamText(stream);
  if (FRENCH_RE.test(text)) return 'verified';
  if (MULTI_RE.test(text)) return 'multi';
  return null;
}

function looksLikeHls(url: string) {
  return /\.m3u8(?:[?#]|$)/i.test(url);
}

function headersForStream(stream: TmdbEmbedStream) {
  const headers = new Headers();
  const sourceHeaders = stream.headers || {};
  headers.set('User-Agent', sourceHeaders['User-Agent'] || sourceHeaders['user-agent'] || 'Mozilla/5.0 Chrome/122.0.0.0');
  const referer = sourceHeaders.Referer || sourceHeaders.referer;
  if (referer) headers.set('Referer', referer);
  const origin = sourceHeaders.Origin || sourceHeaders.origin || (referer ? new URL(referer).origin : '');
  if (origin) headers.set('Origin', origin);
  return headers;
}

async function manifestHasFrenchAudio(stream: TmdbEmbedStream) {
  const url = stream.url || '';
  if (!looksLikeHls(url)) return false;

  const { controller, timeout } = controllerWithTimeout(MANIFEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: headersForStream(stream),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const text = await response.text();
    return /#EXT-X-MEDIA:[^\n]*(?:TYPE=AUDIO)[^\n]*(?:LANGUAGE=["']?(?:fr|fra|fre)["']?|NAME=["']?[^"'\n]*(?:fran[cç]ais|french|vf)[^"'\n]*["']?)/i.test(text);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function manifestHasFrenchSubtitles(stream: TmdbEmbedStream) {
  const url = stream.url || '';
  if (!looksLikeHls(url)) return false;

  const { controller, timeout } = controllerWithTimeout(MANIFEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: headersForStream(stream),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const text = await response.text();
    return /#EXT-X-MEDIA:[^\n]*(?:TYPE=SUBTITLES|TYPE=CLOSED-CAPTIONS)[^\n]*(?:LANGUAGE=["']?(?:fr|fra|fre)["']?|NAME=["']?[^"'\n]*(?:fran[cÃ§]ais|french|vostfr|sous[\s-]?titres?)[^"'\n]*["']?)/i.test(text);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function qualityRank(value?: string) {
  const quality = String(value || '').toLowerCase();
  const match = quality.match(/(\d{3,4})p?/);
  if (match) return Number(match[1]);
  if (quality.includes('4k') || quality.includes('uhd')) return 2160;
  if (quality.includes('hd')) return 720;
  return 0;
}

function providerRank(value?: string) {
  const provider = String(value || '').toLowerCase();
  const order = ['videasy', 'vidlink', 'lordflix', 'vixsrc', 'notorrent', 'showbox', '4khdhub', 'dahmermovies'];
  const index = order.indexOf(provider);
  return index === -1 ? order.length : index;
}

async function frenchConfidence(stream: TmdbEmbedStream, inspectManifest: boolean): Promise<FrenchConfidence | null> {
  const metadata = frenchConfidenceFromMetadata(stream);
  if (metadata) return metadata;
  if (inspectManifest && await manifestHasFrenchAudio(stream)) return 'audio-track';
  if (frenchSubtitlesFromMetadata(stream).length) return 'subtitle-track';
  if (inspectManifest && await manifestHasFrenchSubtitles(stream)) return 'subtitle-track';
  return null;
}

function proxiedM3u8(stream: TmdbEmbedStream) {
  const url = stream.url || '';
  if (!looksLikeHls(url)) return null;
  if (url.startsWith('/api/proxy/m3u8') || url.includes('/m3u8-proxy')) return url;

  const params = new URLSearchParams({ url });
  const referer = stream.headers?.Referer || stream.headers?.referer;
  if (referer) params.set('referer', referer);
  return `/api/proxy/m3u8?${params}`;
}

async function getTmdbEmbedStreams(
  tmdbId: string,
  type: MediaType,
  season?: number,
  episode?: number
): Promise<TmdbEmbedResponse> {
  const params = new URLSearchParams();
  if (type === 'series') {
    if (season) params.set('season', String(season));
    if (episode) params.set('episode', String(episode));
  }
  const suffix = params.toString() ? `?${params}` : '';
  const url = `${baseUrl()}/api/streams/${type}/${encodeURIComponent(tmdbId)}${suffix}`;
  const { controller, timeout } = controllerWithTimeout(REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: body.error || body.message || `TMDB-Embed HTTP ${response.status}`,
      };
    }
    return body as TmdbEmbedResponse;
  } catch (error: any) {
    return {
      success: false,
      error: error?.name === 'AbortError' ? 'TMDB-Embed timeout' : error?.message || 'TMDB-Embed indisponible',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapStreamsToHosters(streams: TmdbEmbedStream[], options: TmdbEmbedOptions = {}) {
  const candidates = streams
    .filter((stream) => stream?.url)
    .sort((left, right) => (
      providerRank(left.provider) - providerRank(right.provider)
      || qualityRank(right.quality) - qualityRank(left.quality)
      || Number(!looksLikeHls(left.url || '')) - Number(!looksLikeHls(right.url || ''))
    ));

  const result: NonNullable<TmdbEmbedSource['hosters']> = [];
  let inspected = 0;
  for (const stream of candidates) {
    const inspect = inspected < MAX_MANIFEST_INSPECTIONS && looksLikeHls(stream.url || '');
    if (inspect) inspected += 1;
    const confidence = await frenchConfidence(stream, inspect);
    if (!confidence && !options.allowNonFrench) continue;
    const languageTrust = confidence || 'unverified';

    const proxyM3U8 = proxiedM3u8(stream);
    const subtitles = frenchSubtitlesFromMetadata(stream);
    result.push({
      nom: ['TMDB Embed', stream.provider || 'provider', stream.quality || '']
        .filter(Boolean)
        .join(' - '),
      lang: languageTrust === 'subtitle-track'
        ? 'VOSTFR'
        : languageTrust === 'verified'
          ? 'VF'
          : languageTrust === 'unverified'
            ? 'VO'
            : 'MULTI',
      embedUrl: null,
      directUrl: proxyM3U8 ? null : stream.url || null,
      m3u8: looksLikeHls(stream.url || '') ? stream.url || null : null,
      proxyM3U8,
      proxyTS: proxyM3U8 ? '/api/proxy/ts?url={SEGMENT_URL}' : null,
      source: 'tmdbembed',
      upstreamProvider: stream.provider || 'unknown',
      quality: stream.quality || null,
      languageTrust,
      canSelectFrenchAudio: languageTrust === 'multi' || languageTrust === 'audio-track',
      canSelectFrenchSubtitles: languageTrust === 'subtitle-track',
      preferredAudioLanguage: ['subtitle-track', 'unverified'].includes(languageTrust) ? null : 'fr',
      preferredSubtitleLanguage: languageTrust === 'subtitle-track' ? 'fr' : null,
      subtitles,
    });
  }
  return result;
}

export async function getTmdbEmbedSource(
  tmdbId: string,
  type: MediaType,
  season?: number,
  episode?: number,
  options: TmdbEmbedOptions = {}
): Promise<TmdbEmbedSource> {
  if (!tmdbEmbedEnabled()) {
    return {
      ok: false,
      erreur: 'TMDB-Embed desactive',
      titre: `${type === 'series' ? 'Serie' : 'Film'} ${tmdbId}`,
      provider: 'tmdbembed',
      saison: season,
      episode,
    };
  }

  const response = await getTmdbEmbedStreams(tmdbId, type, season, episode);
  if (!response.success) {
    return {
      ok: false,
      erreur: response.error || response.message || 'TMDB-Embed indisponible',
      titre: `${type === 'series' ? 'Serie' : 'Film'} ${tmdbId}`,
      provider: 'tmdbembed',
      saison: season,
      episode,
    };
  }

  const hosters = await mapStreamsToHosters(response.streams || [], options);
  if (!hosters.length) {
    return {
      ok: false,
      erreur: 'TMDB-Embed ne fournit aucune source VF, VOSTFR ou piste audio FR detectable',
      titre: `${type === 'series' ? 'Serie' : 'Film'} ${tmdbId}`,
      provider: 'tmdbembed',
      saison: season,
      episode,
      upstreamProviders: Object.keys(response.providerTimings || {}),
    };
  }

  return {
    ok: true,
    titre: `${type === 'series' ? 'Serie' : 'Film'} ${tmdbId}`,
    provider: 'tmdbembed',
    saison: season,
    episode,
    upstreamProviders: Array.from(new Set(hosters.map((hoster) => hoster.upstreamProvider))),
    requiresLanguageConfirmation: hosters.some((hoster) => hoster.languageTrust === 'unverified'),
    languageWarning: hosters.some((hoster) => hoster.languageTrust === 'unverified')
      ? 'Aucune version francaise detectee. Cette source peut etre en VO ou dans une autre langue.'
      : undefined,
    hosters,
  };
}
