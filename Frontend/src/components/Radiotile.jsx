/**
 * RadioTile.jsx
 *
 * A 320×160px card (2× wide, same height as normal tiles) that sits in
 * the Downloads shelf in HomeOnline. Clicking opens a detail view showing
 * the current radio queue and upcoming tracks — same pattern as the
 * Downloaded detail view in HomeOnline.
 *
 * Usage (inside HomeOnline's ho-shelf):
 *   <RadioTile onOpenDetail={openDetail} />
 *
 * openDetail is the same function HomeOnline uses for the Downloaded tile.
 * RadioTile passes a special radio-type object so HomeOnline renders
 * the radio detail view instead of the song list detail view.
 *
 * OR: use the self-contained <RadioTile /> which manages its own detail
 * view internally via the onShowRadioDetail prop callback.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRadio } from '../hooks/useRadio';
import { usePlayer } from '../context/PlayerContext';
import {
  FaPlay, FaPause, FaStepForward, FaRandom,
  FaChevronLeft, FaTimes, FaMusic,
} from 'react-icons/fa';

/* ─── Wave bars ───────────────────────────────────────────────── */
function WaveBars({ color = '#1DB954', size = 14 }) {
  return (
    <svg width={size * 1.2} height={size} viewBox="0 0 18 14" fill="none" aria-hidden="true">
      {[
        { x:0,  y1:6,  y2:1,  y3:11, dur:'0.55s', delay:'0s'   },
        { x:4,  y1:9,  y2:1,  y3:13, dur:'0.7s',  delay:'0.1s' },
        { x:8,  y1:3,  y2:0,  y3:12, dur:'0.5s',  delay:'0.05s'},
        { x:12, y1:7,  y2:2,  y3:12, dur:'0.65s', delay:'0.15s'},
      ].map((b, i) => (
        <rect key={i} x={b.x} y={b.y1} width="2.5" height={14-b.y1} rx="1.2" fill={color}>
          <animate attributeName="y"      values={`${b.y1};${b.y2};${b.y3};${b.y1}`} dur={b.dur} repeatCount="indefinite" begin={b.delay} />
          <animate attributeName="height" values={`${14-b.y1};${14-b.y2};${14-b.y3};${14-b.y1}`} dur={b.dur} repeatCount="indefinite" begin={b.delay} />
        </rect>
      ))}
    </svg>
  );
}

/* ─── Spinner ─────────────────────────────────────────────────── */
function Spinner({ color = '#fff', size = 16 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid rgba(255,255,255,.15)`,
      borderTopColor: color,
      animation: 'rt2-spin .65s linear infinite',
      flexShrink: 0,
    }} aria-hidden="true" />
  );
}

/* ─── CSS ─────────────────────────────────────────────────────── */
const CSS = `
  @keyframes rt2-spin    { to { transform: rotate(360deg); } }
  @keyframes rt2-pulse   { 0%,100%{transform:scale(1);opacity:.55} 50%{transform:scale(1.3);opacity:0} }
  @keyframes rt2-fadeup  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
  @keyframes rt2-slidein { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:none} }
  @keyframes rt2-glow    { 0%,100%{opacity:.45} 50%{opacity:.8} }

  /* ════ CARD ════ */
  .rt2-card {
    flex-shrink: 0;
    width: 320px;               /* 2× the 160px normal card */
    height: 160px;              /* same height as normal card image area */
    border-radius: 15px;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    border: none; padding: 0;
    display: block;
    animation: rt2-fadeup .32s ease both;
    transition: transform .22s cubic-bezier(0.34,1.56,0.64,1), box-shadow .22s;
    -webkit-tap-highlight-color: transparent;
  }
  .rt2-card:hover {
    transform: scale(1.02) translateY(-3px);
    box-shadow: 0 24px 60px rgba(0,0,0,.65);
  }
  .rt2-card:active { transform: scale(.97); }

  /* Blurred album art background */
  .rt2-bg {
    position: absolute; inset: 0;
    background-size: cover; background-position: center;
    filter: blur(22px) saturate(1.6) brightness(.45);
    transform: scale(1.12);
    transition: background-image .7s ease;
  }
  .rt2-bg-solid {
    position: absolute; inset: 0;
    background: linear-gradient(135deg, #0e5c28 0%, #07080A 100%);
  }

  /* Gradient scrim */
  .rt2-scrim {
    position: absolute; inset: 0;
    background: linear-gradient(100deg,
      rgba(0,0,0,.72) 0%,
      rgba(0,0,0,.35) 50%,
      rgba(0,0,0,.55) 100%
    );
  }

  /* Art panel — left 1/3 of the card */
  .rt2-art-panel {
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 140px;
  }
  .rt2-art-grid {
    width: 100%; height: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 1px;
  }
  .rt2-art-grid img {
    width: 100%; height: 100%;
    object-fit: cover; display: block;
  }
  .rt2-art-single {
    width: 100%; height: 100%;
  }
  .rt2-art-single img {
    width: 100%; height: 100%;
    object-fit: cover; display: block;
  }
  .rt2-art-empty {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(29,185,84,.12);
    font-size: 40px; color: rgba(29,185,84,.35);
  }
  /* fade from art panel into info */
  .rt2-art-fade {
    position: absolute; top: 0; bottom: 0;
    left: 100px; width: 60px;
    background: linear-gradient(to right, transparent, rgba(0,0,0,.6));
    pointer-events: none;
  }

  /* Info panel — right side */
  .rt2-info {
    position: absolute;
    left: 140px; top: 0; right: 0; bottom: 0;
    padding: 14px 16px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .rt2-eyebrow {
    font-size: 9px; font-weight: 700; letter-spacing: .14em;
    text-transform: uppercase; color: #1DB954;
    margin-bottom: 4px;
  }
  .rt2-title {
    font-family: 'Syne', sans-serif;
    font-size: 16px; font-weight: 800;
    letter-spacing: -.025em; color: #fff;
    line-height: 1.15; margin-bottom: 3px;
  }
  .rt2-sub {
    font-size: 12px; color: rgba(255,255,255,.5);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    margin-bottom: 8px;
  }

  /* Queue preview pills */
  .rt2-queue-preview {
    display: flex; gap: 5px; flex-wrap: nowrap; overflow: hidden;
  }
  .rt2-q-pill {
    display: flex; align-items: center; gap: 5px;
    background: rgba(255,255,255,.09);
    border-radius: 6px; padding: 4px 8px;
    font-size: 10px; color: rgba(255,255,255,.65);
    white-space: nowrap; flex-shrink: 0;
    max-width: 100px; overflow: hidden;
  }
  .rt2-q-pill img {
    width: 16px; height: 16px; border-radius: 3px; object-fit: cover; flex-shrink: 0;
  }
  .rt2-q-pill span { overflow: hidden; text-overflow: ellipsis; }

  /* Bottom row: status + play btn */
  .rt2-bottom {
    display: flex; align-items: center; justify-content: space-between;
  }
  .rt2-status {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 700; color: rgba(255,255,255,.6);
    letter-spacing: .03em;
  }
  .rt2-status.on { color: #1DB954; }

  .rt2-play-btn {
    width: 36px; height: 36px; border-radius: 50%;
    background: #fff; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,.45);
    transition: background .15s, transform .15s;
    flex-shrink: 0;
  }
  .rt2-play-btn:hover { background: #1DB954; transform: scale(1.1); }
  .rt2-play-btn:active { transform: scale(.92); }
  .rt2-play-btn.on { background: #1DB954; }
  .rt2-play-btn.on:hover { background: #23E065; }

  /* Pulse ring — top-right corner when active */
  .rt2-pulse-dot {
    position: absolute; top: 12px; right: 12px;
    width: 8px; height: 8px; border-radius: 50%;
    background: #1DB954;
    box-shadow: 0 0 0 0 rgba(29,185,84,.7);
    animation: rt2-dot-pulse 2s ease-in-out infinite;
  }
  @keyframes rt2-dot-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(29,185,84,.7); }
    70%  { box-shadow: 0 0 0 8px rgba(29,185,84,0); }
    100% { box-shadow: 0 0 0 0 rgba(29,185,84,0); }
  }

  /* Expand arrow — bottom right of card */
  .rt2-expand-hint {
    position: absolute; bottom: 10px; right: 58px;
    font-size: 10px; color: rgba(255,255,255,.35);
    display: flex; align-items: center; gap: 3px;
    pointer-events: none;
  }

  /* ════ DETAIL VIEW ════ */
  .rt2-detail {
    display: flex; flex-direction: column; height: 100%; overflow: hidden;
    position: relative;
  }
  .rt2-detail-bg {
    position: absolute; inset: 0; z-index: 0;
    background: linear-gradient(160deg, rgba(29,185,84,.22) 0%, #07080A 45%);
    pointer-events: none;
  }

  .rt2-detail-header {
    position: sticky; top: 0; z-index: 20;
    padding: 14px 20px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(7,8,10,.75); backdrop-filter: blur(24px);
    border-bottom: 1px solid rgba(255,255,255,.07);
    flex-shrink: 0;
  }
  .rt2-detail-header-title {
    font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: #fff;
  }
  .rt2-icon-btn {
    width: 34px; height: 34px; border-radius: 50%;
    background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.09);
    color: rgba(255,255,255,.65); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; transition: background .15s, color .15s;
  }
  .rt2-icon-btn:hover { background: rgba(255,255,255,.12); color: #fff; }

  /* Hero inside detail */
  .rt2-detail-hero {
    position: relative; z-index: 1;
    padding: 20px 24px 18px;
    display: flex; gap: 20px; align-items: center;
    flex-shrink: 0;
  }
  .rt2-detail-art {
    flex-shrink: 0; position: relative;
    width: 120px; height: 120px; border-radius: 14px; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.1);
  }
  .rt2-detail-art-grid {
    width: 100%; height: 100%;
    display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 1px;
  }
  .rt2-detail-art-grid img { width: 100%; height: 100%; object-fit: cover; }
  .rt2-detail-art img { width: 100%; height: 100%; object-fit: cover; }

  .rt2-detail-meta { flex: 1; min-width: 0; }
  .rt2-detail-eyebrow {
    font-size: 10px; font-weight: 700; letter-spacing: .14em;
    text-transform: uppercase; color: #1DB954; margin-bottom: 5px;
  }
  .rt2-detail-title {
    font-family: 'Syne', sans-serif;
    font-size: clamp(18px, 3.5vw, 28px); font-weight: 800;
    letter-spacing: -.03em; color: #fff; margin-bottom: 3px; line-height: 1.1;
  }
  .rt2-detail-sub { font-size: 13px; color: rgba(255,255,255,.5); margin-bottom: 14px; }

  .rt2-detail-actions { display: flex; gap: 10px; align-items: center; }
  .rt2-detail-play-btn {
    width: 48px; height: 48px; border-radius: 50%;
    background: #fff; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(0,0,0,.5);
    transition: background .15s, transform .15s;
  }
  .rt2-detail-play-btn:hover { background: #1DB954; transform: scale(1.07); }
  .rt2-detail-stop-btn {
    height: 38px; padding: 0 18px; border-radius: 9999px;
    background: rgba(255,68,102,.1); border: 1px solid rgba(255,68,102,.25);
    color: #FF4466; font-size: 12px; font-weight: 700;
    cursor: pointer; display: flex; align-items: center; gap: 6px;
    font-family: 'DM Sans', sans-serif; transition: background .15s;
  }
  .rt2-detail-stop-btn:hover { background: rgba(255,68,102,.18); }

  /* Track list */
  .rt2-detail-scroll {
    position: relative; z-index: 1;
    flex: 1; overflow-y: auto; padding: 8px 16px 32px;
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.06) transparent;
  }
  .rt2-detail-scroll::-webkit-scrollbar { width: 3px; }
  .rt2-detail-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.06); border-radius: 2px; }

  .rt2-section-label {
    font-size: 10px; font-weight: 700; letter-spacing: .12em;
    text-transform: uppercase; color: rgba(255,255,255,.3);
    padding: 8px 12px 10px;
  }

  .rt2-track {
    display: flex; align-items: center; gap: 12px;
    padding: 9px 12px; border-radius: 10px;
    cursor: pointer; transition: background .13s;
    position: relative;
  }
  .rt2-track:hover { background: rgba(255,255,255,.06); }
  .rt2-track.active { background: rgba(29,185,84,.1); }

  .rt2-track-num {
    width: 24px; text-align: center; font-size: 12px;
    color: rgba(255,255,255,.3); flex-shrink: 0;
  }
  .rt2-track-cover {
    width: 40px; height: 40px; border-radius: 7px;
    overflow: hidden; flex-shrink: 0;
  }
  .rt2-track-cover img { width: 100%; height: 100%; object-fit: cover; }
  .rt2-track-info { flex: 1; min-width: 0; }
  .rt2-track-name {
    font-size: 13px; font-weight: 600; color: #fff;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    margin-bottom: 1px;
  }
  .rt2-track-name.active { color: #1DB954; }
  .rt2-track-artist {
    font-size: 11px; color: rgba(255,255,255,.45);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rt2-track-badge {
    font-size: 9px; font-weight: 700; letter-spacing: .08em;
    padding: 2px 7px; border-radius: 5px;
    background: rgba(29,185,84,.15); color: #1DB954;
    flex-shrink: 0;
  }
  .rt2-track-badge.next {
    background: rgba(255,255,255,.07); color: rgba(255,255,255,.4);
  }

  /* Empty state */
  .rt2-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 60px 24px; gap: 12px; text-align: center;
  }
  .rt2-empty-icon { font-size: 32px; color: rgba(255,255,255,.2); margin-bottom: 4px; }
  .rt2-empty-title { font-size: 15px; font-weight: 600; color: rgba(255,255,255,.45); }
  .rt2-empty-sub   { font-size: 12px; color: rgba(255,255,255,.25); }

  /* Start radio CTA inside detail when radio is off */
  .rt2-cta-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 28px; border-radius: 9999px;
    background: #1DB954; color: #000; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700;
    cursor: pointer; margin-top: 16px;
    transition: background .15s, transform .15s;
    box-shadow: 0 4px 20px rgba(29,185,84,.38);
  }
  .rt2-cta-btn:hover { background: #23E065; transform: scale(1.04); }

  /* Divider */
  .rt2-divider { height: 1px; background: rgba(255,255,255,.06); margin: 4px 12px; }
`;

/* ─── Detail View ────────────────────────────────────────────── */
function RadioDetailView({ onClose }) {
  const {
    radioMode, radioLoading, startRadio, stopRadio,
    radioQueue, radioCurrentIndex,
  } = useRadio();
  const { currentSong, currentIndex, songs, setCurrentIndex, isPlaying, setIsPlaying } = usePlayer();

  // Radio songs = songs in queue that have source === 'radio'
  // Plus the seed song (currentSong when radio started)
  const radioSongs = songs.filter(s => s.source === 'radio');
  const upcomingStart = currentIndex + 1;
  const upcoming = songs.slice(upcomingStart).filter(s => s.source === 'radio');

  const covers = radioSongs.slice(0, 4).map(s => s.cover).filter(Boolean);

  const handlePlay = (idx) => {
    setCurrentIndex(idx);
    setIsPlaying(true);
  };

  return (
    <div className="rt2-detail">
      <div className="rt2-detail-bg" />

      {/* Header */}
      <div className="rt2-detail-header">
        <button className="rt2-icon-btn" onClick={onClose}><FaChevronLeft /></button>
        <span className="rt2-detail-header-title">Radio Mix</span>
        <button className="rt2-icon-btn" onClick={onClose}><FaTimes /></button>
      </div>

      {/* Hero */}
      <div className="rt2-detail-hero">
        <div className="rt2-detail-art">
          {covers.length >= 4 ? (
            <div className="rt2-detail-art-grid">
              {covers.map((c, i) => <img key={i} src={c} alt="" onError={e => { e.target.style.display='none'; }} />)}
            </div>
          ) : covers.length > 0 ? (
            <img src={covers[0]} alt="Radio" onError={e => { e.target.style.display='none'; }} />
          ) : (
            <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,#0e5c28,#07080A)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, color:'rgba(29,185,84,.4)' }}>∞</div>
          )}
        </div>

        <div className="rt2-detail-meta">
          <div className="rt2-detail-eyebrow">∞ RADIO MIX</div>
          <h1 className="rt2-detail-title">
            {currentSong?.name ? `${currentSong.name} Radio` : 'Radio Mix'}
          </h1>
          <p className="rt2-detail-sub">
            {radioSongs.length > 0
              ? `${radioSongs.length} tracks · Based on ${currentSong?.artist || 'current song'}`
              : `Based on ${currentSong?.artist || 'current song'}`}
          </p>
          <div className="rt2-detail-actions">
            {!radioMode ? (
              <button className="rt2-cta-btn" onClick={startRadio} disabled={radioLoading}>
                {radioLoading ? <Spinner size={14} /> : <span style={{ fontSize:18 }}>∞</span>}
                {radioLoading ? 'Building mix…' : 'Start Radio'}
              </button>
            ) : (
              <>
                <button
                  className="rt2-detail-play-btn"
                  onClick={() => setIsPlaying(p => !p)}
                >
                  {isPlaying
                    ? <FaPause style={{ color:'#000', fontSize:16 }} />
                    : <FaPlay  style={{ color:'#000', fontSize:16, marginLeft:2 }} />
                  }
                </button>
                <button className="rt2-detail-stop-btn" onClick={stopRadio}>
                  <FaTimes style={{ fontSize:10 }} /> Stop Radio
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rt2-divider" />

      {/* Track list */}
      <div className="rt2-detail-scroll">
        {!radioMode && !radioLoading && radioSongs.length === 0 ? (
          <div className="rt2-empty">
            <div className="rt2-empty-icon">∞</div>
            <p className="rt2-empty-title">No radio mix yet</p>
            <p className="rt2-empty-sub">Start the radio to build an infinite mix based on your current song</p>
          </div>
        ) : radioLoading ? (
          <div className="rt2-empty">
            <Spinner size={32} />
            <p className="rt2-empty-title" style={{ marginTop:12 }}>Building your mix…</p>
            <p className="rt2-empty-sub">Finding similar tracks via Last.fm</p>
          </div>
        ) : (
          <>
            {/* Currently playing (if it's a radio song) */}
            {currentSong?.source === 'radio' && (
              <>
                <div className="rt2-section-label">Now Playing</div>
                <div className="rt2-track active">
                  <div className="rt2-track-num"><WaveBars size={12} /></div>
                  <div className="rt2-track-cover">
                    <img src={currentSong.cover || '/default-cover.png'} alt={currentSong.name}
                      onError={e => { e.target.src='/default-cover.png'; }} />
                  </div>
                  <div className="rt2-track-info">
                    <div className="rt2-track-name active">{currentSong.name}</div>
                    <div className="rt2-track-artist">{currentSong.artist}</div>
                  </div>
                  <span className="rt2-track-badge">NOW</span>
                </div>
                <div className="rt2-divider" />
              </>
            )}

            {/* Upcoming radio tracks */}
            {upcoming.length > 0 && (
              <>
                <div className="rt2-section-label">Up Next · {upcoming.length} tracks</div>
                {upcoming.map((song, i) => {
                  const queueIdx = songs.findIndex(s => s.id === song.id);
                  return (
                    <div
                      key={song.id || i}
                      className="rt2-track"
                      onClick={() => handlePlay(queueIdx)}
                    >
                      <div className="rt2-track-num" style={{ color:'rgba(255,255,255,.25)', fontSize:11 }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="rt2-track-cover">
                        <img src={song.cover || '/default-cover.png'} alt={song.name}
                          onError={e => { e.target.src='/default-cover.png'; }} />
                      </div>
                      <div className="rt2-track-info">
                        <div className="rt2-track-name">{song.name}</div>
                        <div className="rt2-track-artist">{song.artist}</div>
                      </div>
                      {i === 0 && <span className="rt2-track-badge next">NEXT</span>}
                    </div>
                  );
                })}
              </>
            )}

            {/* Past radio tracks */}
            {(() => {
              const past = songs.slice(0, currentIndex).filter(s => s.source === 'radio');
              if (!past.length) return null;
              return (
                <>
                  <div className="rt2-divider" style={{ marginTop:8 }} />
                  <div className="rt2-section-label">Previously played</div>
                  {past.reverse().map((song, i) => (
                    <div
                      key={song.id || i}
                      className="rt2-track"
                      style={{ opacity: .5 }}
                      onClick={() => handlePlay(songs.findIndex(s => s.id === song.id))}
                    >
                      <div className="rt2-track-num" style={{ color:'rgba(255,255,255,.2)', fontSize:11 }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="rt2-track-cover">
                        <img src={song.cover || '/default-cover.png'} alt={song.name}
                          onError={e => { e.target.src='/default-cover.png'; }} />
                      </div>
                      <div className="rt2-track-info">
                        <div className="rt2-track-name">{song.name}</div>
                        <div className="rt2-track-artist">{song.artist}</div>
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main export ─────────────────────────────────────────────── */
/**
 * @param {function} onShowDetail — called with { type:'radio' } to trigger
 *   HomeOnline's own detail view. If omitted, RadioTile manages its own
 *   detail view state internally.
 */
export default function RadioTile({ onShowDetail }) {
  const { radioMode, radioLoading, radioError, startRadio, stopRadio } = useRadio();
  const { currentSong, songs, currentIndex, isPlaying, setIsPlaying } = usePlayer();

  const [showDetail, setShowDetail] = useState(false);
  const errTimer = useRef(null);
  const [errVisible, setErrVisible] = useState(false);

  useEffect(() => {
    if (radioError) {
      setErrVisible(true);
      clearTimeout(errTimer.current);
      errTimer.current = setTimeout(() => setErrVisible(false), 3500);
    }
    return () => clearTimeout(errTimer.current);
  }, [radioError]);

  const radioSongs = songs.filter(s => s.source === 'radio');
  const upcoming   = songs.slice(currentIndex + 1).filter(s => s.source === 'radio');
  const covers     = radioSongs.slice(0, 4).map(s => s.cover).filter(Boolean);

  const handleCardClick = useCallback((e) => {
    // Clicking card opens detail view
    if (onShowDetail) {
      onShowDetail({ type: 'radio' });
    } else {
      setShowDetail(true);
    }
  }, [onShowDetail]);

  const handlePlayBtn = useCallback((e) => {
    e.stopPropagation();
    if (radioLoading) return;
    if (radioMode) {
      setIsPlaying(p => !p);
    } else {
      startRadio();
    }
  }, [radioMode, radioLoading, startRadio, setIsPlaying]);

  /* If using internal detail view */
  if (showDetail) {
    return (
      <>
        <style>{CSS}</style>
        <RadioDetailView onClose={() => setShowDetail(false)} />
      </>
    );
  }

  const cover = currentSong?.cover || null;

  return (
    <>
      <style>{CSS}</style>
      <div
        className="rt2-card"
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        aria-label={radioMode ? 'View radio mix' : 'Start radio mix'}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(e); } }}
      >
        {/* Background */}
        {cover
          ? <div className="rt2-bg" style={{ backgroundImage:`url(${cover})` }} />
          : <div className="rt2-bg-solid" />
        }
        <div className="rt2-scrim" />

        {/* Art panel — left side mosaic */}
        <div className="rt2-art-panel">
          {covers.length >= 4 ? (
            <div className="rt2-art-grid">
              {covers.map((c, i) => (
                <img key={i} src={c} alt="" onError={e => { e.target.style.display='none'; }} />
              ))}
            </div>
          ) : covers.length === 1 ? (
            <div className="rt2-art-single">
              <img src={covers[0]} alt="Radio" onError={e => { e.target.style.display='none'; }} />
            </div>
          ) : (
            <div className="rt2-art-empty">∞</div>
          )}
          <div className="rt2-art-fade" />
        </div>

        {/* Info panel */}
        <div className="rt2-info">
          <div>
            <div className="rt2-eyebrow">∞ RADIO MIX</div>
            <div className="rt2-title">
              {currentSong?.name ? `${currentSong.name} Radio` : 'Start Radio'}
            </div>
            <div className="rt2-sub">
              {radioLoading
                ? 'Finding similar tracks…'
                : radioMode
                  ? `${radioSongs.length} tracks · ${upcoming.length} up next`
                  : currentSong?.artist
                    ? `Based on ${currentSong.artist}`
                    : 'Infinite mix from current song'
              }
            </div>

            {/* Queue preview pills — next 2 tracks */}
            {upcoming.length > 0 && (
              <div className="rt2-queue-preview">
                {upcoming.slice(0, 2).map((s, i) => (
                  <div key={s.id || i} className="rt2-q-pill">
                    <img src={s.cover || '/default-cover.png'} alt={s.name}
                      onError={e => { e.target.src='/default-cover.png'; }} />
                    <span>{s.name}</span>
                  </div>
                ))}
                {upcoming.length > 2 && (
                  <div className="rt2-q-pill" style={{ color:'rgba(255,255,255,.35)' }}>
                    +{upcoming.length - 2} more
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rt2-bottom">
            <div className={`rt2-status ${radioMode ? 'on' : ''}`}>
              {radioLoading
                ? <><Spinner size={12} color="#1DB954" /> Building mix…</>
                : radioMode && isPlaying
                  ? <><WaveBars color="#1DB954" size={12} /> Radio playing</>
                  : radioMode
                    ? '∞ Radio paused'
                    : 'Tap to start'
              }
            </div>
            <button
              className={`rt2-play-btn ${radioMode ? 'on' : ''}`}
              onClick={handlePlayBtn}
              disabled={radioLoading}
              aria-label={radioMode ? (isPlaying ? 'Pause' : 'Play') : 'Start radio'}
            >
              {radioLoading
                ? <Spinner size={14} color="#000" />
                : radioMode && isPlaying
                  ? <FaPause style={{ color: radioMode ? '#fff' : '#000', fontSize:13 }} />
                  : radioMode
                    ? <FaPlay  style={{ color:'#fff', fontSize:13, marginLeft:2 }} />
                    : <span style={{ fontSize:20, fontWeight:900, color:'#000', lineHeight:1, fontFamily:'Syne,sans-serif' }}>∞</span>
              }
            </button>
          </div>
        </div>

        {/* Active pulse dot */}
        {radioMode && !radioLoading && <div className="rt2-pulse-dot" />}

        {/* Error */}
        {errVisible && radioError && (
          <div style={{
            position:'absolute', bottom:'calc(100% + 8px)', left:12,
            background:'rgba(255,68,102,.14)', border:'1px solid rgba(255,68,102,.28)',
            color:'#FCA5A5', fontSize:11, padding:'5px 10px',
            borderRadius:8, whiteSpace:'nowrap', zIndex:10,
            animation:'rt2-fadeup .18s ease both',
          }}>{radioError}</div>
        )}
      </div>
    </>
  );
}

/* Also export the detail view for use in HomeOnline's renderDetail */
export { RadioDetailView };