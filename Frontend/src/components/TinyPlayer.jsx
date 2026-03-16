/**
 * TinyPlayer.jsx — Mini player pill, matches the mobile mini bar design.
 * Rounded pill card: accent progress line on top, cover + meta + controls.
 * Accent color extracted from album art. Scoped CSS only.
 */

import React, { useEffect, useRef } from 'react';
import {
  FaPlay, FaPause,
  FaStepBackward, FaStepForward,
  FaVolumeMute, FaVolumeUp,
} from 'react-icons/fa';

/* ── Wave icon (matches PlayerControls WaveIcon) ── */
function WaveIcon() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
      {[
        { x: 0,  ys: [6, 2, 10], dur: '0.6s',  delay: '0s'    },
        { x: 3,  ys: [9, 1, 11], dur: '0.75s', delay: '0.1s'  },
        { x: 6,  ys: [4, 0, 12], dur: '0.5s',  delay: '0.05s' },
        { x: 9,  ys: [7, 3, 11], dur: '0.65s', delay: '0.15s' },
        { x: 12, ys: [5, 1, 10], dur: '0.55s', delay: '0.08s' },
      ].map((b, i) => (
        <rect key={i} x={b.x} y={b.ys[0]} width="2" height={12 - b.ys[0]} rx="1" fill="#1DB954">
          <animate attributeName="y"   values={`${b.ys[0]};${b.ys[1]};${b.ys[2]};${b.ys[0]}`} dur={b.dur} repeatCount="indefinite" begin={b.delay} />
          <animate attributeName="height" values={`${12-b.ys[0]};${12-b.ys[1]};${12-b.ys[2]};${12-b.ys[0]}`} dur={b.dur} repeatCount="indefinite" begin={b.delay} />
        </rect>
      ))}
    </svg>
  );
}

/* ── CSS ── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500;600&display=swap');

.tp-root *, .tp-root *::before, .tp-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

.tp-root {
  --tp-green:   #1DB954;
  --tp-green2:  #23E065;
  --tp-accent:  29, 185, 84;
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
  display: block;
  width: 100%;
}

/* ── The pill — mirrors .pc-mobile-bar ── */
.tp-pill {
  position: relative;
  background: rgba(12,14,18,0.96);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 18px;
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  box-shadow: 0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);
  overflow: hidden;
  animation: tp-arrive 0.4s cubic-bezier(0.22,1,0.36,1) both;
}
@keyframes tp-arrive {
  from { opacity: 0; transform: translateY(6px) scale(0.97); }
  to   { opacity: 1; transform: none; }
}

/* Progress line — mirrors .pc-mobile-progress */
.tp-progress-track {
  height: 2px;
  background: rgba(255,255,255,0.07);
  cursor: pointer;
}
.tp-progress-fill {
  height: 100%;
  background: linear-gradient(to right, rgba(var(--tp-accent),0.85), var(--tp-green));
  transition: width 0.1s linear;
  will-change: width;
  border-radius: inherit;
}

/* Inner row */
.tp-inner {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 12px;
}

/* Cover — circular, matches mobile mini bar */
.tp-cover-wrap {
  flex-shrink: 0;
  width: 44px; height: 44px;
  border-radius: 11px;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(0,0,0,0.45);
  position: relative;
}
.tp-cover-wrap img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
/* Spinning ring when playing */
.tp-cover-wrap::after {
  content: '';
  position: absolute; inset: 0;
  border-radius: 11px;
  background: conic-gradient(transparent 0deg, rgba(29,185,84,0.2) 90deg, transparent 180deg, transparent 360deg);
  animation: tp-spin 3s linear infinite;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}
.tp-root.tp-playing .tp-cover-wrap::after { opacity: 1; }
@keyframes tp-spin { to { transform: rotate(360deg); } }

/* Meta */
.tp-meta {
  flex: 1;
  min-width: 0;
}
.tp-name {
  font-family: 'Syne', sans-serif;
  font-size: 13px; font-weight: 700;
  color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  letter-spacing: -0.01em;
  margin-bottom: 2px;
}
.tp-artist {
  font-size: 11px;
  color: rgba(255,255,255,0.45);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Wave indicator */
.tp-wave {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.tp-root:not(.tp-playing) .tp-wave { display: none; }

/* Controls */
.tp-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.tp-btn {
  width: 34px; height: 34px;
  border-radius: 50%;
  background: none; border: none;
  color: rgba(255,255,255,0.55);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  font-size: 14px;
  transition: color 0.15s, background 0.15s, transform 0.12s cubic-bezier(0.34,1.56,0.64,1);
}
.tp-btn:hover  { color: #fff; background: rgba(255,255,255,0.08); }
.tp-btn:active { transform: scale(0.85); }

/* Play/pause — white circle, matches .pc-mobile-play */
.tp-btn-play {
  width: 40px; height: 40px;
  background: #fff;
  color: #000;
  box-shadow: 0 3px 14px rgba(0,0,0,0.35);
  transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1), background 0.15s, box-shadow 0.15s;
}
.tp-btn-play:hover  { background: var(--tp-green2); transform: scale(1.07); }
.tp-btn-play:active { transform: scale(0.91); }

/* Mute btn dim when muted */
.tp-btn-muted { color: rgba(255,255,255,0.28) !important; }

/* No song */
.tp-nosong .tp-pill { opacity: 0.5; pointer-events: none; }

/* Accent color bleed behind cover */
.tp-bleed {
  position: absolute;
  left: -16px; top: 50%;
  transform: translateY(-50%);
  width: 80px; height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--tp-accent),0.35) 0%, transparent 70%);
  filter: blur(14px);
  pointer-events: none;
  opacity: 0.6;
  transition: background 0.8s ease;
}
`;

/* ── Component ── */
export default function TinyPlayer({
  song,
  isPlaying,
  currentTime = 0,
  duration    = 0,
  onPlayPause,
  onPrev,
  onNext,
  isMuted,
  onMuteToggle,
}) {
  const rootRef = useRef(null);

  /* Extract accent color from cover art */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !song?.cover) {
      root?.style.setProperty('--tp-accent', '29, 185, 84');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = song.cover;
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 8;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 8, 8);
        const d = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
        root.style.setProperty('--tp-accent', `${Math.round(r/n)}, ${Math.round(g/n)}, ${Math.round(b/n)}`);
      } catch { root.style.setProperty('--tp-accent', '29, 185, 84'); }
    };
    img.onerror = () => root.style.setProperty('--tp-accent', '29, 185, 84');
  }, [song?.cover]);

  const pct     = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const hasSong = !!song;
  const cover   = song?.cover || 'https://placehold.co/88x88/0a0c0e/1a2a1a?text=%E2%99%AA';
  const rootCls = ['tp-root', isPlaying && hasSong ? 'tp-playing' : '', !hasSong ? 'tp-nosong' : ''].filter(Boolean).join(' ');

  return (
    <>
      <style>{CSS}</style>
      <div className={rootCls} ref={rootRef}>
        <div className="tp-pill">

          {/* Progress line */}
          <div className="tp-progress-track">
            <div className="tp-progress-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="tp-inner">
            {/* Accent bleed */}
            <div className="tp-bleed" aria-hidden="true" />

            {/* Cover */}
            <div className="tp-cover-wrap">
              <img src={cover} alt={song?.name || 'cover'}
                onError={e => { e.target.src = 'https://placehold.co/88x88/0a0c0e/1a2a1a?text=%E2%99%AA'; }} />
            </div>

            {/* Meta */}
            <div className="tp-meta">
              <div className="tp-name">{song?.name || 'Nothing playing'}</div>
              <div className="tp-artist">{song?.artist || '—'}</div>
            </div>

            {/* Wave — only when playing */}
            <div className="tp-wave">
              <WaveIcon />
            </div>

            {/* Controls */}
            <div className="tp-controls">
              <button className="tp-btn" onClick={onPrev} aria-label="Previous">
                <FaStepBackward style={{ fontSize: 12 }} />
              </button>

              <button className="tp-btn tp-btn-play" onClick={onPlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying
                  ? <FaPause  style={{ fontSize: 12 }} />
                  : <FaPlay   style={{ fontSize: 12, marginLeft: 1 }} />
                }
              </button>

              <button className="tp-btn" onClick={onNext} aria-label="Next">
                <FaStepForward style={{ fontSize: 12 }} />
              </button>

              <button
                className={`tp-btn ${isMuted ? 'tp-btn-muted' : ''}`}
                onClick={onMuteToggle}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <FaVolumeMute style={{ fontSize: 12 }} /> : <FaVolumeUp style={{ fontSize: 12 }} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}