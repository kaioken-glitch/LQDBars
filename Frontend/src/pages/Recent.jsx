import React, { useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { FaPlay, FaPause, FaTrash, FaHistory } from 'react-icons/fa';

const RECENT_SONGS_CACHE_KEY = 'recentPlayedSongs';
const CURRENT_SONG_CACHE_KEY = 'currentPlayingSong';
const MAX_RECENT_SONGS = 50;

// Utility functions for localStorage
const saveRecentSongs = (songs) => {
  try {
    localStorage.setItem(RECENT_SONGS_CACHE_KEY, JSON.stringify(songs));
  } catch (error) {
    console.error('Error saving recent songs:', error);
  }
};

const getRecentSongs = () => {
  try {
    const cached = localStorage.getItem(RECENT_SONGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('Error getting recent songs:', error);
    return [];
  }
};

const saveCurrentSong = (song) => {
  try {
    localStorage.setItem(CURRENT_SONG_CACHE_KEY, JSON.stringify(song));
  } catch (error) {
    console.error('Error saving current song:', error);
  }
};

const getCurrentSongFromCache = () => {
  try {
    const cached = localStorage.getItem(CURRENT_SONG_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error getting current song:', error);
    return null;
  }
};

// Hook to track played songs
export function useRecentSongs() {
  const { currentSong } = usePlayer();
  const [recentSongs, setRecentSongs] = useState(() => getRecentSongs());

  // Track when a song is playing
  useEffect(() => {
    if (currentSong && currentSong.id) {
      // Save current song to cache for app load
      saveCurrentSong(currentSong);

      // Add to recent songs (avoid duplicates at top)
      setRecentSongs((prev) => {
        // Remove if already exists
        const filtered = prev.filter((song) => song.id !== currentSong.id);

        // Add to beginning with timestamp
        const updated = [
          {
            ...currentSong,
            playedAt: new Date().toISOString(),
            playCount: (currentSong.playCount || 0) + 1
          },
          ...filtered
        ].slice(0, MAX_RECENT_SONGS); // Keep only last 50

        // Save to localStorage
        saveRecentSongs(updated);

        return updated;
      });
    }
  }, [currentSong?.id]); // Only when song ID changes

  return { recentSongs, setRecentSongs };
}

export default function Recent() {
  const { currentSong, setCurrentIndex, songs, setIsPlaying, isPlaying } = usePlayer();
  const { recentSongs, setRecentSongs } = useRecentSongs();
  const [sortBy, setSortBy] = useState('recent'); // 'recent' or 'mostPlayed'

  // Sort songs based on selected option
  const sortedSongs = React.useMemo(() => {
    if (sortBy === 'mostPlayed') {
      return [...recentSongs].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    }
    return recentSongs;
  }, [recentSongs, sortBy]);

  // Handle song selection
  const handlePlaySong = (song) => {
    const songIndex = songs.findIndex((s) => s.id === song.id);
    if (songIndex !== -1) {
      setCurrentIndex(songIndex);
      setIsPlaying(true);
    }
  };

  // Remove song from history
  const handleRemoveSong = (songId) => {
    const updated = recentSongs.filter((song) => song.id !== songId);
    setRecentSongs(updated);
    saveRecentSongs(updated);
  };

  // Clear all history
  const handleClearHistory = () => {
    if (window.confirm('Clear all recently played songs?')) {
      setRecentSongs([]);
      saveRecentSongs([]);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="recent w-full h-full flex flex-col pb-20">
      {/* Header */}
      <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white text-4xl md:text-5xl font-bold tracking-tight flex items-center gap-3">
                <FaHistory className="text-emerald-400" />
                Recently Played
              </h1>
              <p className="text-white/60 text-sm md:text-base mt-2">
                {recentSongs.length} songs in your history
              </p>
            </div>

            {/* Controls */}
            {recentSongs.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg
                  text-sm font-medium hover:bg-white/20 transition-all"
                >
                  <option value="recent">Most Recent</option>
                  <option value="mostPlayed">Most Played</option>
                </select>

                <button
                  onClick={handleClearHistory}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg
                  text-sm font-medium border border-red-500/30 transition-all flex items-center gap-2"
                >
                  <FaTrash className="text-sm" />
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 flex-1 overflow-y-auto">
        {sortedSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <FaHistory className="text-white/40 text-3xl" />
            </div>
            <h3 className="text-white text-2xl font-bold mb-2">No Songs Played Yet</h3>
            <p className="text-white/60 max-w-md">
              Start playing songs to build your recently played history. They'll appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-2 pb-8">
            {/* Desktop View */}
            <div className="hidden md:block">
              <div className="grid grid-cols-12 gap-4 px-4 py-3 text-white/60 text-sm font-medium mb-2 border-b border-white/10">
                <div className="col-span-6">Song</div>
                <div className="col-span-2">Played</div>
                <div className="col-span-2">Play Count</div>
                <div className="col-span-2">Actions</div>
              </div>

              {sortedSongs.map((song, index) => (
                <div
                  key={`${song.id}-${index}`}
                  className="grid grid-cols-12 gap-4 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10
                  transition-all cursor-pointer group border border-transparent hover:border-white/10"
                  onClick={() => handlePlaySong(song)}
                >
                  {/* Song Info */}
                  <div className="col-span-6 flex items-center gap-3 min-w-0">
                    <img
                      src={song.cover}
                      alt={song.name}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{song.name}</p>
                      <p className="text-white/60 text-xs truncate">{song.artist}</p>
                    </div>
                  </div>

                  {/* Played At */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-white/60 text-sm">{formatDate(song.playedAt)}</span>
                  </div>

                  {/* Play Count */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-white/60 text-sm">{song.playCount || 1}x</span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center gap-2 justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySong(song);
                      }}
                      className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white
                      flex items-center justify-center transition-all transform hover:scale-110"
                      title="Play"
                    >
                      {currentSong?.id === song.id && isPlaying ? (
                        <FaPause className="text-xs" />
                      ) : (
                        <FaPlay className="text-xs ml-0.5" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSong(song.id);
                      }}
                      className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400
                      flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                      title="Remove from history"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-2">
              {sortedSongs.map((song, index) => (
                <div
                  key={`${song.id}-${index}`}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                  onClick={() => handlePlaySong(song)}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={song.cover}
                      alt={song.name}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{song.name}</p>
                      <p className="text-white/60 text-xs truncate">{song.artist}</p>
                      <div className="flex items-center gap-2 mt-1 text-white/50 text-xs">
                        <span>{formatDate(song.playedAt)}</span>
                        <span>•</span>
                        <span>{song.playCount || 1}x played</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSong(song.id);
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <FaTrash className="text-sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}