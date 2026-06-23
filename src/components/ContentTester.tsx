'use client';

import { useState } from 'react';
import VideoPlayer from './VideoPlayer';

interface ContentSource {
  ok: boolean;
  titre?: string;
  annee?: string;
  saison?: number;
  episode?: number;
  erreur?: string;
  hosters?: Array<{
    nom: string;
    lang: string;
    embedUrl: string | null;
    m3u8: string | null;
    proxyM3U8: string | null;
    proxyTS: string | null;
    source: string;
  }>;
}

const EXEMPLES_FILMS = [
  { id: '299534', titre: 'Avengers: Endgame' },
  { id: '603', titre: 'The Matrix' },
  { id: '550', titre: 'Fight Club' },
];

const EXEMPLES_SERIES = [
  { id: '1396', season: '1', episode: '1', titre: 'Breaking Bad S1E1' },
  { id: '1399', season: '1', episode: '1', titre: 'Game of Thrones S1E1' },
  { id: '66732', season: '1', episode: '1', titre: 'Stranger Things S1E1' },
];

export default function ContentTester() {
  const [type, setType] = useState<'movie' | 'series'>('movie');
  const [provider, setProvider] = useState<'orion' | 'aether' | 'pulsar'>('orion');
  const [tmdbId, setTmdbId] = useState('299534');
  const [season, setSeason] = useState('1');
  const [episode, setEpisode] = useState('1');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ContentSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testContent = async () => {
    if (!tmdbId.trim()) {
      setError('Veuillez entrer un TMDB ID');
      return;
    }

    if (type === 'series' && (!season.trim() || !episode.trim())) {
      setError('Veuillez entrer saison et épisode');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      let url = '';
      
      if (type === 'movie') {
        url = `/api/sources/movie/${tmdbId.trim()}?provider=${provider}`;
      } else {
        // Séries uniquement avec ORION pour l'instant
        if (provider !== 'orion') {
          setError('Les séries ne sont disponibles qu\'avec ORION');
          setLoading(false);
          return;
        }
        url = `/api/sources/series/${tmdbId.trim()}/${season.trim()}/${episode.trim()}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (json.ok) {
        setData(json);
      } else {
        setError(json.erreur || 'Erreur inconnue');
      }
    } catch (err: any) {
      setError('Erreur réseau: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sélection type */}
      <div className="bg-black/30 rounded-lg p-6 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">🧪 Tester l&apos;API</h2>

        {/* Type */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => {
              setType('movie');
              setTmdbId('299534');
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              type === 'movie'
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            🎬 Films
          </button>
          <button
            onClick={() => {
              setType('series');
              setTmdbId('1396');
              setProvider('orion'); // Forcer ORION pour les séries
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              type === 'series'
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            📺 Séries
          </button>
        </div>

        {/* Provider (uniquement pour films) */}
        {type === 'movie' && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Lecteur :</p>
            <div className="flex gap-2">
              <button
                onClick={() => setProvider('orion')}
                className={`flex-1 px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                  provider === 'orion'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }`}
              >
                🌟 ORION
              </button>
              <button
                onClick={() => setProvider('aether')}
                className={`flex-1 px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                  provider === 'aether'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }`}
              >
                🔮 AETHER
              </button>
              <button
                onClick={() => setProvider('pulsar')}
                disabled
                className="flex-1 px-3 py-2 rounded-lg font-semibold text-sm bg-gray-800 text-gray-600 cursor-not-allowed"
              >
                ⚡ PULSAR <span className="text-xs">(bientôt)</span>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            value={tmdbId}
            onChange={(e) => setTmdbId(e.target.value)}
            placeholder="TMDB ID"
            className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
            onKeyDown={(e) => e.key === 'Enter' && testContent()}
          />

          {type === 'series' && (
            <div className="flex gap-3">
              <input
                type="text"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                placeholder="Saison"
                className="flex-1 px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                value={episode}
                onChange={(e) => setEpisode(e.target.value)}
                placeholder="Épisode"
                className="flex-1 px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          <button
            onClick={testContent}
            disabled={loading}
            className={`w-full px-6 py-3 rounded-lg font-semibold transition-all ${
              loading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
            } text-white`}
          >
            {loading ? '⏳ Scraping...' : '🚀 Tester'}
          </button>
        </div>

        {/* Exemples */}
        <div className="mt-4 space-y-2">
          <p className="text-xs text-gray-400">Exemples :</p>
          {type === 'movie' ? (
            <div className="flex flex-wrap gap-2">
              {EXEMPLES_FILMS.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => setTmdbId(ex.id)}
                  className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-full text-gray-300 hover:text-white transition-colors"
                >
                  {ex.titre}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {EXEMPLES_SERIES.map((ex) => (
                <button
                  key={`${ex.id}-${ex.season}-${ex.episode}`}
                  onClick={() => {
                    setTmdbId(ex.id);
                    setSeason(ex.season);
                    setEpisode(ex.episode);
                  }}
                  className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-full text-gray-300 hover:text-white transition-colors"
                >
                  {ex.titre}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-3 text-yellow-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-400"></div>
            <span className="text-sm">Scraping en cours... (10-20 secondes)</span>
          </div>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">❌ {error}</p>
        </div>
      )}

      {/* Résultat */}
      {data && data.ok && (
        <div className="space-y-4">
          <div className="bg-black/30 rounded-lg p-4 border border-green-500/30">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  ✅ {data.titre}
                  {data.saison && data.episode && ` S${data.saison}E${data.episode}`}
                </h3>
                {data.annee && <p className="text-gray-400 text-sm">Année: {data.annee}</p>}
              </div>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">
                Disponible
              </span>
            </div>

            {data.hosters && data.hosters.length > 0 && (
              <div className="mt-4 space-y-2">
                {data.hosters.map((hoster, i) => (
                  <div key={i} className="bg-black/30 rounded p-3 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-purple-400 font-semibold">{hoster.nom}</span>
                      <span className="text-xs text-gray-400">({hoster.lang})</span>
                    </div>
                    <div className="text-xs space-y-1 text-gray-400 font-mono">
                      <div className="flex gap-2">
                        <span className="text-gray-500">Embed:</span>
                        <span className={hoster.embedUrl ? 'text-green-400' : 'text-red-400'}>
                          {hoster.embedUrl ? '✓' : '✗'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500">M3U8:</span>
                        <span className={hoster.m3u8 ? 'text-green-400' : 'text-red-400'}>
                          {hoster.m3u8 ? '✓' : '✗'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Player */}
          {data.hosters?.[0] && (data.hosters[0].proxyM3U8 || data.hosters[0].embedUrl) && (
            <div className="bg-black/30 rounded-lg p-4 border border-purple-500/30">
              <h3 className="text-lg font-bold text-white mb-3">🎬 Lecteur Vidéo</h3>
              <VideoPlayer
                m3u8Url={data.hosters[0].proxyM3U8}
                embedUrl={data.hosters[0].embedUrl}
                title={`${data.titre}${data.saison && data.episode ? ` S${data.saison}E${data.episode}` : ''}`}
              />
            </div>
          )}

          {/* JSON */}
          <details className="bg-black/30 rounded-lg border border-white/10">
            <summary className="px-4 py-3 cursor-pointer text-white font-semibold hover:bg-white/5">
              📄 Voir JSON complet
            </summary>
            <pre className="p-4 text-xs text-gray-300 overflow-auto max-h-96">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {data && !data.ok && !error && (
        <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
          <p className="text-yellow-400">⚠️ {data.erreur || 'Aucune source trouvée'}</p>
        </div>
      )}
    </div>
  );
}
