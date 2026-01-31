import React, { useState, useEffect } from 'react';
import { FaSearch, FaThumbsUp, FaThumbsDown, FaStar, FaHeart } from 'react-icons/fa';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleArrowDown } from '@fortawesome/free-solid-svg-icons';
import { FaGripVertical } from 'react-icons/fa';
import { fetchSongs, patchSong as apiPatchSong } from '../services/api';
import RecentlyPlayed from './RecentlyPlayed';
import SongTile from './SongTile';
import { usePlayer } from '../context/PlayerContext';

export default function Home() {
  const [showInput, setShowInput] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showGenres, setShowGenres] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [activeFilter, setActiveFilter] = useState('Albums');
  const [showReactions, setShowReactions] = useState(false);
  const [userReaction, setUserReaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [showVolume, setShowVolume] = useState(false);

  // Shuffle and repeat state
  const [shuffle, setShuffle] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState([]);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'all', 'one'
  // Set initial volume to 20% on first mount
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
    currentSong
  } = usePlayer();

  useEffect(() => {
    setVolume(0.2);
    // eslint-disable-next-line
  }, []);

  // Handle shuffle order
  useEffect(() => {
    if (shuffle && songs.length > 1) {
      const indices = songs.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      // Preserve current song in shuffled order
      const currentIdx = indices.indexOf(currentIndex);
      if (currentIdx > 0) {
        [indices[0], indices[currentIdx]] = [indices[currentIdx], indices[0]];
      }
      setShuffledOrder(indices);
      // Do NOT reset currentIndex, keep current song
    } else {
      setShuffledOrder([]);
      // Do NOT reset currentIndex, keep current song
    }
    // eslint-disable-next-line
  }, [shuffle]);


  // Fetch songs from API
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchSongs()
      .then(data => {
        const downloaded = Array.isArray(data)
          ? data.filter(song => song.downloaded)
          : (data.songs || []).filter(song => song.downloaded);
        // Only update songs if changed
        setPlayerSongs(prev => {
          const prevIds = prev.map(s => s.id).join(',');
          const newIds = downloaded.map(s => s.id).join(',');
          if (prevIds !== newIds) {
            return downloaded;
          }
          return prev;
        });
        setLoading(false);
      })
      .catch((err) => {
        // Fallback: use global downloadedSongs from context
        setPlayerSongs(prev => prev.length ? prev : downloadedSongs);
        setError('Could not load songs. Showing downloads only.');
        setLoading(false);
      });
    // eslint-disable-next-line
  }, [downloadedSongs]);

  // Seek handler (optional: implement with context if needed)
  // const handleSeek = ...

  // Auto-next logic is handled in PlayerContext

  // PATCH helper for updating song fields
  const patchSong = async (id, patch) => {
    try {
      await apiPatchSong(id, patch);
      // Update global songs state
      setPlayerSongs(songs => songs.map(s => s.id === id ? { ...s, ...patch } : s));
    } catch (e) {
      setError('Could not update song.');
    }
  };

  // Simulate song ending (for demo)
  React.useEffect(() => {
    if (!userReaction) {
      const timer = setTimeout(() => setShowReactions(true), 5000); // show after 5s
      return () => clearTimeout(timer);
    }
  }, [userReaction]);

  // Search/filter songs from API
  function handleSearch(val) {
    setQuery(val);
    if (val.trim() === '') {
      setResults([]);
      return;
    }
    // Filter songs by name, artist, or album (case-insensitive)
    const q = val.toLowerCase();
    const filtered = songs.filter(song =>
      song.name?.toLowerCase().includes(q) ||
      song.artist?.toLowerCase().includes(q) ||
      song.album?.toLowerCase().includes(q)
    );
    setResults(filtered);
  }

  // Helper to format time in mm:ss (optional: can use context if needed)
  function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + s.toString().padStart(2, '0');
  }

  return (
    <div className="home w-full h-full flex flex-col items-center justify-start">
      {/* Audio element removed, handled by PlayerContext */}
      <div className="head w-[90%] flex flex-col md:flex-row items-start md:items-center justify-between relative z-2 gap-2">
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
            placeholder="Search music..."
          />
          {/* Dropdown for results */}
          {showInput && results.length > 0 && (
            <div className="absolute left-12 top-10 w-[250px] bg-emerald-600 rounded shadow-lg z-1000 text-white text-ellipsis overflow-hidden">
              {results.map((song, i) => (
                <div
                  key={song.id || i}
                  className="px-3 py-2 h-[40px] text-white hover:bg-emerald-100/20 cursor-pointer text-xs flex items-center gap-2
                  text-ellipsis overflow-hidden"
                  onClick={() => {
                    // Optionally, play or select the song
                    setShowInput(false);
                    setQuery(song.name);
                  }}
                >
                  <img src={song.cover} alt={song.name} className="w-7 h-7 rounded object-cover mr-2" />
                  <span className="font-semibold truncate overflow-hidden whitespace-nowrap max-w-[140px]">
                    {song.name && song.name.length > 24 ? song.name.slice(0, 24) + '…' : song.name}
                  </span>
                  <span className="ml-2 text-white/60 truncate overflow-hidden whitespace-nowrap max-w-[100px]">
                    {song.artist && song.artist.length > 24 ? song.artist.slice(0, 24) + '…' : song.artist}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

          <div className="optionsTab relative flex items-center gap-2 ml-0 md:ml-4 mt-2 md:mt-0 bg-transparent rounded-[20px] px-2 py-1 border border-white/10 backdrop-blur-[20px] w-full md:w-auto">
            <div
              className="absolute top-1 left-3 h-[25px] w-[70px] rounded-full bg-emerald-500/80 z-0 transition-all duration-300 ease-in-out"
              style={{
                transform: `translateX(${activeFilter === 'Albums' ? 0 : activeFilter === 'Songs' ? 90 : 180}px)`,
                opacity: 1,
              }}
            />
            <button className={`relative py-1 w-[80px] rounded-full text-xs transition z-10 ${activeFilter === 'Albums' ? 'text-white' : 'text-white hover:bg-emerald-500/80'}`} onClick={() => setActiveFilter('Albums')}>Albums</button>
            <button className={`relative py-1 w-[80px] rounded-full text-xs transition z-10 ${activeFilter === 'Songs' ? 'text-white' : 'text-white hover:bg-emerald-500/80'}`} onClick={() => setActiveFilter('Songs')}>Songs</button>
            {/* Recents removed for mobile nav per request */}
            <div className="relative z-10">
              <button className="px-3 py-1 rounded-full text-xs text-white bg-white/10 border border-white/20 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition" onClick={e => { e.preventDefault(); setShowGenres(g => !g); }}>
                {selectedGenre ? selectedGenre : 'Genres'}
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showGenres && (
                <div className="absolute left-0 top-9 min-w-[120px] bg-emerald-500 rounded-[16px] shadow-lg z-[1] backdrop-blur-[40px] border border-white/20">
                  {['Pop','Rock','Hip-Hop','Jazz','Electronic','Classical'].map(genre => (
                    <div key={genre} className={`px-4 py-2 text-xs text-white cursor-pointer hover:bg-white/20 rounded-[12px] transition`} onClick={() => { setSelectedGenre(genre); setShowGenres(false); }}>
                      {genre}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      </div>

      {/* Recents tab removed — RecentlyPlayed is no longer accessible via this tab */}

      <div className="musicSource w-[96%] h-[30px] flex items-center justify-between px-4 mt-[10px] mb-[0px]">
        {/*this is just a heading to tell where the music playing is from i.e downloaded, streaming, etc. */}
        <h3 className="text-white text-sm font-bold text-[28px]">{songs[currentIndex]?.source || 'Downloads'}</h3>
      </div>

      <div className="body w-[100%] flex-1 flex flex-row items-start justify-center z-1">
        <div className="musicDisplayCard w-[22%] h-[95%] flex flex-col items-center justify-start bg-white/20 backdrop-blur-[20px] 
        rounded-[16px] border border-white/20 mt-8 p-0 overflow-hidden shadow-xl">
          <div className="musicCover flex items-center justify-center w-full h-[320px] bg-black/10 rounded-t-[16px]">
            <img
              src={songs[currentIndex]?.cover || 'https://placehold.co/600x400/EEE/31343C'}
              alt={songs[currentIndex]?.name || 'placeholder'}
              className="w-full h-full object-cover rounded-t-[16px]"
            />
          </div>
          {/* Interactions: always show star except when like/dislike are shown; like/dislike only at end if not interacted */}
          <div className="musicReactions flex flex-row items-center justify-end w-full gap-2 border-b border-white/10 max-h-[50px] 
          min-h-[40px] py-4 pr-[10px]">
            {showReactions && !userReaction ? (
              <>
                <button
                  type="button"
                  className="like flex items-center justify-center w-[30px] h-[30px] rounded-full bg-white/10 hover:bg-emerald-500/80 transition"
                  onClick={() => {
                    setUserReaction('like');
                    if (songs[currentIndex]) patchSong(songs[currentIndex].id, { like: true, dislike: false });
                  }}
                  title="Like"
                >
                  <FaThumbsUp className="text-white text-lg" />
                </button>
                <button
                  type="button"
                  className="dislike flex items-center justify-center w-[30px] h-[30px] rounded-full bg-white/10 hover:bg-emerald-500/80 transition"
                  onClick={() => {
                    setUserReaction('dislike');
                    if (songs[currentIndex]) patchSong(songs[currentIndex].id, { like: false, dislike: true });
                  }}
                  title="Dislike"
                >
                  <FaThumbsDown className="text-white text-lg" />
                </button>
              </>
            ) : userReaction === 'like' ? (
              <>
                <button
                  type="button"
                  className="star flex items-center justify-center w-[30px] h-[30px] rounded-full 
                  hover:bg-yellow-400/80 transition bg-white/10"
                  title="Favorite"
                  onClick={() => songs[currentIndex] && patchSong(songs[currentIndex].id, { favorite: !songs[currentIndex].favorite })}
                >
                  <FaStar className="text-yellow-400 text-lg" />
                </button>
                <FaHeart className="text-emerald-400 text-sm ml-2 w-[17px] h-[17px]" title="Liked" />
              </>
            ) : userReaction === 'dislike' ? null : (
              <button
                type="button"
                className="star flex items-center justify-center w-10 h-10 rounded-full  
                hover:bg-yellow-400/80 transition bg-white/10"
                title="Favorite"
                onClick={() => songs[currentIndex] && patchSong(songs[currentIndex].id, { favorite: !songs[currentIndex].favorite })}
              >
                <FaStar className="text-yellow-400 text-lg" />
              </button>
            )}
          </div>
          <div className="musicMetaData flex flex-col items-start justify-start w-full px-6 py-4">
            <h2 className="text-white text-lg font-semibold">{songs[currentIndex]?.name || 'Song Title'}</h2>
            <p className="text-white/70 text-sm mb-2">{songs[currentIndex]?.artist || 'Artist Name'}</p>
          </div>
        </div>

        <div className="songsList w-[72%] flex-1 flex flex-col items-start justify-start bg-white/20 backdrop-blur-[20px] rounded-[16px] border border-white/20 mt-8 p-4 overflow-y ml-[20px]">
          <div className="songlisthead border-b border-white/10 w-full flex items-center justify-between px-4 py-2">
            <h2 className="text-white text-lg font-semibold">Next In Queue</h2>
            <p className="text-white/70 text-sm">{songs.length === 0 ? 'No songs in queue' : `${songs.length} song${songs.length > 1 ? 's' : ''} in queue`}</p>
          </div>
          <div className="flex flex-col w-full mt-2 gap-2 overflow-y-auto">
            {loading ? (
              <div className="text-white/60 text-sm px-4 py-6">Loading songs...</div>
            ) : error ? (
              <div className="text-red-400 text-sm px-4 py-6">{error}</div>
            ) : songs.length === 0 ? (
              <div className="text-white/60 text-sm px-4 py-6">No songs in queue</div>
            ) : (
              songs
                .filter(song => !selectedGenre || song.genre === selectedGenre)
                .map((song, idx) => (
                  <SongTile
                    key={song.id || idx}
                    song={song}
                    index={idx}
                    isCurrent={currentIndex === idx}
                    onPlay={() => { setCurrentIndex(idx); setIsPlaying(true); }}
                    onToggleFavorite={() => patchSong(song.id, { favorite: !song.favorite })}
                    onToggleDownload={() => patchSong(song.id, { downloaded: !song.downloaded })}
                    dragHandle={(
                      <button
                        className="drag-handle flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-emerald-500/40 transition mr-1 cursor-grab"
                        title="Drag to reorder"
                        tabIndex={-1}
                        onDragStart={() => setDraggedIdx(idx)}
                        onDragOver={e => { e.preventDefault(); }}
                        onDrop={() => {
                          if (draggedIdx === null || draggedIdx === idx) return;
                          const updated = [...songs];
                          const [removed] = updated.splice(draggedIdx, 1);
                          updated.splice(idx, 0, removed);
                          setPlayerSongs(updated);
                          setDraggedIdx(null);
                          if (currentIndex === draggedIdx) setCurrentIndex(idx);
                          else if (draggedIdx < currentIndex && idx >= currentIndex) setCurrentIndex(currentIndex - 1);
                          else if (draggedIdx > currentIndex && idx <= currentIndex) setCurrentIndex(currentIndex + 1);
                        }}
                      >
                        <FaGripVertical className="text-white text-lg" />
                      </button>
                    )}
                    className="px-2 py-1 bg-white/5 border-b border-white/10"
                  />
                ))
            )}
          </div>
        </div>
      </div>

      <div className="playControls w-full flex flex-col md:flex-row items-center justify-start px-2 md:px-3 bg-white/20 backdrop-blur-[20px] mt-4 md:mt-6 rounded-[16px] md:rounded-[24px] gap-2 md:gap-3 z-[1100] flex-shrink-0">
        <div className="w-full flex items-center gap-2 md:gap-3">
          {/* Song Cover - tiny 40x40 on mobile, 80x56 on desktop */}
          <img
            src={songs[currentIndex]?.cover}
            alt={songs[currentIndex]?.name}
            className="w-10 h-10 md:w-[80px] md:h-[56px] rounded-[8px] md:rounded-[12px] object-cover shadow-md border border-white/20 flex-shrink-0"
          />
          {/* Song Info: marquee title + artist */}
          <div className="flex-1 min-w-0">
            <div className="marquee-container">
              <span className="marquee-text text-white text-xs md:text-sm font-semibold">{songs[currentIndex]?.name || 'No Song'}</span>
            </div>
            <span className="text-white/70 text-[10px] md:text-xs truncate block">{songs[currentIndex]?.artist || 'Artist'}<span className="text-white/40 text-[10px] ml-1">{songs[currentIndex]?.featuring ? `ft. ${songs[currentIndex].featuring}` : ''}</span></span>
          </div>
        </div>

        {/* Progress Bar - always full width */}
        <div className="w-full flex flex-col md:flex-1 md:mx-3 mt-1 md:mt-0">
          <div className="flex items-center justify-between text-white/60 text-[9px] md:text-xs mb-0.5 md:mb-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div
            className="w-full h-1.5 md:h-2 bg-white/10 rounded-full relative cursor-pointer group"
            style={{ userSelect: 'none' }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              if (audioRef && audioRef.current && duration) {
                audioRef.current.currentTime = percent * duration;
              }
            }}
          >
            <div
              className="h-1.5 md:h-2 bg-emerald-400 rounded-full"
              style={{ width: `${((currentTime || 0) / (duration || 1)) * 100}%` }}
            ></div>
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `calc(${((currentTime || 0) / (duration || 1)) * 100}% - 6px)` }}
            >
              <div className="w-3 h-3 md:w-4 md:h-4 bg-emerald-400 border-2 border-white/80 rounded-full shadow-md cursor-pointer transition group-hover:scale-110"></div>
            </div>
          </div>
        </div>

        {/* Controls - compact row, hidden on mobile for shuffle/repeat/volume */}
        <div className="w-full flex items-center justify-center md:justify-start gap-2 mt-1 md:mt-0 md:gap-2">
          {/* Shuffle - hidden on mobile */}
          <button
            className={`hidden md:flex w-6 h-6 md:w-7 md:h-7 items-center justify-center rounded-full transition ${shuffle ? 'bg-emerald-500/30' : ''}`}
            title="Shuffle"
            onClick={() => setShuffle(s => !s)}
          >
            <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16M4 20l16-16" /></svg>
          </button>

          {/* Back */}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
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

          {/* Forward */}
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

          {/* Repeat - hidden on mobile */}
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

          {/* Volume - hidden on mobile */}
          <div className="relative hidden md:block">
            <button
              className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full hover:bg-emerald-500/30 transition"
              title="Volume"
              onClick={() => setShowVolume(v => !v)}
            >
              <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" /><path strokeLinecap="round" 
                strokeLinejoin="round" d="M19 12c0-2.21-1.79-4-4-4m0 8c2.21 0 4-1.79 4-4z" />
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
  )
}






