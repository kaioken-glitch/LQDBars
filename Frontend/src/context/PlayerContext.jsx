// src/context/PlayerContext.jsx - UPDATED for YouTube playback
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
  const [songs, setSongs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloadedSongs, setDownloadedSongs] = useState([]);

  const audioRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const playerTypeRef = useRef('audio'); // 'audio' or 'youtube'

  const currentSong = songs[currentIndex];

  // Determine if song needs YouTube player or regular audio
  const needsYouTubePlayer = (song) => {
    if (!song) return false;
    return song.source === 'youtube' || 
           song.streamUrl?.includes('youtube.com') || 
           song.streamUrl?.includes('youtu.be') ||
           song.audio?.includes('youtube.com') ||
           song.audio?.includes('youtu.be');
  };

  // Extract YouTube video ID
  const extractYouTubeId = (url) => {
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
  };

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Handle song playback
  useEffect(() => {
    if (!currentSong) return;

    const useYouTube = needsYouTubePlayer(currentSong);
    playerTypeRef.current = useYouTube ? 'youtube' : 'audio';

    if (useYouTube) {
      // Use YouTube player
      const videoId = currentSong.youtubeId || 
                     extractYouTubeId(currentSong.streamUrl) || 
                     extractYouTubeId(currentSong.audio);

      if (!videoId) {
        console.error('No YouTube video ID found');
        return;
      }

      // Create YouTube player
      if (window.YT && window.YT.Player) {
        // Remove old player if exists
        if (youtubePlayerRef.current) {
          youtubePlayerRef.current.destroy();
        }

        // Create container if doesn't exist
        let container = document.getElementById('youtube-player-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'youtube-player-container';
          container.style.display = 'none';
          document.body.appendChild(container);
        }

        youtubePlayerRef.current = new window.YT.Player('youtube-player-container', {
          height: '0',
          width: '0',
          videoId: videoId,
          playerVars: {
            autoplay: isPlaying ? 1 : 0,
            controls: 0,
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
                setIsPlaying(true);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              }
            },
          },
        });

        // Update current time
        const interval = setInterval(() => {
          if (youtubePlayerRef.current && youtubePlayerRef.current.getCurrentTime) {
            setCurrentTime(youtubePlayerRef.current.getCurrentTime());
          }
        }, 1000);

        return () => clearInterval(interval);
      }
    } else {
      // Use regular audio element
      if (audioRef.current && currentSong.audio) {
        audioRef.current.src = currentSong.audio;
        audioRef.current.load();
        if (isPlaying) {
          audioRef.current.play().catch(console.error);
        }
      }
    }
  }, [currentSong, currentIndex]);

  // Handle play/pause
  useEffect(() => {
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
          audioRef.current.play().catch(console.error);
        } else {
          audioRef.current.pause();
        }
      }
    }
  }, [isPlaying]);

  // Handle volume
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

  // Seek function
  const seekTo = (time) => {
    if (playerTypeRef.current === 'youtube') {
      if (youtubePlayerRef.current && youtubePlayerRef.current.seekTo) {
        youtubePlayerRef.current.seekTo(time);
        setCurrentTime(time);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    }
  };

  const setPlayerSongs = (newSongs) => {
    setSongs(newSongs);
  };

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
    playerType: playerTypeRef.current
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* Regular audio element for MP3/etc */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onDurationChange={(e) => setDuration(e.target.duration)}
        onEnded={() => {
          if (currentIndex < songs.length - 1) {
            setCurrentIndex(prev => prev + 1);
          } else {
            setIsPlaying(false);
          }
        }}
      />
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