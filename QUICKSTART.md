# 🚀 Guide de démarrage rapide - ORION FILM API

## Installation rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer la base de données
echo "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db" > .env

# 3. Appliquer le schéma
npx drizzle-kit push

# 4. Lancer en développement
npm run dev
```

## Test de l'API

```bash
# Health check
curl http://localhost:3000/api/health

# Tester un film (Avengers: Endgame - TMDB ID: 299534)
curl http://localhost:3000/api/sources/movie/299534
```

## Configuration

Éditez `src/lib/config.ts` pour modifier :

```typescript
export const CONFIG = {
  // Si French-Stream change de domaine
  FRENCH_STREAM_MAIN: 'fs02.lol',
  
  // Cache (en millisecondes)
  CACHE_TTL_MS: 30 * 60 * 1000, // 30 minutes
  
  // Timeouts
  TIMEOUTS: {
    PAGE_LOAD: 25000,        // Temps max pour charger une page
    WAIT_AFTER_CLICK: 3000,  // Attente après clic sur Play
    WAIT_FOR_M3U8: 500,      // Intervalle de vérification M3U8
    MAX_M3U8_ATTEMPTS: 8,    // Nombre max de tentatives
  },
}
```

## Structure du projet

```
src/
├── app/
│   ├── api/
│   │   ├── health/          # Health check
│   │   ├── proxy/
│   │   │   ├── m3u8/        # Proxy pour playlists M3U8
│   │   │   └── ts/          # Proxy pour segments vidéo
│   │   └── sources/
│   │       └── movie/       # API principale films
│   └── page.tsx             # Page d'accueil
├── db/
│   ├── index.ts             # Client Drizzle
│   └── schema.ts            # Schéma cache
└── lib/
    ├── config.ts            # ⚙️ Configuration
    ├── puppeteer.ts         # Utilitaires Puppeteer
    ├── scraper.ts           # Logique scraping
    └── tmdb.ts              # API TMDB
```

## Déploiement

### Docker

```dockerfile
FROM node:18-alpine
RUN apk add --no-cache chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Variables d'environnement production

```env
DATABASE_URL=postgresql://user:pass@host:5432/db
NODE_ENV=production
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## Troubleshooting

### Puppeteer ne démarre pas

```bash
# Installer Chrome/Chromium
# Windows : installez Chrome normalement
# Linux : apt-get install chromium-browser
# macOS : brew install chromium
```

### Le site a changé de domaine

Modifiez `src/lib/config.ts` :
```typescript
FRENCH_STREAM_MAIN: 'nouveau-domaine.xyz',
```

### Cache ne fonctionne pas

Vérifiez la connexion DB :
```bash
psql $DATABASE_URL -c "SELECT * FROM stream_cache LIMIT 1;"
```

### M3U8 non capté

Augmentez les timeouts dans `src/lib/config.ts` :
```typescript
TIMEOUTS: {
  PAGE_LOAD: 40000,
  WAIT_AFTER_CLICK: 5000,
  MAX_M3U8_ATTEMPTS: 15,
}
```

## FAQ

**Q: Combien de temps prend un scraping ?**  
A: Entre 5 et 15 secondes selon le film.

**Q: Le cache est partagé entre requêtes ?**  
A: Oui, il est en base de données PostgreSQL.

**Q: Que se passe-t-il si French-Stream bloque ?**  
A: L'API retourne `{ ok: false, erreur: "..." }`.

**Q: Puis-je ajouter d'autres hébergeurs ?**  
A: Oui, modifiez `src/lib/scraper.ts` et ajoutez la logique.

**Q: Les M3U8 sont-ils permanents ?**  
A: Non, ils expirent (tokens temporaires). Le cache aide mais le client doit gérer les erreurs 403/404.

## Support

Pour des problèmes, vérifiez :
1. Les logs de l'API (`npm run dev`)
2. La connexion PostgreSQL
3. Que Puppeteer peut lancer Chrome
4. Que le domaine French-Stream est accessible

## Next Steps

Pour ajouter le support des **séries** (ORION SÉRIE), suivez la même logique mais :
1. Créez `/api/sources/series/[tmdbId]/[season]/[episode]`
2. Adaptez le scraping pour gérer les sélecteurs de saison/épisode
3. Ajoutez les types dans le cache

Bonne chance ! 🎬✨
