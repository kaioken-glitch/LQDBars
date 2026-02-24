import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faChevronDown, faThLarge, faList, faChevronLeft, faEllipsisH } from '@fortawesome/free-solid-svg-icons';
import { FaStar, FaHeart, FaSearch, FaPlay, FaPlus, FaMusic, FaTimes, FaFolderOpen, FaYoutube, FaRandom } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import TinyPlayer from '../components/TinyPlayer';
import SongTile from '../components/SongTile';
import musicApi from '../utils/musicApi';
import { 
  selectFolderForImport, 
  loadSongsFromFolder,
  getSavedFolders,
  deleteFolder,
  checkLocalFileSupport 
} from '../utils/localstoragehandler';
import { createPlaylistFromFiles } from '../utils/audioloader';
import { fetchYouTubePlaylist, fetchVideoDurations } from '../utils/youtubePlaylist';

const STORAGE_KEY = 'music_player_playlists';
const MOCK_STATES_KEY = 'music_player_mock_states';

// Helper to format total seconds into a readable string
const formatTotalDuration = (totalSeconds) => {
  if (!totalSeconds || totalSeconds === 0) return '0 min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  return `${minutes} min`;
};

export default function Playlists() {
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [mockSongStates, setMockSongStates] = useState({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeImportLoading, setYoutubeImportLoading] = useState(false);
  const [youtubeImportError, setYoutubeImportError] = useState('');

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

  // Load from localStorage
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userPlaylists));
  }, [userPlaylists]);

  useEffect(() => {
    localStorage.setItem(MOCK_STATES_KEY, JSON.stringify(mockSongStates));
  }, [mockSongStates]);

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

  const handleImportYouTube = async () => {
    if (!youtubeUrl.trim()) {
      setYoutubeImportError('Please enter a YouTube playlist URL');
      return;
    }
    const playlistId = extractYouTubePlaylistId(youtubeUrl);
    if (!playlistId) {
      setYoutubeImportError('Invalid YouTube playlist URL');
      return;
    }
    setYoutubeImportLoading(true);
    setYoutubeImportError('');
    try {
      const videos = await fetchYouTubePlaylist(playlistId);
      if (videos.length === 0) {
        setYoutubeImportError('No videos found in playlist');
        return;
      }
      const videoIds = videos.map(v => v.id);
      const durations = await fetchVideoDurations(videoIds);
      let totalSeconds = 0;
      const songs = videos.map(v => {
        const duration = durations[v.id] || 0;
        totalSeconds += duration;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        return {
          id: v.id,
          name: v.title,
          artist: v.channel,
          duration: formattedDuration,
          cover: v.thumbnail,
          audio: null,
          youtubeId: v.id,
          source: 'youtube',
        };
      });
      const newPlaylist = {
        id: `youtube-${Date.now()}`,
        name: `YouTube Playlist (${new Date().toLocaleDateString()})`,
        description: `Imported from YouTube • ${videos.length} videos`,
        cover: videos[0]?.thumbnail || '/default-cover.png',
        songs: songs,
        songCount: videos.length,
        duration: formatTotalDuration(totalSeconds),
        isCustom: true,
        isYouTube: true,
      };
      setUserPlaylists(prev => [...prev, newPlaylist]);
      setShowYouTubeModal(false);
      setYoutubeUrl('');
    } catch (error) {
      console.error('YouTube import error:', error);
      setYoutubeImportError(error.message || 'Failed to import playlist');
    } finally {
      setYoutubeImportLoading(false);
    }
  };

  const extractYouTubePlaylistId = (url) => {
    const patterns = [
      /[?&]list=([^&]+)/,
      /youtube\.com\/playlist\?list=([^&]+)/,
      /youtu\.be\/.*[?&]list=([^&]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

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

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      const newPlaylist = {
        id: `custom-${Date.now()}`,
        name: newPlaylistName,
        description: newPlaylistDesc || 'Custom playlist',
        songCount: 0,
        duration: '0 min',
        cover: '/default-cover.png',
        songs: [],
        isCustom: true
      };
      setUserPlaylists(prev => [...prev, newPlaylist]);
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setShowCreateModal(false);
    }
  };

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

  const handlePlaySongFromPlaylist = (songIndex) => {
    if (selectedPlaylist?.songs && selectedPlaylist.songs.length > 0) {
      try {
        const validSongs = selectedPlaylist.songs.filter(song => 
          song.audio || song.url || song.audioUrl || song.src || song.youtubeId
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
          {/* Header Section (unchanged) */}
          <div className="head w-full max-w-[1600px] px-4 md:px-6 lg:px-8 pt-6 pb-4">
            {/* ... (header content – same as before) ... */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="relative flex items-center w-full md:w-80">
                  <FaSearch className="absolute left-4 text-white/50 text-sm" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Search playlists..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 text-white 
                    outline-none rounded-full font-medium text-sm backdrop-blur-xl 
                    placeholder:text-white/50 focus:bg-white/15 focus:border-emerald-400/50 transition-all"
                  />
                  {query && results.length > 0 && (
                    <div className="absolute left-0 top-12 w-full bg-gradient-to-b from-emerald-600 
                    to-emerald-700 rounded-2xl shadow-2xl z-50 overflow-hidden border border-white/10 backdrop-blur-xl">
                      {results.slice(0, 5).map((song, i) => (
                        <div
                          key={song.id || i}
                          className="px-4 py-3 text-white hover:bg-white/10 cursor-pointer text-sm 
                          flex items-center gap-3 transition-all"
                          onClick={() => setQuery(song.name)}
                        >
                          <img src={song.cover} alt={song.name} className="w-8 h-8 rounded object-cover" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{song.name}</p>
                            <p className="text-white/70 text-xs truncate">{song.artist}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-white text-4xl md:text-5xl font-bold tracking-tight">Your Playlists</h1>
                  <p className="text-white/60 text-sm md:text-base mt-2">
                    {userPlaylists.length} {userPlaylists.length === 1 ? 'playlist' : 'playlists'} • 
                    {userPlaylists.reduce((acc, p) => acc + p.songCount, 0)} songs
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-white/10 backdrop-blur-xl rounded-full p-1 border border-white/20">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                        viewMode === 'grid' 
                          ? 'bg-emerald-500 text-white shadow-lg' 
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                      title="Grid view"
                    >
                      <FontAwesomeIcon icon={faThLarge} className="text-sm" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                        viewMode === 'list' 
                          ? 'bg-emerald-500 text-white shadow-lg' 
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                      title="List view"
                    >
                      <FontAwesomeIcon icon={faList} className="text-sm" />
                    </button>
                  </div>

                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 
                    to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-full 
                    font-semibold transition-all shadow-lg hover:shadow-emerald-500/50"
                  >
                    <FaPlus /> Create
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowImportDropdown(!showImportDropdown)}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 
                      to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white rounded-full 
                      font-semibold transition-all shadow-lg hover:shadow-purple-500/50"
                    >
                      <FaFolderOpen /> Import
                      <FontAwesomeIcon icon={faChevronDown} className="text-sm" />
                    </button>

                    {showImportDropdown && (
                      <div className="absolute right-0 mt-2 w-56 bg-gradient-to-b from-purple-600 
                      to-purple-700 rounded-2xl shadow-2xl z-50 backdrop-blur-xl border border-white/10 
                      overflow-hidden">
                        <button
                          onClick={() => {
                            setShowImportDropdown(false);
                            handleImportLocalFolder();
                          }}
                          disabled={importLoading}
                          className="w-full px-4 py-3 text-left text-white hover:bg-white/20 
                          transition-all flex items-center gap-3"
                        >
                          <FaFolderOpen className="text-purple-200" />
                          <span className="flex-1">Local Folder</span>
                          {importLoading && <span className="text-xs animate-pulse">...</span>}
                        </button>
                        <button
                          onClick={() => {
                            setShowImportDropdown(false);
                            setShowYouTubeModal(true);
                          }}
                          className="w-full px-4 py-3 text-left text-white hover:bg-white/20 
                          transition-all flex items-center gap-3"
                        >
                          <FaYoutube className="text-red-300" />
                          <span className="flex-1">YouTube Playlist</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {importError && (
                <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {importError}
                </div>
              )}
            </div>
          </div>

          {/* Playlists Grid/List (unchanged) */}
          <div className="w-full max-w-[1600px] px-4 md:px-6 lg:px-8 mt-6 flex-1 overflow-y-auto">
            {userPlaylists.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-center">
                <FaMusic className="text-white/40 text-6xl mb-4" />
                <h3 className="text-white text-2xl font-bold mb-2">No playlists yet</h3>
                <p className="text-white/60 max-w-md mb-6">
                  Create your first playlist or import local music to get started.
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 pb-8">
                {userPlaylists.map((playlist) => (
                  <div 
                    key={playlist.id} 
                    className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl 
                    rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer 
                    border border-white/10 hover:border-emerald-400/30 hover:scale-[1.02] overflow-hidden"
                  >
                    <div className="aspect-square bg-gradient-to-br from-purple-500/40 to-indigo-600/40 
                    rounded-t-2xl flex items-center justify-center overflow-hidden relative">
                      <img 
                        src={playlist.cover} 
                        alt={playlist.name} 
                        className="w-full h-full object-cover" 
                        onError={(e) => { e.target.src = '/default-cover.png'; }}
                      />
                      {playlist.isYouTube && (
                        <div className="absolute top-2 left-2 bg-red-600/80 rounded-full p-1">
                          <FaYoutube className="text-white text-xs" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-white font-bold text-base mb-1 truncate">{playlist.name}</h3>
                      <p className="text-white/60 text-xs mb-1 truncate">{playlist.description}</p>
                      <p className="text-white/50 text-xs mb-3">
                        {playlist.songCount} songs • {playlist.duration}
                      </p>
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
                    {(playlist.isCustom || playlist.isLocal || playlist.isYouTube) && (
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent 
                    opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2 pb-8">
                {userPlaylists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="group relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 
                    hover:border-emerald-400/30 transition-all duration-300 cursor-pointer overflow-hidden"
                    onClick={() => handlePlaylistPlay(playlist)}
                  >
                    <div className="flex items-center p-4 gap-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-500/40 to-indigo-600/40">
                        <img 
                          src={playlist.cover} 
                          alt={playlist.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => { e.target.src = '/default-cover.png'; }}
                        />
                        {playlist.isYouTube && (
                          <div className="absolute top-2 left-2 bg-red-600/80 rounded-full p-1">
                            <FaYoutube className="text-white text-xs" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-lg truncate">{playlist.name}</h3>
                        <p className="text-white/60 text-sm truncate">{playlist.description}</p>
                        <p className="text-white/50 text-xs mt-1">
                          {playlist.songCount} songs • {playlist.duration}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r 
                          from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
                          transition-all shadow-lg hover:shadow-emerald-500/50 transform hover:scale-110"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaylistPlay(playlist);
                          }}
                        >
                          <FaPlay className="text-white text-sm ml-0.5" />
                        </button>
                        {(playlist.isCustom || playlist.isLocal || playlist.isYouTube) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (playlist.isLocal) {
                                handleRemoveLocalFolder(playlist.folderName || playlist.name);
                              } else {
                                handleRemovePlaylist(playlist.id);
                              }
                            }}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/80 
                            hover:bg-red-600 transition-all shadow-lg opacity-70 hover:opacity-100"
                            title="Delete playlist"
                          >
                            <FaTimes className="text-white text-sm" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Detail View - Playlist Songs List (Redesigned to match HomeOnline) */
        <div className="detailView w-full h-full flex flex-col overflow-hidden">
          {/* Full-screen gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/90 via-slate-900 to-black" />
          
          {/* Sticky Glass Header */}
          <div className="sticky top-0 z-20 w-full px-4 md:px-6 py-3 backdrop-blur-2xl bg-black/30 border-b border-white/10">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBackFromDetail}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 
                backdrop-blur-xl hover:bg-white/20 transition-all border border-white/20 
                hover:border-white/30 shadow-lg hover:scale-105 active:scale-95"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="text-white text-base" />
              </button>
              <div className="flex items-center gap-2">
                <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-xl hover:bg-white/20 transition-all">
                  <FaHeart className="text-white/80 hover:text-red-500 text-base" />
                </button>
                <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-xl hover:bg-white/20 transition-all">
                  <FontAwesomeIcon icon={faEllipsisH} className="text-white/80 text-base" />
                </button>
              </div>
            </div>
          </div>

          {/* Hero Section */}
          <div className="relative z-10 px-4 md:px-6 py-6 md:py-8 flex flex-col md:flex-row items-start md:items-end gap-6">
            <div className="relative group flex-shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition" />
              <div className="relative">
                <img
                  src={selectedPlaylist?.cover || '/default-cover.png'}
                  alt={selectedPlaylist?.name}
                  className="w-36 h-36 md:w-48 md:h-48 rounded-2xl object-cover shadow-2xl border-2 border-white/20 backdrop-blur-sm"
                  onError={(e) => e.target.src = '/default-cover.png'}
                />
                {selectedPlaylist?.isYouTube && (
                  <div className="absolute -top-2 -right-2 bg-red-600/90 backdrop-blur-sm rounded-full p-1.5 shadow-xl">
                    <FaYoutube className="text-white text-xs" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <span className="w-1 h-3 bg-emerald-500 rounded-full" />
                <span>{selectedPlaylist?.isYouTube ? 'YOUTUBE PLAYLIST' : 'YOUR PLAYLIST'}</span>
              </div>
              
              <h1 className="text-white text-4xl md:text-6xl font-black tracking-tight leading-tight break-words">
                {selectedPlaylist?.name}
              </h1>
              
              <p className="text-white/70 text-base md:text-lg max-w-2xl">
                {selectedPlaylist?.description}
              </p>
              
              <div className="flex items-center gap-4 text-sm text-white/60">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  {selectedPlaylist?.songCount} songs
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                    <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                  {selectedPlaylist?.duration}
                </span>
              </div>

              {/* Icon-only action buttons */}
              <div className="flex items-center gap-4 pt-3">
                <button
                  onClick={handlePlayPlaylist}
                  className="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-r 
                  from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
                  text-white shadow-xl hover:shadow-emerald-500/50 transform hover:scale-105 transition-all"
                  aria-label="Play all songs"
                >
                  <FaPlay className="text-white text-xl ml-1" />
                </button>
                <button 
                  className="w-30 h-10 flex items-center pl-4 justify-start rounded-full bg-white/10 
                  backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all 
                  text-white/80 hover:text-white gap-3"
                  aria-label="Shuffle"
                >
                  <FaRandom className="text-sm" />
                  Shuffle
                </button>
              </div>
            </div>
          </div>

          {/* Tracklist */}
          <div className="relative z-10 flex-1 px-4 md:px-6 py-4 overflow-y-auto">
            <div className="w-full max-w-5xl mx-auto">
              <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-3 px-2">
                TRACKS · {selectedPlaylist?.songs?.length || 0}
              </h2>
              
              <div className="flex flex-col gap-1">
                {selectedPlaylist?.songs?.map((song, index) => {
                  const songId = song.id || `song-${index}`;
                  const isFavorite = mockSongStates[songId]?.favorite || false;
                  const isLiked = mockSongStates[songId]?.liked || false;

                  return (
                    <div
                      key={songId}
                      className="group flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 
                      hover:bg-white/10 transition-all cursor-pointer border border-transparent 
                      hover:border-white/10 backdrop-blur-sm"
                      onClick={() => handlePlaySongFromPlaylist(index)}
                    >
                      <span className="text-white/40 group-hover:text-white/60 text-xs w-6 text-center font-mono">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      
                      <div className="relative w-9 h-9 rounded-md overflow-hidden shadow-md flex-shrink-0">
                        <img src={song.cover} alt={song.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate group-hover:text-emerald-400 transition-colors">
                          {song.name}
                        </p>
                        <p className="text-white/50 text-xs truncate">{song.artist}</p>
                      </div>

                      <span className="text-white/40 text-xs font-mono hidden md:block">
                        {song.duration}
                      </span>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMockSongState(songId, { favorite: !isFavorite });
                          }}
                        >
                          <FaStar className={`text-xs ${isFavorite ? 'text-yellow-400' : 'text-white/40'}`} />
                        </button>
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMockSongState(songId, { liked: !isLiked });
                          }}
                        >
                          <FaHeart className={`text-xs ${isLiked ? 'text-red-500' : 'text-white/40'}`} />
                        </button>
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-500/80 
                          hover:bg-emerald-500 transition-all shadow-md"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaySongFromPlaylist(index);
                          }}
                        >
                          <FaPlay className="text-white text-[10px] ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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

      {/* YouTube Import Modal */}
      {showYouTubeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-2xl 
          max-w-md w-full border border-white/10 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-2xl font-bold flex items-center gap-2">
                <FaYoutube className="text-red-500" /> Import YouTube Playlist
              </h2>
              <button
                onClick={() => {
                  setShowYouTubeModal(false);
                  setYoutubeUrl('');
                  setYoutubeImportError('');
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white text-sm font-semibold block mb-2">
                  YouTube Playlist URL
                </label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/playlist?list=..."
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl 
                  text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-400/50
                  focus:bg-white/15 transition-all"
                  autoFocus
                />
                {youtubeImportError && (
                  <p className="mt-2 text-red-400 text-sm">{youtubeImportError}</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowYouTubeModal(false);
                    setYoutubeUrl('');
                    setYoutubeImportError('');
                  }}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl
                  font-semibold transition-all border border-white/20"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportYouTube}
                  disabled={youtubeImportLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600
                  hover:from-red-400 hover:to-red-500 text-white rounded-xl font-semibold
                  transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg
                  flex items-center justify-center gap-2"
                >
                  {youtubeImportLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <FaYoutube /> Import
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}