// src/context/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
  const [songs, setSongs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off');
  const [shuffledOrder, setShuffledOrder] = useState([]);
  const [showBackgroundDetail, setShowBackgroundDetail] = useState(false);

  const audioRef           = useRef(new Audio());
  const youtubePlayerRef   = useRef(null);
  const playerTypeRef      = useRef('audio');
  const timeUpdateInterval = useRef(null);

  const currentSong = songs[currentIndex];

  const toggleBackgroundDetail = useCallback(() => {
    setShowBackgroundDetail(prev => !prev);
  }, []);

  const needsYouTubePlayer = useCallback((song) => {
    if (!song) return false;
    const hasYtId = song.youtubeId && /^[A-Za-z0-9_-]{1,}$/.test(song.youtubeId);
    return song.source === 'youtube' || hasYtId;
  }, []);

  const extractYouTubeId = useCallback((url) => {
    if (!url) return null;
    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtu\.be\/([^?]+)/,
      /youtube\.com\/embed\/([^?]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }, []);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  const cleanupYouTube = useCallback(() => {
    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current);
      timeUpdateInterval.current = null;
    }
    if (youtubePlayerRef.current) {
      try { youtubePlayerRef.current.destroy(); } catch (e) { console.warn('YT destroy:', e); }
      youtubePlayerRef.current = null;
    }
  }, []);

  // Song change effect — switch between audio and YouTube player
  useEffect(() => {
    if (!currentSong) {
      if (playerTypeRef.current === 'youtube') cleanupYouTube();
      else { audioRef.current.pause(); audioRef.current.src = ''; }
      return;
    }

    const useYouTube = needsYouTubePlayer(currentSong);
    playerTypeRef.current = useYouTube ? 'youtube' : 'audio';

    if (useYouTube) {
      const videoId = currentSong.youtubeId ||
                      extractYouTubeId(currentSong.streamUrl) ||
                      extractYouTubeId(currentSong.audio);

      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        console.error('Invalid or missing YouTube video ID:', videoId, 'for song:', currentSong?.name);
        setIsPlaying(false);
        return;
      }

      cleanupYouTube();

      let container = document.getElementById('youtube-player-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'youtube-player-container';
        container.style.display = 'none';
        document.body.appendChild(container);
      }

      const initPlayer = () => {
        if (!window.YT || !window.YT.Player) { setTimeout(initPlayer, 100); return; }
        try {
          youtubePlayerRef.current = new window.YT.Player('youtube-player-container', {
            height: '0', width: '0',
            videoId,
            playerVars: {
              autoplay: 1,           // always start buffering; play/pause effect controls actual state
              controls: 0, disablekb: 1, fs: 0,
              iv_load_policy: 3, modestbranding: 1, rel: 0,
              playsinline: 1,        // iOS: prevent fullscreen hijack
            },
            events: {
              onReady: (event) => {
                try { setDuration(event.target.getDuration()); } catch (_) {}
                // Always call playVideo() in onReady — it fires while still in the
                // gesture chain on iOS. The play/pause effect will pause if needed.
                event.target.playVideo();
              },
              onStateChange: (event) => {
                if (event.data === window.YT.PlayerState.ENDED) {
                  if (currentIndex < songs.length - 1) setCurrentIndex(prev => prev + 1);
                  else setIsPlaying(false);
                } else if (event.data === window.YT.PlayerState.PLAYING) {
                  setIsPlaying(true);
                } else if (event.data === window.YT.PlayerState.PAUSED) {
                  setIsPlaying(false);
                }
              },
              onError: (event) => {
                console.error('YouTube player error:', event.data);
                if (songs.length > 0 && currentIndex < songs.length - 1) setCurrentIndex(prev => prev + 1);
                else setIsPlaying(false);
              },
            },
          });
        } catch (ytErr) {
          console.error('YT.Player init failed:', ytErr);
          setIsPlaying(false);
          return;
        }

        if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
        timeUpdateInterval.current = setInterval(() => {
          if (youtubePlayerRef.current?.getCurrentTime) {
            const time = youtubePlayerRef.current.getCurrentTime();
            if (!isNaN(time)) setCurrentTime(time);
          }
        }, 1000);
      };

      initPlayer();
    } else {
      cleanupYouTube();
      const src = currentSong.audio || currentSong.url || currentSong.audioUrl || currentSong.src;
      if (!src) { console.error('No audio source for song:', currentSong); return; }
      audioRef.current.src = src;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.error('Audio play error:', err);
          setIsPlaying(false);
        });
      }
    }
  // ⚠️ isPlaying intentionally NOT in deps — adding it causes the effect to re-run
  // on every play/pause toggle, destroying and recreating the YT player on each tap.
  // Play/pause is handled exclusively by the separate effect below.
  }, [currentSong, currentIndex, songs.length, needsYouTubePlayer, extractYouTubeId, cleanupYouTube]); // eslint-disable-line react-hooks/exhaustive-deps

  // Play/pause effect
  useEffect(() => {
    if (!currentSong) return;
    if (playerTypeRef.current === 'youtube') {
      if (youtubePlayerRef.current?.playVideo) {
        if (isPlaying) youtubePlayerRef.current.playVideo();
        else           youtubePlayerRef.current.pauseVideo();
      }
    } else {
      if (audioRef.current) {
        if (isPlaying) audioRef.current.play().catch(err => { console.error('Play error:', err); setIsPlaying(false); });
        else           audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  // ── Record play to Supabase listening_history ──────────────────────────────
  const { user } = useAuth();
  useEffect(() => {
    if (!currentSong?.youtubeId || !user) return;
    supabase.from('listening_history').insert({
      user_id:    user.id,
      youtube_id: currentSong.youtubeId,
      name:       currentSong.name   || null,
      artist:     currentSong.artist || null,
      genre:      currentSong.genre  || null,
    }).then(({ error }) => {
      if (error) console.warn('[history] insert failed:', error.message);
    });
  }, [currentSong?.id]); // fires once per song change, not on play/pause
  // ──────────────────────────────────────────────────────────────────────────

  // Volume effect
  useEffect(() => {
    if (playerTypeRef.current === 'youtube') {
      if (youtubePlayerRef.current?.setVolume) youtubePlayerRef.current.setVolume(volume * 100);
    } else {
      if (audioRef.current) audioRef.current.volume = volume;
    }
  }, [volume]);

  const toggleMute = useCallback(() => {
    if (playerTypeRef.current === 'youtube') {
      if (youtubePlayerRef.current?.isMuted) {
        const muted = youtubePlayerRef.current.isMuted();
        youtubePlayerRef.current[muted ? 'unMute' : 'mute']();
        setIsMuted(!muted);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.muted = !audioRef.current.muted;
        setIsMuted(audioRef.current.muted);
      }
    }
  }, []);

  // Shuffle order
  useEffect(() => {
    if (shuffle && songs.length > 1) {
      const indices = songs.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const currentIdx = indices.indexOf(currentIndex);
      if (currentIdx > 0) [indices[0], indices[currentIdx]] = [indices[currentIdx], indices[0]];
      setShuffledOrder(indices);
    } else {
      setShuffledOrder([]);
    }
  }, [shuffle, songs, currentIndex]);

  const playNext = useCallback(() => {
    if (!songs.length) return;
    if (repeatMode === 'one') {
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(console.error); }
      return;
    }
    let nextIndex;
    if (shuffle && shuffledOrder.length) {
      const idx = shuffledOrder.indexOf(currentIndex);
      if (idx < shuffledOrder.length - 1) nextIndex = shuffledOrder[idx + 1];
      else if (repeatMode === 'all') nextIndex = shuffledOrder[0];
      else { setIsPlaying(false); return; }
    } else {
      if (currentIndex < songs.length - 1) nextIndex = currentIndex + 1;
      else if (repeatMode === 'all') nextIndex = 0;
      else { setIsPlaying(false); return; }
    }
    setCurrentIndex(nextIndex);
  }, [songs, currentIndex, shuffle, shuffledOrder, repeatMode]);

  const playPrev = useCallback(() => {
    if (!songs.length) return;
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    let prevIndex;
    if (shuffle && shuffledOrder.length) {
      const idx = shuffledOrder.indexOf(currentIndex);
      if (idx > 0) prevIndex = shuffledOrder[idx - 1];
      else if (repeatMode === 'all') prevIndex = shuffledOrder[shuffledOrder.length - 1];
      else prevIndex = 0;
    } else {
      if (currentIndex > 0) prevIndex = currentIndex - 1;
      else if (repeatMode === 'all') prevIndex = songs.length - 1;
      else prevIndex = 0;
    }
    setCurrentIndex(prevIndex);
  }, [songs, currentIndex, shuffle, shuffledOrder, repeatMode]);

  const toggleShuffle     = useCallback(() => setShuffle(prev => !prev), []);
  const toggleRepeatMode  = useCallback(() => {
    setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  }, []);

  // seekTo — works for both audio and YouTube player
  // Exported in context value so LyricsPanel can seek on line click
  const seekTo = useCallback((time) => {
    if (playerTypeRef.current === 'youtube') {
      if (youtubePlayerRef.current?.seekTo) {
        youtubePlayerRef.current.seekTo(time, true);
        setCurrentTime(time);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    }
  }, []);

  const setPlayerSongs = useCallback((newSongsOrUpdater, startIndex = 0) => {
    if (typeof newSongsOrUpdater === 'function') {
      setSongs(newSongsOrUpdater);   // functional updater — don't reset index
    } else {
      setSongs(newSongsOrUpdater);
      setCurrentIndex(startIndex);
    }
  }, []);

  // Audio element event listeners
  useEffect(() => {
    const audio = audioRef.current;

    const handleTimeUpdate     = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded          = () => {
      if (currentIndex < songs.length - 1) setCurrentIndex(prev => prev + 1);
      else setIsPlaying(false);
    };
    const handleError = () => {
      console.error('Audio error:', audio.error);
      if (songs.length > 0 && currentIndex < songs.length - 1) setCurrentIndex(prev => prev + 1);
      else setIsPlaying(false);
    };

    audio.addEventListener('timeupdate',     handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended',          handleEnded);
    audio.addEventListener('error',          handleError);

    return () => {
      audio.removeEventListener('timeupdate',     handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended',          handleEnded);
      audio.removeEventListener('error',          handleError);
    };
  }, [songs.length, currentIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupYouTube();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    };
  }, [cleanupYouTube]);

  const value = {
    songs,
    setPlayerSongs,
    currentIndex,
    setCurrentIndex,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    audioRef,
    currentSong,
    downloadedSongs,
    setDownloadedSongs,
    seekTo,                    // ← used by LyricsPanel for click-to-seek
    playerType: playerTypeRef.current,
    playNext,
    playPrev,
    shuffle,
    toggleShuffle,
    repeatMode,
    toggleRepeatMode,
    toggleMute,
    isMuted,
    showBackgroundDetail,
    setShowBackgroundDetail,
    toggleBackgroundDetail,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
}