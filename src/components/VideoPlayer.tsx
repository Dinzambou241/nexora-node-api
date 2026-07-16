'use client';

import { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  m3u8Url?: string | null;
  embedUrl?: string | null;
  title?: string;
}

type SourceType = 'matrix-x' | 'matrix-y';

export default function VideoPlayer({ m3u8Url, embedUrl, title }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceType>(
    () => (m3u8Url ? 'matrix-x' : 'matrix-y')
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hlsError, setHlsError] = useState<string | null>(null);

  // Déterminer la source initiale (M3U8 en priorité)
  useEffect(() => {
    const nextSource = m3u8Url ? 'matrix-x' : embedUrl ? 'matrix-y' : null;
    if (!nextSource) return;
    const timer = window.setTimeout(() => setSelectedSource(nextSource), 0);
    return () => window.clearTimeout(timer);
  }, [m3u8Url, embedUrl]);

  // Charger la source M3U8 (MATRIX X)
  useEffect(() => {
    if (selectedSource !== 'matrix-x' || !m3u8Url || !videoRef.current) return;

    const video = videoRef.current;

    if (Hls.isSupported()) {
      // Nettoyer l'instance précédente
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        debug: false,
        enableWorker: true,
        // Films et séries = VOD : conserver un buffer plus stable plutôt
        // que de privilégier la faible latence du direct.
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 45,
        maxBufferSize: 60 * 1000 * 1000,
        capLevelToPlayerSize: true,
        startLevel: -1,
        abrEwmaFastVoD: 3,
        abrEwmaSlowVoD: 9,
      });

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ M3U8 (MATRIX X) chargé !');
        setHlsError(null);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('❌ HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setHlsError('Erreur réseau - Essayez MATRIX Y');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setHlsError('Erreur média - Récupération...');
              hls.recoverMediaError();
              break;
            default:
              setHlsError('Erreur fatale - Utilisez MATRIX Y');
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari natif
      video.src = m3u8Url;
    }
  }, [selectedSource, m3u8Url]);

  // Mettre à jour les infos de lecture
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let lastTimeUpdate = 0;
    const updateTime = () => {
      const now = performance.now();
      if (now - lastTimeUpdate < 250) return;
      lastTimeUpdate = now;
      setCurrentTime(video.currentTime);
    };
    const updateDuration = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('durationchange', updateDuration);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('durationchange', updateDuration);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const vol = parseFloat(e.target.value);
    video.volume = vol / 100;
    setVolume(vol);
  };

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSourceChange = (source: SourceType) => {
    setSelectedSource(source);
    setHlsError(null);
  };

  const hasMatrixX = !!m3u8Url;
  const hasMatrixY = !!embedUrl;

  if (!hasMatrixX && !hasMatrixY) {
    return (
      <div className="bg-black/50 rounded-lg p-8 text-center">
        <p className="text-gray-400">❌ Aucune source disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur de source */}
      <div className="flex gap-3 items-center bg-black/30 rounded-lg p-3 border border-white/10">
        <span className="text-sm text-gray-400 font-semibold">Source :</span>
        <button
          onClick={() => handleSourceChange('matrix-x')}
          disabled={!hasMatrixX}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            selectedSource === 'matrix-x'
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
              : hasMatrixX
              ? 'bg-white/10 text-gray-300 hover:bg-white/20'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className={selectedSource === 'matrix-x' ? 'animate-pulse' : ''}>●</span>
            MATRIX X
            {hasMatrixX && <span className="text-xs opacity-75">(M3U8)</span>}
          </span>
        </button>
        <button
          onClick={() => handleSourceChange('matrix-y')}
          disabled={!hasMatrixY}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            selectedSource === 'matrix-y'
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
              : hasMatrixY
              ? 'bg-white/10 text-gray-300 hover:bg-white/20'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className={selectedSource === 'matrix-y' ? 'animate-pulse' : ''}>●</span>
            MATRIX Y
            {hasMatrixY && <span className="text-xs opacity-75">(Embed)</span>}
          </span>
        </button>
      </div>

      {/* Erreur HLS */}
      {hlsError && selectedSource === 'matrix-x' && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3">
          <p className="text-red-400 text-sm">⚠️ {hlsError}</p>
        </div>
      )}

      {/* Player */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl border border-white/10">
        {selectedSource === 'matrix-x' && hasMatrixX ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full"
              playsInline
              onClick={togglePlay}
            />

            {/* Contrôles personnalisés */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 space-y-3">
              {/* Barre de progression */}
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:cursor-pointer"
              />

              <div className="flex items-center justify-between gap-4">
                {/* Lecture / Pause */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                  >
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <span className="text-white text-sm font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm">🔊</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <span className="text-white text-xs w-8">{volume}%</span>
                </div>

                {/* Plein écran */}
                <button
                  onClick={toggleFullscreen}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                >
                  {isFullscreen ? '⊡' : '⛶'}
                </button>
              </div>
            </div>

            {/* Overlay titre */}
            {title && (
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4">
                <h3 className="text-white font-semibold drop-shadow-lg">{title}</h3>
              </div>
            )}
          </>
        ) : selectedSource === 'matrix-y' && hasMatrixY ? (
          <iframe
            ref={iframeRef}
            src={embedUrl || ''}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture"
          />
        ) : null}
      </div>

      {/* Info source */}
      <div className="text-center text-xs text-gray-400">
        {selectedSource === 'matrix-x' && (
          <p>
            ✨ MATRIX X : Lecteur vidéo direct (M3U8/HLS) - Qualité optimale
          </p>
        )}
        {selectedSource === 'matrix-y' && (
          <p>
            🌐 MATRIX Y : Lecteur embed (iframe) - Fallback si MATRIX X ne marche pas
          </p>
        )}
      </div>
    </div>
  );
}
