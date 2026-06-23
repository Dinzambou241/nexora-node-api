# 🎬 SYSTÈME DE LECTEURS MULTIPLES

## ✅ CE QUI A ÉTÉ AJOUTÉ

### 🌟 3 Lecteurs disponibles

1. **ORION** (Bleu) - Films + Séries
   - Source : French-Stream
   - VF/VOSTFR
   - ✅ Opérationnel

2. **AETHER** (Violet/Rose) - Films uniquement
   - Source : Yablom
   - Multi-langue
   - ✅ Intégré (à tester)

3. **PULSAR** (Gris) - Films + Séries
   - À implémenter
   - ⏳ Bientôt

---

## 🎯 Comment ça marche

### Dans l'interface

```
┌─────────────────────────────────────┐
│ 🎬 Films    📺 Séries               │
├─────────────────────────────────────┤
│ Lecteur :                           │
│ [🌟 ORION] [🔮 AETHER] [⚡ PULSAR]  │
├─────────────────────────────────────┤
│ TMDB ID: 550                        │
│ [🚀 Tester]                         │
└─────────────────────────────────────┘
```

**Sélectionnez le lecteur AVANT de tester !**

### Dans l'API

```bash
# Film avec ORION (défaut)
GET /api/sources/movie/550?provider=orion

# Film avec AETHER
GET /api/sources/movie/550?provider=aether

# Film avec PULSAR (pas encore dispo)
GET /api/sources/movie/550?provider=pulsar
```

---

## 📡 Réponses API

### Structure commune

```json
{
  "ok": true,
  "titre": "Fight Club",
  "annee": "1999",
  "provider": "orion",  // ← Nouveau champ !
  "hosters": [{
    "nom": "Vidzy",
    "lang": "TrueFrench",
    "embedUrl": "...",
    "m3u8": "...",
    "proxyM3U8": "...",
    "source": "french-stream"
  }]
}
```

### ORION

```json
{
  "provider": "orion",
  "hosters": [{
    "nom": "Vidzy",
    "source": "french-stream"
  }]
}
```

### AETHER

```json
{
  "provider": "aether",
  "hosters": [{
    "nom": "Yablom",
    "source": "yablom"
  }]
}
```

---

## 🔧 Implémentation technique

### 1. Scraper AETHER

**Fichier** : `src/lib/scraper-aether.ts`

**Fonctions** :
- `getTmdbMovieInfo()` : Récupère infos TMDB
- `searchYablom()` : Cherche sur yablom.com
- `scrapeYablomMovie()` : Scrappe la page film
- `getAetherMovieSource()` : Fonction principale

**Flow** :
```
TMDB ID → Infos TMDB → Recherche Yablom → 
Scraping page → Embed/M3U8 → Proxy
```

### 2. Route API modifiée

**Fichier** : `src/app/api/sources/movie/[tmdbId]/route.ts`

**Changements** :
- Param `?provider=orion|aether|pulsar`
- Cache par provider : `movie_{tmdbId}_{provider}`
- Switch selon provider

```typescript
if (provider === 'aether') {
  data = await getAetherMovieSource(tmdbId);
} else if (provider === 'pulsar') {
  // TODO
} else {
  data = await getMovieSources(tmdbId);
}
```

### 3. Interface mise à jour

**Fichier** : `src/components/ContentTester.tsx`

**Nouveautés** :
- Boutons ORION / AETHER / PULSAR
- État `provider`
- Désactive séries pour AETHER
- URL avec `?provider=...`

---

## 🧪 TESTER MAINTENANT

### URL

https://3000-ip53m8fjfvqcy4a7eaf5c.e2b.app

### Test ORION (existant)

1. Cliquez **🎬 Films**
2. Sélectionnez **🌟 ORION**
3. Testez "Fight Club"
4. Résultat : French-Stream

### Test AETHER (nouveau)

1. Cliquez **🎬 Films**
2. Sélectionnez **🔮 AETHER**
3. Testez "Fight Club"
4. Résultat : Yablom

### Test séries

1. Cliquez **📺 Séries**
2. ORION est auto-sélectionné
3. AETHER/PULSAR désactivés
4. Testez "Breaking Bad S1E1"

---

## 📝 Ajustements nécessaires pour AETHER

Le scraper AETHER est une base générique.

**À adapter selon la structure réelle de yablom.com** :

### Sélecteurs de recherche

```typescript
// Dans searchYablom()
const searchInput = await page.$(
  'input[type="text"]',  // ← À adapter
  'input[name="search"]', // ← Selon le site
  '#search-box'           // ← Vérifier
);

const searchResults = document.querySelectorAll(
  'a[href*="movie"]',    // ← À adapter
  '.movie-item',         // ← Selon le site
  '.film-card'           // ← Vérifier
);
```

### Sélecteurs de player

```typescript
// Dans scrapeYablomMovie()
const playButtons = document.querySelectorAll(
  'button[class*="play"]', // ← À adapter
  '.play-button',          // ← Selon le site
  '#watch-button'          // ← Vérifier
);

const videoFrame = frames.find((f: any) => {
  const src = f.src || '';
  return src.includes('embed') ||  // ← À adapter
         src.includes('player') || // ← Selon le site
         src.includes('stream');   // ← Vérifier
});
```

---

## 🎯 Comment ajouter PULSAR plus tard

### 1. Créer le scraper

```bash
src/lib/scraper-pulsar.ts
```

### 2. Exporter la fonction

```typescript
export async function getPulsarMovieSource(tmdbId: string)
export async function getPulsarSeriesSource(tmdbId: string, season: number, episode: number)
```

### 3. Importer dans l'API

```typescript
// src/app/api/sources/movie/[tmdbId]/route.ts
import { getPulsarMovieSource } from '@/lib/scraper-pulsar';

// Dans le switch
else if (provider === 'pulsar') {
  data = await getPulsarMovieSource(tmdbId);
}
```

### 4. Activer le bouton

```typescript
// src/components/ContentTester.tsx
<button
  onClick={() => setProvider('pulsar')}
  // disabled  ← Retirer cette ligne
  className="..."
>
  ⚡ PULSAR
</button>
```

---

## 🔄 Cache séparé par provider

Chaque provider a son propre cache :

```
movie_550_orion   → Cache French-Stream
movie_550_aether  → Cache Yablom
movie_550_pulsar  → Cache (futur)
```

**Avantage** : Si un provider est down, l'autre peut prendre le relais !

---

## 📊 Comparaison des lecteurs

| Lecteur | Films | Séries | Source | Langue | Status |
|---------|-------|--------|--------|--------|--------|
| **ORION** | ✅ | ✅ | French-Stream | VF/VOSTFR | ✅ Opérationnel |
| **AETHER** | ✅ | ❌ | Yablom | Multi | ⚠️ À tester |
| **PULSAR** | 🔜 | 🔜 | (à définir) | - | ⏳ Bientôt |

---

## ✅ Prochaines étapes

1. **Testez AETHER** avec différents films
2. **Ajustez les sélecteurs** selon yablom.com
3. **Ajoutez PULSAR** quand prêt
4. **Déployez** sur Render (guide fourni)

---

**Testez les nouveaux lecteurs !** 🎬🔮⚡
