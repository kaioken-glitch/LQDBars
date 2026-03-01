/**
 * Recent.jsx — Recently Played / History page
 *
 * Design direction: "Dark Archive" — editorial typographic hierarchy,
 * record-collection grid, timeline list, real canvas frequency visualizer.
 * Zero Tailwind. 100% scoped CSS via .rp-* namespace.
 * Tokens: Syne + DM Sans, #1DB954 green, --lb-* vars.
 */

import React, {
  useState, useEffect, useMemo, useCallback, useRef, memo,
} from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHeart as faHeartSolid,
  faTrashCan, faFire, faClock,
} from '@fortawesome/free-solid-svg-icons';
import { faHeart as faHeartRegular } from '@fortawesome/free-regular-svg-icons';
import {
  FaPlay, FaPause, FaHistory,
  FaSortAmountDown, FaSortAmountUp,
} from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';

/* ─── Constants ────────────────────────────────────────────────────────── */
const RECENT_KEY  = 'player:history';
const FLAGS_KEY   = 'player:songFlags';
const MAX_HISTORY = 50;

/* ─── Storage ──────────────────────────────────────────────────────────── */
const loadJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb; } catch { return fb; } };
const saveJSON = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ─── Time helper ──────────────────────────────────────────────────────── */
function timeAgo(iso) {
  if (!iso) return '';
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ─── Audio Analyser Hook ──────────────────────────────────────────────── */
function useAudioAnalyser({ audioRef, isPlaying, currentSong, currentTime }) {
  const ctxRef      = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef   = useRef(null);
  const dataRef     = useRef(new Uint8Array(32));
  const rafRef      = useRef(null);
  const [, tick]    = useState(0);

  const isYT = !!(currentSong && (
    currentSong.source === 'youtube' ||
    Boolean(currentSong.youtubeId) ||
    [currentSong.streamUrl, currentSong.audio, currentSong.url]
      .some(f => f?.includes('youtube.com') || f?.includes('youtu.be'))
  ));

  useEffect(() => {
    if (isYT) return;
    const audio = audioRef?.current;
    if (!audio) return;
    if (!ctxRef.current) {
      try { ctxRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (sourceRef.current && sourceRef.current.mediaElement !== audio) {
      try { sourceRef.current.disconnect(); } catch {} sourceRef.current = null;
    }
    if (!sourceRef.current) {
      try { sourceRef.current = ctx.createMediaElementSource(audio); } catch { return; }
    }
    if (!analyserRef.current) {
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 64;
      analyserRef.current.smoothingTimeConstant = 0.8;
    }
    try {
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(ctx.destination);
    } catch {}
  }, [audioRef, isYT]);

  useEffect(() => {
    const loop = () => {
      if (analyserRef.current && !isYT) {
        analyserRef.current.getByteFrequencyData(dataRef.current);
      } else if (isYT && isPlaying) {
        const t = currentTime || 0;
        const arr = dataRef.current;
        for (let i = 0; i < arr.length; i++) {
          const f = i / arr.length;
          arr[i] = Math.round((
            Math.abs(Math.sin(t * 2.1 + i * 0.3)) * 180 * (1 - f) * 0.6 +
            Math.abs(Math.sin(t * 3.7 + i * 0.7 + 1)) * 120 * Math.sin(f * Math.PI) * 0.6 +
            Math.abs(Math.sin(t * 6.2 + i * 1.4 + 2)) * 60 * f * 0.4
          ) * (0.55 + 0.45 * Math.sin(t * 1.3 + i)));
        }
      } else {
        const arr = dataRef.current;
        for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, arr[i] - 10);
      }
      tick(n => n + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isYT, isPlaying, currentTime]);

  return { dataRef };
}

/* ─── Canvas Mini Visualizer ───────────────────────────────────────────── */
const MiniViz = memo(function MiniViz({ dataRef, bars = 4, w = 20, h = 14, color = '#1DB954' }) {
  const ref = useRef(null);
  const raf = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const bw = (w - (bars - 1) * 1.5) / bars;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const data = dataRef.current;
      const step = Math.max(1, Math.floor(data.length / bars));
      for (let i = 0; i < bars; i++) {
        const val = data[Math.min(i * step, data.length - 1)] / 255;
        const bh  = Math.max(2, val * (h - 2));
        const x   = i * (bw + 1.5);
        const y   = h - bh;
        const g   = ctx.createLinearGradient(0, y, 0, h);
        g.addColorStop(0, color + '99');
        g.addColorStop(1, color);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, y, bw, bh, 1.5);
        ctx.fill();
      }
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [dataRef, bars, w, h, color]);
  return <canvas ref={ref} style={{ display: 'block', width: w, height: h, imageRendering: 'pixelated' }} />;
});

/* ─── Scoped CSS ───────────────────────────────────────────────────────── */
const CSS = `
  .rp-root *, .rp-root *::before, .rp-root *::after {
    box-sizing: border-box; margin: 0; padding: 0;
  }

  .rp-root {
    font-family: 'DM Sans', sans-serif;
    background: var(--lb-bg-base, #07080A);
    color: #fff;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    position: relative;
  }

  /* Grain overlay */
  .rp-root::before {
    content: '';
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    opacity: 0.018;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px;
  }

  .rp-root ::-webkit-scrollbar       { width: 3px; }
  .rp-root ::-webkit-scrollbar-track { background: transparent; }
  .rp-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.09); border-radius: 2px; }

  /* ── Header ── */
  .rp-header {
    marginTop: 20px;
    flex-shrink: 0;
    padding: 32px 28px 0;
    position: relative; z-index: 1;
  }

  .rp-eyebrow {
    display: flex; align-items: center; gap: 9px;
    margin-bottom: 12px;
  }
  .rp-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #1DB954;
    box-shadow: 0 0 8px rgba(29,185,84,0.9);
    animation: rp-dotPulse 2s ease-in-out infinite;
  }
  @keyframes rp-dotPulse {
    0%,100% { opacity: 1;   transform: scale(1);    }
    50%      { opacity: 0.5; transform: scale(0.8); }
  }
  .rp-eyebrow-label {
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: #1DB954;
  }

  .rp-title-row {
    display: flex; align-items: flex-end;
    justify-content: space-between; gap: 16px;
  }

  .rp-h1 {
    font-family: 'Syne', sans-serif;
    font-size: clamp(36px, 6vw, 58px);
    font-weight: 800;
    letter-spacing: -0.045em;
    line-height: 0.93;
    background: linear-gradient(135deg, #fff 40%, rgba(29,185,84,0.65) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .rp-clear {
    display: flex; align-items: center; gap: 7px;
    padding: 9px 16px; border-radius: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.38);
    font-family: 'DM Sans', sans-serif;
    font-size: 12px; font-weight: 600;
    cursor: pointer; white-space: nowrap; flex-shrink: 0;
    transition: color .2s, background .2s, border-color .2s;
  }
  .rp-clear:hover {
    color: #ff6b6b;
    background: rgba(220,50,50,0.08);
    border-color: rgba(220,50,50,0.22);
  }

  .rp-subline {
    margin-top: 7px;
    font-size: 13px; color: rgba(255,255,255,0.3);
  }

  /* ── Stats strip ── */
  .rp-stats {
    display: flex; gap: 10px;
    margin-top: 22px; overflow-x: auto; padding-bottom: 2px;
  }
  .rp-stats::-webkit-scrollbar { display: none; }

  .rp-stat {
    display: flex; align-items: center; gap: 13px;
    padding: 12px 18px; border-radius: 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
    transition: border-color .2s;
  }
  .rp-stat:hover { border-color: rgba(255,255,255,0.13); }
  .rp-stat-ico {
    width: 33px; height: 33px; border-radius: 10px;
    background: rgba(29,185,84,0.12);
    border: 1px solid rgba(29,185,84,0.2);
    display: flex; align-items: center; justify-content: center;
    color: #1DB954; font-size: 13px; flex-shrink: 0;
  }
  .rp-stat-val {
    font-family: 'Syne', sans-serif;
    font-size: 20px; font-weight: 700; line-height: 1; color: #fff;
  }
  .rp-stat-lbl { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 3px; }

  .rp-topsong {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; border-radius: 16px;
    background: rgba(29,185,84,0.07);
    border: 1px solid rgba(29,185,84,0.2);
    flex-shrink: 0; transition: background .2s;
  }
  .rp-topsong:hover { background: rgba(29,185,84,0.12); }
  .rp-topsong img {
    width: 38px; height: 38px; border-radius: 10px;
    object-fit: cover; flex-shrink: 0;
  }
  .rp-topsong-name {
    font-size: 13px; font-weight: 700; color: #1DB954;
    max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rp-topsong-meta { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 2px; }

  /* ── Toolbar ── */
  .rp-toolbar {
    display: flex; align-items: center; gap: 8px;
    margin-top: 20px; flex-wrap: wrap;
  }
  .rp-pgroup {
    display: flex; gap: 3px;
    padding: 4px; border-radius: 14px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
  }
  .rp-pill {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 15px; border-radius: 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px; font-weight: 600;
    background: transparent; border: none;
    color: rgba(255,255,255,0.38);
    cursor: pointer; white-space: nowrap;
    transition: background .2s, color .2s;
  }
  .rp-pill:hover:not(.on) { color: rgba(255,255,255,0.65); }
  .rp-pill.on { background: rgba(255,255,255,0.1); color: #fff; }

  .rp-vpill {
    width: 34px; height: 34px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 10px; font-size: 17px;
    background: transparent; border: none;
    color: rgba(255,255,255,0.38); cursor: pointer;
    transition: background .2s, color .2s;
  }
  .rp-vpill:hover:not(.on) { color: rgba(255,255,255,0.7); }
  .rp-vpill.on { background: rgba(255,255,255,0.1); color: #fff; }

  /* ── Body ── */
  .rp-body {
    flex: 1; overflow-y: auto;
    padding: 20px 28px 100px;
    position: relative; z-index: 1;
  }

  /* ════════════════════════
     GRID
  ════════════════════════ */
  .rp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
    gap: 16px;
  }
  @media (min-width: 500px)  { .rp-grid { grid-template-columns: repeat(auto-fill, minmax(162px, 1fr)); } }
  @media (min-width: 900px)  { .rp-grid { grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); } }
  @media (min-width: 1200px) { .rp-grid { grid-template-columns: repeat(auto-fill, minmax(188px, 1fr)); } }

  .rp-card {
    border-radius: 18px; overflow: hidden;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    cursor: pointer; position: relative;
    transition: transform .28s cubic-bezier(.4,0,.2,1),
                box-shadow .28s, border-color .28s;
  }
  .rp-card:hover {
    transform: translateY(-5px) scale(1.015);
    border-color: rgba(29,185,84,0.3);
    box-shadow: 0 20px 50px rgba(0,0,0,0.55), 0 0 28px rgba(29,185,84,0.07);
  }
  .rp-card.live {
    border-color: rgba(29,185,84,0.38);
    animation: cardGlow 2.5s ease-in-out infinite;
  }
  @keyframes cardGlow {
    0%,100% { box-shadow: 0 0 0 0 rgba(29,185,84,0); }
    50%      { box-shadow: 0 0 24px 4px rgba(29,185,84,0.16); }
  }

  .rp-art { position: relative; padding-top: 100%; overflow: hidden; }
  .rp-art img {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
    transition: transform .45s;
  }
  .rp-card:hover .rp-art img { transform: scale(1.07); }

  .rp-scrim {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 55%);
    opacity: 0; transition: opacity .25s;
  }
  .rp-card:hover .rp-scrim { opacity: 1; }

  .rp-card-viz {
    position: absolute; bottom: 10px; left: 10px; z-index: 3;
    background: rgba(0,0,0,0.58); backdrop-filter: blur(8px);
    border-radius: 8px; padding: 5px 8px;
    display: flex; align-items: center;
  }

  .rp-playbtn {
    position: absolute; bottom: 12px; right: 12px; z-index: 3;
    width: 40px; height: 40px; border-radius: 50%;
    background: #1DB954; border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    opacity: 0; transform: translateY(7px) scale(0.88);
    transition: opacity .22s, transform .22s, background .15s, box-shadow .15s;
    box-shadow: 0 8px 24px rgba(29,185,84,0.5);
  }
  .rp-card:hover .rp-playbtn { opacity: 1; transform: translateY(0) scale(1); }
  .rp-playbtn:hover { background: #23E065; transform: scale(1.09) !important; }

  .rp-card-acts {
    position: absolute; top: 8px; right: 8px; z-index: 4;
    display: flex; gap: 5px;
    opacity: 0; transition: opacity .2s;
  }
  .rp-card:hover .rp-card-acts { opacity: 1; }

  .rp-abtn {
    width: 30px; height: 30px; border-radius: 50%; border: none;
    background: rgba(0,0,0,0.62); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 11px;
    color: rgba(255,255,255,0.78);
    transition: background .15s, color .15s, transform .15s;
  }
  .rp-abtn:hover          { transform: scale(1.1); }
  .rp-abtn.fav            { color: #1DB954; }
  .rp-abtn.del:hover      { background: rgba(200,40,40,0.65); color: #fff; }

  .rp-card-info { padding: 11px 13px 13px; }
  .rp-cname {
    font-family: 'Syne', sans-serif;
    font-size: 13px; font-weight: 700; color: #fff;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-bottom: 3px;
  }
  .rp-cname.live { color: #1DB954; }
  .rp-cartist {
    font-size: 11px; color: rgba(255,255,255,0.38);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-bottom: 5px;
  }
  .rp-ctime { font-size: 10px; color: rgba(255,255,255,0.22); }

  /* ════════════════════════
     LIST
  ════════════════════════ */
  .rp-list { display: flex; flex-direction: column; gap: 4px; }

  .rp-lhead {
    display: none;
    padding: 0 14px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    margin-bottom: 4px;
  }
  @media (min-width: 660px) {
    .rp-lhead {
      display: grid;
      grid-template-columns: 36px 1fr 150px 90px 88px 60px;
      gap: 12px;
    }
  }
  .rp-lhead span {
    font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: rgba(255,255,255,0.2);
  }

  .rp-row {
    display: flex; align-items: center; gap: 12px;
    padding: 9px 14px; border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.03);
    cursor: pointer;
    transition: background .15s, border-color .15s;
  }
  .rp-row:hover   { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
  .rp-row.live    { background: rgba(29,185,84,0.08); border-color: rgba(29,185,84,0.24); }

  @media (min-width: 660px) {
    .rp-row {
      display: grid;
      grid-template-columns: 36px 1fr 150px 90px 88px 60px;
      gap: 12px;
    }
    .rp-row-right { display: none !important; }
  }

  .rp-rnum {
    display: none;
    font-size: 12px; color: rgba(255,255,255,0.2);
    font-variant-numeric: tabular-nums;
    align-items: center; justify-content: center;
  }
  @media (min-width: 660px) { .rp-rnum { display: flex; } }

  .rp-rsong { display: flex; align-items: center; gap: 11px; min-width: 0; flex: 1; }

  .rp-rthumb {
    position: relative; width: 44px; height: 44px;
    border-radius: 10px; overflow: hidden; flex-shrink: 0;
  }
  .rp-rthumb img { width: 100%; height: 100%; object-fit: cover; }

  .rp-hover-play {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.55);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity .15s;
  }
  .rp-row:hover .rp-hover-play { opacity: 1; }
  .rp-row.live  .rp-hover-play { opacity: 0; }

  .rp-rmeta { min-width: 0; }
  .rp-rname {
    font-size: 13px; font-weight: 600; color: #fff;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rp-rname.live { color: #1DB954; }
  .rp-rsub  {
    font-size: 11px; color: rgba(255,255,255,0.38); margin-top: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* Desktop-only cells */
  .rp-rartist, .rp-rtime, .rp-rbar { display: none; }
  @media (min-width: 660px) {
    .rp-rartist { display: flex; align-items: center; }
    .rp-rtime   { display: flex; align-items: center; }
    .rp-rbar    { display: flex; align-items: center; gap: 8px; }
  }
  .rp-rartist span,
  .rp-rtime   span {
    font-size: 12px; color: rgba(255,255,255,0.38);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .rp-track { flex: 1; height: 3px; border-radius: 2px; max-width: 56px;
    background: rgba(255,255,255,0.08); overflow: hidden; }
  .rp-fill  { height: 100%; background: #1DB954; border-radius: 2px; transition: width .4s; }
  .rp-cnt   { font-size: 11px; color: rgba(255,255,255,0.3); font-variant-numeric: tabular-nums; }

  /* Row actions */
  .rp-racts {
    display: flex; align-items: center; justify-content: flex-end; gap: 2px;
    flex-shrink: 0; opacity: 0; transition: opacity .15s;
  }
  .rp-row:hover .rp-racts { opacity: 1; }

  .rp-rbtn {
    width: 28px; height: 28px; border-radius: 50%; border: none;
    background: transparent; display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 11px; color: rgba(255,255,255,0.3);
    transition: background .15s, color .15s;
  }
  .rp-rbtn:hover       { background: rgba(255,255,255,0.08); color: #fff; }
  .rp-rbtn.fav         { color: #1DB954; }
  .rp-rbtn.del:hover   { background: rgba(200,40,40,0.14); color: #ff6b6b; }

  /* Mobile right zone */
  .rp-row-right {
    display: flex; align-items: center; gap: 5px; flex-shrink: 0;
  }
  .rp-mplay {
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(29,185,84,0.8); border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #fff; font-size: 11px;
    transition: background .15s;
  }
  .rp-mplay:hover { background: #1DB954; }

  /* ════════════════════════
     EMPTY
  ════════════════════════ */
  .rp-empty {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100%; gap: 18px; text-align: center; padding: 48px;
  }
  .rp-empty-ring {
    width: 88px; height: 88px; border-radius: 22px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    display: flex; align-items: center; justify-content: center;
    font-size: 30px; color: rgba(255,255,255,0.14);
  }
  .rp-empty-title { font-family:'Syne',sans-serif; font-size:24px; font-weight:800; color:#fff; }
  .rp-empty-body  { font-size:13px; color:rgba(255,255,255,0.32); max-width:240px; line-height:1.6; }

  /* ════════════════════════
     ANIMATIONS
  ════════════════════════ */
  @keyframes rp-rise {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rise { animation: rp-rise .38s cubic-bezier(.22,1,.36,1) both; }
  .rise:nth-child(1)  { animation-delay: .00s } .rise:nth-child(2)  { animation-delay: .03s }
  .rise:nth-child(3)  { animation-delay: .06s } .rise:nth-child(4)  { animation-delay: .09s }
  .rise:nth-child(5)  { animation-delay: .12s } .rise:nth-child(6)  { animation-delay: .15s }
  .rise:nth-child(7)  { animation-delay: .18s } .rise:nth-child(8)  { animation-delay: .21s }
  .rise:nth-child(9)  { animation-delay: .24s } .rise:nth-child(10) { animation-delay: .27s }
  .rise:nth-child(11) { animation-delay: .30s } .rise:nth-child(12) { animation-delay: .33s }
  .rise:nth-child(13) { animation-delay: .36s } .rise:nth-child(14) { animation-delay: .39s }
  .rise:nth-child(15) { animation-delay: .42s } .rise:nth-child(16) { animation-delay: .45s }
  .rise:nth-child(17) { animation-delay: .48s } .rise:nth-child(18) { animation-delay: .51s }
  .rise:nth-child(19) { animation-delay: .54s } .rise:nth-child(20) { animation-delay: .57s }

  @media (max-width: 440px) {
    .rp-header { padding: 22px 16px 0; }
    .rp-body   { padding: 16px 16px 100px; }
  }
`;

/* ─────────────────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────────────────── */
export default function Recent() {
  const {
    currentSong, isPlaying,
    songs: allSongs,
    setCurrentIndex, setIsPlaying,
    audioRef, currentTime,
  } = usePlayer();

  const [history, setHistory] = useState(() => loadJSON(RECENT_KEY, []));
  const [flags,   setFlags]   = useState(() => loadJSON(FLAGS_KEY,  {}));
  const [view,    setView]    = useState('grid');
  const [filter,  setFilter]  = useState('all');
  const [sort,    setSort]    = useState('recent');

  useEffect(() => { saveJSON(RECENT_KEY, history); }, [history]);
  useEffect(() => { saveJSON(FLAGS_KEY,  flags);   }, [flags]);

  // Record current song
  useEffect(() => {
    if (!currentSong?.id) return;
    setHistory(prev => {
      const old    = prev.find(s => s.id === currentSong.id);
      const others = prev.filter(s => s.id !== currentSong.id);
      return [
        { ...currentSong, playedAt: new Date().toISOString(), playCount: (old?.playCount ?? 0) + 1 },
        ...others,
      ].slice(0, MAX_HISTORY);
    });
  }, [currentSong?.id]); // eslint-disable-line

  const { dataRef } = useAudioAnalyser({ audioRef, isPlaying, currentSong, currentTime });

  const items = useMemo(() => {
    let arr = filter === 'favorites'
      ? history.filter(s => flags[s.id]?.favorite)
      : [...history];
    sort === 'top'
      ? arr.sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))
      : arr.sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));
    return arr;
  }, [history, flags, filter, sort]);

  const stats = useMemo(() => {
    const totalPlays    = history.reduce((n, s) => n + (s.playCount ?? 1), 0);
    const uniqueArtists = new Set(history.map(s => s.artist).filter(Boolean)).size;
    const favCount      = history.filter(s => flags[s.id]?.favorite).length;
    const topSong       = [...history].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))[0];
    return { totalPlays, uniqueArtists, favCount, topSong };
  }, [history, flags]);

  const topPlays = stats.topSong?.playCount ?? 1;

  const play   = useCallback((song) => {
    const i = allSongs.findIndex(s => s.id === song.id);
    if (i !== -1) { setCurrentIndex(i); setIsPlaying(true); }
  }, [allSongs, setCurrentIndex, setIsPlaying]);

  const remove = useCallback((id, e) => { e?.stopPropagation(); setHistory(p => p.filter(s => s.id !== id)); }, []);
  const fav    = useCallback((id, e) => { e?.stopPropagation(); setFlags(p => ({ ...p, [id]: { ...p[id], favorite: !p[id]?.favorite } })); }, []);

  /* Empty */
  if (!history.length) return (
    <><style>{CSS}</style>
    <div className="rp-root">
      <div className="rp-empty">
        <div className="rp-empty-ring"><FaHistory /></div>
        <p className="rp-empty-title">Nothing here yet</p>
        <p className="rp-empty-body">Play some music — every track you listen to is saved here automatically.</p>
      </div>
    </div></>
  );

  return (
    <><style>{CSS}</style>
    <div className="rp-root">

      {/* ══ HEADER ══ */}
      <div className="rp-header">
        <div className="rp-eyebrow">
          <span className="rp-dot" />
          <span className="rp-eyebrow-label">Recently Played</span>
        </div>

        <div className="rp-title-row">
          <h1 className="rp-h1">History</h1>
          <button className="rp-clear" onClick={() => window.confirm('Clear all history?') && setHistory([])}>
            <FontAwesomeIcon icon={faTrashCan} style={{ fontSize: 11 }} />
            Clear all
          </button>
        </div>

        <p className="rp-subline">
          {history.length} tracks · {stats.favCount} saved · {stats.totalPlays} total plays
        </p>

        {/* Stats */}
        <div className="rp-stats">
          <div className="rp-stat">
            <div className="rp-stat-ico"><FontAwesomeIcon icon={faFire} /></div>
            <div><p className="rp-stat-val">{stats.totalPlays}</p><p className="rp-stat-lbl">Total plays</p></div>
          </div>
          <div className="rp-stat">
            <div className="rp-stat-ico"><FaHistory /></div>
            <div><p className="rp-stat-val">{history.length}</p><p className="rp-stat-lbl">Tracks</p></div>
          </div>
          <div className="rp-stat">
            <div className="rp-stat-ico"><FontAwesomeIcon icon={faClock} /></div>
            <div><p className="rp-stat-val">{stats.uniqueArtists}</p><p className="rp-stat-lbl">Artists</p></div>
          </div>
          {stats.topSong && (
            <div className="rp-topsong">
              <img src={stats.topSong.cover || '/default-cover.png'} alt="" onError={e => { e.target.src = '/default-cover.png'; }} />
              <div>
                <p className="rp-topsong-name">{stats.topSong.name}</p>
                <p className="rp-topsong-meta">{stats.topSong.playCount ?? 1} plays · top track</p>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="rp-toolbar">
          <div className="rp-pgroup">
            <button className={`rp-pill${filter === 'all'       ? ' on' : ''}`} onClick={() => setFilter('all')}>All ({history.length})</button>
            <button className={`rp-pill${filter === 'favorites' ? ' on' : ''}`} onClick={() => setFilter('favorites')}>
              <FontAwesomeIcon icon={faHeartSolid} style={{ fontSize: 10, color: '#1DB954' }} /> Saved ({stats.favCount})
            </button>
          </div>
          <div className="rp-pgroup">
            <button className={`rp-pill${sort === 'recent' ? ' on' : ''}`} onClick={() => setSort('recent')}><FaSortAmountDown style={{ fontSize: 10 }} /> Recent</button>
            <button className={`rp-pill${sort === 'top'    ? ' on' : ''}`} onClick={() => setSort('top')}><FaSortAmountUp   style={{ fontSize: 10 }} /> Top played</button>
          </div>
          <div className="rp-pgroup" style={{ marginLeft: 'auto' }}>
            <button className={`rp-vpill${view === 'grid' ? ' on' : ''}`} onClick={() => setView('grid')}>⊞</button>
            <button className={`rp-vpill${view === 'list' ? ' on' : ''}`} onClick={() => setView('list')}>≡</button>
          </div>
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div className="rp-body">
        {items.length === 0 ? (
          <div className="rp-empty" style={{ height: 180 }}>
            <FontAwesomeIcon icon={faHeartRegular} style={{ fontSize: 26, color: 'rgba(255,255,255,0.14)' }} />
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)' }}>No favorites yet — tap ♡ on any track.</p>
          </div>
        ) : view === 'grid' ? (

          /* ── GRID ── */
          <div className="rp-grid">
            {items.map(song => {
              const active = currentSong?.id === song.id;
              const isFav  = !!flags[song.id]?.favorite;
              return (
                <div key={song.id} className={`rp-card rise${active ? ' live' : ''}`} onClick={() => play(song)}>
                  <div className="rp-art">
                    <img src={song.cover || '/default-cover.png'} alt={song.name} onError={e => { e.target.src = '/default-cover.png'; }} />
                    <div className="rp-scrim" />
                    {active && isPlaying && (
                      <div className="rp-card-viz"><MiniViz dataRef={dataRef} bars={5} w={24} h={14} /></div>
                    )}
                    <button className="rp-playbtn" onClick={e => { e.stopPropagation(); play(song); }}>
                      {active && isPlaying
                        ? <FaPause style={{ color: '#fff', fontSize: 13 }} />
                        : <FaPlay  style={{ color: '#fff', fontSize: 13, marginLeft: 2 }} />}
                    </button>
                    <div className="rp-card-acts">
                      <button className={`rp-abtn${isFav ? ' fav' : ''}`} onClick={e => fav(song.id, e)}>
                        <FontAwesomeIcon icon={isFav ? faHeartSolid : faHeartRegular} />
                      </button>
                      <button className="rp-abtn del" onClick={e => remove(song.id, e)}>
                        <FontAwesomeIcon icon={faTrashCan} />
                      </button>
                    </div>
                  </div>
                  <div className="rp-card-info">
                    <p className={`rp-cname${active ? ' live' : ''}`}>{song.name}</p>
                    <p className="rp-cartist">{song.artist || 'Unknown'}</p>
                    <p className="rp-ctime">{timeAgo(song.playedAt)} · {song.playCount ?? 1} plays</p>
                  </div>
                </div>
              );
            })}
          </div>

        ) : (

          /* ── LIST ── */
          <div className="rp-list">
            <div className="rp-lhead">
              <span>#</span><span>Track</span><span>Artist</span>
              <span>Played</span><span>Plays</span><span />
            </div>
            {items.map((song, idx) => {
              const active = currentSong?.id === song.id;
              const isFav  = !!flags[song.id]?.favorite;
              return (
                <div key={song.id} className={`rp-row rise${active ? ' live' : ''}`} onClick={() => play(song)}>
                  <div className="rp-rnum">{idx + 1}</div>

                  <div className="rp-rsong">
                    <div className="rp-rthumb">
                      <img src={song.cover || '/default-cover.png'} alt="" onError={e => { e.target.src = '/default-cover.png'; }} />
                      <div className="rp-hover-play"><FaPlay style={{ color: '#fff', fontSize: 11, marginLeft: 2 }} /></div>
                    </div>
                    <div className="rp-rmeta">
                      <p className={`rp-rname${active ? ' live' : ''}`}>{song.name}</p>
                      {active && isPlaying
                        ? <MiniViz dataRef={dataRef} bars={3} w={16} h={11} />
                        : <p className="rp-rsub">{song.artist || '—'}</p>}
                    </div>
                  </div>

                  <div className="rp-rartist"><span>{song.artist || '—'}</span></div>
                  <div className="rp-rtime"><span>{timeAgo(song.playedAt)}</span></div>
                  <div className="rp-rbar">
                    <div className="rp-track">
                      <div className="rp-fill" style={{ width: `${Math.min(100, ((song.playCount ?? 1) / topPlays) * 100)}%` }} />
                    </div>
                    <span className="rp-cnt">{song.playCount ?? 1}</span>
                  </div>

                  <div className="rp-racts">
                    <button className={`rp-rbtn${isFav ? ' fav' : ''}`} onClick={e => fav(song.id, e)}>
                      <FontAwesomeIcon icon={isFav ? faHeartSolid : faHeartRegular} />
                    </button>
                    <button className="rp-rbtn del" onClick={e => remove(song.id, e)}>
                      <FontAwesomeIcon icon={faTrashCan} />
                    </button>
                  </div>

                  {/* Mobile right */}
                  <div className="rp-row-right">
                    {active && isPlaying
                      ? <MiniViz dataRef={dataRef} bars={3} w={16} h={13} />
                      : (
                        <button className="rp-mplay" onClick={e => { e.stopPropagation(); play(song); }}>
                          <FaPlay style={{ fontSize: 11, marginLeft: 2 }} />
                        </button>
                      )
                    }
                    <button className={`rp-rbtn${isFav ? ' fav' : ''}`} onClick={e => fav(song.id, e)}>
                      <FontAwesomeIcon icon={isFav ? faHeartSolid : faHeartRegular} />
                    </button>
                    <button className="rp-rbtn del" onClick={e => remove(song.id, e)}>
                      <FontAwesomeIcon icon={faTrashCan} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div></>
  );
}