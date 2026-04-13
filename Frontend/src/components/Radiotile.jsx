/**
 * Radiotile.jsx
 *
 * RadioTile        — compact shelf card (190×190) in the Downloaded row.
 * RadioDetailView  — full-screen Spotify-style view:
 *                    centered art, song meta, play/stop controls (top half)
 *                    + scrollable upcoming queue (bottom half)
 */

import React, { useCallback } from 'react';
import { FaPlay, FaPause, FaStepForward, FaTimes, FaInfinity } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import { useRadio } from '../hooks/useRadio';

/* ─── Wave bars ─────────────────────────────────────────────────── */
function WaveIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true" style={{ display:'block', flexShrink:0 }}>
      {[{x:0,ys:['6','1','11'],dur:'0.55s',delay:'0s'},{x:4,ys:['8','1','11'],dur:'0.7s',delay:'0.1s'},{x:8,ys:['3','0','10'],dur:'0.5s',delay:'0.05s'},{x:12,ys:['6','2','11'],dur:'0.65s',delay:'0.15s'}]
        .map((b,i)=>(
          <rect key={i} x={b.x} y={b.ys[0]} width="2.5" rx="1.2" height={String(12-parseInt(b.ys[0]))} fill="#1DB954">
            <animate attributeName="y" values={`${b.ys[0]};${b.ys[1]};${b.ys[2]};${b.ys[0]}`} dur={b.dur} repeatCount="indefinite" begin={b.delay}/>
            <animate attributeName="height" values={`${12-parseInt(b.ys[0])};${12-parseInt(b.ys[1])};${12-parseInt(b.ys[2])};${12-parseInt(b.ys[0])}`} dur={b.dur} repeatCount="indefinite" begin={b.delay}/>
          </rect>
        ))}
    </svg>
  );
}

/* ─── Spinner ───────────────────────────────────────────────────── */
function Spinner({ size = 18, color = '#1DB954' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid rgba(29,185,84,0.2)`,
      borderTopColor: color,
      animation: 'rdSpin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

/* ─── CSS ───────────────────────────────────────────────────────── */
const CSS = `
@keyframes rdSpin  { to { transform: rotate(360deg); } }
@keyframes rdGlow  { 0%,100%{opacity:0.65;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
@keyframes rdPulse { 0%,100%{box-shadow:0 0 20px rgba(29,185,84,0.45)} 50%{box-shadow:0 0 44px rgba(29,185,84,0.85)} }
@keyframes rdFade  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

/* ══ RadioTile (shelf card) ══ */
.rt-tile {
  flex-shrink: 0; width: 190px; border-radius: 16px; overflow: hidden;
  background: linear-gradient(135deg, rgba(29,185,84,0.18) 0%, rgba(0,0,0,0.4) 100%);
  border: 1px solid rgba(29,185,84,0.28); cursor: pointer; position: relative;
  transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), border-color 0.22s, box-shadow 0.22s;
}
.rt-tile:hover { transform: translateY(-3px) scale(1.02); border-color: rgba(29,185,84,0.55); box-shadow: 0 16px 48px rgba(0,0,0,0.5), 0 0 30px rgba(29,185,84,0.12); }
.rt-tile-art { aspect-ratio:1; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; background:linear-gradient(135deg,rgba(29,185,84,0.22) 0%,rgba(0,0,0,0.55) 100%); }
.rt-tile-art-bg { position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;opacity:0.32;filter:blur(2px); }
.rt-tile-art-bg img { width:100%;height:100%;object-fit:cover; }
.rt-tile-art-icon { position:relative;z-index:2;width:58px;height:58px;border-radius:50%;background:rgba(29,185,84,0.9);display:flex;align-items:center;justify-content:center;font-size:24px;color:#000;box-shadow:0 0 28px rgba(29,185,84,0.55); }
.rt-tile-art-icon.on { animation: rdPulse 2.5s ease-in-out infinite; }
.rt-tile-info { padding:12px 14px 44px; }
.rt-tile-name { font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#fff;margin-bottom:2px; }
.rt-tile-sub { font-size:12px;color:rgba(255,255,255,0.45); }
.rt-tile-play { position:absolute;bottom:12px;right:12px;width:36px;height:36px;border-radius:50%;background:#1DB954;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(29,185,84,0.5);transition:background 0.15s,transform 0.15s; }
.rt-tile-play:hover { background:#23E065;transform:scale(1.1); }

/* ══ RadioDetailView ══ */
.rd-root { display:flex;flex-direction:column;height:100%;overflow:hidden;position:relative;font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;background:#07080A; }

/* Ambient background */
.rd-ambient { position:absolute;inset:0;z-index:0;pointer-events:none;transition:background 1s ease; }
.rd-ambient-scrim { position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(to bottom,rgba(7,8,10,0.25) 0%,rgba(7,8,10,0.55) 50%,rgba(7,8,10,0.85) 100%); }

/* Header bar */
.rd-header { position:relative;z-index:10;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid rgba(255,255,255,0.07);background:rgba(0,0,0,0.15);backdrop-filter:blur(20px); }
.rd-header-label { font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.38); }
.rd-close { width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.55);font-size:14px;transition:background 0.15s,color 0.15s; }
.rd-close:hover { background:rgba(255,255,255,0.14);color:#fff; }

/* Top half — centered art + meta */
.rd-top { position:relative;z-index:5;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 28px 24px;gap:20px; }

/* Art */
.rd-art-wrap { position:relative;width:min(220px,42vw);height:min(220px,42vw);flex-shrink:0; }
.rd-art-glow { position:absolute;inset:-20px;border-radius:50%;background:radial-gradient(circle,rgba(29,185,84,0.45) 0%,transparent 70%);filter:blur(24px);animation:rdGlow 3.5s ease-in-out infinite;z-index:0; }
.rd-art-img { position:relative;z-index:1;width:100%;height:100%;object-fit:cover;border-radius:20px;box-shadow:0 28px 72px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.08); }
.rd-art-empty { position:relative;z-index:1;width:100%;height:100%;border-radius:20px;background:linear-gradient(135deg,rgba(29,185,84,0.22),rgba(0,0,0,0.45));display:flex;align-items:center;justify-content:center;font-size:64px;color:rgba(29,185,84,0.38); }

/* Meta */
.rd-meta { text-align:center;width:100%;max-width:400px; }
.rd-meta-eyebrow { font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#1DB954;margin-bottom:7px; }
.rd-meta-title { font-family:'Syne',sans-serif;font-size:clamp(22px,4vw,32px);font-weight:800;letter-spacing:-0.035em;color:#fff;line-height:1.1;margin-bottom:5px; }
.rd-meta-artist { font-size:14px;color:rgba(255,255,255,0.48);margin-bottom:0; }

/* Controls */
.rd-controls { display:flex;align-items:center;justify-content:center;gap:16px; }
.rd-play-btn { width:62px;height:62px;border-radius:50%;background:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#000;font-size:22px;box-shadow:0 8px 36px rgba(0,0,0,0.4);transition:transform 0.18s,background 0.18s; }
.rd-play-btn:hover { background:#23E065;transform:scale(1.07); }
.rd-play-btn:active { transform:scale(0.94); }
.rd-skip-btn { width:44px;height:44px;border-radius:50%;background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.5);font-size:18px;display:flex;align-items:center;justify-content:center;transition:color 0.15s,background 0.15s; }
.rd-skip-btn:hover { color:#fff;background:rgba(255,255,255,0.07); }
.rd-stop-btn { display:flex;align-items:center;gap:7px;padding:9px 18px;border-radius:9999px;background:rgba(255,68,68,0.12);border:1px solid rgba(255,68,68,0.25);color:#ff6b6b;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background 0.15s; }
.rd-stop-btn:hover { background:rgba(255,68,68,0.22); }
.rd-start-btn { display:flex;align-items:center;gap:8px;padding:14px 28px;border-radius:9999px;background:#1DB954;color:#000;font-family:'Syne',sans-serif;font-weight:700;font-size:15px;border:none;cursor:pointer;box-shadow:0 6px 28px rgba(29,185,84,0.45);transition:background 0.15s,transform 0.15s; }
.rd-start-btn:hover { background:#23E065;transform:translateY(-1px); }
.rd-start-btn:active { transform:scale(0.97); }

/* Divider */
.rd-divider { position:relative;z-index:5;flex-shrink:0;height:1px;background:rgba(255,255,255,0.08);margin:0; }

/* Bottom half — queue */
.rd-queue { position:relative;z-index:5;flex:1;overflow-y:auto;padding:0 16px 40px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.07) transparent; }
.rd-queue::-webkit-scrollbar { width:3px; }
.rd-queue::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.07);border-radius:2px; }
.rd-queue-label { font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.28);padding:14px 12px 10px; }

/* Track rows */
.rd-track { display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:12px;cursor:pointer;border:1px solid transparent;transition:background 0.14s,border-color 0.14s;animation:rdFade 0.3s ease both; }
.rd-track:hover { background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.07); }
.rd-track.active { background:rgba(29,185,84,0.09);border-color:rgba(29,185,84,0.22); }
.rd-track-num { width:22px;text-align:center;font-size:11px;color:rgba(255,255,255,0.25);font-variant-numeric:tabular-nums;flex-shrink:0; }
.rd-track.active .rd-track-num { color:#1DB954; }
.rd-track-thumb { width:42px;height:42px;border-radius:9px;overflow:hidden;flex-shrink:0;box-shadow:0 4px 12px rgba(0,0,0,0.4); }
.rd-track-thumb img { width:100%;height:100%;object-fit:cover;display:block; }
.rd-track-meta { flex:1;min-width:0; }
.rd-track-name { font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;transition:color 0.14s; }
.rd-track:hover .rd-track-name,.rd-track.active .rd-track-name { color:#1DB954; }
.rd-track-artist { font-size:11px;color:rgba(255,255,255,0.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.rd-track-dur { font-size:11px;color:rgba(255,255,255,0.25);flex-shrink:0; }

/* Empty / loading */
.rd-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;gap:14px;text-align:center;color:rgba(255,255,255,0.28);font-size:13px; }
.rd-cta { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;gap:16px;text-align:center; }
.rd-cta-icon { font-size:52px;color:rgba(29,185,84,0.35);line-height:1; }
.rd-cta p { font-size:13px;color:rgba(255,255,255,0.35);max-width:260px;line-height:1.65; }
`;

/* ─────────────────────────────────────────────────────────────────
   RadioTile — shelf card
───────────────────────────────────────────────────────────────── */
export default function RadioTile({ onShowDetail, compact = false }) {
  const { songs, currentIndex, isPlaying, setIsPlaying } = usePlayer();
  const { radioMode, radioLoading, startRadio, stopRadio } = useRadio();

  const radioSongs    = songs.filter(s => s.source === 'radio');
  const upcomingCount = songs.slice(currentIndex + 1).filter(s => s.source === 'radio').length;
  const covers        = radioSongs.slice(0, 4).map(s => s.cover).filter(Boolean);

  const handlePlayBtn = useCallback((e) => {
    e.stopPropagation();
    if (radioMode) {
      setIsPlaying(p => !p);
    } else {
      startRadio();
    }
  }, [radioMode, setIsPlaying, startRadio]);

  // compact prop = used in greeting row as a pill button (no tile frame)
  if (compact) {
    return (
      <>
        <style>{CSS}</style>
        <button
          onClick={onShowDetail}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px 8px 10px', borderRadius: 9999,
            background: radioMode ? 'rgba(29,185,84,0.18)' : 'rgba(29,185,84,0.10)',
            border: `1px solid ${radioMode ? 'rgba(29,185,84,0.5)' : 'rgba(29,185,84,0.25)'}`,
            color: '#1DB954', fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: radioMode ? '0 0 18px rgba(29,185,84,0.2)' : 'none',
            transition: 'all 0.18s',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{
            width: 28, height: 28, borderRadius: '50%', background: '#1DB954',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#000', fontWeight: 800, flexShrink: 0,
            position: 'relative',
            animation: radioMode ? 'rdPulse 2.5s ease-in-out infinite' : 'none',
          }}>
            {radioLoading ? <Spinner size={14} color="#000" /> : '∞'}
          </span>
          Smart Radio
        </button>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="rt-tile" onClick={onShowDetail}>
        <div className="rt-tile-art">
          {covers.length >= 2 && (
            <div className="rt-tile-art-bg">
              {covers.map((c,i) => <img key={i} src={c} alt="" onError={e=>{e.target.style.display='none';}}/>)}
            </div>
          )}
          <div className={`rt-tile-art-icon${radioMode?' on':''}`}>
            {radioLoading ? <Spinner size={22} color="#000" /> : '∞'}
          </div>
        </div>
        <div className="rt-tile-info">
          <p className="rt-tile-name">Smart Radio</p>
          <p className="rt-tile-sub">
            {radioLoading ? 'Building mix…' : radioMode ? `${upcomingCount} up next` : 'Based on what you play'}
          </p>
        </div>
        <button className="rt-tile-play" onClick={handlePlayBtn} aria-label={radioMode?(isPlaying?'Pause':'Play'):'Start radio'}>
          {radioLoading
            ? <Spinner size={14} color="#fff" />
            : radioMode && isPlaying
            ? <FaPause style={{color:'#fff',fontSize:12}}/>
            : <FaPlay  style={{color:'#fff',fontSize:12,marginLeft:1}}/>
          }
        </button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   RadioDetailView — full-screen Spotify-style view
───────────────────────────────────────────────────────────────── */
export function RadioDetailView({ onClose }) {
  const { songs, currentIndex, setCurrentIndex, isPlaying, setIsPlaying, currentSong } = usePlayer();
  const { radioMode, radioLoading, startRadio, stopRadio } = useRadio();

  // Songs AFTER current position that are radio tracks
  const upcomingRadio = songs
    .map((s,i) => ({...s, _qi: i}))
    .filter((s,i) => i > currentIndex && s.source === 'radio');

  const cover      = currentSong?.cover;
  const songName   = currentSong?.name   || (radioMode ? 'Radio Mix' : 'Nothing playing');
  const songArtist = currentSong?.artist || (radioMode ? 'Smart Radio' : 'Start a radio mix below');

  // Derive a background color from cover art for the ambient bg
  const ambientStyle = cover
    ? { background: `radial-gradient(ellipse 90% 60% at 50% 0%, rgba(29,185,84,0.22) 0%, transparent 70%)` }
    : { background: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(4,28,16,0.6) 0%, transparent 65%)` };

  const handleTogglePlay = useCallback(() => {
    if (!radioMode) { startRadio(); return; }
    setIsPlaying(p => !p);
  }, [radioMode, startRadio, setIsPlaying]);

  const handleSkip = useCallback(() => {
    const next = songs[currentIndex + 1];
    if (next) { setCurrentIndex(currentIndex + 1); setIsPlaying(true); }
  }, [songs, currentIndex, setCurrentIndex, setIsPlaying]);

  const handleTrackClick = useCallback((qi) => {
    setCurrentIndex(qi);
    setTimeout(() => setIsPlaying(true), 50);
  }, [setCurrentIndex, setIsPlaying]);

  return (
    <>
      <style>{CSS}</style>
      <div className="rd-root">

        {/* Ambient background */}
        <div className="rd-ambient" style={ambientStyle} />
        <div className="rd-ambient-scrim" />

        {/* Header */}
        <div className="rd-header">
          <span className="rd-header-label">Smart Radio</span>
          <button className="rd-close" onClick={onClose} aria-label="Close"><FaTimes /></button>
        </div>

        {/* ── TOP: art + meta + controls ── */}
        <div className="rd-top">

          {/* Album art */}
          <div className="rd-art-wrap">
            <div className="rd-art-glow" />
            {cover
              ? <img src={cover} alt={songName} className="rd-art-img" onError={e=>{e.target.style.display='none';}} />
              : <div className="rd-art-empty">∞</div>
            }
          </div>

          {/* Meta */}
          <div className="rd-meta">
            <p className="rd-meta-eyebrow">Smart Radio</p>
            <h1 className="rd-meta-title">{songName}</h1>
            <p className="rd-meta-artist">{songArtist}</p>
          </div>

          {/* Controls */}
          <div className="rd-controls">
            {/* Skip — only when radio is active */}
            {radioMode && (
              <button className="rd-skip-btn" onClick={handleSkip} aria-label="Skip to next radio track" style={{ opacity: upcomingRadio.length === 0 ? 0.3 : 1 }}>
                <FaStepForward />
              </button>
            )}

            {/* Play / pause / start */}
            <button className="rd-play-btn" onClick={handleTogglePlay}>
              {radioLoading
                ? <Spinner size={22} color="#000" />
                : radioMode && isPlaying
                ? <FaPause style={{ fontSize: 20 }} />
                : <FaPlay  style={{ fontSize: 20, marginLeft: 3 }} />
              }
            </button>

            {/* Stop radio */}
            {radioMode && (
              <button className="rd-stop-btn" onClick={stopRadio}>Stop Radio</button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="rd-divider" />

        {/* ── BOTTOM: queue ── */}
        <div className="rd-queue">
          {!radioMode ? (
            /* Not started yet — CTA */
            <div className="rd-cta">
              <div className="rd-cta-icon">∞</div>
              <p>Smart Radio builds an endless mix of similar tracks based on what you're listening to.</p>
              <button className="rd-start-btn" onClick={startRadio} disabled={radioLoading}>
                {radioLoading ? <Spinner size={16} color="#000" /> : <FaInfinity />}
                Start Radio Mix
              </button>
            </div>
          ) : radioLoading && upcomingRadio.length === 0 ? (
            <div className="rd-empty">
              <Spinner size={28} />
              <span>Finding similar tracks…</span>
            </div>
          ) : upcomingRadio.length === 0 ? (
            <div className="rd-empty"><span>Queue refilling…</span></div>
          ) : (
            <>
              <div className="rd-queue-label">Up Next · {upcomingRadio.length}</div>
              {upcomingRadio.map((song, idx) => {
                const isActive = song._qi === currentIndex;
                return (
                  <div key={song.id || idx} className={`rd-track${isActive?' active':''}`} onClick={() => handleTrackClick(song._qi)}
                    style={{ animationDelay: `${Math.min(idx * 0.04, 0.4)}s` }}>
                    <span className="rd-track-num">
                      {isActive && isPlaying ? <WaveIcon /> : String(idx+1).padStart(2,'0')}
                    </span>
                    <div className="rd-track-thumb">
                      <img src={song.cover || 'https://placehold.co/42x42/0a0a0a/333?text=♪'} alt={song.name}
                        onError={e=>{e.target.src='https://placehold.co/42x42/0a0a0a/333?text=♪';}} />
                    </div>
                    <div className="rd-track-meta">
                      <p className="rd-track-name">{song.name}</p>
                      <p className="rd-track-artist">{song.artist || 'YouTube'}</p>
                    </div>
                    <span className="rd-track-dur">{song.duration || ''}</span>
                  </div>
                );
              })}
              {/* Refill loading indicator */}
              {radioLoading && (
                <div className="rd-empty" style={{ padding:'16px 12px', flexDirection:'row', gap:10 }}>
                  <Spinner size={18} />
                  <span style={{ fontSize:12 }}>Adding more tracks…</span>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </>
  );
}