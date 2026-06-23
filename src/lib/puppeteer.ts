import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;

const BAD_URL_RX = /(doubleclick|googlesyndication|googletagmanager|google-analytics|facebook|fbcdn|disqus|popads|popcash|exoclick|adnxs|mgid|taboola|outbrain|adsterra|hilltopads|trafficjunky|propellerads|analytics|tracking|ads|advertisement)/i;

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--mute-audio',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      defaultViewport: { width: 1366, height: 900 },
    });
  }
  return browser;
}

export async function preparePage(
  page: Page,
  allowedMainHosts: string[] = [],
  opts: { referer?: string; blockAssets?: boolean } = {}
): Promise<void> {
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  const headers: Record<string, string> = {
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    Accept: 'text/html,*/*;q=0.8',
  };
  
  if (opts.referer) {
    headers.Referer = opts.referer;
  }

  await page.setExtraHTTPHeaders(headers);

  // Anti-détection
  await page.evaluateOnNewDocument(() => {
    // @ts-ignore
    window.open = () => null; // Bloque les pop-ups
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  await page.setRequestInterception(true);

  page.on('request', (req) => {
    try {
      const url = req.url();

      // Bloque les pubs et trackers
      if (BAD_URL_RX.test(url)) {
        return req.abort();
      }

      // Bloque les assets si demandé
      if (opts.blockAssets && ['image', 'font', 'stylesheet'].includes(req.resourceType())) {
        return req.abort();
      }

      // Contrôle les navigations principales
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
        try {
          const host = new URL(url).hostname;
          if (allowedMainHosts.length && !allowedMainHosts.some((h) => host.includes(h))) {
            return req.abort();
          }
        } catch {}
      }

      req.continue();
    } catch {
      try {
        req.continue();
      } catch {}
    }
  });

  // Bloque les nouvelles pages (pop-ups)
  page.on('popup', async (popup) => {
    try {
      if (popup) {
        await popup.close();
      }
    } catch {}
  });
}

export function attachCollector(page: Page) {
  const store = {
    embeds: new Set<string>(),
    m3u8s: new Set<string>(),
  };

  const isLikelyM3U8 = (url: string) => url && /\.m3u8(\?|$)/i.test(url);

  page.on('request', (req) => {
    try {
      const u = req.url();
      if (isLikelyM3U8(u)) {
        store.m3u8s.add(u);
      }
      if (/vidzy\.live\/embed-[a-z0-9]+\.html/i.test(u)) {
        store.embeds.add(u);
      }
    } catch {}
  });

  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (isLikelyM3U8(url)) {
        store.m3u8s.add(url);
      }

      const type = res.request().resourceType();
      if (!['xhr', 'fetch', 'script', 'document'].includes(type)) return;

      const ct = (res.headers()['content-type'] || '').toLowerCase();
      if (
        !(ct.includes('text') || ct.includes('json') || ct.includes('javascript') || ct.includes('html'))
      )
        return;

      const text = await res.text().catch(() => '');
      if (!text || text.length > 800000) return;
      if (!/(m3u8|vidzy|source|file)/i.test(text)) return;

      const m3u8 = extractM3U8FromText(text);
      if (m3u8) store.m3u8s.add(m3u8);

      const allUrls = text.match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi);
      if (allUrls) allUrls.forEach((u) => store.m3u8s.add(u));
    } catch {}
  });

  return store;
}

function extractM3U8FromText(text: string): string | null {
  if (!text) return null;
  
  let m = text.match(/(https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*)/i);
  if (m) return m[1];
  
  m = text.match(/(?:file|source|src|video_url)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i);
  if (m) return m[1].startsWith('//') ? 'https:' + m[1] : m[1];
  
  return null;
}

export function chooseBestM3U8(urls: string[]): string | null {
  const list = [...new Set(urls.filter(Boolean))];
  if (!list.length) return null;
  return list.find((u) => /master/i.test(u)) || list[0];
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
