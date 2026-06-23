# 🚀 Guide de Déploiement Gratuit - ORION FILM API

## ⚠️ Important sur Puppeteer

Puppeteer nécessite Chrome/Chromium, ce qui limite les options de déploiement gratuit :

| Service | Gratuit | Puppeteer | Facilité | Recommandation |
|---------|---------|-----------|----------|----------------|
| **Render** | ✅ Oui | ✅ Oui | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ **MEILLEUR** |
| **Railway** | ✅ Oui* | ✅ Oui | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Fly.io** | ✅ Oui* | ✅ Oui | ⭐⭐ | ⭐⭐⭐ |
| Vercel | ✅ Oui | ❌ Non | ⭐⭐⭐⭐⭐ | ❌ Incompatible |
| Netlify | ✅ Oui | ❌ Non | ⭐⭐⭐⭐⭐ | ❌ Incompatible |

*Limites horaires mensuelles

---

## 🏆 Option 1 : Render (RECOMMANDÉ)

### Pourquoi Render ?
- ✅ 750h/mois gratuit (suffisant pour 1 app 24/7)
- ✅ PostgreSQL gratuit (500 MB)
- ✅ Support Puppeteer natif
- ✅ Déploiement facile depuis GitHub
- ✅ SSL automatique

### Étapes de déploiement

#### 1. Préparer le projet

Créez `render.yaml` à la racine :

```yaml
services:
  - type: web
    name: orion-film-api
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: orion-db
          property: connectionString
      - key: NODE_ENV
        value: production
      - key: PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
        value: true
      - key: PUPPETEER_EXECUTABLE_PATH
        value: /usr/bin/chromium-browser

databases:
  - name: orion-db
    plan: free
```

Créez `Dockerfile` (optionnel mais recommandé) :

```dockerfile
FROM node:18-slim

# Installer Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### 2. Créer le projet sur Render

1. Allez sur [render.com](https://render.com)
2. Créez un compte (gratuit)
3. Connectez votre GitHub
4. Cliquez sur **"New +"** → **"Web Service"**
5. Sélectionnez votre repo
6. Configurez :
   - **Name** : `orion-film-api`
   - **Environment** : `Node`
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
   - **Instance Type** : **Free**

#### 3. Configurer la base de données

1. Dans le même projet, cliquez **"New +"** → **"PostgreSQL"**
2. Nom : `orion-db`
3. Plan : **Free**
4. Cliquez **"Create Database"**

#### 4. Lier la base de données

1. Retournez dans votre Web Service
2. Allez dans **"Environment"**
3. Ajoutez :
   ```
   DATABASE_URL = [Copiez depuis votre PostgreSQL Database → Internal Connection String]
   NODE_ENV = production
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = true
   PUPPETEER_EXECUTABLE_PATH = /usr/bin/chromium-browser
   ```

#### 5. Déployer

Le déploiement se lance automatiquement ! ✨

Après 5-10 minutes, votre API sera accessible sur :
```
https://orion-film-api.onrender.com
```

#### 6. Appliquer le schéma DB

Une fois déployé, allez dans **"Shell"** dans votre service et lancez :
```bash
npx drizzle-kit push
```

---

## 🚄 Option 2 : Railway

### Pourquoi Railway ?
- ✅ 500h/mois gratuit
- ✅ PostgreSQL inclus
- ✅ CLI simple
- ✅ Déploiement rapide

### Étapes

1. **Installer Railway CLI**
```bash
npm install -g @railway/cli
```

2. **Login**
```bash
railway login
```

3. **Initialiser le projet**
```bash
railway init
```

4. **Ajouter PostgreSQL**
```bash
railway add --plugin postgresql
```

5. **Configurer les variables**
```bash
railway variables set NODE_ENV=production
railway variables set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
railway variables set PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

6. **Déployer**
```bash
railway up
```

7. **Ouvrir**
```bash
railway open
```

### Nixpacks configuration

Créez `nixpacks.toml` :

```toml
[phases.setup]
nixPkgs = ["nodejs", "chromium"]

[phases.build]
cmds = ["npm install", "npm run build"]

[start]
cmd = "npm start"
```

---

## ✈️ Option 3 : Fly.io

### Configuration

Créez `fly.toml` :

```toml
app = "orion-film-api"
primary_region = "cdg"

[build]
  builder = "heroku/buildpacks:20"

[[services]]
  http_checks = []
  internal_port = 3000
  processes = ["app"]
  protocol = "tcp"
  script_checks = []

  [services.concurrency]
    hard_limit = 25
    soft_limit = 20
    type = "connections"

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

### Déployer

```bash
# Installer Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Créer PostgreSQL
fly postgres create

# Attacher la DB
fly postgres attach <db-name>

# Déployer
fly deploy
```

---

## 🐳 Option 4 : Docker Self-Hosted (VPS gratuit)

### Providers VPS gratuits
- **Oracle Cloud** : 2 VM gratuites à vie
- **Google Cloud** : 300$ crédits (3 mois)
- **AWS** : 12 mois gratuits

### Docker Compose

Créez `docker-compose.yml` :

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/orion
      - NODE_ENV=production
      - PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
      - PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=orion
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

### Lancer

```bash
docker-compose up -d
```

---

## 📊 Comparaison des coûts

| Service | Gratuit | Limite CPU | Limite RAM | Limite DB | Sleep après inactivité |
|---------|---------|------------|------------|-----------|------------------------|
| Render | 750h/mois | Partagé | 512 MB | 500 MB | Après 15 min |
| Railway | 500h/mois | Partagé | 512 MB | Inclus | Non |
| Fly.io | Oui* | Partagé | 256 MB | Inclus | Non |
| Vercel | ❌ | - | - | - | N/A |

*Limites variables

---

## ⚡ Optimisations pour le gratuit

### 1. Réduire le "cold start"

Créez un cron job pour garder l'app active :

```bash
# Sur cron-job.org (gratuit)
GET https://votre-api.com/api/health
Toutes les 10 minutes
```

### 2. Limiter Puppeteer

Dans `src/lib/config.ts` :

```typescript
export const CONFIG = {
  // Limites pour le gratuit
  MAX_CONCURRENT_BROWSERS: 1,
  BROWSER_TIMEOUT: 30000, // 30s max
  CACHE_TTL_MS: 60 * 60 * 1000, // 1h (au lieu de 30min)
}
```

### 3. Ajouter un rate limiting

Installez :
```bash
npm install express-rate-limit
```

Créez `src/middleware/rateLimit.ts` :

```typescript
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requêtes max
  message: { ok: false, erreur: 'Trop de requêtes, réessayez plus tard' }
});
```

---

## 🔧 Variables d'environnement de production

```env
# Obligatoires
DATABASE_URL=postgresql://user:pass@host:5432/db
NODE_ENV=production

# Puppeteer (selon la plateforme)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Optionnelles
PORT=3000
```

---

## 🚨 Monitoring gratuit

### UptimeRobot (gratuit)
1. [uptimerobot.com](https://uptimerobot.com)
2. Créez un monitor HTTP(S)
3. URL : `https://votre-api.com/api/health`
4. Intervalle : 5 minutes
5. Recevez des alertes par email

---

## 📝 Checklist de déploiement

- [ ] Code pushé sur GitHub/GitLab
- [ ] `Dockerfile` créé
- [ ] Variables d'environnement configurées
- [ ] Base de données PostgreSQL créée
- [ ] Schéma appliqué (`drizzle-kit push`)
- [ ] Déploiement réussi
- [ ] Test de l'API : `curl https://votre-api.com/api/health`
- [ ] Test d'un film : `curl https://votre-api.com/api/sources/movie/299534`
- [ ] Monitoring configuré

---

## 🎯 Recommandation finale

**Pour débuter : RENDER**
- Plus simple
- Fiable
- Bon support Puppeteer
- Interface claire

**Pour scaler : Railway ou VPS**

Bonne chance ! 🚀
