# 🧪 COMMENT TESTER ET FAIRE DES RETOURS

## 🌐 Accéder à l'interface de test

**URL directe** : https://3000-i2y1gnnnu3bkboea0ad95.e2b.app

Ouvrez cette URL dans votre navigateur !

## 🎬 Tester un film

### Méthode 1 : Interface graphique (FACILE)

1. Ouvrez l'URL ci-dessus
2. Scrollez jusqu'à la section "🧪 Tester l'API"
3. Vous verrez un champ avec "TMDB ID"
4. Cliquez sur un des exemples (ex: "Avengers: Endgame")
   - Ou tapez manuellement un ID
5. Cliquez sur "🚀 Tester"
6. Attendez 5-15 secondes
7. Résultat :
   - ✅ Si ça marche : info du film + player vidéo
   - ❌ Si ça marche pas : message d'erreur

### Méthode 2 : curl (TECHNIQUE)

```bash
# Health check (doit retourner {"status":"ok"})
curl https://3000-i2y1gnnnu3bkboea0ad95.e2b.app/api/health

# Tester Avengers: Endgame
curl "https://3000-i2y1gnnnu3bkboea0ad95.e2b.app/api/sources/movie/299534"
```

## 📋 Films à tester en priorité

### ✅ Films qui DEVRAIENT marcher

| Film | TMDB ID | Comment tester |
|------|---------|----------------|
| **Avengers: Endgame** | 299534 | Cliquez sur le bouton "Avengers: Endgame" |
| **The Matrix** | 603 | Cliquez sur "The Matrix" |
| **Fight Club** | 550 | Cliquez sur "Fight Club" |
| **Inception** | 27205 | Cliquez sur "Inception" |
| **Interstellar** | 157336 | Tapez `157336` et testez |
| **Avatar** | 19995 | Tapez `19995` et testez |

### 🤔 Films pour tester la robustesse

| Film | TMDB ID | Pourquoi |
|------|---------|----------|
| Film très récent | 1184918 | Peut ne pas être sur French-Stream |
| Film obscure | 12345 | Tester si gère bien les erreurs |
| Série (devrait fail) | 1396 | Les séries ne sont pas supportées pour l'instant |

## 📝 Quoi noter dans vos retours

### ✅ Si ça MARCHE

Notez :
- ✅ Quel film ?
- ⏱️ Temps de réponse (affiché dans l'interface)
- 🎬 La vidéo se lit-elle correctement ?
- 💾 Si vous re-testez le même film, est-ce instantané ? (cache)

**Exemple de bon retour** :
```
✅ Avengers: Endgame (299534)
- Scraping : 8.2s
- Vidéo : se lit parfaitement
- Cache : 2e tentative instantanée (0.1s)
```

### ❌ Si ça MARCHE PAS

Notez :
- ❌ Quel film ?
- 🚫 Quel message d'erreur exact ?
- 🔍 À quelle étape ça bloque ?
  - "Film non trouvé" → Pas sur French-Stream
  - "Rien trouvé" → Scraping échoué
  - "Erreur HLS" → Problème de lecture
  - Autre ?

**Exemple de bon retour** :
```
❌ Matrix (603)
- Erreur : "Rien trouvé"
- Console : voir log ci-dessous
- Embed trouvé : Non
- M3U8 trouvé : Non
```

### 🐛 Bugs à signaler

- 🔴 **Critique** : L'API crash / ne répond plus
- 🟡 **Important** : Film populaire ne fonctionne pas
- 🟢 **Mineur** : Film obscure ne fonctionne pas (normal)

## 🔍 Voir les détails techniques

### Dans l'interface web

1. Une fois le test terminé
2. Scrollez en bas
3. Cliquez sur "📄 Voir la réponse JSON complète"
4. Vous verrez toutes les infos brutes

### Dans la console du navigateur

1. Ouvrez les DevTools (F12)
2. Onglet "Console"
3. Vous verrez les logs HLS si le player a des problèmes

## 🎯 Scénarios de test

### Scénario 1 : Film populaire
1. Testez "Avengers: Endgame" (299534)
2. Devrait marcher en 5-15s
3. Vidéo devrait se lire
4. Re-testez → devrait être instantané (cache)

### Scénario 2 : Plusieurs films
1. Testez 3-4 films différents
2. Notez lesquels marchent / marchent pas
3. Cherchez un pattern (films récents ? vieux ?)

### Scénario 3 : Stress test
1. Testez 5 films coup sur coup
2. L'API tient-elle ?
3. Y a-t-il des ralentissements ?

### Scénario 4 : Cache
1. Testez un film
2. Attendez 2 minutes
3. Re-testez le même → instantané ?
4. Attendez 31 minutes
5. Re-testez → doit re-scraper

## 📊 Template de retour

Copiez-collez ce template pour vos retours :

```markdown
## Test du [DATE]

### Environnement
- Navigateur : Chrome 149 / Firefox / Safari
- OS : Windows / Mac / Linux
- Connexion : Fibre / 4G

### Tests effectués

#### ✅ Film 1 : Avengers Endgame (299534)
- Temps : 8.2s
- Embed : ✅
- M3U8 : ✅
- Lecture : ✅ Parfaite
- Cache : ✅ Instantané

#### ❌ Film 2 : Matrix (603)
- Temps : 12.5s
- Embed : ❌
- M3U8 : ❌
- Erreur : "Rien trouvé"
- Logs : [coller ici si disponible]

### Problèmes rencontrés
- Aucun / Listez ici

### Suggestions
- Aucune / Listez ici
```

## 🚨 Problèmes fréquents et solutions

### "Film non trouvé"
**Cause** : Pas sur French-Stream  
**Solution** : Normal, essayez un film plus populaire

### "Rien trouvé" après 10-15s
**Cause** : Scraping échoué (sélecteurs changés ?)  
**Solution** : Signaler le bug avec le film exact

### Vidéo ne se lit pas
**Cause** : M3U8 expiré ou problème CORS  
**Solution** : Re-scraper le film (obtenir nouveau lien)

### "Erreur HLS: MANIFEST_LOAD_ERROR"
**Cause** : Le M3U8 a expiré  
**Solution** : Re-tester le film pour obtenir un nouveau lien

### Page blanche / pas de réponse
**Cause** : L'API a crashé ou est surchargée  
**Solution** : Attendre 1-2 min et réessayer

## 📞 Où rapporter les bugs

Ici dans la conversation ! Format :
```
🐛 BUG : [titre court]

Film testé : [nom] (TMDB: [ID])
Erreur : [message exact]
Navigateur : [Chrome/Firefox/Safari]
Reproductible : Oui/Non

[Détails supplémentaires]
```

## 🎯 Checklist de test complète

- [ ] Health check fonctionne
- [ ] Interface web charge
- [ ] Peut entrer un TMDB ID
- [ ] Bouton "Tester" fonctionne
- [ ] Au moins 1 film marche
- [ ] La vidéo se lit
- [ ] Le cache fonctionne (2e test instantané)
- [ ] Les erreurs sont claires
- [ ] Le JSON brut est visible

---

**Prêt à tester ? Allez sur :**
https://3000-i2y1gnnnu3bkboea0ad95.e2b.app

**Bonne chance !** 🎬✨
