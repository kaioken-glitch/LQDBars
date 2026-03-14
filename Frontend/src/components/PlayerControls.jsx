import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  FaPlay, FaPause, FaStepBackward, FaStepForward,
  FaRandom, FaRedoAlt, FaVolumeUp, FaVolumeMute,
  FaChevronDown, FaEllipsisH, FaHeart, FaList, FaTimes, FaMusic,
} from 'react-icons/fa';
import * as THREE from 'three';
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

/* ─── ColorBends WebGL Background ───────────────────────────────── */
const MAX_COLORS = 8;
const CB_FRAG = `
#define MAX_COLORS ${MAX_COLORS}
uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform int uColorCount;
uniform vec3 uColors[MAX_COLORS];
uniform int uTransparent;
uniform float uScale;
uniform float uFrequency;
uniform float uWarpStrength;
uniform vec2 uPointer;
uniform float uMouseInfluence;
uniform float uParallax;
uniform float uNoise;
varying vec2 vUv;
void main() {
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;
  p += uPointer * uParallax * 0.1;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= max(uScale, 0.0001);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;
  vec2 toward = (uPointer - rp);
  q += toward * uMouseInfluence * 0.2;
  vec3 col = vec3(0.0);
  float a = 1.0;
  if (uColorCount > 0) {
    vec2 s = q;
    vec3 sumCol = vec3(0.0);
    float cover = 0.0;
    for (int i = 0; i < MAX_COLORS; ++i) {
      if (i >= uColorCount) break;
      s -= 0.01;
      vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
      float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
      float kBelow = clamp(uWarpStrength, 0.0, 1.0);
      float kMix = pow(kBelow, 0.3);
      float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
      vec2 disp = (r - s) * kBelow;
      vec2 warped = s + disp * gain;
      float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
      float m = mix(m0, m1, kMix);
      float w = 1.0 - exp(-6.0 / exp(6.0 * m));
      sumCol += uColors[i] * w;
      cover = max(cover, w);
    }
    col = clamp(sumCol, 0.0, 1.0);
    a = uTransparent > 0 ? cover : 1.0;
  } else {
    vec2 s = q;
    for (int k = 0; k < 3; ++k) {
      s -= 0.01;
      vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
      float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);
      float kBelow = clamp(uWarpStrength, 0.0, 1.0);
      float kMix = pow(kBelow, 0.3);
      float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
      vec2 disp = (r - s) * kBelow;
      vec2 warped = s + disp * gain;
      float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);
      float m = mix(m0, m1, kMix);
      col[k] = 1.0 - exp(-6.0 / exp(6.0 * m));
    }
    a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;
  }
  if (uNoise > 0.0001) {
    float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
    col += (n - 0.5) * uNoise;
    col = clamp(col, 0.0, 1.0);
  }
  vec3 rgb = (uTransparent > 0) ? col * a : col;
  gl_FragColor = vec4(rgb, a);
}
`;
const CB_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

/* Convert "r, g, b" (0-255) string → array of hex color strings */
function accentToColors(accentRGB) {
  const [r, g, b] = (accentRGB || '29, 185, 84').split(',').map(Number);
  const toHex = (rv, gv, bv) =>
    '#' + [rv, gv, bv].map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0')).join('');
  return [
    toHex(r, g, b),                                           // primary accent
    toHex(b * 0.85, r * 0.3, g * 0.7),                       // complementary
    toHex(r * 0.35, g * 0.18, b * 0.9),                      // deep cool shadow
    toHex(r * 0.6, g * 0.5, b * 0.4),                        // warm mid
  ];
}

function ColorBendsBg({ accentRGB }) {
  const containerRef        = useRef(null);
  const rendererRef         = useRef(null);
  const rafRef              = useRef(null);
  const materialRef         = useRef(null);
  const resizeObserverRef   = useRef(null);
  const pointerTargetRef    = useRef(new THREE.Vector2(0, 0));
  const pointerCurrentRef   = useRef(new THREE.Vector2(0, 0));

  // Rebuild scene when accentRGB changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const colors = accentToColors(accentRGB);

    const scene    = new THREE.Scene();
    const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uColorsArray = Array.from({ length: MAX_COLORS }, () => new THREE.Vector3(0, 0, 0));
    const toVec3 = hex => {
      const h = hex.replace('#', '');
      return new THREE.Vector3(
        parseInt(h.slice(0,2),16)/255,
        parseInt(h.slice(2,4),16)/255,
        parseInt(h.slice(4,6),16)/255
      );
    };
    const colorVecs = colors.slice(0, MAX_COLORS).map(toVec3);
    colorVecs.forEach((v,i) => uColorsArray[i].copy(v));

    const material = new THREE.ShaderMaterial({
      vertexShader: CB_VERT,
      fragmentShader: CB_FRAG,
      uniforms: {
        uCanvas:        { value: new THREE.Vector2(1, 1) },
        uTime:          { value: 0 },
        uSpeed:         { value: 0.16 },
        uRot:           { value: new THREE.Vector2(1, 0) },
        uColorCount:    { value: colorVecs.length },
        uColors:        { value: uColorsArray },
        uTransparent:   { value: 0 },
        uScale:         { value: 1.1 },
        uFrequency:     { value: 0.9 },
        uWarpStrength:  { value: 1.3 },
        uPointer:       { value: new THREE.Vector2(0, 0) },
        uMouseInfluence:{ value: 0.55 },
        uParallax:      { value: 0.4 },
        uNoise:         { value: 0.05 },
      },
      premultipliedAlpha: true,
      transparent: false,
    });
    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
    });
    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.appendChild(renderer.domElement);

    const handleResize = () => {
      const w = container.clientWidth  || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      material.uniforms.uCanvas.value.set(w, h);
    };
    handleResize();

    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
    resizeObserverRef.current = ro;

    const clock = new THREE.Clock();
    const loop = () => {
      const dt      = clock.getDelta();
      const elapsed = clock.elapsedTime;
      material.uniforms.uTime.value = elapsed;
      // Slow gentle rotation
      const rad = (elapsed * 3) * Math.PI / 180;
      material.uniforms.uRot.value.set(Math.cos(rad), Math.sin(rad));
      // Smooth pointer lerp
      pointerCurrentRef.current.lerp(pointerTargetRef.current, Math.min(1, dt * 6));
      material.uniforms.uPointer.value.copy(pointerCurrentRef.current);
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const onPointerMove = e => {
      const rect = container.getBoundingClientRect();
      pointerTargetRef.current.set(
        ((e.clientX - rect.left)  / (rect.width  || 1)) * 2 - 1,
        -(((e.clientY - rect.top) / (rect.height || 1)) * 2 - 1)
      );
    };
    container.addEventListener('pointermove', onPointerMove);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [accentRGB]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}
    />
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

/* Iridescence canvas fills the container div absolutely via JS — no extra CSS needed */
/* Dark scrim overlays are handled by .pc-exp-dark-overlay / .pc-mob-dark-overlay / .pc-mob-lyrics-dark */

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

/* ════ DESKTOP EXPANDED — full-screen lyrics, controls at bottom ════ */
.pc-expanded {
  position: fixed; inset: 0; z-index: 50;
  display: flex; flex-direction: column; overflow: hidden;
}
.pc-exp-dark-overlay {
  position: absolute; inset: 0; z-index: 1;
  background: rgba(2,2,6,0.45); pointer-events: none;
}

/* Header: just the nav strip */
.pc-exp-header {
  position: relative; z-index: 3;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 28px;
  background: rgba(0,0,0,0.12); backdrop-filter: blur(24px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.pc-exp-header-title {
  font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
  color: rgba(255,255,255,0.38); font-weight: 600;
}
.pc-exp-header-btns { display: flex; align-items: center; gap: 6px; }

/* Body: lyrics take everything between header and footer */
.pc-exp-body {
  position: relative; z-index: 2;
  display: flex; flex-direction: column; flex: 1;
  overflow: hidden; min-height: 0;
}

/* Full-width transparent lyrics area */
.pc-exp-lyrics-area {
  flex: 1; min-height: 0; overflow: hidden; position: relative;
  /* transparent — shader shows through */
}

/* Footer: controls bar pinned to bottom */
.pc-exp-footer {
  position: relative; z-index: 3; flex-shrink: 0;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 16px 40px 24px;
  background: rgba(0,0,0,0.22); backdrop-filter: blur(28px);
  border-top: 1px solid rgba(255,255,255,0.07);
}
.pc-exp-footer-meta {
  display: flex; align-items: center; gap: 16px; width: 100%; max-width: 640px;
}
.pc-exp-footer-thumb {
  width: 44px; height: 44px; border-radius: 10px; object-fit: cover; flex-shrink: 0;
  box-shadow: 0 4px 18px rgba(0,0,0,0.5);
}
.pc-exp-footer-text { flex: 1; min-width: 0; }
.pc-exp-footer-name {
  font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
  color: #fff; letter-spacing: -0.01em; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;
}
.pc-exp-footer-artist { font-size: 12px; color: rgba(255,255,255,0.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-exp-footer-heart { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.3); font-size: 14px; padding: 6px; border-radius: 50%; transition: color 0.2s, transform 0.15s; flex-shrink: 0; }
.pc-exp-footer-heart:hover { color: #FF4455; transform: scale(1.2); }
.pc-exp-footer-heart.liked { color: #FF4455; }

.pc-exp-progress { width: 100%; max-width: 640px; }
.pc-exp-ctrl-row { display: flex; align-items: center; gap: 10px; }
.pc-exp-ctrl-btn {
  background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.5);
  font-size: 17px; width: 46px; height: 46px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.18s, background 0.18s, transform 0.15s; position: relative;
}
.pc-exp-ctrl-btn:hover  { color: #fff; background: rgba(255,255,255,0.08); }
.pc-exp-ctrl-btn.active { color: var(--pc-green-bright); }
.pc-exp-ctrl-btn:active { transform: scale(0.9); }
.pc-exp-play-btn {
  width: 62px; height: 62px; border-radius: 50%; background: #fff; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: #000; font-size: 22px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.45); transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
}
.pc-exp-play-btn:hover  { transform: scale(1.07); background: var(--pc-green-bright); box-shadow: 0 12px 44px rgba(29,185,84,0.45); }
.pc-exp-play-btn:active { transform: scale(0.95); }
.pc-exp-footer-right { display: flex; align-items: center; gap: 8px; }

/* art/glow kept for mobile — unused in desktop expanded now but keep classes */
.pc-art-frame { position: relative; }
.pc-art-glow { position: absolute; inset: -20px; border-radius: 32px; background: radial-gradient(circle, rgba(var(--pc-accent),0.42) 0%, transparent 70%); filter: blur(30px); animation: glowPulse 4s ease-in-out infinite; }
@keyframes glowPulse { 0%,100%{opacity:0.62;transform:scale(1)} 50%{opacity:1;transform:scale(1.06)} }
.pc-art-img { position: relative; display: block; border-radius: 22px; object-fit: cover; }
.pc-art-img.playing { animation: artFloat 7s ease-in-out infinite; }
@keyframes artFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

/* Queue panel — floats as overlay on right when open */
.pc-queue {
  position: absolute; right: 24px; top: 0; bottom: 0; z-index: 5;
  width: 300px; flex-shrink: 0;
  background: rgba(8,8,14,0.82); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 0; display: flex; flex-direction: column; overflow: hidden;
  backdrop-filter: blur(32px);
  animation: slideInRight 0.28s cubic-bezier(0.22,1,0.36,1);
}
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

@keyframes slideInRight { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }

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

  /* ── desktop expanded — full-screen lyrics, controls at bottom ── */
  const desktopExpanded = showBackgroundDetail && (
    <div className="pc-expanded pc-desktop-bar" style={accentStyle}>
      <ColorBendsBg accentRGB={accentRGB} />
      <div className="pc-exp-dark-overlay" />

      {/* Top nav strip */}
      <div className="pc-exp-header">
        <button className="pc-icon-btn" onClick={() => setShowBackgroundDetail(false)}>
          <FaChevronDown style={{ fontSize: 18 }} />
        </button>
        <span className="pc-exp-header-title">Now Playing</span>
        <div className="pc-exp-header-btns">
          <button
            className="pc-icon-btn"
            style={{ color: showQueue ? 'var(--pc-green-bright)' : undefined }}
            onClick={() => setShowQueue(q => !q)}
            title="Queue"
          ><FaList /></button>
          <button className="pc-icon-btn"><FaEllipsisH /></button>
        </div>
      </div>

      {/* Body: full-width transparent lyrics */}
      <div className="pc-exp-body">
        <div className="pc-exp-lyrics-area">
          <LyricsPanel accentColor={accent} bg="transparent" fontSize="large" />
        </div>

        {/* Queue overlay panel */}
        {showQueue && (
          <QueuePanel
            songs={songs}
            currentIndex={currentIndex}
            onSelect={setCurrentIndex}
            onClose={() => setShowQueue(false)}
          />
        )}
      </div>

      {/* Footer: mini thumb + song info + full controls */}
      <div className="pc-exp-footer">
        {/* Song identity row */}
        <div className="pc-exp-footer-meta">
          <img
            src={currentSong.cover || FALLBACK_COVER}
            alt={currentSong.name}
            className="pc-exp-footer-thumb"
            onError={e => { e.target.src = FALLBACK_COVER; }}
          />
          <div className="pc-exp-footer-text">
            <div className="pc-exp-footer-name">{currentSong.name}</div>
            <div className="pc-exp-footer-artist">{currentSong.artist}</div>
          </div>
          <button className={`pc-exp-footer-heart ${liked ? 'liked' : ''}`} onClick={() => setLiked(l => !l)}>
            <FaHeart />
          </button>
          <VolumeSlider volume={volume} isMuted={isMuted} onVolume={setVolume} onMute={toggleMute} />
          <span className="pc-track-count">{currentIndex + 1} / {songs.length}</span>
        </div>

        {/* Progress */}
        <div className="pc-exp-progress">
          <ProgressBar currentTime={currentTime} duration={duration} onSeek={handleSeek} showTimes thick />
        </div>

        {/* Playback controls */}
        <div className="pc-exp-ctrl-row">
          <button className={`pc-exp-ctrl-btn ${shuffle ? 'active' : ''}`} onClick={toggleShuffle}><FaRandom /></button>
          <button className="pc-exp-ctrl-btn" onClick={playPrev}><FaStepBackward style={{ fontSize: 22 }} /></button>
          <button className="pc-exp-play-btn" onClick={togglePlay} style={{ position: 'relative' }}>
            {isBuffering ? <div className="pc-buffer-ring" /> : isPlaying ? <FaPause /> : <FaPlay style={{ marginLeft: 3 }} />}
          </button>
          <button className="pc-exp-ctrl-btn" onClick={playNext}><FaStepForward style={{ fontSize: 22 }} /></button>
          <RepeatBtn mode={repeatMode} onToggle={toggleRepeatMode} />
        </div>
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
      <ColorBendsBg accentRGB={accentRGB} />
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
      <ColorBendsBg accentRGB={accentRGB} />
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