import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart as faHeartSolid, faTrashCan, faHistory } from '@fortawesome/free-solid-svg-icons';
import { faHeart as faHeartRegular } from '@fortawesome/free-regular-svg-icons';
import { FaPlay } from 'react-icons/fa';
import SongTile from '../components/SongTile';
import { usePlayer } from '../context/PlayerContext';

export default function RecentlyPlayed() {
  const { setPlayerSongs, setCurrentIndex, setIsPlaying } = usePlayer();
  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lb:recentlyPlayed') || '[]');
    } catch {
      return [];
    }
  });

  const [songFlags, setSongFlags] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lb:songFlags') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('lb:recentlyPlayed', JSON.stringify(recent));
  }, [recent]);

  useEffect(() => {
    localStorage.setItem('lb:songFlags', JSON.stringify(songFlags));
  }, [songFlags]);

  const playSong = (song) => {
    setPlayerSongs([song]);
    setCurrentIndex(0);
    setIsPlaying(true);
    // move to top
    setRecent(prev => {
      const filtered = prev.filter(s => s.id !== song.id);
      return [song, ...filtered].slice(0, 50);
    });
  };

  const removeSong = (id) => {
    setRecent(prev => prev.filter(s => s.id !== id));
  };

  const clearAll = () => {
    setRecent([]);
  };

  const toggleFavorite = (songId) => {
    setSongFlags(prev => ({
      ...prev,
      [songId]: {
        ...prev[songId],
        favorite: !prev[songId]?.favorite
      }
    }));
  };

  if (!recent.length) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white/60">
        <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center mb-4">
          <FaHistory className="text-white/40 text-3xl" />
        </div>
        <p className="text-lg">No recently played songs</p>
        <p className="text-sm mt-2">Start playing music to see them here</p>
      </div>
    );
  }

  return (
    <div className="recentlyPlayed w-full h-full flex flex-col overflow-hidden">
      {/* Sticky glass header */}
      <div className="sticky top-0 z-20 w-full px-4 md:px-6 lg:px-8 py-4 backdrop-blur-2xl bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaHistory className="text-emerald-400 text-2xl" />
            <h1 className="text-white text-2xl md:text-3xl font-bold tracking-tight">Recently Played</h1>
          </div>
          <button
            onClick={clearAll}
            className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 
            hover:bg-white/20 transition-all text-white/90 text-sm font-medium flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faTrashCan} className="text-sm" />
            Clear All
          </button>
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 pb-8">
            {recent.map((song, idx) => {
              const songId = song.id || `recent-${idx}`;
              const isFavorite = songFlags[songId]?.favorite || false;

              return (
                <div key={songId} className="relative">
                  {/* Mobile view */}
                  <div className="block sm:hidden">
                    <SongTile
                      song={{ ...song, favorite: isFavorite }}
                      index={idx}
                      onPlay={() => playSong(song)}
                      onToggleFavorite={() => toggleFavorite(songId)}
                    />
                  </div>

                  {/* Desktop card */}
                  <div className="hidden sm:block group relative bg-white/5 backdrop-blur-xl rounded-2xl 
                  shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer border border-white/10 
                  hover:border-emerald-400/30 hover:scale-[1.02] overflow-hidden">
                    {/* Cover */}
                    <div className="relative aspect-square overflow-hidden">
                      <img
                        src={song.cover || '/default-cover.png'}
                        alt={song.name}
                        className="w-full h-full object-cover"
                        onError={(e) => (e.target.src = '/default-cover.png')}
                      />
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent 
                      opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => playSong(song)}
                          className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 
                          hover:from-emerald-400 hover:to-emerald-500 flex items-center justify-center shadow-lg 
                          transform hover:scale-110 transition"
                        >
                          <FaPlay className="text-white text-lg ml-1" />
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="text-white font-semibold text-sm truncate">{song.name}</h3>
                      <p className="text-white/60 text-xs truncate mt-1">{song.artist}</p>
                    </div>

                    {/* Actions (appear on hover) */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(songId);
                        }}
                        className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center 
                        justify-center hover:bg-emerald-500/80 transition"
                        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <FontAwesomeIcon
                          icon={isFavorite ? faHeartSolid : faHeartRegular}
                          className={isFavorite ? 'text-emerald-400' : 'text-white/80'}
                          size="sm"
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSong(song.id);
                        }}
                        className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center 
                        justify-center hover:bg-red-500/80 transition"
                        title="Remove from history"
                      >
                        <FontAwesomeIcon icon={faTrashCan} className="text-white/80" size="sm" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}