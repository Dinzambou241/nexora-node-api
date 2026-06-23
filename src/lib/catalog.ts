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

type TmdbSeasonSummary = {
  season_number: number;
  name?: string;
  episode_count?: number;
  poster_path?: string | null;
};

type TmdbEpisode = {
  id: number;
  episode_number: number;
  name?: string;
  overview?: string;
  still_path?: string | null;
  runtime?: number;
  vote_average?: number;
  air_date?: string;
};

type TmdbPage = {
  results?: TmdbItem[];
  total_pages?: number;
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

function imageUrl(path?: string | null, base = TMDB_IMAGE) {
  return path ? `${base}${path}` : '';
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
    image: imageUrl(item.poster_path),
    poster: imageUrl(item.poster_path),
    backdrop: imageUrl(item.backdrop_path, TMDB_BACKDROP),
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

function endpointPlan(type: CatalogType, sort?: string) {
  if (sort === 'recent') {
    return type === 'movie'
      ? [{ path: '/movie/now_playing', params: { region: 'FR' } }, { path: '/movie/upcoming', params: { region: 'FR' } }]
      : [{ path: '/tv/on_the_air', params: {} }, { path: '/tv/airing_today', params: {} }];
  }

  return type === 'movie'
    ? [
        { path: '/movie/popular', params: { region: 'FR' } },
        { path: '/movie/top_rated', params: { region: 'FR' } },
        { path: '/movie/now_playing', params: { region: 'FR' } },
        { path: '/discover/movie', params: { watch_region: 'FR', sort_by: 'popularity.desc' } },
        { path: '/discover/movie', params: { sort_by: 'vote_count.desc' } },
      ]
    : [
        { path: '/tv/popular', params: {} },
        { path: '/tv/top_rated', params: {} },
        { path: '/tv/on_the_air', params: {} },
        { path: '/discover/tv', params: { watch_region: 'FR', sort_by: 'popularity.desc' } },
        { path: '/discover/tv', params: { sort_by: 'vote_count.desc' } },
      ];
}

async function fetchTmdbPage(path: string, params: Record<string, string | number | undefined>): Promise<TmdbPage> {
  const response = await fetch(tmdbUrl(path, params), { next: { revalidate: 1800 } });
  if (!response.ok) {
    throw new Error(`TMDB catalog failed: ${response.status}`);
  }
  return response.json();
}

async function fetchTmdb<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const response = await fetch(tmdbUrl(path, params), { next: { revalidate: 1800 } });
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`);
  }
  return response.json();
}

export async function getCatalogItems(type: CatalogType, options: {
  query?: string;
  limit?: number;
  sort?: string;
}) {
  const limit = Math.min(Math.max(options.limit || 180, 1), 900);
  const maxPagesPerSource = Math.min(Math.ceil(limit / 20) + 4, 45);
  const results: TmdbItem[] = [];
  const seen = new Set<number>();
  const mediaType = type === 'movie' ? 'movie' : 'tv';
  const query = options.query?.trim();

  const addResults = (items: TmdbItem[] = []) => {
    for (const item of items) {
      if (!item.id || seen.has(item.id) || !isAllowedCatalogItem(item)) continue;
      seen.add(item.id);
      results.push(item);
      if (results.length >= limit) break;
    }
  };

  if (query) {
    const searchSources = [
      { path: `/search/${mediaType}`, params: { query } },
      { path: '/search/multi', params: { query } },
    ];
    for (const source of searchSources) {
      for (let page = 1; page <= maxPagesPerSource && results.length < limit; page += 1) {
        const data = await fetchTmdbPage(source.path, { ...source.params, page });
        addResults((data.results || []).filter((item: any) => (
          source.path !== '/search/multi'
          || (type === 'movie' ? item.media_type === 'movie' : item.media_type === 'tv')
        )));
        if (page >= Number(data.total_pages || page)) break;
      }
    }
  } else {
    for (const source of endpointPlan(type, options.sort)) {
      for (let page = 1; page <= maxPagesPerSource && results.length < limit; page += 1) {
        const data = await fetchTmdbPage(source.path, { ...source.params, page });
        addResults(data.results || []);
        if (page >= Number(data.total_pages || page)) break;
      }
    }
  }

  return results
    .filter((item) => Boolean(item.poster_path && (item.title || item.name)))
    .slice(0, limit)
    .map((item, index) => normalizeCatalogItem(item, type, index));
}

export async function getSeriesDetails(tmdbId: string) {
  const details = await fetchTmdb<any>(`/tv/${encodeURIComponent(tmdbId)}`);
  const seasonSummaries = (details.seasons || [])
    .filter((season: TmdbSeasonSummary) => season.season_number > 0 && (season.episode_count || 0) > 0);
  const seasons = await Promise.all(seasonSummaries.map(async (summary: TmdbSeasonSummary) => {
    const season = await fetchTmdb<any>(
      `/tv/${encodeURIComponent(tmdbId)}/season/${summary.season_number}`
    );
    const episodes = ((season.episodes || []) as TmdbEpisode[]).map((episode) => ({
      id: `orion~series~${tmdbId}~s${summary.season_number}e${episode.episode_number}`,
      tmdbId: String(tmdbId),
      type: 'series',
      isEpisode: true,
      season: summary.season_number,
      episode: episode.episode_number,
      name: episode.name || `Episode ${episode.episode_number}`,
      title: episode.name || `Episode ${episode.episode_number}`,
      summary: episode.overview || '',
      poster: imageUrl(episode.still_path, TMDB_BACKDROP) || imageUrl(details.poster_path),
      duration: episode.runtime ? `${episode.runtime} min` : '',
      rating: episode.vote_average ? episode.vote_average.toFixed(1) : '',
      airDate: episode.air_date || '',
      source: 'Orion + TMDB-Embed',
      sourceCode: 'orion',
      provider: 'orion',
      playbackProvider: 'auto',
      playbackProviderName: 'Orion + TMDB-Embed',
      externalPlayback: true,
      streamAvailable: true,
      language: 'fr',
      languageName: 'Francais',
    }));
    return {
      season: summary.season_number,
      name: season.name || summary.name || `Saison ${summary.season_number}`,
      episodeCount: episodes.length || summary.episode_count || 0,
      poster: imageUrl(season.poster_path) || imageUrl(summary.poster_path) || imageUrl(details.poster_path),
      episodes,
    };
  }));

  return {
    id: `orion~series~${tmdbId}`,
    tmdbId: String(tmdbId),
    type: 'series',
    name: details.name || `Serie ${tmdbId}`,
    title: details.name || `Serie ${tmdbId}`,
    summary: details.overview || '',
    categoryName: details.genres?.[0]?.name || 'Series',
    poster: imageUrl(details.poster_path),
    image: imageUrl(details.poster_path),
    backdrop: imageUrl(details.backdrop_path, TMDB_BACKDROP),
    releaseYear: yearFromDate(details.first_air_date),
    seasonCount: seasons.length,
    episodeCount: seasons.reduce((total, season) => total + (season.episodeCount || 0), 0),
    seasons,
    source: 'Orion + TMDB-Embed',
    sourceCode: 'orion',
    provider: 'orion',
    playbackProvider: 'auto',
    playbackProviderName: 'Orion + TMDB-Embed',
    externalPlayback: true,
    streamAvailable: true,
    language: 'fr',
    languageName: 'Francais',
  };
}
