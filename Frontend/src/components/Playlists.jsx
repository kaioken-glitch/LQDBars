import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FaStar, FaHeart, FaSearch, FaPlay } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import TinyPlayer from './TinyPlayer';
import SongTile from './SongTile';
import musicApi from '../utils/musicApi';

export default function Playlists() {
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [mockSongStates, setMockSongStates] = useState({});
  const [showInput, setShowInput] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Albums');
  const [showGenres, setShowGenres] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');

  const {
    songs,
    currentIndex,
    isPlaying,
    setIsPlaying,
    currentTime,
    duration,
    audioRef,
    currentSong,
    playPrev,
    playNext,
    isMuted,
    toggleMute
  } = usePlayer();

  const userPlaylists = [
    {
      id: 1,
      name: "My Favorites",
      description: "All my favorite tracks",
      songCount: 12,
      duration: "45 min",
      cover: "https://placehold.co/300x300?text=My+Favorites",
      songs: Array.from({ length: 12 }, (_, i) => ({
        id: `fav-${i}`,
        name: `Favorite Song ${i + 1}`,
        artist: 'Favorite Artist',
        duration: `${Math.floor(Math.random() * 3) + 2}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        cover: `https://placehold.co/60x60?text=Song+${i + 1}`
      }))
    },
    {
      id: 2,
      name: "Workout Mix",
      description: "High energy songs for gym",
      songCount: 20,
      duration: "1h 15min",
      cover: "https://placehold.co/300x300?text=Workout+Mix",
      songs: Array.from({ length: 20 }, (_, i) => ({
        id: `workout-${i}`,
        name: `Pump Song ${i + 1}`,
        artist: 'Energy Artist',
        duration: `${Math.floor(Math.random() * 3) + 2}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        cover: `https://placehold.co/60x60?text=Pump+${i + 1}`
      }))
    },
    {
      id: 3,
      name: "Chill Vibes",
      description: "Relaxing music for study",
      songCount: 8,
      duration: "32 min",
      cover: "https://placehold.co/300x300?text=Chill+Vibes",
      songs: Array.from({ length: 8 }, (_, i) => ({
        id: `chill-${i}`,
        name: `Chill Track ${i + 1}`,
        artist: 'Ambient Artist',
        duration: `${Math.floor(Math.random() * 4) + 3}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        cover: `https://placehold.co/60x60?text=Chill+${i + 1}`
      }))
    },
    {
      id: 4,
      name: "Road Trip",
      description: "Perfect songs for long drives",
      songCount: 25,
      duration: "1h 40min",
      cover: "https://placehold.co/300x300?text=Road+Trip",
      songs: Array.from({ length: 25 }, (_, i) => ({
        id: `road-${i}`,
        name: `Highway Song ${i + 1}`,
        artist: 'Road Artist',
        duration: `${Math.floor(Math.random() * 3) + 2}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        cover: `https://placehold.co/60x60?text=Road+${i + 1}`
      }))
    },
    {
      id: 5,
      name: "Party Hits",
      description: "Dance floor bangers",
      songCount: 15,
      duration: "55 min",
      cover: "https://placehold.co/300x300?text=Party+Hits",
      songs: Array.from({ length: 15 }, (_, i) => ({
        id: `party-${i}`,
        name: `Party Track ${i + 1}`,
        artist: 'Party Artist',
        duration: `${Math.floor(Math.random() * 3) + 2}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        cover: `https://placehold.co/60x60?text=Party+${i + 1}`
      }))
    },
    {
      id: 6,
      name: "Throwback",
      description: "Classic hits from the past",
      songCount: 18,
      duration: "1h 10min",
      cover: "https://placehold.co/300x300?text=Throwback",
      songs: Array.from({ length: 18 }, (_, i) => ({
        id: `throwback-${i}`,
        name: `Classic Hit ${i + 1}`,
        artist: 'Retro Artist',
        duration: `${Math.floor(Math.random() * 4) + 2}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        cover: `https://placehold.co/60x60?text=Classic+${i + 1}`
      }))
    }
  ];

  const handlePlaylistPlay = (playlist) => {
    setSelectedPlaylist(playlist);
    setShowDetailView(true);
  };

  const handleBackFromDetail = () => {
    setShowDetailView(false);
    setSelectedPlaylist(null);
  };

  const handleSearch = async (searchQuery) => {
    setQuery(searchQuery);
    if (searchQuery.trim()) {
      try {
        const apiResults = await musicApi.searchTracks(searchQuery, 10);
        if (apiResults && apiResults.length > 0) {
          setResults(apiResults);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      }
    } else {
      setResults([]);
    }
  };

  return (
    <div className="playlists w-full h-full flex flex-col items-center justify-start overflow-x-hidden pb-20">
      {!showDetailView ? (
        <>
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
                    placeholder="Search playlists..."
                  />
                  {showInput && results.length > 0 && (
                    <div className="absolute left-0 top-14 w-full max-w-[320px] bg-gradient-to-b from-emerald-600 
                    to-emerald-700 rounded-2xl shadow-2xl z-50 overflow-hidden border border-white/10 backdrop-blur-xl">
                      {results.map((song, i) => (
                        <div
                          key={song.id || i}
                          className="px-4 py-3 text-white hover:bg-white/10 cursor-pointer text-sm 
                          flex items-center gap-3 transition-all"
                          onClick={() => {
                            setShowInput(false);
                            setQuery(song.name);
                          }}
                        >
                          <img src={song.cover} alt={song.name} className="w-10 h-10 rounded-lg object-cover shadow-md" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{song.name && song.name.length > 24 ? song.name.slice(0, 24) + '…' : song.name}</p>
                            <p className="text-white/70 text-xs truncate">{song.artist && song.artist.length > 24 ? song.artist.slice(0, 24) + '…' : song.artist}</p>
                          </div>
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
                  Playlists
                </h1>
                <p className="text-white/60 text-sm md:text-base mt-2">
                  {userPlaylists.length} playlists • {userPlaylists.reduce((acc, p) => acc + p.songCount, 0)} songs
                </p>
              </div>
            </div>
          </div>

          {/* Playlists Grid */}
          <div className="w-full max-w-[1600px] px-4 md:px-6 lg:px-8 mt-6 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 pb-8">
              {userPlaylists.map((playlist) => (
                <div 
                  key={playlist.id} 
                  className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl 
                  rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer 
                  border border-white/10 hover:border-emerald-400/30 hover:scale-[1.02] overflow-hidden"
                >
                  {/* Playlist Cover */}
                  <div className="aspect-square bg-gradient-to-br from-purple-500/40 to-indigo-600/40 
                  rounded-t-2xl flex items-center justify-center overflow-hidden relative">
                    <img 
                      src={playlist.cover} 
                      alt={playlist.name} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-white font-bold text-base mb-1 truncate">{playlist.name}</h3>
                    <p className="text-white/60 text-xs mb-1 truncate">{playlist.description}</p>
                    <p className="text-white/50 text-xs mb-3">
                      {playlist.songCount} songs • {playlist.duration}
                    </p>

                    {/* Play Button */}
                    <button 
                      className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-r 
                      from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
                      transition-all shadow-lg hover:shadow-emerald-500/50 ml-auto transform 
                      hover:scale-110 active:scale-95"
                      onClick={() => handlePlaylistPlay(playlist)}
                    >
                      <FaPlay className="text-white text-sm ml-0.5" />
                    </button>
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent 
                  opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Detail View - Playlist Songs List */
        <div className="detailView w-full h-full flex flex-col">
          {/* Header */}
          <div className="detailHeader w-full p-4 md:p-6 border-b border-white/10 backdrop-blur-xl bg-black/40">
            <button 
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 
              backdrop-blur-xl hover:bg-white/20 transition-all border border-white/20 
              hover:border-white/30 shadow-lg"
              onClick={handleBackFromDetail}
            >
              <FontAwesomeIcon icon={faArrowLeft} className="text-white text-lg" />
            </button>
          </div>

          {/* Playlist Header */}
          <div className="playlistDetails w-full px-4 md:px-8 py-6 flex flex-col md:flex-row items-start md:items-center gap-6 
          border-b border-white/10 bg-gradient-to-b from-black/60 to-transparent">
            <img 
              src={selectedPlaylist?.cover} 
              alt={selectedPlaylist?.name} 
              className="w-48 h-48 md:w-56 md:h-56 rounded-3xl object-cover shadow-2xl 
              border-4 border-white/10"
            />
            <div className="flex flex-col justify-center">
              <p className="text-emerald-400 text-sm font-semibold uppercase tracking-wider mb-2">Playlist</p>
              <h1 className="text-white text-3xl md:text-5xl font-bold mb-3">{selectedPlaylist?.name}</h1>
              <p className="text-white/80 text-base mb-2">{selectedPlaylist?.description}</p>
              <p className="text-white/60 text-sm">{selectedPlaylist?.songCount} songs • {selectedPlaylist?.duration}</p>
            </div>
          </div>

          {/* Songs List */}
          <div className="songsList flex-1 px-4 md:px-8 py-6 overflow-y-auto">
            <div className="max-w-[1400px] mx-auto">
              <h2 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                Tracks
              </h2>
              <div className="flex flex-col gap-1">
                {selectedPlaylist?.songs?.map((song, index) => (
                  <React.Fragment key={song.id}>
                    {/* Mobile View */}
                    <div className="block md:hidden">
                      <SongTile 
                        song={song} 
                        index={index} 
                        onPlay={() => console.log(`Playing ${song.name} by ${song.artist}`)} 
                      />
                    </div>

                    {/* Desktop View */}
                    <div 
                      className="hidden md:flex songItem items-center gap-4 px-4 py-3 rounded-xl 
                      bg-white/5 hover:bg-white/10 transition-all cursor-pointer group border border-transparent 
                      hover:border-white/10" 
                      onClick={() => { console.log(`Playing ${song.name} by ${song.artist}`); }}
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
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <button 
                          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 
                          transition-all"
                          title="Add to Favorites"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMockSongStates(prev => ({
                              ...prev,
                              [song.id]: {
                                ...prev[song.id],
                                favorite: !prev[song.id]?.favorite
                              }
                            }));
                          }}
                        >
                          <FaStar className={`text-sm ${
                            mockSongStates[song.id]?.favorite ? 'text-yellow-400' : 'text-white/40 group-hover:text-white/60'
                          }`} />
                        </button>
                        
                        <button 
                          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 
                          transition-all"
                          title="Like Song"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMockSongStates(prev => ({
                              ...prev,
                              [song.id]: {
                                ...prev[song.id],
                                liked: !prev[song.id]?.liked
                              }
                            }));
                          }}
                        >
                          <FaHeart className={`text-sm ${
                            mockSongStates[song.id]?.liked ? 'text-red-500' : 'text-white/40 group-hover:text-white/60'
                          }`} />
                        </button>
                        
                        <button 
                          className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-500 
                          hover:bg-emerald-600 transition-all ml-2 shadow-lg hover:shadow-emerald-500/50 
                          transform hover:scale-110"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log(`Playing ${song.name} by ${song.artist}`);
                          }}
                        >
                          <FaPlay className="text-white text-xs ml-0.5" />
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}