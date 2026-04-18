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
  const ytRef         = useRef(null);     // single YT player, lives for page lifetime
  const ytReadyRef    = useRef(false);
  const playerType    = useRef('audio');
  const timerRef      = useRef(null);
  const mountedRef    = useRef(true);

  // ── Mirror refs ─────────────────────────────────────────────────────
  // YT callbacks close over these at creation time and never update.
  // We keep refs in sync so they always read current values.
  const songsRef    = useRef([]);
  const idxRef      = useRef(0);
  const repeatRef   = useRef('off');
  const shuffleRef  = useRef(false);
  const shuffledRef = useRef([]);

  useEffect(() => { mountedRef.current  = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { songsRef.current    = songs;        }, [songs]);
  useEffect(() => { idxRef.current      = currentIndex; }, [currentIndex]);
  useEffect(() => { repeatRef.current   = repeatMode;   }, [repeatMode]);
  useEffect(() => { shuffleRef.current  = shuffle;      }, [shuffle]);
  useEffect(() => { shuffledRef.current = shuffledOrder;}, [shuffledOrder]);

  // ── Loading guard ────────────────────────────────────────────────────
  // TRUE from the moment we start loading a new song until it actually
  // starts playing (or fails). Prevents the audio 'error' event that fires
  // when reassigning .src, and the YT PAUSED buffering artifact, from
  // calling advanceNext() and cycling through the list.
  const loadingRef = useRef(false);

  const currentSong = songs[currentIndex];

  /* ── Tiny helpers ───────────────────────────────────────────────── */
  const needsYT = (song) =>
    !!(song && (song.source === 'youtube' ||
       (song.youtubeId && /^[A-Za-z0-9_-]+$/.test(song.youtubeId))));

  const getVideoId = (song) => {
    if (song.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(song.youtubeId)) return song.youtubeId;
    for (const field of [song.audio, song.streamUrl, song.url, song.src]) {
      if (!field) continue;
      const m = field.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
    return null;
  };

  /* ── Time tracking ──────────────────────────────────────────────── */
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
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

  /* ── advanceNext / advancePrev ──────────────────────────────────────
     Read refs only — safe to call from inside YT callbacks which are
     stale closures that never see updated state.
  ────────────────────────────────────────────────────────────────── */
  const advanceNext = useCallback(() => {
    if (!mountedRef.current) return;
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
    if (sh && sho.length) {
      const i = sho.indexOf(ci);
      next = i < sho.length - 1 ? sho[i + 1] : (rm === 'all' ? sho[0] : null);
    } else {
      next = ci < s.length - 1 ? ci + 1 : (rm === 'all' ? 0 : null);
    }
    if (next === null) { setIsPlaying(false); return; }
    setCurrentIndex(next);
    // isPlaying stays true — song-change effect handles playback
  }, []); // empty — reads refs

  const advancePrev = useCallback(() => {
    if (!mountedRef.current) return;
    const s   = songsRef.current;
    const ci  = idxRef.current;
    const rm  = repeatRef.current;
    const sh  = shuffleRef.current;
    const sho = shuffledRef.current;
    if (!s.length) return;

    if (playerType.current === 'audio' && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0; return;
    }
    if (playerType.current === 'youtube') {
      try { if ((ytRef.current?.getCurrentTime?.() || 0) > 3) { ytRef.current.seekTo(0, true); return; } } catch (_) {}
    }

    let prev;
    if (sh && sho.length) {
      const i = sho.indexOf(ci);
      prev = i > 0 ? sho[i - 1] : (rm === 'all' ? sho[sho.length - 1] : 0);
    } else {
      prev = ci > 0 ? ci - 1 : (rm === 'all' ? s.length - 1 : 0);
    }
    setCurrentIndex(prev);
  }, []); // empty — reads refs

  /* ── Single YT player — created once on mount ───────────────────────
     Song changes use loadVideoById() — never destroys the player.
     This is the only reliable approach for iOS Safari: the player must
     exist before a user gesture to preserve the autoplay permission.
  ────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!document.getElementById('yt-api-script')) {
      const s = document.createElement('script');
      s.id  = 'yt-api-script';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }

    // Tiny off-screen div. NOT display:none — iOS won't play audio from hidden elements.
    if (!document.getElementById('yt-anchor')) {
      const d = document.createElement('div');
      d.id = 'yt-anchor';
      d.style.cssText =
        'position:fixed;top:-4px;left:-4px;width:2px;height:2px;' +
        'opacity:0.01;pointer-events:none;z-index:-1;';
      document.body.appendChild(d);
    }

    const build = () => {
      if (ytReadyRef.current || !window.YT?.Player) return;
      ytRef.current = new window.YT.Player('yt-anchor', {
        width: '2', height: '2',
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1, fs: 0,
          iv_load_policy: 3, modestbranding: 1, rel: 0,
          playsinline: 1, origin: window.location.origin,
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            startTimer();
          },
          onStateChange: (e) => {
            if (!mountedRef.current) return;
            const S = window.YT?.PlayerState;
            if (!S) return;
            if (e.data === S.PLAYING) {
              try { setDuration(e.target.getDuration() || 0); } catch (_) {}
              // Video is genuinely playing — clear the load guard
              loadingRef.current = false;
              setIsPlaying(true);
            } else if (e.data === S.PAUSED) {
              // Ignore PAUSED while loading — loadVideoById fires PAUSED as
              // a buffering artifact before the video actually starts.
              if (!loadingRef.current) setIsPlaying(false);
            } else if (e.data === S.ENDED) {
              if (!loadingRef.current) advanceNext();
            }
          },
          onError: () => {
            loadingRef.current = false;
            if (mountedRef.current) advanceNext();
          },
        },
      });
    };

    if (window.YT?.Player) build();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (typeof prev === 'function') prev(); build(); };
    }

    return stopTimer;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Song-change effect ──────────────────────────────────────────────
     Deps: [currentSong?.id, currentIndex]
     isPlaying is NOT here — every play/pause toggle must not re-run this.
     songs is NOT here — we only care that the song identity changed.
  ────────────────────────────────────────────────────────────────── */
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

    // Raise guard FIRST — before any async work or src changes
    loadingRef.current = true;

    if (needsYT(currentSong)) {
      playerType.current = 'youtube';

      const videoId = getVideoId(currentSong);
      if (!videoId) {
        console.error('[Player] bad videoId for:', currentSong.name);
        loadingRef.current = false;
        advanceNext();
        return;
      }

      audioRef.current.pause();
      audioRef.current.src = '';
      setCurrentTime(0);
      setDuration(0);

      const load = () => {
        if (!ytReadyRef.current || !ytRef.current) { setTimeout(load, 80); return; }
        try {
          // loadVideoById auto-plays AND keeps the iOS gesture chain alive.
          // loadingRef stays TRUE until onStateChange PLAYING fires above.
          ytRef.current.loadVideoById({ videoId, startSeconds: 0 });
        } catch (err) {
          console.error('[YT] loadVideoById:', err);
          loadingRef.current = false;
          advanceNext();
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

      // loadingRef is already TRUE here, so the 'error' event that browsers
      // fire when .src is reassigned on an element with a blob URL is silenced.
      audioRef.current.pause();
      audioRef.current.src = src;
      audioRef.current.load();

      audioRef.current
        .play()
        .then(() => {
          loadingRef.current = false;
          if (mountedRef.current) setIsPlaying(true);
        })
        .catch(() => {
          // Autoplay blocked — user must tap play manually
          loadingRef.current = false;
          if (mountedRef.current) setIsPlaying(false);
        });
    }
  }, [currentSong?.id, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Play / pause effect ─────────────────────────────────────────────
     Responds only to isPlaying flipping. Never loads a song.
     Skips while loadingRef is true — the song-change effect handles
     initial playback as part of the load sequence.
  ────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!currentSong || loadingRef.current) return;
    if (playerType.current === 'youtube') {
      try {
        if (isPlaying) ytRef.current?.playVideo();
        else           ytRef.current?.pauseVideo();
      } catch (_) {}
    } else {
      if (isPlaying) audioRef.current.play().catch(() => setIsPlaying(false));
      else           audioRef.current.pause();
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Volume / mute ──────────────────────────────────────────────── */
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

  /* ── Audio element events ────────────────────────────────────────────
     Attached ONCE (empty deps). Handlers read loadingRef so spurious
     'error' events during src reassignment don't advance the song.
  ────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const a = audioRef.current;
    const onTime  = () => setCurrentTime(a.currentTime);
    const onDur   = () => { if (a.duration > 0) setDuration(a.duration); };
    const onEnded = () => { if (!loadingRef.current) advanceNext(); };
    const onError = () => { if (!loadingRef.current) advanceNext(); };
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

  /* ── Supabase history ───────────────────────────────────────────── */
  const { user } = useAuth();
  useEffect(() => {
    if (!currentSong?.youtubeId || !user?.id) return;
    supabase.from('listening_history').insert({
      user_id: user.id, youtube_id: currentSong.youtubeId,
      name: currentSong.name || null, artist: currentSong.artist || null,
      genre: currentSong.genre || null,
    }).then(({ error }) => { if (error) console.warn('[history]', error.message); });
  }, [currentSong?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Shuffle ────────────────────────────────────────────────────── */
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

  /* ── Seek ───────────────────────────────────────────────────────── */
  const seekTo = useCallback((t) => {
    if (playerType.current === 'youtube') {
      try { ytRef.current?.seekTo(t, true); } catch (_) {}
    } else {
      audioRef.current.currentTime = t;
    }
    setCurrentTime(t);
  }, []);

  /* ── setPlayerSongs ──────────────────────────────────────────────────
     ALWAYS pass startIndex here — never call setCurrentIndex separately
     after this. Calling both separately causes a double state update
     that can skip the song-change effect on browsers that batch updates.
  ────────────────────────────────────────────────────────────────── */
  const setPlayerSongs = useCallback((updaterOrArray, startIndex = 0) => {
    if (typeof updaterOrArray === 'function') {
      // Functional form used by radio — appends songs, doesn't change index
      setSongs(updaterOrArray);
    } else {
      setSongs(updaterOrArray);
      setCurrentIndex(startIndex);
    }
  }, []);

  /* ── Misc toggles ───────────────────────────────────────────────── */
  const toggleBackgroundDetail = useCallback(() => setShowBackgroundDetail(p => !p), []);
  const toggleShuffle          = useCallback(() => setShuffle(p => !p), []);
  const toggleRepeatMode       = useCallback(() =>
    setRepeatMode(p => p === 'off' ? 'all' : p === 'all' ? 'one' : 'off'), []);

  /* ── Context value ──────────────────────────────────────────────── */
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
    playNext:  advanceNext,
    playPrev:  advancePrev,
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