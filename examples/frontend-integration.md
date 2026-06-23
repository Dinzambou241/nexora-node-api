# 📱 Intégration Front-end

## React / Next.js

### Hook personnalisé

```typescript
// hooks/useMovieSource.ts
import { useState, useEffect } from 'react';

interface MovieSource {
  ok: boolean;
  titre?: string;
  annee?: string;
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

export function useMovieSource(tmdbId: string) {
  const [data, setData] = useState<MovieSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSource() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/sources/movie/${tmdbId}`);
        const json = await res.json();

        if (!cancelled) {
          if (json.ok) {
            setData(json);
          } else {
            setError(json.erreur || 'Erreur inconnue');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError('Erreur réseau');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchSource();

    return () => {
      cancelled = true;
    };
  }, [tmdbId]);

  return { data, loading, error };
}
```

### Composant Player

```typescript
// components/MoviePlayer.tsx
'use client';

import { useMovieSource } from '@/hooks/useMovieSource';
import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

interface MoviePlayerProps {
  tmdbId: string;
}

export function MoviePlayer({ tmdbId }: MoviePlayerProps) {
  const { data, loading, error } = useMovieSource(tmdbId);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!data?.hosters?.[0]?.proxyM3U8 || !videoRef.current) return;

    const m3u8Url = data.hosters[0].proxyM3U8;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari natif
      video.src = m3u8Url;
      video.play().catch(() => {});
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
        <p className="text-red-500">❌ {error}</p>
      </div>
    );
  }

  if (!data?.hosters?.[0]?.proxyM3U8) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
        <p className="text-yellow-500">⚠️ Aucune source disponible</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        playsInline
      />
    </div>
  );
}
```

### Page film

```typescript
// app/movie/[tmdbId]/page.tsx
import { MoviePlayer } from '@/components/MoviePlayer';

export default function MoviePage({ params }: { params: { tmdbId: string } }) {
  return (
    <main className="container mx-auto px-4 py-8">
      <MoviePlayer tmdbId={params.tmdbId} />
    </main>
  );
}
```

## Vanilla JavaScript

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Orion Player</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
  <video id="player" controls style="width: 100%; max-width: 800px;"></video>

  <script>
    const tmdbId = '299534'; // Avengers Endgame
    const apiUrl = 'http://localhost:3000';

    async function loadMovie() {
      try {
        const res = await fetch(`${apiUrl}/api/sources/movie/${tmdbId}`);
        const data = await res.json();

        if (!data.ok || !data.hosters?.[0]?.proxyM3U8) {
          alert('Film non disponible');
          return;
        }

        const m3u8Url = apiUrl + data.hosters[0].proxyM3U8;
        const video = document.getElementById('player');

        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(m3u8Url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play();
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = m3u8Url;
          video.play();
        }
      } catch (err) {
        console.error('Erreur:', err);
        alert('Erreur de chargement');
      }
    }

    loadMovie();
  </script>
</body>
</html>
```

## Vue.js

```vue
<template>
  <div class="movie-player">
    <div v-if="loading" class="loading">
      Chargement...
    </div>

    <div v-else-if="error" class="error">
      ❌ {{ error }}
    </div>

    <video
      v-else
      ref="videoEl"
      controls
      class="player"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import Hls from 'hls.js';

const props = defineProps({
  tmdbId: {
    type: String,
    required: true,
  },
});

const videoEl = ref(null);
const loading = ref(true);
const error = ref(null);
const data = ref(null);

async function fetchSource() {
  loading.value = true;
  error.value = null;

  try {
    const res = await fetch(`/api/sources/movie/${props.tmdbId}`);
    const json = await res.json();

    if (json.ok) {
      data.value = json;
      setupPlayer();
    } else {
      error.value = json.erreur || 'Erreur inconnue';
    }
  } catch (err) {
    error.value = 'Erreur réseau';
  } finally {
    loading.value = false;
  }
}

function setupPlayer() {
  if (!data.value?.hosters?.[0]?.proxyM3U8 || !videoEl.value) return;

  const m3u8Url = data.value.hosters[0].proxyM3U8;

  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(m3u8Url);
    hls.attachMedia(videoEl.value);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoEl.value.play();
    });
  } else if (videoEl.value.canPlayType('application/vnd.apple.mpegurl')) {
    videoEl.value.src = m3u8Url;
    videoEl.value.play();
  }
}

onMounted(() => {
  fetchSource();
});

watch(() => props.tmdbId, () => {
  fetchSource();
});
</script>

<style scoped>
.player {
  width: 100%;
  max-width: 800px;
}

.loading, .error {
  padding: 2rem;
  text-align: center;
}
</style>
```

## Android (Kotlin)

```kotlin
// MovieRepository.kt
import retrofit2.http.GET
import retrofit2.http.Path

data class MovieSource(
    val ok: Boolean,
    val titre: String?,
    val annee: String?,
    val erreur: String?,
    val hosters: List<Hoster>?
)

data class Hoster(
    val nom: String,
    val lang: String,
    val proxyM3U8: String?,
    val source: String
)

interface OrionApi {
    @GET("api/sources/movie/{tmdbId}")
    suspend fun getMovieSource(@Path("tmdbId") tmdbId: String): MovieSource
}

// ExoPlayer setup
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.source.hls.HlsMediaSource

class MoviePlayerActivity : AppCompatActivity() {
    private lateinit var player: ExoPlayer

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        player = ExoPlayer.Builder(this).build()
        playerView.player = player

        lifecycleScope.launch {
            val source = api.getMovieSource("299534")
            if (source.ok && source.hosters?.isNotEmpty() == true) {
                val m3u8Url = "https://your-api.com${source.hosters[0].proxyM3U8}"
                val mediaItem = MediaItem.fromUri(m3u8Url)
                player.setMediaItem(mediaItem)
                player.prepare()
                player.play()
            }
        }
    }
}
```

## iOS (Swift)

```swift
// MovieSource.swift
struct MovieSource: Codable {
    let ok: Bool
    let titre: String?
    let annee: String?
    let erreur: String?
    let hosters: [Hoster]?
}

struct Hoster: Codable {
    let nom: String
    let lang: String
    let proxyM3U8: String?
    let source: String
}

// PlayerViewController.swift
import AVKit
import AVFoundation

class PlayerViewController: UIViewController {
    var player: AVPlayer?
    
    func loadMovie(tmdbId: String) {
        let url = URL(string: "https://your-api.com/api/sources/movie/\(tmdbId)")!
        
        URLSession.shared.dataTask(with: url) { data, response, error in
            guard let data = data else { return }
            
            let decoder = JSONDecoder()
            if let source = try? decoder.decode(MovieSource.self, from: data),
               source.ok,
               let m3u8Path = source.hosters?.first?.proxyM3U8 {
                
                let streamUrl = URL(string: "https://your-api.com\(m3u8Path)")!
                
                DispatchQueue.main.async {
                    self.player = AVPlayer(url: streamUrl)
                    let playerViewController = AVPlayerViewController()
                    playerViewController.player = self.player
                    self.present(playerViewController, animated: true) {
                        self.player?.play()
                    }
                }
            }
        }.resume()
    }
}
```

## Notes importantes

1. **HLS.js** : Nécessaire pour la lecture HLS sur navigateurs non-Safari
2. **CORS** : L'API répond avec `Access-Control-Allow-Origin: *`
3. **Cache** : Les sources sont cachées 30min côté serveur
4. **Erreurs** : Toujours vérifier `data.ok` avant d'utiliser les sources
5. **Tokens** : Les M3U8 peuvent expirer, gérez les erreurs 403/404
