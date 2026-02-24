import React, { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faEllipsisH } from '@fortawesome/free-solid-svg-icons';
import { FaSearch, FaPlay, FaHeart, FaRandom } from 'react-icons/fa';
import TinyPlayer from '../components/TinyPlayer';
import SongTile from '../components/SongTile';
import { usePlayer } from '../context/PlayerContext';

export default function Favorites() {
  const {
    currentSong,
    isPlaying,
    playNext,
    playPrev,
    setIsPlaying,
    isMuted,
    toggleMute,
    downloadedSongs,
    setDownloadedSongs,
    setPlayerSongs,
    setCurrentIndex,
    songs
  } = usePlayer();

  const [query, setQuery] = useState('');
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);

  // Song flags (favorite, liked, etc.) from localStorage
  const [songFlags, setSongFlags] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lb:songFlags') || '{}');
    } catch (e) {
      return {};
    }
  });

  // Update localStorage when flags change
  useEffect(() => {
    localStorage.setItem('lb:songFlags', JSON.stringify(songFlags));
  }, [songFlags]);

  // Combine downloaded songs with all songs (to have full list)
  const library = useMemo(() => {
    return downloadedSongs.length ? downloadedSongs : songs;
  }, [downloadedSongs, songs]);

  // Filter library based on search query
  const filteredLibrary = useMemo(() => {
    if (!query.trim()) return library;
    const q = query.toLowerCase();
    return library.filter(song =>
      song.name?.toLowerCase().includes(q) ||
      song.artist?.toLowerCase().includes(q) ||
      song.album?.toLowerCase().includes(q)
    );
  }, [library, query]);

  // Songs marked as favorite (heart icon)
  const favoriteSongs = useMemo(() => {
    return filteredLibrary.filter(song => songFlags[song.id]?.favorite);
  }, [filteredLibrary, songFlags]);

  // Songs marked as liked (thumbs up)
  const likedSongs = useMemo(() => {
    return filteredLibrary.filter(song => songFlags[song.id]?.liked);
  }, [filteredLibrary, songFlags]);

  // Group favorite songs by album
  const favoriteAlbums = useMemo(() => {
    const groups = {};
    favoriteSongs.forEach(song => {
      const key = song.album || 'Unknown Album';
      if (!groups[key]) groups[key] = [];
      groups[key].push(song);
    });
    return Object.keys(groups).map(key => ({ album: key, songs: groups[key] }));
  }, [favoriteSongs]);

  const playAlbum = (albumSongs) => {
    setPlayerSongs(albumSongs);
    setCurrentIndex(0);
    setIsPlaying(true);
  };

  const playSongFromAlbum = (song, albumSongs) => {
    setPlayerSongs(albumSongs);
    const idx = albumSongs.findIndex(s => s.id === song.id);
    setCurrentIndex(idx >= 0 ? idx : 0);
    setIsPlaying(true);
  };

  const openAlbum = (album) => {
    setSelectedAlbum(album);
    setShowDetailView(true);
  };

  const closeDetail = () => {
    setShowDetailView(false);
    setSelectedAlbum(null);
  };

  const toggleFlag = (songId, flag) => {
    setSongFlags(prev => ({
      ...prev,
      [songId]: {
        ...prev[songId],
        [flag]: !prev[songId]?.[flag]
      }
    }));
  };

  // For the "Liked Songs" card – we treat liked songs as a special album
  const likedAlbum = likedSongs.length > 0 ? {
    album: 'Liked Songs',
    songs: likedSongs
  } : null;

  return (
    <div className="favorites w-full h-full flex flex-col items-center justify-start overflow-x-hidden pb-20">
      {/* Header Section */}
      <div className="head w-full max-w-[1600px] px-4 md:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex flex-col gap-4">
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            {/* Search - always visible */}
            <div className="relative flex items-center w-full md:w-80">
              <FaSearch className="absolute left-4 text-white/50 text-sm" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search favorites..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 text-white 
                outline-none rounded-full font-medium text-sm backdrop-blur-xl 
                placeholder:text-white/50 focus:bg-white/15 focus:border-emerald-400/50 transition-all"
              />
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
          </div>

          {/* Page Title */}
          <div className="mt-4">
            <h1 className="text-white text-4xl md:text-5xl font-bold tracking-tight">
              Favorites
            </h1>
            <p className="text-white/60 text-sm md:text-base mt-2">
              {favoriteAlbums.length + (likedAlbum ? 1 : 0)} collections • {favoriteSongs.length} favorites • {likedSongs.length} liked
            </p>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="w-full max-w-[1600px] px-4 md:px-6 lg:px-8 mt-6 flex-1 overflow-y-auto">
        {favoriteSongs.length === 0 && !likedAlbum ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center mb-4">
              <FaHeart className="text-white/40 text-3xl" />
            </div>
            <h3 className="text-white text-2xl font-bold mb-2">No favorites yet</h3>
            <p className="text-white/60 max-w-md">Tap the heart on any song to add it to your favorites.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 pb-8">
            {/* Liked Songs Card */}
            {likedAlbum && (
              <div
                onClick={() => openAlbum(likedAlbum)}
                className="group relative bg-gradient-to-br from-pink-500/20 to-purple-600/20 backdrop-blur-xl 
                rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer 
                border border-white/10 hover:border-pink-400/30 hover:scale-[1.02] overflow-hidden"
              >
                <div className="aspect-square grid grid-cols-2 gap-0.5 p-0.5">
                  {likedAlbum.songs.slice(0, 4).map((s, idx) => (
                    <img
                      key={idx}
                      src={s.cover || '/default-cover.png'}
                      alt={s.name}
                      className="w-full h-full object-cover"
                      onError={(e) => (e.target.src = '/default-cover.png')}
                    />
                  ))}
                </div>
                <div className="p-4">
                  <h3 className="text-white font-bold text-base mb-1 truncate">Liked Songs</h3>
                  <p className="text-white/60 text-xs mb-3">{likedAlbum.songs.length} songs</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playAlbum(likedAlbum.songs);
                    }}
                    className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-r 
                    from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 
                    transition-all shadow-lg hover:shadow-pink-500/50 ml-auto transform hover:scale-110"
                  >
                    <FaPlay className="text-white text-sm ml-0.5" />
                  </button>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent 
                opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />
              </div>
            )}

            {/* Favorite Album Cards */}
            {favoriteAlbums.map((alb) => (
              <div
                key={alb.album}
                onClick={() => openAlbum(alb)}
                className="group relative bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl hover:shadow-2xl 
                transition-all duration-300 cursor-pointer border border-white/10 hover:border-emerald-400/30 
                hover:scale-[1.02] overflow-hidden"
              >
                <div className="aspect-square grid grid-cols-2 gap-0.5 p-0.5 bg-gradient-to-br from-emerald-500/40 to-teal-600/40">
                  {alb.songs.slice(0, 4).map((s, idx) => (
                    <img
                      key={idx}
                      src={s.cover || '/default-cover.png'}
                      alt={s.name}
                      className="w-full h-full object-cover"
                      onError={(e) => (e.target.src = '/default-cover.png')}
                    />
                  ))}
                </div>
                <div className="p-4">
                  <h3 className="text-white font-bold text-base mb-1 truncate">{alb.album}</h3>
                  <p className="text-white/60 text-xs mb-1 truncate">{alb.songs[0]?.artist || 'Unknown Artist'}</p>
                  <p className="text-white/50 text-xs">{alb.songs.length} songs</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playAlbum(alb.songs);
                    }}
                    className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-r 
                    from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
                    transition-all shadow-lg hover:shadow-emerald-500/50 ml-auto mt-3 transform hover:scale-110"
                  >
                    <FaPlay className="text-white text-sm ml-0.5" />
                  </button>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent 
                opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail View Modal */}
      {showDetailView && selectedAlbum && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/90 via-slate-900 to-black" />

          {/* Sticky Glass Header */}
          <div className="sticky top-0 z-20 w-full px-4 md:px-6 py-3 backdrop-blur-2xl bg-black/30 border-b border-white/10">
            <div className="flex items-center justify-between">
              <button
                onClick={closeDetail}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 
                backdrop-blur-xl hover:bg-white/20 transition-all border border-white/20 
                hover:border-white/30 shadow-lg hover:scale-105 active:scale-95"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="text-white text-base" />
              </button>
              <div className="flex items-center gap-2">
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
              <img
                src={selectedAlbum.songs[0]?.cover || '/default-cover.png'}
                alt={selectedAlbum.album}
                className="relative w-36 h-36 md:w-48 md:h-48 rounded-2xl object-cover shadow-2xl border-2 border-white/20 backdrop-blur-sm"
                onError={(e) => (e.target.src = '/default-cover.png')}
              />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <span className="w-1 h-3 bg-emerald-500 rounded-full" />
                <span>{selectedAlbum.album === 'Liked Songs' ? 'PLAYLIST' : 'ALBUM'}</span>
              </div>

              <h1 className="text-white text-4xl md:text-6xl font-black tracking-tight leading-tight break-words">
                {selectedAlbum.album}
              </h1>

              <p className="text-white/70 text-base md:text-lg max-w-2xl">
                {selectedAlbum.album === 'Liked Songs' 
                  ? 'Songs you’ve liked' 
                  : (selectedAlbum.songs[0]?.artist || 'Various Artists')}
              </p>

              <div className="flex items-center gap-4 text-sm text-white/60">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {selectedAlbum.songs.length} songs
                </span>
              </div>

              {/* Icon-only action buttons */}
              <div className="flex items-center gap-4 pt-3">
                <button
                  onClick={() => playAlbum(selectedAlbum.songs)}
                  className="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-r 
                  from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 
                  text-white shadow-xl hover:shadow-emerald-500/50 transform hover:scale-105 transition-all"
                  aria-label="Play all songs"
                >
                  <FaPlay className="text-white text-xl ml-1" />
                </button>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 
                  backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all 
                  text-white/80 hover:text-white"
                  aria-label="Shuffle"
                >
                  <FaRandom className="text-sm" />
                </button>
              </div>
            </div>
          </div>

          {/* Tracklist */}
          <div className="relative z-10 flex-1 px-4 md:px-6 py-4 overflow-y-auto">
            <div className="w-full max-w-5xl mx-auto">
              <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-3 px-2">
                TRACKS · {selectedAlbum.songs.length}
              </h2>

              <div className="flex flex-col gap-1">
                {selectedAlbum.songs.map((song, index) => {
                  const songId = song.id || `song-${index}`;
                  const isFavorite = songFlags[songId]?.favorite || false;
                  const isLiked = songFlags[songId]?.liked || false;

                  return (
                    <div
                      key={songId}
                      className="group flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 
                      hover:bg-white/10 transition-all cursor-pointer border border-transparent 
                      hover:border-white/10 backdrop-blur-sm"
                      onClick={() => playSongFromAlbum(song, selectedAlbum.songs)}
                    >
                      <span className="text-white/40 group-hover:text-white/60 text-xs w-6 text-center font-mono">
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      <div className="relative w-9 h-9 rounded-md overflow-hidden shadow-md flex-shrink-0">
                        <img src={song.cover || '/default-cover.png'} alt={song.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate group-hover:text-emerald-400 transition-colors">
                          {song.name}
                        </p>
                        <p className="text-white/50 text-xs truncate">{song.artist || 'Unknown'}</p>
                      </div>

                      <span className="text-white/40 text-xs font-mono hidden md:block">
                        {song.formattedDuration || song.duration || '0:00'}
                      </span>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFlag(songId, 'favorite');
                          }}
                        >
                          <FaHeart className={`text-xs ${isFavorite ? 'text-yellow-400' : 'text-white/40'}`} />
                        </button>
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-500/80 
                          hover:bg-emerald-500 transition-all shadow-md"
                          onClick={(e) => {
                            e.stopPropagation();
                            playSongFromAlbum(song, selectedAlbum.songs);
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
    </div>
  );
}