import React, { useState, useMemo } from 'react';
import { FaSearch, FaPlay } from 'react-icons/fa';
import TinyPlayer from './TinyPlayer';
import { usePlayer } from '../context/PlayerContext';
import SongTile from './SongTile';

export default function Library() {
  const {
    currentSong,
    isPlaying,
    playNext,
    playPrev,
    setIsPlaying,
    isMuted,
    toggleMute,
    downloadedSongs,
    setPlayerSongs,
    setCurrentIndex,
    songs
  } = usePlayer();

  const [showInput, setShowInput] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showGenres, setShowGenres] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [activeFilter, setActiveFilter] = useState('Albums');
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);

  const collageCovers = React.useMemo(() => {
    if (!downloadedSongs.length) return [];
    const shuffled = [...downloadedSongs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 4);
  }, [downloadedSongs]);

  const library = downloadedSongs && downloadedSongs.length ? downloadedSongs : songs || [];

  const albums = useMemo(() => {
    const map = {};
    library.forEach(s => {
      const key = s.album || 'Unknown Album';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return Object.keys(map).map(k => ({ album: k, songs: map[k] }));
  }, [library]);

  function playFromAlbum(song, albumSongs) {
    setPlayerSongs(albumSongs);
    const idx = albumSongs.findIndex(s => s.id === song.id);
    setCurrentIndex(idx >= 0 ? idx : 0);
    setIsPlaying(true);
  }

  function openAlbum(alb) {
    setSelectedAlbum(alb);
    setShowDetailView(true);
  }

  function closeDetail() {
    setShowDetailView(false);
    setSelectedAlbum(null);
  }

  function handleSearch(val) {
    setQuery(val);
    if (val.trim() === '') {
      setResults([]);
      return;
    }
    setResults([
      val + ' Song',
      val + ' Artist',
      val + ' Album',
    ]);
  }

  return (
    <div className="library flex flex-col items-center justify-start w-full h-full pb-20">
      {/* Header Section */}
      <div className="head w-full max-w-[1600px] px-4 md:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex flex-col gap-4">
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex items-center w-full md:w-auto">
              <button
                className="search flex items-center justify-center border border-white/20 bg-white/10 
                backdrop-blur-xl w-[40px] h-[40px] rounded-full hover:bg-white/20 transition-all 
                shadow-lg hover:shadow-emerald-500/20"
                onClick={() => setShowInput((v) => !v)}
              >
                <FaSearch className="text-white text-base" />
              </button>
              <input
                type="text"
                className={`searchInput ml-3 px-4 py-2.5 bg-white/10 border border-white/20 text-white 
                outline-none rounded-full font-medium text-sm transition-all duration-300 ease-in-out
                backdrop-blur-xl placeholder:text-white/50 focus:bg-white/15 focus:border-emerald-400/50
                ${showInput ? 'max-w-[280px] opacity-100 w-[280px] scale-x-100' : 'max-w-0 opacity-0 w-0 scale-x-0 pointer-events-none'}`}
                autoFocus={showInput}
                value={query}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search library..."
              />
              {showInput && results.length > 0 && (
                <div className="absolute left-0 top-14 w-full max-w-[320px] bg-gradient-to-b from-emerald-600 
                to-emerald-700 rounded-2xl shadow-2xl z-50 overflow-hidden border border-white/10 backdrop-blur-xl">
                  {results.map((song, i) => (
                    <div 
                      key={i} 
                      className="px-4 py-3 text-white hover:bg-white/10 cursor-pointer text-sm 
                      flex items-center gap-3 transition-all"
                    >
                      <img src={song.cover} alt={song.name} className="w-10 h-10 rounded-lg object-cover shadow-md" />
                      <span className="font-semibold truncate">{song.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TinyPlayer - Desktop */}
            <div className="hidden md:block">
              <TinyPlayer
                song={currentSong}
                isPlaying={isPlaying}
                onPlayPause={() => setIsPlaying(p => !p)}
                onPrev={playPrev}
                onNext={playNext}
                isMuted={isMuted}
                onMuteToggle={toggleMute}
              />
            </div>

            {/* Filter Tabs */}
            <div className="optionsTab relative flex items-center gap-1 bg-white/10 rounded-full 
            px-1.5 py-1.5 border border-white/20 backdrop-blur-xl shadow-lg w-full md:w-auto">
              <div 
                className="absolute top-1.5 h-[34px] rounded-full bg-gradient-to-r from-emerald-500 
                to-emerald-600 shadow-lg transition-all duration-300 ease-out" 
                style={{
                  width: activeFilter === 'Albums' ? '90px' : '90px',
                  transform: activeFilter === 'Albums' ? 'translateX(6px)' : 'translateX(102px)',
                }}
              />
              <button 
                className={`relative py-2 px-6 rounded-full text-sm font-medium transition-all 
                z-10 ${activeFilter === 'Albums' ? 'text-white' : 'text-white/70 hover:text-white'}`}
                onClick={() => setActiveFilter('Albums')}
              >
                Albums
              </button>
              <button 
                className={`relative py-2 px-6 rounded-full text-sm font-medium transition-all 
                z-10 ${activeFilter === 'Songs' ? 'text-white' : 'text-white/70 hover:text-white'}`}
                onClick={() => setActiveFilter('Songs')}
              >
                Songs
              </button>
              <div className="relative z-10">
                <button 
                  className="px-4 py-2 rounded-full text-sm font-medium text-white bg-white/10 
                  border border-white/20 flex items-center gap-2 hover:bg-white/20 transition-all ml-2"
                  onClick={e => { 
                    e.preventDefault(); 
                    setShowGenres(g => !g); 
                  }}
                >
                  {selectedGenre || 'Genres'}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showGenres && (
                  <div className="absolute right-0 top-12 min-w-[140px] bg-gradient-to-b from-emerald-600 
                  to-emerald-700 rounded-2xl shadow-2xl z-50 backdrop-blur-xl border border-white/10 py-2">
                    {['Pop', 'Rock', 'Hip-Hop', 'Jazz', 'Electronic', 'Classical'].map(genre => (
                      <div 
                        key={genre} 
                        className="px-4 py-2.5 text-sm font-medium text-white cursor-pointer 
                        hover:bg-white/20 transition-all"
                        onClick={() => { 
                          setSelectedGenre(genre); 
                          setShowGenres(false); 
                        }}
                      >
                        {genre}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Page Title */}
          <div className="mt-4">
            <h1 className="text-white text-4xl md:text-5xl font-bold tracking-tight">
              Library
            </h1>
            <p className="text-white/60 text-sm md:text-base mt-2">
              {albums.length} albums • {library.length} songs
            </p>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="w-full max-w-[1600px] px-4 md:px-6 lg:px-8 mt-6 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 pb-8">
          {albums.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <div className="inline-flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center">
                  <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div>
                  <p className="text-white/60 text-lg font-medium">No songs in library</p>
                  <p className="text-white/40 text-sm mt-1">Start adding music to see it here</p>
                </div>
              </div>
            </div>
          ) : (
            albums.map(alb => (
              <div 
                key={alb.album} 
                className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl 
                rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer 
                border border-white/10 hover:border-emerald-400/30 hover:scale-[1.02] overflow-hidden" 
                onClick={() => openAlbum(alb)}
              >
                {/* Album Grid */}
                <div className="aspect-square bg-gradient-to-br from-emerald-500/40 to-teal-600/40 
                rounded-t-2xl grid grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden p-0.5">
                  {alb.songs.slice(0, 4).map((s, idx) => (
                    <img 
                      key={idx} 
                      src={s.cover} 
                      alt={s.name} 
                      className="object-cover w-full h-full"
                    />
                  ))}
                </div>
                
                {/* Info */}
                <div className="p-4">
                  <h3 className="text-white font-bold text-base mb-1 truncate">{alb.album}</h3>
                  <p className="text-white/60 text-xs mb-1 truncate">{alb.songs[0]?.artist || ''}</p>
                  <p className="text-white/50 text-xs">{alb.songs.length} song{alb.songs.length !== 1 ? 's' : ''}</p>
                  
                  {/* Play Button */}
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setPlayerSongs(alb.songs); 
                      setCurrentIndex(0); 
                      setIsPlaying(true); 
                    }} 
                    className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-r 
                    from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
                    transition-all shadow-lg hover:shadow-emerald-500/50 ml-auto mt-3 transform 
                    hover:scale-110 active:scale-95"
                  >
                    <FaPlay className="text-white text-sm ml-0.5" />
                  </button>
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent 
                opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail View Modal */}
      {showDetailView && selectedAlbum && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="w-full p-4 md:p-6 border-b border-white/10 backdrop-blur-xl bg-black/40">
            <button 
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 
              backdrop-blur-xl hover:bg-white/20 transition-all border border-white/20 
              hover:border-white/30 shadow-lg"
              onClick={closeDetail}
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Album Header */}
          <div className="w-full px-4 md:px-8 py-6 flex flex-col md:flex-row items-start md:items-center gap-6 
          border-b border-white/10 bg-gradient-to-b from-black/60 to-transparent">
            <img 
              src={selectedAlbum.songs[0]?.cover} 
              alt={selectedAlbum.album} 
              className="w-48 h-48 md:w-56 md:h-56 rounded-3xl object-cover shadow-2xl 
              border-4 border-white/10"
            />
            <div className="flex flex-col justify-center">
              <p className="text-emerald-400 text-sm font-semibold uppercase tracking-wider mb-2">Album</p>
              <h1 className="text-white text-3xl md:text-5xl font-bold mb-3">{selectedAlbum.album}</h1>
              <p className="text-white/80 text-lg mb-2">{selectedAlbum.songs[0]?.artist || 'Various Artists'}</p>
              <p className="text-white/60 text-sm">{selectedAlbum.songs.length} song{selectedAlbum.songs.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Songs List */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
            <div className="max-w-[1400px] mx-auto">
              <h2 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                Tracks
              </h2>
              <div className="flex flex-col gap-1">
                {selectedAlbum.songs.map((song, index) => (
                  <div key={song.id || index}>
                    {/* Mobile View */}
                    <div className="block md:hidden">
                      <SongTile 
                        song={song} 
                        index={index} 
                        onPlay={() => playFromAlbum(song, selectedAlbum.songs)} 
                      />
                    </div>

                    {/* Desktop View */}
                    <div 
                      className="hidden md:flex songItem items-center gap-4 px-4 py-3 rounded-xl 
                      bg-white/5 hover:bg-white/10 transition-all cursor-pointer group border border-transparent 
                      hover:border-white/10" 
                      onClick={() => playFromAlbum(song, selectedAlbum.songs)}
                    >
                      <span className="text-white/40 group-hover:text-white/60 text-sm w-10 text-center font-medium">
                        {index + 1}
                      </span>
                      <img 
                        src={song.cover} 
                        alt={song.name} 
                        className="w-12 h-12 rounded-lg object-cover shadow-md"
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-white font-semibold truncate">{song.name}</span>
                        <span className="text-white/60 text-sm truncate">{song.artist}</span>
                      </div>
                      <span className="text-white/40 text-sm">{song.duration}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}