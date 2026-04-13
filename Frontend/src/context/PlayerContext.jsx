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
  // Flag to prevent duplicate player creation when already in progress
  const isCreatingPlayer   = useRef(false);

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

  // ──────────────────────────────────────────────────────────────────────────
  // NEW: Synchronously create and play a YouTube song.
  // Must be called inside a user‑gesture handler (click, keypress, etc.)
  // ──────────────────────────────────────────────────────────────────────────
  const createAndPlayYouTube = useCallback((videoId, shouldPlay = true) => {
    // Clean up any existing player first
    cleanupYouTube();

    // Always recreate the container so IFrame API gets a fresh DOM node
    const oldCtn = document.getElementById('youtube-player-container');
    if (oldCtn) oldCtn.remove();
    const container = document.createElement('div');
    container.id = 'youtube-player-container';
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(container);

    // Wait for YT API to be available (it usually is after script load)
    const init = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(init, 50);
        return;
      }

      try {
        youtubePlayerRef.current = new window.YT.Player('youtube-player-container', {
          height: '1',
          width: '1',
          videoId,
          playerVars: {
            autoplay: 0,          // Do NOT autoplay – we'll call playVideo() manually
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,        // Critical for iOS
          },
          events: {
            onReady: (event) => {
              // Set volume immediately
              event.target.setVolume(volume * 100);
              const dur = event.target.getDuration();
              if (dur > 0) setDuration(dur);
              // Do NOT call playVideo() here – it would be asynchronous and blocked by iOS
            },
            onStateChange: (event) => {
              const S = window.YT.PlayerState;
              if (event.data === S.ENDED) {
                // Auto‑next song is allowed in 'ended' event handlers
                playNext();
              } else if (event.data === S.PLAYING) {
                try { const d = event.target.getDuration(); if (d > 0) setDuration(d); } catch (_) {}
                setIsPlaying(true);
              } else if (event.data === S.PAUSED) {
                setIsPlaying(false);
              }
            },
            onError: (event) => {
              console.error('YouTube player error code:', event.data);
              if (songs.length > 0 && currentIndex < songs.length - 1) {
                setCurrentIndex(prev => prev + 1);
              } else {
                setIsPlaying(false);
              }
            },
          },
        });

        // 🚀 Call playVideo() SYNCHRONOUSLY right after construction.
        // This happens inside the user‑gesture call stack and satisfies iOS.
        if (shouldPlay && youtubePlayerRef.current?.playVideo) {
          youtubePlayerRef.current.playVideo();
        }

        // Set up time update interval
        if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
        timeUpdateInterval.current = setInterval(() => {
          try {
            if (youtubePlayerRef.current?.getCurrentTime) {
              const t = youtubePlayerRef.current.getCurrentTime();
              if (!isNaN(t) && t > 0) setCurrentTime(t);
              const d = youtubePlayerRef.current.getDuration?.();
              if (d > 0) setDuration(prev => prev > 0 ? prev : d);
            }
          } catch (_) {}
        }, 500);

        isCreatingPlayer.current = false;
      } catch (ytErr) {
        console.error('YT.Player init failed:', ytErr);
        setIsPlaying(false);
        isCreatingPlayer.current = false;
      }
    };

    init();
  }, [cleanupYouTube, volume, playNext, songs.length, currentIndex]);

  // ──────────────────────────────────────────────────────────────────────────
  // Switch song – now triggered by user actions (click on song, play/pause, etc.)
  // The effect only performs cleanup and setup; actual YouTube creation is handled
  // in the user‑gesture callbacks (playSongAtIndex, play, etc.)
  // ──────────────────────────────────────────────────────────────────────────
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
        console.error('Invalid YouTube video ID:', videoId);
        setIsPlaying(false);
        return;
      }

      // We do NOT create the player here anymore.
      // Instead, we rely on a user gesture to call createAndPlayYouTube.
      // However, we must clean up the old player.
      cleanupYouTube();
      // Optionally, you could pre‑create a muted player for background loading,
      // but to keep it simple we create it on demand.
    } else {
      cleanupYouTube();
      const src = currentSong.audio || currentSong.url || currentSong.audioUrl || currentSong.src;
      if (!src) { console.error('No audio source'); return; }
      audioRef.current.src = src;
      audioRef.current.load();
      // Autoplay for audio may still be blocked, but we'll handle that in play() method
    }
  }, [currentSong?.id, currentIndex, songs.length, needsYouTubePlayer, extractYouTubeId, cleanupYouTube]);

  // ──────────────────────────────────────────────────────────────────────────
  // Centralised play/pause logic – used by both UI buttons and programmatic
  // actions (like autoplay after next/prev).
  // ──────────────────────────────────────────────────────────────────────────
  const play = useCallback(async () => {
    if (!currentSong) return;

    if (playerTypeRef.current === 'youtube') {
      const videoId = currentSong.youtubeId ||
                      extractYouTubeId(currentSong.streamUrl) ||
                      extractYouTubeId(currentSong.audio);
      if (!videoId) return;

      // If player doesn't exist or its video ID doesn't match, create it now.
      // This call must originate from a user gesture (e.g., clicking a Play button).
      if (!youtubePlayerRef.current || youtubePlayerRef.current.getVideoData?.()?.video_id !== videoId) {
        if (isCreatingPlayer.current) return;
        isCreatingPlayer.current = true;
        createAndPlayYouTube(videoId, true);
      } else {
        // Player exists – call playVideo() directly (still within the gesture stack)
        youtubePlayerRef.current?.playVideo();
      }
      setIsPlaying(true);
    } else {
      // Audio element
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Audio play() blocked:', err.message);
        setIsPlaying(false);
      }
    }
  }, [currentSong, extractYouTubeId, createAndPlayYouTube]);

  const pause = useCallback(() => {
    if (playerTypeRef.current === 'youtube') {
      youtubePlayerRef.current?.pauseVideo();
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
  // playSongAtIndex – called when a user explicitly selects a song.
  // This is the perfect place to create and play the YouTube player synchronously.
  // ──────────────────────────────────────────────────────────────────────────
  const playSongAtIndex = useCallback((index) => {
    if (index === currentIndex && currentSong) {
      // Same song – just toggle play/pause (or ensure it's playing)
      if (!isPlaying) play();
      return;
    }

    // Change the current song
    setCurrentIndex(index);

    // Immediately create and play the new YouTube song if needed.
    // This runs synchronously within the same user‑gesture call stack.
    const song = songs[index];
    if (!song) return;

    const useYouTube = needsYouTubePlayer(song);
    if (useYouTube) {
      const videoId = song.youtubeId || extractYouTubeId(song.streamUrl) || extractYouTubeId(song.audio);
      if (videoId && !isCreatingPlayer.current) {
        isCreatingPlayer.current = true;
        createAndPlayYouTube(videoId, true);
        setIsPlaying(true);
      }
    } else {
      // Audio song
      audioRef.current.src = song.audio || song.url || song.audioUrl || song.src;
      audioRef.current.load();
      audioRef.current.play().catch(err => console.warn('Audio autoplay blocked:', err));
      setIsPlaying(true);
    }
  }, [currentIndex, currentSong, isPlaying, play, songs, needsYouTubePlayer, extractYouTubeId, createAndPlayYouTube]);

  // ──────────────────────────────────────────────────────────────────────────
  // playNext / playPrev – may be called from ended event or UI buttons.
  // For UI buttons, they will be inside a user gesture; for ended event,
  // iOS allows autoplay because it's a media‑ended callback.
  // ──────────────────────────────────────────────────────────────────────────
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
    const nextSong = songs[nextIndex];
    const useYouTube = needsYouTubePlayer(nextSong);
    if (useYouTube) {
      const videoId = nextSong.youtubeId || extractYouTubeId(nextSong.streamUrl) || extractYouTubeId(nextSong.audio);
      if (videoId) {
        // When called from ended event, this is still allowed by iOS
        createAndPlayYouTube(videoId, true);
        setIsPlaying(true);
      }
    } else {
      audioRef.current.src = nextSong.audio || nextSong.url || nextSong.audioUrl || nextSong.src;
      audioRef.current.load();
      audioRef.current.play().catch(err => console.warn('Audio playNext blocked:', err));
      setIsPlaying(true);
    }
  }, [songs, currentIndex, shuffle, shuffledOrder, repeatMode, needsYouTubePlayer, extractYouTubeId, createAndPlayYouTube]);

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
    const prevSong = songs[prevIndex];
    const useYouTube = needsYouTubePlayer(prevSong);
    if (useYouTube) {
      const videoId = prevSong.youtubeId || extractYouTubeId(prevSong.streamUrl) || extractYouTubeId(prevSong.audio);
      if (videoId) {
        createAndPlayYouTube(videoId, true);
        setIsPlaying(true);
      }
    } else {
      audioRef.current.src = prevSong.audio || prevSong.url || prevSong.audioUrl || prevSong.src;
      audioRef.current.load();
      audioRef.current.play().catch(err => console.warn('Audio playPrev blocked:', err));
      setIsPlaying(true);
    }
  }, [songs, currentIndex, shuffle, shuffledOrder, repeatMode, needsYouTubePlayer, extractYouTubeId, createAndPlayYouTube]);

  // ──────────────────────────────────────────────────────────────────────────
  // setPlayerSongs – used to load a new playlist and start playing.
  // This is always triggered by a user action (e.g., clicking a playlist).
  // ──────────────────────────────────────────────────────────────────────────
  const setPlayerSongs = useCallback((newSongs, startIndex = 0) => {
    setSongs(newSongs);
    if (newSongs.length > 0) {
      playSongAtIndex(startIndex);
    }
  }, [playSongAtIndex]);

  // ──────────────────────────────────────────────────────────────────────────
  // Other existing hooks and utilities (volume, seek, shuffle, etc.)
  // ──────────────────────────────────────────────────────────────────────────
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

  const toggleShuffle     = useCallback(() => setShuffle(prev => !prev), []);
  const toggleRepeatMode  = useCallback(() => {
    setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  }, []);

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

  // Record listening history (unchanged)
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
  }, [currentSong?.id, user]);

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
    // Expose new methods for UI components
    play,
    pause,
    togglePlay,
    playSongAtIndex,   // Use this when a song is explicitly selected
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