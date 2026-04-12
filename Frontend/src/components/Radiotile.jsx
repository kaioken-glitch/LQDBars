/**
 * Radiotile.jsx
 *
 * RadioTile  — a shelf card (same size as ho-dl-tile) that lives in the
 *              Downloaded section. Clicking it opens RadioDetailView.
 *
 * RadioDetailView — full-screen detail view showing:
 *   • currently playing song
 *   • upcoming radio queue (songs with source === 'radio')
 *   • start / stop controls
 */

import React, { useCallback } from 'react';
import { FaPlay, FaPause, FaStepForward, FaTimes, FaInfinity } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import { useSmartRadio as useRadio } from '../hooks/useSmartRadio';

/* ─── shared mini wave ─────────────────────────────────────────── */
function WaveIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}>
      {[
        { x: 0,  ys: ['6','1','11'], dur: '0.55s', delay: '0s'    },
        { x: 4,  ys: ['8','1','11'], dur: '0.7s',  delay: '0.1s'  },
        { x: 8,  ys: ['3','0','10'], dur: '0.5s',  delay: '0.05s' },
        { x: 12, ys: ['6','2','11'], dur: '0.65s', delay: '0.15s' },
      ].map((b, i) => (
        <rect key={i} x={b.x} y={b.ys[0]} width="2.5" rx="1.2"
          height={String(12 - parseInt(b.ys[0]))} fill="#1DB954">
          <animate attributeName="y"
            values={`${b.ys[0]};${b.ys[1]};${b.ys[2]};${b.ys[0]}`}
            dur={b.dur} repeatCount="indefinite" begin={b.delay} />
          <animate attributeName="height"
            values={`${12-parseInt(b.ys[0])};${12-parseInt(b.ys[1])};${12-parseInt(b.ys[2])};${12-parseInt(b.ys[0])}`}
            dur={b.dur} repeatCount="indefinite" begin={b.delay} />
        </rect>
      ))}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   CSS
───────────────────────────────────────────────────────────────── */
const CSS = `
/* ── RadioTile card ── */
.rt-tile {
  flex-shrink: 0;
  width: 190px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(29,185,84,0.18) 0%, rgba(0,0,0,0.35) 100%);
  border: 1px solid rgba(29,185,84,0.28);
  cursor: pointer;
  transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1),
              border-color 0.22s, box-shadow 0.22s;
  position: relative;
}
.rt-tile:hover {
  transform: translateY(-3px) scale(1.02);
  border-color: rgba(29,185,84,0.55);
  box-shadow: 0 16px 48px rgba(0,0,0,0.5), 0 0 30px rgba(29,185,84,0.12);
}
.rt-tile-art {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(29,185,84,0.22) 0%, rgba(0,0,0,0.5) 100%);
  position: relative;
  overflow: hidden;
}
.rt-tile-art-bg {
  position: absolute; inset: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  opacity: 0.35;
  filter: blur(2px);
}
.rt-tile-art-bg img {
  width: 100%; height: 100%; object-fit: cover;
}
.rt-tile-art-icon {
  position: relative; z-index: 2;
  width: 56px; height: 56px;
  border-radius: 50%;
  background: rgba(29,185,84,0.9);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 32px rgba(29,185,84,0.6);
  font-size: 22px; color: #000;
}
.rt-tile-art-icon.on {
  animation: rt-pulse 2s ease-in-out infinite;
}
@keyframes rt-pulse {
  0%,100% { box-shadow: 0 0 20px rgba(29,185,84,0.5); }
  50%      { box-shadow: 0 0 40px rgba(29,185,84,0.9); }
}
.rt-tile-info {
  padding: 12px 14px 44px;
}
.rt-tile-name {
  font-family: 'Syne', sans-serif;
  font-size: 14px; font-weight: 700;
  color: #fff; margin-bottom: 2px;
}
.rt-tile-sub {
  font-size: 12px; color: rgba(255,255,255,0.48);
}
.rt-tile-play {
  position: absolute;
  bottom: 12px; right: 12px;
  width: 36px; height: 36px; border-radius: 50%;
  background: #1DB954; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 20px rgba(29,185,84,0.5);
  transition: background 0.15s, transform 0.15s;
}
.rt-tile-play:hover { background: #23E065; transform: scale(1.1); }

/* ── RadioDetailView ── */
.rd-root {
  display: flex; flex-direction: column;
  height: 100%; overflow: hidden; position: relative;
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
  background: #07080A;
}
.rd-bg {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(29,185,84,0.18) 0%, transparent 65%),
              linear-gradient(180deg, rgba(4,28,16,0.7) 0%, #07080A 60%);
}
.rd-header {
  position: relative; z-index: 2; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 22px;
  background: rgba(0,0,0,0.2); backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.rd-header-title {
  font-family: 'Syne', sans-serif;
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: rgba(255,255,255,0.45);
}
.rd-close {
  width: 34px; height: 34px; border-radius: 50%;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.10);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,0.55);
  font-size: 13px;
  transition: background 0.15s, color 0.15s;
}
.rd-close:hover { background: rgba(255,255,255,0.12); color: #fff; }

/* Hero */
.rd-hero {
  position: relative; z-index: 2; flex-shrink: 0;
  display: flex; flex-direction: column; align-items: center;
  padding: 28px 24px 20px; gap: 16px;
}
.rd-hero-art {
  position: relative; width: 140px; height: 140px; flex-shrink: 0;
}
.rd-hero-art-glow {
  position: absolute; inset: -16px; border-radius: 50%;
  background: radial-gradient(circle, rgba(29,185,84,0.4) 0%, transparent 70%);
  filter: blur(20px); animation: rdGlow 3s ease-in-out infinite;
}
@keyframes rdGlow { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
.rd-hero-art-img {
  position: relative; z-index: 1;
  width: 100%; height: 100%; object-fit: cover;
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08);
}
.rd-hero-art-empty {
  position: relative; z-index: 1;
  width: 100%; height: 100%; border-radius: 18px;
  background: linear-gradient(135deg, rgba(29,185,84,0.2), rgba(0,0,0,0.4));
  display: flex; align-items: center; justify-content: center;
  font-size: 48px; color: rgba(29,185,84,0.4);
}
.rd-hero-meta { text-align: center; }
.rd-hero-label {
  font-size: 10px; font-weight: 700; letter-spacing: 0.16em;
  text-transform: uppercase; color: #1DB954; margin-bottom: 5px;
}
.rd-hero-title {
  font-family: 'Syne', sans-serif;
  font-size: clamp(20px, 4vw, 28px); font-weight: 800;
  letter-spacing: -0.03em; color: #fff;
  margin-bottom: 3px; line-height: 1.1;
}
.rd-hero-artist { font-size: 13px; color: rgba(255,255,255,0.45); margin-bottom: 16px; }

/* Controls */
.rd-controls {
  display: flex; align-items: center; gap: 14px;
}
.rd-ctrl-btn {
  background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,0.5); font-size: 18px;
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.rd-ctrl-btn:hover { color: #fff; background: rgba(255,255,255,0.07); }
.rd-play-btn {
  width: 58px; height: 58px; border-radius: 50%;
  background: #fff; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #000; font-size: 20px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.4);
  transition: transform 0.18s, background 0.18s;
}
.rd-play-btn:hover { background: #23E065; transform: scale(1.07); }
.rd-play-btn:active { transform: scale(0.94); }
.rd-stop-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 16px; border-radius: 9999px;
  background: rgba(255,68,68,0.12);
  border: 1px solid rgba(255,68,68,0.25);
  color: #ff6b6b; font-size: 12px; font-weight: 600;
  cursor: pointer; font-family: 'DM Sans', sans-serif;
  transition: background 0.15s;
}
.rd-stop-btn:hover { background: rgba(255,68,68,0.2); }

/* Divider */
.rd-divider {
  position: relative; z-index: 2; flex-shrink: 0;
  height: 1px; background: rgba(255,255,255,0.07);
  margin: 0 22px 0;
}

/* Queue list */
.rd-queue {
  position: relative; z-index: 2;
  flex: 1; overflow-y: auto;
  padding: 0 16px 40px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.07) transparent;
}
.rd-queue::-webkit-scrollbar { width: 3px; }
.rd-queue::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }

.rd-queue-label {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: rgba(255,255,255,0.28);
  padding: 14px 12px 10px;
}
.rd-track {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 12px; border-radius: 12px;
  cursor: pointer; border: 1px solid transparent;
  transition: background 0.14s, border-color 0.14s;
}
.rd-track:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.07); }
.rd-track.active { background: rgba(29,185,84,0.09); border-color: rgba(29,185,84,0.2); }
.rd-track-num {
  width: 22px; text-align: center; font-size: 11px;
  color: rgba(255,255,255,0.25); font-variant-numeric: tabular-nums; flex-shrink: 0;
}
.rd-track.active .rd-track-num { color: #1DB954; }
.rd-track-thumb {
  width: 40px; height: 40px; border-radius: 8px;
  overflow: hidden; flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.35);
}
.rd-track-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.rd-track-meta { flex: 1; min-width: 0; }
.rd-track-name {
  font-size: 13px; font-weight: 600; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 2px; transition: color 0.14s;
}
.rd-track:hover .rd-track-name { color: #1DB954; }
.rd-track.active .rd-track-name { color: #1DB954; }
.rd-track-artist {
  font-size: 11px; color: rgba(255,255,255,0.35);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rd-track-dur { font-size: 11px; color: rgba(255,255,255,0.28); flex-shrink: 0; }

/* empty / loading states */
.rd-empty {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 48px 24px; gap: 14px; text-align: center;
  color: rgba(255,255,255,0.28); font-size: 13px;
}
.rd-spinner {
  width: 28px; height: 28px; border-radius: 50%;
  border: 2px solid rgba(29,185,84,0.2);
  border-top-color: #1DB954;
  animation: rdSpin 0.7s linear infinite;
}
@keyframes rdSpin { to { transform: rotate(360deg); } }

.rd-start-cta {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 48px 24px; gap: 16px; text-align: center;
}
.rd-start-cta p { font-size: 13px; color: rgba(255,255,255,0.35); max-width: 240px; line-height: 1.6; }
.rd-start-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 24px; border-radius: 9999px;
  background: #1DB954; color: #000;
  font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px;
  border: none; cursor: pointer;
  box-shadow: 0 6px 24px rgba(29,185,84,0.4);
  transition: background 0.15s, transform 0.15s;
}
.rd-start-btn:hover { background: #23E065; transform: translateY(-1px); }
`;

/* ─────────────────────────────────────────────────────────────────
   RadioTile
───────────────────────────────────────────────────────────────── */
export default function RadioTile({ onShowDetail }) {
  const { songs, currentIndex, isPlaying, setIsPlaying } = usePlayer();
  const { radioMode, radioLoading, startRadio, stopRadio } = useRadio();

  // Radio songs in queue (upcoming, after current)
  const radioSongs = songs.filter(s => s.source === 'radio');
  const upcomingCount = songs.slice(currentIndex + 1).filter(s => s.source === 'radio').length;

  // Cover images from radio queue for mosaic
  const covers = radioSongs.slice(0, 4).map(s => s.cover).filter(Boolean);

  const handlePlayBtn = useCallback((e) => {
    e.stopPropagation();
    if (radioMode) {
      setIsPlaying(p => !p);
    } else {
      startRadio();
    }
  }, [radioMode, setIsPlaying, startRadio]);

  return (
    <>
      <style>{CSS}</style>
      <div className="rt-tile" onClick={onShowDetail}>
        {/* Art mosaic / icon */}
        <div className="rt-tile-art">
          {covers.length >= 2 && (
            <div className="rt-tile-art-bg">
              {covers.map((c, i) => (
                <img key={i} src={c} alt="" onError={e => { e.target.style.display='none'; }} />
              ))}
            </div>
          )}
          <div className={`rt-tile-art-icon${radioMode ? ' on' : ''}`}>
            {radioLoading
              ? <div style={{ width:22, height:22, borderRadius:'50%', border:'2.5px solid rgba(0,0,0,0.2)', borderTopColor:'#000', animation:'rdSpin 0.7s linear infinite' }} />
              : '∞'
            }
          </div>
        </div>

        {/* Info */}
        <div className="rt-tile-info">
          <p className="rt-tile-name">Smart Radio</p>
          <p className="rt-tile-sub">
            {radioLoading
              ? 'Building mix…'
              : radioMode
              ? `${upcomingCount} up next`
              : 'Based on what you play'
            }
          </p>
        </div>

        {/* Play / pause button */}
        <button
          className="rt-tile-play"
          onClick={handlePlayBtn}
          aria-label={radioMode ? (isPlaying ? 'Pause' : 'Play') : 'Start radio'}
        >
          {radioLoading
            ? <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'rdSpin 0.7s linear infinite' }} />
            : radioMode && isPlaying
            ? <FaPause style={{ color:'#fff', fontSize:12 }} />
            : <FaPlay  style={{ color:'#fff', fontSize:12, marginLeft:1 }} />
          }
        </button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   RadioDetailView
───────────────────────────────────────────────────────────────── */
export function RadioDetailView({ onClose }) {
  const {
    songs, currentIndex, setCurrentIndex,
    isPlaying, setIsPlaying, currentSong,
  } = usePlayer();
  const { radioMode, radioLoading, startRadio, stopRadio } = useRadio();

  // All songs with source === 'radio' that come AFTER the current index
  const upcomingRadio = songs
    .map((s, i) => ({ ...s, _queueIdx: i }))
    .filter((s, i) => i > currentIndex && s.source === 'radio');

  // Songs played so far from radio (before current, source === radio)
  const playedRadio = songs
    .map((s, i) => ({ ...s, _queueIdx: i }))
    .filter((s, i) => i <= currentIndex && s.source === 'radio');

  const activeSong = currentSong;
  const cover = activeSong?.cover;

  const handleTrackClick = useCallback((queueIdx) => {
    setCurrentIndex(queueIdx);
    setTimeout(() => setIsPlaying(true), 50);
  }, [setCurrentIndex, setIsPlaying]);

  const handleTogglePlay = useCallback(() => {
    if (!radioMode) { startRadio(); return; }
    setIsPlaying(p => !p);
  }, [radioMode, startRadio, setIsPlaying]);

  return (
    <>
      <style>{CSS}</style>
      <div className="rd-root">
        <div className="rd-bg" />

        {/* Header */}
        <div className="rd-header">
          <span className="rd-header-title">Smart Radio</span>
          <button className="rd-close" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        {/* Hero */}
        <div className="rd-hero">
          <div className="rd-hero-art">
            <div className="rd-hero-art-glow" />
            {cover
              ? <img src={cover} alt={activeSong?.name} className="rd-hero-art-img"
                  onError={e => { e.target.style.display='none'; }} />
              : <div className="rd-hero-art-empty">∞</div>
            }
          </div>

          <div className="rd-hero-meta">
            <p className="rd-hero-label">
              {radioMode ? (radioLoading ? 'Building…' : 'Now Playing') : 'Smart Radio'}
            </p>
            <h1 className="rd-hero-title">
              {activeSong?.name || 'Nothing playing'}
            </h1>
            <p className="rd-hero-artist">
              {activeSong?.artist || 'Start radio to begin a mix'}
            </p>

            {/* Controls */}
            <div className="rd-controls">
              {radioMode && (
                <button className="rd-ctrl-btn" aria-label="Skip">
                  <FaStepForward onClick={() => {
                    const next = songs[currentIndex + 1];
                    if (next) { setCurrentIndex(currentIndex + 1); setIsPlaying(true); }
                  }} />
                </button>
              )}

              <button className="rd-play-btn" onClick={handleTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {radioLoading
                  ? <div style={{ width:20, height:20, borderRadius:'50%', border:'2.5px solid rgba(0,0,0,0.2)', borderTopColor:'#000', animation:'rdSpin 0.7s linear infinite' }} />
                  : radioMode && isPlaying
                  ? <FaPause style={{ fontSize:18 }} />
                  : <FaPlay  style={{ fontSize:18, marginLeft:2 }} />
                }
              </button>

              {radioMode && (
                <button className="rd-stop-btn" onClick={stopRadio}>
                  Stop Radio
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rd-divider" />

        {/* Queue */}
        <div className="rd-queue">
          {!radioMode ? (
            <div className="rd-start-cta">
              <div style={{ fontSize:52, lineHeight:1 }}>∞</div>
              <p>Smart Radio builds an endless mix of similar tracks based on what you're listening to.</p>
              <button className="rd-start-btn" onClick={startRadio}>
                <FaInfinity /> Start Radio Mix
              </button>
            </div>
          ) : radioLoading && upcomingRadio.length === 0 ? (
            <div className="rd-empty">
              <div className="rd-spinner" />
              <span>Finding similar tracks…</span>
            </div>
          ) : upcomingRadio.length === 0 ? (
            <div className="rd-empty">
              <span>Queue is refilling…</span>
            </div>
          ) : (
            <>
              <div className="rd-queue-label">Up Next · {upcomingRadio.length}</div>
              {upcomingRadio.map((song, idx) => {
                const isActive = song._queueIdx === currentIndex;
                return (
                  <div
                    key={song.id || idx}
                    className={`rd-track${isActive ? ' active' : ''}`}
                    onClick={() => handleTrackClick(song._queueIdx)}
                  >
                    <span className="rd-track-num">
                      {isActive && isPlaying ? <WaveIcon /> : String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="rd-track-thumb">
                      <img
                        src={song.cover || 'https://placehold.co/40x40/0a0a0a/333?text=♪'}
                        alt={song.name}
                        onError={e => { e.target.src = 'https://placehold.co/40x40/0a0a0a/333?text=♪'; }}
                      />
                    </div>
                    <div className="rd-track-meta">
                      <p className="rd-track-name">{song.name}</p>
                      <p className="rd-track-artist">{song.artist || 'YouTube'}</p>
                    </div>
                    <span className="rd-track-dur">{song.duration || ''}</span>
                  </div>
                );
              })}

              {/* Refill indicator */}
              {radioLoading && (
                <div className="rd-empty" style={{ padding:'20px 12px' }}>
                  <div className="rd-spinner" />
                  <span>Adding more tracks…</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}