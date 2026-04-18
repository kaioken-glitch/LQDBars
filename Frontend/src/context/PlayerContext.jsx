// src/context/PlayerContext.jsx
import React, {
  createContext, useContext,
  useState, useRef, useEffect, useCallback,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {

  /* ── State ──────────────────────────────────────────────────────── */
  const [songs,                setSongs]                = useState([]);
  const [currentIndex,         setCurrentIndex]         = useState(0);
  const [isPlaying,            setIsPlaying]            = useState(false);
  const [volume,               setVolume]               = useState(0.7);
  const [currentTime,          setCurrentTime]          = useState(0);
  const [duration,             setDuration]             = useState(0);
  const [downloadedSongs,      setDownloadedSongs]      = useState([]);
  const [isMuted,              setIsMuted]              = useState(false);
  const [shuffle,              setShuffle]              = useState(false);
  const [repeatMode,           setRepeatMode]           = useState('off');
  const [shuffledOrder,        setShuffledOrder]        = useState([]);
  const [showBackgroundDetail, setShowBackgroundDetail] = useState(false);

  /* ── Refs ───────────────────────────────────────────────────────── */
  const audioRef      = useRef(new Audio());
  const ytRef         = useRef(null);       // single YT player, lives forever
  const ytReadyRef    = useRef(false);
  const playerType    = useRef('audio');
  const timerRef      = useRef(null);

  // ─── Mirror refs ───────────────────────────────────────────────────
  // YT callbacks (onStateChange / onError) are closures created once at
  // player-init time. They can never see updated React state. These refs
  // are always synced so the callbacks read current values via refs.
  const songsRef    = useRef([]);
  const idxRef      = useRef(0);
  const repeatRef   = useRef('off');
  const shuffleRef  = useRef(false);
  const shuffledRef = useRef([]);

  useEffect(() => { songsRef.current    = songs;        }, [songs]);
  useEffect(() => { idxRef.current      = currentIndex; }, [currentIndex]);
  useEffect(() => { repeatRef.current   = repeatMode;   }, [repeatMode]);
  useEffect(() => { shuffleRef.current  = shuffle;      }, [shuffle]);
  useEffect(() => { shuffledRef.current = shuffledOrder;}, [shuffledOrder]);

  // ─── Loading guard ─────────────────────────────────────────────────
  // Set TRUE the moment we start loading a song, FALSE once the song
  // is actually playing (or has definitively failed).
  // While TRUE, every error/ended/paused handler is silenced so they
  // cannot advance the index during the load window — this is the
  // root cause of the cycling-through-all-songs bug.
  const loadingRef = useRef(false);

  const currentSong = songs[currentIndex];

  /* ── Helpers ────────────────────────────────────────────────────── */
  const needsYT = (song) =>
    !!(song && (song.source === 'youtube' ||
       (song.youtubeId && /^[A-Za-z0-9_-]+$/.test(song.youtubeId))));

  const getVideoId = (song) =>
    song.youtubeId ||
    (song.audio  && extractId(song.audio))  ||
    (song.streamUrl && extractId(song.streamUrl)) ||
    null;

  function extractId(url) {
    if (!url) return null;
    for (const re of [
      /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/,
      /youtu\.be\/([A-Za-z0-9_-]{11})/,
      /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    ]) { const m = url.match(re); if (m) return m[1]; }
    return null;
  }

  /* ── Time tracking ──────────────────────────────────────────────── */
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      try {
        const p = ytRef.current;
        if (!p?.getCurrentTime) return;
        const t = p.getCurrentTime();
        if (!isNaN(t)) setCurrentTime(t);
        const d = p.getDuration?.() || 0;
        if (d > 0) setDuration(d);
      } catch (_) {}
    }, 500);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  /* ── Advance (reads refs — always current inside YT callbacks) ──── */
  const advance = useCallback((dir = 1) => {
    const s   = songsRef.current;
    const ci  = idxRef.current;
    const rm  = repeatRef.current;
    const sh  = shuffleRef.current;
    const sho = shuffledRef.current;
    if (!s.length) return;

    if (rm === 'one') {
      if (playerType.current === 'youtube') {
        try { ytRef.current?.seekTo(0, true); ytRef.current?.playVideo(); } catch (_) {}
      } else {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    let next;
    if (dir > 0) {
      if (sh && sho.length) {
        const i = sho.indexOf(ci);
        next = i < sho.length - 1 ? sho[i + 1] : (rm === 'all' ? sho[0] : null);
      } else {
        next = ci < s.length - 1 ? ci + 1 : (rm === 'all' ? 0 : null);
      }
    } else {
      if (sh && sho.length) {
        const i = sho.indexOf(ci);
        next = i > 0 ? sho[i - 1] : (rm === 'all' ? sho[sho.length - 1] : 0);
      } else {
        next = ci > 0 ? ci - 1 : (rm === 'all' ? s.length - 1 : 0);
      }
    }

    if (next === null) { setIsPlaying(false); return; }
    setCurrentIndex(next);
    // isPlaying stays true — the song-change effect will start the new song
  }, []); // empty deps — reads refs, never stale

  /* ── Single YouTube player — created once on mount ──────────────── */
  useEffect(() => {
    if (!document.getElementById('yt-api-script')) {
      const s = document.createElement('script');
      s.id  = 'yt-api-script';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }

    // Tiny off-screen div — NOT display:none (iOS won't play from hidden elements)
    if (!document.getElementById('yt-player-anchor')) {
      const d = document.createElement('div');
      d.id = 'yt-player-anchor';
      d.style.cssText =
        'position:fixed;top:-4px;left:-4px;width:2px;height:2px;' +
        'opacity:0.01;pointer-events:none;z-index:-1;';
      document.body.appendChild(d);
    }

    const build = () => {
      if (ytReadyRef.current || !window.YT?.Player) return;
      ytRef.current = new window.YT.Player('yt-player-anchor', {
        width: '2', height: '2',
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1,
          fs: 0, iv_load_policy: 3, modestbranding: 1,
          rel: 0, playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            startTimer();
          },
          onStateChange: (e) => {
            const S = window.YT?.PlayerState;
            if (!S) return;
            if (e.data === S.PLAYING) {
              try { setDuration(e.target.getDuration() || 0); } catch (_) {}
              loadingRef.current = false;   // we're actually playing — clear guard
              setIsPlaying(true);
            } else if (e.data === S.PAUSED) {
              // Ignore PAUSED while loading — it fires as a buffering artifact
              if (!loadingRef.current) setIsPlaying(false);
            } else if (e.data === S.ENDED) {
              if (!loadingRef.current) advance(1);
            }
          },
          onError: () => {
            loadingRef.current = false;
            advance(1);
          },
        },
      });
    };

    if (window.YT?.Player) {
      build();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (typeof prev === 'function') prev(); build(); };
    }

    return stopTimer;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Song-change effect ─────────────────────────────────────────────
     Runs ONLY when the song actually changes.
     isPlaying is NOT in the dep array — this is intentional and
     critical. If isPlaying were here, every play/pause tap would
     re-run this effect, destroy the YT player, and start cycling.
  ──────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!currentSong) {
      loadingRef.current = false;
      stopTimer();
      try { ytRef.current?.pauseVideo(); } catch (_) {}
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsPlaying(false);
      return;
    }

    // Raise guard FIRST — before any async work
    loadingRef.current = true;

    if (needsYT(currentSong)) {
      playerType.current = 'youtube';

      const videoId = getVideoId(currentSong);
      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        console.error('[Player] bad videoId for:', currentSong.name);
        loadingRef.current = false;
        advance(1);
        return;
      }

      // Silence audio
      audioRef.current.pause();
      audioRef.current.src = '';
      setCurrentTime(0);
      setDuration(0);

      const load = () => {
        if (!ytReadyRef.current || !ytRef.current) { setTimeout(load, 80); return; }
        try {
          // loadVideoById auto-plays AND keeps iOS gesture chain intact
          ytRef.current.loadVideoById({ videoId, startSeconds: 0 });
          // loadingRef stays true until onStateChange PLAYING fires above
        } catch (err) {
          console.error('[YT] loadVideoById:', err);
          loadingRef.current = false;
          advance(1);
        }
      };
      load();

    } else {
      playerType.current = 'audio';
      stopTimer();
      try { ytRef.current?.pauseVideo(); } catch (_) {}

      const src =
        currentSong.audio || currentSong.url ||
        currentSong.audioUrl || currentSong.src;

      if (!src) {
        console.error('[Player] no src for:', currentSong.name);
        loadingRef.current = false;
        return;
      }

      // Pause THEN change src.
      // Changing src on an element with a blob URL fires an 'error' event.
      // With loadingRef=true the error handler below will ignore it.
      audioRef.current.pause();
      audioRef.current.src = src;
      audioRef.current.load();

      audioRef.current
        .play()
        .then(() => {
          loadingRef.current = false;
          setIsPlaying(true);
        })
        .catch(() => {
          // Autoplay blocked by browser — stay paused, user taps play
          loadingRef.current = false;
          setIsPlaying(false);
        });
    }
  // currentSong?.id  — only re-run when the song identity changes
  // currentIndex     — also needed: same song can be at different indices
  }, [currentSong?.id, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Play / pause toggle ────────────────────────────────────────────
     Separate effect. ONLY responds to the isPlaying flag.
     Never touches loading logic, never changes the song.
  ──────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    // Skip if a song is currently being loaded — the song-change effect
    // handles play/pause as part of the load sequence.
    if (loadingRef.current || !currentSong) return;

    if (playerType.current === 'youtube') {
      try {
        if (isPlaying) ytRef.current?.playVideo();
        else           ytRef.current?.pauseVideo();
      } catch (_) {}
    } else {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Volume / mute ─────────────────────────────────────────────── */
  useEffect(() => {
    const v = isMuted ? 0 : volume;
    audioRef.current.volume = v;
    try { ytRef.current?.setVolume(v * 100); } catch (_) {}
  }, [volume, isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(m => {
      const next = !m;
      audioRef.current.muted = next;
      try { next ? ytRef.current?.mute() : ytRef.current?.unMute(); } catch (_) {}
      return next;
    });
  }, []);

  /* ── Audio element events ──────────────────────────────────────────
     Attached ONCE with empty deps. Handlers read refs — never stale.
     loadingRef guard prevents spurious advances during src changes.
  ──────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const a = audioRef.current;
    const onTime  = () => setCurrentTime(a.currentTime);
    const onDur   = () => { if (a.duration > 0) setDuration(a.duration); };
    const onEnded = () => { if (!loadingRef.current) advance(1); };
    const onError = () => { if (!loadingRef.current) advance(1); };
    a.addEventListener('timeupdate',     onTime);
    a.addEventListener('durationchange', onDur);
    a.addEventListener('ended',          onEnded);
    a.addEventListener('error',          onError);
    return () => {
      a.removeEventListener('timeupdate',     onTime);
      a.removeEventListener('durationchange', onDur);
      a.removeEventListener('ended',          onEnded);
      a.removeEventListener('error',          onError);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Supabase history ──────────────────────────────────────────── */
  const { user } = useAuth();
  useEffect(() => {
    if (!currentSong?.youtubeId || !user?.id) return;
    supabase.from('listening_history').insert({
      user_id: user.id, youtube_id: currentSong.youtubeId,
      name: currentSong.name || null, artist: currentSong.artist || null,
      genre: currentSong.genre || null,
    }).then(({ error }) => { if (error) console.warn('[history]', error.message); });
  }, [currentSong?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Shuffle ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (shuffle && songs.length > 1) {
      const idx = songs.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      const ci = idx.indexOf(currentIndex);
      if (ci > 0) [idx[0], idx[ci]] = [idx[ci], idx[0]];
      setShuffledOrder(idx);
    } else {
      setShuffledOrder([]);
    }
  }, [shuffle, songs.length, currentIndex]);

  /* ── Seek ──────────────────────────────────────────────────────── */
  const seekTo = useCallback((t) => {
    if (playerType.current === 'youtube') {
      try { ytRef.current?.seekTo(t, true); } catch (_) {}
    } else {
      audioRef.current.currentTime = t;
    }
    setCurrentTime(t);
  }, []);

  /* ── setPlayerSongs — array or functional updater ──────────────── */
  const setPlayerSongs = useCallback((updaterOrArray, startIndex = 0) => {
    if (typeof updaterOrArray === 'function') {
      setSongs(updaterOrArray);
      // Functional form (used by radio) — don't reset index
    } else {
      setSongs(updaterOrArray);
      setCurrentIndex(startIndex);
    }
  }, []);

  /* ── Exported next / prev ──────────────────────────────────────── */
  const playNext = useCallback(() => {
    if (playerType.current === 'audio' && repeatMode === 'one') {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      return;
    }
    advance(1);
  }, [advance, repeatMode]);

  const playPrev = useCallback(() => {
    // If >3 s into the song, restart it instead of going back
    if (playerType.current === 'audio' && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0; return;
    }
    if (playerType.current === 'youtube') {
      try { if ((ytRef.current?.getCurrentTime?.() || 0) > 3) { ytRef.current.seekTo(0, true); return; } } catch (_) {}
    }
    advance(-1);
  }, [advance]);

  /* ── Toggles ───────────────────────────────────────────────────── */
  const toggleBackgroundDetail = useCallback(() => setShowBackgroundDetail(p => !p), []);
  const toggleShuffle          = useCallback(() => setShuffle(p => !p), []);
  const toggleRepeatMode       = useCallback(() =>
    setRepeatMode(p => p === 'off' ? 'all' : p === 'all' ? 'one' : 'off'), []);

  /* ── Context value ─────────────────────────────────────────────── */
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
    playerType: playerType.current,
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
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}