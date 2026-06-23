import { CONFIG } from './config';

const TMDB_KEY = CONFIG.TMDB_API_KEY;

export interface TmdbInfo {
  titre_fr: string;
  titre_original: string;
  annee: string;
}

export async function getTmdbInfo(tmdbId: string): Promise<TmdbInfo> {
  try {
    const r = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}&language=fr-FR`
    );
    
    if (!r.ok) {
      return {
        titre_fr: `Film ${tmdbId}`,
        titre_original: '',
        annee: '',
      };
    }

    const d = await r.json();
    
    if (d.status_code) {
      return {
        titre_fr: `Film ${tmdbId}`,
        titre_original: '',
        annee: '',
      };
    }

    return {
      titre_fr: d.title || d.name || `Film ${tmdbId}`,
      titre_original: d.original_title || d.original_name || '',
      annee: (d.release_date || '').slice(0, 4) || '',
    };
  } catch (e) {
    return {
      titre_fr: `Film ${tmdbId}`,
      titre_original: '',
      annee: '',
    };
  }
}
