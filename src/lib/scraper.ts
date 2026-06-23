import { getBrowser, preparePage, attachCollector, chooseBestM3U8, wait } from './puppeteer';
import { getTmdbInfo } from './tmdb';
import { CONFIG } from './config';


const DEBUG_SCRAPER_LOGS = process.env.DEBUG_SCRAPER_LOGS === 'true';
function debugLog(...args: unknown[]) {
  if (DEBUG_SCRAPER_LOGS) console.log(...args);
}
function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface SearchResult {
  url: string;
  titre: string;
}

export async function searchFrenchStreamWithPuppeteer(query: string): Promise<SearchResult[]> {
  const domain = CONFIG.FRENCH_STREAM_MAIN;
  const b = await getBrowser();
  const page = await b.newPage();
  const allowedHosts = [...CONFIG.FRENCH_STREAM_DOMAINS];
  await preparePage(page, allowedHosts, { blockAssets: false });

  try {
    // Aller sur la page d'accueil
    await page.goto(`https://${domain}/`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    await wait(2000);

    // Chercher le champ de recherche et entrer la requête
    const searchInput = await page.$('input#story, input[name="story"], input[placeholder*="Recherche"]');
    if (!searchInput) {
      debugLog('  ⚠️ Champ de recherche non trouvé');
      await page.close();
      return [];
    }

    // Taper dans le champ de recherche
    await searchInput.type(query);
    await wait(1500); // Attendre que l'AJAX se déclenche

    // Récupérer les résultats de l'autocomplete
    const results = await page.evaluate(() => {
      const items: Array<{ url: string; titre: string }> = [];
      
      // Chercher dans les résultats de recherche
      const searchResults = document.querySelectorAll('.search-results .result-item, .autocomplete-item, [onclick*="location.href"]');
      
      searchResults.forEach((item: any) => {
        let url = '';
        let titre = '';

        // Extraire l'URL
        const onclick = item.getAttribute('onclick') || '';
        const urlMatch = onclick.match(/location\.href='([^']+)'/);
        if (urlMatch) {
          url = urlMatch[1];
        } else if (item.href) {
          url = item.href;
        }

        // Extraire le titre
        const titleEl = item.querySelector('.search-title, .title, h3, strong');
        if (titleEl) {
          titre = titleEl.textContent || '';
        } else {
          titre = item.textContent || '';
        }

        if (url && titre) {
          items.push({ url, titre: titre.trim() });
        }
      });

      return items;
    });

    await page.close();
    
    // Normaliser les URLs
    return results.map(r => ({
      url: r.url.startsWith('http') ? r.url : `https://${domain}${r.url}`,
      titre: r.titre,
    }));
  } catch (e: any) {
    debugLog('  ❌ Erreur recherche:', e.message);
    try { await page.close(); } catch {}
    return [];
  }
}

// Garde l'ancienne fonction comme fallback
export async function searchFrenchStream(query: string): Promise<SearchResult[]> {
  // Essayer d'abord avec Puppeteer (contourne Cloudflare)
  const puppeteerResults = await searchFrenchStreamWithPuppeteer(query);
  if (puppeteerResults.length > 0) {
    return puppeteerResults;
  }

  // Fallback sur l'ancienne méthode (probablement bloquée par Cloudflare)
  debugLog('  ℹ️ Tentative recherche AJAX directe...');
  const domain = CONFIG.FRENCH_STREAM_MAIN;
  
  try {
    const r = await fetch(`https://${domain}/engine/ajax/search.php`, {
      method: 'POST',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
        Referer: `https://${domain}/`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Origin: `https://${domain}`,
      },
      body: 'query=' + encodeURIComponent(query),
    });

    const html = await r.text();
    if (!html || html.length < 10 || html.includes('Verification')) {
      debugLog('  ⚠️ Recherche AJAX bloquée par Cloudflare');
      return [];
    }

    const res: SearchResult[] = [];
    const re = /onclick="location\.href='([^']+)'[\s\S]*?<div class='search-title'>([^<]+)<\/div>/g;
    let m;

    while ((m = re.exec(html)) !== null) {
      const p = m[1];
      res.push({
        url: p.startsWith('http') ? p : `https://${CONFIG.FRENCH_STREAM_MAIN}${p}`,
        titre: m[2],
      });
    }

    return res;
  } catch (e) {
    debugLog('  ❌ Recherche AJAX échouée');
    return [];
  }
}

function meilleurMatch(resultats: SearchResult[], titre: string, annee: string): SearchResult | null {
  if (!resultats || !resultats.length) return null;

  const q = normalizeText(titre).replace(/[^a-z0-9 ]/g, '');
  const words = q.split(' ').filter((w) => w.length > 2);

  let match = resultats.find((r) => {
    const t = normalizeText(r.titre);
    return t.includes(annee) && words.every((w) => t.includes(w));
  });

  if (match) return match;

  match = resultats.find((r) => {
    const t = normalizeText(r.titre);
    return words.every((w) => t.includes(w));
  });

  return match || resultats[0];
}

async function scanDOMEmbeds(page: any, sourceUrl: string): Promise<string[]> {
  try {
    const urls = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('iframe[src], iframe[data-src]').forEach((el: any) => {
        if (el.src) out.push(el.src);
        if (el.dataset.src) out.push(el.dataset.src);
      });
      return out;
    });

    return (urls || []).filter((u: string) => /vidzy\.live\/embed-[a-z0-9]+\.html/i.test(u));
  } catch {
    return [];
  }
}

async function clickPlayButton(page: any): Promise<boolean> {
  try {
    const clicked = await page.evaluate((selector: string) => {
      // D'après l'analyse, le bouton a la classe 'play-button'
      const playButton = document.querySelector(selector);
      if (playButton) {
        (playButton as HTMLElement).scrollIntoView({ block: 'center' });
        (playButton as HTMLElement).click();
        return true;
      }

      // Fallback sur d'autres sélecteurs
      const keywords = ['lecture', 'play', 'lire', 'regarder'];
      const buttons = Array.from(
        document.querySelectorAll("button, a, div[class*='play'], div[class*='watch']")
      );

      for (const btn of buttons) {
        const text = ((btn as any).innerText || (btn as any).textContent || '').toLowerCase();
        const classes = ((btn as any).className || '').toLowerCase();

        if (keywords.some((k) => text.includes(k) || classes.includes(k))) {
          (btn as HTMLElement).scrollIntoView({ block: 'center' });
          (btn as HTMLElement).click();
          return true;
        }
      }
      return false;
    }, CONFIG.SELECTORS.PLAY_BUTTON);

    if (clicked) {
      debugLog('  ✅ Bouton PLAY cliqué');
      return true;
    }

    debugLog('  ⚠️ Bouton PLAY non trouvé');
    return false;
  } catch {
    return false;
  }
}

async function scrapeMovie(filmUrl: string): Promise<{ embedUrl: string | null; m3u8: string | null }> {
  const t0 = Date.now();
  const b = await getBrowser();
  const page = await b.newPage();
  const allowedHosts = [...CONFIG.FRENCH_STREAM_DOMAINS, 'vidzy.live', 'vidzy.cc'];
  await preparePage(page, allowedHosts, { blockAssets: true });
  const collector = attachCollector(page);

  try {
    debugLog('  Navigation vers:', filmUrl);
    await page.goto(filmUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.TIMEOUTS.PAGE_LOAD }).catch(() => {});
    await wait(CONFIG.TIMEOUTS.WAIT_AFTER_LOAD);

    // Clic sur le bouton PLAY
    await clickPlayButton(page);
    await wait(CONFIG.TIMEOUTS.WAIT_AFTER_CLICK);

    // Récupérer l'embed
    let domEmbeds = await scanDOMEmbeds(page, filmUrl);
    let embedUrl = domEmbeds[0] || [...collector.embeds][0] || null;

    debugLog('  Embed:', embedUrl || '❌');

    let m3u8 = chooseBestM3U8([...collector.m3u8s]);

    // Si pas de M3U8, attendre mais pas trop (max 5s)
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

      // Si toujours pas de M3U8 après 5s, on retourne quand même l'embed
      if (!m3u8) {
        debugLog('  ⚠️ M3U8 non trouvé après timeout, utilise embedUrl comme fallback');
      }
    }

    try {
      await page.close();
    } catch {}
    debugLog(`  Page fermée (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

    return { embedUrl, m3u8 };
  } catch (e: any) {
    debugLog('  Erreur:', e.message.slice(0, 80));
    try {
      await page.close();
    } catch {}
    return { embedUrl: null, m3u8: null };
  }
}

export interface MovieSource {
  ok: boolean;
  erreur?: string;
  titre: string;
  annee?: string;
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

export async function getMovieSources(tmdbId: string): Promise<MovieSource> {
  const t0 = Date.now();
  const info = await getTmdbInfo(tmdbId);
  debugLog(`\n[MOVIE] ${info.titre_fr} (${info.annee})`);

  let resultats = await searchFrenchStream(info.titre_fr);
  if (!resultats.length && info.titre_original !== info.titre_fr) {
    resultats = await searchFrenchStream(info.titre_original);
  }

  const film = meilleurMatch(resultats, info.titre_fr, info.annee);
  if (!film) {
    return { ok: false, erreur: 'Film non trouvé', titre: info.titre_fr };
  }

  debugLog('  Film:', film.url);

  const { embedUrl, m3u8 } = await scrapeMovie(film.url);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  debugLog(`  RÉSULTAT: embed=${embedUrl ? '✅' : '❌'} m3u8=${m3u8 ? '✅' : '❌'} (${dt}s)`);

  if (!embedUrl && !m3u8) {
    return { ok: false, erreur: 'Rien trouvé', titre: info.titre_fr };
  }

  const refEnc = encodeURIComponent(embedUrl || 'https://vidzy.live/');
  const proxyM3U8 = m3u8 ? `/api/proxy/m3u8?url=${encodeURIComponent(m3u8)}&referer=${refEnc}` : null;

  return {
    ok: true,
    titre: info.titre_fr,
    annee: info.annee,
    hosters: [
      {
        nom: 'Vidzy',
        lang: 'TrueFrench',
        embedUrl: embedUrl || null,
        m3u8: m3u8 || null,
        proxyM3U8: proxyM3U8 || null,
        proxyTS: `/api/proxy/ts?url={SEGMENT_URL}&referer=${refEnc}`,
        source: 'french-stream',
      },
    ],
  };
}
