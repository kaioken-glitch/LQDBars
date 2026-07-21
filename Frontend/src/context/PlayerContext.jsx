// src/context/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const PlayerContext = createContext();

/* ─────────────────────────────────────────────────────────────────────────
   SESSION RESUME
   ─────────────────────────────────────────────────────────────────────────
   Persists just enough state to make the player feel like a continuous
   session across reloads: the queue, current index, scrub position, and
   volume/shuffle/repeat. Restored on mount — but isPlaying is NEVER
   restored to true. Browsers block un-gestured autoplay anyway, so the
   honest UX is: song loaded, scrub bar at the last position, paused,
   waiting for a tap.

   Expiry: sessions older than SESSION_TTL are treated as if they don't
   exist (falls back to the "no resume data" empty state + nudge banner
   in HomeOnline). 72h is a starting point — bump this if it feels too
   aggressive/lenient in practice.
───────────────────────────────────────────────────────────────────────── */
const SESSION_KEY = 'lb:playerSession';
const SESSION_TTL = 72 * 60 * 60 * 1000; // 72 hours
const SESSION_SAVE_INTERVAL = 8000; // throttle while playing

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.songs) || !data.songs.length) return null;
    if (Date.now() - (data.ts || 0) > SESSION_TTL) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function saveSession(data) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
  catch (_) { /* localStorage full/unavailable — non-critical, skip */ }
}

export function PlayerProvider({ children }) {
  // Read any existing session exactly once, before the first render's
  // state initializers run. `undefined` sentinel guards against re-reading
  // localStorage on every render (a plain useRef(loadSession()) would call
  // loadSession() on every render even though only the first value sticks).
  const initialSessionRef = useRef(undefined);
  if (initialSessionRef.current === undefined) {
    initialSessionRef.current = loadSession();
  }
  const initialSession = initialSessionRef.current;
  const hasResumedSession = !!initialSession;

  const [songs, setSongs] = useState(() => initialSession?.songs ?? []);
  const [currentIndex, setCurrentIndex] = useState(() => initialSession?.currentIndex ?? 0);
  const [isPlaying, setIsPlaying] = useState(false); // NEVER restored to true
  const [volume, setVolume] = useState(() => initialSession?.volume ?? 0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(() => initialSession?.shuffle ?? false);
  const [repeatMode, setRepeatMode] = useState(() => initialSession?.repeatMode ?? 'off');
  const [shuffledOrder, setShuffledOrder] = useState([]);
  const [showBackgroundDetail, setShowBackgroundDetail] = useState(false);

  const audioRef           = useRef(new Audio());
  const youtubePlayerRef   = useRef(null);
  const playerTypeRef      = useRef('audio');
  const timeUpdateInterval = useRef(null);

  // The scrub position to apply once the *first* resumed song has actually
  // loaded — applied exactly once, then cleared. Every song change after
  // that behaves normally (starts at 0).
  const pendingResumeTimeRef = useRef(initialSession?.currentTime ?? null);
  const hasAppliedResumeRef  = useRef(false);

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
              autoplay: isPlaying ? 1 : 0,
              controls: 0, disablekb: 1, fs: 0,
              iv_load_policy: 3, modestbranding: 1, rel: 0,
              // Without this, iOS Safari treats the embed as wanting native
              // fullscreen video playback, which silently blocks/breaks
              // programmatic playVideo() calls outside of a fullscreen
              // context. This is the single biggest fix for "song won't
              // play on mobile" when the song is a YouTube-sourced track.
              playsinline: 1,
            },
            events: {
              onReady: (event) => {
                setDuration(event.target.getDuration());
                // Apply the resumed scrub position exactly once, on the
                // very first song this session — never on later songs.
                if (!hasAppliedResumeRef.current && pendingResumeTimeRef.current) {
                  const t = pendingResumeTimeRef.current;
                  hasAppliedResumeRef.current = true;
                  pendingResumeTimeRef.current = null;
                  event.target.seekTo(t, true);
                  setCurrentTime(t);
                }
                if (isPlaying) event.target.playVideo();
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

      // Apply the resumed scrub position exactly once, on the very first
      // song this session — never on later songs.
      if (!hasAppliedResumeRef.current && pendingResumeTimeRef.current) {
        const t = pendingResumeTimeRef.current;
        hasAppliedResumeRef.current = true;
        pendingResumeTimeRef.current = null;
        const applyOnce = () => {
          audioRef.current.currentTime = t;
          setCurrentTime(t);
          audioRef.current.removeEventListener('loadedmetadata', applyOnce);
        };
        audioRef.current.addEventListener('loadedmetadata', applyOnce);
      }

      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.error('Audio play error:', err);
          setIsPlaying(false);
        });
      }
    }
  }, [currentSong, currentIndex, songs.length, needsYouTubePlayer, extractYouTubeId, cleanupYouTube, isPlaying]);

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

  const setPlayerSongs = useCallback((newSongs, startIndex = 0) => {
    setSongs(newSongs);
    setCurrentIndex(startIndex);
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

  /* ─────────────────────────────────────────────────────────────────────
     SESSION PERSISTENCE
     ─────────────────────────────────────────────────────────────────────
     Builds a snapshot of {songs, currentIndex, currentTime, volume,
     shuffle, repeatMode, ts} and writes it to localStorage. Pulls the
     live playback position directly from the active player (audio
     element or YT player) rather than the `currentTime` state, since
     that state can lag slightly behind (YT position is only polled
     once a second).
  ───────────────────────────────────────────────────────────────────── */
  const buildSessionSnapshot = useCallback(() => {
    if (!songs.length) return null;
    const livePosition = playerTypeRef.current === 'youtube'
      ? (youtubePlayerRef.current?.getCurrentTime?.() ?? currentTime)
      : (audioRef.current?.currentTime ?? currentTime);
    return {
      songs,
      currentIndex,
      currentTime: Number.isFinite(livePosition) ? livePosition : 0,
      volume,
      shuffle,
      repeatMode,
      ts: Date.now(),
    };
  }, [songs, currentIndex, currentTime, volume, shuffle, repeatMode]);

  const persistSession = useCallback(() => {
    const snap = buildSessionSnapshot();
    if (snap) saveSession(snap);
  }, [buildSessionSnapshot]);

  // Save immediately whenever the current song changes (new song picked,
  // skip forward/back, queue replaced, etc).
  useEffect(() => {
    if (!currentSong) return;
    persistSession();
  }, [currentSong?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Throttled save while actively playing — captures scrub progress
  // without hammering localStorage on every timeupdate tick.
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(persistSession, SESSION_SAVE_INTERVAL);
    return () => clearInterval(id);
  }, [isPlaying, persistSession]);

  // Save on pause (catches "listened partway, then paused and walked away").
  useEffect(() => {
    if (!isPlaying) persistSession();
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save on tab hide / app backgrounding / actual close — the last-resort
  // catches for closing the tab without pausing first.
  useEffect(() => {
    const handler = () => persistSession();
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('beforeunload', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('beforeunload', handler);
    };
  }, [persistSession]);

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
    hasResumedSession,          // ← lets HomeOnline know whether to show the nudge banner
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