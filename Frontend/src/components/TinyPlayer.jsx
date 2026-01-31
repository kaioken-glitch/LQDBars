import React from 'react';
import { FaPlay, FaPause, FaStepBackward, FaStepForward, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';

export default function TinyPlayer({
  song,
  isPlaying,
  onPlayPause,
  onPrev,
  onNext,
  isMuted,
  onMuteToggle
}) {
  return (
    <div className="fixed bottom-[79px] left-1/2 -translate-x-1/2 z-40">
      <div className="tiny-player flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-900/90 to-teal-900/90 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl w-fit">
        {/* Cover Art */}
        <img
          src={song?.cover || 'https://placehold.co/60x60/EEE/31343C'}
          alt={song?.name || 'cover'}
          className="w-10 h-10 object-cover border border-white/20 rounded-full flex-shrink-0"
        />
        
        {/* Song Info */}
        <div className="flex flex-col min-w-0 max-w-[100px]">
          <span className="text-white text-xs font-semibold truncate leading-tight">
            {song?.name || 'No Song'}
          </span>
          <span className="text-white/60 text-[10px] truncate leading-tight">
            {song?.artist || 'Unknown Artist'}
          </span>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 transition"
            title="Previous"
            onClick={onPrev}
          >
            <FaStepBackward className="text-white/90 text-sm" />
          </button>
          
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 transition shadow-lg"
            title={isPlaying ? 'Pause' : 'Play'}
            onClick={onPlayPause}
          >
            {isPlaying ? (
              <FaPause className="text-white text-sm" />
            ) : (
              <FaPlay className="text-white text-sm ml-0.5" />
            )}
          </button>
          
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 transition"
            title="Next"
            onClick={onNext}
          >
            <FaStepForward className="text-white/90 text-sm" />
          </button>
          
          {/* Mute Button */}
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 transition ml-0.5"
            title={isMuted ? 'Unmute' : 'Mute'}
            onClick={onMuteToggle}
          >
            {isMuted ? (
              <FaVolumeMute className="text-white/90 text-sm" />
            ) : (
              <FaVolumeUp className="text-white/90 text-sm" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
