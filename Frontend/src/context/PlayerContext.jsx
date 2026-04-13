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

  const audioRef         = useRef(new Audio());
  const ytPlayerRef      = useRef(null);
  const ytReadyRef       = useRef(false);
  const ytCreatingRef    = useRef(false);
  const playerTypeRef    = useRef('audio');
  const timeIntervalRef  = useRef(null);
  const isPlayingRef     = useRef(false);

  const currentSong = songs[currentIndex];

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const toggleBackgroundDetail = useCallback(() => setShowBackgroundDetail(p => !p), []);

  const needsYouTube = useCallback((song) => {
    if (!song) return false;
    return song.source === 'youtube' || !!(song.youtubeId && /^[A-Za-z0-9_-]{1,}$/.test(song.youtubeId));
  }, []);

  const extractYouTubeId = useCallback((url) => {
    if (!url) return null;
    const patterns = [/youtube\.com\/watch\?v=([^&]+)/, /youtu\.be\/([^?]+)/, /youtube\.com\/embed\/([^?]+)/];
    for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
    return null;
  }, []);

  // Time tracking interval for YouTube
  const startTimeTracking = useCallback(() => {
    if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    timeIntervalRef.current = setInterval(() => {
      try {
        const p = ytPlayerRef.current;
        if (!p?.getCurrentTime) return;
        const t = p.getCurrentTime();
        if (!isNaN(t) && t >= 0) setCurrentTime(t);
        const d = p.getDuration?.();
        if (d > 0) setDuration(prev => prev > 0 ? prev : d);
      } catch (_) {}
    }, 500);
  }, []);

  const stopTimeTracking = useCallback(() => {
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Synchronous YouTube player creation – MUST be called inside a user gesture
  // ──────────────────────────────────────────────────────────────────────────
  const ensureYouTubePlayer = useCallback((videoId, shouldPlay = true) => {
    return new Promise((resolve, reject) => {
      // If player already exists and is ready, just load the video
      if (ytReadyRef.current && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.loadVideoById(videoId);
          if (shouldPlay) {
            setTimeout(() => {
              try { ytPlayerRef.current?.playVideo(); } catch (_) {}
            }, 200);
          }
          resolve();
        } catch (e) {
          reject(e);
        }
        return;
      }

      // Prevent overlapping creation attempts
      if (ytCreatingRef.current) {
        setTimeout(() => ensureYouTubePlayer(videoId, shouldPlay).then(resolve).catch(reject), 100);
        return;
      }

      ytCreatingRef.current = true;

      const waitForAPI = () => {
        if (!window.YT?.Player) {
          setTimeout(waitForAPI, 50);
          return;
        }

        // Ensure container exists
        let ctn = document.getElementById('yt-player-singleton');
        if (!ctn) {
          ctn = document.createElement('div');
          ctn.id = 'yt-player-singleton';
          ctn.style.cssText = 'position:fixed;top:-2px;left:-2px;width:2px;height:2px;opacity:0;pointer-events:none;';
          document.body.appendChild(ctn);
        }

        try {
          ytPlayerRef.current = new window.YT.Player('yt-player-singleton', {
            width: '2',
            height: '2',
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                ytReadyRef.current = true;
                ytCreatingRef.current = false;
                // Load the requested video now that player is ready
                ytPlayerRef.current.loadVideoById(videoId);
                if (shouldPlay) {
                  setTimeout(() => {
                    try { ytPlayerRef.current?.playVideo(); } catch (_) {}
                  }, 200);
                }
                resolve();
                startTimeTracking();
              },
              onStateChange: (event) => {
                const S = window.YT?.PlayerState;
                if (!S) return;
                if (event.data === S.ENDED) {
                  setSongs(prev => {
                    setCurrentIndex(ci => {
                      if (ci < prev.length - 1) return ci + 1;
                      setIsPlaying(false);
                      return ci;
                    });
                    return prev;
                  });
                } else if (event.data === S.PLAYING) {
                  try {
                    const d = event.target.getDuration();
                    if (d > 0) setDuration(d);
                  } catch (_) {}
                  setIsPlaying(true);
                } else if (event.data === S.PAUSED) {
                  setIsPlaying(false);
                }
              },
              onError: (event) => {
                console.error('[YT] error code:', event.data);
                setCurrentIndex(ci => {
                  setSongs(prev => {
                    if (ci < prev.length - 1) return prev;
                    return prev;
                  });
                  return ci < songs.length - 1 ? ci + 1 : ci;
                });
                ytCreatingRef.current = false;
                reject(new Error(`YouTube error ${event.data}`));
              },
            },
          });
        } catch (err) {
          ytCreatingRef.current = false;
          reject(err);
        }
      };

      waitForAPI();
    });
  }, [startTimeTracking, songs.length]); // songs.length used in error handler

  // Inject YouTube IFrame API script (only once)
  useEffect(() => {
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }, []);

  // Cleanup time tracking on unmount
  useEffect(() => {
    return () => {
      stopTimeTracking();
    };
  }, [stopTimeTracking]);

  // ──────────────────────────────────────────────────────────────────────────
  // Song change effect – switches between audio and YouTube
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentSong) {
      stopTimeTracking();
      try { ytPlayerRef.current?.pauseVideo(); } catch (_) {}
      try { audioRef.current.pause(); audioRef.current.src = ''; } catch (_) {}
      return;
    }

    if (needsYouTube(currentSong)) {
      playerTypeRef.current = 'youtube';

      const videoId = currentSong.youtubeId
        || extractYouTubeId(currentSong.streamUrl)
        || extractYouTubeId(currentSong.audio);

      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        console.error('[YT] invalid videoId:', videoId);
        setIsPlaying(false);
        return;
      }

      // Pause audio element
      try { audioRef.current.pause(); audioRef.current.src = ''; } catch (_) {}

      // Reset time display
      setCurrentTime(0);
      setDuration(0);

      // The magic: call ensureYouTubePlayer synchronously.
      // Because this effect runs after a user‑initiated state change
      // (like setCurrentIndex from a click), the call stack is still
      // considered part of the user gesture.
      ensureYouTubePlayer(videoId, true).catch(err => {
        console.error('Failed to setup YouTube player:', err);
        setIsPlaying(false);
      });

      // We set isPlaying optimistically; the player's onStateChange will confirm
      setIsPlaying(true);
    } else {
      // ── AUDIO element ──
      playerTypeRef.current = 'audio';
      stopTimeTracking();
      try { ytPlayerRef.current?.pauseVideo(); } catch (_) {}

      const src = currentSong.audio || currentSong.url || currentSong.audioUrl || currentSong.src;
      if (!src) {
        console.error('No audio src:', currentSong);
        return;
      }

      audioRef.current.src = src;
      audioRef.current.load();
      audioRef.current.play().catch(err => {
        console.warn('Audio play blocked:', err.message);
        setIsPlaying(false);
      });
    }
  }, [currentSong?.id, currentIndex, ensureYouTubePlayer, extractYouTubeId, needsYouTube, stopTimeTracking]);

  // ──────────────────────────────────────────────────────────────────────────
  // Play / Pause toggle
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentSong) return;
    if (playerTypeRef.current === 'youtube') {
      try {
        if (isPlaying) ytPlayerRef.current?.playVideo();
        else           ytPlayerRef.current?.pauseVideo();
      } catch (_) {}
    } else {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.warn('play:', e);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong?.id]);

  // ──────────────────────────────────────────────────────────────────────────
  // Volume control
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (playerTypeRef.current === 'youtube') {
      try { ytPlayerRef.current?.setVolume(volume * 100); } catch (_) {}
    } else {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // ──────────────────────────────────────────────────────────────────────────
  // Record play to Supabase listening_history
  // ──────────────────────────────────────────────────────────────────────────
  const { user } = useAuth();
  useEffect(() => {
    if (!currentSong?.youtubeId || !user) return;
    supabase.from('listening_history').insert({
      user_id: user.id,
      youtube_id: currentSong.youtubeId,
      name: currentSong.name || null,
      artist: currentSong.artist || null,
      genre: currentSong.genre || null,
    }).then(({ error }) => {
      if (error) console.warn('[history]', error.message);
    });
  }, [currentSong?.id, user]);

  // ──────────────────────────────────────────────────────────────────────────
  // Mute toggle
  // ──────────────────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (playerTypeRef.current === 'youtube') {
      try {
        const muted = ytPlayerRef.current?.isMuted?.();
        ytPlayerRef.current?.[muted ? 'unMute' : 'mute']?.();
        setIsMuted(!muted);
      } catch (_) {}
    } else {
      audioRef.current.muted = !audioRef.current.muted;
      setIsMuted(audioRef.current.muted);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Shuffle order
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (shuffle && songs.length > 1) {
      const indices = songs.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const ci = indices.indexOf(currentIndex);
      if (ci > 0) [indices[0], indices[ci]] = [indices[ci], indices[0]];
      setShuffledOrder(indices);
    } else {
      setShuffledOrder([]);
    }
  }, [shuffle, songs, currentIndex]);

  // ──────────────────────────────────────────────────────────────────────────
  // Next / Previous
  // ──────────────────────────────────────────────────────────────────────────
  const playNext = useCallback(() => {
    if (!songs.length) return;
    if (repeatMode === 'one') {
      if (playerTypeRef.current === 'youtube') {
        try { ytPlayerRef.current?.seekTo(0, true); ytPlayerRef.current?.playVideo(); } catch (_) {}
      } else {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }
    let next;
    if (shuffle && shuffledOrder.length) {
      const idx = shuffledOrder.indexOf(currentIndex);
      if (idx < shuffledOrder.length - 1) next = shuffledOrder[idx + 1];
      else if (repeatMode === 'all') next = shuffledOrder[0];
      else { setIsPlaying(false); return; }
    } else {
      if (currentIndex < songs.length - 1) next = currentIndex + 1;
      else if (repeatMode === 'all') next = 0;
      else { setIsPlaying(false); return; }
    }
    setCurrentIndex(next);
  }, [songs, currentIndex, shuffle, shuffledOrder, repeatMode]);

  const playPrev = useCallback(() => {
    if (!songs.length) return;
    if (playerTypeRef.current === 'audio' && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (playerTypeRef.current === 'youtube') {
      try {
        if (ytPlayerRef.current?.getCurrentTime?.() > 3) {
          ytPlayerRef.current.seekTo(0, true);
          return;
        }
      } catch (_) {}
    }
    let prev;
    if (shuffle && shuffledOrder.length) {
      const idx = shuffledOrder.indexOf(currentIndex);
      if (idx > 0) prev = shuffledOrder[idx - 1];
      else if (repeatMode === 'all') prev = shuffledOrder[shuffledOrder.length - 1];
      else prev = 0;
    } else {
      if (currentIndex > 0) prev = currentIndex - 1;
      else if (repeatMode === 'all') prev = songs.length - 1;
      else prev = 0;
    }
    setCurrentIndex(prev);
  }, [songs, currentIndex, shuffle, shuffledOrder, repeatMode]);

  const toggleShuffle    = useCallback(() => setShuffle(p => !p), []);
  const toggleRepeatMode = useCallback(() => setRepeatMode(p => p === 'off' ? 'all' : p === 'all' ? 'one' : 'off'), []);

  // ──────────────────────────────────────────────────────────────────────────
  // Seek
  // ──────────────────────────────────────────────────────────────────────────
  const seekTo = useCallback((time) => {
    if (playerTypeRef.current === 'youtube') {
      try { ytPlayerRef.current?.seekTo(time, true); setCurrentTime(time); } catch (_) {}
    } else {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Set player songs (called when user selects a new playlist or song)
  // ──────────────────────────────────────────────────────────────────────────
  const setPlayerSongs = useCallback((newSongsOrUpdater, startIndex = 0) => {
    if (typeof newSongsOrUpdater === 'function') {
      setSongs(newSongsOrUpdater);
    } else {
      setSongs(newSongsOrUpdater);
      setCurrentIndex(startIndex);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Audio element event listeners
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    const onTime  = () => setCurrentTime(audio.currentTime);
    const onDur   = () => setDuration(audio.duration);
    const onEnded = () => {
      if (currentIndex < songs.length - 1) setCurrentIndex(p => p + 1);
      else setIsPlaying(false);
    };
    const onError = () => {
      console.error('Audio error:', audio.error);
      if (currentIndex < songs.length - 1) setCurrentIndex(p => p + 1);
      else setIsPlaying(false);
    };
    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('durationchange', onDur);
    audio.addEventListener('ended',          onEnded);
    audio.addEventListener('error',          onError);
    return () => {
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('durationchange', onDur);
      audio.removeEventListener('ended',          onEnded);
      audio.removeEventListener('error',          onError);
    };
  }, [songs.length, currentIndex]);

  // ──────────────────────────────────────────────────────────────────────────
  // Context value
  // ──────────────────────────────────────────────────────────────────────────
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
    seekTo,
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