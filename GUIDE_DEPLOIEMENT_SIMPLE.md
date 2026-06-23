# 🚀 GUIDE DE DÉPLOIEMENT GRATUIT - ULTRA SIMPLE

## ✅ Meilleure option : Render.com

**Pourquoi ?**
- ✅ 100% gratuit
- ✅ Le plus simple
- ✅ Support Puppeteer
- ✅ PostgreSQL inclus
- ✅ SSL automatique
- ✅ Déploiement en 5 minutes

---

## 📝 ÉTAPES PAS À PAS

### 1️⃣ Créer un compte GitHub (si vous n'en avez pas)

1. Allez sur [github.com](https://github.com)
2. Cliquez "Sign up"
3. Créez votre compte gratuitement

### 2️⃣ Créer un repository

1. Une fois connecté, cliquez le **+** en haut à droite
2. Cliquez **"New repository"**
3. Nom : `orion-stream-api`
4. Cochez **"Public"**
5. Cliquez **"Create repository"**

### 3️⃣ Uploader votre code

**Option A : Avec GitHub Desktop (facile)**
1. Téléchargez [GitHub Desktop](https://desktop.github.com/)
2. Connectez-vous avec votre compte
3. File → Add Local Repository
4. Sélectionnez votre dossier du projet
5. Commit → Push

**Option B : En ligne de commande**
```bash
# Dans votre dossier du projet
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/VOTRE_NOM/orion-stream-api.git
git push -u origin main
```

**Option C : Manuellement (très facile)**
1. Sur votre repo GitHub, cliquez **"uploading an existing file"**
2. Glissez-déposez TOUS vos fichiers
3. Cliquez **"Commit changes"**

### 4️⃣ S'inscrire sur Render

1. Allez sur [render.com](https://render.com)
2. Cliquez **"Get Started for Free"**
3. Connectez-vous avec **GitHub** (recommandé)
4. Autorisez Render à accéder à vos repos

### 5️⃣ Créer la base de données PostgreSQL

1. Dans Render, cliquez **"New +"**
2. Sélectionnez **"PostgreSQL"**
3. Remplissez :
   - **Name** : `orion-db`
   - **Database** : `orion`
   - **User** : `orion`
   - **Region** : Choisissez le plus proche (ex: Frankfurt)
   - **Plan** : **Free**
4. Cliquez **"Create Database"**
5. ⏱️ Attendez 1-2 minutes que la DB soit créée
6. **Copiez** l'**Internal Database URL** (vous en aurez besoin)

### 6️⃣ Créer le service Web

1. Cliquez **"New +"** → **"Web Service"**
2. Sélectionnez **"Build and deploy from a Git repository"**
3. Cliquez **"Next"**
4. Sélectionnez votre repo **orion-stream-api**
5. Cliquez **"Connect"**

### 7️⃣ Configurer le service

Remplissez le formulaire :

**Name** : `orion-stream-api`

**Region** : Même que la database (ex: Frankfurt)

**Branch** : `main`

**Root Directory** : (laissez vide)

**Runtime** : **Node**

**Build Command** :
```bash
npm install && npm run build
```

**Start Command** :
```bash
npm start
```

**Plan** : **Free**

### 8️⃣ Variables d'environnement

Scrollez vers **"Environment Variables"**, cliquez **"Add Environment Variable"**

Ajoutez **UNE PAR UNE** :

```
Key: DATABASE_URL
Value: [Collez l'Internal Database URL de l'étape 5]

Key: NODE_ENV
Value: production

Key: PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
Value: true

Key: PUPPETEER_EXECUTABLE_PATH
Value: /usr/bin/chromium-browser
```

### 9️⃣ Déployer !

1. Cliquez **"Create Web Service"**
2. ⏱️ **Attendez 5-10 minutes** (première fois c'est long)
3. Render va :
   - Installer les dépendances
   - Installer Chromium
   - Builder Next.js
   - Démarrer le serveur

### 🔟 Appliquer le schéma de la base de données

Une fois le déploiement réussi :

1. Dans votre service, cliquez **"Shell"** (onglet en haut)
2. Tapez cette commande :
```bash
npx drizzle-kit push
```
3. Appuyez **Entrée**
4. Attendez que ça se termine

---

## ✅ C'EST FAIT !

Votre API est disponible sur :
```
https://orion-stream-api.onrender.com
```

### Tester

```bash
# Health check
curl https://orion-stream-api.onrender.com/api/health

# Test film ORION
curl https://orion-stream-api.onrender.com/api/sources/movie/550?provider=orion

# Test film AETHER
curl https://orion-stream-api.onrender.com/api/sources/movie/550?provider=aether
```

---

## 🔄 Mises à jour

Pour mettre à jour votre API :

1. Modifiez votre code localement
2. Poussez sur GitHub :
```bash
git add .
git commit -m "Mise à jour"
git push
```
3. Render **redéploie automatiquement** ! 🎉

---

## ⚙️ Configuration avancée (optionnel)

### Nom de domaine personnalisé

1. Dans votre service Render, allez dans **"Settings"**
2. Section **"Custom Domain"**
3. Ajoutez votre domaine
4. Suivez les instructions DNS

### Garder l'app active (éviter le sleep)

Render met l'app en veille après 15 min d'inactivité.

**Solution** : Utilisez [cron-job.org](https://cron-job.org) (gratuit)
1. Créez un compte
2. Créez un job :
   - URL : `https://orion-stream-api.onrender.com/api/health`
   - Intervalle : **Toutes les 10 minutes**
3. Votre app reste active 24/7 !

---

## 🐛 Problèmes fréquents

### Build échoue

**Erreur** : `Build failed`

**Solution** :
1. Vérifiez que `package.json` est présent
2. Vérifiez que `Build Command` est : `npm install && npm run build`
3. Regardez les logs pour l'erreur exacte

### Database connection error

**Erreur** : `DATABASE_URL is required`

**Solution** :
1. Vérifiez que vous avez bien ajouté `DATABASE_URL` dans les variables
2. Redémarrez le service (Settings → Manual Deploy → Deploy latest commit)

### Puppeteer ne démarre pas

**Erreur** : `Failed to launch browser`

**Solution** :
1. Vérifiez que vous avez bien ajouté :
   - `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
   - `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`
2. Le `Dockerfile` inclut déjà Chromium

### App en veille

**Problème** : Première requête très lente

**Solution** : Utilisez cron-job.org (voir ci-dessus)

---

## 💰 Limites du plan gratuit

| Limite | Valeur |
|--------|--------|
| **CPU** | Partagé |
| **RAM** | 512 MB |
| **Heures/mois** | 750h (24/7 = ~720h) |
| **Build time** | 15 min max |
| **Database** | 500 MB |
| **Sleep** | Après 15 min inactivité |

**C'est largement suffisant pour un usage personnel !**

---

## 🎯 Alternatives si Render ne marche pas

### Railway.app
- Même principe que Render
- 500h/mois gratuit
- Un peu plus technique

### Fly.io
- Plus flexible
- Configuration Docker nécessaire
- Limites généroses

### Oracle Cloud (VPS)
- 2 VM gratuites À VIE
- Plus technique (SSH, Docker)
- Aucune limite

---

## ✅ Checklist finale

Avant de déployer :

- [ ] Code poussé sur GitHub
- [ ] Compte Render créé
- [ ] PostgreSQL créé
- [ ] `DATABASE_URL` copiée
- [ ] Service Web créé
- [ ] Variables d'environnement configurées
- [ ] Déploiement lancé
- [ ] `drizzle-kit push` exécuté
- [ ] `/api/health` retourne `{"status": "ok"}`

---

**Vous êtes prêt !** 🚀

Si vous avez des problèmes, regardez les **logs** dans Render (onglet "Logs").
