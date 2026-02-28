import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaSearch, FaStar, FaHeart, FaPlay, FaTimes, FaRandom } from 'react-icons/fa';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleArrowDown, faChevronLeft, faEllipsisH, } from '@fortawesome/free-solid-svg-icons';
import { fetchSongs, patchSong as apiPatchSong } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import SongTile from '../components/SongTile';
import PlayerControls from '../components/PlayerControls';
import youtubeConverter from '../utils/youtubeConverter';
import Loader from '../utils/Splashscreen';
import BackgroundPlayerDetail from '../components/BackgroundPlayerDetail';

export default function HomeOnline() {
  const [showInput, setShowInput] = useState(false);
  const [query, setQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [results, setResults] = useState([]);
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);
  const [showGenres, setShowGenres] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [activeFilter, setActiveFilter] = useState('Albums');
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [mockSongStates, setMockSongStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const playlists = useMemo(() => [
    { id: 'indie-folk-mix', name: 'Indie Folk Mix', description: 'Soft acoustic vibes', cover: 'https://placehold.co/300x200/8B4513/FFFFFF?text=Indie+Folk', songs: [], type: 'indie' },
    { id: 'underground-hiphop', name: 'Underground Hip-Hop', description: 'Raw lyricism & beats', cover: 'https://placehold.co/300x200/2F4F4F/FFFFFF?text=Underground+Hip-Hop', songs: [], type: 'hiphop' },
    { id: 'edm-bangers', name: 'EDM Bangers', description: 'Festival anthems', cover: 'https://placehold.co/300x200/00CED1/FFFFFF?text=EDM+Bangers', songs: [], type: 'edm' },
    { id: '8-bit-vibes', name: '8‑Bit Vibes', description: 'Chiptune & retro', cover: 'https://placehold.co/300x200/FFD700/000000?text=8-Bit+Vibes', songs: [], type: '8bit' },
  ], []);
  
  const albums = useMemo(() => [
    { id: 'album-damn', name: 'DAMN.', artist: 'Kendrick Lamar', cover: 'https://placehold.co/300x200/800000/FFFFFF?text=DAMN.', songs: [], type: 'album' },
    { id: 'album-brent', name: 'Wasteland', artist: 'Brent Faiyaz', cover: 'https://placehold.co/300x200/228B22/FFFFFF?text=Wasteland', songs: [], type: 'album' },
    { id: 'album-future', name: 'I NEVER LIKED YOU', artist: 'Future', cover: 'https://placehold.co/300x200/000080/FFFFFF?text=I+NEVER+LIKED+YOU', songs: [], type: 'album' },
    { id: 'album-don', name: 'Life of a DON', artist: 'Don Toliver', cover: 'https://placehold.co/300x200/FF8C00/FFFFFF?text=Life+of+a+DON', songs: [], type: 'album' },
    { id: 'album-living-tombstone', name: 'The Living Tombstone', artist: 'The Living Tombstone', cover: 'https://placehold.co/300x200/4B0082/FFFFFF?text=TLT', songs: [], type: 'album' },
    { id: 'album-nina', name: 'I Put a Spell on You', artist: 'Nina Simone', cover: 'https://placehold.co/300x200/000000/FFFFFF?text=Nina+Simone', songs: [], type: 'jazz' },
    { id: 'album-etta', name: 'At Last!', artist: 'Etta James', cover: 'https://placehold.co/300x200/708090/FFFFFF?text=At+Last', songs: [], type: 'blues' },
  ], []);
  
  const suggestions = useMemo(() => [
    { id: 'suggestion-luther', name: 'luther', artist: 'Kendrick Lamar', cover: 'https://placehold.co/300x200/663399/FFFFFF?text=luther', type: 'hiphop' },
    { id: 'suggestion-skyami', name: 'SKYAMI', artist: 'Don Toliver', cover: 'https://placehold.co/300x200/FF6347/FFFFFF?text=SKYAMI', type: 'hiphop' },
    { id: 'suggestion-wait-for-u', name: 'Wait For U', artist: 'Future ft. Drake, Tems', cover: 'https://placehold.co/300x200/4682B4/FFFFFF?text=Wait+For+U', type: 'hiphop' },
    { id: 'suggestion-gravity', name: 'Gravity', artist: 'Brent Faiyaz', cover: 'https://placehold.co/300x200/DAA520/FFFFFF?text=Gravity', type: 'r&b' },
    { id: 'suggestion-minecraft-calming', name: 'Minecraft Calming', artist: 'C418', cover: 'https://placehold.co/300x200/228B22/FFFFFF?text=Minecraft', type: '8bit' },
    { id: 'suggestion-pokemon-center', name: 'Pokémon Center', artist: 'Junichi Masuda', cover: 'https://placehold.co/300x200/FF1493/000000?text=Pokémon', type: '8bit' },
    { id: 'suggestion-bad-guy', name: 'Bad Guy', artist: 'The Living Tombstone', cover: 'https://placehold.co/300x200/DC143C/FFFFFF?text=Bad+Guy', type: 'electronic' },
    { id: 'suggestion-stressed-out', name: 'Stressed Out', artist: 'Twenty One Pilots', cover: 'https://placehold.co/300x200/696969/FFFFFF?text=Stressed+Out', type: 'indie' },
    { id: 'suggestion-feeling-good', name: 'Feeling Good', artist: 'Nina Simone', cover: 'https://placehold.co/300x200/2E8B57/FFFFFF?text=Feeling+Good', type: 'jazz' },
    { id: 'suggestion-at-last', name: 'At Last', artist: 'Etta James', cover: 'https://placehold.co/300x200/CD5C5C/FFFFFF?text=At+Last', type: 'blues' },
  ], []);
  
  const newReleases = useMemo(() => [
    { id: 'new-chromakopia', name: 'CHROMAKOPIA', artist: 'Tyler, The Creator', cover: 'https://placehold.co/300x200/FFD700/000000?text=CHROMAKOPIA', type: 'new-release' },
    { id: 'new-bando-stone', name: 'Bando Stone', artist: 'Childish Gambino', cover: 'https://placehold.co/300x200/FF4500/FFFFFF?text=Bando+Stone', type: 'new-release' },
    { id: 'new-we-dont-trust-you', name: 'We Don’t Trust You', artist: 'Future & Metro Boomin', cover: 'https://placehold.co/300x200/8A2BE2/FFFFFF?text=We+Don’t+Trust+You', type: 'new-release' },
    { id: 'new-vultures', name: 'Vultures 2', artist: '¥$', cover: 'https://placehold.co/300x200/2F4F4F/FFFFFF?text=Vultures+2', type: 'new-release' },
  ], []);

  useEffect(() => {
    if (volume === 1) setVolume(0.2);
  }, []);

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
      setPlayerSongs(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
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

  const handleCardPlay = useCallback((item) => {
    setSelectedItem(item);
    setShowDetailView(true);
  }, []);

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
      className="group relative bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl hover:shadow-2xl 
      transition-all duration-300 cursor-pointer border border-white/10 hover:border-emerald-400/30 
      hover:scale-[1.02] overflow-hidden flex flex-col"
      onClick={() => handleCardPlay({ ...item, type: itemType })}
    >
      <div className="relative aspect-[3/2] overflow-hidden">
        <img src={item.cover} alt={item.name} className="w-full h-full object-cover" />
        {itemType === 'new-release' && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white 
          text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">NEW</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent 
        opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-white font-bold text-sm md:text-base mb-1 truncate">{item.name}</h3>
          <p className="text-white/60 text-xs md:text-sm truncate">{item.artist || item.description}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="w-10 h-10 mt-3 flex items-center justify-center rounded-full bg-gradient-to-r 
          from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
          transition-all shadow-lg hover:shadow-emerald-500/50 ml-auto transform hover:scale-110"
        >
          <FaPlay className="text-white text-sm ml-0.5" />
        </button>
      </div>
    </div>
  ), []);

  // Detail view for downloaded items and online cards
  const renderDetailView = () => {
    if (!selectedItem) return null;
    const isDownloaded = selectedItem.type === 'downloaded';
    const cover = isDownloaded ? selectedItem.songs?.[0]?.cover : selectedItem.cover;
    const title = isDownloaded ? 'Downloaded Songs' : selectedItem.name;
    const subtitle = isDownloaded ? `${selectedItem.songCount} songs` : (selectedItem.artist || selectedItem.description);
    const songList = isDownloaded ? selectedItem.songs : (selectedItem.songs || []);
    
    return (
      <div className="detailView w-full h-full flex flex-col overflow-hidden">
        {/* Clean full-screen gradient background */}
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
                src={cover || '/default-cover.png'}
                alt={title}
                className="w-36 h-36 md:w-48 md:h-48 rounded-2xl object-cover shadow-2xl border-2 border-white/20 backdrop-blur-sm"
                onError={(e) => e.target.src = '/default-cover.png'}
              />
              {isDownloaded && (
                <div className="absolute -top-2 -right-2 bg-emerald-500/90 backdrop-blur-sm rounded-full p-1.5 shadow-xl">
                  <FontAwesomeIcon icon={faCircleArrowDown} className="text-white text-xs" />
                </div>
              )}
            </div>
          </div>
            
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <span className="w-1 h-3 bg-emerald-500 rounded-full" />
              <span>{isDownloaded ? 'LOCAL LIBRARY' : selectedItem.type.replace('-', ' ').toUpperCase()}</span>
            </div>
            
            <h1 className="text-white text-4xl md:text-6xl font-black tracking-tight leading-tight break-words">
              {title}
            </h1>
            
            <p className="text-white/70 text-base md:text-lg max-w-2xl">
              {subtitle}
            </p>
            
            {isDownloaded && (
              <div className="flex items-center gap-4 text-sm text-white/60">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  {selectedItem.songCount} songs
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                    <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                  {selectedItem.duration}
                </span>
              </div>
            )}
  
            {/* Action buttons – Compact */}
            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => {
                  if (isDownloaded) {
                    setPlayerSongs(selectedItem.songs, 0);
                    setIsPlaying(true);
                  } else {
                    playOnlineItem(selectedItem);
                  }
                }}
                className="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-r 
                from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
                text-white shadow-xl hover:shadow-emerald-500/50 transform hover:scale-105 transition-all"
                aria-label={isDownloaded ? "Play all songs" : "Play"}
              >
                <FaPlay className="text-white text-xl ml-1" />
              </button>
              <button 
                className="w-30 h-10 flex items-center justify-start pl-3 rounded-full bg-white/10 
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
          <div className="w-full  mx-auto">
            <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-3 px-2">
              TRACKS · {songList.length}
            </h2>
              
            <div className="flex flex-col gap-1">
              {songList.map((song, index) => {
                const songId = song.id || `song-${index}`;
                const isFavorite = mockSongStates[songId]?.favorite || song.favorite || false;
                const isLiked = mockSongStates[songId]?.liked || song.liked || false;
              
                return (
                  <div
                    key={songId}
                    className="group flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 
                    hover:bg-white/10 transition-all cursor-pointer border border-transparent 
                    hover:border-white/10 backdrop-blur-sm"
                    onClick={() => {
                      if (isDownloaded) {
                        const idx = songs.findIndex(s => s.id === song.id);
                        if (idx !== -1) {
                          setCurrentIndex(idx);
                          setIsPlaying(true);
                        }
                      } else {
                        playStreamingSong(song);
                      }
                    }}
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
                          setMockSongStates(prev => ({
                            ...prev,
                            [songId]: { favorite: !isFavorite, liked: isLiked }
                          }));
                        }}
                      >
                        <FaStar className={`text-xs ${isFavorite ? 'text-yellow-400' : 'text-white/40'}`} />
                      </button>
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMockSongStates(prev => ({
                            ...prev,
                            [songId]: { liked: !isLiked, favorite: isFavorite }
                          }));
                        }}
                      >
                        <FaHeart className={`text-xs ${isLiked ? 'text-red-500' : 'text-white/40'}`} />
                      </button>
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-500/80 
                        hover:bg-emerald-500 transition-all shadow-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isDownloaded) {
                            const idx = songs.findIndex(s => s.id === song.id);
                            if (idx !== -1) {
                              setCurrentIndex(idx);
                              setIsPlaying(true);
                            }
                          } else {
                            playStreamingSong(song);
                          }
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
    );
  };

  return (
    <div className="homeOnline w-full h-full flex flex-col pb-22 md:pb-24">
      {loading && songs.length === 0 && <Loader />}

      {!showDetailView ? (
        <>
          {/* Header */}
          <div className="w-full px-4 md:px-8 lg:px-12 pt-4 md:pt-6 pb-2 md:pb-3">
            <div className="flex flex-col gap-2 md:gap-3">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-3">
                {/* Search */}
                <div className="relative flex items-center w-full md:w-80">
                  <FaSearch className="absolute left-4 text-white/50 text-sm" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search music..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 text-white 
                    outline-none rounded-full font-medium text-sm backdrop-blur-xl 
                    placeholder:text-white/50 focus:bg-white/15 focus:border-emerald-400/50 transition-all"
                  />
                  {query && (results.length > 0 || youtubeResults.length > 0 || isSearchingYoutube) && (
                    <div className="absolute left-0 top-12 w-full bg-gradient-to-b from-emerald-600 
                    to-emerald-700 rounded-2xl shadow-2xl z-50 overflow-hidden border border-white/10 backdrop-blur-xl">
                      {results.length > 0 && (
                        <>
                          <div className="px-4 py-2 bg-emerald-800/50 text-xs font-bold text-white sticky top-0">
                            Local Songs
                          </div>
                          {results.slice(0, 5).map((song, i) => (
                            <div
                              key={song.id || i}
                              className="px-4 py-3 hover:bg-white/10 cursor-pointer flex items-center gap-3"
                              onClick={() => {
                                setQuery(song.name);
                                const idx = songs.findIndex(s => s.id === song.id);
                                if (idx !== -1) {
                                  setCurrentIndex(idx);
                                  setIsPlaying(true);
                                }
                              }}
                            >
                              <img src={song.cover} alt={song.name} className="w-10 h-10 rounded object-cover" />
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold truncate">{song.name}</p>
                                <p className="text-white/70 text-xs truncate">{song.artist}</p>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      {isSearchingYoutube && (
                        <div className="px-4 py-4 text-center text-white/70 text-sm">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2" />
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
                          {youtubeResults.slice(0, 5).map(video => (
                            <div
                              key={video.id}
                              className="px-4 py-3 hover:bg-red-500/20 cursor-pointer flex items-center gap-3"
                              onClick={() => {
                                setQuery('');
                                playYoutubeVideo(video);
                              }}
                            >
                              <img src={video.thumbnail} alt={video.title} className="w-10 h-10 rounded object-cover" />
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold truncate">{video.title}</p>
                                <p className="text-white/70 text-xs truncate">{video.channel}</p>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="relative flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-1.5 
                  border border-white/20 backdrop-blur-xl shadow-lg">
                  <div
                    className="absolute top-1.5 h-[34px] rounded-full bg-gradient-to-r from-emerald-500 
                    to-emerald-600 shadow-lg transition-all duration-300"
                    style={{
                      width: '90px',
                      transform: activeFilter === 'Albums' ? 'translateX(6px)' : 'translateX(102px)'
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
                </div>

                {/* Genres */}
                <div className="relative z-50">
                  <button
                    className="px-4 py-2 rounded-full text-sm font-medium text-white bg-white/10 
                    border border-white/20 flex items-center gap-2 hover:bg-white/20 transition-all"
                    onClick={() => setShowGenres(g => !g)}
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

              <div>
                <h1 className="text-white text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">Discover</h1>
                <p className="text-white/60 text-xs md:text-sm mt-1">Stream millions of songs • Explore new music</p>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="w-full min-h-[540px] flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 pb-8">
            <section className="mb-8">
              <h2 className="text-white text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full" />
                Music Suggestions
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {suggestions.map(s => renderCard(s, 'suggestion', () => playStreamingSong(s)))}
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-white text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full" />
                Playlists
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {playlists.map(p => renderCard(p, 'playlist', () => playOnlineItem(p)))}
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-white text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full" />
                Albums
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {albums.map(a => renderCard(a, 'album', () => playOnlineItem(a)))}
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-white text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full" />
                New Releases
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {newReleases.map(n => renderCard(n, 'new-release', () => playStreamingSong(n)))}
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-white text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full" />
                Downloaded
              </h2>
              {songs.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  <div
                    className="group relative bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl 
                    hover:shadow-2xl transition-all duration-300 cursor-pointer border border-white/10 
                    hover:border-emerald-400/30 hover:scale-[1.02] overflow-hidden"
                    onClick={() => handleCardPlay({
                      type: 'downloaded',
                      name: 'Downloaded Songs',
                      cover: songs[0]?.cover,
                      songCount: songs.length,
                      duration: `${Math.floor(songs.length * 3.5)} min`,
                      songs: songs
                    })}
                  >
                    <div className="relative aspect-[3/2] bg-gradient-to-br from-emerald-500/40 to-teal-600/40 
                    grid grid-cols-2 gap-0.5 p-0.5">
                      <img src={songs[0]?.cover || '/default-cover.png'} alt="" className="w-full h-full object-cover" />
                      <img src={songs[1]?.cover || '/default-cover.png'} alt="" className="w-full h-full object-cover" />
                      <img src={songs[2]?.cover || songs[0]?.cover || '/default-cover.png'} alt="" 
                      className="w-full h-full object-cover col-span-2" />
                      <div className="absolute top-2 right-2 bg-emerald-500/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg">
                        <FontAwesomeIcon icon={faCircleArrowDown} className="text-white text-sm" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-white font-bold text-sm mb-1">Downloaded</h3>
                      <p className="text-white/60 text-xs mb-3">{songs.length} songs</p>
                      <button className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r 
                      from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
                      transition-all shadow-lg hover:shadow-emerald-500/50 ml-auto transform hover:scale-110">
                        <FaPlay className="text-white text-xs ml-0.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                    <FontAwesomeIcon icon={faCircleArrowDown} className="text-white/40 text-2xl" />
                  </div>
                  <p className="text-white/60 text-lg">No downloaded songs</p>
                  <p className="text-white/40 text-sm mt-1">Download songs to access offline</p>
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        renderDetailView()
      )}

      <PlayerControls />
    </div>
  );
}