# 🧪 TESTER L'API ICI

## 🌐 URL de Preview

Votre API est disponible ici :
```
https://3000-it23r5qlv3cd5caez16cg.e2b.app
```

✅ **STATUS : OPÉRATIONNELLE** (Cloudflare bypassé avec Puppeteer)

## 🎬 Interface de Test Interactive

Ouvrez simplement l'URL dans votre navigateur ! Une interface complète vous permet de :

1. ✅ Entrer un TMDB ID
2. ✅ Voir le résultat du scraping
3. ✅ Lire la vidéo directement si disponible
4. ✅ Voir le JSON brut

### Films à tester

**Avengers: Endgame** - TMDB ID: `299534`  
**The Matrix** - TMDB ID: `603`  
**Fight Club** - TMDB ID: `550`  
**Pulp Fiction** - TMDB ID: `680`  
**Inception** - TMDB ID: `27205`

## 📡 Tester avec curl

### Health Check
```bash
curl https://3000-i2y1gnnnu3bkboea0ad95.e2b.app/api/health
```

### Récupérer un film
```bash
curl https://3000-i2y1gnnnu3bkboea0ad95.e2b.app/api/sources/movie/299534 | jq
```

## 🐛 Déboguer

### Voir les logs
Les logs du scraping apparaissent dans la console du serveur.

### Si ça ne marche pas

**Erreur "Film non trouvé"**
- Le film n'est peut-être pas sur French-Stream
- Essayez un film plus populaire

**Erreur "Rien trouvé"**
- Le scraping a échoué
- Vérifiez que French-Stream est accessible
- Le domaine a peut-être changé (vérifiez `src/lib/config.ts`)

**M3U8 ne se charge pas**
- Le lien a peut-être expiré (les tokens sont temporaires)
- Re-scrapez le film pour obtenir un nouveau lien

**"Erreur HLS"**
- Votre navigateur ne supporte peut-être pas HLS
- Essayez dans Chrome/Firefox/Safari

## 📊 Format de réponse

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
      "m3u8": "https://v6.vidzy.cc/.../master.m3u8?...",
      "proxyM3U8": "/api/proxy/m3u8?url=...",
      "proxyTS": "/api/proxy/ts?url={SEGMENT_URL}&referer=...",
      "source": "french-stream"
    }
  ]
}
```

## 🔍 Ce qui se passe en arrière-plan

1. **Recherche** : L'API cherche le film sur French-Stream
2. **Navigation** : Puppeteer ouvre la page
3. **Clic** : Clique sur le bouton Play
4. **Capture** : Récupère l'embed Vidzy et le M3U8
5. **Proxy** : Réécrit les URLs pour contourner CORS
6. **Cache** : Sauvegarde en DB pour 30 minutes

Le processus prend **5-15 secondes**.

## 💡 Astuces

- Le premier scraping est plus lent (Puppeteer doit démarrer)
- Les scraping suivants utilisent le cache (instantané)
- Le cache expire après 30 minutes
- Les M3U8 peuvent expirer avant (tokens temporaires)

## 📝 Retours à donner

Quand vous testez, notez :

✅ **Ça marche** :
- Quel film ?
- Temps de réponse ?
- La vidéo se lit ?

❌ **Ça marche pas** :
- Quel film ?
- Quel message d'erreur ?
- À quelle étape ça bloque ?

## 🚀 Prêt à déployer ?

Lisez `DEPLOYMENT.md` pour héberger gratuitement sur :
- **Render** (recommandé)
- Railway
- Fly.io
- Docker/VPS

---

**Bonne chance !** 🎬✨
