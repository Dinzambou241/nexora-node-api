// Configuration centralisée pour le scraper

export const CONFIG = {
  // Domaines French-Stream (peut changer)
  FRENCH_STREAM_DOMAINS: [
    'fs02.lol',
    'french-stream.ac',
    'french-stream.one',
  ],
  
  // Domaine principal actuel
  FRENCH_STREAM_MAIN: 'fs02.lol',
  
  // Hébergeurs supportés
  SUPPORTED_HOSTERS: {
    VIDZY: {
      name: 'Vidzy',
      domains: ['vidzy.live', 'vidzy.cc', 'vz-cdn'],
      embedPattern: /vidzy\.live\/embed-[a-z0-9]+\.html/i,
    },
  },
  
  // Cache
  // Stream URLs often contain short-lived CDN signatures.
  CACHE_TTL_MS: 10 * 60 * 1000,
  
  // TMDB
  TMDB_API_KEY: '0cab5b92c32ddab1cd45f67d303c5dce',
  
  // Timeouts optimisés
  TIMEOUTS: {
    PAGE_LOAD: 20000, // Réduit de 25s à 20s
    WAIT_AFTER_LOAD: 1500, // Attente après chargement page
    WAIT_AFTER_CLICK: 2000, // Réduit de 3s à 2s
    WAIT_FOR_M3U8: 300, // Réduit de 500ms à 300ms
    MAX_M3U8_ATTEMPTS: 10, // Augmenté pour compenser le délai réduit
    M3U8_MAX_WAIT: 5000, // Max 5s pour attendre le M3U8
    EMBED_FALLBACK_DELAY: 3000, // Si M3U8 pas prêt en 3s, on retourne quand même
  },
  
  // Selectors
  SELECTORS: {
    PLAY_BUTTON: '.play-button',
    IFRAME: 'iframe[src], iframe[data-src]',
  },
} as const;
