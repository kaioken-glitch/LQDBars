import React, { useState, useEffect, useMemo } from 'react';
import { FaSearch, FaStar, FaHeart } from 'react-icons/fa';
import { FaGripVertical } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import SongTile from './SongTile';

export default function Home() {
  const {
    songs,
    setPlayerSongs,
    currentIndex,
    setCurrentIndex,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    currentTime,
    duration,
    audioRef,
    downloadedSongs,
    isMuted,
    toggleMute,
    currentSong,
    librarySongs = [], // we'll assume you've added this to context later
  } = usePlayer();

  // ---------- UI state ----------
  const [showInput, setShowInput] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showGenres, setShowGenres] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [activeFilter, setActiveFilter] = useState('Songs'); // 'Songs' or 'Albums'
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [showVolume, setShowVolume] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState([]);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'all', 'one'

  // ---------- Set initial volume ----------
  useEffect(() => {
    setVolume(0.2);
  }, [setVolume]);

  // ---------- If no songs in player, load all downloaded songs ----------
  useEffect(() => {
    if (songs.length === 0 && downloadedSongs.length > 0) {
      setPlayerSongs(downloadedSongs, 0);
    }
  }, [songs, downloadedSongs, setPlayerSongs]);

  // ---------- Shuffle logic ----------
  useEffect(() => {
    if (shuffle && songs.length > 1) {
      const indices = songs.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      // Keep current song at top
      const currentIdx = indices.indexOf(currentIndex);
      if (currentIdx > 0) {
        [indices[0], indices[currentIdx]] = [indices[currentIdx], indices[0]];
      }
      setShuffledOrder(indices);
    } else {
      setShuffledOrder([]);
    }
  }, [shuffle, songs, currentIndex]);

  // ---------- Search (local only) ----------
  const handleSearch = (val) => {
    setQuery(val);
    if (val.trim() === '') {
      setSearchResults([]);
      return;
    }
    const q = val.toLowerCase();
    const filtered = songs.filter(song =>
      song.name?.toLowerCase().includes(q) ||
      song.artist?.toLowerCase().includes(q) ||
      song.album?.toLowerCase().includes(q)
    );
    setSearchResults(filtered);
  };

  // ---------- Format time ----------
  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ---------- Drag & drop reorder ----------
  const handleDragStart = (idx) => setDraggedIdx(idx);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (targetIdx) => {
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      return;
    }
    const updated = [...songs];
    const [removed] = updated.splice(draggedIdx, 1);
    updated.splice(targetIdx, 0, removed);
    setPlayerSongs(updated);

    // Adjust currentIndex if needed
    if (currentIndex === draggedIdx) setCurrentIndex(targetIdx);
    else if (draggedIdx < currentIndex && targetIdx >= currentIndex) setCurrentIndex(currentIndex - 1);
    else if (draggedIdx > currentIndex && targetIdx <= currentIndex) setCurrentIndex(currentIndex + 1);

    setDraggedIdx(null);
  };

  // ---------- Filtered queue based on genre and search ----------
  const filteredQueue = useMemo(() => {
    let queue = songs;
    // Genre filter
    if (selectedGenre && selectedGenre !== 'Genres') {
      queue = queue.filter(song => song.genre === selectedGenre);
    }
    // Search filter (if active)
    if (query.trim() !== '' && searchResults.length > 0) {
      queue = searchResults;
    }
    return queue;
  }, [songs, selectedGenre, query, searchResults]);

  // ---------- Group by album when activeFilter === 'Albums' ----------
  const groupedQueue = useMemo(() => {
    if (activeFilter === 'Songs') {
      return filteredQueue;
    }
    // Group by album
    const groups = {};
    filteredQueue.forEach(song => {
      const album = song.album || 'Unknown Album';
      if (!groups[album]) groups[album] = [];
      groups[album].push(song);
    });
    return groups;
  }, [filteredQueue, activeFilter]);

  // ---------- Play a song from queue ----------
  const playSong = (index) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  // ---------- Render now-playing card ----------
  const renderNowPlaying = () => {
    const song = currentSong || songs[0] || {};
    return (
      <div className="musicDisplayCard w-[22%] h-[95%] flex flex-col items-center justify-start bg-white/20 backdrop-blur-[20px] 
      rounded-[16px] border border-white/20 mt-8 p-0 overflow-hidden shadow-xl">
        <div className="musicCover flex items-center justify-center w-full h-[320px] bg-black/10 rounded-t-[16px]">
          <img
            src={song.cover || 'Frontend/public/emerald.jpg'}
            alt={song.name || 'placeholder'}
            className="w-full h-full object-cover rounded-t-[16px]"
          />
        </div>
        {/* Favorite button always visible */}
        <div className="musicReactions flex flex-row items-center justify-end w-full gap-2 border-b border-white/10 max-h-[50px] 
        min-h-[40px] py-4 pr-[10px]">
          <button
            type="button"
            className="star flex items-center justify-center w-10 h-10 rounded-full hover:bg-yellow-400/80 transition bg-white/10"
            title="Favorite"
            onClick={() => {
              // You can implement a patch to localStorage or context later
              console.log('Toggle favorite');
            }}
          >
            <FaStar className="text-yellow-400 text-lg" />
          </button>
          {song.liked && (
            <FaHeart className="text-emerald-400 text-sm ml-2 w-[17px] h-[17px]" title="Liked" />
          )}
        </div>
        <div className="musicMetaData flex flex-col items-start justify-start w-full px-6 py-4">
          <h2 className="text-white text-lg font-semibold">{song.name || 'Song Title'}</h2>
          <p className="text-white/70 text-sm mb-2">{song.artist || 'Artist Name'}</p>
          {song.album && (
            <p className="text-white/50 text-xs">{song.album}</p>
          )}
        </div>
      </div>
    );
  };

  // ---------- Render queue list (flat or grouped) ----------
  const renderQueue = () => {
    if (songs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-white/60">
          <p className="text-lg">No offline songs yet</p>
          <p className="text-sm mt-2">Import local music to get started</p>
        </div>
      );
    }

    if (activeFilter === 'Songs') {
      // Flat list
      return filteredQueue.map((song, idx) => {
        const originalIndex = songs.findIndex(s => s.id === song.id);
        return (
          <SongTile
            key={song.id || originalIndex}
            song={song}
            index={originalIndex}
            isCurrent={currentIndex === originalIndex}
            onPlay={() => playSong(originalIndex)}
            dragHandle={
              <button
                className="drag-handle flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-emerald-500/40 transition mr-1 cursor-grab"
                title="Drag to reorder"
                tabIndex={-1}
                draggable
                onDragStart={() => handleDragStart(originalIndex)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(originalIndex)}
              >
                <FaGripVertical className="text-white text-lg" />
              </button>
            }
            className="px-2 py-1 bg-white/5 border-b border-white/10"
          />
        );
      });
    } else {
      // Grouped by album
      return Object.entries(groupedQueue).map(([albumName, albumSongs]) => (
        <div key={albumName} className="mb-4">
          <h3 className="text-white font-semibold text-md mb-2 px-2">{albumName}</h3>
          {albumSongs.map((song) => {
            const originalIndex = songs.findIndex(s => s.id === song.id);
            return (
              <SongTile
                key={song.id || originalIndex}
                song={song}
                index={originalIndex}
                isCurrent={currentIndex === originalIndex}
                onPlay={() => playSong(originalIndex)}
                dragHandle={
                  <button
                    className="drag-handle flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-emerald-500/40 transition mr-1 cursor-grab"
                    title="Drag to reorder"
                    tabIndex={-1}
                    draggable
                    onDragStart={() => handleDragStart(originalIndex)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(originalIndex)}
                  >
                    <FaGripVertical className="text-white text-lg" />
                  </button>
                }
                className="px-2 py-1 bg-white/5 border-b border-white/10"
              />
            );
          })}
        </div>
      ));
    }
  };

  return (
    <div className="home w-full h-full flex flex-col items-center justify-start overflow-y-auto pb-20">
      {/* Header with search, filter, genres */}
      <div className="head w-[90%] flex flex-col md:flex-row items-start md:items-center justify-between relative z-2 gap-2 mt-4">
        {/* Search */}
        <div className="relative flex items-center">
          <button
            className="search flex flex-row border border-white/20 bg-white/20 backdrop-blur-[20px] 
            w-[35px] h-[35px] rounded-full items-center justify-center"
            onClick={() => setShowInput((v) => !v)}
          >
            <FaSearch className="text-white text-lg" />
          </button>
          <input
            type="text"
            className={`searchInput ml-2 px-3 py-1 bg-white/20 border border-white/20 text-white outline-none
              rounded-[20px] font-[14px] text-[14px] transition-all duration-300 ease-in-out
              ${showInput ? 'max-w-[250px] opacity-100 w-[250px] scale-x-100' : 'max-w-0 opacity-0 w-0 scale-x-0 pointer-events-none'}`}
            style={{ minWidth: 0 }}
            autoFocus={showInput}
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search offline songs..."
          />
          {showInput && searchResults.length > 0 && (
            <div className="absolute left-12 top-10 w-[250px] bg-emerald-600 rounded shadow-lg z-1000 text-white text-ellipsis overflow-hidden">
              {searchResults.map((song, i) => (
                <div
                  key={song.id || i}
                  className="px-3 py-2 h-[40px] text-white hover:bg-emerald-100/20 cursor-pointer text-xs flex items-center gap-2
                  text-ellipsis overflow-hidden"
                  onClick={() => {
                    setShowInput(false);
                    setQuery(song.name);
                    // Optionally play
                    const idx = songs.findIndex(s => s.id === song.id);
                    if (idx !== -1) playSong(idx);
                  }}
                >
                  <img src={song.cover} alt={song.name} className="w-7 h-7 rounded object-cover mr-2" />
                  <span className="font-semibold truncate overflow-hidden whitespace-nowrap max-w-[140px]">
                    {song.name?.length > 24 ? song.name.slice(0, 24) + '…' : song.name}
                  </span>
                  <span className="ml-2 text-white/60 truncate overflow-hidden whitespace-nowrap max-w-[100px]">
                    {song.artist?.length > 24 ? song.artist.slice(0, 24) + '…' : song.artist}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filter Tabs (Albums / Songs) */}
        <div className="optionsTab relative flex items-center gap-2 ml-0 md:ml-4 mt-2 md:mt-0 bg-transparent rounded-[20px] px-2 py-1 border border-white/10 backdrop-blur-[20px] w-full md:w-auto">
          <div
            className="absolute top-1 left-3 h-[25px] w-[70px] rounded-full bg-emerald-500/80 z-0 transition-all duration-300 ease-in-out"
            style={{
              transform: `translateX(${activeFilter === 'Albums' ? 0 : 90}px)`,
            }}
          />
          <button
            className={`relative py-1 w-[80px] rounded-full text-xs transition z-10 ${activeFilter === 'Albums' ? 'text-white' : 'text-white hover:bg-emerald-500/80'}`}
            onClick={() => setActiveFilter('Albums')}
          >
            Albums
          </button>
          <button
            className={`relative py-1 w-[80px] rounded-full text-xs transition z-10 ${activeFilter === 'Songs' ? 'text-white' : 'text-white hover:bg-emerald-500/80'}`}
            onClick={() => setActiveFilter('Songs')}
          >
            Songs
          </button>
          {/* Genre dropdown */}
          <div className="relative z-10">
            <button
              className="px-3 py-1 rounded-full text-xs text-white bg-white/10 border border-white/20 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition"
              onClick={e => { e.preventDefault(); setShowGenres(g => !g); }}
            >
              {selectedGenre || 'Genres'}
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showGenres && (
              <div className="absolute left-0 top-9 min-w-[120px] bg-emerald-500 rounded-[16px] shadow-lg z-[1] backdrop-blur-[40px] border border-white/20">
                {['Pop', 'Rock', 'Hip-Hop', 'Jazz', 'Electronic', 'Classical'].map(genre => (
                  <div
                    key={genre}
                    className="px-4 py-2 text-xs text-white cursor-pointer hover:bg-white/20 rounded-[12px] transition"
                    onClick={() => { setSelectedGenre(genre); setShowGenres(false); }}
                  >
                    {genre}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content: now playing card + queue */}
      <div className="body w-[100%] flex-1 flex flex-row items-start justify-center z-1 px-4">
        {renderNowPlaying()}

        <div className="songsList w-[72%] flex-1 flex flex-col items-start justify-start bg-white/20 backdrop-blur-[20px] rounded-[16px] border border-white/20 mt-8 p-4 overflow-y ml-[20px]">
          <div className="songlisthead border-b border-white/10 w-full flex items-center justify-between px-4 py-2">
            <h2 className="text-white text-lg font-semibold">
              {activeFilter === 'Songs' ? 'Queue' : 'Albums'}
            </h2>
            <p className="text-white/70 text-sm">
              {filteredQueue.length} {filteredQueue.length === 1 ? 'song' : 'songs'}
            </p>
          </div>
          <div className="flex flex-col w-full mt-2 gap-2 overflow-y-auto">
            {renderQueue()}
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="playControls w-full flex flex-col md:flex-row items-center justify-start px-2 md:px-3 bg-white/20 backdrop-blur-[20px] mt-4 md:mt-6 rounded-[16px] md:rounded-[24px] gap-2 md:gap-3 z-[1100] flex-shrink-0">
        {/* Song cover + info */}
        <div className="w-full flex items-center gap-2 md:gap-3">
          <img
            src={currentSong?.cover || songs[0]?.cover || 'https://placehold.co/80x56/EEE/31343C'}
            alt={currentSong?.name || 'No song'}
            className="w-10 h-10 md:w-[80px] md:h-[56px] rounded-[8px] md:rounded-[12px] object-cover shadow-md border border-white/20 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="marquee-container">
              <span className="marquee-text text-white text-xs md:text-sm font-semibold">
                {currentSong?.name || songs[0]?.name || 'No Song'}
              </span>
            </div>
            <span className="text-white/70 text-[10px] md:text-xs truncate block">
              {currentSong?.artist || songs[0]?.artist || 'Artist'}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full flex flex-col md:flex-1 md:mx-3 mt-1 md:mt-0">
          <div className="flex items-center justify-between text-white/60 text-[9px] md:text-xs mb-0.5 md:mb-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div
            className="w-full h-1.5 md:h-2 bg-white/10 rounded-full relative cursor-pointer group"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              if (audioRef.current && duration) {
                audioRef.current.currentTime = percent * duration;
              }
            }}
          >
            <div
              className="h-1.5 md:h-2 bg-emerald-400 rounded-full"
              style={{ width: `${((currentTime || 0) / (duration || 1)) * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `calc(${((currentTime || 0) / (duration || 1)) * 100}% - 6px)` }}
            >
              <div className="w-3 h-3 md:w-4 md:h-4 bg-emerald-400 border-2 border-white/80 rounded-full shadow-md cursor-pointer transition group-hover:scale-110" />
            </div>
          </div>
        </div>

        {/* Control buttons */}
        <div className="w-full flex items-center justify-center md:justify-start gap-2 mt-1 md:mt-0 md:gap-2">
          {/* Shuffle */}
          <button
            className={`hidden md:flex w-6 h-6 md:w-7 md:h-7 items-center justify-center rounded-full transition ${shuffle ? 'bg-emerald-500/30' : ''}`}
            title="Shuffle"
            onClick={() => setShuffle(s => !s)}
          >
            <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16M4 20l16-16" />
            </svg>
          </button>

          {/* Previous */}
          <button
            className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full hover:bg-emerald-500/30 transition"
            title="Previous"
            onClick={() => {
              if (currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
                setIsPlaying(true);
              }
            }}
            disabled={currentIndex === 0}
          >
            <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 transition shadow-lg"
            title={isPlaying ? 'Pause' : 'Play'}
            onClick={() => setIsPlaying(p => !p)}
            disabled={songs.length === 0}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button
            className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full hover:bg-emerald-500/30 transition"
            title="Next"
            onClick={() => {
              if (currentIndex < songs.length - 1) {
                setCurrentIndex(currentIndex + 1);
                setIsPlaying(true);
              }
            }}
            disabled={currentIndex === songs.length - 1}
          >
            <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Repeat */}
          <button
            className={`hidden md:flex w-6 h-6 md:w-7 md:h-7 items-center justify-center rounded-full transition ${repeatMode !== 'off' ? 'bg-emerald-500/30' : ''}`}
            title={repeatMode === 'one' ? 'Repeat One' : repeatMode === 'all' ? 'Repeat All' : 'Repeat Off'}
            onClick={() => {
              setRepeatMode(m => {
                if (m === 'off') return 'all';
                if (m === 'all') return 'one';
                return 'off';
              });
            }}
          >
            {repeatMode === 'one' ? (
              <svg className="w-3 h-3 md:w-4 md:h-4 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <text x="12" y="16" textAnchor="middle" fontSize="8" fill="currentColor">1</text>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4M3 11v-1a4 4 0 014-4h14" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 23l-4-4 4-4m14-2v1a4 4 0 01-4 4H3" />
              </svg>
            ) : (
              <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4M3 11v-1a4 4 0 014-4h14" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 23l-4-4 4-4m14-2v1a4 4 0 01-4 4H3" />
              </svg>
            )}
          </button>

          {/* Volume */}
          <div className="relative hidden md:block">
            <button
              className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full hover:bg-emerald-500/30 transition"
              title="Volume"
              onClick={() => setShowVolume(v => !v)}
            >
              <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 12c0-2.21-1.79-4-4-4m0 8c2.21 0 4-1.79 4-4z" />
              </svg>
            </button>
            {showVolume && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-12 h-36 bg-emerald-500/90 rounded-[20px] shadow-lg 
              flex flex-col items-center justify-evenly z-[1000]">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  className="w-24 h-6 accent-emerald-900 transform -rotate-90 mb-[auto] cursor-pointer mt-[50px]"
                />
                <span className="text-xs text-emerald-800 mb-1 text-center w-full font-bold">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}