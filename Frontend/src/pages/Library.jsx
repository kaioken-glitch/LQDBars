import React, { useState, useMemo, useCallback, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faEllipsisH } from '@fortawesome/free-solid-svg-icons';
import { FaSearch, FaPlay, FaRandom, FaMusic } from 'react-icons/fa';
import TinyPlayer from '../components/TinyPlayer';
import { usePlayer } from '../context/PlayerContext';

/* ─────────────────────────────────────────────────────────────────────
   SCOPED CSS — .lib-* namespace, zero global leakage
───────────────────────────────────────────────────────────────────── */
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

/* ── Shell ── */
.lib-shell { width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; }

/* ── Header ── */
.lib-header {
  flex-shrink: 0;
  padding: 28px 28px 0;
  background: linear-gradient(180deg, rgba(29,185,84,0.06) 0%, transparent 100%);
}
.lib-header-top {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 20px; flex-wrap: wrap;
}
.lib-title-block { flex: 1; min-width: 0; }
.lib-eyebrow {
  font-size: 10px; font-weight: 700; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--g);
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
}
.lib-eyebrow-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--g); }
.lib-title {
  font-family: 'Syne', sans-serif;
  font-size: clamp(34px, 5vw, 58px); font-weight: 800;
  letter-spacing: -0.045em; line-height: 1; color: var(--t1);
}
.lib-title em { font-style: normal; color: var(--g2); }
.lib-subtitle { font-size: 12px; color: var(--t3); margin-top: 5px; letter-spacing: 0.02em; }

.lib-header-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.lib-search-wrap { position: relative; }
.lib-search-ico {
  position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
  color: var(--t3); font-size: 12px; pointer-events: none;
}
.lib-search {
  padding: 9px 14px 9px 36px; width: 220px;
  background: var(--s1); border: 1px solid var(--b1);
  border-radius: 9999px; color: var(--t1);
  font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
  transition: border-color .18s var(--ease), background .18s var(--ease), box-shadow .18s var(--ease);
}
.lib-search::placeholder { color: var(--t3); }
.lib-search:focus {
  border-color: rgba(29,185,84,.5); background: var(--s2);
  box-shadow: 0 0 0 3px rgba(29,185,84,.10);
}

.lib-divider { height: 1px; background: var(--b1); margin: 18px 0 0; }

/* ── Content ── */
.lib-content {
  flex: 1; overflow-y: auto; padding: 24px 28px 40px;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent;
}
.lib-content::-webkit-scrollbar { width: 4px; }
.lib-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 3px; }

/* ── Grid ── */
.lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 16px;
}
@media (min-width: 500px)  { .lib-grid { grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 18px; } }
@media (min-width: 768px)  { .lib-grid { grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 20px; } }
@media (min-width: 1024px) { .lib-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 24px; } }

/* ── Album Card ── */
.lib-card {
  position: relative;
  background: var(--s1); border: 1px solid var(--b1);
  border-radius: 18px; overflow: hidden; cursor: pointer;
  transition: transform .24s var(--spring), border-color .22s var(--ease), box-shadow .22s var(--ease);
  animation: libUp .38s var(--spring) both;
}
@keyframes libUp {
  from { opacity: 0; transform: translateY(18px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
.lib-card:hover {
  transform: translateY(-6px) scale(1.025);
  border-color: rgba(29,185,84,.28);
  box-shadow: 0 24px 56px rgba(0,0,0,.55), 0 0 32px rgba(29,185,84,.07);
}
/* stagger */
.lib-card:nth-child(1)  { animation-delay:.03s }
.lib-card:nth-child(2)  { animation-delay:.06s }
.lib-card:nth-child(3)  { animation-delay:.09s }
.lib-card:nth-child(4)  { animation-delay:.12s }
.lib-card:nth-child(5)  { animation-delay:.15s }
.lib-card:nth-child(n+6){ animation-delay:.17s }

/* art */
.lib-art { position: relative; width: 100%; padding-top: 100%; }
.lib-art-mosaic {
  position: absolute; inset: 0;
  display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
  background: rgba(29,185,84,.12);
}
.lib-art-single { position: absolute; inset: 0; overflow: hidden; }
.lib-art-mosaic img, .lib-art-single img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform .55s var(--ease);
}
.lib-card:hover .lib-art-mosaic img,
.lib-card:hover .lib-art-single img { transform: scale(1.07); }

.lib-art-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,.72) 0%, transparent 55%);
  opacity: 0; transition: opacity .22s var(--ease);
  display: flex; align-items: center; justify-content: center;
}
.lib-card:hover .lib-art-overlay { opacity: 1; }

.lib-play-btn {
  width: 46px; height: 46px; border-radius: 50%;
  background: var(--g); color: #000; font-size: 15px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 22px rgba(29,185,84,.5);
  transform: scale(.82) translateY(4px);
  transition: transform .22s var(--spring), background .15s var(--ease);
}
.lib-card:hover .lib-play-btn { transform: scale(1) translateY(0); }
.lib-play-btn:hover { background: var(--g2); }

/* card info */
.lib-card-info { padding: 13px 15px 15px; }
.lib-card-name {
  font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
  color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 4px; letter-spacing: -.01em;
}
.lib-card-artist {
  font-size: 11px; color: var(--t2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;
}
.lib-card-count { font-size: 11px; color: var(--t3); }

/* ── Empty ── */
.lib-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 55vh; gap: 16px; text-align: center;
}
.lib-empty-icon {
  width: 80px; height: 80px; border-radius: 50%;
  background: var(--s1); border: 1px solid var(--b1);
  display: flex; align-items: center; justify-content: center;
  font-size: 30px; color: var(--t3);
  animation: libPulse 3s ease-in-out infinite;
}
@keyframes libPulse { 0%,100%{box-shadow:0 0 0 0 rgba(29,185,84,0)} 50%{box-shadow:0 0 0 8px rgba(29,185,84,.08)} }
.lib-empty h3 {
  font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800;
  color: var(--t1); letter-spacing: -.025em;
}
.lib-empty p { font-size: 14px; color: var(--t3); max-width: 300px; line-height: 1.6; }

/* ══════════════════════════════════
   DETAIL MODAL
══════════════════════════════════ */
.lib-modal {
  position: fixed; inset: 0; z-index: 50;
  display: flex; flex-direction: column; overflow: hidden;
  animation: libFadeIn .28s var(--spring) both;
}
@keyframes libFadeIn { from{opacity:0} to{opacity:1} }

.lib-modal-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 70% 50% at 20% -10%, rgba(29,185,84,.22) 0%, transparent 60%),
    linear-gradient(180deg, rgba(4,28,16,.95) 0%, #07080A 50%);
}
.lib-modal-grain {
  position: absolute; inset: 0; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 200px; opacity: .022; mix-blend-mode: screen;
}

/* modal top bar */
.lib-modal-bar {
  position: relative; z-index: 2; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 22px;
  border-bottom: 1px solid var(--b1);
  background: rgba(0,0,0,.22); backdrop-filter: blur(24px);
}
.lib-modal-btn {
  width: 38px; height: 38px; border-radius: 50%;
  background: var(--s1); border: 1px solid var(--b1);
  color: var(--t1); font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s var(--ease), transform .15s var(--ease);
}
.lib-modal-btn:hover { background: var(--sh); }
.lib-modal-btn:active { transform: scale(.9); }

/* hero section */
.lib-hero {
  position: relative; z-index: 2; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 20px;
  padding: 28px 30px 20px;
}
@media (min-width: 560px) { .lib-hero { flex-direction: row; align-items: flex-end; padding: 32px 40px 24px; } }

.lib-hero-art {
  position: relative; flex-shrink: 0;
  width: 148px; height: 148px;
}
@media (min-width: 560px) { .lib-hero-art { width: 185px; height: 185px; } }

.lib-hero-glow {
  position: absolute; inset: -14px; border-radius: 26px;
  background: radial-gradient(circle, var(--gglow) 0%, transparent 70%);
  filter: blur(14px);
  animation: heroGlow 3.5s ease-in-out infinite;
}
@keyframes heroGlow { 0%,100%{opacity:.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }

.lib-hero-img {
  position: relative; display: block;
  width: 100%; height: 100%; object-fit: cover;
  border-radius: 20px;
  box-shadow: 0 28px 64px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08);
}

.lib-hero-info { flex: 1; min-width: 0; }
.lib-hero-tag {
  display: flex; align-items: center; gap: 7px;
  font-size: 10px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: var(--g); margin-bottom: 9px;
}
.lib-hero-tag-bar { width: 3px; height: 18px; border-radius: 2px; background: var(--g); }
.lib-hero-title {
  font-family: 'Syne', sans-serif;
  font-size: clamp(26px, 4.5vw, 50px); font-weight: 800;
  letter-spacing: -.04em; color: var(--t1); line-height: 1.04;
  margin-bottom: 7px;
}
.lib-hero-artist { font-size: 15px; color: var(--t2); margin-bottom: 5px; }
.lib-hero-count  { font-size: 12px; color: var(--t3); margin-bottom: 22px; }

.lib-hero-actions { display: flex; align-items: center; gap: 12px; }
.lib-hero-play {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--g); color: #000; font-size: 19px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 28px rgba(29,185,84,.45);
  transition: transform .18s var(--spring), background .15s var(--ease), box-shadow .15s var(--ease);
}
.lib-hero-play:hover { background: var(--g2); transform: scale(1.09); box-shadow: 0 10px 36px rgba(29,185,84,.55); }
.lib-hero-play:active { transform: scale(.93); }
.lib-hero-shuffle {
  width: 42px; height: 42px; border-radius: 50%;
  background: var(--s1); border: 1px solid var(--b1);
  color: var(--t2); font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s var(--ease), color .15s var(--ease);
}
.lib-hero-shuffle:hover { background: var(--sh); color: var(--t1); }

/* tracklist */
.lib-tracks {
  position: relative; z-index: 2; flex: 1; overflow-y: auto;
  padding: 0 22px 36px;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent;
}
.lib-tracks::-webkit-scrollbar { width: 4px; }
.lib-tracks::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 3px; }

.lib-tracks-label {
  font-size: 10px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: var(--t3);
  padding: 0 12px 14px;
}
.lib-track-row {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 12px; border-radius: 12px; cursor: pointer;
  border: 1px solid transparent;
  transition: background .14s var(--ease), border-color .14s var(--ease);
}
.lib-track-row:hover { background: var(--s2); border-color: var(--b1); }
.lib-track-row.active {
  background: rgba(29,185,84,.09); border-color: rgba(29,185,84,.2);
}
.lib-track-num {
  width: 24px; text-align: center; font-size: 11px;
  color: var(--t3); font-variant-numeric: tabular-nums; flex-shrink: 0;
}
.lib-track-row.active .lib-track-num { color: var(--g); }
.lib-track-thumb {
  width: 40px; height: 40px; border-radius: 8px;
  overflow: hidden; flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0,0,0,.35);
}
.lib-track-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lib-track-meta { flex: 1; min-width: 0; }
.lib-track-name {
  font-size: 13px; font-weight: 600; color: var(--t1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 2px;
  transition: color .14s var(--ease);
}
.lib-track-row:hover .lib-track-name,
.lib-track-row.active .lib-track-name { color: var(--g); }
.lib-track-artist {
  font-size: 11px; color: var(--t3);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lib-track-dur { font-size: 11px; color: var(--t3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
`;

const FB = 'https://placehold.co/200x200/061408/112208?text=♪';

/* ── ALBUM CARD ── */
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

/* ── TRACK ROW ── */
const TrackRow = memo(({ song, index, isActive, onClick }) => (
  <div className={`lib-track-row${isActive ? ' active' : ''}`} onClick={onClick} role="button" aria-label={`Play ${song.name}`}>
    <span className="lib-track-num">{String(index + 1).padStart(2, '0')}</span>
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

/* ── MAIN ── */
export default function Library() {
  const {
    currentSong, isPlaying, playNext, playPrev, setIsPlaying,
    isMuted, toggleMute, librarySongs = [],
    setPlayerSongs, setCurrentIndex,
  } = usePlayer();

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
    setPlayerSongs(songs);
    setCurrentIndex(startIdx);
    setIsPlaying(true);
  }, [setPlayerSongs, setCurrentIndex, setIsPlaying]);

  const playSong = useCallback((song, songs) => {
    const idx = songs.findIndex(s => s.id === song.id);
    playAlbum(songs, idx >= 0 ? idx : 0);
  }, [playAlbum]);

  const shuffleAlbum = useCallback((songs) => {
    playAlbum([...songs].sort(() => Math.random() - 0.5));
  }, [playAlbum]);

  return (
    <div className="lib-root" style={{ width: '100%', height: '100%' }}>
      <style>{CSS}</style>
      <div className="lib-shell">

        {/* ── Header ── */}
        <div className="lib-header">
          <div className="lib-header-top">
            <div className="lib-title-block">
              <div className="lib-eyebrow"><span className="lib-eyebrow-dot" /> Your Collection</div>
              <h1 className="lib-title">Li<em>brary</em></h1>
              <p className="lib-subtitle">{albums.length} albums · {filtered.length} songs</p>
            </div>
            <div className="lib-header-controls">
              {/* Search */}
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
              {/* TinyPlayer – desktop */}
              <div style={{ display: 'none' }} className="lib-tiny-player">
                <TinyPlayer
                  song={currentSong}
                  isPlaying={isPlaying}
                  onPlayPause={() => setIsPlaying(p => !p)}
                  onPrev={playPrev}
                  onNext={playNext}
                  isMuted={isMuted}
                  onMuteToggle={toggleMute}
                />
              </div>
            </div>
          </div>
          <div className="lib-divider" />
        </div>

        <style>{`@media(min-width:768px){.lib-tiny-player{display:block !important}}`}</style>

        {/* ── Content ── */}
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

      {/* ── Detail Modal ── */}
      {selected && (
        <div className="lib-root" style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div className="lib-modal">
            <div className="lib-modal-bg" />
            <div className="lib-modal-grain" />

            {/* bar */}
            <div className="lib-modal-bar">
              <button className="lib-modal-btn" onClick={() => setSelected(null)} aria-label="Back">
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <button className="lib-modal-btn" aria-label="More options">
                <FontAwesomeIcon icon={faEllipsisH} />
              </button>
            </div>

            {/* hero */}
            <div className="lib-hero">
              <div className="lib-hero-art">
                <div className="lib-hero-glow" />
                <img
                  className="lib-hero-img"
                  src={selected.songs[0]?.cover || FB}
                  alt={selected.album}
                  onError={e => { e.target.src = FB; }}
                />
              </div>
              <div className="lib-hero-info">
                <div className="lib-hero-tag"><span className="lib-hero-tag-bar" /> Album</div>
                <h1 className="lib-hero-title">{selected.album}</h1>
                <p className="lib-hero-artist">{selected.songs[0]?.artist || 'Various Artists'}</p>
                <p className="lib-hero-count">{selected.songs.length} song{selected.songs.length !== 1 ? 's' : ''}</p>
                <div className="lib-hero-actions">
                  <button className="lib-hero-play" onClick={() => playAlbum(selected.songs)} aria-label="Play all">
                    <FaPlay style={{ marginLeft: 2 }} />
                  </button>
                  <button className="lib-hero-shuffle" onClick={() => shuffleAlbum(selected.songs)} aria-label="Shuffle">
                    <FaRandom />
                  </button>
                </div>
              </div>
            </div>

            {/* tracklist */}
            <div className="lib-tracks">
              <div className="lib-tracks-label">Tracks · {selected.songs.length}</div>
              {selected.songs.map((song, i) => (
                <TrackRow
                  key={song.id || i}
                  song={song} index={i}
                  isActive={currentSong?.id === song.id}
                  onClick={() => playSong(song, selected.songs)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}