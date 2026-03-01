import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { FaSearch, FaStar, FaHeart, FaPlay, FaPause, FaRandom, FaRedo,
         FaStepBackward, FaStepForward, FaVolumeUp, FaVolumeMute,
         FaGripVertical, FaTimes, FaCheck } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import SongTile from '../components/SongTile';

/* ─────────────────────────────────────────────────────────────────────
   SCOPED STYLES
───────────────────────────────────────────────────────────────────── */

const CSS = `
/* ── Tokens ── */
.hm-root {
  --g: #1DB954;
  --g-b: #23E065;
  --g-d: rgba(29,185,84,0.13);
  --g-glow: rgba(29,185,84,0.28);
  --s1: rgba(255,255,255,0.04);
  --s2: rgba(255,255,255,0.07);
  --sh: rgba(255,255,255,0.09);
  --b1: rgba(255,255,255,0.07);
  --b2: rgba(255,255,255,0.13);
  --t1: #ffffff;
  --t2: rgba(255,255,255,0.55);
  --t3: rgba(255,255,255,0.28);
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --spring: cubic-bezier(0.22, 1, 0.36, 1);
}

.hm-root *, .hm-root *::before, .hm-root *::after { box-sizing: border-box; margin:0; padding:0; }
.hm-root {
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
  color: var(--t1);
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  overflow: hidden;
}

/* ── Scrollbar ── */
.hm-root ::-webkit-scrollbar { width: 3px; height: 3px; }
.hm-root ::-webkit-scrollbar-track { background: transparent; }
.hm-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 2px; }

/* ── Page header ── */
.hm-header {
  flex-shrink: 0;
  padding: 24px 28px 0;
  display: flex; flex-direction: column; gap: 16px;
}

/* ── Greeting ── */
.hm-greeting-row {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap;
}
.hm-greeting-title {
  font-family: 'Syne', sans-serif;
  font-size: clamp(26px, 4vw, 40px);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--t1);
}
.hm-greeting-title span {
  background: linear-gradient(130deg, #fff 0%, var(--g-b) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.hm-greeting-sub {
  font-size: 12px; color: var(--t3); letter-spacing: 0.01em;
  margin-top: 4px;
}

/* ── Stats strip ── */
.hm-stats {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.hm-stat {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 9999px;
  background: var(--s1); border: 1px solid var(--b1);
  font-size: 12px; color: var(--t2); font-weight: 500;
  white-space: nowrap;
}
.hm-stat b { color: var(--g); font-weight: 700; font-variant-numeric: tabular-nums; }

/* ── Search + Controls row ── */
.hm-controls-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}

/* Search */
.hm-search-wrap { position: relative; flex: 1; min-width: 180px; max-width: 300px; }
.hm-search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--t3); font-size: 12px; pointer-events: none; }
.hm-search {
  width: 100%; padding: 9px 14px 9px 34px;
  background: var(--s1); border: 1px solid var(--b1);
  border-radius: 9999px; color: var(--t1);
  font-family: inherit; font-size: 13px;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.hm-search:focus {
  outline: none; border-color: rgba(29,185,84,0.5);
  background: var(--s2); box-shadow: 0 0 0 3px rgba(29,185,84,0.10);
}
.hm-search::placeholder { color: var(--t3); }

/* Search results dropdown */
.hm-results {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 50;
  background: #141618; border: 1px solid var(--b1);
  border-radius: 14px; overflow: hidden;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
}
.hm-result-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px; cursor: pointer;
  transition: background 0.12s;
}
.hm-result-row:hover { background: var(--s2); }
.hm-result-row img { width: 34px; height: 34px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }

/* Filter tabs */
.hm-tabs { display: flex; gap: 6px; padding: 3px; background: var(--s1); border: 1px solid var(--b1); border-radius: 9999px; }
.hm-tab { padding: 6px 18px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: transparent; color: var(--t2); font-family: inherit; transition: background 0.15s, color 0.15s; }
.hm-tab.active { background: var(--g); color: #fff; }

/* Genre chips */
.hm-genres { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
.hm-genres::-webkit-scrollbar { display: none; }
.hm-genre {
  flex-shrink: 0; padding: 5px 12px; border-radius: 9999px;
  font-size: 11px; font-weight: 600; cursor: pointer;
  background: var(--s1); border: 1px solid var(--b1); color: var(--t2);
  font-family: inherit; white-space: nowrap;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.hm-genre:hover, .hm-genre.active { background: var(--g-d); color: var(--g-b); border-color: rgba(29,185,84,0.4); }

/* ── Body: Now Playing + Queue ── */
.hm-body {
  flex: 1; min-height: 0;
  display: flex; gap: 20px;
  padding: 20px 28px 20px;
  overflow: hidden;
}

/* ── Now Playing Panel ── */
.hm-np {
  width: 220px; flex-shrink: 0;
  max-height: 370px;
  display: flex; flex-direction: column;
  gap: 0;
  background: var(--s1); border: 1px solid var(--b1);
  border-radius: 20px; overflow: hidden;
  position: relative;
}

/* Ambient bg from cover */
.hm-np-bg {
  position: absolute; inset: 0; z-index: 0;
  transition: background 0.8s var(--ease);
  pointer-events: none;
}

.hm-np-art-wrap {
  position: relative; padding-top: 100%; overflow: hidden;
  flex-shrink: 0;
}
.hm-np-art {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  transition: transform 0.8s var(--ease);
}
.hm-np:hover .hm-np-art { transform: scale(1.04); }
.hm-np-art-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 55%, transparent 100%);
}

/* Spinning ring on cover hover */
.hm-vinyl-ring {
  position: absolute; inset: 4px; border-radius: 50%;
  border: 2px solid transparent; border-top-color: var(--g);
  opacity: 0; pointer-events: none;
  animation: hmVinyl 1.4s linear infinite;
  transition: opacity 0.3s;
}
@keyframes hmVinyl { to { transform: rotate(360deg); } }
.hm-np:hover .hm-vinyl-ring { opacity: 0.35; }

/* Now playing label overlay */
.hm-np-badge {
  position: absolute; top: 12px; left: 12px; z-index: 2;
  display: flex; align-items: center; gap: 5px;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 9999px; padding: 4px 10px;
  font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--g);
}

/* Wave */
.hm-wave { display: inline-flex; align-items: flex-end; gap: 1.5px; height: 11px; }
.hm-wave span { display: block; width: 2px; border-radius: 1px; background: var(--g); }
.hm-wave span:nth-child(1) { animation: hmW1 .8s ease-in-out infinite; }
.hm-wave span:nth-child(2) { animation: hmW2 .8s ease-in-out infinite .1s; }
.hm-wave span:nth-child(3) { animation: hmW3 .8s ease-in-out infinite .2s; }
@keyframes hmW1 { 0%,100%{height:3px} 50%{height:10px} }
@keyframes hmW2 { 0%,100%{height:7px} 50%{height:3px}  }
@keyframes hmW3 { 0%,100%{height:4px} 50%{height:11px} }

/* Meta section */
.hm-np-meta {
  position: relative; z-index: 1;
  padding: 14px 16px 12px;
  display: flex; flex-direction: column; gap: 4px;
}
.hm-np-title {
  font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 800;
  color: var(--t1); letter-spacing: -0.02em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hm-np-artist { font-size: 11px; color: var(--t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hm-np-album  { font-size: 10px; color: var(--t3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }

/* Reactions */
.hm-np-reactions {
  position: relative; z-index: 1;
  padding: 0 16px 14px;
  display: flex; align-items: center; gap: 8px;
}
.hm-react-btn {
  width: 30px; height: 30px; border-radius: 50%; border: none;
  background: var(--s2); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, transform 0.15s;
  color: var(--t2);
}
.hm-react-btn:hover { background: var(--sh); transform: scale(1.1); }
.hm-react-btn.liked { background: rgba(255,68,85,0.18); color: #FF4455; }
.hm-react-btn.faved { background: rgba(255,214,0,0.15); color: #FFD600; }

/* Empty state */
.hm-np-empty {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 20px; gap: 12px; text-align: center;
}
.hm-np-empty-disc {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--s2); border: 1px solid var(--b1);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; color: var(--t3);
}
.hm-np-empty p { font-size: 12px; color: var(--t3); line-height: 1.5; }

/* ── Queue Panel ── */
.hm-queue {
  flex: 1; min-width: 0;
  max-height: 600px;
  display: flex; flex-direction: column;
  background: var(--s1); border: 1px solid var(--b1);
  border-radius: 20px; overflow: hidden;
}

.hm-queue-head {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--b1);
}
.hm-queue-title {
  font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800;
  letter-spacing: -0.02em;
}
.hm-queue-count { font-size: 11px; color: var(--t3); font-variant-numeric: tabular-nums; }

.hm-queue-body {
  flex: 1; overflow-y: auto;
  padding: 8px 8px;
}

/* Album group header */
.hm-album-group { margin-bottom: 8px; }
.hm-album-label {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; margin-bottom: 4px;
}
.hm-album-label-text {
  font-size: 11px; font-weight: 700; color: var(--t3);
  text-transform: uppercase; letter-spacing: 0.09em;
}
.hm-album-label-line { flex: 1; height: 1px; background: var(--b1); }

/* Song row */
.hm-song-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 10px; cursor: pointer;
  transition: background 0.12s;
  position: relative;
}
.hm-song-row:hover { background: var(--s2); }
.hm-song-row.active { background: rgba(29,185,84,0.10); }

.hm-song-num {
  width: 24px; flex-shrink: 0; text-align: center;
  font-size: 11px; color: var(--t3); font-variant-numeric: tabular-nums;
}
.hm-song-thumb {
  width: 38px; height: 38px; border-radius: 8px; object-fit: cover;
  flex-shrink: 0; border: 1px solid rgba(255,255,255,0.06);
  transition: transform 0.2s;
}
.hm-song-row:hover .hm-song-thumb { transform: scale(1.06); }

.hm-song-info { flex: 1; min-width: 0; }
.hm-song-name {
  font-size: 13px; font-weight: 600;
  color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: color 0.12s;
}
.hm-song-row.active .hm-song-name { color: var(--g); }
.hm-song-row:hover .hm-song-name   { color: var(--g-b); }
.hm-song-meta { font-size: 11px; color: var(--t3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.hm-song-dur { font-size: 11px; color: var(--t3); font-variant-numeric: tabular-nums; flex-shrink: 0; }

.hm-song-actions {
  display: flex; align-items: center; gap: 2px;
  opacity: 0; transition: opacity 0.12s; flex-shrink: 0;
}
.hm-song-row:hover .hm-song-actions { opacity: 1; }
.hm-action-btn {
  width: 26px; height: 26px; border-radius: 50%; border: none;
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--t3); transition: background 0.12s, color 0.12s;
}
.hm-action-btn:hover { background: var(--s2); color: var(--t1); }
.hm-action-btn.active { color: var(--g); }

/* Drag handle */
.hm-drag {
  width: 20px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--t3); cursor: grab; opacity: 0;
  transition: opacity 0.12s;
  font-size: 12px;
}
.hm-song-row:hover .hm-drag { opacity: 1; }
.hm-drag:active { cursor: grabbing; }

/* Empty queue */
.hm-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 14px; text-align: center; padding: 40px;
}
.hm-empty-icon { font-size: 36px; color: var(--t3); }
.hm-empty h3 { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: var(--t2); }
.hm-empty p { font-size: 13px; color: var(--t3); line-height: 1.5; }

/* ── Animations ── */
@keyframes hmFadeUp {
  from { opacity:0; transform:translateY(10px); }
  to   { opacity:1; transform:translateY(0); }
}
.hm-fadeup { animation: hmFadeUp 0.35s var(--spring) both; }

@keyframes hmSpin { to { transform: rotate(360deg); } }

/* ─────────────────────────────────────────────────────────────────────
   MOBILE FRIENDLY OVERRIDES
───────────────────────────────────────────────────────────────────── */

@media (max-width: 768px) {
  /* Header */
  .hm-header {
    padding: 16px 16px 0;
    gap: 12px;
  }

  .hm-greeting-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .hm-greeting-title {
    font-size: clamp(22px, 6vw, 32px);
  }

  .hm-greeting-sub {
    font-size: 11px;
  }

  .hm-stats {
    gap: 6px;
  }

  .hm-stat {
    padding: 4px 10px;
    font-size: 11px;
  }

  /* Search & controls */
  .hm-controls-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .hm-search-wrap {
    max-width: none;
    min-width: 0;
  }

  .hm-tabs {
  max-width: 143px;
    justify-content: center;
  }

  .hm-tab {
    padding: 5px 12px;
    font-size: 11px;
  }

  .hm-genres {
    gap: 4px;
  }

  .hm-genre {
    padding: 4px 10px;
    font-size: 10px;
  }

  /* Body: stack Now Playing above Queue */
  .hm-body {
    flex-direction: column;
    padding: 12px 16px 16px;
    gap: 16px;
  }

  /* Now Playing panel */
  .hm-np {
    width: 100%;
    max-height: none;               /* remove height limit */
    flex-direction: row;            /* switch to horizontal layout on mobile? */
    flex-wrap: wrap;                /* allow content to wrap */
  }

  /* For a compact mobile view, we can keep the cover small and meta beside it */
  .hm-np-art-wrap {
    width: 100px;
    padding-top: 100px;            /* square, but we'll control width */
    flex-shrink: 0;
  }

  .hm-np-meta {
    flex: 1;
    padding: 10px 12px;
  }

  .hm-np-title {
    font-size: 14px;
  }

  .hm-np-artist,
  .hm-np-album {
    font-size: 11px;
  }

  .hm-np-reactions {
    width: 100%;
    justify-content: flex-start;
    padding: 0 12px 12px;
  }

  /* Hide the empty state disc size if needed */
  .hm-np-empty-disc {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }

  /* Queue panel */
  .hm-queue-head {
    padding: 12px 16px;
  }

  .hm-queue-title {
    font-size: 14px;
  }

  .hm-queue-count {
    font-size: 10px;
  }

  .hm-queue-body {
    padding: 4px;
  }

  .hm-song-row {
    padding: 6px 8px;
    gap: 8px;
  }

  .hm-song-thumb {
    width: 34px;
    height: 34px;
  }

  .hm-song-name {
    font-size: 12px;
  }

  .hm-song-meta {
    font-size: 10px;
  }

  .hm-song-dur {
    font-size: 10px;
  }

  /* Maybe hide duration on very small screens */
  .hm-song-actions {
    opacity: 1;                     /* always show on mobile for easier tapping */
  }

  .hm-action-btn {
    width: 28px;
    height: 28px;
  }

  .hm-drag {
    display: none;                  /* drag handle not useful on touch */
  }
}

/* Extra small devices (phones under 480px) */
@media (max-width: 480px) {
  .hm-np {
    flex-direction: column;         /* stack cover and meta vertically */
  }

  .hm-np-art-wrap {
    width: 100%;
    padding-top: 100%;              /* full width square */
  }

  .hm-np-meta {
    padding: 12px;
  }

  .hm-np-reactions {
    padding: 0 12px 12px;
  }

  .hm-song-dur {
    display: none;                  /* hide duration to save space */
  }

  .hm-song-actions {
    gap: 0;
  }

  .hm-action-btn {
    width: 32px;
    height: 32px;
  }

  .hm-queue-head {
    padding: 10px 12px;
  }
}
`;

/* ─────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────── */

const GENRES = ['All', 'Hip-Hop', 'Pop', 'Rock', 'Jazz', 'Electronic', 'Classical', 'R&B'];

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ─────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────────────── */

const WaveIcon = () => (
  <span className="hm-wave"><span /><span /><span /></span>
);

/** Individual song row in the queue */
const SongRow = memo(({ song, index, isActive, isPlaying, onPlay, onFav, onLike, isFav, isLiked,
  onDragStart, onDragOver, onDrop }) => (
  <div
    className={`hm-song-row hm-fadeup${isActive ? ' active' : ''}`}
    style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    onClick={onPlay}
    draggable
    onDragStart={onDragStart}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    {/* Drag handle */}
    <span className="hm-drag" onClick={e => e.stopPropagation()}>
      <FaGripVertical />
    </span>

    {/* Index / wave */}
    <span className="hm-song-num">
      {isActive && isPlaying ? <WaveIcon /> : (index + 1)}
    </span>

    {/* Thumbnail */}
    <img
      src={song.cover || '/default-cover.png'}
      alt={song.name}
      className="hm-song-thumb"
      onError={e => { e.target.src = 'https://placehold.co/38x38/111/333?text=♪'; }}
    />

    {/* Info */}
    <div className="hm-song-info">
      <p className="hm-song-name">{song.name}</p>
      <p className="hm-song-meta">{song.artist}{song.album ? ` · ${song.album}` : ''}</p>
    </div>

    {/* Duration */}
    <span className="hm-song-dur">{fmtTime(song.duration)}</span>

    {/* Actions */}
    <div className="hm-song-actions" onClick={e => e.stopPropagation()}>
      <button className={`hm-action-btn${isFav ? ' active' : ''}`} onClick={onFav} title="Favorite">
        <FaStar style={{ fontSize: 10 }} />
      </button>
      <button className={`hm-action-btn${isLiked ? ' active' : ''}`}
        style={isLiked ? { color: '#FF4455' } : {}} onClick={onLike} title="Like">
        <FaHeart style={{ fontSize: 10 }} />
      </button>
    </div>
  </div>
));

/* ─────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────── */

export default function Home() {
  const {
    songs, setPlayerSongs,
    currentIndex, setCurrentIndex,
    isPlaying, setIsPlaying,
    volume, setVolume,
    currentTime, duration, audioRef,
    downloadedSongs,
    currentSong,
  } = usePlayer();

  /* ── State ── */
  const [query, setQuery]               = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults]   = useState(false);
  const [activeFilter, setActiveFilter] = useState('Songs');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [shuffle, setShuffle]           = useState(false);
  const [repeatMode, setRepeatMode]     = useState('off');
  const [draggedIdx, setDraggedIdx]     = useState(null);
  const [trackMeta, setTrackMeta]       = useState({}); // { [id]: {fav, liked} }
  const [showVolume, setShowVolume]     = useState(false);

  const activeSong = currentSong ?? songs[currentIndex];
  const searchRef = useRef(null);

  /* ── Init ── */
  useEffect(() => { setVolume(0.2); }, [setVolume]); // eslint-disable-line

  useEffect(() => {
    if (songs.length === 0 && downloadedSongs?.length > 0) {
      setPlayerSongs(downloadedSongs, 0);
    }
  }, [songs, downloadedSongs, setPlayerSongs]);

  /* ── Search ── */
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); setShowResults(false); return; }
    const q = query.toLowerCase();
    const res = songs.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.artist?.toLowerCase().includes(q) ||
      s.album?.toLowerCase().includes(q)
    );
    setSearchResults(res);
    setShowResults(true);
  }, [query, songs]);

  /* ── Filtered queue ── */
  const filteredSongs = useMemo(() => {
    let q = songs;
    if (selectedGenre !== 'All') q = q.filter(s => s.genre === selectedGenre);
    if (query.trim() && searchResults.length) q = searchResults;
    return q;
  }, [songs, selectedGenre, query, searchResults]);

  /* ── Grouped by album ── */
  const groupedByAlbum = useMemo(() => {
    const groups = {};
    filteredSongs.forEach(s => {
      const k = s.album || 'Unknown Album';
      if (!groups[k]) groups[k] = [];
      groups[k].push(s);
    });
    return groups;
  }, [filteredSongs]);

  /* ── Play ── */
  const playSong = useCallback((idx) => {
    setCurrentIndex(idx);
    setIsPlaying(true);
  }, [setCurrentIndex, setIsPlaying]);

  /* ── Drag & Drop reorder ── */
  const handleDragStart = useCallback((idx) => setDraggedIdx(idx), []);
  const handleDragOver = useCallback((e) => e.preventDefault(), []);
  const handleDrop = useCallback((targetIdx) => {
    if (draggedIdx === null || draggedIdx === targetIdx) { setDraggedIdx(null); return; }
    const updated = [...songs];
    const [removed] = updated.splice(draggedIdx, 1);
    updated.splice(targetIdx, 0, removed);
    setPlayerSongs(updated);
    if (currentIndex === draggedIdx) setCurrentIndex(targetIdx);
    else if (draggedIdx < currentIndex && targetIdx >= currentIndex) setCurrentIndex(c => c - 1);
    else if (draggedIdx > currentIndex && targetIdx <= currentIndex) setCurrentIndex(c => c + 1);
    setDraggedIdx(null);
  }, [draggedIdx, songs, currentIndex, setPlayerSongs, setCurrentIndex]);

  /* ── Track meta ── */
  const toggleMeta = useCallback((id, key) => {
    setTrackMeta(p => ({ ...p, [id]: { ...p[id], [key]: !p[id]?.[key] } }));
  }, []);

  /* ── Playback controls ── */
  const prevSong = useCallback(() => {
    if (currentIndex > 0) { setCurrentIndex(c => c - 1); setIsPlaying(true); }
  }, [currentIndex, setCurrentIndex, setIsPlaying]);

  const nextSong = useCallback(() => {
    if (shuffle && songs.length > 1) {
      let idx;
      do { idx = Math.floor(Math.random() * songs.length); } while (idx === currentIndex);
      setCurrentIndex(idx);
    } else if (currentIndex < songs.length - 1) {
      setCurrentIndex(c => c + 1);
    } else if (repeatMode === 'all') {
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  }, [shuffle, songs.length, currentIndex, repeatMode, setCurrentIndex, setIsPlaying]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode(m => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off');
  }, []);

  /* ── Progress click ── */
  const handleProgressClick = useCallback((e) => {
    if (!audioRef?.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }, [audioRef, duration]);

  /* ── Stats ── */
  const uniqueArtists = useMemo(() => new Set(songs.map(s => s.artist)).size, [songs]);
  const uniqueAlbums  = useMemo(() => new Set(songs.map(s => s.album).filter(Boolean)).size, [songs]);

  /* ── Ambient bg color for now playing ── */
  const ambientBg = activeSong?.accent
    ? `radial-gradient(ellipse 80% 80% at 50% 0%, ${activeSong.accent}22 0%, transparent 70%)`
    : 'none';

  /* ─────────────────────────────────────────────────────────
     RENDER: Now Playing Panel
  ───────────────────────────────────────────────────────── */
  const renderNowPlaying = () => {
    const song = activeSong;
    return (
      <div className="hm-np">
        <div className="hm-np-bg" style={{ background: ambientBg }} />

        {song ? (
          <>
            {/* Art */}
            <div className="hm-np-art-wrap">
              <img
                src={song.cover || '/default-cover.png'}
                alt={song.name}
                className="hm-np-art"
                onError={e => { e.target.src = 'https://placehold.co/220x220/0a0a0a/111?text=♪'; }}
              />
              <div className="hm-np-art-overlay" />
              <div className="hm-vinyl-ring" />
              {/* Now Playing badge */}
              <div className="hm-np-badge">
                {isPlaying ? <WaveIcon /> : null}
                Now Playing
              </div>
            </div>

            {/* Meta */}
            <div className="hm-np-meta">
              <p className="hm-np-title">{song.name || 'Unknown'}</p>
              <p className="hm-np-artist">{song.artist || 'Unknown Artist'}</p>
              {song.album && <p className="hm-np-album">{song.album}</p>}
            </div>

            {/* Reactions */}
            <div className="hm-np-reactions">
              <button
                className={`hm-react-btn${trackMeta[song.id]?.fav ? ' faved' : ''}`}
                onClick={() => toggleMeta(song.id, 'fav')}
                title="Favorite"
              >
                <FaStar style={{ fontSize: 11 }} />
              </button>
              <button
                className={`hm-react-btn${trackMeta[song.id]?.liked ? ' liked' : ''}`}
                onClick={() => toggleMeta(song.id, 'liked')}
                title="Like"
              >
                <FaHeart style={{ fontSize: 11 }} />
              </button>

              {/* Progress bar (compact) */}
              <div style={{ flex: 1 }}>
                <div
                  style={{ height: 3, borderRadius: 2, background: 'var(--s2)', cursor: 'pointer', position: 'relative', overflow: 'visible' }}
                  onClick={handleProgressClick}
                >
                  <div style={{
                    height: '100%', borderRadius: 2, background: 'var(--g)',
                    width: `${((currentTime || 0) / (duration || 1)) * 100}%`,
                    transition: 'width 0.3s linear',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: 'var(--t3)' }}>{fmtTime(currentTime)}</span>
                  <span style={{ fontSize: 9, color: 'var(--t3)' }}>{fmtTime(duration)}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="hm-np-empty">
            <div className="hm-np-empty-disc">🎵</div>
            <p>Nothing playing<br />yet. Pick a song.</p>
          </div>
        )}
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────
     RENDER: Queue
  ───────────────────────────────────────────────────────── */
  const renderQueue = () => {
    if (songs.length === 0) {
      return (
        <div className="hm-empty">
          <div className="hm-empty-icon">📁</div>
          <h3>No offline songs yet</h3>
          <p>Import local music files to build your library and start listening.</p>
        </div>
      );
    }

    if (activeFilter === 'Songs') {
      return filteredSongs.map((song, idx) => {
        const globalIdx = songs.findIndex(s => s.id === song.id);
        const id = song.id ?? `s${globalIdx}`;
        const tm = trackMeta[id] ?? {};
        return (
          <SongRow
            key={id}
            song={song} index={idx}
            isActive={currentIndex === globalIdx}
            isPlaying={isPlaying}
            isFav={tm.fav ?? song.favorite ?? false}
            isLiked={tm.liked ?? song.liked ?? false}
            onPlay={() => playSong(globalIdx)}
            onFav={() => toggleMeta(id, 'fav')}
            onLike={() => toggleMeta(id, 'liked')}
            onDragStart={() => handleDragStart(globalIdx)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(globalIdx)}
          />
        );
      });
    }

    // Albums view
    return Object.entries(groupedByAlbum).map(([albumName, albumSongs]) => (
      <div key={albumName} className="hm-album-group">
        <div className="hm-album-label">
          <span className="hm-album-label-text">{albumName}</span>
          <div className="hm-album-label-line" />
          <span style={{ fontSize: 10, color: 'var(--t3)' }}>{albumSongs.length}</span>
        </div>
        {albumSongs.map((song, idx) => {
          const globalIdx = songs.findIndex(s => s.id === song.id);
          const id = song.id ?? `s${globalIdx}`;
          const tm = trackMeta[id] ?? {};
          return (
            <SongRow
              key={id}
              song={song} index={idx}
              isActive={currentIndex === globalIdx}
              isPlaying={isPlaying}
              isFav={tm.fav ?? song.favorite ?? false}
              isLiked={tm.liked ?? song.liked ?? false}
              onPlay={() => playSong(globalIdx)}
              onFav={() => toggleMeta(id, 'fav')}
              onLike={() => toggleMeta(id, 'liked')}
              onDragStart={() => handleDragStart(globalIdx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(globalIdx)}
            />
          );
        })}
      </div>
    ));
  };

  /* ─────────────────────────────────────────────────────────
     MAIN RENDER
  ───────────────────────────────────────────────────────── */
  return (
    <>
      <style>{CSS}</style>

      <div className="hm-root">

        {/* ── Header ── */}
        <div className="hm-header">

          {/* Greeting + stats */}
          <div className="hm-greeting-row">
            <div>
              <h1 className="hm-greeting-title">
                {getGreeting()}, <span>Ava.</span>
              </h1>
              <p className="hm-greeting-sub">Your offline library · always ready</p>
            </div>
            <div className="hm-stats">
              <div className="hm-stat"><b>{songs.length}</b> songs</div>
              <div className="hm-stat"><b>{uniqueArtists}</b> artists</div>
              {uniqueAlbums > 0 && <div className="hm-stat"><b>{uniqueAlbums}</b> albums</div>}
            </div>
          </div>

          {/* Controls row */}
          <div className="hm-controls-row">
            {/* Search */}
            <div className="hm-search-wrap" ref={searchRef}>
              <FaSearch />
              <input
                className="hm-search"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => query && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
                placeholder="Search your library…"
              />
              {showResults && searchResults.length > 0 && (
                <div className="hm-results">
                  {searchResults.slice(0, 6).map((s, i) => (
                    <div key={s.id ?? i} className="hm-result-row" onClick={() => {
                      setQuery(s.name);
                      const idx = songs.findIndex(x => x.id === s.id);
                      if (idx !== -1) playSong(idx);
                      setShowResults(false);
                    }}>
                      <img src={s.cover} alt={s.name}
                        onError={e => { e.target.src = 'https://placehold.co/34x34/111/333?text=♪'; }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filter tabs */}
            <div className="hm-tabs">
              {['Songs', 'Albums'].map(t => (
                <button key={t} className={`hm-tab${activeFilter === t ? ' active' : ''}`}
                  onClick={() => setActiveFilter(t)}>{t}</button>
              ))}
            </div>

            {/* Playback micro-controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              {/* Shuffle */}
              <button
                title="Shuffle"
                onClick={() => setShuffle(s => !s)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: 'none',
                  background: shuffle ? 'rgba(29,185,84,0.18)' : 'var(--s1)',
                  color: shuffle ? 'var(--g)' : 'var(--t3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <FaRandom style={{ fontSize: 11 }} />
              </button>

              {/* Prev */}
              <button onClick={prevSong} disabled={currentIndex === 0}
                style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--s1)', color: currentIndex === 0 ? 'var(--t3)' : 'var(--t2)', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                <FaStepBackward style={{ fontSize: 11 }} />
              </button>

              {/* Play/Pause */}
              <button
                onClick={() => setIsPlaying(p => !p)}
                disabled={songs.length === 0}
                style={{
                  width: 38, height: 38, borderRadius: '50%', border: 'none',
                  background: songs.length === 0 ? 'rgba(29,185,84,0.3)' : '#1DB954',
                  color: '#fff', cursor: songs.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 18px rgba(29,185,84,0.35)',
                  transition: 'background 0.15s, transform 0.1s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { if (songs.length) e.currentTarget.style.background = '#23E065'; }}
                onMouseLeave={e => { e.currentTarget.style.background = songs.length === 0 ? 'rgba(29,185,84,0.3)' : '#1DB954'; }}
              >
                {isPlaying
                  ? <FaPause style={{ fontSize: 12 }} />
                  : <FaPlay  style={{ fontSize: 12, marginLeft: 2 }} />}
              </button>

              {/* Next */}
              <button onClick={nextSong} disabled={!shuffle && currentIndex === songs.length - 1}
                style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--s1)', color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                <FaStepForward style={{ fontSize: 11 }} />
              </button>

              {/* Repeat */}
              <button onClick={cycleRepeat}
                title={repeatMode === 'one' ? 'Repeat one' : repeatMode === 'all' ? 'Repeat all' : 'No repeat'}
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: 'none',
                  background: repeatMode !== 'off' ? 'rgba(29,185,84,0.18)' : 'var(--s1)',
                  color: repeatMode !== 'off' ? 'var(--g)' : 'var(--t3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, color 0.15s', position: 'relative',
                }}>
                <FaRedo style={{ fontSize: 11 }} />
                {repeatMode === 'one' && (
                  <span style={{ position: 'absolute', bottom: -1, right: -1, fontSize: 8, fontWeight: 800, background: 'var(--g)', color: '#000', borderRadius: '50%', width: 12, height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                )}
              </button>

              {/* Volume */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowVolume(v => !v)}
                  style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: showVolume ? 'var(--s2)' : 'var(--s1)', color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                  {volume === 0 ? <FaVolumeMute style={{ fontSize: 11 }} /> : <FaVolumeUp style={{ fontSize: 11 }} />}
                </button>

                {showVolume && (
                  <div style={{
                    position: 'absolute', bottom: 42, left: '50%', transform: 'translateX(-50%)',
                    background: '#141618', border: '1px solid var(--b1)', borderRadius: 14,
                    padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    boxShadow: '0 16px 48px rgba(0,0,0,0.5)', zIndex: 50, width: 44,
                  }}>
                    <input
                      type="range" min={0} max={1} step={0.01} value={volume}
                      onChange={e => setVolume(Number(e.target.value))}
                      style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 80, cursor: 'pointer', accentColor: '#1DB954' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--t3)', fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round(volume * 100)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Genre chips */}
          <div className="hm-genres">
            {GENRES.map(g => (
              <button key={g} className={`hm-genre${selectedGenre === g ? ' active' : ''}`}
                onClick={() => setSelectedGenre(g)}>{g}</button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="hm-body">

          {/* Now Playing */}
          {renderNowPlaying()}

          {/* Queue */}
          <div className="hm-queue">
            <div className="hm-queue-head">
              <h2 className="hm-queue-title">{activeFilter === 'Songs' ? 'Queue' : 'Albums'}</h2>
              <span className="hm-queue-count">
                {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'}
              </span>
            </div>
            <div className="hm-queue-body">
              {renderQueue()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}