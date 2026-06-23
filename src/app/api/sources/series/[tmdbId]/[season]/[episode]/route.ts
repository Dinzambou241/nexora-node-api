import { NextRequest } from 'next/server';
import { getSeriesSource } from '@/lib/scraper-series';
import { getTmdbEmbedSource } from '@/lib/scraper-tmdbembed';
import { db } from '@/db';
import { streamCache } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { CONFIG } from '@/lib/config';
import { corsJson, corsOptions } from '@/lib/cors';


const DEBUG_SCRAPER_LOGS = process.env.DEBUG_SCRAPER_LOGS === 'true';
function debugLog(...args: unknown[]) {
  if (DEBUG_SCRAPER_LOGS) console.log(...args);
}
const CACHE_TTL = CONFIG.CACHE_TTL_MS;
const AUTO_PROVIDER_TIMEOUT_MS = 35_000;

type SeriesProvider = 'auto' | 'orion' | 'tmdbembed';
type SeriesSourceData =
  | Awaited<ReturnType<typeof getSeriesSource>>
  | Awaited<ReturnType<typeof getTmdbEmbedSource>>;

export function OPTIONS() {
  return corsOptions();
}

async function getSeriesSourceByProvider(
  tmdbId: string,
  season: number,
  episode: number,
  provider: SeriesProvider,
  options: { allowNonFrench?: boolean } = {}
): Promise<SeriesSourceData> {
  if (provider === 'tmdbembed') {
    return getTmdbEmbedSource(tmdbId, 'series', season, episode, {
      allowNonFrench: options.allowNonFrench,
    });
  }

  const data = await getSeriesSource(tmdbId, season, episode);
  (data as any).provider = 'orion';
  return data;
}

function withProviderTimeout(
  provider: SeriesProvider,
  tmdbId: string,
  season: number,
  episode: number,
  promise: Promise<SeriesSourceData>
): Promise<SeriesSourceData> {
  return Promise.race([
    promise,
    new Promise<SeriesSourceData>((resolve) => {
      setTimeout(() => {
        resolve({
          ok: false,
          erreur: `Provider ${provider} trop lent`,
          titre: `Serie ${tmdbId}`,
          saison: season,
          episode,
          provider,
        } as SeriesSourceData);
      }, AUTO_PROVIDER_TIMEOUT_MS);
    }),
  ]);
}

async function getAutoSeriesSource(tmdbId: string, season: number, episode: number): Promise<SeriesSourceData> {
  const errors: string[] = [];
  for (const provider of ['orion', 'tmdbembed'] as const) {
    try {
      debugLog(`[SERIES] provider auto -> ${provider} pour ${tmdbId} S${season}E${episode}`);
      const data = await withProviderTimeout(
        provider,
        tmdbId,
        season,
        episode,
        getSeriesSourceByProvider(tmdbId, season, episode, provider)
      );
      const hasSource = data.ok && data.hosters?.some((hoster: any) => (
        hoster?.proxyM3U8 || hoster?.m3u8 || hoster?.directUrl || hoster?.embedUrl
      ));
      if (hasSource) {
        (data as any).provider = provider;
        return data;
      }
      errors.push(`${provider}: ${(data as any).erreur || 'aucune source'}`);
    } catch (error: any) {
      errors.push(`${provider}: ${error?.message || 'erreur inconnue'}`);
    }
  }

  try {
    const fallback = await withProviderTimeout(
      'tmdbembed',
      tmdbId,
      season,
      episode,
      getSeriesSourceByProvider(tmdbId, season, episode, 'tmdbembed', { allowNonFrench: true })
    );
    const hasFallbackSource = fallback.ok && fallback.hosters?.some((hoster: any) => (
      hoster?.proxyM3U8 || hoster?.m3u8 || hoster?.directUrl || hoster?.embedUrl
    ));
    if (hasFallbackSource) {
      (fallback as any).provider = 'tmdbembed';
      (fallback as any).requiresLanguageConfirmation = true;
      (fallback as any).languageWarning = (fallback as any).languageWarning
        || 'Aucune version francaise detectee. Cette source peut etre en VO ou dans une autre langue.';
      return fallback;
    }
    errors.push(`tmdbembed-nonfr: ${(fallback as any).erreur || 'aucune source'}`);
  } catch (error: any) {
    errors.push(`tmdbembed-nonfr: ${error?.message || 'erreur inconnue'}`);
  }

  return {
    ok: false,
    erreur: `Aucune source VF trouvee (${errors.join(' ; ')})`,
    titre: `Serie ${tmdbId}`,
    saison: season,
    episode,
    provider: 'auto',
  } as SeriesSourceData;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      tmdbId: string;
      season: string;
      episode: string;
    }>;
  }
) {
  try {
    const { tmdbId, season, episode } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const provider = (searchParams.get('provider') || 'auto') as SeriesProvider;
    const allowNonFrench = searchParams.get('allowNonFrench') === '1'
      || searchParams.get('allowNonFrench') === 'true';
    const seasonNumber = parseInt(season);
    const episodeNumber = parseInt(episode);
    const cacheKey = `series_${tmdbId}_s${season}_e${episode}_${provider}${allowNonFrench ? '_nonfr' : ''}`;

    // Vérifier le cache
    try {
      const cached = await db
        .select()
        .from(streamCache)
        .where(
          and(
            eq(streamCache.id, cacheKey),
            eq(streamCache.type, 'series'),
            gt(streamCache.expiresAt, new Date())
          )
        )
        .limit(1);

      if (cached.length > 0) {
        debugLog(`✅ Cache hit pour ${tmdbId} S${season}E${episode}`);
        return corsJson(cached[0].data);
      }
    } catch (dbError) {
      debugLog('Cache DB error (ignoré):', dbError);
    }

    // Scraper les sources
    const data = provider === 'auto'
      ? await getAutoSeriesSource(tmdbId, seasonNumber, episodeNumber)
      : await getSeriesSourceByProvider(tmdbId, seasonNumber, episodeNumber, provider, { allowNonFrench });

    // Sauvegarder en cache si succès
    if (data.ok && data.hosters?.some((hoster: any) => (
      hoster?.proxyM3U8 || hoster?.m3u8 || hoster?.directUrl || hoster?.embedUrl
    ))) {
      try {
        const expiresAt = new Date(Date.now() + CACHE_TTL);
        await db
          .insert(streamCache)
          .values({
            id: cacheKey,
            type: 'series',
            tmdbId,
            data: data as any,
            expiresAt,
          })
          .onConflictDoUpdate({
            target: streamCache.id,
            set: {
              data: data as any,
              expiresAt,
              createdAt: new Date(),
            },
          });
      } catch (dbError) {
        debugLog('Cache save error (ignoré):', dbError);
      }
    }

    return corsJson(data);
  } catch (e: any) {
    return corsJson({ ok: false, erreur: e.message }, { status: 500 });
  }
}
