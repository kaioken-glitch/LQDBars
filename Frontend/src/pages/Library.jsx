import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faEllipsisH } from '@fortawesome/free-solid-svg-icons';
import { FaSearch, FaPlay, FaRandom, FaMusic, FaListUl } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylists } from '../hooks/usePlaylists';

/* ── DOMINANT COLOR EXTRACTION ──────────────────────────────────────
   Same technique used by Playlists.jsx's DetailView — canvas sample,
   saturation/luminance-weighted pick. Powers the "background mutates
   to match the art" hero treatment so every detail view in the app
   behaves identically.
───────────────────────────────────────────────────────────────────── */
const ACCENT_FALLBACK = '29, 185, 84'; // brand green — used until real color resolves
const ACCENT_CACHE = new Map();

function extractAccentRGB(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    if (ACCENT_CACHE.has(src)) { resolve(ACCENT_CACHE.get(src)); return; }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let bestR = 0, bestG = 0, bestB = 0, bestScore = -1;
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          const score = sat * 1.5 + (1 - Math.abs(lum - 0.45));
          if (score > bestScore) { bestScore = score; bestR = r; bestG = g; bestB = b; }
        }
        const result = `${bestR}, ${bestG}, ${bestB}`;
        ACCENT_CACHE.set(src, result);
        resolve(result);
      } catch (_) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');

.lib-root {
  --g:      #1DB954;
  --g2:     #23E065;
  --gdim:   rgba(29,185,84,0.14);
  --gglow:  rgba(29,185,84,0.28);
  --s1:     rgba(255,255,255,0.04);
  --s2:     rgba(255,255,255,0.07);
  --sh:     rgba(255,255,255,0.09);
  --b1:     rgba(255,255,255,0.07);
  --b2:     rgba(255,255,255,0.13);
  --t1:     #fff;
  --t2:     rgba(255,255,255,0.55);
  --t3:     rgba(255,255,255,0.28);
  --ease:   cubic-bezier(0.4,0,0.2,1);
  --spring: cubic-bezier(0.22,1,0.36,1);
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
  color: var(--t1);
}
.lib-root *, .lib-root *::before, .lib-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.lib-root button { font-family: inherit; cursor: pointer; border: none; background: none; }
.lib-shell { width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.lib-header { flex-shrink: 0; padding: 28px 28px 0; background: linear-gradient(180deg, rgba(29,185,84,0.06) 0%, transparent 100%); }
.lib-header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.lib-title-block { flex: 1; min-width: 0; }
.lib-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--g); display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.lib-eyebrow-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--g); }
.lib-title { font-family: 'Syne', sans-serif; font-size: clamp(34px, 5vw, 58px); font-weight: 800; letter-spacing: -0.045em; line-height: 1; color: var(--t1); }
.lib-title em { font-style: normal; color: var(--g2); }
.lib-subtitle { font-size: 12px; color: var(--t3); margin-top: 5px; letter-spacing: 0.02em; }
.lib-header-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.lib-search-wrap { position: relative; }
.lib-search-ico { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--t3); font-size: 12px; pointer-events: none; }
.lib-search { padding: 9px 14px 9px 36px; width: 220px; background: var(--s1); border: 1px solid var(--b1); border-radius: 9999px; color: var(--t1); font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; transition: border-color .18s var(--ease), background .18s var(--ease), box-shadow .18s var(--ease); }
.lib-search::placeholder { color: var(--t3); }
.lib-search:focus { border-color: rgba(29,185,84,.5); background: var(--s2); box-shadow: 0 0 0 3px rgba(29,185,84,.10); }
.lib-divider { height: 1px; background: var(--b1); margin: 18px 0 0; }
.lib-content { flex: 1; overflow-y: auto; padding: 24px 28px 40px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent; }
.lib-content::-webkit-scrollbar { width: 4px; }
.lib-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 3px; }
.lib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 16px; }
@media (min-width: 500px)  { .lib-grid { grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 18px; } }
@media (min-width: 768px)  { .lib-grid { grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 20px; } }
@media (min-width: 1024px) { .lib-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 24px; } }
.lib-card { position: relative; background: var(--s1); border: 1px solid var(--b1); border-radius: 18px; overflow: hidden; cursor: pointer; transition: transform .24s var(--spring), border-color .22s var(--ease), box-shadow .22s var(--ease); animation: libUp .38s var(--spring) both; }
@keyframes libUp { from { opacity: 0; transform: translateY(18px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
.lib-card:hover { transform: translateY(-6px) scale(1.025); border-color: rgba(29,185,84,.28); box-shadow: 0 24px 56px rgba(0,0,0,.55), 0 0 32px rgba(29,185,84,.07); }
.lib-card:nth-child(1){animation-delay:.03s} .lib-card:nth-child(2){animation-delay:.06s} .lib-card:nth-child(3){animation-delay:.09s} .lib-card:nth-child(4){animation-delay:.12s} .lib-card:nth-child(5){animation-delay:.15s} .lib-card:nth-child(n+6){animation-delay:.17s}
.lib-art { position: relative; width: 100%; padding-top: 100%; }
.lib-art-mosaic { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(29,185,84,.12); }
.lib-art-single { position: absolute; inset: 0; overflow: hidden; }
.lib-art-mosaic img, .lib-art-single img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .55s var(--ease); }
.lib-card:hover .lib-art-mosaic img, .lib-card:hover .lib-art-single img { transform: scale(1.07); }
.lib-art-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.72) 0%, transparent 55%); opacity: 0; transition: opacity .22s var(--ease); display: flex; align-items: center; justify-content: center; }
.lib-card:hover .lib-art-overlay { opacity: 1; }
.lib-play-btn { width: 46px; height: 46px; border-radius: 50%; background: var(--g); color: #000; font-size: 15px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 22px rgba(29,185,84,.5); transform: scale(.82) translateY(4px); transition: transform .22s var(--spring), background .15s var(--ease); }
.lib-card:hover .lib-play-btn { transform: scale(1) translateY(0); }
.lib-play-btn:hover { background: var(--g2); }
.lib-card-info { padding: 13px 15px 15px; }
.lib-card-name { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; letter-spacing: -.01em; }
.lib-card-artist { font-size: 11px; color: var(--t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
.lib-card-count { font-size: 11px; color: var(--t3); }
.lib-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 55vh; gap: 16px; text-align: center; }
.lib-empty-icon { width: 80px; height: 80px; border-radius: 50%; background: var(--s1); border: 1px solid var(--b1); display: flex; align-items: center; justify-content: center; font-size: 30px; color: var(--t3); animation: libPulse 3s ease-in-out infinite; }
@keyframes libPulse { 0%,100%{box-shadow:0 0 0 0 rgba(29,185,84,0)} 50%{box-shadow:0 0 0 8px rgba(29,185,84,.08)} }
.lib-empty h3 { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800; color: var(--t1); letter-spacing: -.025em; }
.lib-empty p { font-size: 14px; color: var(--t3); max-width: 300px; line-height: 1.6; }

/* ══ DETAIL VIEW — Apple-Music-style, art-color-mutated hero.
   This is the ONE canonical detail-view treatment, shared verbatim
   (structure + class naming pattern) with Playlists.jsx's DetailView
   and HomeOnline.jsx's renderDetail. Don't fork this — if the hero
   needs to change, change it everywhere. ══ */
.lib-detail { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; overflow: hidden; background: #07080A; animation: libDetailFadeIn .3s var(--ease) both; }
@keyframes libDetailFadeIn { from{opacity:0} to{opacity:1} }

.lib-detail-tint { position: absolute; inset: 0; z-index: 1; pointer-events: none; transition: background 0.7s ease; }
.lib-detail-tint-scrim { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: linear-gradient(180deg, transparent 0%, rgba(7,8,10,.35) 55%, #07080A 100%); }

.lib-detail-nav { position: relative; z-index: 10; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 4px; }
.lib-detail-nav-btn { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.10); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.14); color: var(--t1); font-size: 14px; display: flex; align-items: center; justify-content: center; transition: background .15s, transform .15s; }
.lib-detail-nav-btn:hover { background: rgba(255,255,255,.18); }
.lib-detail-nav-btn:active { transform: scale(.9); }

.lib-detail-hero { position: relative; z-index: 10; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px 24px 4px; gap: 5px; }
.lib-detail-art-wrap { position: relative; width: min(260px, 58vw); height: min(260px, 58vw); flex-shrink: 0; margin-bottom: 6px; }
.lib-detail-art-glow { position: absolute; inset: -16px; border-radius: 32px; background: radial-gradient(circle, var(--gglow) 0%, transparent 70%); filter: blur(20px); animation: libDetailGlow 3.5s ease-in-out infinite; }
@keyframes libDetailGlow { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.9;transform:scale(1.05)} }
.lib-detail-art { position: relative; z-index: 1; width: 100%; height: 100%; border-radius: 22px; overflow: hidden; box-shadow: 0 32px 80px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.08); }
.lib-detail-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lib-detail-art-empty { width: 100%; height: 100%; background: linear-gradient(135deg,rgba(29,185,84,.18),rgba(0,0,0,.35)); display: flex; align-items: center; justify-content: center; font-size: 52px; color: rgba(29,185,84,.3); }

.lib-detail-name { font-family: 'Syne', sans-serif; font-size: clamp(22px,4.5vw,32px); font-weight: 800; letter-spacing: -.03em; color: #fff; line-height: 1.1; max-width: 480px; }
.lib-detail-subtitle { font-size: 14px; color: rgba(255,255,255,.6); }
.lib-detail-metaline { font-size: 12px; color: rgba(255,255,255,.38); margin-bottom: 4px; }

.lib-detail-actions { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 14px; width: 100%; max-width: 340px; }
.lib-detail-circle-btn { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.15); color: #fff; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: background .15s, transform .15s; }
.lib-detail-circle-btn:hover { background: rgba(255,255,255,.17); transform: scale(1.06); }
.lib-detail-circle-btn:active { transform: scale(.92); }
.lib-detail-play-pill { flex: 1; display: flex; align-items: center; justify-content: center; gap: 9px; padding: 14px 0; border-radius: 9999px; background: #fff; color: #000; font-family: 'Syne', sans-serif; font-weight: 800; font-size: 15px; box-shadow: 0 10px 32px rgba(0,0,0,.45); transition: background .15s, transform .15s var(--spring), box-shadow .15s; }
.lib-detail-play-pill:hover { transform: translateY(-1px) scale(1.015); box-shadow: 0 14px 40px rgba(0,0,0,.55); }
.lib-detail-play-pill:active { transform: scale(.97); }

.lib-detail-divider { position: relative; z-index: 10; height: 1px; background: rgba(255,255,255,.07); margin: 24px 24px 2px; flex-shrink: 0; }

.lib-tracks { position: relative; z-index: 10; flex: 1; overflow-y: auto; padding: 0 20px 48px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent; }
.lib-tracks::-webkit-scrollbar { width: 4px; }
.lib-tracks::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 3px; }
.lib-tracks-label { font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--t3); padding: 14px 12px 12px; }
.lib-track-row { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,.05); transition: background .14s; }
.lib-track-row:last-child { border-bottom: none; }
.lib-track-row:hover { background: var(--s2); }
.lib-track-row.active { background: rgba(29,185,84,.09); }
.lib-track-num { width: 22px; text-align: center; font-size: 13px; color: var(--t3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.lib-track-row.active .lib-track-num { color: var(--g); }
.lib-track-thumb { width: 40px; height: 40px; border-radius: 8px; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,.35); }
.lib-track-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lib-track-meta { flex: 1; min-width: 0; }
.lib-track-name { font-size: 13.5px; font-weight: 600; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; transition: color .14s; }
.lib-track-row:hover .lib-track-name, .lib-track-row.active .lib-track-name { color: var(--g); }
.lib-track-artist { font-size: 11px; color: var(--t3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lib-track-dur { font-size: 11px; color: var(--t3); font-variant-numeric: tabular-nums; flex-shrink: 0; }

/* ─────────────────────────────────────────────────────────────────────
   MOBILE
───────────────────────────────────────────────────────────────────── */
@media (max-width: 767px) {
  .lib-header { padding: 18px 16px 0; }
  .lib-header-top { gap: 10px; margin-bottom: 16px; }
  .lib-title-block { width: 100%; }
  .lib-title { font-size: clamp(28px, 9vw, 38px); }
  .lib-subtitle { font-size: 11px; }
  .lib-header-controls { width: 100%; }
  .lib-search-wrap { width: 100%; }
  .lib-search { width: 100%; }
  .lib-divider { margin-top: 14px; }

  .lib-content { padding: 16px 16px 32px; }
  .lib-grid { grid-template-columns: repeat(auto-fill, minmax(122px, 1fr)); gap: 12px; }
  .lib-card-info { padding: 10px 11px 12px; }
  .lib-card-name { font-size: 12px; }
  .lib-card-artist, .lib-card-count { font-size: 10px; }

  .lib-art-overlay { opacity: 1; background: linear-gradient(to top, rgba(0,0,0,.6) 0%, transparent 60%); }
  .lib-play-btn { transform: scale(0.84) translateY(0); width: 40px; height: 40px; font-size: 13px; }

  .lib-empty { min-height: 48vh; padding: 0 24px; }
  .lib-empty-icon { width: 64px; height: 64px; font-size: 24px; }
  .lib-empty h3 { font-size: 20px; }
  .lib-empty p { font-size: 13px; max-width: 260px; }

  .lib-detail-nav { padding: 14px 16px 2px; }
  .lib-detail-hero { padding: 12px 18px 2px; }
  .lib-detail-actions { max-width: 300px; gap: 10px; }
  .lib-detail-circle-btn { width: 44px; height: 44px; }
  .lib-detail-play-pill { padding: 12px 0; font-size: 14px; }
  .lib-detail-divider { margin: 18px 16px 2px; }

  .lib-tracks { padding: 0 12px 28px; }
  .lib-tracks-label { padding: 0 8px 10px; }
  .lib-track-row { padding: 9px 8px; gap: 10px; }
  .lib-track-thumb { width: 36px; height: 36px; }
  .lib-track-name { font-size: 12px; }
  .lib-track-artist { font-size: 10px; }
  .lib-track-dur { font-size: 10px; }
}

@media (max-width: 380px) {
  .lib-grid { grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 10px; }
  .lib-title { font-size: clamp(24px, 9vw, 32px); }
}
`;

const FB = 'https://placehold.co/200x200/061408/112208?text=♪';

const AlbumCard = memo(({ alb, onOpen, onPlay }) => {
  const covers = alb.songs.slice(0, 4).map(s => s.cover || FB);
  const single = covers.length <= 1;
  return (
    <div className="lib-card" onClick={() => onOpen(alb)}>
      <div className="lib-art">
        {single
          ? <div className="lib-art-single"><img src={covers[0] || FB} alt={alb.album} onError={e => { e.target.src = FB; }} /></div>
          : <div className="lib-art-mosaic">{covers.map((c, i) => <img key={i} src={c} alt="" onError={e => { e.target.src = FB; }} />)}</div>
        }
        <div className="lib-art-overlay">
          <button className="lib-play-btn" onClick={e => { e.stopPropagation(); onPlay(alb.songs); }} aria-label={`Play ${alb.album}`}>
            <FaPlay style={{ marginLeft: 2 }} />
          </button>
        </div>
      </div>
      <div className="lib-card-info">
        <div className="lib-card-name">{alb.album}</div>
        <div className="lib-card-artist">{alb.songs[0]?.artist || 'Unknown Artist'}</div>
        <div className="lib-card-count">{alb.songs.length} song{alb.songs.length !== 1 ? 's' : ''}</div>
      </div>
    </div>
  );
});

const TrackRow = memo(({ song, index, isActive, onClick }) => (
  <div className={`lib-track-row${isActive ? ' active' : ''}`} onClick={onClick} role="button" aria-label={`Play ${song.name}`}>
    <span className="lib-track-num">{index + 1}</span>
    <div className="lib-track-thumb">
      <img src={song.cover || FB} alt={song.name} onError={e => { e.target.src = FB; }} />
    </div>
    <div className="lib-track-meta">
      <div className="lib-track-name">{song.name}</div>
      <div className="lib-track-artist">{song.artist || 'Unknown'}</div>
    </div>
    <span className="lib-track-dur">{song.formattedDuration || song.duration || ''}</span>
  </div>
));

/* ── DETAIL VIEW — same hero pattern as Playlists.jsx's DetailView ── */
function AlbumDetailView({ selected, currentSong, onClose, onPlay, onShuffle }) {
  const [accentRGB, setAccentRGB] = useState(ACCENT_FALLBACK);
  const coverSrc = selected.songs?.[0]?.cover || null;

  useEffect(() => {
    let cancelled = false;
    if (!coverSrc) { setAccentRGB(ACCENT_FALLBACK); return; }
    extractAccentRGB(coverSrc).then(rgb => {
      if (!cancelled && rgb) setAccentRGB(rgb);
    });
    return () => { cancelled = true; };
  }, [coverSrc]);

  const totalSeconds = useMemo(() => {
    return (selected.songs || []).reduce((sum, s) => {
      const raw = s.durationSeconds ?? null;
      if (raw != null) return sum + raw;
      const parts = String(s.formattedDuration || s.duration || '').split(':').map(Number);
      if (parts.length === 2 && !parts.some(Number.isNaN)) return sum + parts[0] * 60 + parts[1];
      return sum;
    }, 0);
  }, [selected.songs]);

  const durationLabel = useMemo(() => {
    if (!totalSeconds) return null;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.round((totalSeconds % 3600) / 60);
    return h > 0 ? `${h} hr ${m} min` : `${m} min`;
  }, [totalSeconds]);

  return (
    <div className="lib-root" style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <style>{CSS}</style>
      <div className="lib-detail">

        <div
          className="lib-detail-tint"
          style={{
            background: `
              radial-gradient(ellipse 70% 42% at 50% 0%, rgba(${accentRGB},0.38) 0%, transparent 62%),
              linear-gradient(180deg, rgba(${accentRGB},0.30) 0%, rgba(${accentRGB},0.10) 32%, #07080A 76%)
            `,
          }}
        />
        <div className="lib-detail-tint-scrim" />

        <div className="lib-detail-nav">
          <button className="lib-detail-nav-btn" onClick={onClose} aria-label="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 13 }} />
          </button>
          <button className="lib-detail-nav-btn" aria-label="More options">
            <FontAwesomeIcon icon={faEllipsisH} style={{ fontSize: 13 }} />
          </button>
        </div>

        <div className="lib-detail-hero">
          <div className="lib-detail-art-wrap">
            <div className="lib-detail-art-glow" />
            <div className="lib-detail-art">
              {selected.songs?.length > 0
                ? <img src={selected.songs[0]?.cover || FB} alt={selected.album} onError={e => { e.target.src = FB; }} />
                : <div className="lib-detail-art-empty"><FaListUl /></div>
              }
            </div>
          </div>

          <h1 className="lib-detail-name">{selected.album}</h1>
          <p className="lib-detail-subtitle">{selected.songs[0]?.artist || 'Various Artists'}</p>
          <p className="lib-detail-metaline">
            {selected.songs.length} song{selected.songs.length !== 1 ? 's' : ''}{durationLabel ? ` · ${durationLabel}` : ''}
          </p>

          <div className="lib-detail-actions">
            <button className="lib-detail-circle-btn" onClick={() => onShuffle(selected.songs)} title="Shuffle" aria-label="Shuffle play">
              <FaRandom />
            </button>
            <button className="lib-detail-play-pill" onClick={() => onPlay(selected.songs)}>
              <FaPlay style={{ fontSize: 13, marginLeft: 1 }} /> Play
            </button>
          </div>
        </div>

        <div className="lib-detail-divider" />

        <div className="lib-tracks">
          <div className="lib-tracks-label">Tracks · {selected.songs.length}</div>
          {selected.songs.map((song, i) => (
            <TrackRow
              key={song.id || i}
              song={song} index={i}
              isActive={currentSong?.id === song.id}
              onClick={() => onPlay(selected.songs, i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Library() {
  const { currentSong, setIsPlaying, setPlayerSongs } = usePlayer();
  // librarySongs lives in the usePlaylists hook under the hidden __library__ playlist
  const { librarySongs } = usePlaylists();

  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return librarySongs;
    const q = query.toLowerCase();
    return librarySongs.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.artist?.toLowerCase().includes(q) ||
      s.album?.toLowerCase().includes(q)
    );
  }, [librarySongs, query]);

  const albums = useMemo(() => {
    const map = {};
    filtered.forEach(s => {
      const k = s.album || 'Unknown Album';
      if (!map[k]) map[k] = [];
      map[k].push(s);
    });
    return Object.values(map).map(songs => ({ album: songs[0].album || 'Unknown Album', songs }));
  }, [filtered]);

  const playAlbum = useCallback((songs, startIdx = 0) => {
    if (!songs?.length) return;
    // Pass startIdx directly into setPlayerSongs — it sets both songs + index atomically.
    // Defer setIsPlaying so PlayerContext's song-change useEffect loads the new src first.
    // (Same pattern used in Playlists.jsx to avoid playing stale/empty src.)
    setPlayerSongs(songs, startIdx);
    setTimeout(() => setIsPlaying(true), 80);
  }, [setPlayerSongs, setIsPlaying]);

  const playSong = useCallback((song, songs) => {
    const idx = songs.findIndex(s => s.id === song.id);
    playAlbum(songs, idx >= 0 ? idx : 0);
  }, [playAlbum]);

  const shuffleAlbum = useCallback((songs) => {
    playAlbum([...songs].sort(() => Math.random() - 0.5));
  }, [playAlbum]);

  // AlbumDetailView's onPlay is used both for "Play" (no index) and for
  // clicking a track row (with index) — playAlbum already handles both.
  const handleDetailPlay = useCallback((songs, idx) => {
    if (typeof idx === 'number') playAlbum(songs, idx);
    else playAlbum(songs);
  }, [playAlbum]);

  return (
    <div className="lib-root" style={{ width: '100%', height: '100%' }}>
      <style>{CSS}</style>
      <div className="lib-shell">
        <div className="lib-header">
          <div className="lib-header-top">
            <div className="lib-title-block">
              <div className="lib-eyebrow"><span className="lib-eyebrow-dot" /> Your Collection</div>
              <h1 className="lib-title">Li<em>brary</em></h1>
              <p className="lib-subtitle">{albums.length} albums · {filtered.length} songs</p>
            </div>
            <div className="lib-header-controls">
              <div className="lib-search-wrap">
                <FaSearch className="lib-search-ico" />
                <input
                  className="lib-search"
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search library…"
                  aria-label="Search library"
                />
              </div>
            </div>
          </div>
          <div className="lib-divider" />
        </div>

        <div className="lib-content">
          {albums.length === 0 ? (
            <div className="lib-empty">
              <div className="lib-empty-icon"><FaMusic /></div>
              <h3>Library is empty</h3>
              <p>Import local music or download tracks to see them here.</p>
            </div>
          ) : (
            <div className="lib-grid">
              {albums.map(alb => (
                <AlbumCard key={alb.album} alb={alb} onOpen={setSelected} onPlay={playAlbum} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <AlbumDetailView
          selected={selected}
          currentSong={currentSong}
          onClose={() => setSelected(null)}
          onPlay={handleDetailPlay}
          onShuffle={shuffleAlbum}
        />
      )}
    </div>
  );
}