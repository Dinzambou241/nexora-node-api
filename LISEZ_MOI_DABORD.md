# 👋 BIENVENUE - ORION FILM API

## 🎯 CE QUI A ÉTÉ FAIT

J'ai créé une **API complète de scraping** pour French-Stream avec :

✅ Scraping automatique avec Puppeteer  
✅ Blocage des pubs et pop-ups  
✅ Cache PostgreSQL intelligent  
✅ Proxy M3U8/TS pour contourner CORS  
✅ **Interface de test interactive** (avec player vidéo intégré)  
✅ Documentation complète  
✅ Prêt pour déploiement gratuit  

---

## 🚀 TESTER MAINTENANT (ICI)

### 📍 URL de l'interface de test

**Cliquez ici** : https://3000-it23r5qlv3cd5caez16cg.e2b.app

✅ **OPÉRATIONNELLE** - Cloudflare bypassé !

### 🎬 Comment tester

1. **Ouvrez le lien ci-dessus**
2. Scrollez jusqu'à "🧪 Tester l'API"
3. Cliquez sur **"Avengers: Endgame"** (ou entrez un autre TMDB ID)
4. Cliquez sur **"🚀 Tester"**
5. Attendez 5-15 secondes
6. **Résultat** :
   - ✅ Si disponible : infos + **player vidéo**
   - ❌ Si indisponible : message d'erreur

### 🎥 Films à tester

Cliquez directement sur les boutons dans l'interface :
- **Avengers: Endgame** (299534)
- **The Matrix** (603)
- **Fight Club** (550)
- **Pulp Fiction** (680)
- **Inception** (27205)

---

## 📝 FAIRE DES RETOURS

### ✅ Si ça marche

Dites-moi :
- Quel film ?
- Temps de réponse ?
- La vidéo se lit bien ?

**Exemple** :
```
✅ Avengers: Endgame
- Temps : 8s
- Vidéo : parfaite
```

### ❌ Si ça marche pas

Dites-moi :
- Quel film ?
- Quel message d'erreur ?
- À quelle étape ça bloque ?

**Exemple** :
```
❌ Matrix
- Erreur : "Rien trouvé"
- Temps : 12s
```

---

## 🌍 DÉPLOYER GRATUITEMENT

### Option 1 : Render.com (RECOMMANDÉ)

**Pourquoi ?**
- ✅ 100% gratuit (750h/mois)
- ✅ PostgreSQL inclus
- ✅ Support Puppeteer
- ✅ SSL automatique

**Comment ?**
1. Créez un compte sur [render.com](https://render.com)
2. Cliquez "New +" → "Web Service"
3. Connectez votre GitHub avec ce projet
4. Build Command : `npm install && npm run build`
5. Start Command : `npm start`
6. Ajoutez PostgreSQL
7. Configurez `DATABASE_URL`
8. **Déployez !**

**Guide détaillé** : Voir `DEPLOYMENT.md`

### Alternatives

- **Railway** : 500h/mois gratuit
- **Fly.io** : Configuration Docker
- **VPS gratuit** : Oracle Cloud

---

## 📚 DOCUMENTATION

| Fichier | Description |
|---------|-------------|
| **COMMENT_TESTER.md** | 🧪 Guide complet pour tester |
| **DEPLOYMENT.md** | 🚀 Déploiement gratuit détaillé |
| **QUICKSTART.md** | ⚡ Installation locale rapide |
| **README.md** | 📖 Documentation technique |
| **SERIES_SUPPORT.md** | 📺 Ajouter le support des séries |
| **RESUME.md** | 📋 Récapitulatif complet |

---

## 🛠️ STRUCTURE DU PROJET

```
src/
├── app/
│   ├── api/
│   │   ├── health/              ✅ Health check
│   │   ├── proxy/m3u8/          ✅ Proxy playlists
│   │   ├── proxy/ts/            ✅ Proxy segments
│   │   └── sources/movie/       ✅ API principale
│   ├── page.tsx                  ✅ Interface de test
│   └── globals.css
├── components/
│   └── MovieTester.tsx          ✅ Composant de test
├── db/
│   ├── schema.ts                ✅ Cache PostgreSQL
│   └── index.ts
└── lib/
    ├── config.ts                ⚙️ Configuration
    ├── puppeteer.ts             🤖 Scraping
    ├── scraper.ts               🎬 Logique métier
    └── tmdb.ts                  🎞️ API TMDB
```

---

## ⚙️ CONFIGURATION

Tout est dans `src/lib/config.ts` :

```typescript
export const CONFIG = {
  // Si French-Stream change de domaine
  FRENCH_STREAM_MAIN: 'fs02.lol',
  
  // Durée du cache (30 minutes)
  CACHE_TTL_MS: 30 * 60 * 1000,
  
  // Timeouts (ajustez si lent)
  TIMEOUTS: {
    PAGE_LOAD: 25000,
    WAIT_AFTER_CLICK: 3000,
  },
}
```

---

## 🎯 PROCHAINES ÉTAPES

### Pour vous maintenant

1. **Testez l'API** (lien ci-dessus)
2. **Faites des retours** (quel film marche/marche pas)
3. **Déployez** si satisfait (voir DEPLOYMENT.md)

### Pour étendre le projet

- [ ] Ajouter les séries (voir SERIES_SUPPORT.md)
- [ ] Ajouter d'autres hébergeurs (pas que Vidzy)
- [ ] Supporter multi-langues (VF, VOSTFR)
- [ ] Ajouter rate limiting

---

## 🐛 PROBLÈMES FRÉQUENTS

### "Film non trouvé"
➡️ Pas sur French-Stream, essayez un film populaire

### "Rien trouvé"
➡️ Scraping échoué, signalez le film

### Vidéo ne se lit pas
➡️ M3U8 expiré, re-testez le film

### API lente
➡️ Normal la 1ère fois (Puppeteer démarre)

---

## 📞 SUPPORT

Pour tester :
- **URL** : https://3000-i2y1gnnnu3bkboea0ad95.e2b.app
- **Guide** : Voir `COMMENT_TESTER.md`

Pour déployer :
- **Guide** : Voir `DEPLOYMENT.md`
- **Recommandé** : Render.com

Pour développer :
- **Installation** : Voir `QUICKSTART.md`
- **Séries** : Voir `SERIES_SUPPORT.md`

---

## 🎬 C'EST PARTI !

### Étape 1 : TESTEZ
👉 https://3000-i2y1gnnnu3bkboea0ad95.e2b.app

### Étape 2 : RAPPORTEZ
Dites-moi ce qui marche / marche pas

### Étape 3 : DÉPLOYEZ
Suivez `DEPLOYMENT.md` pour héberger gratuitement

---

**Fait avec ❤️ - Version 2.0**

**Bonne chance !** 🚀✨
