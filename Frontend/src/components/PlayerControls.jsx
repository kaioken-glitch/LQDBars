import React, { useState, useEffect, useMemo } from 'react';
import { FaPlay, FaPause, FaStepBackward, FaStepForward, FaRandom, FaRedoAlt, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import '../App.css';

export default function PlayerControls() {
  const {
    currentSong,
    isPlaying,
    setIsPlaying,
    playNext,
    playPrev,
    songs,
    currentIndex,
    setCurrentIndex,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    currentTime,
    duration,
    audioRef
  } = usePlayer();

  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'all', 'one'
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const progressBarRef = React.useRef(null);

  // Generate shuffled order when shuffle is enabled
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

  // Handle next track with shuffle and repeat logic
  const handlePlayNext = () => {
    if (shuffle) {
      if (currentIndex < shuffledOrder.length - 1) {
        setCurrentIndex(shuffledOrder[currentIndex + 1]);
      } else if (repeatMode === 'all') {
        setCurrentIndex(shuffledOrder[0]);
      } else {
        setCurrentIndex(0);
      }
    } else {
      if (currentIndex < songs.length - 1) {
        playNext();
      } else if (repeatMode === 'all') {
        setCurrentIndex(0);
      }
    }
  };

  // Handle previous track
  const handlePlayPrev = () => {
    if (shuffle) {
      if (currentIndex > 0) {
        setCurrentIndex(shuffledOrder[currentIndex - 1]);
      } else if (repeatMode === 'all') {
        setCurrentIndex(shuffledOrder[shuffledOrder.length - 1]);
      } else {
        playPrev();
      }
    } else {
      playPrev();
    }
  };

  // Format time helper
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  // Handle progress bar click/seek
  const handleProgressBarClick = (e) => {
    if (!duration || !progressBarRef.current || !audioRef?.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    
    audioRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
  };

  // Handle progress bar drag start
  const handleProgressBarMouseDown = (e) => {
    setIsDragging(true);
    handleProgressBarClick(e);
  };

  // Handle mouse move while dragging
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

  // Toggle repeat mode
  const handleRepeatToggle = () => {
    const modes = ['off', 'all', 'one'];
    const currentModeIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentModeIndex + 1) % modes.length];
    setRepeatMode(nextMode);
  };

  // Toggle shuffle
  const handleShuffleToggle = () => {
    setShuffle(!shuffle);
  };

  if (!currentSong) {
    return (
      <div className="playerControls fixed bottom-0 left-0 right-0 bg-gradient-to-r from-black/90 via-black/80 to-black/90 
      backdrop-blur-xl border-t border-white/10 h-24 md:h-28 flex items-center justify-center z-40">
        <p className="text-white/60 text-sm">No song selected</p>
      </div>
    );
  }

  return (
    <div className="playerControls fixed bottom-0 left-0 right-0 bg-gradient-to-r from-black/90 via-black/80 to-black/90 
    backdrop-blur-xl border-t border-white/10 z-40 px-3 md:px-6 py-2 md:py-3">
      
      {/* Progress Bar */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-white/60 text-xs md:text-xs min-w-fit font-medium">{formatTime(currentTime)}</span>
        <div 
          ref={progressBarRef}
          className="flex-1 h-0.5 md:h-1 bg-white/10 rounded-full cursor-pointer group relative hover:h-1 md:hover:h-1.5 transition-all"
          onClick={handleProgressBarClick}
          onMouseDown={handleProgressBarMouseDown}
        >
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
          <div 
            className={`absolute top-1/2 -translate-y-1/2 bg-white rounded-full shadow-lg 
            transition-all ${isDragging ? 'w-3 h-3 md:w-4 md:h-4' : 'w-2 h-2 md:w-3 md:h-3'}
            opacity-0 group-hover:opacity-100 ${isDragging ? '!opacity-100' : ''}`}
            style={{ left: `${progressPercent}%`, marginLeft: isDragging ? '-6px' : '-4px' }}
          />
        </div>
        <span className="text-white/60 text-xs md:text-xs min-w-fit font-medium">{formatTime(duration)}</span>
      </div>

      {/* Main Controls Row */}
      <div className="flex items-center justify-between gap-2 md:gap-4">
        
        {/* Left: Song Info with Cover and Marquee */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Album Cover */}
          <div className="w-12 h-12 md:w-14 md:h-14 flex-shrink-0 rounded-md overflow-hidden 
          shadow-lg border border-emerald-500/50 bg-gradient-to-br from-emerald-500/40 to-teal-600/40">
            <img 
              src={currentSong?.cover || 'https://placehold.co/64x64?text=No+Cover'} 
              alt={currentSong?.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Song Info with Marquee - Hidden on Mobile, Show on larger screens */}
          <div className="hidden sm:flex flex-1 min-w-0 flex-col gap-0.5">
            <div className="text-white font-semibold text-xs md:text-sm truncate line-clamp-1">
              {currentSong?.name || 'Unknown Song'}
            </div>
            {/* Marquee Artist Name */}
            <div className="overflow-hidden bg-white/5 rounded-full px-2 py-0.5">
              <div className="marquee">
                <span className="marquee-content text-white/70 text-[10px] md:text-xs whitespace-nowrap font-medium">
                  {currentSong?.artist || 'Unknown Artist'}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Song Info - Compact */}
          <div className="sm:hidden flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="text-white font-semibold text-xs truncate">
              {currentSong?.name?.slice(0, 20) || 'Unknown'}
            </div>
            <div className="text-white/60 text-[10px] truncate">
              {currentSong?.artist?.slice(0, 15) || 'Unknown'}
            </div>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          
          {/* Shuffle Button - Hidden on small mobile */}
          <button
            onClick={handleShuffleToggle}
            className={`hidden sm:flex w-7 h-7 md:w-8 md:h-8 items-center justify-center rounded-full 
            transition-all transform hover:scale-110 ${
              shuffle 
                ? 'bg-emerald-500/80 text-white shadow-lg shadow-emerald-500/50' 
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title={`Shuffle: ${shuffle ? 'On' : 'Off'}`}
          >
            <FaRandom className="text-xs md:text-sm" />
          </button>

          {/* Previous Button */}
          <button
            onClick={handlePlayPrev}
            disabled={songs.length === 0}
            className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full 
            text-white hover:bg-white/10 transition-all transform hover:scale-110 disabled:opacity-50"
            title="Previous"
          >
            <FaStepBackward className="text-xs md:text-sm" />
          </button>

          {/* Play/Pause Button - Main */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full 
            bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500
            text-white shadow-lg hover:shadow-emerald-500/50 transition-all transform hover:scale-105 
            active:scale-95"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <FaPause className="text-xs md:text-base ml-0.5" />
            ) : (
              <FaPlay className="text-xs md:text-base ml-1" />
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={handlePlayNext}
            disabled={songs.length === 0}
            className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full 
            text-white hover:bg-white/10 transition-all transform hover:scale-110 disabled:opacity-50"
            title="Next"
          >
            <FaStepForward className="text-xs md:text-sm" />
          </button>

          {/* Repeat Button - Hidden on small mobile */}
          <button
            onClick={handleRepeatToggle}
            className={`hidden sm:flex w-7 h-7 md:w-8 md:h-8 items-center justify-center rounded-full 
            transition-all transform hover:scale-110 relative ${
              repeatMode !== 'off'
                ? 'bg-emerald-500/80 text-white shadow-lg shadow-emerald-500/50'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title={`Repeat: ${repeatMode === 'off' ? 'Off' : repeatMode === 'all' ? 'All' : 'One'}`}
          >
            <FaRedoAlt className="text-xs md:text-sm" />
            {repeatMode === 'one' && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold 
              rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>
            )}
          </button>
        </div>

        {/* Right: Volume Control & Track Counter */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          
          {/* Volume Button */}
          <button
            onClick={toggleMute}
            className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full 
            text-white hover:bg-white/10 transition-all transform hover:scale-110"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <FaVolumeMute className="text-xs md:text-sm" />
            ) : (
              <FaVolumeUp className="text-xs md:text-sm" />
            )}
          </button>

          {/* Volume Slider - Desktop only */}
          <div className="hidden lg:flex items-center gap-1.5">
            <div className="w-16 h-0.5 bg-white/10 rounded-full cursor-pointer group relative">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                style={{ width: `${isMuted ? 0 : volume * 100}%` }}
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (isMuted && parseFloat(e.target.value) > 0) {
                    toggleMute();
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg 
                opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${isMuted ? 0 : volume * 100}%`, marginLeft: '-4px' }}
              />
            </div>
            <span className="text-white/60 text-[10px] md:text-xs min-w-[28px]">
              {isMuted ? '0%' : Math.round(volume * 100)}%
            </span>
          </div>

          {/* Track Counter - Compact */}
          <span className="text-white/50 text-[10px] md:text-xs min-w-fit whitespace-nowrap">
            {currentIndex + 1}/{songs.length}
          </span>
        </div>
      </div>
    </div>
  );
}