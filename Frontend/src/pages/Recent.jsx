import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faEllipsisH, faHistory } from '@fortawesome/free-solid-svg-icons';
import { FaPlay, FaPause, FaTrash,  FaHistory, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import SongTile from '../components/SongTile';

const RECENT_SONGS_CACHE_KEY = 'recentPlayedSongs';
const CURRENT_SONG_CACHE_KEY = 'currentPlayingSong';
const MAX_RECENT_SONGS = 50;

// Utility functions (unchanged)
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

// Hook (unchanged)
export function useRecentSongs() {
  const { currentSong } = usePlayer();
  const [recentSongs, setRecentSongs] = useState(() => getRecentSongs());

  React.useEffect(() => {
    if (currentSong && currentSong.id) {
      saveCurrentSong(currentSong);

      setRecentSongs((prev) => {
        const filtered = prev.filter((song) => song.id !== currentSong.id);
        const updated = [
          {
            ...currentSong,
            playedAt: new Date().toISOString(),
            playCount: (currentSong.playCount || 0) + 1
          },
          ...filtered
        ].slice(0, MAX_RECENT_SONGS);
        saveRecentSongs(updated);
        return updated;
      });
    }
  }, [currentSong?.id]);

  return { recentSongs, setRecentSongs };
}

export default function Recent() {
  const { currentSong, setCurrentIndex, songs, setIsPlaying, isPlaying } = usePlayer();
  const { recentSongs, setRecentSongs } = useRecentSongs();
  const [sortBy, setSortBy] = useState('recent'); // 'recent' or 'mostPlayed'

  const sortedSongs = useMemo(() => {
    if (sortBy === 'mostPlayed') {
      return [...recentSongs].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    }
    return recentSongs;
  }, [recentSongs, sortBy]);

  const handlePlaySong = (song) => {
    const songIndex = songs.findIndex((s) => s.id === song.id);
    if (songIndex !== -1) {
      setCurrentIndex(songIndex);
      setIsPlaying(true);
    }
  };

  const handleRemoveSong = (songId) => {
    const updated = recentSongs.filter((song) => song.id !== songId);
    setRecentSongs(updated);
    saveRecentSongs(updated);
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear all recently played songs?')) {
      setRecentSongs([]);
      saveRecentSongs([]);
    }
  };

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
    <div className="recent w-full h-full flex flex-col overflow-hidden">
      {/* Sticky glass header */}
      <div className="sticky top-0 z-20 w-full px-4 md:px-8 lg:px-12 pt-6 pb-2 backdrop-blur-2xl ">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight flex items-center gap-3">
                <FaHistory className="text-emerald-400" />
                Recently Played
              </h1>
              <p className="text-white/60 text-xs md:text-sm mt-1">
                {recentSongs.length} {recentSongs.length === 1 ? 'song' : 'songs'} in your history
              </p>
            </div>
            {recentSongs.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-white/10 backdrop-blur-xl rounded-full p-1 border border-white/20">
                  <button
                    onClick={() => setSortBy('recent')}
                    className={`flex items-center justify-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium transition-all ${
                      sortBy === 'recent'
                        ? 'bg-emerald-500 text-white shadow-lg'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <FaSortAmountDown className="text-xs" />
                    <span>Recent</span>
                  </button>
                  <button
                    onClick={() => setSortBy('mostPlayed')}
                    className={`flex items-center justify-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium transition-all ${
                      sortBy === 'mostPlayed'
                        ? 'bg-emerald-500 text-white shadow-lg'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <FaSortAmountUp className="text-xs" />
                    <span>Most Played</span>
                  </button>
                </div>
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs md:text-sm font-medium border border-red-500/30 transition-all"
                >
                  <FaTrash className="text-xs" />
                  <span>Clear</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-6">
        <div className="max-w-7xl mx-auto">
          {sortedSongs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center mb-4">
                <FaHistory className="text-white/40 text-3xl" />
              </div>
              <h3 className="text-white text-2xl font-bold mb-2">No Songs Played Yet</h3>
              <p className="text-white/60 max-w-md">
                Start playing songs to build your recently played history. They'll appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-8">
              {/* Desktop view */}
              <div className="hidden md:block">
                <div className="grid grid-cols-12 gap-4 px-4 py-3 text-white/50 text-xs font-medium uppercase tracking-wider border-b border-white/10 mb-2">
                  <div className="col-span-6">Song</div>
                  <div className="col-span-2">Played</div>
                  <div className="col-span-2">Play Count</div>
                  <div className="col-span-2">Actions</div>
                </div>

                {sortedSongs.map((song, index) => (
                  <div
                    key={`${song.id}-${index}`}
                    className="group relative grid grid-cols-12 gap-4 px-4 py-2 my-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer border border-transparent hover:border-white/10 backdrop-blur-sm"
                    onClick={() => handlePlaySong(song)}
                  >
                    {/* Song info */}
                    <div className="col-span-6 flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-md overflow-hidden shadow-md flex-shrink-0">
                        <img src={song.cover} alt={song.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate group-hover:text-emerald-400 transition-colors">
                          {song.name}
                        </p>
                        <p className="text-white/50 text-xs truncate">{song.artist}</p>
                      </div>
                    </div>

                    {/* Played at */}
                    <div className="col-span-2 flex items-center">
                      <span className="text-white/50 text-xs">{formatDate(song.playedAt)}</span>
                    </div>

                    {/* Play count */}
                    <div className="col-span-2 flex items-center">
                      <span className="text-white/50 text-xs">{song.playCount || 1}</span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySong(song);
                        }}
                        className="w-8 h-8 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-all shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100"
                        title="Play"
                      >
                        {currentSong?.id === song.id && isPlaying ? (
                          <FaPause className="text-white text-xs" />
                        ) : (
                          <FaPlay className="text-white text-xs ml-0.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSong(song.id);
                        }}
                        className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                        title="Remove from history"
                      >
                        <FaTrash className="text-xs" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile view */}
              <div className="md:hidden space-y-2">
                {sortedSongs.map((song, index) => (
                  <div
                    key={`${song.id}-${index}`}
                    className="group relative p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-emerald-400/30 transition-all"
                    onClick={() => handlePlaySong(song)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative w-12 h-12 rounded-md overflow-hidden shadow-md flex-shrink-0">
                        <img src={song.cover} alt={song.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{song.name}</p>
                        <p className="text-white/50 text-xs truncate">{song.artist}</p>
                        <div className="flex items-center gap-2 mt-1 text-white/40 text-[10px]">
                          <span>{formatDate(song.playedAt)}</span>
                          <span>•</span>
                          <span>{song.playCount || 1} play{song.playCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSong(song.id);
                        }}
                        className="text-red-400 hover:text-red-300 p-2"
                      >
                        <FaTrash className="text-sm" />
                      </button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySong(song);
                      }}
                      className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-all shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                      {currentSong?.id === song.id && isPlaying ? (
                        <FaPause className="text-white text-xs" />
                      ) : (
                        <FaPlay className="text-white text-xs ml-0.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}