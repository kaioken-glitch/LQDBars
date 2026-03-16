/**
 * TinyPlayer.jsx — Mini player that exactly matches the mobile mini bar
 * from PlayerControls. Pill shape, accent progress line, cover→meta→wave→controls.
 */
import React, { useEffect, useRef } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward } from 'react-icons/fa';

/* ── Wave icon — identical to PlayerControls ── */
function WaveIcon() {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true"
      style={{ display: 'block' }}>
      {[
        { x: 0,  ys: ['7','2','12'], dur: '0.6s',  delay: '0s'    },
        { x: 3,  ys: ['9','1','13'], dur: '0.75s', delay: '0.1s'  },
        { x: 6,  ys: ['4','0','12'], dur: '0.5s',  delay: '0.05s' },
        { x: 9,  ys: ['7','3','13'], dur: '0.65s', delay: '0.15s' },
        { x: 12, ys: ['5','1','11'], dur: '0.55s', delay: '0.08s' },
      ].map((b, i) => (
        <rect key={i} x={b.x} y={b.ys[0]} width="2.5" rx="1.2"
          height={String(14 - parseInt(b.ys[0]))} fill="#1DB954">
          <animate attributeName="y"
            values={`${b.ys[0]};${b.ys[1]};${b.ys[2]};${b.ys[0]}`}
            dur={b.dur} repeatCount="indefinite" begin={b.delay} />
          <animate attributeName="height"
            values={`${14-parseInt(b.ys[0])};${14-parseInt(b.ys[1])};${14-parseInt(b.ys[2])};${14-parseInt(b.ys[0])}`}
            dur={b.dur} repeatCount="indefinite" begin={b.delay} />
        </rect>
      ))}
    </svg>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500&display=swap');

.tp-root *, .tp-root *::before, .tp-root *::after {
  box-sizing: border-box; margin: 0; padding: 0;
}
.tp-root {
  --tp-green:  #1DB954;
  --tp-green2: #23E065;
  --tp-accent: 29, 185, 84;
  display: block; width: 100%;
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* ── Pill — exactly like .pc-mobile-bar ── */
.tp-pill {
  background: rgba(12,14,18,0.97);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 18px;
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  box-shadow: 0 -4px 40px rgba(0,0,0,0.5), 0 4px 24px rgba(0,0,0,0.4);
  overflow: hidden;
}

/* ── Accent progress line — top of pill ── */
.tp-progress {
  height: 2px;
  background: rgba(255,255,255,0.07);
}
.tp-progress-fill {
  height: 100%;
  background: linear-gradient(
    to right,
    rgba(var(--tp-accent), 0.85),
    var(--tp-green)
  );
  transition: width 0.1s linear;
  will-change: width;
}

/* ── Inner row ── */
.tp-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}

/* ── Cover — matches .pc-mobile-cover ── */
.tp-cover {
  flex-shrink: 0;
  width: 44px; height: 44px;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
}
.tp-cover img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}

/* ── Meta — matches .pc-mobile-meta ── */
.tp-meta { flex: 1; min-width: 0; }
.tp-name {
  font-family: 'Syne', sans-serif;
  font-size: 13px; font-weight: 600;
  color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 1px;
}
.tp-artist {
  font-size: 11px;
  color: rgba(255,255,255,0.48);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ── Wave — only visible when playing ── */
.tp-wave {
  flex-shrink: 0;
  display: flex; align-items: center;
  opacity: 0; transition: opacity 0.2s;
}
.tp-root.tp-playing .tp-wave { opacity: 1; }

/* ── Buttons — matches .pc-mobile-btns ── */
.tp-btns {
  display: flex; align-items: center; gap: 4px;
  flex-shrink: 0;
}

/* Prev / Next — ghost */
.tp-btn {
  background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,0.55);
  font-size: 16px;
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.tp-btn:hover  { color: #fff; background: rgba(255,255,255,0.08); }
.tp-btn:active { transform: scale(0.88); }

/* Play/Pause — white circle, matches .pc-mobile-play exactly ── */
.tp-play {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: #fff;
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #000; font-size: 14px;
  flex-shrink: 0;
  transition: transform 0.15s, background 0.2s;
  box-shadow: 0 2px 10px rgba(0,0,0,0.35);
}
.tp-play:hover  { background: var(--tp-green2); transform: scale(1.06); }
.tp-play:active { transform: scale(0.92); }

/* No song dim */
.tp-nosong { opacity: 0.5; pointer-events: none; }
`;

const FALLBACK = 'https://placehold.co/88x88/0a0c0e/1a2a1a?text=%E2%99%AA';

export default function TinyPlayer({
  song,
  isPlaying,
  currentTime = 0,
  duration    = 0,
  onPlayPause,
  onPrev,
  onNext,
}) {
  const rootRef = useRef(null);

  /* Extract accent color from cover for the progress gradient */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!song?.cover) { root.style.setProperty('--tp-accent', '29, 185, 84'); return; }

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
        root.style.setProperty('--tp-accent',
          `${Math.round(r/n)}, ${Math.round(g/n)}, ${Math.round(b/n)}`);
      } catch { root.style.setProperty('--tp-accent', '29, 185, 84'); }
    };
    img.onerror = () => root.style.setProperty('--tp-accent', '29, 185, 84');
  }, [song?.cover]);

  const pct    = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const hasSong = !!song;

  return (
    <>
      <style>{CSS}</style>
      <div
        ref={rootRef}
        className={[
          'tp-root',
          isPlaying && hasSong ? 'tp-playing' : '',
          !hasSong ? 'tp-nosong' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="tp-pill">

          {/* Accent progress line */}
          <div className="tp-progress">
            <div className="tp-progress-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="tp-inner">

            {/* Cover art */}
            <div className="tp-cover">
              <img
                src={song?.cover || FALLBACK}
                alt={song?.name || 'cover'}
                onError={e => { e.target.src = FALLBACK; }}
              />
            </div>

            {/* Song name + artist */}
            <div className="tp-meta">
              <div className="tp-name">{song?.name || 'Nothing playing'}</div>
              <div className="tp-artist">{song?.artist || '—'}</div>
            </div>

            {/* Animated wave — shows only when playing */}
            <div className="tp-wave" aria-hidden="true">
              <WaveIcon />
            </div>

            {/* Controls */}
            <div className="tp-btns">
              <button className="tp-btn" onClick={onPrev} aria-label="Previous">
                <FaStepBackward style={{ fontSize: 12 }} />
              </button>

              <button className="tp-play" onClick={onPlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying
                  ? <FaPause  style={{ fontSize: 13 }} />
                  : <FaPlay   style={{ fontSize: 13, marginLeft: 2 }} />
                }
              </button>

              <button className="tp-btn" onClick={onNext} aria-label="Next">
                <FaStepForward style={{ fontSize: 12 }} />
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}