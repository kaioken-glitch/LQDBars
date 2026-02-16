import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FaStar, FaHeart, FaSearch, FaPlay, FaPlus, FaMusic, FaTimes, FaFolderOpen } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import TinyPlayer from './TinyPlayer';
import SongTile from './SongTile';
import musicApi from '../utils/musicApi';
import { 
  selectFolderForImport, 
  loadSongsFromFolder,
  getSavedFolders,
  deleteFolder,
  checkLocalFileSupport 
} from '../utils/localstoragehandler';
import { createPlaylistFromFiles } from '../utils/audioloader';

// LocalStorage keys
const STORAGE_KEY = 'music_player_playlists';
const MOCK_STATES_KEY = 'music_player_mock_states';

export default function Playlists() {
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [mockSongStates, setMockSongStates] = useState({});
  const [showInput, setShowInput] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Albums');
  const [showGenres, setShowGenres] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  
  // Local file state
  const [localFolders, setLocalFolders] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [supportCheck, setSupportCheck] = useState(checkLocalFileSupport());
  const [importError, setImportError] = useState('');

  const {
    currentSong,
    isPlaying,
    setIsPlaying,
    playPrev,
    playNext,
    isMuted,
    toggleMute,
    setPlayerSongs,
  } = usePlayer();

  // ---------- Load from localStorage on mount ----------
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUserPlaylists(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored playlists', e);
      }
    }

    const storedStates = localStorage.getItem(MOCK_STATES_KEY);
    if (storedStates) {
      try {
        setMockSongStates(JSON.parse(storedStates));
      } catch (e) {
        console.error('Failed to parse mock states', e);
      }
    }
  }, []);

  // ---------- Save to localStorage whenever playlists change ----------
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userPlaylists));
  }, [userPlaylists]);

  // ---------- Save mock states ----------
  useEffect(() => {
    localStorage.setItem(MOCK_STATES_KEY, JSON.stringify(mockSongStates));
  }, [mockSongStates]);

  // ---------- Load saved folders ----------
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const folders = await getSavedFolders();
        setLocalFolders(folders);
      } catch (error) {
        console.error('Error loading folders:', error);
      }
    };
    loadFolders();
  }, []);

  // ---------- Import local folder ----------
  const handleImportLocalFolder = async () => {
    setImportLoading(true);
    setImportError('');
    try {
      const dirHandle = await selectFolderForImport();
      const songs = await loadSongsFromFolder(dirHandle);
      
      if (songs.length > 0) {
        const newPlaylist = await createPlaylistFromFiles(
          songs, 
          dirHandle.name, 
          `Local songs from ${dirHandle.name}`
        );
        setUserPlaylists(prev => [...prev, newPlaylist]);
        
        const folders = await getSavedFolders();
        setLocalFolders(folders);
      } else {
        setImportError('No audio files found in selected folder');
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportError(error.message || 'Error importing folder');
    } finally {
      setImportLoading(false);
    }
  };

  // ---------- Remove local folder ----------
  const handleRemoveLocalFolder = async (folderName) => {
    try {
      await deleteFolder(folderName);
      setUserPlaylists(prev => prev.filter(p => p.folderName !== folderName));
      
      const folders = await getSavedFolders();
      setLocalFolders(folders);
    } catch (error) {
      console.error('Error removing folder:', error);
      setImportError('Error removing folder');
    }
  };

  // ---------- Create custom playlist ----------
  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      const newPlaylist = {
        id: `custom-${Date.now()}`,
        name: newPlaylistName,
        description: newPlaylistDesc || 'Custom playlist',
        songCount: 0,
        duration: '0 min',
        cover: 'https://placehold.co/300x300?text=Custom+Playlist',
        songs: [],
        isCustom: true
      };
      setUserPlaylists(prev => [...prev, newPlaylist]);
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setShowCreateModal(false);
    }
  };

  // ---------- Remove playlist ----------
  const handleRemovePlaylist = (playlistId) => {
    setUserPlaylists(prev => prev.filter(p => p.id !== playlistId));
  };

  const handlePlaylistPlay = (playlist) => {
    setSelectedPlaylist(playlist);
    setShowDetailView(true);
  };

  const handleBackFromDetail = () => {
    setShowDetailView(false);
    setSelectedPlaylist(null);
  };

  // ---------- Play song from playlist ----------
  const handlePlaySongFromPlaylist = (songIndex) => {
    if (selectedPlaylist?.songs && selectedPlaylist.songs.length > 0) {
      try {
        const validSongs = selectedPlaylist.songs.filter(song => 
          song.audio || song.url || song.audioUrl || song.src
        );
        
        if (validSongs.length === 0) {
          console.error('No valid songs found in playlist');
          return;
        }
      
        let adjustedIndex = songIndex;
        if (validSongs.length < selectedPlaylist.songs.length) {
          const selectedSong = selectedPlaylist.songs[songIndex];
          adjustedIndex = validSongs.findIndex(s => s.id === selectedSong?.id);
          if (adjustedIndex === -1) adjustedIndex = 0;
        }
      
        setPlayerSongs(validSongs, adjustedIndex);
        setTimeout(() => setIsPlaying(true), 100);
      } catch (error) {
        console.error('Error playing song:', error);
      }
    }
  };

  const handlePlayPlaylist = () => {
    if (selectedPlaylist?.songs && selectedPlaylist.songs.length > 0) {
      handlePlaySongFromPlaylist(0);
    }
  };

  const updateMockSongState = (songId, updates) => {
    setMockSongStates(prev => ({
      ...prev,
      [songId]: {
        ...prev[songId],
        ...updates
      }
    }));
  };

  const handleSearch = async (searchQuery) => {
    setQuery(searchQuery);
    if (searchQuery.trim()) {
      try {
        const apiResults = await musicApi.searchTracks(searchQuery, 10);
        setResults(apiResults && apiResults.length > 0 ? apiResults : []);
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
                          key={song.id ? `search-${song.id}` : `search-result-${i}`}
                          className="px-4 py-3 text-white hover:bg-white/10 cursor-pointer text-sm 
                          flex items-center gap-3 transition-all"
                          onClick={() => {
                            setShowInput(false);
                            setQuery(song.name);
                          }}
                        >
                          <img src={song.cover} alt={song.name} className="w-10 h-10 rounded-lg object-cover shadow-md" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{song.name}</p>
                            <p className="text-white/70 text-xs truncate">{song.artist}</p>
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
                            key={`genre-${genre}`}
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

              {/* Page Title with Action Buttons */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-white text-4xl md:text-5xl font-bold tracking-tight">
                    Your Playlists
                  </h1>
                  <p className="text-white/60 text-sm md:text-base mt-2">
                    {userPlaylists.length} {userPlaylists.length === 1 ? 'playlist' : 'playlists'} • 
                    {userPlaylists.reduce((acc, p) => acc + p.songCount, 0)} songs
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 
                    to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-full 
                    font-semibold transition-all shadow-lg hover:shadow-emerald-500/50"
                  >
                    <FaPlus /> Create Playlist
                  </button>
                  {supportCheck.fileSystemAccess && (
                    <button
                      onClick={handleImportLocalFolder}
                      disabled={importLoading}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 
                      to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white rounded-full 
                      font-semibold transition-all shadow-lg hover:shadow-purple-500/50 disabled:opacity-50"
                    >
                      <FaFolderOpen /> {importLoading ? 'Importing...' : 'Import Local'}
                    </button>
                  )}
                </div>
              </div>

              {/* Import Error Message */}
              {importError && (
                <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {importError}
                </div>
              )}
            </div>
          </div>

          {/* Playlists Grid */}
          <div className="w-full max-w-[1600px] px-4 md:px-6 lg:px-8 mt-6 flex-1 overflow-y-auto">
            {userPlaylists.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-center">
                <FaMusic className="text-white/40 text-6xl mb-4" />
                <h3 className="text-white text-2xl font-bold mb-2">No playlists yet</h3>
                <p className="text-white/60 max-w-md mb-6">
                  Create your first playlist or import local music to get started.
                </p>
              </div>
            ) : (
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
                        onError={(e) => { e.target.src = 'https://placehold.co/300x300?text=Playlist'; }}
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

                    {/* Remove Button (for custom/imported playlists) */}
                    {(playlist.isCustom || playlist.isLocal) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (playlist.isLocal) {
                            handleRemoveLocalFolder(playlist.folderName || playlist.name);
                          } else {
                            handleRemovePlaylist(playlist.id);
                          }
                        }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                        w-8 h-8 flex items-center justify-center rounded-full bg-red-500/80 hover:bg-red-600 
                        shadow-lg"
                        title="Delete playlist"
                      >
                        <FaTimes className="text-white text-sm" />
                      </button>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent 
                    opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />
                  </div>
                ))}
              </div>
            )}
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
              onError={(e) => { e.target.src = 'https://placehold.co/300x300?text=Playlist'; }}
            />
            <div className="flex flex-col justify-center">
              <p className="text-emerald-400 text-sm font-semibold uppercase tracking-wider mb-2">Playlist</p>
              <h1 className="text-white text-3xl md:text-5xl font-bold mb-3">{selectedPlaylist?.name}</h1>
              <p className="text-white/80 text-base mb-2">{selectedPlaylist?.description}</p>
              <p className="text-white/60 text-sm">{selectedPlaylist?.songCount} songs • {selectedPlaylist?.duration}</p>
              
              <button 
                className="mt-4 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 
                to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-full 
                font-semibold transition-all shadow-lg hover:shadow-emerald-500/50 w-fit"
                onClick={handlePlayPlaylist}
                disabled={!selectedPlaylist?.songs || selectedPlaylist.songs.length === 0}
              >
                <FaPlay className="text-white" /> Play Playlist
              </button>
            </div>
          </div>

          {/* Songs List */}
          <div className="songsList flex-1 px-4 md:px-8 py-6 overflow-y-auto">
            {selectedPlaylist?.songs && selectedPlaylist.songs.length > 0 ? (
              <div className="max-w-[1400px] mx-auto">
                <h2 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                  Tracks
                </h2>
                <div className="flex flex-col gap-1">
                  {selectedPlaylist.songs.map((song, index) => {
                    const songId = song.id || `song-${index}`;
                    const isFavorite = mockSongStates[songId]?.favorite || false;
                    const isLiked = mockSongStates[songId]?.liked || false;
                    
                    return (
                      <React.Fragment key={songId}>
                        {/* Mobile View */}
                        <div className="block md:hidden">
                          <SongTile 
                            song={song} 
                            index={index} 
                            onPlay={() => handlePlaySongFromPlaylist(index)} 
                          />
                        </div>

                        {/* Desktop View */}
                        <div 
                          className="hidden md:flex songItem items-center gap-4 px-4 py-3 rounded-xl 
                          bg-white/5 hover:bg-white/10 transition-all cursor-pointer group border border-transparent 
                          hover:border-white/10" 
                          onClick={() => handlePlaySongFromPlaylist(index)}
                        >
                          <span className="text-white/40 group-hover:text-white/60 text-sm w-10 text-center font-medium">
                            {index + 1}
                          </span>
                          <img 
                            src={song.cover} 
                            alt={song.name} 
                            className="w-12 h-12 rounded-lg object-cover shadow-md"
                            onError={(e) => { e.target.src = 'https://placehold.co/60x60?text=🎵'; }}
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
                                updateMockSongState(songId, { favorite: !isFavorite });
                              }}
                            >
                              <FaStar className={`text-sm ${isFavorite ? 'text-yellow-400' : 'text-white/40 group-hover:text-white/60'}`} />
                            </button>
                            
                            <button 
                              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 
                              transition-all"
                              title="Like Song"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateMockSongState(songId, { liked: !isLiked });
                              }}
                            >
                              <FaHeart className={`text-sm ${isLiked ? 'text-red-500' : 'text-white/40 group-hover:text-white/60'}`} />
                            </button>
                            
                            <button 
                              className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-500 
                              hover:bg-emerald-600 transition-all ml-2 shadow-lg hover:shadow-emerald-500/50 
                              transform hover:scale-110"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlaySongFromPlaylist(index);
                              }}
                            >
                              <FaPlay className="text-white text-xs ml-0.5" />
                            </button>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-center">
                <FaMusic className="text-white/40 text-5xl mb-3" />
                <h3 className="text-white text-xl font-bold mb-2">No songs yet</h3>
                <p className="text-white/60">Add songs to this playlist to get started</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-2xl 
          max-w-md w-full border border-white/10 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-2xl font-bold">Create Playlist</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPlaylistName('');
                  setNewPlaylistDesc('');
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white text-sm font-semibold block mb-2">Playlist Name *</label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="My Awesome Playlist"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl 
                  text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-400/50
                  focus:bg-white/15 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-white text-sm font-semibold block mb-2">Description</label>
                <textarea
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  placeholder="What's this playlist about?"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl 
                  text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-400/50
                  focus:bg-white/15 transition-all resize-none h-24"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPlaylistName('');
                    setNewPlaylistDesc('');
                  }}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl
                  font-semibold transition-all border border-white/20"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600
                  hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl font-semibold
                  transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 PREMADE PLAYLISTS MODAL REMOVED – no dummy data */}
    </div>
  );
}