import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  FaPlay, FaPause, FaStepBackward, FaStepForward,
  FaRandom, FaRedoAlt, FaVolumeUp, FaVolumeMute,
  FaChevronDown, FaEllipsisH, FaHeart, FaList, FaTimes, FaMusic,
} from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';

/* ═══════════════════════════════════════════════════════════════════
   INLINED: useLyrics hook + LyricsPanel component
═══════════════════════════════════════════════════════════════════ */
const LRCLIB_BASE = 'https://lrclib.net/api';
const LRCLIB_UA   = 'LiquidBars/1.0';
const lyricsCache = new Map();

function parseLrc(lrc) {
  if (!lrc) return [];
  const lines = [];
  for (const raw of lrc.split('\n')) {
    const match = raw.match(/^\[(\d{1,2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (!match) continue;
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const ms   = parseInt(match[3].padEnd(3, '0'), 10);
    const text = match[4].trim();
    if (!text) continue;
    lines.push({ time: mins * 60 + secs + ms / 1000, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

async function fetchLyricsFromApi(artist, title, album) {
  const key = `${artist}||${title}`.toLowerCase();
  if (lyricsCache.has(key)) return lyricsCache.get(key);
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  if (album) params.set('album_name', album);
  const res = await fetch(`${LRCLIB_BASE}/get?${params}`, {
    headers: { 'Lrclib-Client': LRCLIB_UA },
  });
  if (res.status === 404) { lyricsCache.set(key, null); return null; }
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
  const data = await res.json();
  lyricsCache.set(key, data);
  return data;
}

function useLyrics(currentSong, currentTime) {
  const [lines,       setLines]       = useState([]);
  const [plainLyrics, setPlainLyrics] = useState('');
  const [activeLine,  setActiveLine]  = useState(-1);
  const [status,      setStatus]      = useState('idle');
  const lastSongId = useRef(null);

  useEffect(() => {
    const songId = currentSong?.id;
    if (!songId || !currentSong?.name) {
      setLines([]); setPlainLyrics(''); setActiveLine(-1); setStatus('idle');
      return;
    }
    if (songId === lastSongId.current) return;
    lastSongId.current = songId;
    setLines([]); setPlainLyrics(''); setActiveLine(-1); setStatus('loading');
    fetchLyricsFromApi(currentSong.artist || '', currentSong.name, currentSong.album || '')
      .then(data => {
        if (!data) { setStatus('not_found'); return; }
        if (data.syncedLyrics) {
          setLines(parseLrc(data.syncedLyrics));
          setStatus('found');
        } else if (data.plainLyrics) {
          setPlainLyrics(data.plainLyrics);
          setStatus('plain');
        } else {
          setStatus('not_found');
        }
      })
      .catch(() => setStatus('error'));
  }, [currentSong?.id]); // eslint-disable-line

  useEffect(() => {
    if (!lines.length) return;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime) idx = i;
      else break;
    }
    setActiveLine(idx);
  }, [currentTime, lines]);

  return { lines, plainLyrics, activeLine, status };
}

/* ─── Shimmer ────────────────────────────────────────────────────── */
const WIDTHS = ['68%','52%','78%','44%','72%','58%','82%','48%','65%','74%'];
function LpShimmer() {
  return (
    <div className="lp-shimmer-wrap">
      {WIDTHS.map((w, i) => (
        <div key={i} className="lp-shimmer-line" style={{ width: w, animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

/* ─── LyricsPanel ────────────────────────────────────────────────── */
function LyricsPanel({ accentColor, bg }) {
  const { currentSong, currentTime, seekTo: seekToFn } = usePlayer();
  const { lines, plainLyrics, activeLine, status } = useLyrics(currentSong, currentTime);

  const viewportRef = useRef(null);
  const lineRefs    = useRef([]);
  const [translateY, setTranslateY] = useState(0);
  const [viewportH,  setViewportH]  = useState(0);

  const accent  = accentColor || '#1DB954';
  const bgColor = bg || 'rgba(8,8,10,1)';

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0) setViewportH(h);
    const ro = new ResizeObserver(([entry]) => {
      const newH = entry.contentRect.height;
      if (newH > 0) setViewportH(newH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!viewportRef.current) return;
    const h = viewportRef.current.getBoundingClientRect().height;
    if (h > 0) setViewportH(h);
  }, [status]);

  useEffect(() => {
    lineRefs.current = lineRefs.current.slice(0, lines.length);
  }, [lines.length]);

  useEffect(() => {
    if (activeLine < 0 || !lineRefs.current[activeLine]) return;
    const vH = viewportRef.current
      ? viewportRef.current.getBoundingClientRect().height
      : viewportH;
    if (vH === 0) return;
    const el      = lineRefs.current[activeLine];
    const lineTop = el.offsetTop;
    const lineH   = el.offsetHeight;
    setTranslateY(-(lineTop - vH / 2 + lineH / 2));
    if (vH !== viewportH) setViewportH(vH);
  }, [activeLine]); // eslint-disable-line

  const handleClick = useCallback((time) => { seekToFn?.(time); }, [seekToFn]);
  const spacerH = viewportH > 0 ? viewportH / 2 : 160;

  return (
    <div className="lp-root" style={{ '--lp-bg': bgColor, '--lp-accent': accent }}>
      {status === 'loading' && <LpShimmer />}

      {status === 'found' && (
        <>
          <div className="lp-mask-top"    aria-hidden="true" />
          <div className="lp-mask-bottom" aria-hidden="true" />
          <div className="lp-viewport" ref={viewportRef}>
            <div
              className="lp-list"
              style={{ transform: `translateY(${translateY}px)` }}
            >
              <span style={{ display: 'block', height: spacerH }} aria-hidden="true" />
              {lines.map((line, i) => {
                const dist = i - activeLine;
                const abs  = Math.abs(dist);
                const isActive = dist === 0;

                // Duration = time until next line starts (capped 1s–8s for animation)
                const nextTime = lines[i + 1]?.time;
                const lineDur  = isActive && nextTime
                  ? Math.max(1, Math.min(8, nextTime - line.time))
                  : 3;

                // How far through the current active line are we?
                // offset = how many seconds have elapsed since this line started
                const elapsed = isActive ? Math.max(0, currentTime - line.time) : 0;

                const wrapStyle = isActive ? {
                  opacity: 1,
                  transform: 'scale(1.04)',
                  transformOrigin: 'left center',
                  transition: 'all 0.45s cubic-bezier(0.22,1,0.36,1)',
                } : {
                  opacity: abs === 1 ? 0.62 : abs === 2 ? 0.38 : 0.2,
                  transform: `scale(${abs === 1 ? 0.975 : abs === 2 ? 0.955 : 0.935})`,
                  transformOrigin: 'left center',
                  filter: abs >= 3 ? 'blur(0.5px)' : 'none',
                  transition: 'all 0.45s cubic-bezier(0.22,1,0.36,1)',
                };

                return (
                  <p
                    key={i}
                    ref={el => { lineRefs.current[i] = el; }}
                    className={`lp-line ${isActive ? 'lp-line-active' : ''}`}
                    style={wrapStyle}
                    onClick={() => handleClick(line.time)}
                    aria-current={isActive ? 'true' : undefined}
                    data-line-dur={isActive ? lineDur : undefined}
                    data-line-elapsed={isActive ? elapsed : undefined}
                  >
                    <span
                      className="lp-line-inner"
                      style={isActive ? {
                        /*
                         * THE FILL EFFECT
                         * We paint the text twice via a CSS gradient clipped to the text.
                         * Left side = accent green, right side = dim white.
                         * The split point is animated from 0% → 100% over lineDur seconds.
                         * We use animation-delay: -elapsed so it resumes mid-word
                         * when activeLine changes (e.g. after seeking).
                         *
                         * The gradient:
                         *   0% … (split-ε) = green (filled)
                         *   (split) … 100% = white 30% (unfilled)
                         * We drive the split via a @keyframes on background-size, not
                         * background-position, so the fill is truly left-to-right.
                         *
                         * Implementation: animate background-size of a two-layer
                         * pseudo approach — but inline we can't use pseudo-elements,
                         * so we animate the background-position of a hard-stop gradient
                         * whose background-size is 200% 100%, sweeping left-to-right.
                         */
                        backgroundImage: `linear-gradient(to right, #1DB954 50%, rgba(255,255,255,0.85) 50%)`,
                        backgroundSize: '200% 100%',
                        backgroundPosition: '100% 0',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        animation: `lpFill ${lineDur}s linear forwards`,
                        animationDelay: `-${elapsed}s`,
                        display: 'inline-block',
                        fontFamily: "'Pixelify Sans', monospace",
                        fontWeight: 700,
                        fontSize: '21px',
                        letterSpacing: '0.02em',
                        textShadow: 'none',
                      } : {
                        color: 'rgba(255,255,255,0.75)',
                        display: 'inline-block',
                        fontFamily: "'Pixelify Sans', monospace",
                        fontWeight: 400,
                        fontSize: '16px',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {line.text}
                    </span>
                  </p>
                );
              })}
              <span style={{ display: 'block', height: spacerH }} aria-hidden="true" />
            </div>
          </div>
        </>
      )}

      {status === 'plain' && (
        <div className="lp-plain">{plainLyrics}</div>
      )}

      {(status === 'not_found' || status === 'error' || status === 'idle') && (
        <div className="lp-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M9 19V6l12-3v13"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
          <span style={{ fontFamily: 'Syne,sans-serif', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
            {status === 'idle' ? 'Play a song' : status === 'error' ? "Couldn't load lyrics" : 'No lyrics found'}
          </span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

const FALLBACK_COLOR = '22, 163, 74';
const FALLBACK_COVER = 'https://placehold.co/400x400/0a0a0a/333?text=♪';
const COLOR_CACHE    = new Map();

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

function fmt(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ─── ProgressBar ───────────────────────────────────────────────── */
const ProgressBar = memo(({ currentTime, duration, onSeek, showTimes = false, thick = false }) => {
  const barRef   = useRef(null);
  const dragging = useRef(false);
  const [hover, setHover] = useState(false);

  const percent = (duration > 0 && currentTime >= 0)
    ? Math.min(100, (currentTime / duration) * 100)
    : 0;

  const calcTime = useCallback((clientX) => {
    if (!barRef.current || !duration) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min((clientX - rect.left) / rect.width, 1)) * duration;
  }, [duration]);

  const onDown = useCallback((e) => {
    dragging.current = true;
    onSeek(calcTime(e.clientX));
  }, [calcTime, onSeek]);

  useEffect(() => {
    const onMove = (e) => { if (dragging.current) onSeek(calcTime(e.clientX)); };
    const onUp   = ()  => { dragging.current = false; };
    const onTouchMove = (e) => { if (dragging.current) onSeek(calcTime(e.touches[0].clientX)); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend',  onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend',  onUp);
    };
  }, [calcTime, onSeek]);

  return (
    <div>
      {showTimes && (
        <div className="pc-times">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      )}
      <div
        ref={barRef}
        className={`pc-bar-track ${thick ? 'pc-bar-thick' : ''} ${hover ? 'pc-bar-hovered' : ''}`}
        onMouseDown={onDown}
        onTouchStart={e => { dragging.current = true; onSeek(calcTime(e.touches[0].clientX)); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        role="slider"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Track progress"
      >
        <div className="pc-bar-fill" style={{ width: `${percent}%` }} />
        <div className="pc-bar-thumb" style={{ left: `${percent}%` }} />
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

const RepeatBtn = memo(({ mode, onToggle }) => (
  <button className={`pc-ctrl-btn ${mode !== 'off' ? 'active' : ''}`} onClick={onToggle} title={`Repeat: ${mode}`} aria-label={`Repeat mode: ${mode}`}>
    <FaRedoAlt />
    {mode === 'one' && <span className="pc-repeat-badge">1</span>}
  </button>
));

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
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&family=Pixelify+Sans:wght@400;500;600;700&display=swap');

/* ════════════════════════════════════
   THE FILL ANIMATION
   background-position sweeps from 100% (all white) → 0% (all green).
   The gradient is: green 50% / white 50%, background-size: 200%.
   So at position 100%: only white visible (right half shown).
   At position 0%: only green visible (left half shown).
   This creates a crisp left-to-right fill sweep.
════════════════════════════════════ */
@keyframes lpFill {
  from { background-position: 100% 0; }
  to   { background-position:   0% 0; }
}

/* ════════════════════════════════════
   LYRICS PANEL
════════════════════════════════════ */
.lp-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
  background: transparent;
  font-family: 'Syne', sans-serif;
  -webkit-font-smoothing: antialiased;
  /* Pixel fonts render sharper without subpixel AA */
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
.lp-viewport {
  flex: 1;
  overflow: hidden;
  position: relative;
  height: 100%;
  width: 100%;
}
.lp-list {
  position: absolute;
  top: 0; left: 0; right: 0;
  padding: 0 24px;
  will-change: transform;
  transition: transform 0.52s cubic-bezier(0.22, 1, 0.36, 1);
}
/* ────────────────────────────────────────────────────────────
   LYRIC LINES — Syne
   Inactive = wt 400, spaced out, very dim  →  raw pixel grid feel
   Active   = wt 700, tighter, full size    →  bold pixel punch
   The fill sweep animates through the active text via lpFill.
──────────────────────────────────────────────────────────── */
.lp-line {
  display: block;
  font-family: 'Syne', sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.7;
  letter-spacing: 0.06em;   /* pixel fonts look great spaced out when dim */
  padding: 4px 0;
  cursor: pointer;
  transform-origin: left center;
  user-select: none;
  border-radius: 6px;
  /* Crisp pixel rendering */
  image-rendering: pixelated;
}

.lp-line.lp-line-active {
  font-family: 'Syne', sans-serif;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.5;
  letter-spacing: 0.02em;  /* bold weight = tighter tracking */
}

.lp-line-inner {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;
}
.lp-line:not(.lp-line-active):hover .lp-line-inner {
  background: rgba(255,255,255,0.05);
}

.lp-plain {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px 48px;
  font-family: 'Syne', sans-serif;
  font-size: 14px;
  line-height: 1.85;
  color: rgba(255,255,255,0.5);
  white-space: pre-wrap;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.lp-plain::-webkit-scrollbar { display: none; }

.lp-mask-top, .lp-mask-bottom {
  position: absolute;
  left: 0; right: 0;
  height: 80px;
  pointer-events: none;
  z-index: 3;
}
.lp-mask-top {
  top: 0;
  background: linear-gradient(to bottom, var(--lp-bg, rgba(8,8,10,1)) 0%, transparent 100%);
}
.lp-mask-bottom {
  bottom: 0;
  background: linear-gradient(to top, var(--lp-bg, rgba(8,8,10,1)) 0%, transparent 100%);
}

.lp-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 28px;
  color: rgba(255,255,255,0.25);
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  text-align: center;
}

.lp-shimmer-wrap { padding: 24px 20px; }
.lp-shimmer-line {
  height: 20px;
  border-radius: 6px;
  margin-bottom: 20px;
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.04) 25%,
    rgba(255,255,255,0.10) 50%,
    rgba(255,255,255,0.04) 75%
  );
  background-size: 200% 100%;
  animation: lpShimmer 1.6s ease-in-out infinite;
}
@keyframes lpShimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ════════════════════════════════════
   PLAYER CONTROLS
════════════════════════════════════ */
:root {
  --pc-green:       #1DB954;
  --pc-green-bright:#23E065;
  --pc-bg:          rgba(8,8,10,0.97);
  --pc-border:      rgba(255,255,255,0.07);
  --pc-text-1:      #FFFFFF;
  --pc-text-2:      rgba(255,255,255,0.5);
  --pc-text-3:      rgba(255,255,255,0.28);
}
.pc-root *, .pc-root *::before, .pc-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.pc-root { font-family: 'Syne', sans-serif; -webkit-font-smoothing: antialiased; }

.pc-empty {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
  height: 72px; display: flex; align-items: center; justify-content: center;
  background: var(--pc-bg); border-top: 1px solid var(--pc-border);
  backdrop-filter: blur(32px); color: var(--pc-text-3); font-size: 13px; letter-spacing: 0.04em;
}

.pc-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
  background: var(--pc-bg); border-top: 1px solid var(--pc-border);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
}
.pc-bar-accent-line {
  height: 2px;
  background: linear-gradient(to right, transparent 0%, rgba(var(--pc-accent),0.7) 20%, rgba(var(--pc-accent),0.9) 50%, rgba(var(--pc-accent),0.7) 80%, transparent 100%);
  transition: background 0.8s ease;
}
.pc-bar-track {
  position: relative; height: 3px; background: rgba(255,255,255,0.08);
  cursor: pointer; transition: height 0.18s ease; user-select: none;
}
.pc-bar-thick   { height: 5px; }
.pc-bar-hovered { height: 5px; }
.pc-bar-fill {
  height: 100%;
  background: linear-gradient(to right, rgba(var(--pc-accent),0.9), var(--pc-green));
  transition: width 0.1s linear, background 0.8s ease;
  border-radius: inherit; will-change: width;
}
.pc-bar-thumb {
  position: absolute; top: 50%; transform: translate(-50%,-50%);
  width: 12px; height: 12px; border-radius: 50%; background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5); opacity: 0; transition: opacity 0.18s ease; pointer-events: none;
}
.pc-bar-hovered .pc-bar-thumb { opacity: 1; }
.pc-times { display: flex; justify-content: space-between; font-size: 11px; color: var(--pc-text-3); margin-bottom: 6px; font-variant-numeric: tabular-nums; }
.pc-bar-inner { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; gap: 16px; max-width: 1600px; margin: 0 auto; }
.pc-song-info  { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; max-width: 320px; }
.pc-cover-wrap {
  position: relative; flex-shrink: 0; width: 52px; height: 52px; border-radius: 10px; overflow: hidden;
  cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.5); transition: transform 0.2s, box-shadow 0.2s;
}
.pc-cover-wrap:hover { transform: scale(1.06); box-shadow: 0 8px 28px rgba(0,0,0,0.6); }
.pc-cover-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pc-song-meta { flex: 1; min-width: 0; }
.pc-song-name { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--pc-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; margin-bottom: 2px; }
.pc-song-artist { font-size: 12px; color: var(--pc-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-heart-btn { background: none; border: none; cursor: pointer; color: var(--pc-text-3); font-size: 14px; padding: 6px; border-radius: 50%; transition: color 0.2s, transform 0.15s; flex-shrink: 0; }
.pc-heart-btn:hover { color: #FF4455; transform: scale(1.2); }
.pc-heart-btn.liked { color: #FF4455; }
.pc-controls { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; }
.pc-ctrl-row  { display: flex; align-items: center; gap: 6px; }
.pc-ctrl-btn {
  background: none; border: none; cursor: pointer; color: var(--pc-text-2); font-size: 14px;
  width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  transition: color 0.18s, background 0.18s, transform 0.15s; position: relative;
}
.pc-ctrl-btn:hover  { color: var(--pc-text-1); background: rgba(255,255,255,0.07); }
.pc-ctrl-btn.active { color: var(--pc-green-bright); }
.pc-ctrl-btn:active { transform: scale(0.9); }
.pc-play-btn {
  width: 48px; height: 48px; border-radius: 50%; background: var(--pc-text-1); border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: #000; font-size: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4); transition: transform 0.18s, box-shadow 0.18s, background 0.2s; flex-shrink: 0;
}
.pc-play-btn:hover  { transform: scale(1.08); box-shadow: 0 8px 28px rgba(0,0,0,0.5); background: var(--pc-green-bright); }
.pc-play-btn:active { transform: scale(0.94); }
.pc-repeat-badge {
  position: absolute; top: -2px; right: -2px; width: 14px; height: 14px; border-radius: 50%;
  background: var(--pc-green); color: #000; font-size: 8px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}
.pc-time-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--pc-text-3); font-variant-numeric: tabular-nums; }
.pc-time-sep { opacity: 0.4; }
.pc-right { display: flex; align-items: center; gap: 10px; flex: 1; justify-content: flex-end; max-width: 360px; min-width: 0; }
.pc-icon-btn {
  background: none; border: none; cursor: pointer; color: var(--pc-text-2); font-size: 14px;
  width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  transition: color 0.18s, background 0.18s; flex-shrink: 0;
}
.pc-icon-btn:hover { color: var(--pc-text-1); background: rgba(255,255,255,0.07); }
.pc-volume { display: flex; align-items: center; gap: 8px; min-width: 100px; flex-shrink: 1; }
.pc-vol-track { position: relative; flex: 1; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; cursor: pointer; transition: height 0.15s; }
.pc-vol-track:hover { height: 5px; }
.pc-vol-fill { height: 100%; background: var(--pc-text-1); border-radius: inherit; pointer-events: none; transition: width 0.05s linear; }
.pc-vol-input { position: absolute; inset: -6px 0; opacity: 0; cursor: pointer; width: 100%; }
.pc-vol-label { font-size: 11px; color: var(--pc-text-3); min-width: 28px; text-align: right; font-variant-numeric: tabular-nums; }
.pc-track-count { font-size: 11px; color: var(--pc-text-3); white-space: nowrap; }

/* ── expanded desktop ── */
.pc-expanded { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; overflow: hidden; }
.pc-expanded-bg {
  position: absolute; inset: 0;
  background: linear-gradient(170deg, rgba(var(--pc-accent),0.5) 0%, rgba(var(--pc-accent),0.18) 30%, #07080A 60%);
  transition: background 0.9s ease;
}
.pc-expanded-bg::after {
  content: ''; position: absolute; inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.032'/%3E%3C/svg%3E");
  background-size: 200px; mix-blend-mode: overlay; pointer-events: none;
}
.pc-exp-header {
  position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(0,0,0,0.25); backdrop-filter: blur(20px);
}
.pc-exp-header-title { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--pc-text-2); font-weight: 500; }
.pc-exp-header-btns  { display: flex; align-items: center; gap: 8px; }
.pc-exp-body { position: relative; z-index: 2; display: flex; flex: 1; overflow: hidden; padding: 32px 40px 24px; gap: 48px; }
.pc-art-col  { display: flex; flex-direction: column; align-items: center; flex: 1; justify-content: center; gap: 28px; }
.pc-art-frame { position: relative; }
.pc-art-glow {
  position: absolute; inset: -16px; border-radius: 28px;
  background: radial-gradient(circle, rgba(var(--pc-accent),0.35) 0%, transparent 70%);
  filter: blur(24px); transition: background 0.9s ease; animation: glowPulse 3s ease-in-out infinite;
}
@keyframes glowPulse { 0%,100%{opacity:0.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
.pc-art-img {
  position: relative; display: block;
  width: clamp(220px,30vw,340px); height: clamp(220px,30vw,340px);
  border-radius: 22px; object-fit: cover;
  box-shadow: 0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1);
  transition: transform 0.4s ease;
}
.pc-art-img:hover { transform: scale(1.02); }
.pc-art-img.playing { animation: artFloat 6s ease-in-out infinite; }
@keyframes artFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
.pc-exp-meta { text-align: center; }
.pc-exp-song-name { font-family: 'Syne', sans-serif; font-size: clamp(22px,3vw,36px); font-weight: 800; letter-spacing: -0.03em; color: var(--pc-text-1); margin-bottom: 6px; line-height: 1.1; }
.pc-exp-artist { font-size: 16px; color: var(--pc-text-2); }
.pc-exp-progress { width: 100%; max-width: 420px; }
.pc-exp-ctrl-row { display: flex; align-items: center; gap: 12px; }
.pc-exp-ctrl-btn {
  background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.55); font-size: 18px;
  width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  transition: color 0.18s, background 0.18s, transform 0.15s; position: relative;
}
.pc-exp-ctrl-btn:hover  { color: #fff; background: rgba(255,255,255,0.08); }
.pc-exp-ctrl-btn.active { color: var(--pc-green-bright); }
.pc-exp-ctrl-btn:active { transform: scale(0.9); }
.pc-exp-play-btn {
  width: 70px; height: 70px; border-radius: 50%; background: #fff; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: #000; font-size: 24px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5); transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
}
.pc-exp-play-btn:hover  { transform: scale(1.07); background: var(--pc-green-bright); box-shadow: 0 12px 50px rgba(29,185,84,0.4); }
.pc-exp-play-btn:active { transform: scale(0.95); }
.pc-exp-bottom { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; }

/* ── queue / lyrics side panels ── */
.pc-queue, .pc-lyrics-panel {
  width: 340px; flex-shrink: 0;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px; display: flex; flex-direction: column; overflow: hidden;
  animation: slideInRight 0.28s cubic-bezier(0.22,1,0.36,1);
}
@keyframes slideInRight { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
.pc-queue-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 12px; border-bottom: 1px solid rgba(255,255,255,0.07);
  font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; color: var(--pc-text-1);
}
.pc-queue-list  { flex: 1; overflow-y: auto; padding: 8px; }
.pc-queue-item  { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 10px; cursor: pointer; transition: background 0.15s; }
.pc-queue-item:hover  { background: rgba(255,255,255,0.06); }
.pc-queue-item.active { background: rgba(29,185,84,0.12); }
.pc-queue-thumb  { width: 40px; height: 40px; border-radius: 7px; object-fit: cover; flex-shrink: 0; }
.pc-queue-meta   { flex: 1; min-width: 0; }
.pc-queue-name   { font-size: 13px; font-weight: 600; color: var(--pc-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-queue-artist { font-size: 11px; color: var(--pc-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-queue-active-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pc-green); flex-shrink: 0; }
.pc-lyrics-body { flex: 1; min-height: 0; overflow: hidden; position: relative; }

/* ── lyrics drawer (compact bar) ── */
.pc-lyrics-drawer {
  position: fixed; left: 0; right: 0; bottom: 73px; z-index: 39;
  height: 0; overflow: hidden; display: flex; flex-direction: column;
  background: rgba(8,8,12,0.97);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-top: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 -8px 40px rgba(0,0,0,0.6);
  transition: height 0.42s cubic-bezier(0.22,1,0.36,1);
}
.pc-lyrics-drawer.open { height: 400px; }
.pc-lyrics-drawer-header {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px 10px; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.pc-lyrics-drawer-title { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--pc-green-bright); }
.pc-lyrics-drawer-song { font-size: 11px; color: rgba(255,255,255,0.35); margin-left: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
.pc-lyrics-drawer-body { flex: 1; min-height: 0; overflow: hidden; position: relative; }

/* ── mobile ── */
.pc-mobile-bar {
  position: fixed; left: 8px; right: 8px; z-index: 40;
  background: rgba(12,14,16,0.95); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px;
  backdrop-filter: blur(32px); box-shadow: 0 -4px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(var(--pc-accent),0.08);
  transition: opacity 0.25s, transform 0.25s; overflow: hidden;
}
.pc-mobile-bar.hidden { opacity: 0; transform: translateY(8px); pointer-events: none; }
.pc-mobile-progress { height: 2px; background: rgba(255,255,255,0.08); position: relative; }
.pc-mobile-progress-fill { height: 100%; background: linear-gradient(to right, rgba(var(--pc-accent),0.8), var(--pc-green)); transition: width 0.1s linear, background 0.8s ease; will-change: width; }
.pc-mobile-inner  { display: flex; align-items: center; gap: 12px; padding: 10px 14px; }
.pc-mobile-cover  { width: 44px; height: 44px; flex-shrink: 0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.4); cursor: pointer; }
.pc-mobile-cover img { width: 100%; height: 100%; object-fit: cover; }
.pc-mobile-meta   { flex: 1; min-width: 0; }
.pc-mobile-name   { font-size: 13px; font-weight: 600; color: var(--pc-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Syne', sans-serif; }
.pc-mobile-artist { font-size: 11px; color: var(--pc-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-mobile-btns   { display: flex; align-items: center; gap: 4px; }
.pc-mobile-play { width: 40px; height: 40px; border-radius: 50%; background: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #000; font-size: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.35); transition: transform 0.15s, background 0.2s; flex-shrink: 0; }
.pc-mobile-play:hover  { background: var(--pc-green-bright); transform: scale(1.06); }
.pc-mobile-play:active { transform: scale(0.92); }
.pc-mobile-next { background: none; border: none; cursor: pointer; color: var(--pc-text-2); font-size: 16px; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.15s; }
.pc-mobile-next:hover { color: var(--pc-text-1); }
.pc-mob-expanded { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; }
.pc-mob-exp-bg {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(var(--pc-accent),0.30) 0%, rgba(var(--pc-accent),0.08) 25%, #050507 55%);
  transition: background 0.9s ease;
}
.pc-mob-exp-bg::after {
  content: ''; position: absolute; inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  background-size: 200px; mix-blend-mode: overlay; pointer-events: none;
}
.pc-mob-header { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.pc-mob-header-label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--pc-text-3); }
.pc-mob-body { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; padding: 24px 24px 32px; flex: 1; }
/* ── Art wrap: stacking context for art + lyrics overlay ── */
/* ────────────────────────────────────────────────────────────
   ART WRAP — full progress-bar width always.
   When lyrics open: row layout — art thumbnail left, lyrics right.
   When closed: art fills the full width as a square card.
──────────────────────────────────────────────────────────── */
.pc-mob-art-wrap {
  position: relative;
  margin-bottom: 28px;
  width: 100%;                        /* matches progress bar width */
  border-radius: 20px;
  flex-shrink: 0;
  overflow: hidden;
  /* Default height = square card */
  height: min(72vw, 300px);
  display: flex;
  flex-direction: row;
  transition: height 0.5s cubic-bezier(0.22,1,0.36,1),
              border-radius 0.5s cubic-bezier(0.22,1,0.36,1);
}

/* When lyrics open: shorter (thumbnail mode) — art left, lyrics right */
.pc-mob-art-wrap.lyrics-open {
  height: 200px;
}

/* Glow sits outside the wrap */
.pc-mob-art-glow {
  position: absolute; inset: -12px; border-radius: 26px;
  background: radial-gradient(circle,rgba(var(--pc-accent),0.35) 0%,transparent 70%);
  filter: blur(20px);
  animation: glowPulse 3s ease-in-out infinite;
  pointer-events: none;
}

/* ── Cover art slot ── */
.pc-mob-art-slot {
  position: relative;
  flex-shrink: 0;
  /* Default: full width square */
  width: 100%; height: 100%;
  transition: width 0.5s cubic-bezier(0.22,1,0.36,1),
              border-radius 0.5s cubic-bezier(0.22,1,0.36,1);
  overflow: hidden;
  border-radius: 20px;
}
.pc-mob-art-wrap.lyrics-open .pc-mob-art-slot {
  width: 42%;      /* thumbnail column */
  border-radius: 0;
}
.pc-mob-art {
  display: block; width: 100%; height: 100%;
  object-fit: cover;
  transition: filter 0.45s cubic-bezier(0.22,1,0.36,1);
  will-change: filter;
}
.pc-mob-art.playing { animation: artFloat 6s ease-in-out infinite; }

/* Blur art slightly in thumbnail state */
.pc-mob-art-wrap.lyrics-open .pc-mob-art {
  filter: brightness(0.75) saturate(0.7);
  animation: none;
}

/* Vertical divider / gradient edge between art and lyrics */
.pc-mob-art-slot::after {
  content: '';
  position: absolute; inset: 0 0 0 auto;
  width: 40px;
  background: linear-gradient(to right, transparent, rgba(5,5,7,0.85));
  opacity: 0;
  transition: opacity 0.5s cubic-bezier(0.22,1,0.36,1);
  pointer-events: none;
}
.pc-mob-art-wrap.lyrics-open .pc-mob-art-slot::after { opacity: 1; }

/* ── Dark scrim over full art in cover-only mode (unused now, kept for safety) ── */
.pc-mob-art-scrim { display: none; }

/* ── Lyrics panel — right column ── */
.pc-mob-art-lyrics {
  flex: 1;
  min-width: 0;
  position: relative;
  background: rgba(5,5,7,0.92);
  overflow: hidden;
  opacity: 0;
  transform: translateX(10px);
  pointer-events: none;
  transition: opacity 0.45s cubic-bezier(0.22,1,0.36,1),
              transform 0.45s cubic-bezier(0.22,1,0.36,1);
  border-radius: 0 20px 20px 0;
}
.pc-mob-art-wrap.lyrics-open .pc-mob-art-lyrics {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.pc-mob-meta      { text-align: center; width: 100%; padding: 0 8px; margin-bottom: 20px; }
.pc-mob-name      { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: var(--pc-text-1); letter-spacing: -0.03em; margin-bottom: 4px; }
.pc-mob-artist    { font-size: 14px; color: var(--pc-text-2); }
.pc-mob-progress  { width: 100%; margin-bottom: 24px; }
.pc-mob-ctrl-row  { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-bottom: 20px; }
.pc-mob-ctrl-btn  { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.5); font-size: 18px; width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.18s, transform 0.15s; position: relative; }
.pc-mob-ctrl-btn:active { transform: scale(0.88); }
.pc-mob-ctrl-btn.active { color: var(--pc-green-bright); }
.pc-mob-play-btn  { width: 66px; height: 66px; border-radius: 50%; background: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #000; font-size: 22px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); transition: transform 0.18s, background 0.2s; }
.pc-mob-play-btn:active { transform: scale(0.92); }
.pc-mob-extras    { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 8px; }
.pc-mob-vol       { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--pc-text-2); cursor: pointer; background: none; border: none; }
.pc-mob-count     { font-size: 12px; color: var(--pc-text-3); }
.pc-mob-queue     { margin-top: 16px; width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; max-height: 280px; overflow-y: auto; }
.pc-mob-queue-title { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: var(--pc-text-1); margin-bottom: 10px; }

@keyframes bufferSpin { to { transform: rotate(360deg); } }
.pc-buffer-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid transparent; border-top-color: var(--pc-green); animation: bufferSpin 0.7s linear infinite; pointer-events: none; }

@media (max-width: 767px)  { .pc-desktop-bar { display: none !important; } }
@media (min-width: 768px)  { .pc-mobile-bar  { display: none !important; } .pc-mob-expanded { display: none !important; } }
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

  const [accentRGB,  setAccentRGB]  = useState(FALLBACK_COLOR);
  const [showQueue,  setShowQueue]  = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [liked,      setLiked]      = useState(false);
  const prevCoverRef = useRef(null);

  const openQueue  = () => { setShowQueue(true);  setShowLyrics(false); };
  const openLyrics = () => { setShowLyrics(true); setShowQueue(false);  };

  useEffect(() => {
    const cover = currentSong?.cover;
    if (!cover || cover === prevCoverRef.current) return;
    prevCoverRef.current = cover;
    extractDominantRGB(cover).then(setAccentRGB);
  }, [currentSong?.cover]);

  useEffect(() => { setLiked(false); }, [currentIndex]);

  const handleSeek = useCallback((t) => seekTo(t), [seekTo]);
  const togglePlay = useCallback(() => setIsPlaying(p => !p), [setIsPlaying]);
  const accentStyle = { '--pc-accent': accentRGB };

  if (!currentSong) {
    return (
      <>
        <style>{CSS}</style>
        <div className="pc-root pc-empty" style={accentStyle}>No song playing</div>
      </>
    );
  }

  const accent = `rgb(${accentRGB})`;

  /* ── desktop expanded ── */
  const desktopExpanded = showBackgroundDetail && (
    <div className="pc-expanded pc-desktop-bar" style={accentStyle}>
      <div className="pc-expanded-bg" />
      <div className="pc-exp-header">
        <button className="pc-icon-btn" onClick={() => setShowBackgroundDetail(false)}><FaChevronDown style={{ fontSize: 18 }} /></button>
        <span className="pc-exp-header-title">Now Playing</span>
        <div className="pc-exp-header-btns">
          <button className={`pc-icon-btn pc-heart-btn ${liked ? 'liked' : ''}`} onClick={() => setLiked(l => !l)}><FaHeart /></button>
          <button
            className="pc-icon-btn"
            style={{ color: showLyrics ? 'var(--pc-green-bright)' : undefined }}
            onClick={() => showLyrics ? setShowLyrics(false) : openLyrics()}
            title="Lyrics"
          ><FaMusic /></button>
          <button
            className="pc-icon-btn"
            style={{ color: showQueue ? 'var(--pc-green-bright)' : undefined }}
            onClick={() => showQueue ? setShowQueue(false) : openQueue()}
            title="Queue"
          ><FaList /></button>
          <button className="pc-icon-btn"><FaEllipsisH /></button>
        </div>
      </div>
      <div className="pc-exp-body">
        <div className="pc-art-col">
          <div className="pc-art-frame">
            <div className="pc-art-glow" />
            <img src={currentSong.cover || FALLBACK_COVER} alt={currentSong.name}
              className={`pc-art-img ${isPlaying ? 'playing' : ''}`}
              onError={e => { e.target.src = FALLBACK_COVER; }} />
          </div>
          <div className="pc-exp-meta">
            <h2 className="pc-exp-song-name">{currentSong.name}</h2>
            <p className="pc-exp-artist">{currentSong.artist}</p>
          </div>
          <div className="pc-exp-progress">
            <ProgressBar currentTime={currentTime} duration={duration} onSeek={handleSeek} showTimes thick />
          </div>
          <div className="pc-exp-ctrl-row">
            <button className={`pc-exp-ctrl-btn ${shuffle ? 'active' : ''}`} onClick={toggleShuffle}><FaRandom /></button>
            <button className="pc-exp-ctrl-btn" onClick={playPrev}><FaStepBackward style={{ fontSize: 22 }} /></button>
            <button className="pc-exp-play-btn" onClick={togglePlay} style={{ position: 'relative' }}>
              {isBuffering ? <div className="pc-buffer-ring" /> : isPlaying ? <FaPause /> : <FaPlay style={{ marginLeft: 3 }} />}
            </button>
            <button className="pc-exp-ctrl-btn" onClick={playNext}><FaStepForward style={{ fontSize: 22 }} /></button>
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
        {showLyrics && (
          <div className="pc-lyrics-panel">
            <div className="pc-queue-header">
              <span>Lyrics</span>
              <button onClick={() => setShowLyrics(false)} className="pc-icon-btn"><FaTimes /></button>
            </div>
            <div className="pc-lyrics-body">
              <LyricsPanel accentColor={accent} bg="transparent" />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* ── desktop compact bar ── */
  const desktopBar = !showBackgroundDetail && (
    <>
      <div className={`pc-lyrics-drawer pc-desktop-bar ${showLyrics ? 'open' : ''}`} style={accentStyle} aria-hidden={!showLyrics}>
        <div className="pc-lyrics-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaMusic style={{ fontSize: 11, color: 'var(--pc-green-bright)' }} />
            <span className="pc-lyrics-drawer-title">Lyrics</span>
            {currentSong && (
              <span className="pc-lyrics-drawer-song">{currentSong.name}{currentSong.artist ? ` · ${currentSong.artist}` : ''}</span>
            )}
          </div>
          <button className="pc-icon-btn" onClick={() => setShowLyrics(false)}><FaTimes style={{ fontSize: 11 }} /></button>
        </div>
        <div className="pc-lyrics-drawer-body">
          <LyricsPanel accentColor={accent} bg="rgba(8,8,12,0.97)" />
        </div>
      </div>

      <div className="pc-bar pc-desktop-bar" style={accentStyle}>
        <div className="pc-bar-accent-line" />
        <ProgressBar currentTime={currentTime} duration={duration} onSeek={handleSeek} />
        <div className="pc-bar-inner">
          <div className="pc-song-info">
            <div className="pc-cover-wrap" onClick={() => setShowBackgroundDetail(true)}>
              <img src={currentSong.cover || FALLBACK_COVER} alt={currentSong.name} onError={e => { e.target.src = FALLBACK_COVER; }} />
              {isBuffering && <div className="pc-buffer-ring" style={{ inset: 0 }} />}
            </div>
            <div className="pc-song-meta">
              <div className="pc-song-name">{currentSong.name}</div>
              <div className="pc-song-artist">{currentSong.artist}</div>
            </div>
            <button className={`pc-heart-btn ${liked ? 'liked' : ''}`} onClick={() => setLiked(l => !l)}><FaHeart /></button>
          </div>
          <div className="pc-controls">
            <div className="pc-ctrl-row">
              <button className={`pc-ctrl-btn ${shuffle ? 'active' : ''}`} onClick={toggleShuffle} title="Shuffle"><FaRandom /></button>
              <button className="pc-ctrl-btn" style={{ fontSize: 16 }} onClick={playPrev}><FaStepBackward /></button>
              <button className="pc-play-btn" onClick={togglePlay} style={{ position: 'relative' }}>
                {isBuffering ? <div className="pc-buffer-ring" /> : isPlaying ? <FaPause /> : <FaPlay style={{ marginLeft: 2 }} />}
              </button>
              <button className="pc-ctrl-btn" style={{ fontSize: 16 }} onClick={playNext}><FaStepForward /></button>
              <RepeatBtn mode={repeatMode} onToggle={toggleRepeatMode} />
            </div>
            <div className="pc-time-row">
              <span>{fmt(currentTime)}</span>
              <span className="pc-time-sep">·</span>
              <span>{duration > 0 ? fmt(duration) : '--:--'}</span>
            </div>
          </div>
          <div className="pc-right">
            <VolumeSlider volume={volume} isMuted={isMuted} onVolume={setVolume} onMute={toggleMute} />
            <button
              onClick={() => showLyrics ? setShowLyrics(false) : openLyrics()}
              style={{
                background: showLyrics ? 'var(--pc-green)' : 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, color: '#fff', fontSize: 13, transition: 'background 0.2s',
              }}
              title="Lyrics"
            ><FaMusic style={{ fontSize: 12 }} /></button>
            <button
              onClick={() => showQueue ? setShowQueue(false) : openQueue()}
              style={{
                background: showQueue ? 'var(--pc-green)' : 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, color: '#fff', fontSize: 13, transition: 'background 0.2s',
              }}
              title="Queue"
            ><FaList style={{ fontSize: 11 }} /></button>
            <button className="pc-icon-btn" onClick={() => setShowBackgroundDetail(true)} title="Expand">
              <FaChevronDown style={{ transform: 'rotate(180deg)', fontSize: 12 }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  /* ── mobile mini bar ── */
  const mobileMini = (
    <div className={`pc-mobile-bar ${showBackgroundDetail ? 'hidden' : ''}`} style={{ ...accentStyle, bottom: '80px' }}>
      <div className="pc-mobile-progress">
        <div className="pc-mobile-progress-fill" style={{ width: `${duration > 0 ? Math.min(100,(currentTime/duration)*100) : 0}%` }} />
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
          <button className="pc-mobile-play" onClick={e => { e.stopPropagation(); togglePlay(); }}>
            {isPlaying ? <FaPause /> : <FaPlay style={{ marginLeft: 2 }} />}
          </button>
          <button className="pc-mobile-next" onClick={e => { e.stopPropagation(); playNext(); }}>
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
        <button className="pc-icon-btn" onClick={() => setShowBackgroundDetail(false)}><FaChevronDown style={{ fontSize: 18 }} /></button>
        <span className="pc-mob-header-label">
          {showLyrics ? 'Lyrics' : 'Now Playing'}
        </span>
        <button className="pc-icon-btn"><FaEllipsisH /></button>
      </div>
      <div className="pc-mob-body">

        {/* Art + lyrics — full width; when lyrics open: thumbnail | lyrics side-by-side */}
        <div className={`pc-mob-art-wrap ${showLyrics ? 'lyrics-open' : ''}`}>
          <div className="pc-mob-art-glow" />
          {/* Left: cover art slot — full-width square, shrinks to 42% when lyrics open */}
          <div className="pc-mob-art-slot">
            <img
              src={currentSong.cover || FALLBACK_COVER}
              alt={currentSong.name}
              className={`pc-mob-art ${isPlaying && !showLyrics ? 'playing' : ''}`}
              onError={e => { e.target.src = FALLBACK_COVER; }}
            />
          </div>
          {/* Right: lyrics panel — slides in from right when lyrics open */}
          <div className="pc-mob-art-lyrics">
            <LyricsPanel accentColor={accent} bg="transparent" />
          </div>
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
          <button className="pc-mob-ctrl-btn" onClick={playPrev} style={{ fontSize: 22 }}><FaStepBackward /></button>
          <button className="pc-mob-play-btn" onClick={togglePlay} style={{ position: 'relative' }}>
            {isBuffering ? <div className="pc-buffer-ring" /> : isPlaying ? <FaPause /> : <FaPlay style={{ marginLeft: 3 }} />}
          </button>
          <button className="pc-mob-ctrl-btn" onClick={playNext} style={{ fontSize: 22 }}><FaStepForward /></button>
          <button className={`pc-mob-ctrl-btn ${repeatMode !== 'off' ? 'active' : ''}`} onClick={toggleRepeatMode} style={{ position: 'relative' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Mic/lyrics toggle — taps the art overlay */}
            <button
              className="pc-icon-btn"
              style={{ color: showLyrics ? 'var(--pc-green-bright)' : undefined }}
              onClick={() => showLyrics ? setShowLyrics(false) : openLyrics()}
              aria-label={showLyrics ? 'Hide lyrics' : 'Show lyrics'}
            ><FaMusic /></button>
            <button
              className="pc-icon-btn"
              style={{ color: showQueue ? 'var(--pc-green-bright)' : undefined }}
              onClick={() => showQueue ? setShowQueue(false) : openQueue()}
              aria-label="Toggle queue"
            ><FaList /></button>
          </div>
        </div>

        {showQueue && (
          <div className="pc-mob-queue">
            <div className="pc-mob-queue-title">Queue</div>
            {songs.map((song, idx) => (
              <div key={song.id || idx} className={`pc-queue-item ${idx === currentIndex ? 'active' : ''}`} onClick={() => setCurrentIndex(idx)}>
                <img src={song.cover || FALLBACK_COVER} alt={song.name} className="pc-queue-thumb" onError={e => { e.target.src = FALLBACK_COVER; }} />
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