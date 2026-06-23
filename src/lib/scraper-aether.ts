import { getBrowser, preparePage, attachCollector, chooseBestM3U8, wait } from './puppeteer';
import { CONFIG } from './config';


const DEBUG_SCRAPER_LOGS = process.env.DEBUG_SCRAPER_LOGS === 'true';
function debugLog(...args: unknown[]) {
  if (DEBUG_SCRAPER_LOGS) console.log(...args);
}
const YABLOM_BASE = 'https://yablom.com/euvcw7/home/yablom';

interface TmdbMovieInfo {
  titre_fr: string;
  titre_original: string;
  annee: string;
}

async function getTmdbMovieInfo(tmdbId: string): Promise<TmdbMovieInfo> {
  try {
    const r = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
    );

    if (!r.ok) {
      return { titre_fr: `Film ${tmdbId}`, titre_original: '', annee: '' };
    }

    const d = await r.json();

    if (d.status_code) {
      return { titre_fr: `Film ${tmdbId}`, titre_original: '', annee: '' };
    }

    return {
      titre_fr: d.title || d.name || `Film ${tmdbId}`,
      titre_original: d.original_title || d.original_name || '',
      annee: (d.release_date || '').slice(0, 4) || '',
    };
  } catch {
    return { titre_fr: `Film ${tmdbId}`, titre_original: '', annee: '' };
  }
}

async function searchYablom(query: string) {
  const b = await getBrowser();
  const page = await b.newPage();
  await preparePage(page, ['yablom.com'], { blockAssets: true });

  try {
    debugLog(`  Recherche AETHER: ${query}`);
    
    await page.goto(YABLOM_BASE, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD,
    });
    await wait(CONFIG.TIMEOUTS.WAIT_AFTER_LOAD);

    // Chercher le champ de recherche
    const searchInput = await page.$('input[type="text"], input[name="search"], input[placeholder*="recherche"]');
    if (!searchInput) {
      debugLog('  ⚠️ Champ de recherche non trouvé sur Yablom');
      await page.close();
      return [];
    }

    await searchInput.type(query);
    await wait(1500);

    // Récupérer les résultats
    const results = await page.evaluate(() => {
      const items: Array<{ url: string; titre: string }> = [];
      
      // Chercher les résultats de recherche (à adapter selon la structure du site)
      const searchResults = document.querySelectorAll(
        'a[href*="movie"], a[href*="film"], .movie-item, .film-item, .search-result'
      );

      searchResults.forEach((item: any) => {
        let url = '';
        let titre = '';

        if (item.href) {
          url = item.href;
        }

        const titleEl = item.querySelector('h3, .title, .movie-title');
        if (titleEl) {
          titre = titleEl.textContent?.trim() || '';
        } else {
          titre = item.textContent?.trim() || '';
        }

        if (url && titre) {
          items.push({ url, titre });
        }
      });

      return items;
    });

    await page.close();
    return results;
  } catch (e: any) {
    debugLog('  ❌ Erreur recherche Yablom:', e.message);
    try {
      await page.close();
    } catch {}
    return [];
  }
}

async function scrapeYablomMovie(movieUrl: string) {
  const b = await getBrowser();
  const page = await b.newPage();
  await preparePage(page, ['yablom.com'], { blockAssets: true });
  const collector = attachCollector(page);

  try {
    debugLog(`  Scraping AETHER: ${movieUrl}`);
    
    await page.goto(movieUrl, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD,
    });
    await wait(CONFIG.TIMEOUTS.WAIT_AFTER_LOAD);

    // Chercher le bouton play ou le player
    await page.evaluate(() => {
      const playButtons = document.querySelectorAll(
        'button[class*="play"], .play-button, .watch-button, [class*="watch"]'
      );
      playButtons.forEach((btn) => {
        (btn as HTMLElement).click();
      });
    });

    await wait(CONFIG.TIMEOUTS.WAIT_AFTER_CLICK);

    // Récupérer l'embed
    const embedUrl = await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll('iframe'));
      const videoFrame = frames.find((f: any) => {
        const src = f.src || '';
        return src.includes('embed') || src.includes('player') || src.includes('stream');
      });
      return videoFrame ? (videoFrame as any).src : null;
    });

    debugLog(`  Embed trouvé: ${embedUrl || '❌'}`);

    let m3u8 = chooseBestM3U8([...collector.m3u8s]);

    // Attendre M3U8 mais pas trop longtemps
    if (!m3u8 && embedUrl) {
      const maxWait = CONFIG.TIMEOUTS.M3U8_MAX_WAIT;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        await wait(CONFIG.TIMEOUTS.WAIT_FOR_M3U8);
        m3u8 = chooseBestM3U8([...collector.m3u8s]);
        if (m3u8) {
          debugLog('  ✅ M3U8 capté !');
          break;
        }
      }

      if (!m3u8) {
        debugLog('  ⚠️ M3U8 non trouvé, utilise embedUrl');
      }
    }

    await page.close();

    return { embedUrl, m3u8 };
  } catch (e: any) {
    debugLog('  ❌ Erreur scraping:', e.message);
    try {
      await page.close();
    } catch {}
    return { embedUrl: null, m3u8: null };
  }
}

export interface AetherMovieSource {
  ok: boolean;
  erreur?: string;
  titre: string;
  annee?: string;
  provider: 'aether';
  hosters?: Array<{
    nom: string;
    lang: string;
    embedUrl: string | null;
    m3u8: string | null;
    proxyM3U8: string | null;
    proxyTS: string | null;
    source: string;
  }>;
}

export async function getAetherMovieSource(tmdbId: string): Promise<AetherMovieSource> {
  const t0 = Date.now();
  const info = await getTmdbMovieInfo(tmdbId);
  debugLog(`\n[AETHER] ${info.titre_fr} (${info.annee})`);

  // Chercher d'abord avec le titre français
  let resultats = await searchYablom(info.titre_fr);
  
  // Si pas de résultat, essayer avec le titre original
  if (!resultats.length && info.titre_original !== info.titre_fr) {
    resultats = await searchYablom(info.titre_original);
  }

  if (!resultats.length) {
    return {
      ok: false,
      erreur: 'Film non trouvé sur Yablom',
      titre: info.titre_fr,
      provider: 'aether',
    };
  }

  const film = resultats[0]; // Prendre le premier résultat
  debugLog(`  Film: ${film.url}`);

  const { embedUrl, m3u8 } = await scrapeYablomMovie(film.url);

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  debugLog(`  AETHER RÉSULTAT: embed=${embedUrl ? '✅' : '❌'} m3u8=${m3u8 ? '✅' : '❌'} (${dt}s)`);

  if (!embedUrl && !m3u8) {
    return {
      ok: false,
      erreur: 'Aucune source trouvée',
      titre: info.titre_fr,
      provider: 'aether',
    };
  }

  const refEnc = encodeURIComponent(embedUrl || 'https://yablom.com/');
  const proxyM3U8 = m3u8 ? `/api/proxy/m3u8?url=${encodeURIComponent(m3u8)}&referer=${refEnc}` : null;

  return {
    ok: true,
    titre: info.titre_fr,
    annee: info.annee,
    provider: 'aether',
    hosters: [
      {
        nom: 'Yablom',
        lang: 'Multi',
        embedUrl: embedUrl || null,
        m3u8: m3u8 || null,
        proxyM3U8: proxyM3U8 || null,
        proxyTS: `/api/proxy/ts?url={SEGMENT_URL}&referer=${refEnc}`,
        source: 'yablom',
      },
    ],
  };
}
