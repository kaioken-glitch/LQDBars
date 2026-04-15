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
  const isChangingSongRef = useRef(false); // Prevents overlapping song changes
  const pendingPlayRef    = useRef(false); // Whether we should play after loading

  const currentSong = songs[currentIndex];

  const toggleBackgroundDetail = useCallback(() => setShowBackgroundDetail(prev => !prev), []);

  const needsYouTube = useCallback((song) => {
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
  const ensureYouTubePlayer = useCallback((videoId) => {
    return new Promise((resolve, reject) => {
      // Player already ready → just load the new video
      if (ytReadyRef.current && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.loadVideoById(videoId);
          // loadVideoById starts buffering; we'll let the play/pause effect handle actual playback
          resolve();
        } catch (e) {
          reject(e);
        }
        return;
      }

      // Avoid concurrent creation
      if (ytCreatingRef.current) {
        setTimeout(() => ensureYouTubePlayer(videoId).then(resolve).catch(reject), 100);
        return;
      }

      ytCreatingRef.current = true;

      const waitForAPI = () => {
        if (!window.YT?.Player) {
          setTimeout(waitForAPI, 50);
          return;
        }

        let container = document.getElementById('yt-player-singleton');
        if (!container) {
          container = document.createElement('div');
          container.id = 'yt-player-singleton';
          container.style.cssText = 'position:fixed;top:-2px;left:-2px;width:2px;height:2px;opacity:0;pointer-events:none;';
          document.body.appendChild(container);
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
                resolve();
                startTimeTracking();
              },
              onStateChange: (event) => {
                const S = window.YT?.PlayerState;
                if (!S) return;

                if (event.data === S.ENDED) {
                  // Auto‑advance to next song (allowed in ended callback)
                  if (!isChangingSongRef.current) {
                    playNext();
                  }
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
                if (!isChangingSongRef.current) {
                  playNext();
                }
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
  }, [startTimeTracking, playNext]); // playNext is defined later, but we can move it up or add to deps

  // Inject YouTube IFrame API script
  useEffect(() => {
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimeTracking();
    };
  }, [stopTimeTracking]);

  // ──────────────────────────────────────────────────────────────────────────
  // Song change effect – switches between audio and YouTube
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isChangingSongRef.current) return; // Prevent overlapping changes
    if (!currentSong) {
      stopTimeTracking();
      try { ytPlayerRef.current?.pauseVideo(); } catch (_) {}
      try { audioRef.current.pause(); audioRef.current.src = ''; } catch (_) {}
      return;
    }

    isChangingSongRef.current = true;

    const handleSongChange = async () => {
      try {
        if (needsYouTube(currentSong)) {
          playerTypeRef.current = 'youtube';

          const videoId = currentSong.youtubeId
            || extractYouTubeId(currentSong.streamUrl)
            || extractYouTubeId(currentSong.audio);

          if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
            console.error('[YT] invalid videoId:', videoId);
            setIsPlaying(false);
            isChangingSongRef.current = false;
            return;
          }

          // Pause audio element
          try { audioRef.current.pause(); audioRef.current.src = ''; } catch (_) {}

          setCurrentTime(0);
          setDuration(0);

          // Ensure player exists and load the video
          await ensureYouTubePlayer(videoId);

          // After loading, respect the current isPlaying state
          if (pendingPlayRef.current) {
            try { ytPlayerRef.current?.playVideo(); } catch (_) {}
            pendingPlayRef.current = false;
          }
          // Note: isPlaying state will be set by onStateChange when PLAYING fires
        } else {
          // Audio element
          playerTypeRef.current = 'audio';
          stopTimeTracking();
          try { ytPlayerRef.current?.pauseVideo(); } catch (_) {}

          const src = currentSong.audio || currentSong.url || currentSong.audioUrl || currentSong.src;
          if (!src) {
            console.error('No audio src:', currentSong);
            isChangingSongRef.current = false;
            return;
          }

          audioRef.current.src = src;
          audioRef.current.load();

          if (pendingPlayRef.current) {
            try {
              await audioRef.current.play();
              setIsPlaying(true);
            } catch (err) {
              console.warn('Audio play blocked:', err.message);
              setIsPlaying(false);
            }
            pendingPlayRef.current = false;
          }
        }
      } finally {
        isChangingSongRef.current = false;
      }
    };

    handleSongChange();
  }, [currentSong?.id, currentIndex, ensureYouTubePlayer, extractYouTubeId, needsYouTube, stopTimeTracking]);

  // ──────────────────────────────────────────────────────────────────────────
  // Play / Pause toggle – this is the only place that changes isPlaying state
  // ──────────────────────────────────────────────────────────────────────────
  const play = useCallback(() => {
    if (!currentSong) return;
    pendingPlayRef.current = true;

    if (playerTypeRef.current === 'youtube') {
      if (ytPlayerRef.current) {
        // If player already exists and has a video loaded, just play
        try {
          ytPlayerRef.current.playVideo();
        } catch (_) {
          // If play fails, we might need to reload (rare)
        }
      } else {
        // Player not yet created – the song change effect will handle it
        // Trigger a re-run of the song change effect by updating a dummy state?
        // Actually, the song is already loaded, but player wasn't created because
        // creation is deferred. We can force creation by re-triggering the effect.
        // For simplicity, we can call ensureYouTubePlayer here as well.
        const videoId = currentSong.youtubeId
          || extractYouTubeId(currentSong.streamUrl)
          || extractYouTubeId(currentSong.audio);
        if (videoId) {
          ensureYouTubePlayer(videoId).then(() => {
            try { ytPlayerRef.current?.playVideo(); } catch (_) {}
          });
        }
      }
    } else {
      audioRef.current.play().catch(err => {
        console.warn('play:', err);
        setIsPlaying(false);
        pendingPlayRef.current = false;
      });
    }
  }, [currentSong, ensureYouTubePlayer, extractYouTubeId]);

  const pause = useCallback(() => {
    pendingPlayRef.current = false;
    if (playerTypeRef.current === 'youtube') {
      try { ytPlayerRef.current?.pauseVideo(); } catch (_) {}
    } else {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

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
  // Record play to Supabase
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
    pendingPlayRef.current = true; // We want the next song to play
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
    pendingPlayRef.current = true;
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
  // Set player songs
  // ──────────────────────────────────────────────────────────────────────────
  const setPlayerSongs = useCallback((newSongsOrUpdater, startIndex = 0) => {
    if (typeof newSongsOrUpdater === 'function') {
      setSongs(newSongsOrUpdater);
    } else {
      setSongs(newSongsOrUpdater);
      setCurrentIndex(startIndex);
    }
    pendingPlayRef.current = true; // Assume we want to play the new selection
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Audio element event listeners
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    const onTime  = () => setCurrentTime(audio.currentTime);
    const onDur   = () => setDuration(audio.duration);
    const onEnded = () => {
      if (!isChangingSongRef.current) {
        playNext();
      }
    };
    const onError = () => {
      console.error('Audio error:', audio.error);
      if (!isChangingSongRef.current) {
        playNext();
      }
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
  }, [playNext]); // playNext is stable

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
    play: togglePlay,   // Use togglePlay for UI buttons
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