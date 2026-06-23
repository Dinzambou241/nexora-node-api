import { CONFIG } from './config';

type CatalogType = 'movie' | 'series';

type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  vote_average?: number;
  popularity?: number;
  adult?: boolean;
};

const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w780';

const movieGenres = new Map<number, string>([
  [28, 'Action'],
  [12, 'Aventure'],
  [16, 'Animation'],
  [35, 'Comedie'],
  [80, 'Crime'],
  [18, 'Drame'],
  [14, 'Fantastique'],
  [27, 'Horreur'],
  [878, 'Science-fiction'],
  [53, 'Thriller'],
]);

const seriesGenres = new Map<number, string>([
  [16, 'Animation'],
  [35, 'Comedie'],
  [80, 'Crime'],
  [18, 'Drame'],
  [10759, 'Action & aventure'],
  [10765, 'Science-fiction'],
  [9648, 'Mystere'],
]);

function tmdbUrl(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('api_key', CONFIG.TMDB_API_KEY);
  url.searchParams.set('language', 'fr-FR');
  url.searchParams.set('include_adult', 'false');
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });
  return url;
}

function yearFromDate(value?: string) {
  return value?.slice(0, 4) || '';
}

function normalizeCatalogItem(item: TmdbItem, type: CatalogType, index: number) {
  const genres = type === 'movie' ? movieGenres : seriesGenres;
  const categoryName = genres.get(item.genre_ids?.[0] || 0) || (type === 'movie' ? 'Films FR' : 'Series FR');
  const title = item.title || item.name || `${type === 'movie' ? 'Film' : 'Serie'} ${item.id}`;
  const year = yearFromDate(type === 'movie' ? item.release_date : item.first_air_date);

  return {
    id: `orion~${type}~${item.id}`,
    tmdbId: String(item.id),
    type,
    name: title,
    title,
    description: item.overview || '',
    categoryId: `orion-french-${type}-${categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    categoryName,
    image: item.poster_path ? `${TMDB_IMAGE}${item.poster_path}` : '',
    poster: item.poster_path ? `${TMDB_IMAGE}${item.poster_path}` : '',
    backdrop: item.backdrop_path ? `${TMDB_BACKDROP}${item.backdrop_path}` : '',
    releaseYear: year,
    year,
    source: 'Orion + TMDB-Embed',
    sourceCode: 'orion',
    provider: 'orion',
    playbackProvider: 'auto',
    playbackProviderName: 'Orion + TMDB-Embed',
    externalPlayback: true,
    streamAvailable: true,
    language: 'fr',
    languageName: 'Francais',
    popularity: item.popularity || 0,
    rank: index + 1,
  };
}

function isAllowedCatalogItem(item: TmdbItem) {
  const title = `${item.title || ''} ${item.name || ''}`.toLowerCase();
  if (item.adult) return false;
  return !/\b(porn|porno|xxx|erotic|erotique)\b/i.test(title);
}

export async function getCatalogItems(type: CatalogType, options: {
  query?: string;
  limit?: number;
  sort?: string;
}) {
  const limit = Math.min(Math.max(options.limit || 80, 1), 240);
  const pages = Math.min(Math.ceil(limit / 20), 12);
  const results: TmdbItem[] = [];
  const mediaType = type === 'movie' ? 'movie' : 'tv';
  const query = options.query?.trim();

  for (let page = 1; page <= pages; page += 1) {
    const url = query
      ? tmdbUrl(`/search/${mediaType}`, { query, page })
      : tmdbUrl(`/discover/${mediaType}`, {
          page,
          sort_by: options.sort === 'recent'
            ? (type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc')
            : 'popularity.desc',
          watch_region: 'FR',
          with_original_language: 'fr',
        });

    const response = await fetch(url, { next: { revalidate: 1800 } });
    if (!response.ok) {
      throw new Error(`TMDB catalog failed: ${response.status}`);
    }
    const data = await response.json();
    results.push(...((data.results || []) as TmdbItem[]));
    if (results.length >= limit || page >= Number(data.total_pages || page)) break;
  }

  const seen = new Set<number>();
  return results
    .filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return Boolean(item.poster_path && (item.title || item.name) && isAllowedCatalogItem(item));
    })
    .slice(0, limit)
    .map((item, index) => normalizeCatalogItem(item, type, index));
}
