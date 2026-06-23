import { NextRequest } from 'next/server';
import { getMovieSources } from '@/lib/scraper';
import { getAetherMovieSource } from '@/lib/scraper-aether';
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

type Provider = 'auto' | 'orion' | 'aether' | 'tmdbembed' | 'pulsar';
type MovieSourceData =
  | Awaited<ReturnType<typeof getMovieSources>>
  | Awaited<ReturnType<typeof getAetherMovieSource>>
  | Awaited<ReturnType<typeof getTmdbEmbedSource>>;

export function OPTIONS() {
  return corsOptions();
}

async function getMovieSourceByProvider(
  tmdbId: string,
  provider: Provider,
  options: { allowNonFrench?: boolean } = {}
): Promise<MovieSourceData> {
  if (provider === 'aether') {
    return getAetherMovieSource(tmdbId);
  }

  if (provider === 'tmdbembed') {
    return getTmdbEmbedSource(tmdbId, 'movie', undefined, undefined, {
      allowNonFrench: options.allowNonFrench,
    });
  }

  if (provider === 'pulsar') {
    return {
      ok: false,
      erreur: 'Provider PULSAR pas encore disponible',
      titre: `Film ${tmdbId}`,
      provider: 'pulsar',
    } as MovieSourceData;
  }

  const data = await getMovieSources(tmdbId);
  (data as any).provider = 'orion';
  return data;
}

function withProviderTimeout(
  provider: Provider,
  tmdbId: string,
  promise: Promise<MovieSourceData>
): Promise<MovieSourceData> {
  return Promise.race([
    promise,
    new Promise<MovieSourceData>((resolve) => {
      setTimeout(() => {
        resolve({
          ok: false,
          erreur: `Provider ${provider} trop lent`,
          titre: `Film ${tmdbId}`,
          provider,
        } as MovieSourceData);
      }, AUTO_PROVIDER_TIMEOUT_MS);
    }),
  ]);
}

async function getAutoMovieSource(tmdbId: string): Promise<MovieSourceData> {
  const errors: string[] = [];
  for (const provider of ['orion', 'aether', 'tmdbembed'] as const) {
    try {
      debugLog(`[MOVIE] provider auto -> ${provider} pour ${tmdbId}`);
      const data = await withProviderTimeout(
        provider,
        tmdbId,
        getMovieSourceByProvider(tmdbId, provider)
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

  return {
    ok: false,
    erreur: `Aucune source trouvée (${errors.join(' ; ')})`,
    titre: `Film ${tmdbId}`,
    provider: 'auto',
  } as MovieSourceData;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const { tmdbId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const provider = (searchParams.get('provider') || 'orion') as Provider;
    
    const allowNonFrench = searchParams.get('allowNonFrench') === '1'
      || searchParams.get('allowNonFrench') === 'true';
    const cacheKey = `movie_${tmdbId}_${provider}${allowNonFrench ? '_nonfr' : ''}`;

    // Vérifier le cache en base de données
    try {
      const cached = await db
        .select()
        .from(streamCache)
        .where(
          and(
            eq(streamCache.id, cacheKey),
            eq(streamCache.type, 'movie'),
            gt(streamCache.expiresAt, new Date())
          )
        )
        .limit(1);

      if (cached.length > 0) {
        debugLog(`✅ Cache hit pour ${tmdbId} (${provider})`);
        return corsJson(cached[0].data);
      }
    } catch (dbError) {
      debugLog('Cache DB error (ignoré):', dbError);
    }

    // Scraper selon le provider
    const data = provider === 'auto'
      ? await getAutoMovieSource(tmdbId)
      : await getMovieSourceByProvider(tmdbId, provider, { allowNonFrench });
    
    if (false) {
      // TODO: À implémenter
      return corsJson({
        ok: false,
        erreur: 'Provider PULSAR pas encore disponible',
        titre: `Film ${tmdbId}`,
        provider: 'pulsar',
      });
    } else if (false) {
      // Défaut: ORION
      void tmdbId;
      void data;
    }

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
            type: 'movie',
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
