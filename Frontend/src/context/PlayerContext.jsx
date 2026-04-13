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
  const ytPlayerRef      = useRef(null);   // single YT player instance — never destroyed between songs
  const ytReadyRef       = useRef(false);  // true once onReady fired
  const ytPendingRef     = useRef(null);   // videoId waiting to load once player is ready
  const playerTypeRef    = useRef('audio');
  const timeIntervalRef  = useRef(null);
  const isPlayingRef     = useRef(false);  // mirror of isPlaying for use inside YT callbacks

  const currentSong = songs[currentIndex];

  // Keep ref in sync so YT callbacks can read current value without stale closure
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

  /* ─────────────────────────────────────────────────────────────────
     TIME TRACKING INTERVAL
  ───────────────────────────────────────────────────────────────── */
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
    if (timeIntervalRef.current) { clearInterval(timeIntervalRef.current); timeIntervalRef.current = null; }
  }, []);

  /* ─────────────────────────────────────────────────────────────────
     SINGLE YOUTUBE PLAYER — created ONCE on mount, reused forever.
     On mobile, the player must be created as a result of a real user
     gesture (tap). We create it when the API loads; subsequent song
     changes use loadVideoById() which preserves the gesture chain.
  ───────────────────────────────────────────────────────────────── */
  useEffect(() => {
    // Inject IFrame API script
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id  = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    // Container — tiny, off-screen so it doesn't affect layout
    let ctn = document.getElementById('yt-player-singleton');
    if (!ctn) {
      ctn = document.createElement('div');
      ctn.id = 'yt-player-singleton';
      ctn.style.cssText = 'position:fixed;top:-2px;left:-2px;width:2px;height:2px;opacity:0;pointer-events:none;';
      document.body.appendChild(ctn);
    }

    const createPlayer = () => {
      if (ytReadyRef.current) return; // already created
      if (!window.YT?.Player) { setTimeout(createPlayer, 150); return; }

      ytPlayerRef.current = new window.YT.Player('yt-player-singleton', {
        width: '2', height: '2',
        playerVars: {
          autoplay: 0,       // 0 at init — we call playVideo() explicitly
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,    // iOS: prevent fullscreen takeover
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            // If a song was requested before the player was ready, load it now
            if (ytPendingRef.current) {
              const { videoId, play } = ytPendingRef.current;
              ytPendingRef.current = null;
              ytPlayerRef.current.loadVideoById(videoId);
              if (play) {
                // Small delay lets the player buffer a tiny bit before play
                setTimeout(() => {
                  try { ytPlayerRef.current?.playVideo(); } catch (_) {}
                }, 200);
              }
            }
          },
          onStateChange: (event) => {
            const S = window.YT?.PlayerState;
            if (!S) return;
            if (event.data === S.ENDED) {
              // Advance to next song
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
            // Skip to next on error
            setCurrentIndex(ci => {
              setSongs(prev => {
                if (ci < prev.length - 1) return prev; // trigger index change
                return prev;
              });
              return ci < songs.length - 1 ? ci + 1 : ci;
            });
          },
        },
      });
    };

    // YT API calls onYouTubeIframeAPIReady when ready
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      createPlayer();
    };

    // If API already loaded (e.g. HMR), create immediately
    if (window.YT?.Player) createPlayer();

    return () => {
      stopTimeTracking();
      // Don't destroy the player on unmount of the provider — it lives with the page
    };
  }, []); // eslint-disable-line

  /* ─────────────────────────────────────────────────────────────────
     SONG CHANGE — load new video or switch to audio element
  ───────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!currentSong) {
      // Nothing playing — pause both players
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

      // Reset time
      setCurrentTime(0);
      setDuration(0);

      if (!ytReadyRef.current) {
        // Player not ready yet — queue it up
        ytPendingRef.current = { videoId, play: true };
        return;
      }

      // ── THE KEY FIX ──
      // loadVideoById starts buffering immediately AND plays automatically
      // on mobile without requiring a new user gesture, because the player
      // instance was already created in response to a gesture (or on mount).
      try {
        ytPlayerRef.current.loadVideoById({ videoId, startSeconds: 0 });
        // loadVideoById auto-plays on most platforms; belt-and-suspenders:
        setTimeout(() => {
          try {
            if (ytPlayerRef.current?.getPlayerState?.() !== window.YT?.PlayerState?.PLAYING) {
              ytPlayerRef.current?.playVideo?.();
            }
          } catch (_) {}
        }, 300);
      } catch (e) {
        console.error('[YT] loadVideoById failed:', e);
        setIsPlaying(false);
        return;
      }

      startTimeTracking();
      setIsPlaying(true);

    } else {
      // ── AUDIO element ──
      playerTypeRef.current = 'audio';
      stopTimeTracking();
      try { ytPlayerRef.current?.pauseVideo(); } catch (_) {}

      const src = currentSong.audio || currentSong.url || currentSong.audioUrl || currentSong.src;
      if (!src) { console.error('No audio src:', currentSong); return; }

      audioRef.current.src = src;
      audioRef.current.load();
      audioRef.current.play().catch(err => console.warn('Audio play blocked:', err.message));
    }
  }, [currentSong?.id, currentIndex]); // eslint-disable-line

  /* ─────────────────────────────────────────────────────────────────
     PLAY / PAUSE TOGGLE
  ───────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!currentSong) return;
    if (playerTypeRef.current === 'youtube') {
      try {
        if (isPlaying) ytPlayerRef.current?.playVideo();
        else           ytPlayerRef.current?.pauseVideo();
      } catch (_) {}
    } else {
      if (isPlaying) audioRef.current.play().catch(e => console.warn('play:', e));
      else           audioRef.current.pause();
    }
  }, [isPlaying, currentSong?.id]); // eslint-disable-line

  /* ─────────────────────────────────────────────────────────────────
     VOLUME
  ───────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (playerTypeRef.current === 'youtube') {
      try { ytPlayerRef.current?.setVolume(volume * 100); } catch (_) {}
    } else {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  /* ─────────────────────────────────────────────────────────────────
     RECORD PLAY TO SUPABASE
  ───────────────────────────────────────────────────────────────── */
  const { user } = useAuth();
  useEffect(() => {
    if (!currentSong?.youtubeId || !user) return;
    supabase.from('listening_history').insert({
      user_id: user.id, youtube_id: currentSong.youtubeId,
      name: currentSong.name || null, artist: currentSong.artist || null, genre: currentSong.genre || null,
    }).then(({ error }) => { if (error) console.warn('[history]', error.message); });
  }, [currentSong?.id]); // eslint-disable-line

  /* ─────────────────────────────────────────────────────────────────
     MUTE
  ───────────────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────────────
     SHUFFLE ORDER
  ───────────────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────────────
     NEXT / PREV
  ───────────────────────────────────────────────────────────────── */
  const playNext = useCallback(() => {
    if (!songs.length) return;
    if (repeatMode === 'one') {
      if (playerTypeRef.current === 'youtube') { try { ytPlayerRef.current?.seekTo(0, true); ytPlayerRef.current?.playVideo(); } catch (_) {} }
      else { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); }
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
      audioRef.current.currentTime = 0; return;
    }
    if (playerTypeRef.current === 'youtube') {
      try { if (ytPlayerRef.current?.getCurrentTime?.() > 3) { ytPlayerRef.current.seekTo(0, true); return; } } catch (_) {}
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

  /* ─────────────────────────────────────────────────────────────────
     SEEK
  ───────────────────────────────────────────────────────────────── */
  const seekTo = useCallback((time) => {
    if (playerTypeRef.current === 'youtube') {
      try { ytPlayerRef.current?.seekTo(time, true); setCurrentTime(time); } catch (_) {}
    } else {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  /* ─────────────────────────────────────────────────────────────────
     SET PLAYER SONGS
  ───────────────────────────────────────────────────────────────── */
  const setPlayerSongs = useCallback((newSongsOrUpdater, startIndex = 0) => {
    if (typeof newSongsOrUpdater === 'function') {
      setSongs(newSongsOrUpdater);
    } else {
      setSongs(newSongsOrUpdater);
      setCurrentIndex(startIndex);
    }
  }, []);

  /* ─────────────────────────────────────────────────────────────────
     AUDIO ELEMENT EVENTS
  ───────────────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────────────
     CONTEXT VALUE
  ───────────────────────────────────────────────────────────────── */
  const value = {
    songs, setPlayerSongs,
    currentIndex, setCurrentIndex,
    isPlaying, setIsPlaying,
    volume, setVolume,
    currentTime, setCurrentTime,
    duration, setDuration,
    audioRef,
    currentSong,
    downloadedSongs, setDownloadedSongs,
    seekTo,
    playerType: playerTypeRef.current,
    playNext, playPrev,
    shuffle, toggleShuffle,
    repeatMode, toggleRepeatMode,
    toggleMute, isMuted,
    showBackgroundDetail, setShowBackgroundDetail, toggleBackgroundDetail,
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