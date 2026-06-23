import { getBrowser, preparePage, attachCollector, chooseBestM3U8, wait } from './puppeteer';
import { CONFIG } from './config';


const DEBUG_SCRAPER_LOGS = process.env.DEBUG_SCRAPER_LOGS === 'true';
function debugLog(...args: unknown[]) {
  if (DEBUG_SCRAPER_LOGS) console.log(...args);
}
interface TmdbSeriesInfo {
  titre_fr: string;
  titre_original: string;
  annee: string;
}

export async function getTmdbSeriesInfo(tmdbId: string): Promise<TmdbSeriesInfo> {
  try {
    const r = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
    );

    if (!r.ok) {
      return { titre_fr: `Série ${tmdbId}`, titre_original: '', annee: '' };
    }

    const d = await r.json();

    if (d.status_code) {
      return { titre_fr: `Série ${tmdbId}`, titre_original: '', annee: '' };
    }

    return {
      titre_fr: d.name || `Série ${tmdbId}`,
      titre_original: d.original_name || '',
      annee: (d.first_air_date || '').slice(0, 4) || '',
    };
  } catch {
    return { titre_fr: `Série ${tmdbId}`, titre_original: '', annee: '' };
  }
}

async function searchFrenchStreamSeries(query: string, saison: number) {
  const domain = CONFIG.FRENCH_STREAM_MAIN;
  const b = await getBrowser();
  const page = await b.newPage();
  const allowedHosts = [...CONFIG.FRENCH_STREAM_DOMAINS];
  await preparePage(page, allowedHosts, { blockAssets: true });

  try {
    await page.goto(`https://${domain}/`, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD,
    });
    await wait(CONFIG.TIMEOUTS.WAIT_AFTER_LOAD);

    const searchInput = await page.$('input#story, input[name="story"]');
    if (!searchInput) {
      await page.close();
      return [];
    }

    await searchInput.type(`${query} Saison ${saison}`);
    await wait(1500);

    const results = await page.evaluate((saisonTxt: string) => {
      const items: Array<{ url: string; titre: string }> = [];
      const searchResults = document.querySelectorAll('[onclick*="location.href"]');

      searchResults.forEach((item: any) => {
        const onclick = item.getAttribute('onclick') || '';
        const urlMatch = onclick.match(/location\.href='([^']+)'/);
        if (!urlMatch) return;

        const url = urlMatch[1];
        const titleEl = item.querySelector('.search-title, .title');
        const titre = titleEl ? titleEl.textContent?.trim() || '' : '';

        // Filtrer pour ne garder que les séries avec la bonne saison
        const titreLower = titre.toLowerCase();
        if (titreLower.includes(saisonTxt.toLowerCase()) || titreLower.includes('saison')) {
          items.push({ url, titre });
        }
      });

      return items;
    }, `saison ${saison}`);

    await page.close();

    return results.map((r) => ({
      url: r.url.startsWith('http') ? r.url : `https://${domain}${r.url}`,
      titre: r.titre,
    }));
  } catch {
    try {
      await page.close();
    } catch {}
    return [];
  }
}

async function clickEpisode(page: any, episodeNum: number, side: 'left' | 'right' = 'left') {
  try {
    const clicked = await page.evaluate(
      (n: number, s: string) => {
        const isLeft = s === 'left';
        const middle = window.innerWidth / 2;
        const all = Array.from(document.querySelectorAll('a, span, li, div, button'));

        const target = all.find((el: any) => {
          const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
          const rect = el.getBoundingClientRect();

          if (rect.width < 5 || rect.width > 300) return false;
          if (rect.height < 10) return false;
          if (isLeft && rect.left > middle) return false;
          if (!isLeft && rect.left < middle - 50) return false;

          return (
            txt === `episode ${n}` ||
            txt === `episode 0${n}` ||
            txt === `ep ${n}` ||
            txt === `épisode ${n}` ||
            (txt === n.toString() && el.className && el.className.includes('ep'))
          );
        });

        if (target) {
          (target as HTMLElement).scrollIntoView({ block: 'center' });
          (target as HTMLElement).click();
          return true;
        }
        return false;
      },
      episodeNum,
      side
    );

    return clicked;
  } catch {
    return false;
  }
}

async function getIframeEmbed(page: any): Promise<string | null> {
  try {
    return await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll('iframe'));
      const vidzyFrame = frames.find((f: any) => f.src && f.src.includes('vidzy'));
      return vidzyFrame ? (vidzyFrame as any).src : null;
    });
  } catch {
    return null;
  }
}

function getVidzyId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/embed-([a-z0-9]+)\.html/i);
  return m ? m[1] : null;
}

async function scrapeSeriesEpisode(
  seriesUrl: string,
  episode: number,
  side: 'left' | 'right' = 'left'
): Promise<{ embedUrl: string | null; m3u8: string | null; lang: string }> {
  const b = await getBrowser();
  const page = await b.newPage();
  const allowedHosts = [...CONFIG.FRENCH_STREAM_DOMAINS, 'vidzy.live', 'vidzy.cc'];
  await preparePage(page, allowedHosts, { blockAssets: true });
  const collector = attachCollector(page);

  try {
    debugLog('  Navigation vers série...');
    await page.goto(seriesUrl, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD,
    });
    await wait(CONFIG.TIMEOUTS.WAIT_AFTER_LOAD);

    // Récupérer l'embed actuel
    const oldEmbed = await getIframeEmbed(page);
    const oldId = getVidzyId(oldEmbed);
    debugLog(`  Embed actuel: ${oldId || 'aucun'}`);

    // Si épisode 1 et déjà chargé, pas besoin de cliquer
    if (episode !== 1 || !oldEmbed) {
      debugLog(`  Clic sur épisode ${episode}...`);
      const clicked = await clickEpisode(page, episode, side);

      if (clicked) {
        // Attendre que l'iframe change
        let newEmbed = null;
        const startTime = Date.now();

        while (Date.now() - startTime < 8000) {
          await wait(500);
          newEmbed = await getIframeEmbed(page);
          const newId = getVidzyId(newEmbed);
          if (newEmbed && newId !== oldId) {
            debugLog(`  ✅ Embed changé: ${newId}`);
            break;
          }
        }
      }
    }

    const finalEmbed = await getIframeEmbed(page);
    debugLog(`  Embed final: ${finalEmbed || '❌'}`);

    let m3u8 = chooseBestM3U8([...collector.m3u8s]);

    // Attendre M3U8 mais pas trop longtemps
    if (!m3u8 && finalEmbed) {
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

      // Si toujours pas de M3U8, on retourne quand même l'embed
      if (!m3u8) {
        debugLog('  ⚠️ M3U8 non trouvé, utilise embedUrl comme fallback');
      }
    }

    await page.close();

    return {
      embedUrl: finalEmbed,
      m3u8: m3u8 || null,
      lang: side === 'left' ? 'VF' : 'VOSTFR',
    };
  } catch (e: any) {
    debugLog('  Erreur scraping série:', e.message);
    try {
      await page.close();
    } catch {}
    return { embedUrl: null, m3u8: null, lang: side === 'left' ? 'VF' : 'VOSTFR' };
  }
}

export interface SeriesSource {
  ok: boolean;
  erreur?: string;
  titre: string;
  annee?: string;
  saison?: number;
  episode?: number;
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

export async function getSeriesSource(
  tmdbId: string,
  season: number,
  episode: number
): Promise<SeriesSource> {
  const t0 = Date.now();
  const info = await getTmdbSeriesInfo(tmdbId);
  debugLog(`\n[SERIES] ${info.titre_fr} S${season}E${episode}`);

  let resultats = await searchFrenchStreamSeries(info.titre_fr, season);
  if (!resultats.length && info.titre_original !== info.titre_fr) {
    resultats = await searchFrenchStreamSeries(info.titre_original, season);
  }

  if (!resultats.length) {
    return {
      ok: false,
      erreur: 'Série non trouvée',
      titre: info.titre_fr,
      saison: season,
      episode: episode,
    };
  }

  const serie = resultats[0];
  debugLog('  Série:', serie.url);

  // Essayer VF d'abord
  let res = await scrapeSeriesEpisode(serie.url, episode, 'left');

  // Si échec, essayer VOSTFR
  if (!res.embedUrl && !res.m3u8) {
    debugLog('  VF échoué, tentative VOSTFR...');
    res = await scrapeSeriesEpisode(serie.url, episode, 'right');
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  debugLog(`  RÉSULTAT: embed=${res.embedUrl ? '✅' : '❌'} m3u8=${res.m3u8 ? '✅' : '❌'} (${dt}s)`);

  if (!res.embedUrl && !res.m3u8) {
    return {
      ok: false,
      erreur: 'Épisode non trouvé',
      titre: info.titre_fr,
      saison: season,
      episode: episode,
    };
  }

  const refEnc = encodeURIComponent(res.embedUrl || 'https://vidzy.live/');
  const proxyM3U8 = res.m3u8
    ? `/api/proxy/m3u8?url=${encodeURIComponent(res.m3u8)}&referer=${refEnc}`
    : null;

  return {
    ok: true,
    titre: info.titre_fr,
    annee: info.annee,
    saison: season,
    episode: episode,
    hosters: [
      {
        nom: 'Vidzy',
        lang: res.lang,
        embedUrl: res.embedUrl || null,
        m3u8: res.m3u8 || null,
        proxyM3U8: proxyM3U8 || null,
        proxyTS: `/api/proxy/ts?url={SEGMENT_URL}&referer=${refEnc}`,
        source: 'french-stream',
      },
    ],
  };
}
