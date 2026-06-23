# 📺 Guide d'ajout du support des séries (ORION SÉRIE)

Ce document explique comment étendre l'API pour supporter les séries TV.

## Différences entre films et séries

| Aspect | Films | Séries |
|--------|-------|--------|
| **Route** | `/api/sources/movie/:tmdbId` | `/api/sources/series/:tmdbId/:season/:episode` |
| **Page French-Stream** | Page unique | Page de la série → Sélection saison/épisode |
| **Sélecteurs** | `.play-button` | Sélecteurs dynamiques pour saison/épisode |
| **Cache** | Par TMDB ID | Par TMDB ID + saison + épisode |

## 1. Mise à jour du schéma de cache

Aucune modification nécessaire, le schéma actuel supporte déjà les séries grâce au champ `type`.

## 2. Créer l'API route pour les séries

```typescript
// src/app/api/sources/series/[tmdbId]/[season]/[episode]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSeriesSource } from '@/lib/scraper-series';
import { db } from '@/db';
import { streamCache } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { CONFIG } from '@/lib/config';

const CACHE_TTL = CONFIG.CACHE_TTL_MS;

export async function GET(
  request: NextRequest,
  context: { 
    params: Promise<{ 
      tmdbId: string; 
      season: string; 
      episode: string 
    }> 
  }
) {
  try {
    const { tmdbId, season, episode } = await context.params;
    const cacheKey = `series_${tmdbId}_s${season}_e${episode}`;

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
        console.log(`✅ Cache hit pour ${tmdbId} S${season}E${episode}`);
        return NextResponse.json(cached[0].data);
      }
    } catch (dbError) {
      console.log('Cache DB error (ignoré):', dbError);
    }

    // Scraper les sources
    const data = await getSeriesSource(tmdbId, parseInt(season), parseInt(episode));

    // Sauvegarder en cache si succès
    if (data.ok && data.hosters && data.hosters[0]?.proxyM3U8) {
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
        console.log('Cache save error (ignoré):', dbError);
      }
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, erreur: e.message }, { status: 500 });
  }
}
```

## 3. Créer le scraper pour séries

```typescript
// src/lib/scraper-series.ts
import { getBrowser, preparePage, attachCollector, chooseBestM3U8, wait } from './puppeteer';
import { CONFIG } from './config';

// Obtenir les infos TMDB pour une série
export async function getTmdbSeriesInfo(tmdbId: string) {
  try {
    const r = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${CONFIG.TMDB_API_KEY}&language=fr-FR`
    );
    
    if (!r.ok) return { titre_fr: `Série ${tmdbId}`, titre_original: '', annee: '' };

    const d = await r.json();
    return {
      titre_fr: d.name || `Série ${tmdbId}`,
      titre_original: d.original_name || '',
      annee: (d.first_air_date || '').slice(0, 4) || '',
    };
  } catch {
    return { titre_fr: `Série ${tmdbId}`, titre_original: '', annee: '' };
  }
}

// Chercher la série sur French-Stream
export async function searchFrenchStreamSeries(query: string) {
  const domain = CONFIG.FRENCH_STREAM_MAIN;
  const r = await fetch(`https://${domain}/engine/ajax/search.php`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
      Referer: `https://${domain}/`,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: `https://${domain}`,
    },
    body: 'query=' + encodeURIComponent(query),
  });

  const html = await r.text();
  const res = [];
  const re = /onclick="location\.href='([^']+)'[\s\S]*?<div class='search-title'>([^<]+)<\/div>/g;
  let m;

  while ((m = re.exec(html)) !== null) {
    const p = m[1];
    // Filtrer uniquement les séries (URL contient généralement '-serie-' ou '-saison-')
    if (p.includes('-serie-') || p.includes('-saison-')) {
      res.push({
        url: p.startsWith('http') ? p : `https://${domain}${p}`,
        titre: m[2],
      });
    }
  }

  return res;
}

// Scraper un épisode spécifique
async function scrapeSeries(
  seriesUrl: string, 
  season: number, 
  episode: number
): Promise<{ embedUrl: string | null; m3u8: string | null }> {
  const b = await getBrowser();
  const page = await b.newPage();
  const allowedHosts = [...CONFIG.FRENCH_STREAM_DOMAINS, 'vidzy.live', 'vidzy.cc'];
  await preparePage(page, allowedHosts, { blockAssets: true });
  const collector = attachCollector(page);

  try {
    // Aller sur la page de la série
    await page.goto(seriesUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.TIMEOUTS.PAGE_LOAD });
    await wait(2000);

    // ÉTAPE IMPORTANTE : Sélectionner la saison et l'épisode
    // Les sélecteurs dépendent du site, voici un exemple générique
    await page.evaluate((s, e) => {
      // Chercher le sélecteur de saison
      const seasonSelect = document.querySelector('select[name="season"], #season-select, .season-selector');
      if (seasonSelect) {
        (seasonSelect as HTMLSelectElement).value = s.toString();
        seasonSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, season, episode);

    await wait(1000);

    await page.evaluate((e) => {
      // Chercher le bouton/lien de l'épisode
      // Peut être un bouton avec "Episode X" ou un lien dans une liste
      const episodeButtons = Array.from(
        document.querySelectorAll('button, a, .episode-item')
      );
      
      const episodeBtn = episodeButtons.find(btn => {
        const text = (btn.textContent || '').toLowerCase();
        return text.includes(`episode ${e}`) || 
               text.includes(`épisode ${e}`) ||
               text.includes(`ep ${e}`) ||
               text.includes(`e${e}`);
      });

      if (episodeBtn) {
        (episodeBtn as HTMLElement).click();
      }
    }, episode);

    await wait(CONFIG.TIMEOUTS.WAIT_AFTER_CLICK);

    // Cliquer sur Play
    await page.evaluate(() => {
      const playButton = document.querySelector('.play-button');
      if (playButton) {
        (playButton as HTMLElement).click();
      }
    });

    await wait(CONFIG.TIMEOUTS.WAIT_AFTER_CLICK);

    // Récupérer l'embed
    const domEmbeds = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('iframe[src], iframe[data-src]').forEach((el: any) => {
        if (el.src) out.push(el.src);
        if (el.dataset.src) out.push(el.dataset.src);
      });
      return out;
    });

    const embedUrl = domEmbeds.find(u => /vidzy\.live\/embed/i.test(u)) || 
                    [...collector.embeds][0] || 
                    null;

    let m3u8 = chooseBestM3U8([...collector.m3u8s]);

    if (!m3u8) {
      for (let i = 0; i < CONFIG.TIMEOUTS.MAX_M3U8_ATTEMPTS; i++) {
        await wait(CONFIG.TIMEOUTS.WAIT_FOR_M3U8);
        m3u8 = chooseBestM3U8([...collector.m3u8s]);
        if (m3u8) break;
      }
    }

    await page.close();
    return { embedUrl, m3u8 };
  } catch (e: any) {
    console.log('Erreur scraping série:', e.message);
    try { await page.close(); } catch {}
    return { embedUrl: null, m3u8: null };
  }
}

// Fonction principale
export async function getSeriesSource(tmdbId: string, season: number, episode: number) {
  const info = await getTmdbSeriesInfo(tmdbId);
  console.log(`\n[SERIES] ${info.titre_fr} S${season}E${episode}`);

  let resultats = await searchFrenchStreamSeries(info.titre_fr);
  if (!resultats.length && info.titre_original !== info.titre_fr) {
    resultats = await searchFrenchStreamSeries(info.titre_original);
  }

  if (!resultats.length) {
    return { ok: false, erreur: 'Série non trouvée', titre: info.titre_fr };
  }

  const serie = resultats[0]; // Prendre le premier résultat
  console.log('  Série:', serie.url);

  const { embedUrl, m3u8 } = await scrapeSeries(serie.url, season, episode);

  if (!embedUrl && !m3u8) {
    return { ok: false, erreur: 'Épisode non trouvé', titre: info.titre_fr };
  }

  const refEnc = encodeURIComponent(embedUrl || 'https://vidzy.live/');
  const proxyM3U8 = m3u8 ? `/api/proxy/m3u8?url=${encodeURIComponent(m3u8)}&referer=${refEnc}` : null;

  return {
    ok: true,
    titre: info.titre_fr,
    saison: season,
    episode: episode,
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
```

## 4. Tester l'API série

```bash
# Breaking Bad - Saison 1, Épisode 1 (TMDB: 1396)
curl http://localhost:3000/api/sources/series/1396/1/1

# Résultat attendu
{
  "ok": true,
  "titre": "Breaking Bad",
  "saison": 1,
  "episode": 1,
  "hosters": [
    {
      "nom": "Vidzy",
      "lang": "TrueFrench",
      "embedUrl": "...",
      "m3u8": "...",
      "proxyM3U8": "/api/proxy/m3u8?url=...",
      "proxyTS": "/api/proxy/ts?url={SEGMENT_URL}&referer=...",
      "source": "french-stream"
    }
  ]
}
```

## 5. Adapter le front-end

```typescript
// hooks/useSeriesSource.ts
export function useSeriesSource(tmdbId: string, season: number, episode: number) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sources/series/${tmdbId}/${season}/${episode}`)
      .then(res => res.json())
      .then(json => {
        if (json.ok) setData(json);
        setLoading(false);
      });
  }, [tmdbId, season, episode]);

  return { data, loading };
}
```

## 6. Notes importantes

### Sélecteurs à adapter

Les sélecteurs pour saison/épisode dépendent de la structure HTML de French-Stream :

```typescript
// Exemples de sélecteurs possibles
const SEASON_SELECTORS = [
  'select[name="season"]',
  '#season-select',
  '.season-selector',
  '[data-season]',
];

const EPISODE_SELECTORS = [
  '.episode-item',
  '[data-episode]',
  '.ep-button',
  'a[href*="episode"]',
];
```

### Analyse manuelle recommandée

Avant d'implémenter, faites une analyse manuelle comme pour les films :

```bash
node analyse-series.js
```

Puis :
1. Chercher une série
2. Cliquer sur un résultat
3. Sélectionner une saison
4. Cliquer sur un épisode
5. Noter tous les sélecteurs et requêtes réseau

## 7. Prochaines étapes

- [ ] Analyser la structure HTML pour séries sur French-Stream
- [ ] Identifier les sélecteurs saison/épisode
- [ ] Créer `src/lib/scraper-series.ts`
- [ ] Créer la route API
- [ ] Tester avec différentes séries
- [ ] Ajouter au cache DB
- [ ] Documenter les spécificités

## Exemple complet d'intégration

Une fois implémenté, vous pourrez faire :

```typescript
// Récupérer tous les épisodes d'une saison
async function getAllEpisodes(tmdbId: string, season: number, episodeCount: number) {
  const promises = [];
  
  for (let ep = 1; ep <= episodeCount; ep++) {
    promises.push(
      fetch(`/api/sources/series/${tmdbId}/${season}/${ep}`)
        .then(r => r.json())
    );
  }
  
  return await Promise.all(promises);
}

// Breaking Bad Saison 1 (7 épisodes)
const s1 = await getAllEpisodes('1396', 1, 7);
```

Bonne chance pour l'implémentation ! 🎬📺
