import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  FaPlay, FaPause, FaStepBackward, FaStepForward,
  FaRandom, FaRedoAlt, FaVolumeUp, FaVolumeMute,
  FaChevronDown, FaEllipsisH, FaHeart, FaList, FaTimes,
} from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';

/* ─── constants ─────────────────────────────────────────────────── */
const FALLBACK_COLOR = '22, 163, 74';
const FALLBACK_COVER = 'https://placehold.co/400x400/0a0a0a/333?text=♪';
const COLOR_CACHE    = new Map();

/* ─── colour extraction ─────────────────────────────────────────── */
function extractDominantRGB(src) {
  return new Promise((resolve) => {
    if (COLOR_CACHE.has(src)) { resolve(COLOR_CACHE.get(src)); return; }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let bestR = 0, bestG = 0, bestB = 0, bestScore = -1;
        for (let i = 0; i < data.length; i += 48) {
          const r = data[i], g = data[i+1], b = data[i+2];
          const max = Math.max(r,g,b), min = Math.min(r,g,b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (r*0.299 + g*0.587 + b*0.114) / 255;
          const score = sat * 1.5 + (1 - Math.abs(lum - 0.45));
          if (score > bestScore) { bestScore = score; bestR = r; bestG = g; bestB = b; }
        }
        const max = Math.max(bestR,bestG,bestB), min = Math.min(bestR,bestG,bestB);
        const sat = max === 0 ? 0 : (max - min) / max;
        if (sat < 0.25 || max < 60) { resolve(FALLBACK_COLOR); return; }
        const result = `${bestR}, ${bestG}, ${bestB}`;
        COLOR_CACHE.set(src, result);
        resolve(result);
      } catch (_) { resolve(FALLBACK_COLOR); }
    };
    img.onerror = () => resolve(FALLBACK_COLOR);
    img.src = src;
  });
}

/* ─── time formatter ────────────────────────────────────────────── */
function fmt(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ─── safe percent ──────────────────────────────────────────────── */
function safePct(current, dur) {
  if (!dur || dur <= 0 || !isFinite(dur)) return 0;
  if (!current || current < 0) return 0;
  return Math.min(100, Math.max(0, (current / dur) * 100));
}

/* ─── ProgressBar ───────────────────────────────────────────────── */
const ProgressBar = memo(({ currentTime, duration, onSeek, showTimes = false, thick = false }) => {
  const barRef   = useRef(null);
  const dragging = useRef(false);
  const [hover, setHover]   = useState(false);
  const [localPct, setLocalPct] = useState(0);

  // Compute percent from props every render — this is what drives the fill
  const pct = safePct(currentTime, duration);

  // While dragging, use local override so scrubbing feels instant
  const displayPct = dragging.current ? localPct : pct;

  const calcFraction = useCallback((clientX) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const seek = useCallback((clientX) => {
    if (!duration || duration <= 0) return;
    const frac = calcFraction(clientX);
    setLocalPct(frac * 100);
    onSeek(frac * duration);
  }, [calcFraction, duration, onSeek]);

  const onDown = useCallback((e) => {
    dragging.current = true;
    seek(e.clientX);
  }, [seek]);

  const onTouchStart = useCallback((e) => {
    dragging.current = true;
    seek(e.touches[0].clientX);
  }, [seek]);

  useEffect(() => {
    const onMove  = (e) => { if (dragging.current) seek(e.clientX); };
    const onTouch = (e) => { if (dragging.current) seek(e.touches[0].clientX); };
    const onUp    = ()  => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend',  onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend',  onUp);
    };
  }, [seek]);

  return (
    <div>
      {showTimes && (
        <div className="pc-times">
          <span>{fmt(currentTime)}</span>
          <span>{duration > 0 ? fmt(duration) : '--:--'}</span>
        </div>
      )}
      <div
        ref={barRef}
        className={`pc-bar-track ${thick ? 'pc-bar-thick' : ''} ${hover ? 'pc-bar-hovered' : ''}`}
        onMouseDown={onDown}
        onTouchStart={onTouchStart}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        role="slider"
        aria-valuenow={Math.round(displayPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Track progress"
      >
        <div className="pc-bar-fill" style={{ width: `${displayPct}%` }} />
        {/* Thumb shown on hover or while dragging */}
        <div
          className="pc-bar-thumb"
          style={{
            left: `${displayPct}%`,
            opacity: hover || dragging.current ? 1 : 0,
          }}
        />
      </div>
    </div>
  );
});

/* ─── QueuePanel ────────────────────────────────────────────────── */
const QueuePanel = memo(({ songs, currentIndex, onSelect, onClose }) => (
  <div className="pc-queue">
    <div className="pc-queue-header">
      <span>Queue</span>
      <button onClick={onClose} className="pc-icon-btn"><FaTimes /></button>
    </div>
    <div className="pc-queue-list">
      {songs.map((song, idx) => (
        <div
          key={song.id || idx}
          className={`pc-queue-item ${idx === currentIndex ? 'active' : ''}`}
          onClick={() => onSelect(idx)}
        >
          <img src={song.cover || FALLBACK_COVER} alt={song.name} className="pc-queue-thumb"
            onError={e => { e.target.src = FALLBACK_COVER; }} />
          <div className="pc-queue-meta">
            <p className="pc-queue-name">{song.name}</p>
            <p className="pc-queue-artist">{song.artist}</p>
          </div>
          {idx === currentIndex && <div className="pc-queue-active-dot" />}
        </div>
      ))}
    </div>
  </div>
));

/* ─── RepeatBtn ─────────────────────────────────────────────────── */
const RepeatBtn = memo(({ mode, onToggle }) => (
  <button
    className={`pc-ctrl-btn ${mode !== 'off' ? 'active' : ''}`}
    onClick={onToggle}
    title={`Repeat: ${mode}`}
    aria-label={`Repeat mode: ${mode}`}
  >
    <FaRedoAlt />
    {mode === 'one' && <span className="pc-repeat-badge">1</span>}
  </button>
));

/* ─── VolumeSlider ──────────────────────────────────────────────── */
const VolumeSlider = memo(({ volume, isMuted, onVolume, onMute }) => (
  <div className="pc-volume">
    <button className="pc-icon-btn" onClick={onMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
      {isMuted || volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
    </button>
    <div className="pc-vol-track">
      <div className="pc-vol-fill" style={{ width: `${isMuted ? 0 : volume * 100}%` }} />
      <input
        type="range" min="0" max="1" step="0.01"
        value={isMuted ? 0 : volume}
        onChange={e => {
          const v = parseFloat(e.target.value);
          onVolume(v);
          if (isMuted && v > 0) onMute();
        }}
        className="pc-vol-input"
        aria-label="Volume"
      />
    </div>
    <span className="pc-vol-label">{isMuted ? '0' : Math.round(volume * 100)}</span>
  </div>
));

/* ─── CSS ───────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

.pc-root *, .pc-root *::before, .pc-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.pc-root { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }

/* ── tokens ── */
.pc-root, .pc-bar, .pc-expanded, .pc-mobile-bar, .pc-mob-expanded {
  --pc-green:       #1DB954;
  --pc-green-bright:#23E065;
  --pc-bg:          rgba(8,8,10,0.97);
  --pc-border:      rgba(255,255,255,0.07);
  --pc-text-1:      #FFFFFF;
  --pc-text-2:      rgba(255,255,255,0.5);
  --pc-text-3:      rgba(255,255,255,0.28);
}

/* ── empty ── */
.pc-empty {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
  height: 72px; display: flex; align-items: center; justify-content: center;
  background: var(--pc-bg); border-top: 1px solid var(--pc-border);
  backdrop-filter: blur(32px); color: var(--pc-text-3); font-size: 13px; letter-spacing: 0.04em;
}

/* ═══════════════════════════════════
   PROGRESS BAR — shared
═══════════════════════════════════ */
.pc-bar-track {
  position: relative; height: 3px; background: rgba(255,255,255,0.10);
  cursor: pointer; user-select: none;
  transition: height 0.15s ease;
}
.pc-bar-thick, .pc-bar-hovered { height: 5px; }

/* width uses linear so YT 250ms poll ticks animate smoothly */
.pc-bar-fill {
  height: 100%;
  background: linear-gradient(to right, rgba(var(--pc-accent, 22,163,74), 0.9), var(--pc-green));
  border-radius: inherit;
  transition: width 0.12s linear, background 0.8s ease;
  will-change: width;
  pointer-events: none;
}
.pc-bar-thumb {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 13px; height: 13px; border-radius: 50%;
  background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  transition: opacity 0.18s ease;
  pointer-events: none;
}
.pc-times {
  display: flex; justify-content: space-between;
  font-size: 11px; color: var(--pc-text-3); margin-bottom: 6px;
  font-variant-numeric: tabular-nums;
}

/* ═══════════════════════════════════
   COMPACT BAR
═══════════════════════════════════ */
.pc-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
  background: var(--pc-bg); border-top: 1px solid var(--pc-border);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
}
.pc-bar-accent-line {
  height: 2px;
  background: linear-gradient(to right,
    transparent, rgba(var(--pc-accent,22,163,74),0.75) 20%,
    rgba(var(--pc-accent,22,163,74),0.95) 50%,
    rgba(var(--pc-accent,22,163,74),0.75) 80%, transparent
  );
  transition: background 0.8s ease;
}

.pc-bar-inner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 24px; gap: 16px; max-width: 1600px; margin: 0 auto;
}

/* song info */
.pc-song-info { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; max-width: 300px; }
.pc-cover-wrap {
  position: relative; flex-shrink: 0; width: 50px; height: 50px;
  border-radius: 10px; overflow: hidden; cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  transition: transform 0.2s, box-shadow 0.2s;
}
.pc-cover-wrap:hover { transform: scale(1.06); box-shadow: 0 8px 24px rgba(0,0,0,0.6); }
.pc-cover-wrap img   { width: 100%; height: 100%; object-fit: cover; display: block; }
.pc-song-meta { flex: 1; min-width: 0; }
.pc-song-name {
  font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
  color: var(--pc-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  letter-spacing: -0.01em; margin-bottom: 1px;
}
.pc-song-artist { font-size: 11px; color: var(--pc-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-heart-btn {
  background: none; border: none; cursor: pointer;
  color: var(--pc-text-3); font-size: 13px;
  padding: 6px; border-radius: 50%; flex-shrink: 0;
  transition: color 0.2s, transform 0.15s;
}
.pc-heart-btn:hover { color: #FF4455; transform: scale(1.2); }
.pc-heart-btn.liked { color: #FF4455; }

/* controls center */
.pc-controls { display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0; }
.pc-ctrl-row  { display: flex; align-items: center; gap: 4px; }
.pc-ctrl-btn {
  background: none; border: none; cursor: pointer;
  color: var(--pc-text-2); font-size: 13px;
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s, transform 0.12s;
  position: relative;
}
.pc-ctrl-btn:hover  { color: var(--pc-text-1); background: rgba(255,255,255,0.08); }
.pc-ctrl-btn.active { color: var(--pc-green-bright); }
.pc-ctrl-btn:active { transform: scale(0.88); }

.pc-play-btn {
  width: 44px; height: 44px; border-radius: 50%;
  background: #fff; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #000; font-size: 15px; flex-shrink: 0;
  box-shadow: 0 4px 18px rgba(0,0,0,0.4);
  transition: transform 0.15s ease, box-shadow 0.15s, background 0.15s;
  position: relative; /* for buffer ring */
}
.pc-play-btn:hover  { transform: scale(1.08); background: var(--pc-green-bright); box-shadow: 0 8px 24px rgba(29,185,84,0.4); }
.pc-play-btn:active { transform: scale(0.92); }

.pc-repeat-badge {
  position: absolute; top: -3px; right: -3px;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--pc-green); color: #000;
  font-size: 8px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Syne', sans-serif;
}
.pc-time-row {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--pc-text-3);
  font-variant-numeric: tabular-nums;
}
.pc-time-sep { opacity: 0.35; }

/* right side */
.pc-right { display: flex; align-items: center; gap: 12px; flex: 1; justify-content: flex-end; max-width: 300px; }
.pc-icon-btn {
  background: none; border: none; cursor: pointer;
  color: var(--pc-text-2); font-size: 13px;
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.pc-icon-btn:hover { color: var(--pc-text-1); background: rgba(255,255,255,0.08); }

.pc-volume { display: flex; align-items: center; gap: 8px; min-width: 120px; }
.pc-vol-track {
  position: relative; flex: 1; height: 3px;
  background: rgba(255,255,255,0.10); border-radius: 2px; cursor: pointer;
  transition: height 0.15s;
}
.pc-vol-track:hover { height: 5px; }
.pc-vol-fill { height: 100%; background: #fff; border-radius: inherit; pointer-events: none; transition: width 0.05s linear; }
.pc-vol-input { position: absolute; inset: -8px 0; opacity: 0; cursor: pointer; width: 100%; }
.pc-vol-label { font-size: 11px; color: var(--pc-text-3); min-width: 26px; text-align: right; font-variant-numeric: tabular-nums; }
.pc-track-count { font-size: 11px; color: var(--pc-text-3); white-space: nowrap; }

/* ═══════════════════════════════════
   EXPANDED DESKTOP
═══════════════════════════════════ */
.pc-expanded {
  position: fixed; inset: 0; z-index: 50;
  display: flex; flex-direction: column; overflow: hidden;
}
.pc-expanded-bg {
  position: absolute; inset: 0;
  background: linear-gradient(170deg,
    rgba(var(--pc-accent,22,163,74),0.5) 0%,
    rgba(var(--pc-accent,22,163,74),0.18) 30%,
    #07080A 60%
  );
  transition: background 0.9s ease;
}
.pc-expanded-bg::after {
  content: ''; position: absolute; inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.032'/%3E%3C/svg%3E");
  background-size: 200px; mix-blend-mode: overlay; pointer-events: none;
}
.pc-exp-header {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(0,0,0,0.25); backdrop-filter: blur(20px);
}
.pc-exp-header-title { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--pc-text-2); font-weight: 500; }
.pc-exp-header-btns  { display: flex; align-items: center; gap: 8px; }

.pc-exp-body {
  position: relative; z-index: 2;
  display: flex; flex: 1; overflow: hidden;
  padding: 32px 40px 24px; gap: 48px;
}
.pc-art-col {
  display: flex; flex-direction: column; align-items: center;
  flex: 1; justify-content: center; gap: 24px;
}
.pc-art-frame { position: relative; }
.pc-art-glow {
  position: absolute; inset: -16px; border-radius: 28px;
  background: radial-gradient(circle, rgba(var(--pc-accent,22,163,74),0.35) 0%, transparent 70%);
  filter: blur(24px); transition: background 0.9s ease;
  animation: pcGlowPulse 3s ease-in-out infinite;
}
@keyframes pcGlowPulse { 0%,100%{opacity:0.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
.pc-art-img {
  position: relative; display: block;
  width: clamp(200px, 28vw, 320px); height: clamp(200px, 28vw, 320px);
  border-radius: 22px; object-fit: cover;
  box-shadow: 0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1);
  transition: transform 0.4s ease;
}
.pc-art-img:hover { transform: scale(1.02); }
.pc-art-img.playing { animation: pcArtFloat 6s ease-in-out infinite; }
@keyframes pcArtFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }

.pc-exp-meta { text-align: center; }
.pc-exp-song-name {
  font-family: 'Syne', sans-serif;
  font-size: clamp(20px, 2.8vw, 34px); font-weight: 800;
  letter-spacing: -0.03em; color: #fff; margin-bottom: 5px; line-height: 1.1;
}
.pc-exp-artist { font-size: 15px; color: var(--pc-text-2); }
.pc-exp-progress { width: 100%; max-width: 400px; }

.pc-exp-ctrl-row { display: flex; align-items: center; gap: 10px; }
.pc-exp-ctrl-btn {
  background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,0.55); font-size: 17px;
  width: 46px; height: 46px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s, transform 0.12s; position: relative;
}
.pc-exp-ctrl-btn:hover  { color: #fff; background: rgba(255,255,255,0.08); }
.pc-exp-ctrl-btn.active { color: var(--pc-green-bright); }
.pc-exp-ctrl-btn:active { transform: scale(0.88); }

.pc-exp-play-btn {
  width: 66px; height: 66px; border-radius: 50%;
  background: #fff; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #000; font-size: 22px; position: relative;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
}
.pc-exp-play-btn:hover  { transform: scale(1.07); background: var(--pc-green-bright); box-shadow: 0 12px 48px rgba(29,185,84,0.4); }
.pc-exp-play-btn:active { transform: scale(0.93); }
.pc-exp-bottom { display: flex; align-items: center; justify-content: space-between; padding-top: 6px; }

/* queue */
.pc-queue {
  width: 320px; flex-shrink: 0;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px; display: flex; flex-direction: column; overflow: hidden;
  animation: pcSlideIn 0.28s cubic-bezier(0.22,1,0.36,1);
}
@keyframes pcSlideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
.pc-queue-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px 12px; border-bottom: 1px solid rgba(255,255,255,0.07);
  font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; color: #fff;
}
.pc-queue-list  { flex: 1; overflow-y: auto; padding: 8px; }
.pc-queue-item  { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 10px; cursor: pointer; transition: background 0.12s; }
.pc-queue-item:hover  { background: rgba(255,255,255,0.06); }
.pc-queue-item.active { background: rgba(29,185,84,0.12); }
.pc-queue-thumb  { width: 38px; height: 38px; border-radius: 7px; object-fit: cover; flex-shrink: 0; }
.pc-queue-meta   { flex: 1; min-width: 0; }
.pc-queue-name   { font-size: 12px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-queue-artist { font-size: 10px; color: var(--pc-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-queue-active-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pc-green); flex-shrink: 0; }

/* buffering ring */
@keyframes pcBufSpin { to { transform: rotate(360deg); } }
.pc-buffer-ring {
  position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid transparent; border-top-color: var(--pc-green);
  animation: pcBufSpin 0.7s linear infinite; pointer-events: none;
}

/* ═══════════════════════════════════
   MOBILE MINI BAR
═══════════════════════════════════ */
.pc-mobile-bar {
  position: fixed; left: 8px; right: 8px; z-index: 40;
  background: rgba(12,14,16,0.96);
  border: 1px solid rgba(255,255,255,0.09); border-radius: 18px;
  backdrop-filter: blur(32px);
  box-shadow: 0 -4px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(var(--pc-accent,22,163,74),0.08);
  overflow: hidden;
  transition: opacity 0.25s, transform 0.25s;
}
.pc-mobile-bar.hidden { opacity: 0; transform: translateY(8px); pointer-events: none; }

.pc-mobile-progress { height: 2px; background: rgba(255,255,255,0.08); position: relative; }
.pc-mobile-progress-fill {
  height: 100%;
  background: linear-gradient(to right, rgba(var(--pc-accent,22,163,74),0.85), var(--pc-green));
  transition: width 0.12s linear, background 0.8s ease;
  will-change: width;
}
.pc-mobile-inner  { display: flex; align-items: center; gap: 12px; padding: 10px 14px; }
.pc-mobile-cover  { width: 44px; height: 44px; flex-shrink: 0; border-radius: 10px; overflow: hidden; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.4); }
.pc-mobile-cover img { width: 100%; height: 100%; object-fit: cover; }
.pc-mobile-meta   { flex: 1; min-width: 0; }
.pc-mobile-name   { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; }
.pc-mobile-artist { font-size: 11px; color: var(--pc-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-mobile-btns   { display: flex; align-items: center; gap: 4px; }
.pc-mobile-play {
  width: 40px; height: 40px; border-radius: 50%;
  background: #fff; border: none; cursor: pointer; color: #000; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.35); flex-shrink: 0;
  transition: transform 0.14s, background 0.14s; position: relative;
}
.pc-mobile-play:hover  { background: var(--pc-green-bright); transform: scale(1.06); }
.pc-mobile-play:active { transform: scale(0.9); }
.pc-mobile-next {
  background: none; border: none; cursor: pointer; color: var(--pc-text-2); font-size: 15px;
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; transition: color 0.13s;
}
.pc-mobile-next:hover { color: #fff; }

/* ═══════════════════════════════════
   MOBILE EXPANDED
═══════════════════════════════════ */
.pc-mob-expanded {
  position: fixed; inset: 0; z-index: 50;
  display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden;
}
.pc-mob-exp-bg {
  position: absolute; inset: 0;
  background: linear-gradient(180deg,
    rgba(var(--pc-accent,22,163,74),0.55) 0%,
    rgba(var(--pc-accent,22,163,74),0.15) 35%,
    #07080A 65%
  );
  transition: background 0.9s ease;
}
.pc-mob-exp-bg::after {
  content: ''; position: absolute; inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  background-size: 200px; mix-blend-mode: overlay; pointer-events: none;
}
.pc-mob-header {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.07);
}
.pc-mob-header-label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--pc-text-3); }
.pc-mob-body { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; padding: 24px 24px 32px; flex: 1; }
.pc-mob-art-wrap  { position: relative; margin-bottom: 28px; }
.pc-mob-art-glow  { position: absolute; inset: -12px; border-radius: 26px; background: radial-gradient(circle,rgba(var(--pc-accent,22,163,74),0.4) 0%,transparent 70%); filter: blur(20px); animation: pcGlowPulse 3s ease-in-out infinite; }
.pc-mob-art       { display: block; width: min(72vw,280px); height: min(72vw,280px); border-radius: 20px; object-fit: cover; box-shadow: 0 32px 80px rgba(0,0,0,0.65); position: relative; }
.pc-mob-art.playing { animation: pcArtFloat 6s ease-in-out infinite; }
.pc-mob-meta      { text-align: center; width: 100%; padding: 0 8px; margin-bottom: 20px; }
.pc-mob-name      { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.03em; margin-bottom: 4px; }
.pc-mob-artist    { font-size: 14px; color: var(--pc-text-2); }
.pc-mob-progress  { width: 100%; margin-bottom: 24px; }
.pc-mob-ctrl-row  { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-bottom: 20px; }
.pc-mob-ctrl-btn  { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.5); font-size: 18px; width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.15s, transform 0.12s; position: relative; }
.pc-mob-ctrl-btn:active { transform: scale(0.88); }
.pc-mob-ctrl-btn.active { color: var(--pc-green-bright); }
.pc-mob-play-btn  { width: 64px; height: 64px; border-radius: 50%; background: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #000; font-size: 21px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); transition: transform 0.15s, background 0.15s; position: relative; }
.pc-mob-play-btn:active { transform: scale(0.92); }
.pc-mob-extras    { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 8px; }
.pc-mob-vol       { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--pc-text-2); cursor: pointer; background: none; border: none; }
.pc-mob-count     { font-size: 12px; color: var(--pc-text-3); }
.pc-mob-queue     { margin-top: 16px; width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; max-height: 280px; overflow-y: auto; }
.pc-mob-queue-title { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 10px; }

/* show/hide by breakpoint */
@media (max-width: 767px)  { .pc-desktop-bar { display: none !important; } }
@media (min-width: 768px)  { .pc-mobile-bar, .pc-mob-expanded { display: none !important; } }
`;

/* ─── main component ────────────────────────────────────────────── */
export default function PlayerControls() {
  const {
    currentSong, isPlaying, setIsPlaying,
    songs, currentIndex, setCurrentIndex,
    volume, setVolume, isMuted, toggleMute,
    currentTime, duration,
    seekTo, playNext, playPrev,
    shuffle, toggleShuffle,
    repeatMode, toggleRepeatMode,
    showBackgroundDetail, setShowBackgroundDetail,
    isBuffering,
  } = usePlayer();

  const [accentRGB, setAccentRGB] = useState(FALLBACK_COLOR);
  const [showQueue, setShowQueue] = useState(false);
  const [liked,     setLiked]     = useState(false);
  const prevCoverRef = useRef(null);

  /* Extract accent colour from album art */
  useEffect(() => {
    const cover = currentSong?.cover;
    if (!cover || cover === prevCoverRef.current) return;
    prevCoverRef.current = cover;
    extractDominantRGB(cover).then(setAccentRGB);
  }, [currentSong?.cover]);

  /* Reset liked when song changes */
  useEffect(() => { setLiked(false); }, [currentIndex]);

  /* Stable callbacks */
  const handleSeek = useCallback((t) => seekTo(t), [seekTo]);
  const togglePlay = useCallback(() => setIsPlaying(p => !p), [setIsPlaying]);

  /* Accent CSS variable injected on root element */
  const accentStyle = { '--pc-accent': accentRGB };

  /* ── empty state ── */
  if (!currentSong) {
    return (
      <>
        <style>{CSS}</style>
        <div className="pc-root pc-empty" style={accentStyle}>No song playing</div>
      </>
    );
  }

  /* ── desktop expanded view ── */
  const desktopExpanded = showBackgroundDetail && (
    <div className="pc-expanded pc-desktop-bar" style={accentStyle}>
      <div className="pc-expanded-bg" />
      <div className="pc-exp-header">
        <button className="pc-icon-btn" onClick={() => setShowBackgroundDetail(false)}>
          <FaChevronDown style={{ fontSize: 17 }} />
        </button>
        <span className="pc-exp-header-title">Now Playing</span>
        <div className="pc-exp-header-btns">
          <button className={`pc-icon-btn pc-heart-btn ${liked ? 'liked' : ''}`} onClick={() => setLiked(l => !l)}>
            <FaHeart />
          </button>
          <button
            className="pc-icon-btn"
            style={{ color: showQueue ? 'var(--pc-green-bright)' : undefined }}
            onClick={() => setShowQueue(q => !q)}
          >
            <FaList />
          </button>
          <button className="pc-icon-btn"><FaEllipsisH /></button>
        </div>
      </div>

      <div className="pc-exp-body">
        <div className="pc-art-col">
          {/* Art */}
          <div className="pc-art-frame">
            <div className="pc-art-glow" />
            <img
              src={currentSong.cover || FALLBACK_COVER}
              alt={currentSong.name}
              className={`pc-art-img ${isPlaying ? 'playing' : ''}`}
              onError={e => { e.target.src = FALLBACK_COVER; }}
            />
          </div>

          {/* Meta */}
          <div className="pc-exp-meta">
            <h2 className="pc-exp-song-name">{currentSong.name}</h2>
            <p className="pc-exp-artist">{currentSong.artist}</p>
          </div>

          {/* Progress */}
          <div className="pc-exp-progress">
            <ProgressBar currentTime={currentTime} duration={duration} onSeek={handleSeek} showTimes thick />
          </div>

          {/* Controls */}
          <div className="pc-exp-ctrl-row">
            <button className={`pc-exp-ctrl-btn ${shuffle ? 'active' : ''}`} onClick={toggleShuffle} aria-label="Shuffle">
              <FaRandom />
            </button>
            <button className="pc-exp-ctrl-btn" onClick={playPrev} aria-label="Previous">
              <FaStepBackward style={{ fontSize: 20 }} />
            </button>
            <button className="pc-exp-play-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isBuffering
                ? <div className="pc-buffer-ring" />
                : isPlaying
                  ? <FaPause />
                  : <FaPlay style={{ marginLeft: 3 }} />
              }
            </button>
            <button className="pc-exp-ctrl-btn" onClick={playNext} aria-label="Next">
              <FaStepForward style={{ fontSize: 20 }} />
            </button>
            <RepeatBtn mode={repeatMode} onToggle={toggleRepeatMode} />
          </div>

          <div className="pc-exp-bottom">
            <VolumeSlider volume={volume} isMuted={isMuted} onVolume={setVolume} onMute={toggleMute} />
            <span className="pc-track-count" style={{ marginLeft: 16 }}>{currentIndex + 1} / {songs.length}</span>
          </div>
        </div>

        {showQueue && (
          <QueuePanel songs={songs} currentIndex={currentIndex} onSelect={setCurrentIndex} onClose={() => setShowQueue(false)} />
        )}
      </div>
    </div>
  );

  /* ── desktop compact bar ── */
  const desktopBar = !showBackgroundDetail && (
    <div className="pc-bar pc-desktop-bar" style={accentStyle}>
      <div className="pc-bar-accent-line" />
      {/* Full-width progress bar sits above the inner layout */}
      <ProgressBar currentTime={currentTime} duration={duration} onSeek={handleSeek} />

      <div className="pc-bar-inner">
        {/* Left — song info */}
        <div className="pc-song-info">
          <div className="pc-cover-wrap" onClick={() => setShowBackgroundDetail(true)}>
            <img
              src={currentSong.cover || FALLBACK_COVER}
              alt={currentSong.name}
              onError={e => { e.target.src = FALLBACK_COVER; }}
            />
            {isBuffering && <div className="pc-buffer-ring" />}
          </div>
          <div className="pc-song-meta">
            <div className="pc-song-name">{currentSong.name}</div>
            <div className="pc-song-artist">{currentSong.artist}</div>
          </div>
          <button className={`pc-heart-btn ${liked ? 'liked' : ''}`} onClick={() => setLiked(l => !l)} aria-label="Like">
            <FaHeart />
          </button>
        </div>

        {/* Center — transport */}
        <div className="pc-controls">
          <div className="pc-ctrl-row">
            <button className={`pc-ctrl-btn ${shuffle ? 'active' : ''}`} onClick={toggleShuffle} title="Shuffle">
              <FaRandom />
            </button>
            <button className="pc-ctrl-btn" onClick={playPrev} title="Previous" style={{ fontSize: 15 }}>
              <FaStepBackward />
            </button>
            <button className="pc-play-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isBuffering
                ? <div className="pc-buffer-ring" />
                : isPlaying
                  ? <FaPause />
                  : <FaPlay style={{ marginLeft: 2 }} />
              }
            </button>
            <button className="pc-ctrl-btn" onClick={playNext} title="Next" style={{ fontSize: 15 }}>
              <FaStepForward />
            </button>
            <RepeatBtn mode={repeatMode} onToggle={toggleRepeatMode} />
          </div>
          {/* Time display — always rendered, shows '--:--' while waiting for duration */}
          <div className="pc-time-row">
            <span>{fmt(currentTime)}</span>
            <span className="pc-time-sep">·</span>
            <span>{duration > 0 ? fmt(duration) : '--:--'}</span>
          </div>
        </div>

        {/* Right — volume + extras */}
        <div className="pc-right">
          <VolumeSlider volume={volume} isMuted={isMuted} onVolume={setVolume} onMute={toggleMute} />
          <span className="pc-track-count">{currentIndex + 1} / {songs.length}</span>
          <button className="pc-icon-btn" onClick={() => setShowBackgroundDetail(true)} title="Expand">
            <FaChevronDown style={{ transform: 'rotate(180deg)', fontSize: 11 }} />
          </button>
        </div>
      </div>
    </div>
  );

  /* ── mobile mini bar ── */
  const mobilePct = safePct(currentTime, duration);
  const mobileMini = (
    <div
      className={`pc-mobile-bar ${showBackgroundDetail ? 'hidden' : ''}`}
      style={{ ...accentStyle, bottom: '80px' }}
    >
      <div className="pc-mobile-progress">
        <div className="pc-mobile-progress-fill" style={{ width: `${mobilePct}%` }} />
      </div>
      <div className="pc-mobile-inner" onClick={() => setShowBackgroundDetail(true)}>
        <div className="pc-mobile-cover" onClick={e => { e.stopPropagation(); setShowBackgroundDetail(true); }}>
          <img src={currentSong.cover || FALLBACK_COVER} alt={currentSong.name} onError={e => { e.target.src = FALLBACK_COVER; }} />
        </div>
        <div className="pc-mobile-meta">
          <div className="pc-mobile-name">{currentSong.name}</div>
          <div className="pc-mobile-artist">{currentSong.artist}</div>
        </div>
        <div className="pc-mobile-btns">
          <button
            className="pc-mobile-play"
            onClick={e => { e.stopPropagation(); togglePlay(); }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isBuffering
              ? <div className="pc-buffer-ring" />
              : isPlaying ? <FaPause /> : <FaPlay style={{ marginLeft: 2 }} />
            }
          </button>
          <button
            className="pc-mobile-next"
            onClick={e => { e.stopPropagation(); playNext(); }}
            aria-label="Next"
          >
            <FaStepForward />
          </button>
        </div>
      </div>
    </div>
  );

  /* ── mobile expanded ── */
  const mobileExpanded = showBackgroundDetail && (
    <div className="pc-mob-expanded" style={accentStyle}>
      <div className="pc-mob-exp-bg" />
      <div className="pc-mob-header">
        <button className="pc-icon-btn" onClick={() => setShowBackgroundDetail(false)}>
          <FaChevronDown style={{ fontSize: 17 }} />
        </button>
        <span className="pc-mob-header-label">Now Playing</span>
        <button className="pc-icon-btn"><FaEllipsisH /></button>
      </div>

      <div className="pc-mob-body">
        <div className="pc-mob-art-wrap">
          <div className="pc-mob-art-glow" />
          <img
            src={currentSong.cover || FALLBACK_COVER}
            alt={currentSong.name}
            className={`pc-mob-art ${isPlaying ? 'playing' : ''}`}
            onError={e => { e.target.src = FALLBACK_COVER; }}
          />
        </div>

        <div className="pc-mob-meta">
          <div className="pc-mob-name">{currentSong.name}</div>
          <div className="pc-mob-artist">{currentSong.artist}</div>
        </div>

        <div className="pc-mob-progress">
          <ProgressBar currentTime={currentTime} duration={duration} onSeek={handleSeek} showTimes thick />
        </div>

        <div className="pc-mob-ctrl-row">
          <button className={`pc-mob-ctrl-btn ${shuffle ? 'active' : ''}`} onClick={toggleShuffle}><FaRandom /></button>
          <button className="pc-mob-ctrl-btn" onClick={playPrev} style={{ fontSize: 20 }}><FaStepBackward /></button>
          <button className="pc-mob-play-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isBuffering
              ? <div className="pc-buffer-ring" />
              : isPlaying ? <FaPause /> : <FaPlay style={{ marginLeft: 3 }} />
            }
          </button>
          <button className="pc-mob-ctrl-btn" onClick={playNext} style={{ fontSize: 20 }}><FaStepForward /></button>
          <button
            className={`pc-mob-ctrl-btn ${repeatMode !== 'off' ? 'active' : ''}`}
            onClick={toggleRepeatMode}
            style={{ position: 'relative' }}
          >
            <FaRedoAlt />
            {repeatMode === 'one' && <span className="pc-repeat-badge">1</span>}
          </button>
        </div>

        <div className="pc-mob-extras">
          <button className="pc-mob-vol" onClick={toggleMute}>
            {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
            <span style={{ marginLeft: 6 }}>{isMuted ? '0' : Math.round(volume * 100)}%</span>
          </button>
          <span className="pc-mob-count">{currentIndex + 1} / {songs.length}</span>
          <button
            className="pc-icon-btn"
            style={{ color: showQueue ? 'var(--pc-green-bright)' : undefined }}
            onClick={() => setShowQueue(q => !q)}
          >
            <FaList />
          </button>
        </div>

        {showQueue && (
          <div className="pc-mob-queue">
            <div className="pc-mob-queue-title">Queue</div>
            {songs.map((song, idx) => (
              <div
                key={song.id || idx}
                className={`pc-queue-item ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(idx)}
              >
                <img src={song.cover || FALLBACK_COVER} alt={song.name} className="pc-queue-thumb"
                  onError={e => { e.target.src = FALLBACK_COVER; }} />
                <div className="pc-queue-meta">
                  <p className="pc-queue-name">{song.name}</p>
                  <p className="pc-queue-artist">{song.artist}</p>
                </div>
                {idx === currentIndex && <div className="pc-queue-active-dot" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="pc-root">
      <style>{CSS}</style>
      {desktopExpanded}
      {desktopBar}
      {mobileMini}
      {mobileExpanded}
    </div>
  );
}