// src/context/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

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

  // ── Library songs — persisted to localStorage ──
  const [librarySongs, setLibrarySongsRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lb:library_songs') || '[]'); } catch { return []; }
  });

  const setLibrarySongs = useCallback((updater) => {
    setLibrarySongsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('lb:library_songs', JSON.stringify(next)); } catch (_) {}
      return next;
    });
  }, []);

  const addToLibrary = useCallback((song) => {
    if (!song) return;
    setLibrarySongsRaw(prev => {
      if (prev.some(s => s.id === song.id)) return prev; // no duplicates
      const next = [...prev, { ...song, savedAt: Date.now() }];
      try { localStorage.setItem('lb:library_songs', JSON.stringify(next)); } catch (_) {}
      return next;
    });
  }, []);

  const audioRef = useRef(new Audio());
  const youtubePlayerRef = useRef(null);
  const playerTypeRef = useRef('audio');
  const timeUpdateInterval = useRef(null);

  const currentSong = songs[currentIndex];

  const toggleBackgroundDetail = useCallback(() => {
    setShowBackgroundDetail(prev => !prev);
  }, []);

  const needsYouTubePlayer = useCallback((song) => {
    if (!song) return false;
    // Only route through YouTube player if we have a usable youtubeId or explicit source flag.
    // Checking audio URL for youtube.com is unreliable when we store YT URLs as audio field.
    const hasYtId = song.youtubeId && /^[A-Za-z0-9_-]{1,}$/.test(song.youtubeId);
    return song.source === 'youtube' || hasYtId;
  }, []);

  const extractYouTubeId = useCallback((url) => {
    if (!url) return null;
    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtu\.be\/([^?]+)/,
      /youtube\.com\/embed\/([^?]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }, []);

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
      try {
        youtubePlayerRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying YouTube player:', e);
      }
      youtubePlayerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!currentSong) {
      if (playerTypeRef.current === 'youtube') {
        cleanupYouTube();
      } else {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      return;
    }

    const useYouTube = needsYouTubePlayer(currentSong);
    playerTypeRef.current = useYouTube ? 'youtube' : 'audio';

    if (useYouTube) {
      const videoId = currentSong.youtubeId ||
                     extractYouTubeId(currentSong.streamUrl) ||
                     extractYouTubeId(currentSong.audio);

      // Validate videoId before touching YT player — invalid id causes an uncaught
      // Error that crashes the entire PlayerProvider tree.
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
        if (!window.YT || !window.YT.Player) {
          setTimeout(initPlayer, 100);
          return;
        }

        try { youtubePlayerRef.current = new window.YT.Player('youtube-player-container', {
          height: '0',
          width: '0',
          videoId: videoId,
          playerVars: {
            autoplay: isPlaying ? 1 : 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              setDuration(event.target.getDuration());
              if (isPlaying) event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.ENDED) {
                if (currentIndex < songs.length - 1) {
                  setCurrentIndex(prev => prev + 1);
                } else {
                  setIsPlaying(false);
                }
              } else if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              }
            },
            onError: (event) => {
              console.error('YouTube player error:', event.data);
              if (songs.length > 0 && currentIndex < songs.length - 1) {
                setCurrentIndex(prev => prev + 1);
              } else {
                setIsPlaying(false);
              }
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
          if (youtubePlayerRef.current && youtubePlayerRef.current.getCurrentTime) {
            const time = youtubePlayerRef.current.getCurrentTime();
            if (!isNaN(time)) setCurrentTime(time);
          }
        }, 1000);
      };

      initPlayer();
    } else {
      cleanupYouTube();

      const src = currentSong.audio || currentSong.url || currentSong.audioUrl || currentSong.src;
      if (!src) {
        console.error('No audio source for song:', currentSong);
        return;
      }

      audioRef.current.src = src;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.error('Audio play error:', err);
          setIsPlaying(false);
        });
      }
    }
  }, [currentSong, currentIndex, songs.length, needsYouTubePlayer, extractYouTubeId, cleanupYouTube, isPlaying]);

  useEffect(() => {
    if (!currentSong) return;

    if (playerTypeRef.current === 'youtube') {
      if (youtubePlayerRef.current && youtubePlayerRef.current.playVideo) {
        if (isPlaying) {
          youtubePlayerRef.current.playVideo();
        } else {
          youtubePlayerRef.current.pauseVideo();
        }
      }
    } else {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.play().catch(err => {
            console.error('Play error:', err);
            setIsPlaying(false);
          });
        } else {
          audioRef.current.pause();
        }
      }
    }
  }, [isPlaying, currentSong]);

  useEffect(() => {
    if (playerTypeRef.current === 'youtube') {
      if (youtubePlayerRef.current && youtubePlayerRef.current.setVolume) {
        youtubePlayerRef.current.setVolume(volume * 100);
      }
    } else {
      if (audioRef.current) audioRef.current.volume = volume;
    }
  }, [volume]);

  const toggleMute = useCallback(() => {
    if (playerTypeRef.current === 'youtube') {
      if (youtubePlayerRef.current && youtubePlayerRef.current.isMuted) {
        const muted = youtubePlayerRef.current.isMuted();
        youtubePlayerRef.current[youtubePlayerRef.current.isMuted ? 'unMute' : 'mute']();
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
      if (currentIdx > 0) {
        [indices[0], indices[currentIdx]] = [indices[currentIdx], indices[0]];
      }
      setShuffledOrder(indices);
    } else {
      setShuffledOrder([]);
    }
  }, [shuffle, songs, currentIndex]);

  const playNext = useCallback(() => {
    if (songs.length === 0) return;
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      }
      return;
    }

    let nextIndex;
    if (shuffle && shuffledOrder.length > 0) {
      const currentShuffleIdx = shuffledOrder.indexOf(currentIndex);
      if (currentShuffleIdx < shuffledOrder.length - 1) {
        nextIndex = shuffledOrder[currentShuffleIdx + 1];
      } else if (repeatMode === 'all') {
        nextIndex = shuffledOrder[0];
      } else {
        setIsPlaying(false);
        return;
      }
    } else {
      if (currentIndex < songs.length - 1) {
        nextIndex = currentIndex + 1;
      } else if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }
    setCurrentIndex(nextIndex);
  }, [songs, currentIndex, shuffle, shuffledOrder, repeatMode, audioRef]);

  const playPrev = useCallback(() => {
    if (songs.length === 0) return;

    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    let prevIndex;
    if (shuffle && shuffledOrder.length > 0) {
      const currentShuffleIdx = shuffledOrder.indexOf(currentIndex);
      if (currentShuffleIdx > 0) {
        prevIndex = shuffledOrder[currentShuffleIdx - 1];
      } else if (repeatMode === 'all') {
        prevIndex = shuffledOrder[shuffledOrder.length - 1];
      } else {
        prevIndex = 0;
      }
    } else {
      if (currentIndex > 0) {
        prevIndex = currentIndex - 1;
      } else if (repeatMode === 'all') {
        prevIndex = songs.length - 1;
      } else {
        prevIndex = 0;
      }
    }
    setCurrentIndex(prevIndex);
  }, [songs, currentIndex, shuffle, shuffledOrder, repeatMode, audioRef]);

  const toggleShuffle = useCallback(() => setShuffle(prev => !prev), []);
  const toggleRepeatMode = useCallback(() => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const seekTo = useCallback((time) => {
    if (playerTypeRef.current === 'youtube') {
      if (youtubePlayerRef.current && youtubePlayerRef.current.seekTo) {
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

  useEffect(() => {
    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (currentIndex < songs.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setIsPlaying(false);
      }
    };
    const handleError = () => {
      console.error('Audio error:', audio.error);
      if (songs.length > 0 && currentIndex < songs.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [songs.length, currentIndex]);

  useEffect(() => {
    return () => {
      cleanupYouTube();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
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
    // ── Library ──
    librarySongs,
    setLibrarySongs,
    addToLibrary,
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