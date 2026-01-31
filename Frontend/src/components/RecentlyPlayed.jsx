import React, { useEffect, useState } from 'react';
import { FaPlay, FaTrashAlt, FaHeart, FaThumbsDown } from 'react-icons/fa';
import SongTile from './SongTile';
import { usePlayer } from '../context/PlayerContext';

export default function RecentlyPlayed() {
  const { setPlayerSongs, setCurrentIndex, setIsPlaying } = usePlayer();
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lb:recentlyPlayed') || '[]'); } catch (e) { return []; }
  });

  const [songFlags, setSongFlags] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lb:songFlags') || '{}'); } catch (e) { return {}; }
  });

  useEffect(() => {
    localStorage.setItem('lb:recentlyPlayed', JSON.stringify(recent));
  }, [recent]);

  useEffect(() => {
    try { localStorage.setItem('lb:songFlags', JSON.stringify(songFlags)); } catch (e) {}
  }, [songFlags]);

  function playSong(song) {
    setPlayerSongs([song]);
    setCurrentIndex(0);
    setIsPlaying(true);
    // move song to top
    setRecent(prev => {
      const filtered = prev.filter(s => s.id !== song.id);
      return [song, ...filtered].slice(0, 50);
    });
  }

  function removeSong(id) {
    setRecent(prev => prev.filter(s => s.id !== id));
  }

  function clearAll() {
    setRecent([]);
  }

  function toggleFlag(songId, flag) {
    setSongFlags(prev => {
      const next = { ...prev, [songId]: { ...prev[songId], [flag]: !prev[songId]?.[flag] } };
      try { localStorage.setItem('lb:songFlags', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  }

  if (!recent.length) return (
    <div className="w-full h-full flex items-center justify-center text-white/60">No recently played songs.</div>
  );

  return (
    <div className="recentlyPlayed w-full h-full p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-xl font-bold">Recently Played</h2>
        <div className="flex items-center gap-2">
          <button onClick={clearAll} className="px-3 py-1 bg-red-500 rounded text-white text-sm">Clear</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {recent.map((song, idx) => (
          <div key={song.id || idx} className="relative">
            {/* Mobile-optimized: use SongTile on small screens */}
            <div className="block sm:hidden">
              <SongTile
                song={{ ...song, favorite: songFlags[song.id]?.favorite }}
                index={idx}
                onPlay={() => playSong(song)}
                onToggleFavorite={() => toggleFlag(song.id, 'favorite')}
                onToggleDownload={() => toggleFlag(song.id, 'downloaded')}
              />
            </div>

            {/* Desktop: keep existing card appearance */}
            <div className="hidden sm:block bg-white/5 rounded-lg p-2 hover:bg-white/10 transition">
              <div onClick={() => playSong(song)} className="cursor-pointer">
                <img src={song.cover} alt={song.name} className="w-full h-36 object-cover rounded-md" />
                <div className="mt-2">
                  <div className="text-white font-medium truncate">{song.name}</div>
                  <div className="text-white/60 text-sm truncate">{song.artist}</div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <button onClick={() => playSong(song)} className="flex items-center gap-2 px-2 py-1 bg-emerald-500 rounded text-white text-sm">
                  <FaPlay /> Play
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleFlag(song.id, 'like')} className={`p-2 rounded ${songFlags[song.id]?.like ? 'bg-emerald-600 text-white' : 'hover:bg-white/10'}`} title="Like">
                    <FaHeart className={`${songFlags[song.id]?.like ? 'text-white' : 'text-white/80'}`} />
                  </button>
                  <button onClick={() => toggleFlag(song.id, 'dislike')} className={`p-2 rounded ${songFlags[song.id]?.dislike ? 'bg-red-600 text-white' : 'hover:bg-white/10'}`} title="Dislike">
                    <FaThumbsDown className={`${songFlags[song.id]?.dislike ? 'text-white' : 'text-white/80'}`} />
                  </button>
                  <button onClick={() => toggleFlag(song.id, 'favorite')} className={`p-2 rounded ${songFlags[song.id]?.favorite ? 'bg-emerald-600 text-white' : 'hover:bg-white/10'}`} title="Favorite">
                    <FaHeart className={`${songFlags[song.id]?.favorite ? 'text-white' : 'text-white/80'}`} />
                  </button>
                </div>
              </div>

              <button onClick={() => removeSong(song.id)} className="absolute top-2 right-2 p-1 rounded bg-white/5 hover:bg-white/10">
                <FaTrashAlt className="text-white/70" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
