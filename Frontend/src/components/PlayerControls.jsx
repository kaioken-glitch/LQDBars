import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaStepBackward, FaStepForward, FaRandom, FaRedoAlt, FaVolumeUp, FaVolumeMute, FaChevronDown, FaEllipsisH, FaHeart, FaList, FaTimes } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import '../App.css';

export default function PlayerControls() {
  const {
    currentSong,
    isPlaying,
    setIsPlaying,
    songs,
    currentIndex,
    setCurrentIndex,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    currentTime,
    duration,
    audioRef,
    playNext,
    playPrev,
    shuffle,
    toggleShuffle,
    repeatMode,
    toggleRepeatMode,
    showBackgroundDetail,
    setShowBackgroundDetail,
  } = usePlayer();

  const [isDragging, setIsDragging] = useState(false);
  const [dominantColor, setDominantColor] = useState('rgba(16, 185, 129, 1)');
  const [isExpandedMobile, setIsExpandedMobile] = useState(false); // local mobile expanded state
  const [showQueue, setShowQueue] = useState(false); // queue panel in desktop expanded view
  const progressBarRef = useRef(null);
  const colorCacheRef = useRef({});

  // Extract dominant color from album art (unchanged)
  useEffect(() => {
    if (!currentSong?.cover) {
      setDominantColor('rgba(16, 185, 129, 1)');
      return;
    }

    if (colorCacheRef.current[currentSong.cover]) {
      setDominantColor(colorCacheRef.current[currentSong.cover]);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = currentSong.cover;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < data.length; i += 40) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        
        if (saturation < 0.3) {
          const boost = 1.5;
          const avg = (r + g + b) / 3;
          r = Math.min(255, Math.floor(avg + (r - avg) * boost));
          g = Math.min(255, Math.floor(avg + (g - avg) * boost));
          b = Math.min(255, Math.floor(avg + (b - avg) * boost));
        }
        
        const color = `rgba(${r}, ${g}, ${b}, 1)`;
        colorCacheRef.current[currentSong.cover] = color;
        setDominantColor(color);
      } catch (error) {
        setDominantColor('rgba(16, 185, 129, 1)');
      }
    };

    img.onerror = () => {
      setDominantColor('rgba(16, 185, 129, 1)');
    };
  }, [currentSong?.cover]);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  const handleProgressBarClick = (e) => {
    if (!duration || !progressBarRef.current || !audioRef?.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    
    audioRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
  };

  const handleProgressBarMouseDown = (e) => {
    setIsDragging(true);
    handleProgressBarClick(e);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !duration || !progressBarRef.current || !audioRef?.current) return;
      
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newTime = (clickX / rect.width) * duration;
      
      audioRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, duration, audioRef]);

  if (!currentSong) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-2xl border-t border-white/5 h-20 md:h-24 flex items-center justify-center z-40">
        <p className="text-white/40 text-sm font-medium">No song playing</p>
      </div>
    );
  }

  return (
    <>
      {/* ---------- DESKTOP COMPACT BAR ---------- */}
      {!showBackgroundDetail && (
        <div className="hidden md:block fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-2xl border-t border-white/5 z-40">
          <div 
            ref={progressBarRef}
            className="h-1 bg-white/10 cursor-pointer group relative hover:h-1.5 transition-all"
            onClick={handleProgressBarClick}
            onMouseDown={handleProgressBarMouseDown}
          >
            <div className="h-full bg-white transition-all" style={{ width: `${progressPercent}%` }} />
            <div 
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg 
              transition-all ${isDragging ? 'scale-125' : 'scale-0 group-hover:scale-100'}`}
              style={{ left: `${progressPercent}%`, marginLeft: '-6px' }}
            />
          </div>

          <div className="px-6 py-4">
            <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">
              
              {/* Left side: cover + info - clickable to expand */}
              <div className="flex items-center gap-4 flex-1 min-w-0 max-w-sm">
                <div
                  className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden shadow-xl cursor-pointer"
                  onClick={() => setShowBackgroundDetail(true)}
                >
                  <img
                    src={currentSong?.cover || 'https://placehold.co/64x64?text=No+Cover'}
                    alt={currentSong?.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-base truncate mb-0.5">{currentSong?.name || 'Unknown Song'}</div>
                  <div className="text-white/50 text-sm truncate">{currentSong?.artist || 'Unknown Artist'}</div>
                </div>
              </div>

              {/* Center controls (unchanged) */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-4">
                  <button onClick={toggleShuffle} className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${shuffle ? 'text-white' : 'text-white/40 hover:text-white/80'}`}>
                    <FaRandom className="text-sm" />
                  </button>
                  <button onClick={playPrev} className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-all">
                    <FaStepBackward className="text-base" />
                  </button>
                  <button onClick={() => setIsPlaying(!isPlaying)} className="w-14 h-14 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-transform shadow-xl">
                    {isPlaying ? <FaPause className="text-xl ml-0.5" /> : <FaPlay className="text-xl ml-1" />}
                  </button>
                  <button onClick={playNext} className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-all">
                    <FaStepForward className="text-base" />
                  </button>
                  <button onClick={toggleRepeatMode} className={`w-8 h-8 flex items-center justify-center rounded-full transition-all relative ${repeatMode !== 'off' ? 'text-white' : 'text-white/40 hover:text-white/80'}`}>
                    <FaRedoAlt className="text-sm" />
                    {repeatMode === 'one' && <span className="absolute -top-0.5 -right-0.5 bg-white text-black text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-medium">
                  <span className="text-white/50">{formatTime(currentTime)}</span>
                  <span className="text-white/30">•</span>
                  <span className="text-white/50">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right side (volume and queue info) */}
              <div className="flex items-center gap-3 flex-1 justify-end max-w-sm">
                <button onClick={toggleMute} className="w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all">
                  {isMuted ? <FaVolumeMute className="text-sm" /> : <FaVolumeUp className="text-sm" />}
                </button>
                <div className="flex items-center gap-2 min-w-[120px]">
                  <div className="relative w-full h-1 bg-white/10 rounded-full cursor-pointer group">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${isMuted ? 0 : volume * 100}%` }} />
                    <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const newVolume = parseFloat(e.target.value);
                        setVolume(newVolume);
                        if (isMuted && newVolume > 0) toggleMute();
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ left: `${isMuted ? 0 : volume * 100}%`, marginLeft: '-6px' }}
                    />
                  </div>
                  <span className="text-white/40 text-xs font-medium min-w-[32px]">
                    {isMuted ? '0' : Math.round(volume * 100)}%
                  </span>
                </div>
                <span className="text-white/40 text-xs font-medium whitespace-nowrap">{currentIndex + 1} of {songs.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- DESKTOP EXPANDED VIEW ---------- */}
      {showBackgroundDetail && (
        <div className="hidden md:block fixed inset-0 z-50 overflow-hidden" style={{ background: `linear-gradient(to bottom, ${dominantColor} 0%, #000 70%)` }}>
          {/* Top bar with collapse button and action icons */}
          <div className="flex items-center justify-between px-8 py-4 bg-black/20 backdrop-blur-sm border-b border-white/10">
            <button
              onClick={() => setShowBackgroundDetail(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all"
            >
              <FaChevronDown className="text-white text-lg" />
            </button>
            <div className="flex items-center gap-3">
              <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all">
                <FaHeart className="text-white/80 hover:text-red-500 text-lg" />
              </button>
              <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all">
                <FaList className="text-white/80 text-lg" />
              </button>
              <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all">
                <FaEllipsisH className="text-white/80 text-lg" />
              </button>
            </div>
          </div>

          {/* Main content area: flexible row */}
          <div className="flex h-[calc(100%-80px)] px-8 py-6">
            {/* Left side: cover and main controls */}
            <div className={`flex-1 flex flex-col items-center justify-center transition-all duration-300 ${showQueue ? 'mr-6' : ''}`}>
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-3xl blur-3xl opacity-40 group-hover:opacity-60 transition" />
                <img
                  src={currentSong?.cover || '/default-cover.png'}
                  alt={currentSong?.name}
                  className="relative w-80 h-80 rounded-3xl object-cover shadow-2xl border-4 border-white/20"
                />
              </div>

              <div className="mt-8 text-center">
                <h2 className="text-white text-4xl font-bold mb-2">{currentSong?.name}</h2>
                <p className="text-white/70 text-xl mb-6">{currentSong?.artist}</p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-md mb-6">
                <div className="flex justify-between text-white/60 text-sm mb-2">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full backdrop-blur-sm overflow-hidden cursor-pointer" onClick={handleProgressBarClick}>
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              {/* Playback controls */}
              <div className="flex items-center gap-6">
                <button onClick={toggleShuffle} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${shuffle ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}>
                  <FaRandom className="text-xl" />
                </button>
                <button onClick={playPrev} className="w-14 h-14 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-all">
                  <FaStepBackward className="text-2xl" />
                </button>
                <button onClick={() => setIsPlaying(!isPlaying)} className="w-20 h-20 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform shadow-2xl">
                  {isPlaying ? <FaPause className="text-3xl" /> : <FaPlay className="text-3xl ml-1" />}
                </button>
                <button onClick={playNext} className="w-14 h-14 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-all">
                  <FaStepForward className="text-2xl" />
                </button>
                <button onClick={toggleRepeatMode} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all relative ${repeatMode !== 'off' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}>
                  <FaRedoAlt className="text-xl" />
                  {repeatMode === 'one' && <span className="absolute -top-1 -right-1 bg-white text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">1</span>}
                </button>
              </div>
            </div>

            {/* Right side: queue panel (toggleable) */}
            {showQueue && (
              <div className="w-96 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">Queue</h3>
                  <button onClick={() => setShowQueue(false)} className="text-white/60 hover:text-white">
                    <FaTimes />
                  </button>
                </div>
                <div className="space-y-2">
                  {songs.map((song, idx) => (
                    <div
                      key={song.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        idx === currentIndex ? 'bg-white/20' : 'hover:bg-white/10'
                      }`}
                    >
                      <img src={song.cover || '/default-cover.png'} alt={song.name} className="w-10 h-10 rounded object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{song.name}</p>
                        <p className="text-white/60 text-xs truncate">{song.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Toggle queue button (if queue hidden) */}
          {!showQueue && (
            <button
              onClick={() => setShowQueue(true)}
              className="absolute right-8 bottom-8 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center"
            >
              <FaList className="text-white text-lg" />
            </button>
          )}
        </div>
      )}

      {/* ---------- MOBILE VIEWS (unchanged) ---------- */}
      {/* Mobile - Minimized Player Bar */}
      <div 
        className={`md:hidden fixed left-0 right-0 z-40 transition-all duration-300 ${
          isExpandedMobile ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
        }`}
        style={{ bottom: '70px' }}
      >
        <div className="bg-black/95 backdrop-blur-2xl border-t border-white/5 px-4 py-3"
          onClick={() => setIsExpandedMobile(true)}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
            <div className="h-full bg-white transition-all" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile cover – clickable to open global detail view (or local expanded) */}
            <div
              className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden shadow-lg cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setShowBackgroundDetail(true); // use global detail for consistency
              }}
            >
              <img src={currentSong?.cover || 'https://placehold.co/64x64?text=No+Cover'} alt={currentSong?.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm truncate">{currentSong?.name || 'Unknown Song'}</div>
              <div className="text-white/50 text-xs truncate">{currentSong?.artist || 'Unknown Artist'}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-black active:scale-95 transition-transform"
              >
                {isPlaying ? <FaPause className="text-base ml-0.5" /> : <FaPlay className="text-base ml-1" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); playNext(); }}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white active:scale-95 transition-transform"
              >
                <FaStepForward className="text-base" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile - Full Screen Expanded Player (using local state) */}
      <div 
        className={`md:hidden fixed inset-0 z-50 transition-all duration-500 ${
          isExpandedMobile ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{
          background: `linear-gradient(to bottom, ${dominantColor} 0%, rgba(0, 0, 0, 0.95) 60%, rgba(0, 0, 0, 0.98) 100%)`
        }}
      >
        {/* ... (keep existing mobile expanded player code) ... */}
        <div className="h-full flex flex-col overflow-y-auto pb-safe">
          <div className="flex items-center justify-between px-4 py-4 pt-safe">
            <button 
              onClick={() => setIsExpandedMobile(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white active:scale-95 transition-transform"
            >
              <FaChevronDown className="text-lg" />
            </button>
            <span className="text-white/60 text-xs font-medium">Playing from Playlist</span>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white active:scale-95 transition-transform">
              <FaEllipsisH className="text-base" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center px-6 py-8">
            <div className="w-full max-w-[380px] aspect-square rounded-3xl overflow-hidden shadow-2xl">
              <img src={currentSong?.cover || 'https://placehold.co/400x400?text=No+Cover'} alt={currentSong?.name} className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="px-6 pb-4">
            <h2 className="text-white font-bold text-2xl mb-1 line-clamp-2">{currentSong?.name || 'Unknown Song'}</h2>
            <p className="text-white/60 text-base truncate">{currentSong?.artist || 'Unknown Artist'}</p>
          </div>

          <div className="px-6 pb-2">
            <div 
              ref={progressBarRef}
              className="relative h-1 bg-white/20 rounded-full cursor-pointer mb-2"
              onClick={handleProgressBarClick}
              onMouseDown={handleProgressBarMouseDown}
            >
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
                style={{ left: `${progressPercent}%`, marginLeft: '-6px' }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-white/60">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="flex items-center justify-between mb-8">
              <button onClick={toggleShuffle}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-all ${
                  shuffle ? 'bg-white/20 text-white' : 'text-white/60'
                }`}
              >
                <FaRandom className="text-xl" />
              </button>

              <button onClick={playPrev} className="w-14 h-14 flex items-center justify-center rounded-full text-white active:scale-95 transition-transform">
                <FaStepBackward className="text-2xl" />
              </button>

              <button onClick={() => setIsPlaying(!isPlaying)}
                className="w-20 h-20 flex items-center justify-center rounded-full bg-white text-black active:scale-95 transition-transform shadow-2xl"
              >
                {isPlaying ? <FaPause className="text-3xl ml-0.5" /> : <FaPlay className="text-3xl ml-2" />}
              </button>

              <button onClick={playNext} className="w-14 h-14 flex items-center justify-center rounded-full text-white active:scale-95 transition-transform">
                <FaStepForward className="text-2xl" />
              </button>

              <button onClick={toggleRepeatMode}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-all relative ${
                  repeatMode !== 'off' ? 'bg-white/20 text-white' : 'text-white/60'
                }`}
              >
                <FaRedoAlt className="text-xl" />
                {repeatMode === 'one' && (
                  <span className="absolute -top-1 -right-1 bg-white text-black text-[11px] font-bold rounded-full w-4 h-4 flex items-center justify-center">1</span>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <button onClick={toggleMute} className="w-11 h-11 flex items-center justify-center rounded-full text-white/70 active:bg-white/10 transition-all">
                {isMuted ? <FaVolumeMute className="text-xl" /> : <FaVolumeUp className="text-xl" />}
              </button>

              <span className="text-white/40 text-sm font-medium">{currentIndex + 1} / {songs.length}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}