import React, { createContext, useContext, useRef, useState, useEffect } from 'react';

const PlayerContext = createContext();

export function PlayerProvider({ children, initialSongs = [] }) {
  const [songs, setSongs] = useState(initialSongs);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.2);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const audioRef = useRef(null);

  // Fetch and cache downloaded songs globally
  useEffect(() => {
    const cached = localStorage.getItem('downloadedSongs');
    if (cached) {
      try {
        setDownloadedSongs(JSON.parse(cached));
        return;
      } catch (e) {}
    }
    fetch('http://localhost:3000/songs')
      .then(res => res.json())
      .then(data => {
        const withDownloadFlag = data.map(song => ({ ...song, downloaded: !!song.downloaded }));
        const sorted = withDownloadFlag
          .filter(song => song.downloaded)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setDownloadedSongs(sorted);
        localStorage.setItem('downloadedSongs', JSON.stringify(sorted));
      })
      .catch(() => setDownloadedSongs([]));
  }, []);

  // Audio element only rendered once
  const currentSong = songs[currentIndex] || null;

  // Play/pause effect
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentIndex, volume, isMuted]);

  // Update currentTime and duration
  useEffect(() => {
    if (!audioRef.current) return;
    const handleTimeUpdate = () => setCurrentTime(audioRef.current.currentTime);
    const handleLoadedMetadata = () => setDuration(audioRef.current.duration);
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
    // Cleanup
    return () => {
      if (!audioRef.current) return;
      audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [currentSong]);

  // Next/Prev logic
  const playNext = () => {
    setCurrentIndex(i => (i < songs.length - 1 ? i + 1 : 0));
    setIsPlaying(true);
  };
  const playPrev = () => {
    setCurrentIndex(i => (i > 0 ? i - 1 : songs.length - 1));
    setIsPlaying(true);
  };

  // Mute toggle
  const toggleMute = () => setIsMuted(m => !m);

  // Set songs (for Home page fetch)
  const setPlayerSongs = (newSongs) => setSongs(newSongs);

  // ...existing code...

  return (
    <PlayerContext.Provider
      value={{
        songs,
        setPlayerSongs,
        currentIndex,
        setCurrentIndex,
        isPlaying,
        setIsPlaying,
        isMuted,
        toggleMute,
        playNext,
        playPrev,
        currentSong,
        audioRef,
        volume,
        setVolume,
        currentTime,
        duration,
        downloadedSongs,
        setDownloadedSongs
      }}
    >
      {children}
      {/* Persistent audio element */}
      <audio
        ref={audioRef}
        src={currentSong?.audio || null}
        preload="auto"
        onEnded={playNext}
        style={{ display: 'none' }}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
