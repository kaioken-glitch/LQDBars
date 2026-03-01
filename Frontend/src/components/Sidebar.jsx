import React, { memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import logo from '../assets/logo.svg';
import {
  FaHome, FaCompactDisc, FaListUl, FaHeart,
  FaHistory, FaCog,
} from 'react-icons/fa';

/* ─────────────────────────────────────────────────────────────────────
   ROUTE MAP — maps nav label → path
   Update these if your routes differ.
───────────────────────────────────────────────────────────────────── */

const ROUTE_MAP = {
  'Home':            '/',
  'Library':         '/library',
  'Playlists':       '/playlists',   // adjust if you have a /favorites route
  'Recently Played': '/recent',
  'Settings':        '/settings',
};

const NAV_ITEMS = [
  { label: 'Home',            icon: FaHome },
  { label: 'Library',         icon: FaCompactDisc },
  { label: 'Playlists',       icon: FaListUl },
  { label: 'Recently Played', icon: FaHistory },
];

const USER = { firstName: 'Ava' };

/* ─────────────────────────────────────────────────────────────────────
   SCOPED CSS
───────────────────────────────────────────────────────────────────── */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

.sb-root {
  --sb-green:        #1DB954;
  --sb-green-bright: #23E065;
  --sb-green-dim:    rgba(29, 185, 84, 0.14);
  --sb-green-glow:   rgba(29, 185, 84, 0.30);
  --sb-text-1:       #FFFFFF;
  --sb-text-2:       rgba(255,255,255,0.55);
  --sb-text-3:       rgba(255,255,255,0.25);
  --sb-surface:      rgba(255,255,255,0.04);
  --sb-surface-h:    rgba(255,255,255,0.07);
  --sb-border:       rgba(255,255,255,0.07);
  --sb-border-h:     rgba(29,185,84,0.25);
  --sb-ease:         cubic-bezier(0.4, 0, 0.2, 1);
  --sb-spring:       cubic-bezier(0.22, 1, 0.36, 1);
}

.sb-root *, .sb-root *::before, .sb-root *::after {
  box-sizing: border-box; margin: 0; padding: 0;
}
.sb-root {
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ── Aside ── */
.sb-aside {
  position: relative;
  width: 220px;
  height: calc(100% - 130px);
  margin: 20px 0 20px 20px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  background:
    linear-gradient(170deg,
      rgba(4,  44, 26, 0.72) 0%,
      rgba(3,  28, 16, 0.65) 50%,
      rgba(8,   8, 10, 0.80) 100%
    );
  backdrop-filter: blur(32px) saturate(160%);
  -webkit-backdrop-filter: blur(32px) saturate(160%);
  border: 1px solid var(--sb-border);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.04) inset,
    0 24px 60px rgba(0,0,0,0.45),
    0 0 80px rgba(29,185,84,0.04);
  transition: box-shadow 0.45s var(--sb-ease), border-color 0.45s var(--sb-ease);
}
.sb-aside:hover {
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.06) inset,
    0 24px 60px rgba(0,0,0,0.5),
    0 0 60px rgba(29,185,84,0.09);
  border-color: rgba(255,255,255,0.10);
}

/* Top radial highlight */
.sb-aside::before {
  content: '';
  position: absolute; top: -60px; left: -60px;
  width: 240px; height: 240px; border-radius: 50%;
  background: radial-gradient(circle, rgba(29,185,84,0.10) 0%, transparent 70%);
  pointer-events: none; z-index: 0;
}

/* Grain */
.sb-aside::after {
  content: '';
  position: absolute; inset: 0; border-radius: 20px;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px; opacity: 0.025;
  mix-blend-mode: overlay; pointer-events: none; z-index: 0;
}

.sb-inner {
  position: relative; z-index: 1;
  display: flex; flex-direction: column;
  height: 100%; overflow: hidden;
}

/* ── Logo ── */
.sb-logo-btn {
  display: block; padding: 24px 24px 20px;
  background: none; border: none; cursor: pointer;
  transition: transform 0.3s var(--sb-spring);
  flex-shrink: 0;
}
.sb-logo-btn:hover { transform: scale(1.05); }
.sb-logo-img {
  width: 112px; height: auto; display: block;
  filter: drop-shadow(0 0 14px rgba(29,185,84,0.28));
  transition: filter 0.3s var(--sb-ease);
}
.sb-logo-btn:hover .sb-logo-img {
  filter: drop-shadow(0 0 22px rgba(29,185,84,0.50));
}

/* ── Nav ── */
.sb-nav {
  flex: 1; overflow-y: auto;
  padding: 0 10px; display: flex; flex-direction: column; gap: 2px;
  scrollbar-width: none;
}
.sb-nav::-webkit-scrollbar { display: none; }

.sb-nav-btn {
  position: relative; width: 100%;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 12px;
  background: none; border: none; cursor: pointer; text-align: left;
  color: var(--sb-text-2); font-size: 13px; font-weight: 500;
  font-family: 'DM Sans', sans-serif;
  transition: color 0.18s var(--sb-ease), background 0.18s var(--sb-ease), transform 0.15s var(--sb-ease);
  overflow: hidden;
}
.sb-nav-btn:hover  { color: var(--sb-text-1); background: var(--sb-surface-h); }
.sb-nav-btn:active { transform: scale(0.97); }
.sb-nav-btn.active { color: var(--sb-text-1); background: rgba(29,185,84,0.12); font-weight: 600; }

/* Active left bar */
.sb-nav-btn.active::before {
  content: '';
  position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 22px; border-radius: 0 3px 3px 0;
  background: linear-gradient(to bottom, var(--sb-green-bright), var(--sb-green));
  box-shadow: 0 0 10px var(--sb-green-glow);
}

/* Shine sweep */
.sb-nav-btn::after {
  content: '';
  position: absolute; inset: 0; border-radius: 12px;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%);
  opacity: 0; transform: translateX(-100%);
  transition: opacity 0.2s, transform 0s;
}
.sb-nav-btn:hover::after {
  opacity: 1; transform: translateX(100%);
  transition: opacity 0.2s, transform 0.5s var(--sb-ease);
}

.sb-nav-icon {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; flex-shrink: 0;
}
.sb-nav-icon svg {
  font-size: 15px;
  color: var(--sb-text-3);
  transition: color 0.18s var(--sb-ease);
}
.sb-nav-btn:hover .sb-nav-icon svg { color: var(--sb-text-2); }
.sb-nav-btn.active .sb-nav-icon svg {
  color: var(--sb-green);
  filter: drop-shadow(0 0 6px rgba(29,185,84,0.7));
}

.sb-icon-ring {
  position: absolute; inset: -3px; border-radius: 50%;
  background: rgba(29,185,84,0.18);
  animation: sbRingPulse 2s ease-in-out infinite;
}
@keyframes sbRingPulse {
  0%,100% { opacity: 0.5; transform: scale(1); }
  50%     { opacity: 1;   transform: scale(1.2); }
}

.sb-nav-label { flex: 1; }

/* ── Now Playing Card ── */
.sb-card-wrap { padding: 10px; flex-shrink: 0; }

.sb-card {
  position: relative; border-radius: 14px; overflow: hidden;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--sb-border);
  transition: border-color 0.3s var(--sb-ease), box-shadow 0.3s var(--sb-ease);
}
.sb-card:hover { border-color: var(--sb-border-h); box-shadow: 0 8px 32px rgba(29,185,84,0.10); }

.sb-card-playing { padding: 10px; }

.sb-art-wrap {
  position: relative; width: 100%; padding-top: 100%;
  border-radius: 10px; overflow: hidden; margin-bottom: 10px;
}
.sb-art-img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  display: block; transition: transform 0.6s var(--sb-ease);
}
.sb-card:hover .sb-art-img { transform: scale(1.04); }
.sb-art-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%);
  pointer-events: none;
}
.sb-vinyl-ring {
  position: absolute; inset: -2px; border-radius: 50%;
  border: 2px solid transparent; border-top-color: var(--sb-green);
  opacity: 0; pointer-events: none;
  animation: sbVinylSpin 1.4s linear infinite;
}
@keyframes sbVinylSpin { to { transform: rotate(360deg); } }
.sb-art-wrap:hover .sb-vinyl-ring { opacity: 0.5; }

.sb-play-badge {
  position: absolute; bottom: 8px; right: 8px;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--sb-green);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 14px rgba(29,185,84,0.5);
  transition: transform 0.2s var(--sb-spring);
}
.sb-card:hover .sb-play-badge { transform: scale(1.1); }
.sb-play-badge svg { color: #fff; font-size: 9px; margin-left: 1px; }

.sb-card-name {
  font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700;
  color: var(--sb-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  letter-spacing: -0.01em; margin-bottom: 2px;
}
.sb-card-artist {
  font-size: 10px; color: var(--sb-text-3);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px;
}

.sb-wave { display: flex; align-items: flex-end; gap: 2px; height: 14px; }
.sb-wave span {
  display: block; width: 2.5px; border-radius: 2px;
  background: var(--sb-green); box-shadow: 0 0 4px rgba(29,185,84,0.4);
}
@keyframes sbW1 { 0%,100%{height:3px}  50%{height:12px} }
@keyframes sbW2 { 0%,100%{height:9px}  50%{height:3px}  }
@keyframes sbW3 { 0%,100%{height:6px}  50%{height:14px} }
@keyframes sbW4 { 0%,100%{height:10px} 50%{height:4px}  }
@keyframes sbW5 { 0%,100%{height:4px}  50%{height:10px} }
.sb-wave span:nth-child(1) { animation: sbW1 0.75s ease-in-out infinite; }
.sb-wave span:nth-child(2) { animation: sbW2 0.75s ease-in-out infinite 0.10s; }
.sb-wave span:nth-child(3) { animation: sbW3 0.75s ease-in-out infinite 0.20s; }
.sb-wave span:nth-child(4) { animation: sbW4 0.75s ease-in-out infinite 0.30s; }
.sb-wave span:nth-child(5) { animation: sbW5 0.75s ease-in-out infinite 0.40s; }

.sb-card-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 28px 16px; gap: 10px;
}
.sb-card-empty-disc {
  width: 48px; height: 48px; border-radius: 50%;
  background: rgba(255,255,255,0.04); border: 1px solid var(--sb-border);
  display: flex; align-items: center; justify-content: center;
}
.sb-card-empty-disc svg { color: var(--sb-text-3); font-size: 18px; }
.sb-card-empty p { font-size: 11px; color: var(--sb-text-3); text-align: center; line-height: 1.4; }

/* ── Footer ── */
.sb-footer {
  padding: 8px 10px 10px;
  border-top: 1px solid var(--sb-border);
  flex-shrink: 0;
}
.sb-settings-btn {
  position: relative; width: 100%;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 12px;
  background: none; border: none; cursor: pointer; text-align: left;
  color: var(--sb-text-2); font-size: 13px; font-weight: 500;
  font-family: 'DM Sans', sans-serif;
  transition: color 0.18s var(--sb-ease), background 0.18s var(--sb-ease);
}
.sb-settings-btn:hover { color: var(--sb-text-1); background: var(--sb-surface-h); }
.sb-settings-btn.active { color: var(--sb-text-1); background: rgba(29,185,84,0.12); font-weight: 600; }
.sb-settings-btn.active::before {
  content: '';
  position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 22px; border-radius: 0 3px 3px 0;
  background: linear-gradient(to bottom, var(--sb-green-bright), var(--sb-green));
  box-shadow: 0 0 10px var(--sb-green-glow);
}
.sb-cog-icon {
  font-size: 15px; color: var(--sb-text-3);
  transition: color 0.18s var(--sb-ease), transform 0.5s var(--sb-ease);
}
.sb-settings-btn:hover  .sb-cog-icon { transform: rotate(60deg); color: var(--sb-text-2); }
.sb-settings-btn.active .sb-cog-icon { color: var(--sb-green); filter: drop-shadow(0 0 6px rgba(29,185,84,0.7)); transform: rotate(0deg); }

.sb-avatar {
  margin-left: auto; flex-shrink: 0;
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, var(--sb-green) 0%, #0BAF3F 100%);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 800; color: #000;
  box-shadow: 0 2px 10px rgba(29,185,84,0.35), 0 0 0 2px rgba(255,255,255,0.10);
  transition: transform 0.2s var(--sb-spring), box-shadow 0.2s var(--sb-ease);
}
.sb-settings-btn:hover .sb-avatar {
  transform: scale(1.12);
  box-shadow: 0 4px 16px rgba(29,185,84,0.5), 0 0 0 2px rgba(255,255,255,0.15);
}
`;

/* ─────────────────────────────────────────────────────────────────────
   NAV BUTTON
───────────────────────────────────────────────────────────────────── */

const NavBtn = memo(({ item, isActive, onClick }) => {
  const Icon = item.icon;
  return (
    <button
      className={`sb-nav-btn${isActive ? ' active' : ''}`}
      onClick={onClick}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="sb-nav-icon">
        <Icon />
        {isActive && <span className="sb-icon-ring" />}
      </span>
      <span className="sb-nav-label">{item.label}</span>
    </button>
  );
});

/* ─────────────────────────────────────────────────────────────────────
   NOW PLAYING CARD
───────────────────────────────────────────────────────────────────── */

const FALLBACK_ART = 'https://placehold.co/200x200/0a0a0a/1a1a1a?text=♪';

const NowPlayingCard = memo(({ song, isPlaying }) => {
  if (!song) {
    return (
      <div className="sb-card">
        <div className="sb-card-empty">
          <div className="sb-card-empty-disc"><FaCompactDisc /></div>
          <p>Nothing playing<br />yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sb-card">
      <div className="sb-card-playing">
        <div className="sb-art-wrap">
          <img
            src={song.cover || FALLBACK_ART}
            alt={song.name}
            className="sb-art-img"
            onError={e => { e.target.src = FALLBACK_ART; }}
          />
          <div className="sb-art-overlay" />
          <div className="sb-vinyl-ring" />
          <div className="sb-play-badge">
            <svg viewBox="0 0 10 12" fill="white" width="9" height="9">
              <path d="M0 0l10 6-10 6z" />
            </svg>
          </div>
        </div>
        <p className="sb-card-name">{song.name || 'Unknown'}</p>
        <p className="sb-card-artist">{song.artist || 'Unknown Artist'}</p>
        {isPlaying && (
          <div className="sb-wave">
            <span /><span /><span /><span /><span />
          </div>
        )}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────────────
   MAIN EXPORT

   FIX: The original crashed because parent components weren't always
   passing `setActive` as a prop. The component now uses React Router's
   `useNavigate` + `useLocation` as the primary navigation mechanism.

   Backward-compat: if a parent still passes `active`/`setActive` props
   those are used as an override (avoids breaking any page that still
   calls setActive internally). But the crash no longer occurs when
   those props are absent.
───────────────────────────────────────────────────────────────────── */

export default function Sidebar({ active: activeProp, setActive: setActiveProp }) {
  const { currentSong, isPlaying } = usePlayer();

  // ── Prefer React Router; fall back to prop-based nav ──
  let navigate, location;
  try {
    navigate = useNavigate();
    location = useLocation();
  } catch {
    // Not inside a Router — prop-based fallback will be used
    navigate  = null;
    location  = null;
  }

  // Derive which label is "active" from the current URL path
  const activeFromRoute = location
    ? Object.entries(ROUTE_MAP).find(([, path]) => location.pathname === path)?.[0] ?? 'Home'
    : null;

  // Use prop override if provided, else route-derived, else 'Home'
  const active = activeProp ?? activeFromRoute ?? 'Home';

  // Navigation handler — uses router if available, props if not
  const handleNav = (label) => {
    if (navigate) {
      navigate(ROUTE_MAP[label] ?? '/');
    }
    // Also call prop setter if parent provided one (no crash guard needed
    // because we explicitly check before calling)
    if (typeof setActiveProp === 'function') {
      setActiveProp(label);
    }
  };

  return (
    <div className="sb-root">
      <style>{CSS}</style>

      <aside className="sb-aside">
        <div className="sb-inner">

          {/* Logo → Home */}
          <button
            className="sb-logo-btn"
            onClick={() => handleNav('Home')}
            aria-label="Go to Home"
          >
            <img src={logo} alt="Liquid Bars" className="sb-logo-img" />
          </button>

          {/* Nav items */}
          <nav className="sb-nav" aria-label="Main navigation">
            {NAV_ITEMS.map(item => (
              <NavBtn
                key={item.label}
                item={item}
                isActive={active === item.label}
                onClick={() => handleNav(item.label)}
              />
            ))}
          </nav>

          {/* Now Playing */}
          <div className="sb-card-wrap">
            <NowPlayingCard song={currentSong} isPlaying={isPlaying} />
          </div>

          {/* Footer */}
          <div className="sb-footer">
            <button
              className={`sb-settings-btn${active === 'Settings' ? ' active' : ''}`}
              onClick={() => handleNav('Settings')}
              aria-label="Settings"
              aria-current={active === 'Settings' ? 'page' : undefined}
            >
              <FaCog className="sb-cog-icon" />
              <span>Settings</span>
              <div className="sb-avatar" aria-hidden>{USER.firstName[0].toUpperCase()}</div>
            </button>
          </div>

        </div>
      </aside>
    </div>
  );
}