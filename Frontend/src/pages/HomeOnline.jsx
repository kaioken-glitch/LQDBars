import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { FaSearch, FaStar, FaHeart, FaPlay, FaTimes, FaRandom, FaPause } from 'react-icons/fa';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleArrowDown, faChevronLeft, faEllipsisH, faFire, faCompactDisc, faBolt } from '@fortawesome/free-solid-svg-icons';
import { fetchSongs, patchSong as apiPatchSong } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import PlayerControls from '../components/PlayerControls';
import youtubeConverter from '../utils/youtubeConverter';
import Loader from '../utils/Splashscreen';

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────────────── */

const GENRES      = ['All', 'Hip-Hop', 'Pop', 'Rock', 'Jazz', 'Electronic', 'Classical', 'R&B', 'Blues'];
const PLAYLISTS   = [
  { id: 'indie-folk-mix',     name: 'Indie Folk Mix',      artist: 'Curated',  description: 'Soft acoustic vibes',  cover: 'https://placehold.co/400x400/8B4513/FFFFFF?text=Indie+Folk',  accent: '#C4884F', type: 'playlist' },
  { id: 'underground-hiphop', name: 'Underground Hip-Hop', artist: 'Curated',  description: 'Raw lyricism & beats', cover: 'https://placehold.co/400x400/2F4F4F/FFFFFF?text=Underground',  accent: '#4ECDC4', type: 'playlist' },
  { id: 'edm-bangers',        name: 'EDM Bangers',         artist: 'Curated',  description: 'Festival anthems',     cover: 'https://placehold.co/400x400/00CED1/FFFFFF?text=EDM',          accent: '#00CED1', type: 'playlist' },
  { id: '8-bit-vibes',        name: '8‑Bit Vibes',         artist: 'Curated',  description: 'Chiptune & retro',     cover: 'https://placehold.co/400x400/FFD700/000000?text=8-Bit',        accent: '#FFD700', type: 'playlist' },
];
const ALBUMS = [
  { id: 'album-damn',             name: 'DAMN.',                artist: 'Kendrick Lamar',       cover: 'https://placehold.co/400x400/800000/FFFFFF?text=DAMN.',              accent: '#B71C1C', type: 'album' },
  { id: 'album-brent',            name: 'Wasteland',            artist: 'Brent Faiyaz',         cover: 'https://placehold.co/400x400/228B22/FFFFFF?text=Wasteland',          accent: '#2E7D32', type: 'album' },
  { id: 'album-future',           name: 'I NEVER LIKED YOU',    artist: 'Future',               cover: 'https://placehold.co/400x400/000080/FFFFFF?text=INLY',               accent: '#1565C0', type: 'album' },
  { id: 'album-don',              name: 'Life of a DON',        artist: 'Don Toliver',          cover: 'https://placehold.co/400x400/FF8C00/FFFFFF?text=Life+of+a+DON',      accent: '#E65100', type: 'album' },
  { id: 'album-living-tombstone', name: 'The Living Tombstone', artist: 'The Living Tombstone', cover: 'https://placehold.co/400x400/4B0082/FFFFFF?text=TLT',                accent: '#6A1B9A', type: 'album' },
  { id: 'album-nina',             name: 'I Put a Spell on You', artist: 'Nina Simone',          cover: 'https://placehold.co/400x400/111/FFFFFF?text=Nina+Simone',           accent: '#9E9E9E', type: 'album' },
  { id: 'album-etta',             name: 'At Last!',             artist: 'Etta James',           cover: 'https://placehold.co/400x400/708090/FFFFFF?text=At+Last',            accent: '#78909C', type: 'album' },
];
const SUGGESTIONS = [
  { id: 'sg-luther',      name: 'luther',           artist: 'Kendrick Lamar',       cover: 'https://placehold.co/400x400/663399/FFFFFF?text=luther',       accent: '#9C27B0', type: 'suggestion' },
  { id: 'sg-skyami',      name: 'SKYAMI',           artist: 'Don Toliver',          cover: 'https://placehold.co/400x400/FF6347/FFFFFF?text=SKYAMI',       accent: '#FF6347', type: 'suggestion' },
  { id: 'sg-wait-for-u', name: 'Wait For U',        artist: 'Future ft. Drake',     cover: 'https://placehold.co/400x400/4682B4/FFFFFF?text=Wait+For+U',   accent: '#42A5F5', type: 'suggestion' },
  { id: 'sg-gravity',    name: 'Gravity',           artist: 'Brent Faiyaz',         cover: 'https://placehold.co/400x400/DAA520/FFFFFF?text=Gravity',      accent: '#FFA726', type: 'suggestion' },
  { id: 'sg-mc-calm',    name: 'Minecraft Calming', artist: 'C418',                 cover: 'https://placehold.co/400x400/228B22/FFFFFF?text=Minecraft',    accent: '#66BB6A', type: 'suggestion' },
  { id: 'sg-pokemon',    name: 'Pokémon Center',    artist: 'Junichi Masuda',       cover: 'https://placehold.co/400x400/FF1493/000000?text=Pok%C3%A9mon', accent: '#EC407A', type: 'suggestion' },
  { id: 'sg-bad-guy',    name: 'Bad Guy',           artist: 'The Living Tombstone', cover: 'https://placehold.co/400x400/DC143C/FFFFFF?text=Bad+Guy',      accent: '#EF5350', type: 'suggestion' },
  { id: 'sg-stressed',   name: 'Stressed Out',      artist: 'Twenty One Pilots',    cover: 'https://placehold.co/400x400/696969/FFFFFF?text=Stressed+Out', accent: '#9E9E9E', type: 'suggestion' },
  { id: 'sg-feeling',    name: 'Feeling Good',      artist: 'Nina Simone',          cover: 'https://placehold.co/400x400/2E8B57/FFFFFF?text=Feeling+Good', accent: '#26A69A', type: 'suggestion' },
  { id: 'sg-at-last',    name: 'At Last',           artist: 'Etta James',           cover: 'https://placehold.co/400x400/CD5C5C/FFFFFF?text=At+Last',      accent: '#EF5350', type: 'suggestion' },
];
const NEW_RELEASES = [
  { id: 'nr-chroma',   name: 'CHROMAKOPIA',       artist: 'Tyler, The Creator',    cover: 'https://placehold.co/400x400/FFD700/000000?text=CHROMAKOPIA',           accent: '#FFD700', type: 'new-release', badge: 'NEW' },
  { id: 'nr-bando',    name: 'Bando Stone',        artist: 'Childish Gambino',      cover: 'https://placehold.co/400x400/FF4500/FFFFFF?text=Bando+Stone',           accent: '#FF4500', type: 'new-release', badge: 'NEW' },
  { id: 'nr-trust',    name: "We Don't Trust You", artist: 'Future & Metro Boomin', cover: "https://placehold.co/400x400/8A2BE2/FFFFFF?text=We+Don't+Trust+You",   accent: '#7B1FA2', type: 'new-release', badge: 'HOT' },
  { id: 'nr-vultures', name: 'Vultures 2',         artist: '¥$',                   cover: 'https://placehold.co/400x400/2F4F4F/FFFFFF?text=Vultures+2',            accent: '#546E7A', type: 'new-release', badge: 'HOT' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   useAudioAnalyser — connects Web Audio AnalyserNode to audioRef
   Returns a ref to a Uint8Array of frequency data (0–255, FFT size 64)
   and a boolean `connected`.

   For YouTube (cross-origin iframe) we CANNOT tap the audio stream,
   so we generate a plausible fake signal driven by currentTime,
   making it feel reactive without violating CORS.
───────────────────────────────────────────────────────────────────────────── */
function useAudioAnalyser({ audioRef, isPlaying, currentSong, currentTime }) {
  const ctxRef      = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef   = useRef(null);
  const dataRef     = useRef(new Uint8Array(32));
  const rafRef      = useRef(null);
  const [tick, setTick] = useState(0); // force re-renders

  const isYT = currentSong
    ? currentSong.source === 'youtube' ||
      Boolean(currentSong.youtubeId) ||
      [currentSong.streamUrl, currentSong.audio, currentSong.url].some(
        f => f?.includes('youtube.com') || f?.includes('youtu.be')
      )
    : false;

  // ── Real Web Audio path (local audio files) ──
  useEffect(() => {
    if (isYT) return;
    const audio = audioRef?.current;
    if (!audio) return;

    // Lazy-create AudioContext
    if (!ctxRef.current) {
      try {
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) { return; }
    }
    const ctx = ctxRef.current;

    // Resume if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    // Disconnect old source if audio element changed
    if (sourceRef.current && sourceRef.current.mediaElement !== audio) {
      try { sourceRef.current.disconnect(); } catch (_) {}
      sourceRef.current = null;
    }

    // Create source node once per audio element
    if (!sourceRef.current) {
      try {
        sourceRef.current = ctx.createMediaElementSource(audio);
      } catch (_) {
        // Already connected elsewhere — skip
        return;
      }
    }

    // Analyser
    if (!analyserRef.current) {
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize        = 64;
      analyserRef.current.smoothingTimeConstant = 0.75;
    }

    // Wire: source → analyser → destination (speakers)
    try {
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(ctx.destination);
    } catch (_) {}

    dataRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

    return () => {
      // Don't disconnect on every render — only on unmount
    };
  }, [audioRef, isYT]);

  // ── RAF loop ──
  useEffect(() => {
    const loop = () => {
      if (analyserRef.current && !isYT) {
        analyserRef.current.getByteFrequencyData(dataRef.current);
      } else if (isYT) {
        // Synthesise plausible frequency data from currentTime
        // Uses a set of oscillators at musical intervals to mimic real audio
        const t = currentTime || 0;
        const arr = dataRef.current;
        const playing = isPlaying ? 1 : 0;
        for (let i = 0; i < arr.length; i++) {
          // low freqs: strong bass pulse
          const bass   = Math.abs(Math.sin(t * 2.1 + i * 0.3)) * 180 * playing;
          // mid freqs: melody wobble
          const mid    = Math.abs(Math.sin(t * 3.7 + i * 0.7 + 1)) * 120 * playing;
          // high freqs: lighter shimmer
          const treble = Math.abs(Math.sin(t * 6.2 + i * 1.4 + 2)) * 60 * playing;
          // weight by frequency band
          const frac   = i / arr.length;
          arr[i] = Math.round(
            (bass   * (1 - frac) * 0.6 +
             mid    * Math.sin(frac * Math.PI) * 0.6 +
             treble * frac * 0.4) * (0.6 + 0.4 * Math.sin(t * 1.3 + i))
          );
        }
      } else {
        // Idle — decay to zero
        const arr = dataRef.current;
        for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, arr[i] - 8);
      }
      setTick(n => n + 1);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isYT, isPlaying, currentTime]);

  return { dataRef, isYT };
}

/* ─────────────────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────────────────── */
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  :root {
    --green: #1DB954;
    --green-bright: #23E065;
    --green-dim: rgba(29,185,84,0.15);
    --surface: rgba(255,255,255,0.04);
    --border: rgba(255,255,255,0.08);
    --text-1: #FFFFFF;
    --text-2: rgba(255,255,255,0.55);
    --text-3: rgba(255,255,255,0.30);
    --bg: rgba(29,185,84,0.15);
    --radius-card: 16px;
    --radius-pill: 9999px;
    --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ho-root *, .ho-root *::before, .ho-root *::after { box-sizing: border-box; }
  .ho-root {
    font-family: 'DM Sans', sans-serif;
    color: var(--text-1);
    -webkit-font-smoothing: antialiased;
  }
  .ho-root h1, .ho-root h2, .ho-root h3, .ho-root .syne { font-family: 'Syne', sans-serif; }

  .ho-root ::-webkit-scrollbar { width: 4px; height: 4px; }
  .ho-root ::-webkit-scrollbar-track { background: transparent; }
  .ho-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

  .glass-pill { background: var(--surface); border: 1px solid var(--border); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }

  .music-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
    overflow: hidden; position: relative; cursor: pointer;
  }
  .music-card:hover { transform: translateY(-4px) scale(1.01); border-color: rgba(29,185,84,0.3); box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(29,185,84,0.08); }
  .music-card .play-btn {
    position: absolute; bottom: 14px; right: 14px;
    width: 40px; height: 40px; border-radius: 50%;
    background: var(--green); border: none;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transform: translateY(8px);
    transition: opacity var(--transition), transform var(--transition), background var(--transition), box-shadow var(--transition);
    cursor: pointer; z-index: 2; box-shadow: 0 8px 24px rgba(29,185,84,0.4);
  }
  .music-card:hover .play-btn { opacity: 1; transform: translateY(0); }
  .music-card .play-btn:hover { background: var(--green-bright); transform: scale(1.1); box-shadow: 0 12px 32px rgba(29,185,84,0.6); }

  .search-dropdown { background: #141414; border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 32px 80px rgba(0,0,0,0.7); overflow: hidden; }
  .search-row { padding: 10px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background var(--transition); }
  .search-row:hover { background: rgba(255,255,255,0.06); }

  .section-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .section-heading h2 { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: var(--text-1); }
  .section-heading .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); flex-shrink: 0; }

  .detail-view { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .detail-track { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer; transition: background var(--transition); position: relative; }
  .detail-track:hover { background: rgba(255,255,255,0.06); }
  .detail-track.active { background: rgba(29,185,84,0.12); }
  .detail-track .track-actions { display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity var(--transition); }
  .detail-track:hover .track-actions { opacity: 1; }

  .filter-tabs { display: flex; gap: 8px; padding: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-pill); }
  .filter-tab { padding: 7px 20px; border-radius: var(--radius-pill); font-size: 13px; font-weight: 600; letter-spacing: 0.01em; cursor: pointer; transition: background var(--transition), color var(--transition); border: none; background: transparent; color: var(--text-2); font-family: 'DM Sans', sans-serif; }
  .filter-tab.active { background: var(--green); color: #fff; }

  .genre-chip { padding: 6px 14px; border-radius: var(--radius-pill); font-size: 12px; font-weight: 600; cursor: pointer; transition: background var(--transition), color var(--transition), border-color var(--transition); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); white-space: nowrap; font-family: 'DM Sans', sans-serif; letter-spacing: 0.02em; }
  .genre-chip:hover, .genre-chip.active { background: rgba(29,185,84,0.15); color: var(--green-bright); border-color: rgba(29,185,84,0.4); }

  .badge-new { background: linear-gradient(135deg, #FF4B4B, #FF2D55); color: #fff; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 6px; letter-spacing: 0.05em; }
  .badge-hot { background: linear-gradient(135deg, #FF6B00, #FF4500); color: #fff; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 6px; letter-spacing: 0.05em; }

  @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
  .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%); background-size: 800px 100%; animation: shimmer 1.4s infinite linear; border-radius: 8px; }

  /* OLD CSS bars removed — now replaced by canvas-based real-time visualizer */

  .search-input:focus { outline: none; border-color: rgba(29,185,84,0.5) !important; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .fade-up { animation: fadeUp 0.4s ease both; }

  .gradient-text { background: linear-gradient(135deg, #fff 0%, rgba(29,185,84,0.9) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

  .music-card .card-glow { position: absolute; inset: 0; border-radius: var(--radius-card); pointer-events: none; transition: opacity 0.3s; opacity: 0; }
  .music-card:hover .card-glow { opacity: 1; }

  .cover-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%); opacity: 0; transition: opacity var(--transition); }
  .music-card:hover .cover-overlay { opacity: 1; }

  .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 16px; }
  @media (min-width: 640px)  { .cards-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); } }
  @media (min-width: 1024px) { .cards-grid { grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); } }
  @media (min-width: 1280px) { .cards-grid { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); } }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Visualizer canvas ── */
  .viz-canvas { display: block; image-rendering: pixelated; }

  /* ── Now-playing glow pulse on active cards ── */
  @keyframes cardPulse { 0%,100%{box-shadow:0 0 0 0 rgba(29,185,84,0)} 50%{box-shadow:0 0 24px 4px rgba(29,185,84,0.22)} }
  .music-card.now-playing { animation: cardPulse 2s ease-in-out infinite; border-color: rgba(29,185,84,0.35) !important; }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   VISUALIZER COMPONENTS
───────────────────────────────────────────────────────────────────────────── */

/**
 * MiniVisualizer — tiny bar chart used inside card overlays and track rows.
 * Reads from shared dataRef passed down from root.
 * barCount: how many bars to show (we sample evenly across freq bins).
 */
const MiniVisualizer = memo(({ dataRef, isPlaying, color = '#1DB954', barCount = 5, width = 22, height = 16 }) => {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const dpr    = window.devicePixelRatio || 1;
    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const barW   = (width - (barCount - 1) * 1.5) / barCount;
    const minH   = 2;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const data = dataRef.current;
      const step = Math.max(1, Math.floor(data.length / barCount));

      for (let i = 0; i < barCount; i++) {
        const val  = data[Math.min(i * step, data.length - 1)] / 255;
        const barH = Math.max(minH, val * (height - 2));
        const x    = i * (barW + 1.5);
        const y    = height - barH;

        // Gradient: accent → bright
        const grad = ctx.createLinearGradient(0, y, 0, height);
        grad.addColorStop(0, color + 'CC');
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 1.5);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [dataRef, barCount, width, height, color]);

  return (
    <canvas
      ref={canvasRef}
      className="viz-canvas"
      style={{ width, height }}
    />
  );
});

/**
 * SpectrumVisualizer — full-width canvas bar spectrum for the detail hero.
 * Mirrors bars left+right from center for a symmetric effect.
 */
const SpectrumVisualizer = memo(({ dataRef, isPlaying, accent = '#1DB954', height = 56 }) => {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const wrapRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width  = wrap.offsetWidth  * dpr;
      canvas.height = height * dpr;
      canvas.style.width  = wrap.offsetWidth + 'px';
      canvas.style.height = height + 'px';
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const draw = () => {
      const W = wrap.offsetWidth;
      const H = height;
      ctx.clearRect(0, 0, W, H);

      const data   = dataRef.current;
      const bins   = data.length;
      const half   = Math.floor(bins / 2);   // use first half → mirror
      const barW   = (W / 2) / half - 1;
      const centerX = W / 2;

      for (let i = 0; i < half; i++) {
        const val  = data[i] / 255;
        const barH = Math.max(2, val * H * 0.9);
        const y    = H - barH;

        // opacity fades toward edges for a nice look
        const alpha = 0.5 + val * 0.5;
        const grad  = ctx.createLinearGradient(0, y, 0, H);
        grad.addColorStop(0, accent + Math.round(alpha * 200).toString(16).padStart(2,'0'));
        grad.addColorStop(1, accent + '55');
        ctx.fillStyle = grad;

        const xR = centerX + i * (barW + 1);
        const xL = centerX - (i + 1) * (barW + 1);

        ctx.beginPath();
        ctx.roundRect(xR, y, barW, barH, 1.5);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(xL, y, barW, barH, 1.5);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [dataRef, accent, height]);

  return (
    <div ref={wrapRef} style={{ width: '100%', height, position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} className="viz-canvas" style={{ display: 'block' }} />
    </div>
  );
});

/**
 * CircleVisualizer — polar bar chart around the album cover in the detail hero.
 * Shows as a ring of bars radiating outward.
 */
const CircleVisualizer = memo(({ dataRef, isPlaying, accent = '#1DB954', size = 200 }) => {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2;
    const innerR = size * 0.34;   // just outside album art edge
    const maxBarH = size * 0.14;  // max radial bar length

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const data  = dataRef.current;
      const total = data.length;

      for (let i = 0; i < total; i++) {
        const val    = data[i] / 255;
        const barLen = Math.max(2, val * maxBarH);
        const angle  = (i / total) * Math.PI * 2 - Math.PI / 2;
        const x1     = cx + Math.cos(angle) * (innerR + 2);
        const y1     = cy + Math.sin(angle) * (innerR + 2);
        const x2     = cx + Math.cos(angle) * (innerR + 2 + barLen);
        const y2     = cy + Math.sin(angle) * (innerR + 2 + barLen);

        const alpha = Math.round((0.4 + val * 0.6) * 255).toString(16).padStart(2,'0');
        ctx.strokeStyle = accent + alpha;
        ctx.lineWidth   = Math.max(1.5, (size / 200) * 2);
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [dataRef, accent, size]);

  return (
    <canvas
      ref={canvasRef}
      className="viz-canvas"
      style={{
        position: 'absolute',
        inset: -(size / 2 - (size * 0.34) - 4),
        width:  size,
        height: size,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────────────────────── */

/** Music card — now accepts dataRef + isPlaying for live visualizer overlay */
const MusicCard = memo(({ item, isPlaying: isCurrentlyPlaying, isActive, onPlay, onClick, dataRef }) => {
  const accent = item.accent || '#1DB954';
  return (
    <div
      className={`music-card fade-up${isActive ? ' now-playing' : ''}`}
      onClick={onClick}
      style={{ '--accent': accent }}
    >
      <div className="card-glow" style={{ boxShadow: `inset 0 0 60px ${accent}18, 0 0 40px ${accent}12` }} />

      {/* Cover */}
      <div style={{ position: 'relative', paddingTop: '100%', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
        <img
          src={item.cover} alt={item.name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
          onError={e => { e.target.src = `https://placehold.co/400x400/1a1a1a/333?text=${encodeURIComponent(item.name)}`; }}
        />
        <div className="cover-overlay" />
        {item.badge && (
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
            <span className={item.badge === 'HOT' ? 'badge-hot' : 'badge-new'}>{item.badge}</span>
          </div>
        )}

        {/* Live visualizer overlay — only when this card's song is playing */}
        {isActive && isCurrentlyPlaying && dataRef && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8, zIndex: 3,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
            borderRadius: 7, padding: '4px 7px',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <MiniVisualizer dataRef={dataRef} isPlaying={isCurrentlyPlaying} color={accent} barCount={5} width={24} height={14} />
          </div>
        )}
      </div>

      <div style={{ padding: '12px 14px 52px' }}>
        <p style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
          color: isActive ? 'var(--green)' : 'var(--text-1)',
          marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.name}</p>
        <p style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.artist || item.description}
        </p>
      </div>

      <button
        className="play-btn"
        onClick={e => { e.stopPropagation(); onPlay(); }}
        aria-label={`Play ${item.name}`}
      >
        {isActive && isCurrentlyPlaying
          ? <FaPause  style={{ color: '#fff', fontSize: 13 }} />
          : <FaPlay   style={{ color: '#fff', fontSize: 13, marginLeft: 2 }} />}
      </button>
    </div>
  );
});

/** Track row — uses MiniVisualizer instead of the old CSS bars */
const TrackRow = memo(({ song, index, isActive, isPlaying, onPlay, isFav, isLiked, onFav, onLike, dataRef }) => (
  <div className={`detail-track ${isActive ? 'active' : ''}`} onClick={onPlay}>
    <span style={{ width: 28, textAlign: 'center', fontSize: 12, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
      {isActive && isPlaying && dataRef
        ? <MiniVisualizer dataRef={dataRef} isPlaying={isPlaying} color="#1DB954" barCount={3} width={16} height={14} />
        : String(index + 1).padStart(2, '0')}
    </span>

    <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <img src={song.cover} alt={song.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.src = '/default-cover.png'; }} />
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: isActive ? 'var(--green)' : 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {song.name}
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {song.artist}
      </p>
    </div>

    <span style={{ fontSize: 12, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
      {song.duration}
    </span>

    <div className="track-actions">
      <button onClick={e => { e.stopPropagation(); onFav(); }} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FaStar  style={{ fontSize: 11, color: isFav   ? '#FFD600' : 'var(--text-3)' }} />
      </button>
      <button onClick={e => { e.stopPropagation(); onLike(); }} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FaHeart style={{ fontSize: 11, color: isLiked ? '#FF4455' : 'var(--text-3)' }} />
      </button>
    </div>
  </div>
));

const SectionHeader = ({ title, count }) => (
  <div className="section-heading">
    <span className="dot" />
    <h2>{title}</h2>
    {count != null && <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, marginLeft: 2 }}>{count}</span>}
  </div>
);

const ShimmerCards = ({ count = 6 }) => (
  <div className="cards-grid">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        <div className="shimmer" style={{ paddingTop: '100%' }} />
        <div style={{ padding: '12px 14px 16px', background: 'var(--surface)' }}>
          <div className="shimmer" style={{ height: 14, width: '70%', marginBottom: 8 }} />
          <div className="shimmer" style={{ height: 11, width: '50%' }} />
        </div>
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export default function HomeOnline() {
  const [query,           setQuery]           = useState('');
  const [debouncedQuery,  setDebouncedQuery]  = useState('');
  const [localResults,    setLocalResults]    = useState([]);
  const [ytResults,       setYtResults]       = useState([]);
  const [ytSearching,     setYtSearching]     = useState(false);
  const [activeFilter,    setActiveFilter]    = useState('Albums');
  const [selectedGenre,   setSelectedGenre]   = useState('All');
  const [showDetailView,  setShowDetailView]  = useState(false);
  const [selectedItem,    setSelectedItem]    = useState(null);
  const [trackStates,     setTrackStates]     = useState({});
  const [loading,         setLoading]         = useState(true);
  const [errorMsg,        setErrorMsg]        = useState(null);
  const [detailBg,        setDetailBg]        = useState('#1a1a1a');
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError,   setStreamError]   = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);

  const {
    songs, setPlayerSongs,
    currentIndex, setCurrentIndex,
    currentSong,
    isPlaying, setIsPlaying,
    volume, setVolume,
    downloadedSongs,
    audioRef,
    currentTime,
  } = usePlayer();

  /* ── Wire up analyser ── */
  const { dataRef } = useAudioAnalyser({
    audioRef,
    isPlaying,
    currentSong,
    currentTime,
  });

  /* ── Initial load ── */
  useEffect(() => { if (volume === 1) setVolume(0.2); }, []); // eslint-disable-line

  useEffect(() => {
    if (songs.length > 0) { setLoading(false); return; }
    fetchSongs()
      .then(data => { setPlayerSongs(Array.isArray(data) ? data : (data.songs || [])); })
      .catch(() => { setPlayerSongs(downloadedSongs); setErrorMsg('Offline mode — showing downloaded songs only.'); })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  /* ── Debounce ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  /* ── Search ── */
  useEffect(() => {
    if (!debouncedQuery.trim()) { setLocalResults([]); setYtResults([]); return; }
    const q = debouncedQuery.toLowerCase();
    setLocalResults(songs.filter(s => s.name?.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q) || s.album?.toLowerCase().includes(q)));
    setYtSearching(true);
    youtubeConverter.searchVideos(debouncedQuery, 10)
      .then(setYtResults)
      .catch(() => setYtResults([]))
      .finally(() => setYtSearching(false));
  }, [debouncedQuery, songs]);

  const patchSong = useCallback(async (id, patch) => {
    try {
      await apiPatchSong(id, patch);
      setPlayerSongs(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    } catch (e) { console.error('patchSong:', e); }
  }, [setPlayerSongs]);

  /**
   * Resolves a YouTube video to a streamable backend URL and queues it for playback.
   *
   * Flow:
   *  1. Call backend via youtubeConverter.getAudioStream(videoId)
   *     → backend runs ytdl-core → returns http://localhost:3001/audio/XXX.webm
   *  2. Build a song object with source:'backend' (NOT 'youtube')
   *     → PlayerContext.isYouTubeSong() will return false
   *     → PlayerContext will use <audio> element, not the iframe
   *  3. Store youtubeId for metadata/cover/visualiser use only
   */
  const playYoutubeVideo = useCallback(async (video) => {
    setStreamError(null);
    setStreamLoading(true);
    try {
      const audioUrl = await youtubeConverter.getAudioStream(video.id);
      setPlayerSongs([{
        id:        `yt_${video.id}`,
        name:      video.title,
        artist:    video.channel,
        duration:  '0:00',
        cover:     video.thumbnail,
        // ── Resolved URL: PlayerContext will use <audio>, not iframe ──
        audio:     audioUrl,
        url:       audioUrl,
        src:       audioUrl,
        streamUrl: audioUrl,
        // source:'backend' tells isYouTubeSong() this is already resolved
        source:    'backend',
        // Keep youtubeId for display purposes (cover fallback, visualizer, etc.)
        youtubeId: video.id,
      }], 0);
    } catch (e) {
      console.error('[HomeOnline] playYoutubeVideo error:', e);
      setStreamError(
        e.message?.includes('not reachable')
          ? 'Audio backend offline — run: node ytConverter.server.js'
          : `Could not stream "${video.title}": ${e.message}`
      );
    } finally {
      setStreamLoading(false);
    }
  }, [setPlayerSongs]);

  const playOnlineItem = useCallback(async (item) => {
    const queryMap = { trending: 'trending hip hop 2024', discovery: 'indie discoveries new music', mood: 'chill vibes relaxing music', album: `${item.artist} ${item.name} full album` };
    const q = queryMap[item.type] || item.name;
    try {
      const vids = await youtubeConverter.searchVideos(q, 1);
      if (vids.length) await playYoutubeVideo(vids[0]);
    } catch (e) { console.error('playOnlineItem:', e); }
  }, [playYoutubeVideo]);

  const playStreamingSong = useCallback(async (song) => {
    try {
      const vids = await youtubeConverter.searchVideos(`${song.name} ${song.artist}`, 1);
      if (vids.length) await playYoutubeVideo(vids[0]);
    } catch (e) { console.error('playStreamingSong:', e); }
  }, [playYoutubeVideo]);

  const openDetail = useCallback((item) => {
    setSelectedItem(item);
    setDetailBg(item.accent || '#1a2a1a');
    setShowDetailView(true);
  }, []);

  const closeDetail = useCallback(() => {
    setShowDetailView(false);
    setTimeout(() => setSelectedItem(null), 300);
  }, []);

  const toggleFav = useCallback((id, current) => {
    setTrackStates(p => ({ ...p, [id]: { ...p[id], fav: !current } }));
    patchSong(id, { favorite: !current });
  }, [patchSong]);

  const toggleLiked = useCallback((id, current) => {
    setTrackStates(p => ({ ...p, [id]: { ...p[id], liked: !current } }));
    patchSong(id, { liked: !current });
  }, [patchSong]);

  const filterByGenre = useCallback((items) => {
    if (selectedGenre === 'All') return items;
    return items.filter(i => i.type === selectedGenre.toLowerCase() || i.genre === selectedGenre.toLowerCase());
  }, [selectedGenre]);

  const filteredSuggestions = useMemo(() => filterByGenre(SUGGESTIONS), [filterByGenre]);
  const filteredAlbums      = useMemo(() => filterByGenre(ALBUMS),      [filterByGenre]);
  const filteredPlaylists   = useMemo(() => filterByGenre(PLAYLISTS),   [filterByGenre]);

  const showDropdown = searchFocused && query.trim() && (localResults.length > 0 || ytResults.length > 0 || ytSearching);

  /* ── detail hero cover size — used for CircleVisualizer ── */
  const coverSize = 160;

  /* ─── DETAIL VIEW ─── */
  const renderDetail = () => {
    if (!selectedItem) return null;
    const isDownloaded = selectedItem.type === 'downloaded';
    const cover    = isDownloaded ? selectedItem.songs?.[0]?.cover : selectedItem.cover;
    const title    = isDownloaded ? 'Downloaded' : selectedItem.name;
    const subtitle = isDownloaded ? `${selectedItem.songCount} songs` : (selectedItem.artist || selectedItem.description);
    const songList = selectedItem.songs || [];
    const typeLabel = isDownloaded ? 'LOCAL LIBRARY' : selectedItem.type?.replace('-', ' ').toUpperCase();
    const accent   = selectedItem.accent || '#1DB954';

    return (
      <div className="detail-view" style={{ position: 'relative' }}>
        {/* Background */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', background: `linear-gradient(160deg, ${detailBg}55 0%, #0A0A0A 45%)` }}>
          <div style={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, background: `radial-gradient(circle, ${detailBg}30 0%, transparent 70%)`, borderRadius: '50%', pointerEvents: 'none' }} />
        </div>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(24px)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={closeDetail} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 14 }} />
          </button>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>{title}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {[FaHeart, () => <FontAwesomeIcon icon={faEllipsisH} style={{ fontSize: 14 }} />].map((Icon, i) => (
              <button key={i} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon style={{ fontSize: 14 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Hero */}
        <div style={{ position: 'relative', zIndex: 1, padding: '32px 24px 0', display: 'flex', gap: 28, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Cover with CircleVisualizer ring */}
          <div style={{ position: 'relative', flexShrink: 0, width: coverSize, height: coverSize }}>
            {/* Glow behind cover */}
            <div style={{ position: 'absolute', inset: -6, borderRadius: 24, background: `radial-gradient(circle, ${accent}60 0%, transparent 70%)`, filter: 'blur(16px)', zIndex: 0 }} />
            <img
              src={cover || '/default-cover.png'} alt={title}
              style={{ position: 'relative', zIndex: 1, width: coverSize, height: coverSize, borderRadius: 18, objectFit: 'cover', boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)` }}
              onError={e => { e.target.src = '/default-cover.png'; }}
            />
            {/* Live polar ring visualizer around the cover */}
            <CircleVisualizer
              dataRef={dataRef}
              isPlaying={isPlaying}
              accent={accent}
              size={coverSize + 60}
            />
            {isDownloaded && (
              <div style={{ position: 'absolute', top: -6, right: -6, zIndex: 3, width: 24, height: 24, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(29,185,84,0.5)' }}>
                <FontAwesomeIcon icon={faCircleArrowDown} style={{ color: '#fff', fontSize: 10 }} />
              </div>
            )}
          </div>

          {/* Meta */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{typeLabel}</p>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px,6vw,52px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, color: '#fff', marginBottom: 8 }}>{title}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 12 }}>{subtitle}</p>

            {/* Spectrum bar across meta area */}
            <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden', opacity: isPlaying ? 1 : 0.35, transition: 'opacity 0.4s' }}>
              <SpectrumVisualizer dataRef={dataRef} isPlaying={isPlaying} accent={accent} height={40} />
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (isDownloaded && songList.length) { setPlayerSongs(songList); setCurrentIndex(0); setIsPlaying(true); }
                  else playOnlineItem(selectedItem);
                }}
                style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--green)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(29,185,84,0.45)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <FaPlay style={{ color: '#fff', fontSize: 18, marginLeft: 3 }} />
              </button>
              <button style={{ height: 40, padding: '0 18px', borderRadius: 'var(--radius-pill)', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', transition: 'background 0.2s' }}>
                <FaRandom style={{ fontSize: 12 }} /> Shuffle
              </button>
            </div>
          </div>
        </div>

        {/* Track list */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', padding: '16px 16px 24px' }}>
          {songList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
              <FontAwesomeIcon icon={faCompactDisc} style={{ fontSize: 36, marginBottom: 14, display: 'block', margin: '0 auto 14px' }} />
              <p style={{ fontSize: 15 }}>No tracks available</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 12px 10px' }}>
                Tracks · {songList.length}
              </p>
              {songList.map((song, idx) => {
                const sId      = song.id || `song-${idx}`;
                const globalIdx = songs.findIndex(s => s.id === song.id);
                const isActive = isDownloaded && globalIdx === currentIndex;
                const ts       = trackStates[sId] || {};
                return (
                  <TrackRow
                    key={sId} song={song} index={idx}
                    isActive={isActive} isPlaying={isPlaying}
                    isFav={ts.fav ?? song.favorite ?? false}
                    isLiked={ts.liked ?? song.liked ?? false}
                    dataRef={isActive ? dataRef : null}
                    onPlay={() => {
                      if (isDownloaded && globalIdx !== -1) { setCurrentIndex(globalIdx); setIsPlaying(true); }
                      else playStreamingSong(song);
                    }}
                    onFav={()  => toggleFav(sId,   ts.fav   ?? song.favorite ?? false)}
                    onLike={()  => toggleLiked(sId, ts.liked ?? song.liked    ?? false)}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  };

  /* ─── MAIN HOME ─── */
  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div className="ho-root" style={{ minWidth: '100%', paddingLeft: '20px', height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 88, background: 'var(--bg)', overflow: 'hidden' }}>
        {loading && songs.length === 0 && <Loader />}

        {showDetailView ? renderDetail() : (
          <>
            {/* ── TOP BAR ── */}
            <div style={{ flexShrink: 0, padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }} ref={searchRef}>
                  <FaSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 13, pointerEvents: 'none', zIndex: 1 }} />
                  <input
                    className="search-input glass-pill"
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    placeholder="Artists, songs, albums…"
                    style={{ width: '100%', padding: '10px 16px 10px 38px', borderRadius: 'var(--radius-pill)', fontSize: 14, color: 'var(--text-1)', background: 'var(--surface)', border: '1px solid var(--border)', transition: 'border-color 0.2s' }}
                  />

                  {showDropdown && (
                    <div className="search-dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 100 }}>
                      {localResults.length > 0 && (
                        <>
                          <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Library</div>
                          {localResults.slice(0, 4).map((song, i) => (
                            <div key={song.id || i} className="search-row" onClick={() => {
                              setQuery(song.name);
                              const idx = songs.findIndex(s => s.id === song.id);
                              if (idx !== -1) { setCurrentIndex(idx); setIsPlaying(true); }
                            }}>
                              <img src={song.cover} alt={song.name} style={{ width: 38, height: 38, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.name}</p>
                                <p style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</p>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      {ytSearching && (
                        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-2)', fontSize: 13 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: 'var(--green)', animation: 'spin 0.7s linear infinite' }} />
                          Searching YouTube…
                        </div>
                      )}
                      {ytResults.length > 0 && (
                        <>
                          <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF4444"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            YouTube
                          </div>
                          {ytResults.slice(0, 5).map(v => (
                            <div key={v.id} className="search-row" onClick={() => { setQuery(''); playYoutubeVideo(v); }}>
                              <img src={v.thumbnail} alt={v.title} style={{ width: 38, height: 38, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</p>
                                <p style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.channel}</p>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="filter-tabs">
                  {['Albums', 'Songs'].map(tab => (
                    <button key={tab} className={`filter-tab ${activeFilter === tab ? 'active' : ''}`} onClick={() => setActiveFilter(tab)}>{tab}</button>
                  ))}
                </div>
              </div>

              <div>
                <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6 }}>
                  <span className="gradient-text">Discover</span>
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Stream millions of songs · Explore new music</p>
              </div>

              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                {GENRES.map(g => (
                  <button key={g} className={`genre-chip ${selectedGenre === g ? 'active' : ''}`} onClick={() => setSelectedGenre(g)}>{g}</button>
                ))}
              </div>

              {errorMsg && (
                <div style={{ background: 'rgba(255,100,0,0.12)', border: '1px solid rgba(255,100,0,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FF9944', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FontAwesomeIcon icon={faBolt} style={{ fontSize: 12 }} />
                  {errorMsg}
                </div>
              )}

              {/* Stream loading indicator */}
              {streamLoading && (
                <div style={{ background: 'rgba(29,185,84,0.10)', border: '1px solid rgba(29,185,84,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(29,185,84,0.3)', borderTopColor: 'var(--green)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                  Streaming audio from backend…
                </div>
              )}

              {/* Stream error */}
              {streamError && (
                <div style={{ background: 'rgba(255,50,50,0.10)', border: '1px solid rgba(255,50,50,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FF6666', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FontAwesomeIcon icon={faBolt} style={{ fontSize: 12 }} />
                    {streamError}
                  </span>
                  <button onClick={() => setStreamError(null)} style={{ background: 'none', border: 'none', color: '#FF6666', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                </div>
              )}
            </div>

            {/* ── CONTENT ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 8px' }}>

              <section style={{ marginBottom: 36 }}>
                <SectionHeader title="Suggestions" count={filteredSuggestions.length} />
                {loading ? <ShimmerCards count={6} /> : (
                  <div className="cards-grid">
                    {filteredSuggestions.map(s => (
                      <MusicCard key={s.id} item={s} isPlaying={isPlaying}
                        isActive={currentSong?.name === s.name}
                        dataRef={currentSong?.name === s.name ? dataRef : null}
                        onPlay={() => playStreamingSong(s)}
                        onClick={() => openDetail({ ...s, songs: [] })}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section style={{ marginBottom: 36 }}>
                <SectionHeader title="New Releases" />
                {loading ? <ShimmerCards count={4} /> : (
                  <div className="cards-grid">
                    {NEW_RELEASES.map(n => (
                      <MusicCard key={n.id} item={n} isPlaying={isPlaying}
                        isActive={currentSong?.name === n.name}
                        dataRef={currentSong?.name === n.name ? dataRef : null}
                        onPlay={() => playStreamingSong(n)}
                        onClick={() => openDetail({ ...n, songs: [] })}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section style={{ marginBottom: 36 }}>
                <SectionHeader title="Playlists" count={filteredPlaylists.length} />
                {loading ? <ShimmerCards count={4} /> : (
                  <div className="cards-grid">
                    {filteredPlaylists.map(p => (
                      <MusicCard key={p.id} item={p} isPlaying={isPlaying}
                        isActive={false} dataRef={null}
                        onPlay={() => playOnlineItem(p)}
                        onClick={() => openDetail({ ...p, songs: [] })}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section style={{ marginBottom: 36 }}>
                <SectionHeader title="Albums" count={filteredAlbums.length} />
                {loading ? <ShimmerCards count={6} /> : (
                  <div className="cards-grid">
                    {filteredAlbums.map(a => (
                      <MusicCard key={a.id} item={a} isPlaying={isPlaying}
                        isActive={false} dataRef={null}
                        onPlay={() => playOnlineItem(a)}
                        onClick={() => openDetail({ ...a, songs: [] })}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section style={{ marginBottom: 36 }}>
                <SectionHeader title="Downloaded" count={songs.length || undefined} />
                {songs.length > 0 ? (
                  <div className="cards-grid">
                    <div
                      className="music-card"
                      onClick={() => openDetail({
                        type: 'downloaded', name: 'Downloaded Songs',
                        cover: songs[0]?.cover, accent: '#1DB954',
                        songCount: songs.length,
                        duration: `${Math.floor(songs.reduce((a, s) => a + (parseFloat(s.duration) || 3.5), 0))} min`,
                        songs,
                      })}
                    >
                      <div style={{ position: 'relative', paddingTop: '100%', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
                        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, background: '#111' }}>
                          {[0, 1, 2, 3].map(i => (
                            <img key={i} src={songs[i]?.cover || songs[0]?.cover || '/default-cover.png'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ))}
                        </div>
                        <div style={{ position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(29,185,84,0.5)' }}>
                          <FontAwesomeIcon icon={faCircleArrowDown} style={{ color: '#fff', fontSize: 10 }} />
                        </div>
                        {/* Live visualizer on downloaded card when playing */}
                        {isPlaying && (
                          <div style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 3, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', borderRadius: 7, padding: '4px 7px' }}>
                            <MiniVisualizer dataRef={dataRef} isPlaying={isPlaying} color="#1DB954" barCount={7} width={32} height={16} />
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '12px 14px 52px' }}>
                        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-1)', marginBottom: 3 }}>Downloaded</p>
                        <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{songs.length} songs</p>
                      </div>
                      <button className="play-btn" onClick={e => { e.stopPropagation(); setCurrentIndex(0); setIsPlaying(true); }}>
                        <FaPlay style={{ color: '#fff', fontSize: 13, marginLeft: 2 }} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                    <FontAwesomeIcon icon={faCircleArrowDown} style={{ fontSize: 28, color: 'var(--text-3)', marginBottom: 12, display: 'block' }} />
                    <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 4 }}>No downloads yet</p>
                    <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Download songs for offline listening</p>
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        <PlayerControls />
      </div>
    </>
  );
}