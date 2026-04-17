// src/context/PlayerContext.jsx
import React, {
  createContext, useContext,
  useState, useRef, useEffect, useCallback,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {

  /* ─── State ─────────────────────────────────────────────────────── */
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

  /* ─── Refs ───────────────────────────────────────────────────────── */
  const audioRef        = useRef(new Audio());
  const ytPlayerRef     = useRef(null);   // single YT instance, never destroyed
  const ytReadyRef      = useRef(false);  // true once onReady fires
  const playerTypeRef   = useRef('audio');
  const timeIntervalRef = useRef(null);

  // Mirror refs — always hold the current value so YT callbacks
  // (which are created once and never re-bound) can read fresh state
  // without being in any dependency array.
  const songsRef      = useRef([]);
  const idxRef        = useRef(0);
  const playingRef    = useRef(false);
  const repeatRef     = useRef('off');
  const shuffleRef    = useRef(false);
  const shuffledRef   = useRef([]);

  // Sync mirrors
  useEffect(() => { songsRef.current    = songs;        }, [songs]);
  useEffect(() => { idxRef.current      = currentIndex; }, [currentIndex]);
  useEffect(() => { playingRef.current  = isPlaying;    }, [isPlaying]);
  useEffect(() => { repeatRef.current   = repeatMode;   }, [repeatMode]);
  useEffect(() => { shuffleRef.current  = shuffle;      }, [shuffle]);
  useEffect(() => { shuffledRef.current = shuffledOrder;}, [shuffledOrder]);

  // Guards
  const loadingRef  = useRef(false); // true while a song is being loaded → blocks error/ended handlers
  const mountedRef  = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const currentSong = songs[currentIndex];

  /* ─── Helpers ────────────────────────────────────────────────────── */
  const needsYouTube = (song) => {
    if (!song) return false;
    return song.source === 'youtube'
      || !!(song.youtubeId && /^[A-Za-z0-9_-]{1,}$/.test(song.youtubeId));
  };

  const extractVideoId = (url) => {
    if (!url) return null;
    for (const re of [
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtu\.be\/([^?]+)/,
      /youtube\.com\/embed\/([^?]+)/,
    ]) { const m = url.match(re); if (m) return m[1]; }
    return null;
  };

  /* ─── Time tracking ──────────────────────────────────────────────── */
  const startTimeTracking = useCallback(() => {
    if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    timeIntervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      try {
        const p = ytPlayerRef.current;
        if (!p?.getCurrentTime) return;
        const t = p.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t)) setCurrentTime(t);
        const d = p.getDuration?.() || 0;
        if (d > 0) setDuration(d);
      } catch (_) {}
    }, 500);
  }, []);

  const stopTimeTracking = useCallback(() => {
    if (timeIntervalRef.current) { clearInterval(timeIntervalRef.current); timeIntervalRef.current = null; }
  }, []);

  /* ─── Advance next/prev — reads refs, safe inside stale callbacks ─── */
  const advanceNext = useCallback(() => {
    if (!mountedRef.current) return;
    const s   = songsRef.current;
    const ci  = idxRef.current;
    const rm  = repeatRef.current;
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
      const i = sho.indexOf(ci);
      if (i < sho.length - 1)   next = sho[i + 1];
      else if (rm === 'all')     next = sho[0];
      else { setIsPlaying(false); return; }
    } else {
      if (ci < s.length - 1)    next = ci + 1;
      else if (rm === 'all')     next = 0;
      else { setIsPlaying(false); return; }
    }
    setCurrentIndex(next);
    // isPlaying stays true — song-change effect will start playback
  }, []); // deliberately empty — reads refs

  const advancePrev = useCallback(() => {
    if (!mountedRef.current) return;
    const s   = songsRef.current;
    const ci  = idxRef.current;
    const rm  = repeatRef.current;
    const sh  = shuffleRef.current;
    const sho = shuffledRef.current;
    if (!s.length) return;
    if (playerTypeRef.current === 'audio' && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0; return;
    }
    if (playerTypeRef.current === 'youtube') {
      try { if ((ytPlayerRef.current?.getCurrentTime?.() || 0) > 3) { ytPlayerRef.current.seekTo(0, true); return; } } catch (_) {}
    }
    let prev;
    if (sh && sho.length) {
      const i = sho.indexOf(ci);
      if (i > 0)                prev = sho[i - 1];
      else if (rm === 'all')    prev = sho[sho.length - 1];
      else                      prev = 0;
    } else {
      if (ci > 0)               prev = ci - 1;
      else if (rm === 'all')    prev = s.length - 1;
      else                      prev = 0;
    }
    setCurrentIndex(prev);
  }, []); // reads refs

  /* ─── Create the single YT player on mount ───────────────────────
     Never destroyed between songs. loadVideoById() switches songs.
     This is the only reliable way to play on iOS Safari — the player
     must be created during a real user gesture, then reused.
  ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    // Inject API script once
    if (!document.getElementById('yt-iframe-api')) {
      const s  = document.createElement('script');
      s.id     = 'yt-iframe-api';
      s.src    = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }

    // Off-screen container — NOT display:none, that silences iOS audio
    if (!document.getElementById('yt-root')) {
      const d = document.createElement('div');
      d.id = 'yt-root';
      d.style.cssText = 'position:fixed;top:-4px;left:-4px;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1;';
      document.body.appendChild(d);
    }

    const create = () => {
      if (ytReadyRef.current) return;
      if (!window.YT?.Player)  return;

      ytPlayerRef.current = new window.YT.Player('yt-root', {
        width: '2', height: '2',
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1, fs: 0,
          iv_load_policy: 3, modestbranding: 1, rel: 0,
          playsinline: 1,              // iOS: don't hijack to fullscreen
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            startTimeTracking();
          },
          onStateChange: (e) => {
            if (!mountedRef.current) return;
            const S = window.YT?.PlayerState;
            if (!S) return;
            if (e.data === S.PLAYING) {
              try { setDuration(e.target.getDuration() || 0); } catch (_) {}
              setIsPlaying(true);
            } else if (e.data === S.PAUSED) {
              // PAUSED fires as a buffering artefact right after loadVideoById.
              // Only treat it as a real pause if we're not in the middle of loading.
              if (!loadingRef.current) setIsPlaying(false);
            } else if (e.data === S.ENDED) {
              if (!loadingRef.current) advanceNext();
            }
          },
          onError: () => {
            if (!loadingRef.current && mountedRef.current) advanceNext();
          },
        },
      });
    };

    if (window.YT?.Player) {
      create();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (typeof prev === 'function') prev(); create(); };
    }

    return stopTimeTracking;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Song-change effect ─────────────────────────────────────────
     ONLY runs when the actual song changes (id or index).
     isPlaying is deliberately excluded from deps — toggling play
     must never re-trigger this or we get the cycling bug.
  ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!currentSong) {
      loadingRef.current = false;
      stopTimeTracking();
      try { ytPlayerRef.current?.pauseVideo(); } catch (_) {}
      try { audioRef.current.pause(); audioRef.current.src = ''; } catch (_) {}
      setIsPlaying(false);
      return;
    }

    loadingRef.current = true; // block error/ended/paused handlers during load

    if (needsYouTube(currentSong)) {
      playerTypeRef.current = 'youtube';

      const videoId = currentSong.youtubeId
        || extractVideoId(currentSong.streamUrl)
        || extractVideoId(currentSong.audio);

      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        console.error('[Player] bad videoId for', currentSong.name);
        loadingRef.current = false;
        advanceNext();
        return;
      }

      // Silence the audio player
      try { audioRef.current.pause(); audioRef.current.src = ''; } catch (_) {}
      setCurrentTime(0);
      setDuration(0);

      const doLoad = () => {
        if (!ytReadyRef.current || !ytPlayerRef.current) {
          setTimeout(doLoad, 80);
          return;
        }
        try {
          ytPlayerRef.current.loadVideoById({ videoId, startSeconds: 0 });
          // loadVideoById auto-plays; mark loading done after a beat
          setTimeout(() => { loadingRef.current = false; }, 1500);
        } catch (e) {
          console.error('[YT] loadVideoById failed:', e);
          loadingRef.current = false;
          advanceNext();
        }
      };
      doLoad();

    } else {
      playerTypeRef.current = 'audio';
      stopTimeTracking();
      try { ytPlayerRef.current?.pauseVideo(); } catch (_) {}

      const src = currentSong.audio || currentSong.url || currentSong.audioUrl || currentSong.src;
      if (!src) {
        console.error('[Player] no src for', currentSong.name);
        loadingRef.current = false;
        return;
      }

      // Remove listeners BEFORE changing src so the 'error' event that fires
      // when reassigning src on a blob URL doesn't advance the song.
      audioRef.current.pause();
      audioRef.current.src = src;
      audioRef.current.load();

      audioRef.current.play()
        .then(() => {
          loadingRef.current = false;
          if (mountedRef.current) setIsPlaying(true);
        })
        .catch(() => {
          loadingRef.current = false;
          // Autoplay blocked — UI will show paused state, user taps play
          if (mountedRef.current) setIsPlaying(false);
        });
    }
  }, [currentSong?.id, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Play/pause toggle ──────────────────────────────────────────
     Only runs when isPlaying changes. Never loads a new song.
  ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!currentSong || loadingRef.current) return;
    if (playerTypeRef.current === 'youtube') {
      try {
        if (isPlaying) ytPlayerRef.current?.playVideo();
        else           ytPlayerRef.current?.pauseVideo();
      } catch (_) {}
    } else {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Volume & mute ──────────────────────────────────────────────── */
  useEffect(() => {
    const v = isMuted ? 0 : volume;
    audioRef.current.volume = v;
    try { ytPlayerRef.current?.setVolume(v * 100); } catch (_) {}
  }, [volume, isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(m => {
      const next = !m;
      audioRef.current.muted = next;
      try { next ? ytPlayerRef.current?.mute() : ytPlayerRef.current?.unMute(); } catch (_) {}
      return next;
    });
  }, []);

  /* ─── Audio element events ───────────────────────────────────────
     Attached once. Use refs for currentIndex/songs so we never need
     to re-attach (which itself can fire spurious error events).
  ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const audio = audioRef.current;
    const onTime  = () => setCurrentTime(audio.currentTime);
    const onDur   = () => { if (audio.duration > 0) setDuration(audio.duration); };
    const onEnded = () => { if (!loadingRef.current) advanceNext(); };
    const onError = () => { if (!loadingRef.current) advanceNext(); };

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
  }, []); // deliberately empty — handlers read refs, not state

  /* ─── Supabase history ───────────────────────────────────────────── */
  const { user } = useAuth();
  useEffect(() => {
    if (!currentSong?.youtubeId || !user?.id) return;
    supabase.from('listening_history').insert({
      user_id: user.id, youtube_id: currentSong.youtubeId,
      name: currentSong.name || null, artist: currentSong.artist || null, genre: currentSong.genre || null,
    }).then(({ error }) => { if (error) console.warn('[history]', error.message); });
  }, [currentSong?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Shuffle ────────────────────────────────────────────────────── */
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

  /* ─── Seek ───────────────────────────────────────────────────────── */
  const seekTo = useCallback((time) => {
    if (playerTypeRef.current === 'youtube') {
      try { ytPlayerRef.current?.seekTo(time, true); } catch (_) {}
    } else {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  /* ─── setPlayerSongs — supports array and functional updater ─────── */
  const setPlayerSongs = useCallback((newSongsOrUpdater, startIndex = 0) => {
    if (typeof newSongsOrUpdater === 'function') {
      setSongs(newSongsOrUpdater);
      // Don't reset index — used by radio to append without interrupting playback
    } else {
      setSongs(newSongsOrUpdater);
      setCurrentIndex(startIndex);
    }
  }, []);

  /* ─── Misc toggles ───────────────────────────────────────────────── */
  const toggleBackgroundDetail = useCallback(() => setShowBackgroundDetail(p => !p), []);
  const toggleShuffle          = useCallback(() => setShuffle(p => !p), []);
  const toggleRepeatMode       = useCallback(() =>
    setRepeatMode(p => p === 'off' ? 'all' : p === 'all' ? 'one' : 'off'), []);

  /* ─── Context value ──────────────────────────────────────────────── */
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
    playNext:             advanceNext,
    playPrev:             advancePrev,
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