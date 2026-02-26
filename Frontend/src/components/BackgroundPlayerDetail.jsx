import React, { useEffect, useState } from 'react';
import { FaPlay, FaPause, FaStepBackward, FaStepForward, FaRandom, FaRedoAlt, FaTimes } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';

export default function BackgroundPlayerDetail() {
  const {
    currentSong,
    isPlaying,
    setIsPlaying,
    playNext,
    playPrev,
    currentTime,
    duration,
    audioRef,
    setShowBackgroundDetail,
  } = usePlayer();

  const [dominantColor, setDominantColor] = useState('rgba(16,185,129,0.5)');

  useEffect(() => {
    if (!currentSong?.cover) return;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = currentSong.cover;
    img.onload = () => {
      // Simple color extraction (average)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
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
      setDominantColor(`rgba(${r},${g},${b},0.6)`);
    };
  }, [currentSong]);

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!currentSong) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Heavy blur background layers */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-transparent to-purple-900/40" />
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 50%, ${dominantColor} 0%, transparent 70%)` }} />

      {/* Content */}
      <div className="relative w-full max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => setShowBackgroundDetail(false)}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 transition"
        >
          <FaTimes className="text-white mx-auto" />
        </button>

        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* Cover with extreme glow */}
          <div className="relative group w-64 h-64 md:w-80 md:h-80">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-3xl blur-3xl opacity-70 group-hover:opacity-90 transition" />
            <img
              src={currentSong.cover}
              alt={currentSong.name}
              className="relative w-full h-full rounded-3xl object-cover shadow-2xl border-2 border-white/20 backdrop-blur-sm"
            />
          </div>

          {/* Info and controls */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-white text-4xl md:text-6xl font-black mb-2 tracking-tight drop-shadow-lg">
              {currentSong.name}
            </h2>
            <p className="text-white/70 text-xl md:text-2xl mb-6 drop-shadow">
              {currentSong.artist}
            </p>

            {/* Progress bar */}
            <div className="w-full mb-6">
              <div className="flex justify-between text-white/60 text-sm mb-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full backdrop-blur-sm overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-100" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center md:justify-start gap-6">
              <button onClick={() => setIsPlaying(!isPlaying)} className="w-20 h-20 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-2xl hover:shadow-emerald-500/50 transform hover:scale-105 transition flex items-center justify-center">
                {isPlaying ? <FaPause className="text-3xl" /> : <FaPlay className="text-3xl ml-1" />}
              </button>
              <button onClick={playPrev} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 transition text-white/80 hover:text-white">
                <FaStepBackward className="text-xl mx-auto" />
              </button>
              <button onClick={playNext} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 transition text-white/80 hover:text-white">
                <FaStepForward className="text-xl mx-auto" />
              </button>
              <button className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 transition text-white/80 hover:text-white">
                <FaRandom className="text-xl mx-auto" />
              </button>
              <button className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 transition text-white/80 hover:text-white">
                <FaRedoAlt className="text-xl mx-auto" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}