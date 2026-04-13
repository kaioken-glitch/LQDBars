// src/context/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
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

  const audioRef        = useRef(new Audio());
  const ytPlayerRef     = useRef(null);
  const ytReadyRef      = useRef(false);
  const ytPendingRef    = useRef(null);
  const playerTypeRef   = useRef('audio');
  const timeIntervalRef = useRef(null);

  // ── LIVE REFS so YT callbacks never read stale closure values ──
  const songsRef        = useRef([]);
  const currentIndexRef = useRef(0);
  const isPlayingRef    = useRef(false);
  const repeatModeRef   = useRef('off');
  const shuffleRef      = useRef(false);
  const shuffledOrderRef= useRef([]);

  // Keep refs in sync
  useEffect(() => { songsRef.current        = songs;        }, [songs]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { isPlayingRef.current    = isPlaying;    }, [isPlaying]);
  useEffect(() => { repeatModeRef.current   = repeatMode;   }, [repeatMode]);
  useEffect(() => { shuffleRef.current      = shuffle;      }, [shuffle]);
  useEffect(() => { shuffledOrderRef.current= shuffledOrder;}, [shuffledOrder]);

  const currentSong = songs[currentIndex];

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

  /* ── Time tracking ── */
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

  /* ── advance to next — reads from refs, safe from any callback ── */
  const advanceToNext = useCallback(() => {
    const s   = songsRef.current;
    const ci  = currentIndexRef.current;
    const rm  = repeatModeRef.current;
    const sh  = shuffleRef.current;
    const so  = shuffledOrderRef.current;

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
    if (sh && so.length) {
      const idx = so.indexOf(ci);
      if (idx < so.length - 1) next = so[idx + 1];
      else if (rm === 'all') next = so[0];
      else { setIsPlaying(false); return; }
    } else {
      if (ci < s.length - 1) next = ci + 1;
      else if (rm === 'all') next = 0;
      else { setIsPlaying(false); return; }
    }
    setCurrentIndex(next);
  }, []); // stable — reads only refs

  /* ── Single YT player, created once ── */
  useEffect(() => {
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id  = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    let ctn = document.getElementById('yt-player-singleton');
    if (!ctn) {
      ctn = document.createElement('div');
      ctn.id = 'yt-player-singleton';
      ctn.style.cssText = 'position:fixed;top:-2px;left:-2px;width:2px;height:2px;opacity:0;pointer-events:none;';
      document.body.appendChild(ctn);
    }

    const createPlayer = () => {
      if (ytReadyRef.current) return;
      if (!window.YT?.Player) { setTimeout(createPlayer, 150); return; }

      ytPlayerRef.current = new window.YT.Player('yt-player-singleton', {
        width: '2', height: '2',
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1, fs: 0,
          iv_load_policy: 3, modestbranding: 1, rel: 0,
          playsinline: 1, origin: window.location.origin,
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            if (ytPendingRef.current) {
              const { videoId, play } = ytPendingRef.current;
              ytPendingRef.current = null;
              ytPlayerRef.current.loadVideoById(videoId);
              if (play) {
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
              // Use advanceToNext which reads live refs — no stale closure
              advanceToNext();
            } else if (event.data === S.PLAYING) {
              try {
                const d = event.target.getDuration();
                if (d > 0) setDuration(d);
              } catch (_) {}
              setIsPlaying(true);
            } else if (event.data === S.PAUSED) {
              // Only set paused if we didn't trigger it ourselves (avoid flicker)
              if (isPlayingRef.current) {
                // YT paused externally — sync state
                setIsPlaying(false);
              }
            }
          },
          onError: (event) => {
            console.error('[YT] error code:', event.data);
            advanceToNext();
          },
        },
      });
    };

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      createPlayer();
    };

    if (window.YT?.Player) createPlayer();

    return () => { stopTimeTracking(); };
  }, []); // eslint-disable-line

  /* ── Song change — load new track ── */
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
        // Skip bad video rather than getting stuck
        advanceToNext();
        return;
      }

      try { audioRef.current.pause(); audioRef.current.src = ''; } catch (_) {}
      setCurrentTime(0);
      setDuration(0);

      if (!ytReadyRef.current) {
        ytPendingRef.current = { videoId, play: true };
        return;
      }

      try {
        ytPlayerRef.current.loadVideoById({ videoId, startSeconds: 0 });
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

  /* ── Play / pause toggle ── */
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

  /* ── Volume ── */
  useEffect(() => {
    if (playerTypeRef.current === 'youtube') {
      try { ytPlayerRef.current?.setVolume(isMuted ? 0 : volume * 100); } catch (_) {}
    } else {
      audioRef.current.volume = volume;
      audioRef.current.muted  = isMuted;
    }
  }, [volume, isMuted]);

  /* ── Record play history ── */
  const { user } = useAuth();
  useEffect(() => {
    if (!currentSong?.youtubeId || !user) return;
    supabase.from('listening_history').insert({
      user_id:  user.id,
      youtube_id: currentSong.youtubeId,
      name:   currentSong.name   || null,
      artist: currentSong.artist || null,
      genre:  currentSong.genre  || null,
    }).then(({ error }) => { if (error) console.warn('[history]', error.message); });
  }, [currentSong?.id]); // eslint-disable-line

  /* ── Mute ── */
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (playerTypeRef.current === 'youtube') {
        try { ytPlayerRef.current?.[next ? 'mute' : 'unMute']?.(); } catch (_) {}
      } else {
        audioRef.current.muted = next;
      }
      return next;
    });
  }, []);

  /* ── Shuffle order ── */
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
  }, [shuffle, songs.length, currentIndex]); // eslint-disable-line

  /* ── playNext / playPrev — also use refs for safety ── */
  const playNext = useCallback(() => advanceToNext(), [advanceToNext]);

  const playPrev = useCallback(() => {
    const s  = songsRef.current;
    const ci = currentIndexRef.current;
    const rm = repeatModeRef.current;
    const sh = shuffleRef.current;
    const so = shuffledOrderRef.current;

    if (!s.length) return;

    // If more than 3s in, restart current track
    if (playerTypeRef.current === 'audio' && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0; return;
    }
    if (playerTypeRef.current === 'youtube') {
      try { if (ytPlayerRef.current?.getCurrentTime?.() > 3) { ytPlayerRef.current.seekTo(0, true); return; } } catch (_) {}
    }

    let prev;
    if (sh && so.length) {
      const idx = so.indexOf(ci);
      if (idx > 0) prev = so[idx - 1];
      else if (rm === 'all') prev = so[so.length - 1];
      else prev = 0;
    } else {
      if (ci > 0) prev = ci - 1;
      else if (rm === 'all') prev = s.length - 1;
      else prev = 0;
    }
    setCurrentIndex(prev);
  }, []); // stable — reads only refs

  const toggleShuffle    = useCallback(() => setShuffle(p => !p), []);
  const toggleRepeatMode = useCallback(() => setRepeatMode(p =>
    p === 'off' ? 'all' : p === 'all' ? 'one' : 'off'
  ), []);

  /* ── Seek ── */
  const seekTo = useCallback((time) => {
    if (playerTypeRef.current === 'youtube') {
      try { ytPlayerRef.current?.seekTo(time, true); setCurrentTime(time); } catch (_) {}
    } else {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  /* ── setPlayerSongs ── */
  const setPlayerSongs = useCallback((newSongsOrUpdater, startIndex = 0) => {
    if (typeof newSongsOrUpdater === 'function') {
      setSongs(newSongsOrUpdater);
      // Don't reset index for functional updates (radio queue injection etc.)
    } else {
      setSongs(newSongsOrUpdater);
      setCurrentIndex(startIndex);
    }
  }, []);

  /* ── Audio element events ── */
  useEffect(() => {
    const audio = audioRef.current;
    const onTime  = () => setCurrentTime(audio.currentTime);
    const onDur   = () => setDuration(audio.duration);
    const onEnded = () => advanceToNext();
    const onError = () => {
      console.error('Audio error:', audio.error);
      advanceToNext();
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
  }, [advanceToNext]);

  /* ── setSongs exposed directly for radio queue injection ── */
  const value = {
    songs, setSongs, setPlayerSongs,
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