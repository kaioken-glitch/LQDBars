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

/* ─── Lava Lamp Background ───────────────────────────────────────── */
function LavaLampBg({ accentRGB, intensity = 1 }) {
  const r = accentRGB || '29, 185, 84';
  const parts = r.split(',').map(s => parseInt(s.trim(), 10));
  const [pr, pg, pb] = parts;
  // Derive complementary + tertiary blob colors from accent
  const comp = `${Math.round(pb * 0.9)}, ${Math.round(pr * 0.35)}, ${Math.round(pg * 0.65)}`;
  const mid  = `${Math.round((pr * 0.5 + pb * 0.5))}, ${Math.round(pg * 0.25)}, ${Math.round(pb * 0.8)}`;

  return (
    <div className="llamp-root" aria-hidden="true">
      <div className="llamp-base" style={{
        background: `radial-gradient(ellipse at 50% 100%, rgba(${r},0.15) 0%, #020204 65%)`
      }} />
      <div className="llamp-blob llamp-b1" style={{
        background: `radial-gradient(circle, rgba(${r},${(0.58 * intensity).toFixed(2)}) 0%, transparent 70%)`
      }} />
      <div className="llamp-blob llamp-b2" style={{
        background: `radial-gradient(circle, rgba(${comp},${(0.48 * intensity).toFixed(2)}) 0%, transparent 70%)`
      }} />
      <div className="llamp-blob llamp-b3" style={{
        background: `radial-gradient(circle, rgba(${mid},${(0.38 * intensity).toFixed(2)}) 0%, transparent 65%)`
      }} />
      <div className="llamp-blob llamp-b4" style={{
        background: `radial-gradient(circle, rgba(${r},${(0.28 * intensity).toFixed(2)}) 0%, transparent 60%)`
      }} />
      <div className="llamp-grain" />
      <div className="llamp-scrim" />
    </div>
  );
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
function LyricsPanel({ accentColor, bg, fontSize = 'normal' }) {
  const { currentSong, currentTime, seekTo: seekToFn } = usePlayer();
  const { lines, plainLyrics, activeLine, status } = useLyrics(currentSong, currentTime);

  const viewportRef = useRef(null);
  const lineRefs    = useRef([]);
  const [translateY, setTranslateY] = useState(0);
  const [viewportH,  setViewportH]  = useState(0);

  const accent  = accentColor || '#1DB954';
  const bgColor = bg || 'rgba(8,8,10,1)';
  const isLarge = fontSize === 'large';

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

  const activeSize   = isLarge ? '30px' : '21px';
  const inactiveSize = isLarge ? '19px' : '16px';

  return (
    <div className="lp-root" style={{ '--lp-bg': bgColor, '--lp-accent': accent }}>
      {status === 'loading' && <LpShimmer />}

      {status === 'found' && (
        <>
          <div className="lp-mask-top"    aria-hidden="true" />
          <div className="lp-mask-bottom" aria-hidden="true" />
          <div className="lp-viewport" ref={viewportRef}>
            <div className="lp-list" style={{ transform: `translateY(${translateY}px)` }}>
              <span style={{ display: 'block', height: spacerH }} aria-hidden="true" />
              {lines.map((line, i) => {
                const dist = i - activeLine;
                const abs  = Math.abs(dist);
                const isActive = dist === 0;

                const nextTime = lines[i + 1]?.time;
                const lineDur  = isActive && nextTime
                  ? Math.max(1, Math.min(8, nextTime - line.time))
                  : 3;

                const elapsed = isActive ? Math.max(0, currentTime - line.time) : 0;

                const wrapStyle = isActive ? {
                  opacity: 1,
                  transform: 'scale(1.04)',
                  transformOrigin: 'left center',
                  transition: 'all 0.45s cubic-bezier(0.22,1,0.36,1)',
                } : {
                  opacity: abs === 1 ? 0.55 : abs === 2 ? 0.30 : 0.16,
                  transform: `scale(${abs === 1 ? 0.975 : abs === 2 ? 0.955 : 0.935})`,
                  transformOrigin: 'left center',
                  filter: abs >= 3 ? 'blur(0.7px)' : 'none',
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
                  >
                    <span
                      className="lp-line-inner"
                      style={isActive ? {
                        backgroundImage: `linear-gradient(to right, #1DB954 50%, rgba(255,255,255,0.95) 50%)`,
                        backgroundSize: '200% 100%',
                        backgroundPosition: '100% 0',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        animation: `lpFill ${lineDur}s linear forwards`,
                        animationDelay: `-${elapsed}s`,
                        display: 'inline-block',
                        fontFamily: "'Syne', sans-serif",
                        fontWeight: 800,
                        fontSize: activeSize,
                        letterSpacing: '-0.02em',
                        textShadow: 'none',
                        lineHeight: 1.3,
                      } : {
                        color: 'rgba(255,255,255,0.85)',
                        display: 'inline-block',
                        fontFamily: "'Syne', sans-serif",
                        fontWeight: 600,
                        fontSize: inactiveSize,
                        letterSpacing: '0.005em',
                        lineHeight: 1.55,
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

const FALLBACK_COLOR = '29, 185, 84';
const FALLBACK_COVER = 'https://placehold.co/400x400/0a0a0a/333?text=?';
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
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

@keyframes lpFill {
  from { background-position: 100% 0; }
  to   { background-position:   0% 0; }
}

/* ════ LAVA LAMP ════ */
.llamp-root {
  position: absolute; inset: 0; overflow: hidden; z-index: 0; pointer-events: none;
}
.llamp-base { position: absolute; inset: 0; transition: background 2s ease; }
.llamp-blob {
  position: absolute; border-radius: 50%;
  filter: blur(90px); will-change: transform;
  transition: background 2.5s ease;
}
.llamp-b1 { width: 75%; height: 75%; top: -20%; left: -15%; animation: blob1 20s ease-in-out infinite alternate; }
.llamp-b2 { width: 65%; height: 65%; bottom: -15%; right: -15%; animation: blob2 26s ease-in-out infinite alternate; }
.llamp-b3 { width: 50%; height: 50%; top: 20%; left: 28%; animation: blob3 17s ease-in-out infinite alternate; }
.llamp-b4 { width: 38%; height: 38%; top: -8%; right: 8%; animation: blob4 30s ease-in-out infinite alternate; }

@keyframes blob1 {
  0%   { transform: translate(0,0) scale(1); }
  25%  { transform: translate(6%,14%) scale(1.07); }
  50%  { transform: translate(12%,6%) scale(0.94); }
  75%  { transform: translate(-4%,18%) scale(1.1); }
  100% { transform: translate(16%,10%) scale(1.04); }
}
@keyframes blob2 {
  0%   { transform: translate(0,0) scale(1); }
  33%  { transform: translate(-12%,-10%) scale(1.12); }
  66%  { transform: translate(6%,-18%) scale(0.90); }
  100% { transform: translate(-18%,-6%) scale(1.08); }
}
@keyframes blob3 {
  0%   { transform: translate(0,0) scale(1); }
  20%  { transform: translate(-18%,12%) scale(1.18); }
  40%  { transform: translate(22%,-8%) scale(0.86); }
  60%  { transform: translate(-10%,-18%) scale(1.08); }
  80%  { transform: translate(14%,10%) scale(0.92); }
  100% { transform: translate(-6%,20%) scale(1.14); }
}
@keyframes blob4 {
  0%   { transform: translate(0,0) scale(1); }
  50%  { transform: translate(-22%,28%) scale(1.22); }
  100% { transform: translate(12%,16%) scale(0.82); }
}

.llamp-grain {
  position: absolute; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.048'/%3E%3C/svg%3E");
  background-size: 180px; mix-blend-mode: overlay; opacity: 0.65;
}
/* The key: heavy dark scrim keeps contrast high while blobs stay visible as color */
.llamp-scrim {
  position: absolute; inset: 0;
  background: rgba(3,3,7,0.56);
}

/* ════ LYRICS PANEL ════ */
.lp-root {
  display: flex; flex-direction: column;
  height: 100%; width: 100%; overflow: hidden; position: relative;
  background: transparent; font-family: 'Syne', sans-serif;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
.lp-viewport { flex: 1; overflow: hidden; position: relative; height: 100%; width: 100%; }
.lp-list {
  position: absolute; top: 0; left: 0; right: 0; padding: 0 32px;
  will-change: transform; transition: transform 0.52s cubic-bezier(0.22,1,0.36,1);
}
.lp-line {
  display: block; font-family: 'Syne', sans-serif;
  font-size: 16px; font-weight: 600; line-height: 1.65;
  letter-spacing: 0.005em; padding: 6px 0; cursor: pointer;
  transform-origin: left center; user-select: none;
}
.lp-line.lp-line-active { font-size: 21px; font-weight: 800; line-height: 1.3; letter-spacing: -0.02em; }
.lp-line-inner { display: inline-block; padding: 3px 8px; border-radius: 6px; transition: background 0.15s; }
.lp-line:not(.lp-line-active):hover .lp-line-inner { background: rgba(255,255,255,0.06); }
.lp-plain {
  flex: 1; overflow-y: auto; padding: 28px 32px 52px;
  font-family: 'Syne', sans-serif; font-size: 15px; line-height: 1.9;
  color: rgba(255,255,255,0.55); white-space: pre-wrap;
  -ms-overflow-style: none; scrollbar-width: none;
}
.lp-plain::-webkit-scrollbar { display: none; }
.lp-mask-top, .lp-mask-bottom {
  position: absolute; left: 0; right: 0; height: 110px;
  pointer-events: none; z-index: 3;
}
.lp-mask-top    { top: 0;    background: linear-gradient(to bottom, var(--lp-bg, rgba(3,3,7,1)) 0%, transparent 100%); }
.lp-mask-bottom { bottom: 0; background: linear-gradient(to top,   var(--lp-bg, rgba(3,3,7,1)) 0%, transparent 100%); }
.lp-state {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 28px; color: rgba(255,255,255,0.25);
  font-family: 'Syne', sans-serif; font-size: 13px; text-align: center;
}
.lp-shimmer-wrap { padding: 32px; }
.lp-shimmer-line {
  height: 20px; border-radius: 6px; margin-bottom: 22px;
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%; animation: lpShimmer 1.6s ease-in-out infinite;
}
@keyframes lpShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* ════ PLAYER BASE ════ */
:root {
  --pc-green:       #1DB954;
  --pc-green-bright:#23E065;
  --pc-bg:          rgba(6,6,10,0.97);
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
  backdrop-filter: blur(32px); color: var(--pc-text-3); font-size: 13px;
}
.pc-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
  background: var(--pc-bg); border-top: 1px solid var(--pc-border);
  backdrop-filter: blur(40px) saturate(180%); -webkit-backdrop-filter: blur(40px) saturate(180%);
}
.pc-bar-accent-line {
  height: 2px;
  background: linear-gradient(to right, transparent 0%, rgba(var(--pc-accent),0.7) 20%, rgba(var(--pc-accent),0.9) 50%, rgba(var(--pc-accent),0.7) 80%, transparent 100%);
  transition: background 0.8s ease;
}
.pc-bar-track { position: relative; height: 3px; background: rgba(255,255,255,0.08); cursor: pointer; transition: height 0.18s ease; user-select: none; }
.pc-bar-thick { height: 5px; }
.pc-bar-hovered { height: 5px; }
.pc-bar-fill { height: 100%; background: linear-gradient(to right, rgba(var(--pc-accent),0.9), var(--pc-green)); transition: width 0.1s linear, background 0.8s ease; border-radius: inherit; will-change: width; }
.pc-bar-thumb { position: absolute; top: 50%; transform: translate(-50%,-50%); width: 12px; height: 12px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.5); opacity: 0; transition: opacity 0.18s ease; pointer-events: none; }
.pc-bar-hovered .pc-bar-thumb { opacity: 1; }
.pc-times { display: flex; justify-content: space-between; font-size: 11px; color: var(--pc-text-3); margin-bottom: 6px; font-variant-numeric: tabular-nums; }
.pc-bar-inner { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; gap: 16px; max-width: 1600px; margin: 0 auto; }
.pc-song-info { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; max-width: 320px; }
.pc-cover-wrap { position: relative; flex-shrink: 0; width: 52px; height: 52px; border-radius: 10px; overflow: hidden; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.5); transition: transform 0.2s, box-shadow 0.2s; }
.pc-cover-wrap:hover { transform: scale(1.06); box-shadow: 0 8px 28px rgba(0,0,0,0.6); }
.pc-cover-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pc-song-meta { flex: 1; min-width: 0; }
.pc-song-name { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--pc-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; margin-bottom: 2px; }
.pc-song-artist { font-size: 12px; color: var(--pc-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-heart-btn { background: none; border: none; cursor: pointer; color: var(--pc-text-3); font-size: 14px; padding: 6px; border-radius: 50%; transition: color 0.2s, transform 0.15s; flex-shrink: 0; }
.pc-heart-btn:hover { color: #FF4455; transform: scale(1.2); }
.pc-heart-btn.liked { color: #FF4455; }
.pc-controls { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; }
.pc-ctrl-row { display: flex; align-items: center; gap: 6px; }
.pc-ctrl-btn { background: none; border: none; cursor: pointer; color: var(--pc-text-2); font-size: 14px; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.18s, background 0.18s, transform 0.15s; position: relative; }
.pc-ctrl-btn:hover { color: var(--pc-text-1); background: rgba(255,255,255,0.07); }
.pc-ctrl-btn.active { color: var(--pc-green-bright); }
.pc-ctrl-btn:active { transform: scale(0.9); }
.pc-play-btn { width: 48px; height: 48px; border-radius: 50%; background: var(--pc-text-1); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #000; font-size: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); transition: transform 0.18s, box-shadow 0.18s, background 0.2s; flex-shrink: 0; }
.pc-play-btn:hover { transform: scale(1.08); box-shadow: 0 8px 28px rgba(0,0,0,0.5); background: var(--pc-green-bright); }
.pc-play-btn:active { transform: scale(0.94); }
.pc-repeat-badge { position: absolute; top: -2px; right: -2px; width: 14px; height: 14px; border-radius: 50%; background: var(--pc-green); color: #000; font-size: 8px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.pc-time-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--pc-text-3); font-variant-numeric: tabular-nums; }
.pc-time-sep { opacity: 0.4; }
.pc-right { display: flex; align-items: center; gap: 10px; flex: 1; justify-content: flex-end; max-width: 360px; min-width: 0; }
.pc-icon-btn { background: none; border: none; cursor: pointer; color: var(--pc-text-2); font-size: 14px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.18s, background 0.18s; flex-shrink: 0; }
.pc-icon-btn:hover { color: var(--pc-text-1); background: rgba(255,255,255,0.07); }
.pc-volume { display: flex; align-items: center; gap: 8px; min-width: 100px; flex-shrink: 1; }
.pc-vol-track { position: relative; flex: 1; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; cursor: pointer; transition: height 0.15s; }
.pc-vol-track:hover { height: 5px; }
.pc-vol-fill { height: 100%; background: var(--pc-text-1); border-radius: inherit; pointer-events: none; transition: width 0.05s linear; }
.pc-vol-input { position: absolute; inset: -6px 0; opacity: 0; cursor: pointer; width: 100%; }
.pc-vol-label { font-size: 11px; color: var(--pc-text-3); min-width: 28px; text-align: right; font-variant-numeric: tabular-nums; }
.pc-track-count { font-size: 11px; color: var(--pc-text-3); white-space: nowrap; }

/* ════ DESKTOP EXPANDED — Apple-quality ════ */
.pc-expanded { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; overflow: hidden; }
.pc-expanded > .llamp-root { z-index: 0; }
.pc-exp-dark-overlay { position: absolute; inset: 0; z-index: 1; background: rgba(2,2,6,0.40); pointer-events: none; }
.pc-exp-header {
  position: relative; z-index: 3;
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 32px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(0,0,0,0.18); backdrop-filter: blur(28px);
}
.pc-exp-header-title { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.4); font-weight: 600; }
.pc-exp-header-btns { display: flex; align-items: center; gap: 6px; }

.pc-exp-body {
  position: relative; z-index: 2;
  display: flex; flex: 1; overflow: hidden;
  padding: 44px 60px 36px; gap: 60px;
  align-items: center;
}

/* Left: art + controls — fixed width */
.pc-art-col { display: flex; flex-direction: column; align-items: center; flex: 0 0 auto; width: clamp(260px,30vw,360px); gap: 22px; }
.pc-art-frame { position: relative; }
.pc-art-glow { position: absolute; inset: -20px; border-radius: 32px; background: radial-gradient(circle, rgba(var(--pc-accent),0.42) 0%, transparent 70%); filter: blur(30px); transition: background 1.2s ease; animation: glowPulse 4s ease-in-out infinite; }
@keyframes glowPulse { 0%,100%{opacity:0.62;transform:scale(1)} 50%{opacity:1;transform:scale(1.06)} }
.pc-art-img { position: relative; display: block; width: clamp(240px,28vw,340px); height: clamp(240px,28vw,340px); border-radius: 22px; object-fit: cover; box-shadow: 0 44px 110px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.08); transition: transform 0.4s ease; }
.pc-art-img:hover { transform: scale(1.015); }
.pc-art-img.playing { animation: artFloat 7s ease-in-out infinite; }
@keyframes artFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
.pc-exp-meta { text-align: center; width: 100%; }
.pc-exp-song-name { font-family: 'Syne', sans-serif; font-size: clamp(18px,2.2vw,30px); font-weight: 800; letter-spacing: -0.03em; color: #fff; margin-bottom: 6px; line-height: 1.1; }
.pc-exp-artist { font-size: 14px; color: rgba(255,255,255,0.48); }
.pc-exp-progress { width: 100%; }
.pc-exp-ctrl-row { display: flex; align-items: center; gap: 8px; }
.pc-exp-ctrl-btn { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.5); font-size: 17px; width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.18s, background 0.18s, transform 0.15s; position: relative; }
.pc-exp-ctrl-btn:hover { color: #fff; background: rgba(255,255,255,0.08); }
.pc-exp-ctrl-btn.active { color: var(--pc-green-bright); }
.pc-exp-ctrl-btn:active { transform: scale(0.9); }
.pc-exp-play-btn { width: 66px; height: 66px; border-radius: 50%; background: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #000; font-size: 23px; box-shadow: 0 8px 36px rgba(0,0,0,0.45); transition: transform 0.2s, box-shadow 0.2s, background 0.2s; }
.pc-exp-play-btn:hover { transform: scale(1.07); background: var(--pc-green-bright); box-shadow: 0 12px 48px rgba(29,185,84,0.45); }
.pc-exp-play-btn:active { transform: scale(0.95); }
.pc-exp-bottom { display: flex; align-items: center; justify-content: space-between; width: 100%; }

/* Right: lyrics — fills remaining space, Apple-style */
.pc-lyrics-col {
  flex: 1; min-width: 0; min-height: 0;
  display: flex; flex-direction: column;
  height: 100%;
  background: rgba(0,0,0,0.22);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px; overflow: hidden;
  backdrop-filter: blur(24px);
  animation: slideInRight 0.34s cubic-bezier(0.22,1,0.36,1);
}
.pc-lyrics-col-header {
  flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.pc-lyrics-col-label { font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--pc-green-bright); margin-bottom: 3px; }
.pc-lyrics-col-song { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: #fff; letter-spacing: -0.01em; margin-bottom: 2px; }
.pc-lyrics-col-artist { font-size: 12px; color: rgba(255,255,255,0.4); }
.pc-lyrics-col-body { flex: 1; min-height: 0; overflow: hidden; position: relative; }

@keyframes slideInRight { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }

/* Queue panel */
.pc-queue { width: 300px; flex-shrink: 0; background: rgba(0,0,0,0.22); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; display: flex; flex-direction: column; overflow: hidden; backdrop-filter: blur(24px); animation: slideInRight 0.28s cubic-bezier(0.22,1,0.36,1); }
.pc-queue-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 14px; border-bottom: 1px solid rgba(255,255,255,0.07); font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; color: var(--pc-text-1); }
.pc-queue-list { flex: 1; overflow-y: auto; padding: 8px; }
.pc-queue-item { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 10px; cursor: pointer; transition: background 0.15s; }
.pc-queue-item:hover { background: rgba(255,255,255,0.06); }
.pc-queue-item.active { background: rgba(29,185,84,0.12); }
.pc-queue-thumb { width: 40px; height: 40px; border-radius: 7px; object-fit: cover; flex-shrink: 0; }
.pc-queue-meta { flex: 1; min-width: 0; }
.pc-queue-name { font-size: 13px; font-weight: 600; color: var(--pc-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-queue-artist { font-size: 11px; color: var(--pc-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-queue-active-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pc-green); flex-shrink: 0; }

/* Desktop compact lyrics drawer */
.pc-lyrics-drawer { position: fixed; left: 0; right: 0; bottom: 73px; z-index: 39; height: 0; overflow: hidden; display: flex; flex-direction: column; background: rgba(6,6,10,0.96); backdrop-filter: blur(40px) saturate(180%); border-top: 1px solid rgba(255,255,255,0.08); box-shadow: 0 -8px 40px rgba(0,0,0,0.6); transition: height 0.42s cubic-bezier(0.22,1,0.36,1); }
.pc-lyrics-drawer.open { height: 420px; }
.pc-lyrics-drawer-header { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 12px 28px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.pc-lyrics-drawer-title { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--pc-green-bright); }
.pc-lyrics-drawer-song { font-size: 11px; color: rgba(255,255,255,0.35); margin-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px; }
.pc-lyrics-drawer-body { flex: 1; min-height: 0; overflow: hidden; position: relative; }

/* ════ MOBILE MINI BAR ════ */
.pc-mobile-bar { position: fixed; left: 8px; right: 8px; z-index: 40; background: rgba(12,14,18,0.95); border: 1px solid rgba(255,255,255,0.09); border-radius: 18px; backdrop-filter: blur(32px); box-shadow: 0 -4px 40px rgba(0,0,0,0.5); transition: opacity 0.25s, transform 0.25s; overflow: hidden; }
.pc-mobile-bar.hidden { opacity: 0; transform: translateY(8px); pointer-events: none; }
.pc-mobile-progress { height: 2px; background: rgba(255,255,255,0.08); }
.pc-mobile-progress-fill { height: 100%; background: linear-gradient(to right, rgba(var(--pc-accent),0.8), var(--pc-green)); transition: width 0.1s linear; will-change: width; }
.pc-mobile-inner { display: flex; align-items: center; gap: 12px; padding: 10px 14px; }
.pc-mobile-cover { width: 44px; height: 44px; flex-shrink: 0; border-radius: 10px; overflow: hidden; cursor: pointer; }
.pc-mobile-cover img { width: 100%; height: 100%; object-fit: cover; }
.pc-mobile-meta { flex: 1; min-width: 0; }
.pc-mobile-name { font-size: 13px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Syne', sans-serif; }
.pc-mobile-artist { font-size: 11px; color: var(--pc-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-mobile-btns { display: flex; align-items: center; gap: 4px; }
.pc-mobile-play { width: 40px; height: 40px; border-radius: 50%; background: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #000; font-size: 14px; transition: transform 0.15s, background 0.2s; flex-shrink: 0; }
.pc-mobile-play:active { transform: scale(0.92); }
.pc-mobile-next { background: none; border: none; cursor: pointer; color: var(--pc-text-2); font-size: 16px; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

/* ════ MOBILE EXPANDED ════ */
.pc-mob-expanded { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; overflow: hidden; }
.pc-mob-expanded > .llamp-root { z-index: 0; }
.pc-mob-dark-overlay { position: absolute; inset: 0; z-index: 1; background: rgba(2,2,6,0.44); pointer-events: none; }
.pc-mob-header { position: relative; z-index: 3; display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); background: rgba(0,0,0,0.16); backdrop-filter: blur(16px); }
.pc-mob-header-label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.38); }
.pc-mob-body { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; padding: 28px 24px 32px; flex: 1; overflow-y: auto; }
.pc-mob-art-frame { position: relative; margin-bottom: 28px; flex-shrink: 0; }
.pc-mob-art-glow { position: absolute; inset: -16px; border-radius: 28px; background: radial-gradient(circle,rgba(var(--pc-accent),0.42) 0%,transparent 70%); filter: blur(22px); animation: glowPulse 4s ease-in-out infinite; pointer-events: none; }
.pc-mob-art { display: block; width: min(72vw,300px); height: min(72vw,300px); border-radius: 22px; object-fit: cover; box-shadow: 0 32px 90px rgba(0,0,0,0.68), 0 0 0 1px rgba(255,255,255,0.08); }
.pc-mob-art.playing { animation: artFloat 7s ease-in-out infinite; }
.pc-mob-meta { text-align: center; width: 100%; padding: 0 8px; margin-bottom: 20px; }
.pc-mob-name { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.03em; margin-bottom: 4px; }
.pc-mob-artist { font-size: 14px; color: rgba(255,255,255,0.48); }
.pc-mob-progress { width: 100%; margin-bottom: 24px; }
.pc-mob-ctrl-row { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-bottom: 20px; }
.pc-mob-ctrl-btn { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.5); font-size: 18px; width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.18s, transform 0.15s; position: relative; }
.pc-mob-ctrl-btn:active { transform: scale(0.88); }
.pc-mob-ctrl-btn.active { color: var(--pc-green-bright); }
.pc-mob-play-btn { width: 68px; height: 68px; border-radius: 50%; background: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #000; font-size: 24px; box-shadow: 0 8px 36px rgba(0,0,0,0.5); transition: transform 0.18s, background 0.2s; }
.pc-mob-play-btn:active { transform: scale(0.92); }
.pc-mob-extras { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 8px; }
.pc-mob-vol { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--pc-text-2); cursor: pointer; background: none; border: none; }
.pc-mob-count { font-size: 12px; color: var(--pc-text-3); }
.pc-mob-queue { margin-top: 16px; width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; max-height: 240px; overflow-y: auto; }
.pc-mob-queue-title { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 10px; }

/* ════ MOBILE FULLSCREEN LYRICS ════ */
.pc-mob-lyrics-fs {
  position: fixed; inset: 0; z-index: 60;
  display: flex; flex-direction: column; overflow: hidden;
  transform: translateY(100%);
  transition: transform 0.5s cubic-bezier(0.22,1,0.36,1);
}
.pc-mob-lyrics-fs.open { transform: translateY(0); }
.pc-mob-lyrics-fs > .llamp-root { z-index: 0; }
.pc-mob-lyrics-dark { position: absolute; inset: 0; z-index: 1; background: rgba(2,2,5,0.50); pointer-events: none; }

.pc-mob-lyrics-header {
  position: relative; z-index: 3; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 14px;
  background: rgba(0,0,0,0.2); backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.pc-mob-lyrics-header-info { display: flex; flex-direction: column; gap: 1px; }
.pc-mob-lyrics-label { font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--pc-green-bright); margin-bottom: 2px; }
.pc-mob-lyrics-song { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: #fff; letter-spacing: -0.01em; }
.pc-mob-lyrics-artist { font-size: 11px; color: rgba(255,255,255,0.42); }

.pc-mob-lyrics-body { position: relative; z-index: 2; flex: 1; min-height: 0; overflow: hidden; }

.pc-mob-lyrics-footer {
  position: relative; z-index: 3; flex-shrink: 0;
  padding: 16px 24px 28px;
  background: rgba(0,0,0,0.28); backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255,255,255,0.07);
}
.pc-mob-lyrics-footer-progress { margin-bottom: 14px; }
.pc-mob-lyrics-footer-row { display: flex; align-items: center; justify-content: center; gap: 14px; }
.pc-mob-lyrics-footer-play { width: 54px; height: 54px; border-radius: 50%; background: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #000; font-size: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.4); transition: transform 0.15s, background 0.2s; position: relative; }
.pc-mob-lyrics-footer-play:hover { background: var(--pc-green-bright); }
.pc-mob-lyrics-footer-play:active { transform: scale(0.92); }
.pc-mob-lyrics-footer-btn { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.55); font-size: 20px; width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.15s; }
.pc-mob-lyrics-footer-btn:active { color: #fff; transform: scale(0.88); }

@keyframes bufferSpin { to { transform: rotate(360deg); } }
.pc-buffer-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid transparent; border-top-color: var(--pc-green); animation: bufferSpin 0.7s linear infinite; pointer-events: none; }

@media (max-width: 767px)  { .pc-desktop-bar { display: none !important; } }
@media (min-width: 768px)  { .pc-mobile-bar { display: none !important; } .pc-mob-expanded { display: none !important; } .pc-mob-lyrics-fs { display: none !important; } }
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

  const [accentRGB,     setAccentRGB]     = useState(FALLBACK_COLOR);
  const [showQueue,     setShowQueue]     = useState(false);
  const [showLyrics,    setShowLyrics]    = useState(false);
  const [showMobLyrics, setShowMobLyrics] = useState(false);
  const [liked,         setLiked]         = useState(false);
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
  useEffect(() => { if (!showBackgroundDetail) setShowMobLyrics(false); }, [showBackgroundDetail]);

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
      <LavaLampBg accentRGB={accentRGB} intensity={0.88} />
      <div className="pc-exp-dark-overlay" />
      <div className="pc-exp-header">
        <button className="pc-icon-btn" onClick={() => setShowBackgroundDetail(false)}>
          <FaChevronDown style={{ fontSize: 18 }} />
        </button>
        <span className="pc-exp-header-title">Now Playing</span>
        <div className="pc-exp-header-btns">
          <button className={`pc-icon-btn pc-heart-btn ${liked ? 'liked' : ''}`} onClick={() => setLiked(l => !l)}><FaHeart /></button>
          <button className="pc-icon-btn" style={{ color: showLyrics ? 'var(--pc-green-bright)' : undefined }} onClick={() => showLyrics ? setShowLyrics(false) : openLyrics()} title="Lyrics"><FaMusic /></button>
          <button className="pc-icon-btn" style={{ color: showQueue ? 'var(--pc-green-bright)' : undefined }} onClick={() => showQueue ? setShowQueue(false) : openQueue()} title="Queue"><FaList /></button>
          <button className="pc-icon-btn"><FaEllipsisH /></button>
        </div>
      </div>
      <div className="pc-exp-body">
        {/* Left: art + controls */}
        <div className="pc-art-col">
          <div className="pc-art-frame">
            <div className="pc-art-glow" />
            <img src={currentSong.cover || FALLBACK_COVER} alt={currentSong.name} className={`pc-art-img ${isPlaying ? 'playing' : ''}`} onError={e => { e.target.src = FALLBACK_COVER; }} />
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

        {/* Right: lyrics */}
        {showLyrics && (
          <div className="pc-lyrics-col">
            <div className="pc-lyrics-col-header">
              <div>
                <div className="pc-lyrics-col-label">Lyrics</div>
                <div className="pc-lyrics-col-song">{currentSong.name}</div>
                <div className="pc-lyrics-col-artist">{currentSong.artist}</div>
              </div>
              <button onClick={() => setShowLyrics(false)} className="pc-icon-btn"><FaTimes /></button>
            </div>
            <div className="pc-lyrics-col-body">
              <LyricsPanel accentColor={accent} bg="transparent" fontSize="large" />
            </div>
          </div>
        )}

        {/* Right: queue */}
        {showQueue && (
          <QueuePanel songs={songs} currentIndex={currentIndex} onSelect={setCurrentIndex} onClose={() => setShowQueue(false)} />
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
            {currentSong && <span className="pc-lyrics-drawer-song">{currentSong.name}{currentSong.artist ? ` · ${currentSong.artist}` : ''}</span>}
          </div>
          <button className="pc-icon-btn" onClick={() => setShowLyrics(false)}><FaTimes style={{ fontSize: 11 }} /></button>
        </div>
        <div className="pc-lyrics-drawer-body">
          <LyricsPanel accentColor={accent} bg="rgba(6,6,10,0.96)" />
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
              <span>{fmt(currentTime)}</span><span className="pc-time-sep">·</span><span>{duration > 0 ? fmt(duration) : '--:--'}</span>
            </div>
          </div>
          <div className="pc-right">
            <VolumeSlider volume={volume} isMuted={isMuted} onVolume={setVolume} onMute={toggleMute} />
            <button onClick={() => showLyrics ? setShowLyrics(false) : openLyrics()} style={{ background: showLyrics ? 'var(--pc-green)' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#fff', fontSize: 13, transition: 'background 0.2s' }} title="Lyrics"><FaMusic style={{ fontSize: 12 }} /></button>
            <button onClick={() => showQueue ? setShowQueue(false) : openQueue()} style={{ background: showQueue ? 'var(--pc-green)' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#fff', fontSize: 13, transition: 'background 0.2s' }} title="Queue"><FaList style={{ fontSize: 11 }} /></button>
            <button className="pc-icon-btn" onClick={() => setShowBackgroundDetail(true)} title="Expand"><FaChevronDown style={{ transform: 'rotate(180deg)', fontSize: 12 }} /></button>
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
          <button className="pc-mobile-next" onClick={e => { e.stopPropagation(); playNext(); }}><FaStepForward /></button>
        </div>
      </div>
    </div>
  );

  /* ── mobile expanded (Now Playing) ── */
  const mobileExpanded = showBackgroundDetail && (
    <div className="pc-mob-expanded" style={accentStyle}>
      <LavaLampBg accentRGB={accentRGB} intensity={0.82} />
      <div className="pc-mob-dark-overlay" />
      <div className="pc-mob-header">
        <button className="pc-icon-btn" onClick={() => setShowBackgroundDetail(false)}><FaChevronDown style={{ fontSize: 18 }} /></button>
        <span className="pc-mob-header-label">Now Playing</span>
        <button className="pc-icon-btn"><FaEllipsisH /></button>
      </div>
      <div className="pc-mob-body">
        <div className="pc-mob-art-frame">
          <div className="pc-mob-art-glow" />
          <img src={currentSong.cover || FALLBACK_COVER} alt={currentSong.name} className={`pc-mob-art ${isPlaying ? 'playing' : ''}`} onError={e => { e.target.src = FALLBACK_COVER; }} />
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
            <FaRedoAlt />{repeatMode === 'one' && <span className="pc-repeat-badge">1</span>}
          </button>
        </div>
        <div className="pc-mob-extras">
          <button className="pc-mob-vol" onClick={toggleMute}>
            {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
            <span style={{ marginLeft: 6 }}>{isMuted ? '0' : Math.round(volume * 100)}%</span>
          </button>
          <span className="pc-mob-count">{currentIndex + 1} / {songs.length}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="pc-icon-btn" style={{ color: showMobLyrics ? 'var(--pc-green-bright)' : undefined }} onClick={() => setShowMobLyrics(true)} aria-label="Show lyrics"><FaMusic /></button>
            <button className="pc-icon-btn" style={{ color: showQueue ? 'var(--pc-green-bright)' : undefined }} onClick={() => setShowQueue(q => !q)} aria-label="Queue"><FaList /></button>
          </div>
        </div>
        {showQueue && (
          <div className="pc-mob-queue">
            <div className="pc-mob-queue-title">Queue</div>
            {songs.map((song, idx) => (
              <div key={song.id || idx} className={`pc-queue-item ${idx === currentIndex ? 'active' : ''}`} onClick={() => setCurrentIndex(idx)}>
                <img src={song.cover || FALLBACK_COVER} alt={song.name} className="pc-queue-thumb" onError={e => { e.target.src = FALLBACK_COVER; }} />
                <div className="pc-queue-meta"><p className="pc-queue-name">{song.name}</p><p className="pc-queue-artist">{song.artist}</p></div>
                {idx === currentIndex && <div className="pc-queue-active-dot" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /* ── mobile fullscreen lyrics ── */
  const mobileLyricsFs = (
    <div className={`pc-mob-lyrics-fs ${showMobLyrics ? 'open' : ''}`} style={accentStyle}>
      <LavaLampBg accentRGB={accentRGB} intensity={1.0} />
      <div className="pc-mob-lyrics-dark" />
      <div className="pc-mob-lyrics-header">
        <div className="pc-mob-lyrics-header-info">
          <span className="pc-mob-lyrics-label">Lyrics</span>
          <span className="pc-mob-lyrics-song">{currentSong?.name}</span>
          <span className="pc-mob-lyrics-artist">{currentSong?.artist}</span>
        </div>
        <button className="pc-icon-btn" onClick={() => setShowMobLyrics(false)} aria-label="Close lyrics" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}>
          <FaChevronDown />
        </button>
      </div>
      <div className="pc-mob-lyrics-body">
        <LyricsPanel accentColor={accent} bg="transparent" fontSize="large" />
      </div>
      <div className="pc-mob-lyrics-footer">
        <div className="pc-mob-lyrics-footer-progress">
          <ProgressBar currentTime={currentTime} duration={duration} onSeek={handleSeek} showTimes thick />
        </div>
        <div className="pc-mob-lyrics-footer-row">
          <button className="pc-mob-lyrics-footer-btn" onClick={playPrev}><FaStepBackward /></button>
          <button className="pc-mob-lyrics-footer-play" onClick={togglePlay} style={{ position: 'relative' }}>
            {isBuffering ? <div className="pc-buffer-ring" /> : isPlaying ? <FaPause /> : <FaPlay style={{ marginLeft: 2 }} />}
          </button>
          <button className="pc-mob-lyrics-footer-btn" onClick={playNext}><FaStepForward /></button>
        </div>
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
      {mobileLyricsFs}
    </div>
  );
}