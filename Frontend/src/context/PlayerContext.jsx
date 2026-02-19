// src/context/PlayerContext.jsx - UPDATED for YouTube playback with youtubeId support
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
  const [isMuted, setIsMuted] = useState(false); // added for consistency

  const audioRef = useRef(new Audio());
  const youtubePlayerRef = useRef(null);
  const playerTypeRef = useRef('audio'); // 'audio' or 'youtube'
  const timeUpdateInterval = useRef(null);

  const currentSong = songs[currentIndex];

  // Determine if song needs YouTube player or regular audio
  const needsYouTubePlayer = useCallback((song) => {
    if (!song) return false;
    return song.source === 'youtube' || 
           song.youtubeId || // <-- ADDED THIS
           song.streamUrl?.includes('youtube.com') || 
           song.streamUrl?.includes('youtu.be') ||
           song.audio?.includes('youtube.com') ||
           song.audio?.includes('youtu.be');
  }, []);

  // Extract YouTube video ID from various URL formats
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

  // Load YouTube IFrame API once
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Clean up YouTube player and intervals
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

  // Handle song playback when currentSong changes
  useEffect(() => {
    if (!currentSong) {
      // No song, stop everything
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
      // Use YouTube player
      const videoId = currentSong.youtubeId || 
                     extractYouTubeId(currentSong.streamUrl) || 
                     extractYouTubeId(currentSong.audio);

      if (!videoId) {
        console.error('No YouTube video ID found for song:', currentSong);
        return;
      }

      // Clean up any existing YouTube player
      cleanupYouTube();

      // Create container if doesn't exist
      let container = document.getElementById('youtube-player-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'youtube-player-container';
        container.style.display = 'none';
        document.body.appendChild(container);
      }

      // Wait for YT API to be ready
      const initPlayer = () => {
        if (!window.YT || !window.YT.Player) {
          setTimeout(initPlayer, 100);
          return;
        }

        youtubePlayerRef.current = new window.YT.Player('youtube-player-container', {
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
              if (isPlaying) {
                event.target.playVideo();
              }
            },
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.ENDED) {
                // Go to next song
                if (currentIndex < songs.length - 1) {
                  setCurrentIndex(prev => prev + 1);
                } else {
                  setIsPlaying(false);
                }
              } else if (event.data === window.YT.PlayerState.PLAYING) {
                // Ensure isPlaying is true
                setIsPlaying(true);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                // Ensure isPlaying is false
                setIsPlaying(false);
              }
            },
            onError: (event) => {
              console.error('YouTube player error:', event.data);
              // Attempt to skip to next song on error
              if (songs.length > 0 && currentIndex < songs.length - 1) {
                setCurrentIndex(prev => prev + 1);
              } else {
                setIsPlaying(false);
              }
            },
          },
        });

        // Set up time update interval
        if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
        timeUpdateInterval.current = setInterval(() => {
          if (youtubePlayerRef.current && youtubePlayerRef.current.getCurrentTime) {
            const time = youtubePlayerRef.current.getCurrentTime();
            if (!isNaN(time)) {
              setCurrentTime(time);
            }
          }
        }, 1000);
      };

      initPlayer();
    } else {
      // Use regular audio element
      cleanupYouTube(); // clear any YouTube intervals

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

  // Handle play/pause state changes
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

  // Handle volume changes
  useEffect(() => {
    if (playerTypeRef.current === 'youtube') {
      if (youtubePlayerRef.current && youtubePlayerRef.current.setVolume) {
        youtubePlayerRef.current.setVolume(volume * 100);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.volume = volume;
      }
    }
  }, [volume]);

  // Mute toggle (added for consistency)
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

  // Navigation functions
  const playNext = useCallback(() => {
    if (songs.length === 0) return;
    if (currentIndex < songs.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0); // loop to first
    }
    // Playback will start automatically due to effect
  }, [songs.length, currentIndex]);

  const playPrev = useCallback(() => {
    if (songs.length === 0) return;
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setCurrentIndex(songs.length - 1); // loop to last
    }
  }, [songs.length, currentIndex]);

  // Seek function
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

  // Set player songs with optional start index
  const setPlayerSongs = useCallback((newSongs, startIndex = 0) => {
    setSongs(newSongs);
    setCurrentIndex(startIndex);
  }, []);

  // Audio element event handlers
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
    const handleError = (e) => {
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

  // Clean up on unmount
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
    toggleMute,
    isMuted,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
}