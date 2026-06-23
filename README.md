# 🎬 ORION FILM API

API de scraping pour films depuis French-Stream avec support de Vidzy.

## 🚀 Fonctionnalités

- ✅ Scraping automatique depuis French-Stream (fs02.lol)
- ✅ Recherche par TMDB ID
- ✅ Cache intelligent en base de données (30 minutes)
- ✅ Proxy M3U8 et segments TS
- ✅ Blocage automatique des pubs et pop-ups
- ✅ Support Vidzy uniquement
- ✅ Anti-détection avec Puppeteer

## 📡 API Routes

### 1. Récupérer les sources d'un film

```bash
GET /api/sources/movie/:tmdbId
```

**Exemple:**
```bash
curl https://votre-domaine.com/api/sources/movie/299534
```

**Réponse:**
```json
{
  "ok": true,
  "titre": "Avengers: Endgame",
  "annee": "2019",
  "hosters": [
    {
      "nom": "Vidzy",
      "lang": "TrueFrench",
      "embedUrl": "https://vidzy.live/embed-xxx.html",
      "m3u8": "https://v6.vidzy.cc/hls2/.../master.m3u8?...",
      "proxyM3U8": "/api/proxy/m3u8?url=...",
      "proxyTS": "/api/proxy/ts?url={SEGMENT_URL}&referer=...",
      "source": "french-stream"
    }
  ]
}
```

### 2. Proxy M3U8

```bash
GET /api/proxy/m3u8?url=<M3U8_URL>&referer=<REFERER>
```

Réécrit les URLs M3U8 pour passer par le proxy.

### 3. Proxy segments TS

```bash
GET /api/proxy/ts?url=<SEGMENT_URL>&referer=<REFERER>
```

Proxie les segments vidéo avec les bons headers.

### 4. Health Check

```bash
GET /api/health
```

**Réponse:**
```json
{
  "status": "ok"
}
```

## 🛠️ Installation

```bash
# Installer les dépendances
npm install

# Configurer la base de données
echo "DATABASE_URL=postgresql://user:pass@host:5432/db" > .env

# Appliquer le schéma
npx drizzle-kit push

# Lancer en dev
npm run dev

# Build production
npm run build
npm start
```

## 🔧 Variables d'environnement

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
PUPPETEER_EXECUTABLE_PATH=/chemin/vers/chrome  # Optionnel en dev
```

## 📝 Processus de scraping

1. **Recherche** : L'API cherche le film sur French-Stream via AJAX
2. **Matching** : Trouve le meilleur résultat basé sur le titre et l'année
3. **Navigation** : Ouvre la page du film avec Puppeteer
4. **Clic Play** : Clique sur le bouton `.play-button`
5. **Capture** : Récupère l'embed Vidzy et le M3U8
6. **Cache** : Stocke le résultat en base de données (30min)

## 🚫 Blocage des pubs

L'API bloque automatiquement :
- Pop-ups et nouvelles fenêtres
- Trackers (Google Analytics, Facebook, etc.)
- Réseaux publicitaires (Adsterra, Exoclick, etc.)
- Assets inutiles (images, fonts, CSS si demandé)

## 🎯 Technologies

- **Next.js 16** (App Router)
- **Puppeteer** (scraping)
- **PostgreSQL** (cache via Drizzle ORM)
- **TypeScript**
- **Tailwind CSS**

## ⚠️ Notes importantes

- Le site French-Stream peut changer de domaine
- Seul Vidzy est supporté comme hébergeur
- Le cache expire après 30 minutes
- Les M3U8 sont temporaires (tokens expirables)

## 📄 License

Usage personnel uniquement. Respect des droits d'auteur.
