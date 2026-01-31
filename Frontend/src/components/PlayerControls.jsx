import React from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function PlayerControls() {
  const {
    songs,
    currentIndex,
    setCurrentIndex,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    currentTime,
    duration,
    audioRef,
    shuffle,
    setShuffle,
    repeatMode,
    setRepeatMode
  } = usePlayer();

  function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + s.toString().padStart(2, '0');
  }

  return (
    <div className="playControls w-[95%] h-auto md:h-[80px] flex flex-col md:flex-row items-center justify-start px-3 bg-white/20 backdrop-blur-[20px] mt-8 rounded-[30px] gap-3 z-[1100]">
      <div className="w-full flex items-center gap-3 md:gap-6">
        {/* Song Cover */}
        <img
          src={songs[currentIndex]?.cover}
          alt={songs[currentIndex]?.name}
          className="w-10 h-10 md:w-[100px] md:h-[70px] rounded-[12px] md:rounded-[30px] object-cover shadow-md border border-white/20 flex-shrink-0"
        />
        {/* Song Info */}
        <div className="flex-1 min-w-0 md:min-w-[180px] md:max-w-[220px]">
          <div className="marquee-container">
            <span className="marquee-text text-white text-sm md:text-base font-semibold">{songs[currentIndex]?.name || 'No Song'}</span>
          </div>
          <div className="text-white/70 text-xs truncate mt-1 md:mt-0">{songs[currentIndex]?.artist || 'Artist Name'}<span className="text-white/40 text-xs ml-1">{songs[currentIndex]?.featuring ? `ft. ${songs[currentIndex].featuring}` : ''}</span></div>
        </div>
      </div>
      {/* Progress Bar */}
      <div className="w-full flex flex-col md:flex-1 md:mx-6 mt-2 md:mt-0">
        <div className="flex items-center justify-between text-white/60 text-xs mb-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div
          className="w-full h-2 bg-white/10 rounded-full relative cursor-pointer group"
          style={{ userSelect: 'none' }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            if (audioRef && audioRef.current && duration) {
              audioRef.current.currentTime = percent * duration;
            }
          }}
        >
          <div
            className="h-2 bg-emerald-400 rounded-full"
            style={{ width: `${((currentTime || 0) / (duration || 1)) * 100}%` }}
          ></div>
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `calc(${((currentTime || 0) / (duration || 1)) * 100}% - 8px)` }}
          >
            <div className="w-4 h-4 bg-emerald-400 border-2 border-white/80 rounded-full shadow-md cursor-pointer transition group-hover:scale-110"></div>
          </div>
        </div>
      </div>
      {/* Controls */}
      <div className="w-full flex items-center justify-center md:justify-start gap-3 z-2 mt-2 md:mt-0">
        {/* Shuffle */}
        <button
          className={`w-8 h-8 flex items-center justify-center rounded-full transition ${shuffle ? 'bg-emerald-500/30' : ''}`}
          title="Shuffle"
          onClick={() => setShuffle(s => !s)}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16M4 20l16-16" /></svg>
        </button>
        {/* Back */}
        <button
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-emerald-500/30 transition"
          title="Previous"
          onClick={() => {
            if (currentIndex > 0) {
              setCurrentIndex(currentIndex - 1);
              setIsPlaying(true);
            }
          }}
          disabled={currentIndex === 0}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        {/* Play/Pause */}
        <button
          className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 transition shadow-lg"
          title={isPlaying ? 'Pause' : 'Play'}
          onClick={() => setIsPlaying(p => !p)}
          disabled={songs.length === 0}
        >
          {isPlaying ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
        {/* Forward */}
        <button
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-emerald-500/30 transition"
          title="Next"
          onClick={() => {
            if (currentIndex < songs.length - 1) {
              setCurrentIndex(currentIndex + 1);
              setIsPlaying(true);
            }
          }}
          disabled={currentIndex === songs.length - 1}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {/* Repeat */}
        <button
          className={`w-8 h-8 flex items-center justify-center rounded-full transition ${repeatMode !== 'off' ? 'bg-emerald-500/30' : ''}`}
          title={repeatMode === 'one' ? 'Repeat One' : repeatMode === 'all' ? 'Repeat All' : 'Repeat Off'}
          onClick={() => {
            setRepeatMode(m => {
              if (m === 'off') return 'all';
              if (m === 'all') return 'one';
              return 'off';
            });
          }}
        >
          {repeatMode === 'one' ? (
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <text x="12" y="16" textAnchor="middle" fontSize="10" fill="currentColor">1</text>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4M3 11v-1a4 4 0 014-4h14" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 23l-4-4 4-4m14-2v1a4 4 0 01-4 4H3" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4M3 11v-1a4 4 0 014-4h14" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 23l-4-4 4-4m14-2v1a4 4 0 01-4 4H3" />
            </svg>
          )}
        </button>
        {/* Volume */}
        <div className="relative ml-4 md:ml-4">
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-emerald-500/30 transition"
            title="Volume"
            onClick={() => setVolume(v => !v)}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19 12c0-2.21-1.79-4-4-4m0 8c2.21 0 4-1.79 4-4z" />
            </svg>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="w-20 h-6 accent-emerald-900 ml-2 hidden md:inline-block"
          />
          <span className="text-s text-emerald-800 mb-[4px] text-center w-full font-bold hidden md:inline-block">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
