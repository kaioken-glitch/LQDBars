/**
 * RadioStation.jsx
 *
 * Smart-radio control panel.
 *
 * Renders as a compact pill when docked, expands into a
 * full panel showing:
 *   • taste profile (top artists / genres derived from history)
 *   • queue preview of upcoming radio tracks
 *   • slot-type legend (familiar / expanding / discovery)
 *   • start / stop controls
 *
 * Usage — drop it into App.jsx above the BottomNav / PlayerControls:
 *   import RadioStation from './components/RadioStation';
 *   …
 *   {user && <RadioStation />}
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { FaPlay, FaPause, FaStopCircle, FaTimes, FaChevronUp, FaChevronDown, FaRandom } from 'react-icons/fa';
import { useSmartRadio } from '../hooks/useSmartRadio';
import { usePlayer }     from '../context/PlayerContext';

/* ═══════════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════════ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

/* ── Root token layer ─────────────────────────────────────────── */
.rs-root {
  --g:      #1DB954;
  --g2:     #23E065;
  --gdim:   rgba(29,185,84,0.14);
  --gglow:  rgba(29,185,84,0.30);
  --s1:     rgba(255,255,255,0.04);
  --s2:     rgba(255,255,255,0.07);
  --sh:     rgba(255,255,255,0.10);
  --b1:     rgba(255,255,255,0.07);
  --b2:     rgba(255,255,255,0.14);
  --t1:     #FFFFFF;
  --t2:     rgba(255,255,255,0.55);
  --t3:     rgba(255,255,255,0.28);
  --spring: cubic-bezier(0.22,1,0.36,1);
  --ease:   cubic-bezier(0.4,0,0.2,1);
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
}
.rs-root *, .rs-root *::before, .rs-root *::after {
  box-sizing: border-box; margin: 0; padding: 0;
}

/* ── Pill (collapsed state) ───────────────────────────────────── */
.rs-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px 8px 10px;
  background: rgba(10,12,16,0.92);
  border: 1px solid var(--b1);
  border-radius: 9999px;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow: 0 4px 28px rgba(0,0,0,0.55);
  cursor: pointer;
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.rs-pill:hover {
  border-color: rgba(29,185,84,0.35);
  box-shadow: 0 8px 36px rgba(0,0,0,0.6), 0 0 20px rgba(29,185,84,0.08);
}
.rs-pill.active {
  border-color: rgba(29,185,84,0.5);
  box-shadow: 0 4px 28px rgba(0,0,0,0.55), 0 0 30px rgba(29,185,84,0.12);
}

/* Animated wave bars inside pill */
.rs-pill-wave {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 16px;
  flex-shrink: 0;
}
.rs-pill-wave span {
  display: block;
  width: 3px;
  border-radius: 2px;
  background: var(--g);
}
.rs-pill-wave.playing span:nth-child(1) { animation: rsPillarA 0.7s ease-in-out infinite; }
.rs-pill-wave.playing span:nth-child(2) { animation: rsPillarB 0.7s ease-in-out infinite 0.1s; }
.rs-pill-wave.playing span:nth-child(3) { animation: rsPillarC 0.7s ease-in-out infinite 0.2s; }
.rs-pill-wave span:nth-child(1) { height: 4px; }
.rs-pill-wave span:nth-child(2) { height: 10px; }
.rs-pill-wave span:nth-child(3) { height: 6px; }

@keyframes rsPillarA { 0%,100%{height:3px}  50%{height:14px} }
@keyframes rsPillarB { 0%,100%{height:10px} 50%{height:3px}  }
@keyframes rsPillarC { 0%,100%{height:5px}  50%{height:16px} }

.rs-pill-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
  white-space: nowrap;
}
.rs-pill-label.active { color: var(--g); }

.rs-pill-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 9999px;
  background: var(--gdim);
  border: 1px solid rgba(29,185,84,0.28);
  color: var(--g);
  flex-shrink: 0;
}

.rs-pill-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 11px;
  transition: background 0.15s var(--ease), transform 0.15s var(--ease);
}
.rs-pill-btn.start {
  background: var(--g);
  color: #000;
  box-shadow: 0 2px 10px rgba(29,185,84,0.4);
}
.rs-pill-btn.start:hover { background: var(--g2); transform: scale(1.08); }
.rs-pill-btn.stop {
  background: rgba(255,255,255,0.08);
  color: var(--t2);
}
.rs-pill-btn.stop:hover { background: rgba(255,50,50,0.18); color: #ff6b6b; }

/* ── Loading ring ──────────────────────────────────────────────── */
.rs-ring {
  width: 20px; height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(29,185,84,0.2);
  border-top-color: var(--g);
  animation: rsSpin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes rsSpin { to { transform: rotate(360deg); } }

/* ── Panel (expanded state) ───────────────────────────────────── */
.rs-panel {
  position: relative;
  width: 340px;
  max-width: calc(100vw - 32px);
  background: rgba(9,11,15,0.97);
  border: 1px solid var(--b2);
  border-radius: 20px;
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  box-shadow: 0 24px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04) inset;
  overflow: hidden;
  animation: rsPanelIn 0.32s var(--spring) both;
}
@keyframes rsPanelIn {
  from { opacity:0; transform: translateY(12px) scale(0.97); }
  to   { opacity:1; transform: none; }
}

.rs-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--b1);
}
.rs-panel-title {
  font-family: 'Syne', sans-serif;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--t1);
  display: flex;
  align-items: center;
  gap: 8px;
}
.rs-panel-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--g);
  box-shadow: 0 0 8px var(--gglow);
  animation: rsDotPulse 2s ease-in-out infinite;
}
@keyframes rsDotPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
.rs-panel-close {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--s1);
  border: 1px solid var(--b1);
  color: var(--t3);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 11px;
  transition: background 0.15s, color 0.15s;
}
.rs-panel-close:hover { background: var(--sh); color: var(--t1); }

/* ── Taste profile section ───────────────────────────────────── */
.rs-section {
  padding: 14px 18px;
  border-bottom: 1px solid var(--b1);
}
.rs-section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--t3);
  margin-bottom: 10px;
}
.rs-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.rs-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
}
.rs-chip.artist {
  background: rgba(29,185,84,0.08);
  border-color: rgba(29,185,84,0.22);
  color: var(--g);
}
.rs-chip.genre {
  background: rgba(255,255,255,0.04);
  border-color: var(--b1);
  color: var(--t2);
}
.rs-chip-score {
  font-size: 9px;
  opacity: 0.6;
  font-weight: 400;
}

/* ── Queue preview ────────────────────────────────────────────── */
.rs-queue {
  max-height: 240px;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 8px 0;
}
.rs-queue::-webkit-scrollbar { display: none; }

.rs-track {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 18px;
  transition: background 0.12s;
  cursor: default;
}
.rs-track:hover { background: var(--s1); }

.rs-track-thumb {
  width: 38px; height: 38px;
  border-radius: 7px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--s2);
}
.rs-track-thumb img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.rs-track-meta { flex: 1; min-width: 0; }
.rs-track-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rs-track-artist {
  font-size: 10px;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}
/* Slot-type dot */
.rs-slot-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.rs-slot-dot.familiar  { background: var(--g); }
.rs-slot-dot.expanding { background: #60A5FA; }
.rs-slot-dot.discovery { background: #F59E0B; }
.rs-track-currently-playing .rs-track-name { color: var(--g); }

/* ── Legend ────────────────────────────────────────────────────── */
.rs-legend {
  display: flex;
  gap: 14px;
  padding: 10px 18px 14px;
  border-top: 1px solid var(--b1);
  flex-wrap: wrap;
}
.rs-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--t3);
}
.rs-legend-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── CTA row ───────────────────────────────────────────────────── */
.rs-cta {
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.rs-start-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 0;
  border-radius: 12px;
  background: var(--g);
  color: #000;
  border: none;
  cursor: pointer;
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.01em;
  box-shadow: 0 4px 20px rgba(29,185,84,0.35);
  transition: background 0.15s var(--ease), transform 0.15s var(--spring), box-shadow 0.15s;
}
.rs-start-btn:hover { background: var(--g2); transform: translateY(-1px); box-shadow: 0 8px 28px rgba(29,185,84,0.5); }
.rs-start-btn:active { transform: scale(0.97); }
.rs-start-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

.rs-stop-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 18px;
  border-radius: 12px;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--b1);
  color: var(--t2);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  gap: 6px;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.rs-stop-btn:hover { background: rgba(255,50,50,0.10); border-color: rgba(255,50,50,0.2); color: #ff6b6b; }

/* ── Error banner ────────────────────────────────────────────── */
.rs-error {
  margin: 0 18px 14px;
  padding: 9px 14px;
  border-radius: 10px;
  background: rgba(255,50,50,0.08);
  border: 1px solid rgba(255,50,50,0.2);
  font-size: 11px;
  color: rgba(255,140,140,0.9);
  line-height: 1.5;
}

/* ── Empty queue placeholder ─────────────────────────────────── */
.rs-queue-empty {
  padding: 24px 18px;
  text-align: center;
  font-size: 12px;
  color: var(--t3);
  line-height: 1.6;
}

/* ── Batch counter ─────────────────────────────────────────────── */
.rs-batch-info {
  padding: 8px 18px 0;
  font-size: 10px;
  color: var(--t3);
  display: flex;
  align-items: center;
  gap: 6px;
}
.rs-batch-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--g);
  opacity: 0.6;
}

/* ── Responsive: mobile pill sits above BottomNav ─────────────── */
@media (max-width: 767px) {
  .rs-panel {
    width: calc(100vw - 32px);
  }
}
`;

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════════ */

const SlotDot = memo(({ type }) => (
  <span className={`rs-slot-dot ${type || ''}`} title={type} />
));

const TrackRow = memo(({ song, isCurrent }) => (
  <div className={`rs-track${isCurrent ? ' rs-track-currently-playing' : ''}`}>
    <div className="rs-track-thumb">
      <img
        src={song.cover || `https://img.youtube.com/vi/${song.youtubeId}/default.jpg`}
        alt={song.name}
        onError={e => { e.target.src = 'https://placehold.co/38x38/111/333?text=♪'; }}
      />
    </div>
    <div className="rs-track-meta">
      <div className="rs-track-name">{song.name || song._radioMeta?.title || 'Unknown'}</div>
      <div className="rs-track-artist">{song.artist || song._radioMeta?.channel || '—'}</div>
    </div>
    <SlotDot type={song._slotType} />
  </div>
));

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */

export default function RadioStation() {
  const {
    radioMode,
    radioLoading,
    radioError,
    tasteProfile,
    batchCount,
    startSmartRadio,
    stopRadio,
  } = useSmartRadio();

  const { currentSong, songs, currentIndex } = usePlayer();

  const [expanded, setExpanded] = useState(false);
  const panelRef  = useRef(null);

  // Close panel when clicking outside
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  // Extract only radio songs from the queue for the preview
  const radioQueue = songs.filter((s, i) => s.source === 'radio' && i > currentIndex);

  const handleStart = useCallback(async (e) => {
    e.stopPropagation();
    await startSmartRadio();
  }, [startSmartRadio]);

  const handleStop = useCallback((e) => {
    e.stopPropagation();
    stopRadio();
    setExpanded(false);
  }, [stopRadio]);

  const toggleExpanded = useCallback(() => setExpanded(x => !x), []);

  /* ── Pill (always visible) ── */
  const pill = (
    <div
      className={`rs-pill${radioMode ? ' active' : ''}`}
      onClick={toggleExpanded}
      role="button"
      aria-label="Smart Radio"
      aria-expanded={expanded}
    >
      {radioLoading ? (
        <div className="rs-ring" />
      ) : (
        <div className={`rs-pill-wave${radioMode ? ' playing' : ''}`}>
          <span /><span /><span />
        </div>
      )}

      <span className={`rs-pill-label${radioMode ? ' active' : ''}`}>
        {radioLoading ? 'Building mix…' : radioMode ? 'Radio on' : 'Smart Radio'}
      </span>

      {radioMode && batchCount > 0 && (
        <span className="rs-pill-badge">
          {radioQueue.length} up next
        </span>
      )}

      {radioMode ? (
        <button className="rs-pill-btn stop" onClick={handleStop} aria-label="Stop radio">
          <FaStopCircle />
        </button>
      ) : (
        <button
          className="rs-pill-btn start"
          onClick={handleStart}
          aria-label="Start smart radio"
          disabled={radioLoading}
        >
          {radioLoading ? '…' : <FaRandom />}
        </button>
      )}

      <span style={{ fontSize: 10, color: 'var(--t3)' }}>
        {expanded ? <FaChevronDown /> : <FaChevronUp />}
      </span>
    </div>
  );

  /* ── Panel (expanded) ── */
  const panel = expanded && (
    <div className="rs-panel" ref={panelRef}>

      {/* Header */}
      <div className="rs-panel-header">
        <div className="rs-panel-title">
          {radioMode && <span className="rs-panel-dot" />}
          Smart Radio
        </div>
        <button className="rs-panel-close" onClick={() => setExpanded(false)}>
          <FaTimes />
        </button>
      </div>

      {/* Error */}
      {radioError && (
        <div className="rs-error">{radioError}</div>
      )}

      {/* Taste Profile */}
      {tasteProfile && (
        <div className="rs-section">
          <div className="rs-section-label">Your taste profile</div>
          <div className="rs-chips">
            {tasteProfile.artists.slice(0, 5).map(a => (
              <span key={a.name} className="rs-chip artist">
                {a.name}
                <span className="rs-chip-score">×{Math.round(a.score * 10) / 10}</span>
              </span>
            ))}
            {tasteProfile.genres.slice(0, 4).map(g => (
              <span key={g.name} className="rs-chip genre">{g.name}</span>
            ))}
            {!tasteProfile.artists.length && !tasteProfile.genres.length && (
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                Play more songs to build your profile
              </span>
            )}
          </div>
        </div>
      )}

      {/* Batch info */}
      {radioMode && batchCount > 0 && (
        <div className="rs-batch-info">
          <span className="rs-batch-dot" />
          Batch {batchCount} · {radioQueue.length} tracks queued
        </div>
      )}

      {/* Queue preview */}
      {radioMode && (
        <div className="rs-queue">
          {radioQueue.length === 0 && !radioLoading ? (
            <div className="rs-queue-empty">
              {radioLoading ? 'Fetching next tracks…' : 'All caught up — more tracks coming soon'}
            </div>
          ) : (
            radioQueue.slice(0, 12).map((song, i) => (
              <TrackRow key={song.id || i} song={song} isCurrent={false} />
            ))
          )}
          {radioLoading && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 18px', fontSize:11, color:'var(--t3)' }}>
              <div className="rs-ring" style={{ width:14, height:14, borderWidth:1.5 }} />
              Fetching more tracks…
            </div>
          )}
        </div>
      )}

      {/* Slot legend */}
      <div className="rs-legend">
        <div className="rs-legend-item">
          <span className="rs-legend-dot" style={{ background:'#1DB954' }} />
          Familiar
        </div>
        <div className="rs-legend-item">
          <span className="rs-legend-dot" style={{ background:'#60A5FA' }} />
          Expanding
        </div>
        <div className="rs-legend-item">
          <span className="rs-legend-dot" style={{ background:'#F59E0B' }} />
          Discovery
        </div>
      </div>

      {/* CTA */}
      <div className="rs-cta">
        {radioMode ? (
          <button className="rs-stop-btn" onClick={handleStop}>
            <FaStopCircle style={{ fontSize: 12 }} /> Stop Radio
          </button>
        ) : (
          <button
            className="rs-start-btn"
            onClick={handleStart}
            disabled={radioLoading}
          >
            {radioLoading
              ? <><div className="rs-ring" style={{ width:14,height:14,borderWidth:1.5,borderColor:'rgba(0,0,0,0.2)',borderTopColor:'#000' }} /> Building mix…</>
              : <><FaRandom /> Start Smart Radio</>
            }
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="rs-root" style={{ position:'relative', display:'inline-block' }}>
      <style>{CSS}</style>

      {/* Panel floats above pill */}
      {panel && (
        <div style={{
          position: 'absolute',
          bottom:   'calc(100% + 10px)',
          left:     '50%',
          transform:'translateX(-50%)',
          zIndex:   300,
        }}>
          {panel}
        </div>
      )}

      {pill}
    </div>
  );
}