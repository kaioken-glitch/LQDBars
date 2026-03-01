/**
 * BottomNav.jsx
 * Mobile bottom navigation for LiquidBars.
 *
 * KEY FIX: Removed position:fixed. The nav now lives in the normal flow
 * inside App.jsx's bottom-slot div. position:fixed was causing the nav
 * to escape the layout stack while the main content div (flex:1,
 * overflow:hidden) remained physically on top of it, swallowing all taps.
 */

import React, { useState } from 'react';
import { FaHome, FaCompactDisc, FaListUl, FaHistory, FaCog } from 'react-icons/fa';

/* ─── Labels MUST match App.jsx switch cases exactly ─────────────── */
const NAV_ITEMS = [
  { label: 'Home',            icon: FaHome,        shortLabel: 'Home'    },
  { label: 'Library',         icon: FaCompactDisc, shortLabel: 'Library' },
  { label: 'Playlists',       icon: FaListUl,      shortLabel: 'Lists'   },
  { label: 'Recently Played', icon: FaHistory,     shortLabel: 'Recent'  },
  { label: 'Settings',        icon: FaCog,         shortLabel: 'More'    },
];

const STYLES = `
  @keyframes bn-ink {
    0%   { transform: scale(0);   opacity: 0.7; }
    60%  { transform: scale(2.8); opacity: 0.25; }
    100% { transform: scale(3.5); opacity: 0; }
  }
  @keyframes bn-iconBounce {
    0%   { transform: translateY(0)    scale(1); }
    35%  { transform: translateY(-5px) scale(1.18); }
    65%  { transform: translateY(1px)  scale(0.94); }
    100% { transform: translateY(0)    scale(1); }
  }
  @keyframes bn-labelIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes bn-glowPulse {
    0%, 100% { opacity: 0.6; }
    50%      { opacity: 1; }
  }

  /* In normal flow — no position:fixed */
  .bn-root {
    width: 100%;
    display: flex;
    justify-content: center;
    padding: 6px 12px max(10px, env(safe-area-inset-bottom, 10px));
    background: rgba(7, 8, 10, 0.97);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
    z-index: 60;
    flex-shrink: 0;
  }

  .bn-pill {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    width: 100%;
    max-width: 420px;
    background: rgba(14, 16, 18, 0.88);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 26px;
    padding: 6px;
    box-shadow:
      0 -1px 0 rgba(255,255,255,0.04) inset,
      0 4px 32px rgba(0,0,0,0.55),
      0 1px 8px rgba(0,0,0,0.4);
  }

  .bn-pill::before {
    content: '';
    position: absolute;
    top: 0; left: 20%; right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(29,185,84,0.18) 35%, rgba(29,185,84,0.35) 50%, rgba(29,185,84,0.18) 65%, transparent);
    border-radius: 1px;
    pointer-events: none;
  }

  .bn-btn {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 52px;
    border: none;
    background: transparent;
    border-radius: 20px;
    cursor: pointer;
    overflow: hidden;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.2s cubic-bezier(0.4,0,0.2,1);
    pointer-events: all;
    touch-action: manipulation;
  }
  .bn-btn:active          { transform: scale(0.93); }
  .bn-btn.bn-active       { background: rgba(29,185,84,0.11); }

  .bn-ink {
    position: absolute; top: 50%; left: 50%;
    width: 28px; height: 28px; border-radius: 50%;
    background: radial-gradient(circle, rgba(29,185,84,0.55) 0%, rgba(29,185,84,0.08) 70%, transparent 100%);
    transform: translate(-50%,-50%) scale(0);
    pointer-events: none;
    animation: bn-ink 0.55s cubic-bezier(0.22,1,0.36,1) forwards;
  }

  .bn-accent-line {
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 32px; height: 2px; border-radius: 0 0 2px 2px;
    background: linear-gradient(90deg, transparent, #1DB954, transparent);
    box-shadow: 0 0 8px rgba(29,185,84,0.7), 0 0 16px rgba(29,185,84,0.3);
    animation: bn-glowPulse 2s ease-in-out infinite;
  }

  .bn-icon-wrap {
    position: relative; z-index: 1;
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px;
    transition: color 0.2s;
  }
  .bn-btn.bn-active .bn-icon-wrap {
    animation: bn-iconBounce 0.45s cubic-bezier(0.22,1,0.36,1);
    color: #1DB954;
    filter: drop-shadow(0 0 6px rgba(29,185,84,0.65));
  }
  .bn-btn:not(.bn-active) .bn-icon-wrap { color: rgba(255,255,255,0.38); }
  .bn-icon-wrap svg { width: 18px; height: 18px; }

  .bn-label {
    position: relative; z-index: 1;
    font-family: 'DM Sans', sans-serif;
    font-size: 9px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; line-height: 1;
    transition: color 0.2s;
  }
  .bn-btn.bn-active     .bn-label { color: #1DB954; animation: bn-labelIn 0.25s ease both; }
  .bn-btn:not(.bn-active) .bn-label { color: rgba(255,255,255,0.28); }

  .bn-dot {
    position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%);
    width: 3px; height: 3px; border-radius: 50%;
    background: #1DB954; box-shadow: 0 0 6px rgba(29,185,84,0.8);
  }

  @media (min-width: 768px) { .bn-root { display: none !important; } }
`;

export default function BottomNav({ active, setActive }) {
  const [inkKeys, setInkKeys] = useState({});

  const handleTap = (label) => {
    setInkKeys(prev => ({ ...prev, [label]: (prev[label] ?? 0) + 1 }));
    setActive(label);
  };

  return (
    <>
      <style>{STYLES}</style>
      <nav className="bn-root bottom-nav-root" aria-label="Main navigation">
        <div className="bn-pill">
          {NAV_ITEMS.map((item) => {
            const Icon     = item.icon;
            const isActive = active === item.label;
            const inkKey   = inkKeys[item.label] ?? 0;
            return (
              <button
                key={item.label}
                className={`bn-btn${isActive ? ' bn-active' : ''}`}
                onClick={() => handleTap(item.label)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {inkKey > 0 && <span key={`ink-${inkKey}`} className="bn-ink" aria-hidden="true" />}
                {isActive    && <span className="bn-accent-line" aria-hidden="true" />}
                <span className="bn-icon-wrap" aria-hidden="true"><Icon /></span>
                <span className="bn-label">{item.shortLabel}</span>
                {isActive    && <span className="bn-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}