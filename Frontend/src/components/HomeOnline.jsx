import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaSearch, FaStar, FaHeart } from 'react-icons/fa';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleArrowDown } from '@fortawesome/free-solid-svg-icons';
import { fetchSongs, patchSong as apiPatchSong } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import SongTile from './SongTile';
import youtubeConverter from '../utils/youtubeConverter';

export default function HomeOnline() {
  // Search state
  const [showInput, setShowInput] = useState(false);
  const [query, setQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [results, setResults] = useState([]);
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);

  // UI state
  const [showGenres, setShowGenres] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [activeFilter, setActiveFilter] = useState('Albums');
  const [showVolume, setShowVolume] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [mockSongStates, setMockSongStates] = useState({});

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Playback state
  const [shuffle, setShuffle] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState([]);
  const [repeatMode, setRepeatMode] = useState('off');

  // Get context from PlayerContext
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
    downloadedSongs
  } = usePlayer();

  // Mock data with useMemo for performance
  const playlists = useMemo(() => [
    {
      id: 'trending-hip-hop',
      name: 'Trending Hip-Hop',
      description: '50 trending tracks',
      cover: 'https://placehold.co/300x200/FF6B6B/FFFFFF?text=Hip-Hop',
      songs: [],
      type: 'trending'
    },
    {
      id: 'indie-discoveries',
      name: 'Indie Discoveries',
      description: '30 fresh finds',
      cover: 'https://placehold.co/300x200/4ECDC4/FFFFFF?text=Indie',
      songs: [],
      type: 'discovery'
    },
    {
      id: 'chill-vibes',
      name: 'Chill Vibes',
      description: '40 relaxing songs',
      cover: 'https://placehold.co/300x200/45B7D1/FFFFFF?text=Chill',
      songs: [],
      type: 'mood'
    }
  ], []);

  const albums = useMemo(() => [
    {
      id: 'album-damn',
      name: 'DAMN.',
      artist: 'Kendrick Lamar',
      cover: 'https://placehold.co/300x200/000000/FFFFFF?text=DAMN',
      songs: [],
      type: 'album'
    },
    {
      id: 'album-blonde',
      name: 'Blonde',
      artist: 'Frank Ocean',
      cover: 'https://placehold.co/300x200/FFA500/FFFFFF?text=Blonde',
      songs: [],
      type: 'album'
    },
    {
      id: 'album-after-hours',
      name: 'After Hours',
      artist: 'The Weeknd',
      cover: 'https://placehold.co/300x200/800080/FFFFFF?text=After+Hours',
      songs: [],
      type: 'album'
    }
  ], []);

  const suggestions = useMemo(() => [
    {
      id: 'suggestion-blinding-lights',
      name: 'Blinding Lights',
      artist: 'The Weeknd',
      cover: 'https://placehold.co/300x200/FF0000/FFFFFF?text=Blinding',
      type: 'trending'
    },
    {
      id: 'suggestion-good-4-u',
      name: 'good 4 u',
      artist: 'Olivia Rodrigo',
      cover: 'https://placehold.co/300x200/9370DB/FFFFFF?text=good+4+u',
      type: 'popular'
    },
    {
      id: 'suggestion-stay',
      name: 'Stay',
      artist: 'The Kid LAROI',
      cover: 'https://placehold.co/300x200/32CD32/FFFFFF?text=Stay',
      type: 'trending'
    }
  ], []);

  const newReleases = useMemo(() => [
    {
      id: 'new-unholy',
      name: 'Unholy',
      artist: 'Sam Smith',
      cover: 'https://placehold.co/300x200/000000/FFFFFF?text=Unholy',
      type: 'new-release'
    },
    {
      id: 'new-anti-hero',
      name: 'Anti-Hero',
      artist: 'Taylor Swift',
      cover: 'https://placehold.co/300x200/4B0082/FFFFFF?text=Anti-Hero',
      type: 'new-release'
    }
  ], []);

  // Effects and handlers remain the same...
  useEffect(() => {
    if (volume === 1) setVolume(0.2);
  }, []);

  useEffect(() => {
    if (shuffle && songs.length > 1) {
      const indices = songs.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const currentIdx = indices.indexOf(currentIndex);
      if (currentIdx > 0) {
        [indices[0], indices[currentIdx]] = [indices[currentIdx], indices[0]];
      }
      setShuffledOrder(indices);
    } else {
      setShuffledOrder([]);
    }
  }, [shuffle, songs.length, currentIndex]);

  useEffect(() => {
    if (songs.length === 0) {
      setLoading(true);
      setError(null);
      fetchSongs()
        .then(data => {
          const allSongs = Array.isArray(data) ? data : (data.songs || []);
          if (songs.length === 0) setPlayerSongs(allSongs);
          setLoading(false);
        })
        .catch(() => {
          if (songs.length === 0) setPlayerSongs(downloadedSongs);
          setError('Could not load songs. Showing downloads only.');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const patchSong = useCallback(async (id, patch) => {
    try {
      await apiPatchSong(id, patch);
      setPlayerSongs(prevSongs => 
        prevSongs.map(s => s.id === id ? { ...s, ...patch } : s)
      );
      if (selectedItem?.type === 'downloaded') {
        setSelectedItem(prev => ({
          ...prev,
          songs: prev.songs.map(s => s.id === id ? { ...s, ...patch } : s)
        }));
      }
    } catch (e) {
      console.error('patchSong error:', e);
    }
  }, [selectedItem?.type, setPlayerSongs]);

  const handleSearch = useCallback(async (val) => {
    if (val.trim() === '') {
      setResults([]);
      setYoutubeResults([]);
      return;
    }
    const q = val.toLowerCase();
    const filtered = songs.filter(song =>
      song.name?.toLowerCase().includes(q) ||
      song.artist?.toLowerCase().includes(q) ||
      song.album?.toLowerCase().includes(q)
    );
    setResults(filtered);
    setIsSearchingYoutube(true);
    try {
      const ytResults = await youtubeConverter.searchVideos(val, 10);
      setYoutubeResults(ytResults);
    } catch (error) {
      console.error('YouTube search error:', error);
      setYoutubeResults([]);
    }
    setIsSearchingYoutube(false);
  }, [songs]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (searchDebounced) handleSearch(searchDebounced);
  }, [searchDebounced, handleSearch]);

  const formatTime = useCallback((sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const playYoutubeVideo = useCallback(async (video) => {
    try {
      const audioUrl = await youtubeConverter.getAudioStream(video.id);
      const youtubeSong = {
        id: `yt_${video.id}`,
        name: video.title,
        artist: video.channel,
        duration: '0:00',
        cover: video.thumbnail,
        audio: audioUrl,
        youtube: true,
        youtubeId: video.id
      };
      setPlayerSongs([youtubeSong]);
      setCurrentIndex(0);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing YouTube video:', error);
      alert('Failed to convert YouTube video.');
    }
  }, [setPlayerSongs, setCurrentIndex, setIsPlaying]);

  const handleCardPlay = useCallback((type) => {
    let item;
    if (type === 'downloaded') {
      item = {
        type: 'downloaded',
        index: 0,
        name: 'Downloaded Songs',
        cover: songs[0]?.cover || 'https://placehold.co/300x300?text=Downloaded',
        songCount: songs.length,
        duration: `${Math.floor(songs.length * 3.5)} min`,
        songs: songs
      };
    }
    setSelectedItem(item);
    setShowDetailView(true);
  }, [songs]);

  const handleBackFromDetail = useCallback(() => {
    setShowDetailView(false);
    setSelectedItem(null);
  }, []);

  const playStreamingSong = useCallback(async (song) => {
    try {
      const videos = await youtubeConverter.searchVideos(`${song.name} ${song.artist}`, 1);
      if (videos.length > 0) await playYoutubeVideo(videos[0]);
    } catch (error) {
      console.error('Error playing streaming song:', error);
    }
  }, [playYoutubeVideo]);

  const playOnlineItem = useCallback(async (item) => {
    try {
      let searchQuery;
      if (item.type === 'trending') searchQuery = 'trending hip hop 2024';
      else if (item.type === 'discovery') searchQuery = 'indie discoveries new music';
      else if (item.type === 'mood') searchQuery = 'chill vibes relaxing music';
      else if (item.type === 'album') searchQuery = `${item.artist} ${item.name} full album`;
      else searchQuery = item.name;
      const results = await youtubeConverter.searchVideos(searchQuery);
      if (results.length > 0) await playYoutubeVideo(results[0]);
    } catch (error) {
      console.error('Error playing online item:', error);
    }
  }, [playYoutubeVideo]);

  const renderCard = useCallback((item, itemType, onPlay) => (
    <div 
      key={item.id} 
      className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl 
      rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer 
      border border-white/10 hover:border-emerald-400/30 hover:scale-[1.02] overflow-hidden"
    >
      <div className="relative aspect-[3/2] bg-gradient-to-br from-emerald-500/40 to-teal-600/40">
        <img 
          src={item.cover} 
          alt={item.name} 
          className="w-full h-full object-cover" 
        />
        {itemType === 'newrelease' && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white 
          text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">NEW</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent 
        opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="p-4">
        <h3 className="text-white font-bold text-sm mb-1 truncate">{item.name}</h3>
        <p className="text-white/60 text-xs truncate mb-3">{item.artist || item.description}</p>
        <button 
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r 
          from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
          transition-all shadow-lg hover:shadow-emerald-500/50 ml-auto transform hover:scale-110"
          onClick={onPlay}
        >
          <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="8,5 19,12 8,19" />
          </svg>
        </button>
      </div>
    </div>
  ), []);

  return (
    <div className="homeOnline w-full h-full flex flex-col pb-20">
      {loading && songs.length === 0 && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full 
            animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg font-medium">Loading music...</p>
          </div>
        </div>
      )}
      
      {!showDetailView ? (
        <>
          {/* Header */}
          <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 pt-6 pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex items-center w-full md:w-auto">
                  <button
                    className="flex items-center justify-center border border-white/20 bg-white/10 
                    backdrop-blur-xl w-[40px] h-[40px] rounded-full hover:bg-white/20 transition-all 
                    shadow-lg hover:shadow-emerald-500/20"
                    onClick={() => setShowInput(v => !v)}
                  >
                    <FaSearch className="text-white text-base" />
                  </button>
                  <input
                    type="text"
                    className={`ml-3 px-4 py-2.5 bg-white/10 border border-white/20 text-white 
                    outline-none rounded-full font-medium text-sm transition-all duration-300
                    backdrop-blur-xl placeholder:text-white/50 focus:bg-white/15 focus:border-emerald-400/50
                    ${showInput ? 'max-w-[280px] opacity-100 w-[280px] scale-x-100' : 'max-w-0 opacity-0 w-0 scale-x-0 pointer-events-none'}`}
                    autoFocus={showInput}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search music..."
                  />
                  
                  {showInput && (results.length > 0 || youtubeResults.length > 0 || isSearchingYoutube) && (
                    <div className="absolute left-0 top-14 w-full max-w-[380px] bg-gradient-to-b from-emerald-600/95 
                    to-emerald-700/95 backdrop-blur-xl rounded-2xl shadow-2xl z-50 border border-white/10 
                    max-h-[500px] overflow-y-auto">
                      {results.length > 0 && (
                        <>
                          <div className="px-4 py-2 bg-emerald-800/50 text-xs font-bold text-white sticky top-0">
                            Local Songs
                          </div>
                          {results.map((song, i) => (
                            <div
                              key={song.id || i}
                              className="px-4 py-3 hover:bg-white/10 cursor-pointer flex items-center gap-3"
                              onClick={() => {
                                setShowInput(false);
                                const idx = songs.findIndex(s => s.id === song.id);
                                if (idx !== -1) {
                                  setCurrentIndex(idx);
                                  setIsPlaying(true);
                                }
                              }}
                            >
                              <img src={song.cover} alt={song.name} className="w-12 h-12 rounded-lg object-cover" />
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-sm font-semibold truncate">{song.name}</div>
                                <div className="text-white/70 text-xs truncate">{song.artist}</div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      
                      {isSearchingYoutube && (
                        <div className="px-4 py-4 text-center text-white/70 text-sm">
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2"></div>
                          Searching YouTube...
                        </div>
                      )}
                      
                      {youtubeResults.length > 0 && (
                        <>
                          <div className="px-4 py-2 bg-red-600/80 text-xs font-bold text-white flex items-center gap-2 sticky top-0">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                            YouTube
                          </div>
                          {youtubeResults.map(video => (
                            <div
                              key={`yt_${video.id}`}
                              className="px-4 py-3 hover:bg-red-500/20 cursor-pointer flex items-center gap-3"
                              onClick={() => {
                                setShowInput(false);
                                playYoutubeVideo(video);
                              }}
                            >
                              <img src={video.thumbnail} alt={video.title} className="w-16 h-12 rounded-lg object-cover" />
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-sm font-semibold truncate">{video.title}</div>
                                <div className="text-white/70 text-xs truncate">{video.channel}</div>
                              </div>
                              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                                <polygon points="8,5 19,12 8,19" />
                              </svg>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="relative flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-1.5 
                border border-white/20 backdrop-blur-xl shadow-lg w-full md:w-auto ml-auto">
                  <div
                    className="absolute top-1.5 h-[34px] rounded-full bg-gradient-to-r from-emerald-500 
                    to-emerald-600 shadow-lg transition-all duration-300"
                    style={{
                      width: '90px',
                      transform: activeFilter === 'Albums' ? 'translateX(6px)' : 'translateX(102px)',
                    }}
                  />
                  <button
                    className={`relative py-2 px-6 rounded-full text-sm font-medium transition-all z-10 
                    ${activeFilter === 'Albums' ? 'text-white' : 'text-white/70 hover:text-white'}`}
                    onClick={() => setActiveFilter('Albums')}
                  >
                    Albums
                  </button>
                  <button
                    className={`relative py-2 px-6 rounded-full text-sm font-medium transition-all z-10 
                    ${activeFilter === 'Songs' ? 'text-white' : 'text-white/70 hover:text-white'}`}
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
                        {['Pop','Rock','Hip-Hop','Jazz','Electronic','Classical'].map(genre => (
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

              <div className="mt-4">
                <h1 className="text-white text-4xl md:text-5xl font-bold tracking-tight">Discover</h1>
                <p className="text-white/60 text-sm md:text-base mt-2">Stream millions of songs • Explore new music</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 mt-6 flex-1 overflow-y-auto">
            
            {/* Suggestions */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-2xl font-bold flex items-center gap-2">
                  <span className="w-1 h-7 bg-emerald-500 rounded-full"></span>
                  Music Suggestions
                </h2>
                <span className="text-emerald-400 text-sm font-medium">Streaming</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {suggestions.map(song => renderCard(song, 'suggestion', () => playStreamingSong(song)))}
              </div>
            </section>

            {/* Playlists */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-2xl font-bold flex items-center gap-2">
                  <span className="w-1 h-7 bg-emerald-500 rounded-full"></span>
                  Playlists
                </h2>
                <span className="text-emerald-400 text-sm font-medium">Streaming</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {playlists.map(playlist => renderCard(playlist, 'playlist', () => playOnlineItem(playlist)))}
              </div>
            </section>

            {/* Albums */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-2xl font-bold flex items-center gap-2">
                  <span className="w-1 h-7 bg-emerald-500 rounded-full"></span>
                  Albums
                </h2>
                <span className="text-emerald-400 text-sm font-medium">Streaming</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {albums.map(album => renderCard(album, 'album', () => playOnlineItem(album)))}
              </div>
            </section>

            {/* New Releases */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-2xl font-bold flex items-center gap-2">
                  <span className="w-1 h-7 bg-emerald-500 rounded-full"></span>
                  New Releases
                </h2>
                <span className="text-emerald-400 text-sm font-medium">Streaming</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {newReleases.map(song => renderCard(song, 'newrelease', () => playStreamingSong(song)))}
              </div>
            </section>

            {/* Downloaded */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-2xl font-bold flex items-center gap-2">
                  <span className="w-1 h-7 bg-emerald-500 rounded-full"></span>
                  Downloaded Songs
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {songs.length > 0 ? (
                  <div 
                    className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl 
                    rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer 
                    border border-white/10 hover:border-emerald-400/30 hover:scale-[1.02] overflow-hidden"
                    onClick={() => handleCardPlay('downloaded')}
                  >
                    <div className="relative aspect-[3/2] bg-gradient-to-br from-emerald-500/40 to-teal-600/40 
                    grid grid-cols-2 gap-0.5 p-0.5">
                      <img src={songs[0]?.cover || 'https://placehold.co/100x75?text=1'} alt="1" className="w-full h-full object-cover" />
                      <img src={songs[1]?.cover || 'https://placehold.co/100x75?text=2'} alt="2" className="w-full h-full object-cover" />
                      <img src={songs[2]?.cover || songs[0]?.cover || 'https://placehold.co/200x75?text=3'} alt="3" 
                      className="w-full h-full object-cover col-span-2" />
                      <div className="absolute top-2 right-2 bg-emerald-500/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg">
                        <FontAwesomeIcon icon={faCircleArrowDown} className="text-white text-sm" />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent 
                      opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-4">
                      <h3 className="text-white font-bold text-sm mb-1">Downloaded</h3>
                      <p className="text-white/60 text-xs mb-3">{songs.length} songs</p>
                      <button 
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r 
                        from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
                        transition-all shadow-lg hover:shadow-emerald-500/50 ml-auto transform hover:scale-110"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardPlay('downloaded');
                        }}
                      >
                        <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <polygon points="8,5 19,12 8,19" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative bg-gradient-to-br from-white/5 backdrop-blur-xl rounded-2xl shadow-xl 
                  border border-white/10 p-6 flex flex-col items-center justify-center min-h-[280px]">
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                      <FontAwesomeIcon icon={faCircleArrowDown} className="text-white/40 text-2xl" />
                    </div>
                    <p className="text-white/60 text-sm text-center mb-1">No downloaded songs</p>
                    <p className="text-white/40 text-xs text-center">Download songs to access offline</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="detailView w-full h-full flex flex-col">
          <div className="w-full p-4 md:p-6 border-b border-white/10 backdrop-blur-xl bg-black/40">
            <button 
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 
              backdrop-blur-xl hover:bg-white/20 transition-all border border-white/20 shadow-lg"
              onClick={handleBackFromDetail}
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className="w-full px-4 md:px-8 py-6 flex flex-col md:flex-row items-start md:items-center gap-6 
          border-b border-white/10 bg-gradient-to-b from-black/60 to-transparent">
            {selectedItem?.type === 'downloaded' && (
              <div className="w-48 h-48 md:w-56 md:h-56 rounded-3xl shadow-2xl overflow-hidden relative 
              bg-emerald-600/40 border-4 border-white/10 grid grid-cols-2 gap-0.5">
                <img src={selectedItem?.songs?.[0]?.cover || 'https://placehold.co/150x150?text=1'} alt="1" className="w-full h-full object-cover" />
                <img src={selectedItem?.songs?.[1]?.cover || 'https://placehold.co/150x150?text=2'} alt="2" className="w-full h-full object-cover" />
                <img src={selectedItem?.songs?.[2]?.cover || 'https://placehold.co/300x150?text=3'} alt="3" 
                className="w-full h-full object-cover col-span-2" />
                <div className="absolute top-3 right-3 bg-emerald-500/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
                  <FontAwesomeIcon icon={faCircleArrowDown} className="text-white text-base" />
                </div>
              </div>
            )}
            <div className="flex flex-col justify-center">
              <p className="text-emerald-400 text-sm font-semibold uppercase tracking-wider mb-2">Downloaded</p>
              <h1 className="text-white text-3xl md:text-5xl font-bold mb-3">{selectedItem?.name}</h1>
              <p className="text-white/80 text-lg mb-2">{selectedItem?.songCount} songs</p>
              <p className="text-white/60 text-sm">{selectedItem?.duration}</p>
            </div>
          </div>

          <div className="flex-1 px-4 md:px-8 py-6 overflow-y-auto">
            <div className="max-w-[1400px] mx-auto">
              <h2 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                Tracks
              </h2>
              <div className="flex flex-col gap-1">
                {selectedItem?.songs?.map((song, index) => (
                  <div key={song.id}>
                    <div className="block md:hidden">
                      <SongTile
                        song={song}
                        index={index}
                        onPlay={() => {
                          const idx = songs.findIndex(s => s.id === song.id);
                          if (idx !== -1) {
                            setCurrentIndex(idx);
                            setIsPlaying(true);
                          }
                        }}
                      />
                    </div>

                    <div 
                      className="hidden md:flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 
                      hover:bg-white/10 transition-all cursor-pointer group border border-transparent 
                      hover:border-white/10" 
                      onClick={() => {
                        const idx = songs.findIndex(s => s.id === song.id);
                        if (idx !== -1) {
                          setCurrentIndex(idx);
                          setIsPlaying(true);
                        }
                      }}
                    >
                      <span className="text-white/40 group-hover:text-white/60 text-sm w-10 text-center font-medium">
                        {index + 1}
                      </span>
                      <img src={song.cover} alt={song.name} className="w-12 h-12 rounded-lg object-cover shadow-md" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-white font-semibold truncate">{song.name}</span>
                        <span className="text-white/60 text-sm truncate">{song.artist}</span>
                      </div>
                      <span className="text-white/40 text-sm">{song.duration}</span>

                      <div className="flex items-center gap-1">
                        <button 
                          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            patchSong(song.id, { favorite: !song.favorite });
                          }}
                        >
                          <FaStar className={`text-sm ${song.favorite ? 'text-yellow-400' : 'text-white/40 group-hover:text-white/60'}`} />
                        </button>

                        <button 
                          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            patchSong(song.id, { liked: !song.liked });
                          }}
                        >
                          <FaHeart className={`text-sm ${song.liked ? 'text-red-500' : 'text-white/40 group-hover:text-white/60'}`} />
                        </button>

                        <button 
                          className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-500 
                          hover:bg-emerald-600 transition-all ml-2 shadow-lg hover:shadow-emerald-500/50 transform hover:scale-110"
                          onClick={(e) => {
                            e.stopPropagation();
                            const idx = songs.findIndex(s => s.id === song.id);
                            if (idx !== -1) {
                              setCurrentIndex(idx);
                              setIsPlaying(true);
                            }
                          }}
                        >
                          <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <polygon points="5,3 19,12 5,21" />
                          </svg>
                        </button>
                      </div>
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