// src/context/PlayerContext.jsx
import React, {
  createContext, useContext,
  useState, useRef, useEffect, useCallback,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {

  /* ── State ─────────────────────────────────────────────────────── */
  const [songs,               setSongs]               = useState([]);
  const [currentIndex,        setCurrentIndex]        = useState(0);
  const [isPlaying,           setIsPlaying]           = useState(false);
  const [volume,              setVolume]              = useState(0.7);
  const [currentTime,         setCurrentTime]         = useState(0);
  const [duration,            setDuration]            = useState(0);
  const [downloadedSongs,     setDownloadedSongs]     = useState([]);
  const [isMuted,             setIsMuted]             = useState(false);
  const [shuffle,             setShuffle]             = useState(false);
  const [repeatMode,          setRepeatMode]          = useState('off');
  const [shuffledOrder,       setShuffledOrder]       = useState([]);
  const [showBackgroundDetail,setShowBackgroundDetail]= useState(false);

  /* ── Refs ──────────────────────────────────────────────────────── */
  const audioRef        = useRef(new Audio());
  const ytPlayerRef     = useRef(null);   // single YT player instance, lives forever
  const ytReadyRef      = useRef(false);  // true once onReady has fired
  const playerTypeRef   = useRef('audio');
  const timeIntervalRef = useRef(null);

  // Refs that mirror state so YT callbacks (which are stale closures) can
  // always read the current value without being in any dep array.
  const songsRef        = useRef([]);
  const currentIdxRef   = useRef(0);
  const isPlayingRef    = useRef(false);
  const repeatModeRef   = useRef('off');
  const shuffleRef      = useRef(false);
  const shuffledRef     = useRef([]);

  // Keep mirror refs in sync
  useEffect(() => { songsRef.current      = songs;        }, [songs]);
  useEffect(() => { currentIdxRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { isPlayingRef.current  = isPlaying;    }, [isPlaying]);
  useEffect(() => { repeatModeRef.current = repeatMode;   }, [repeatMode]);
  useEffect(() => { shuffleRef.current    = shuffle;      }, [shuffle]);
  useEffect(() => { shuffledRef.current   = shuffledOrder;}, [shuffledOrder]);

  const currentSong = songs[currentIndex];

  /* ── Helpers ────────────────────────────────────────────────────── */
  const needsYouTube = useCallback((song) => {
    if (!song) return false;
    return song.source === 'youtube' || !!(song.youtubeId && /^[A-Za-z0-9_-]{1,}$/.test(song.youtubeId));
  }, []);

  const extractVideoId = useCallback((url) => {
    if (!url) return null;
    for (const re of [/youtube\.com\/watch\?v=([^&]+)/, /youtu\.be\/([^?]+)/, /youtube\.com\/embed\/([^?]+)/]) {
      const m = url.match(re);
      if (m) return m[1];
    }
    return null;
  }, []);

  /* ── Time tracking ─────────────────────────────────────────────── */
  const startTimeTracking = useCallback(() => {
    if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    timeIntervalRef.current = setInterval(() => {
      try {
        const p = ytPlayerRef.current;
        if (!p?.getCurrentTime) return;
        const t = p.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t) && t >= 0) setCurrentTime(t);
        const d = p.getDuration?.() || 0;
        if (d > 0) setDuration(d);
      } catch (_) {}
    }, 500);
  }, []);

  const stopTimeTracking = useCallback(() => {
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
  }, []);

  /* ── Advance to next / prev (uses refs — safe inside YT callbacks) */
  // These functions read refs so they are always current even from stale closures.
  const advanceNext = useCallback(() => {
    const s   = songsRef.current;
    const ci  = currentIdxRef.current;
    const rm  = repeatModeRef.current;
    const sh  = shuffleRef.current;
    const sho = shuffledRef.current;

    if (!s.length) return;

    if (rm === 'one') {
      if (playerTypeRef.current === 'youtube') {
        try { ytPlayerRef.current?.seekTo(0, true); ytPlayerRef.current?.playVideo(); } catch (_) {}
      } else {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    let next;
    if (sh && sho.length) {
      const idx = sho.indexOf(ci);
      if (idx < sho.length - 1)    next = sho[idx + 1];
      else if (rm === 'all')        next = sho[0];
      else { setIsPlaying(false); return; }
    } else {
      if (ci < s.length - 1)       next = ci + 1;
      else if (rm === 'all')        next = 0;
      else { setIsPlaying(false); return; }
    }
    setCurrentIndex(next);
    setIsPlaying(true);
  }, []); // no deps — reads refs at call time

  const advancePrev = useCallback(() => {
    const s   = songsRef.current;
    const ci  = currentIdxRef.current;
    const rm  = repeatModeRef.current;
    const sh  = shuffleRef.current;
    const sho = shuffledRef.current;

    if (!s.length) return;

    // If more than 3 s in — restart current song instead
    if (playerTypeRef.current === 'audio' && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0; return;
    }
    if (playerTypeRef.current === 'youtube') {
      try { if ((ytPlayerRef.current?.getCurrentTime?.() || 0) > 3) { ytPlayerRef.current.seekTo(0, true); return; } } catch (_) {}
    }

    let prev;
    if (sh && sho.length) {
      const idx = sho.indexOf(ci);
      if (idx > 0)                  prev = sho[idx - 1];
      else if (rm === 'all')        prev = sho[sho.length - 1];
      else                          prev = 0;
    } else {
      if (ci > 0)                   prev = ci - 1;
      else if (rm === 'all')        prev = s.length - 1;
      else                          prev = 0;
    }
    setCurrentIndex(prev);
    setIsPlaying(true);
  }, []); // no deps — reads refs

  /* ── YouTube player ─────────────────────────────────────────────
     Single player instance created once. Song changes use
     loadVideoById() — preserves iOS gesture chain.
  ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    // Inject the API script once
    if (!document.getElementById('yt-iframe-api')) {
      const tag  = document.createElement('script');
      tag.id     = 'yt-iframe-api';
      tag.src    = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    // Off-screen container — NOT display:none (breaks iOS)
    if (!document.getElementById('yt-player-root')) {
      const ctn = document.createElement('div');
      ctn.id    = 'yt-player-root';
      ctn.style.cssText =
        'position:fixed;top:-4px;left:-4px;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1;';
      document.body.appendChild(ctn);
    }

    const createPlayer = () => {
      if (ytReadyRef.current) return;          // already exists
      if (!window.YT?.Player)  return;         // API not ready yet

      ytPlayerRef.current = new window.YT.Player('yt-player-root', {
        width: '2', height: '2',
        playerVars: {
          autoplay:       0,
          controls:       0,
          disablekb:      1,
          fs:             0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel:            0,
          playsinline:    1,   // iOS: don't hijack to fullscreen
          origin:         window.location.origin,
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            startTimeTracking();
          },

          onStateChange: (e) => {
            const S = window.YT?.PlayerState;
            if (!S) return;

            if (e.data === S.PLAYING) {
              try {
                const d = e.target.getDuration();
                if (d > 0) setDuration(d);
              } catch (_) {}
              setIsPlaying(true);

            } else if (e.data === S.PAUSED) {
              // PAUSED fires during buffering after loadVideoById — ignore it
              // unless the player is genuinely done loading (readyState > 0)
              // We use a small timeout: if the player starts PLAYING within
              // 800ms this PAUSED was just a buffering artifact.
              setTimeout(() => {
                try {
                  const state = ytPlayerRef.current?.getPlayerState?.();
                  if (state === S.PAUSED) setIsPlaying(false);
                } catch (_) {}
              }, 800);

            } else if (e.data === S.ENDED) {
              advanceNext();
            }
          },

          onError: (e) => {
            console.error('[YT] error:', e.data);
            advanceNext();
          },
        },
      });
    };

    // If the API already loaded (e.g. HMR / script cached), create immediately
    if (window.YT?.Player) {
      createPlayer();
    } else {
      // Wire up the global callback — append to any existing handler
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev();
        createPlayer();
      };
    }

    return () => stopTimeTracking();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Song-change effect ──────────────────────────────────────────
     Deps: only currentSong?.id and currentIndex.
     isPlaying is NOT a dep — toggling play must never re-run this.
  ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!currentSong) {
      stopTimeTracking();
      try { ytPlayerRef.current?.pauseVideo(); } catch (_) {}
      try { audioRef.current.pause(); audioRef.current.src = ''; } catch (_) {}
      setIsPlaying(false);
      return;
    }

    if (needsYouTube(currentSong)) {
      playerTypeRef.current = 'youtube';

      const videoId = currentSong.youtubeId
        || extractVideoId(currentSong.streamUrl)
        || extractVideoId(currentSong.audio);

      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        console.error('[Player] bad videoId for', currentSong.name);
        advanceNext();
        return;
      }

      // Pause & reset audio
      try { audioRef.current.pause(); audioRef.current.src = ''; } catch (_) {}
      setCurrentTime(0);
      setDuration(0);

      const load = () => {
        if (!ytReadyRef.current || !ytPlayerRef.current) {
          // Player not ready yet — retry in 100ms
          setTimeout(load, 100);
          return;
        }
        try {
          // loadVideoById auto-starts playback AND preserves iOS gesture chain
          ytPlayerRef.current.loadVideoById({ videoId, startSeconds: 0 });
          setIsPlaying(true);
        } catch (e) {
          console.error('[YT] loadVideoById failed:', e);
          advanceNext();
        }
      };
      load();

    } else {
      playerTypeRef.current = 'audio';
      stopTimeTracking();
      try { ytPlayerRef.current?.pauseVideo(); } catch (_) {}

      const src = currentSong.audio || currentSong.url || currentSong.audioUrl || currentSong.src;
      if (!src) { console.error('[Player] no src for', currentSong.name); return; }

      audioRef.current.src = src;
      audioRef.current.load();
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          // Autoplay blocked — user will need to tap play
          console.warn('[Player] autoplay blocked:', err.message);
          setIsPlaying(false);
        });
    }
  }, [currentSong?.id, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Play / pause effect ─────────────────────────────────────────
     Runs ONLY when isPlaying flips — never loads a new song.
  ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!currentSong) return;

    if (playerTypeRef.current === 'youtube') {
      if (!ytPlayerRef.current) return;
      try {
        if (isPlaying) ytPlayerRef.current.playVideo();
        else           ytPlayerRef.current.pauseVideo();
      } catch (_) {}
    } else {
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.warn('[Player] play blocked:', err.message);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Volume ─────────────────────────────────────────────────────── */
  useEffect(() => {
    audioRef.current.volume = isMuted ? 0 : volume;
    try {
      if (ytPlayerRef.current?.setVolume) {
        ytPlayerRef.current.setVolume(isMuted ? 0 : volume * 100);
      }
    } catch (_) {}
  }, [volume, isMuted]);

  /* ── Mute ───────────────────────────────────────────────────────── */
  const toggleMute = useCallback(() => {
    setIsMuted(m => {
      const next = !m;
      try {
        if (ytPlayerRef.current) {
          next ? ytPlayerRef.current.mute() : ytPlayerRef.current.unMute();
        }
      } catch (_) {}
      audioRef.current.muted = next;
      return next;
    });
  }, []);

  /* ── Audio element events ───────────────────────────────────────── */
  useEffect(() => {
    const audio = audioRef.current;
    const onTime  = () => setCurrentTime(audio.currentTime);
    const onDur   = () => { if (audio.duration > 0) setDuration(audio.duration); };
    const onEnded = () => advanceNext();
    const onError = () => {
      console.error('[Audio] error:', audio.error?.message);
      advanceNext();
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
  }, [advanceNext]); // advanceNext is stable (no deps), so this only runs once

  /* ── Supabase listen history ────────────────────────────────────── */
  const { user } = useAuth();
  useEffect(() => {
    if (!currentSong?.youtubeId || !user?.id) return;
    supabase.from('listening_history').insert({
      user_id:    user.id,
      youtube_id: currentSong.youtubeId,
      name:       currentSong.name   || null,
      artist:     currentSong.artist || null,
      genre:      currentSong.genre  || null,
    }).then(({ error }) => {
      if (error) console.warn('[history]', error.message);
    });
  }, [currentSong?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Shuffle order ──────────────────────────────────────────────── */
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
  }, [shuffle, songs.length, currentIndex]);

  /* ── Seek ────────────────────────────────────────────────────────── */
  const seekTo = useCallback((time) => {
    if (playerTypeRef.current === 'youtube') {
      try { ytPlayerRef.current?.seekTo(time, true); } catch (_) {}
    } else {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  /* ── setPlayerSongs — accepts array or functional updater ─────────── */
  const setPlayerSongs = useCallback((newSongsOrUpdater, startIndex = 0) => {
    if (typeof newSongsOrUpdater === 'function') {
      setSongs(newSongsOrUpdater);
      // Don't reset index — radio appends songs without changing current position
    } else {
      setSongs(newSongsOrUpdater);
      setCurrentIndex(startIndex);
    }
  }, []);

  /* ── Toggle helpers ─────────────────────────────────────────────── */
  const toggleBackgroundDetail = useCallback(() => setShowBackgroundDetail(p => !p), []);
  const toggleShuffle          = useCallback(() => setShuffle(p => !p), []);
  const toggleRepeatMode       = useCallback(() =>
    setRepeatMode(p => p === 'off' ? 'all' : p === 'all' ? 'one' : 'off'), []);

  /* ── Public next/prev (same logic, just exposed names) ─────────── */
  const playNext = advanceNext;
  const playPrev = advancePrev;

  /* ── Context value ──────────────────────────────────────────────── */
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
    playerType:           playerTypeRef.current,
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
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}