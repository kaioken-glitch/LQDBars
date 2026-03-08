/**
 * LyricsPanel.jsx
 *
 * Apple Music–style synced lyrics.
 *
 * HOW THE SCROLL WORKS (no scrollTo, no scrollbar):
 *   The container is overflow:hidden with a fixed height.
 *   All lines live in a single div. We measure each line's offsetTop
 *   and apply a CSS transform: translateY() to the list so the active
 *   line is always vertically centred in the container.
 *   Transition is a CSS spring (cubic-bezier) so it feels physical.
 *
 * VISUAL HIERARCHY (Apple Music model):
 *   active    — full white, scale(1),    full opacity, glow
 *   ±1 line   — 65% opacity, scale(0.97)
 *   ±2 lines  — 40% opacity, scale(0.94)
 *   ±3+ lines — 22% opacity, scale(0.91), blur(0.4px)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useLyrics  } from '../hooks/useLyrics';

/* ─── distance → visual weight ────────────────────────────────────────────── */
function lineStyle(dist, accent) {
  if (dist === 0) return {
    opacity: 1,
    transform: 'scale(1.04)',
    color: '#ffffff',
    filter: 'none',
    textShadow: `0 0 40px ${accent}88, 0 0 80px ${accent}33`,
    fontWeight: 800,
    transition: 'all 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
  };
  const abs = Math.abs(dist);
  const opacity  = abs === 1 ? 0.62 : abs === 2 ? 0.38 : 0.2;
  const scale    = abs === 1 ? 0.975 : abs === 2 ? 0.955 : 0.935;
  const blur     = abs >= 3 ? 0.5 : 0;
  return {
    opacity,
    transform: `scale(${scale})`,
    color: '#ffffff',
    filter: blur ? `blur(${blur}px)` : 'none',
    textShadow: 'none',
    fontWeight: 700,
    transition: 'all 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
  };
}

/* ─── Shimmer skeletons ───────────────────────────────────────────────────── */
const WIDTHS = ['68%','52%','78%','44%','72%','58%','82%','48%','65%','74%'];
function Shimmer() {
  return (
    <div className="lp-shimmer-wrap">
      {WIDTHS.map((w, i) => (
        <div key={i} className="lp-shimmer-line" style={{ width: w, animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const CSS = `
  .lp-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    position: relative;
    background: transparent;
    font-family: 'Syne', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Viewport: clips the list, everything happens inside here ── */
  .lp-viewport {
    flex: 1;
    overflow: hidden;
    position: relative;
    cursor: default;
  }

  /* ── The list itself — transform moves it, never scrolls ── */
  .lp-list {
    position: absolute;
    top: 0; left: 0; right: 0;
    padding: 0 20px;
    will-change: transform;
    /* Spring transition on the translate — this IS the Apple Music scroll */
    transition: transform 0.52s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* ── Spacer at top so first line can reach center ── */
  .lp-spacer { display: block; }

  /* ── Individual line ── */
  .lp-line {
    display: block;
    font-size: 20px;
    line-height: 1.5;
    padding: 6px 0;
    cursor: pointer;
    transform-origin: left center;
    user-select: none;
    border-radius: 6px;
    /* per-line transition handled by inline style */
  }
  .lp-line:hover { opacity: 0.85 !important; }

  /* ── Plain unsynced lyrics ── */
  .lp-plain {
    flex: 1;
    overflow-y: auto;
    padding: 24px 20px 48px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    line-height: 1.85;
    color: rgba(255,255,255,0.5);
    white-space: pre-wrap;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .lp-plain::-webkit-scrollbar { display: none; }

  /* ── Top & bottom fade masks ── */
  .lp-mask-top, .lp-mask-bottom {
    position: absolute;
    left: 0; right: 0;
    height: 80px;
    pointer-events: none;
    z-index: 3;
  }
  .lp-mask-top {
    top: 0;
    background: linear-gradient(to bottom,
      var(--lp-bg, rgba(8,8,10,1)) 0%,
      transparent 100%
    );
  }
  .lp-mask-bottom {
    bottom: 0;
    background: linear-gradient(to top,
      var(--lp-bg, rgba(8,8,10,1)) 0%,
      transparent 100%
    );
  }

  /* ── States: loading / not found / error / idle ── */
  .lp-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 28px;
    color: rgba(255,255,255,0.25);
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    text-align: center;
  }
  .lp-state-title {
    font-family: 'Syne', sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: rgba(255,255,255,0.35);
  }
  .lp-state-sub {
    font-size: 12px;
    color: rgba(255,255,255,0.22);
    font-style: italic;
  }

  /* ── Shimmer loading skeleton ── */
  .lp-shimmer-wrap { padding: 24px 20px; }
  .lp-shimmer-line {
    height: 20px;
    border-radius: 6px;
    margin-bottom: 20px;
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0.04) 25%,
      rgba(255,255,255,0.10) 50%,
      rgba(255,255,255,0.04) 75%
    );
    background-size: 200% 100%;
    animation: lpShimmer 1.6s ease-in-out infinite;
  }
  @keyframes lpShimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Clickable seek hint on hover ── */
  .lp-line-inner {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 5px;
    transition: background 0.15s;
  }
  .lp-line:hover .lp-line-inner {
    background: rgba(255,255,255,0.06);
  }
`;

/* ─── State icons ─────────────────────────────────────────────────────────── */
const IconMusic = () => (
  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 19V6l12-3v13"/>
    <circle cx="6" cy="19" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
);
const IconWarn = () => (
  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

/* ─── Main component ──────────────────────────────────────────────────────── */
export default function LyricsPanel({ accentColor, bg }) {
  const { currentSong, currentTime, seekTo } = usePlayer();
  const { lines, plainLyrics, activeLine, status } = useLyrics(currentSong, currentTime);

  const viewportRef = useRef(null);
  const listRef     = useRef(null);
  const lineRefs    = useRef([]);
  const [translateY, setTranslateY] = useState(0);
  const [viewportH,  setViewportH]  = useState(0);

  const accent  = accentColor || '#1DB954';
  const bgColor = bg || 'rgba(8,8,10,1)';

  /* Measure viewport height — update on resize */
  useEffect(() => {
    if (!viewportRef.current) return;
    const ro = new ResizeObserver(entries => {
      setViewportH(entries[0].contentRect.height);
    });
    ro.observe(viewportRef.current);
    setViewportH(viewportRef.current.clientHeight);
    return () => ro.disconnect();
  }, []);

  /* Reset line refs array length when lines change */
  useEffect(() => {
    lineRefs.current = lineRefs.current.slice(0, lines.length);
  }, [lines.length]);

  /*
    THE CORE: compute translateY so active line sits at vertical center.
    We measure the line's offsetTop from the top of .lp-list, then
    subtract (viewportH / 2 - lineHeight / 2) so it lands in the middle.
    The CSS transition on .lp-list does the spring animation.
  */
  useEffect(() => {
    if (activeLine < 0 || !lineRefs.current[activeLine] || viewportH === 0) return;

    const el       = lineRefs.current[activeLine];
    const lineTop  = el.offsetTop;
    const lineH    = el.offsetHeight;
    const target   = lineTop - viewportH / 2 + lineH / 2;

    setTranslateY(-target);
  }, [activeLine, viewportH]);

  const handleLineClick = useCallback((time) => {
    seekTo?.(time);
  }, [seekTo]);

  /* Spacer height = half the viewport so first line can center */
  const spacerH = viewportH > 0 ? viewportH / 2 : 120;

  return (
    <>
      <style>{CSS}</style>
      <div className="lp-root" style={{ '--lp-bg': bgColor }}>

        {/* ── Loading ── */}
        {status === 'loading' && <Shimmer />}

        {/* ── Synced lyrics ── */}
        {status === 'found' && (
          <>
            <div className="lp-mask-top"    aria-hidden="true" />
            <div className="lp-mask-bottom" aria-hidden="true" />

            <div className="lp-viewport" ref={viewportRef}>
              <div
                className="lp-list"
                ref={listRef}
                style={{ transform: `translateY(${translateY}px)` }}
              >
                {/* Top spacer — lets first line reach center */}
                <span className="lp-spacer" style={{ height: spacerH, display: 'block' }} aria-hidden="true" />

                {lines.map((line, i) => {
                  const dist = i - activeLine;
                  return (
                    <p
                      key={i}
                      ref={el => { lineRefs.current[i] = el; }}
                      className="lp-line"
                      style={lineStyle(dist, accent)}
                      onClick={() => handleLineClick(line.time)}
                      aria-current={dist === 0 ? 'true' : undefined}
                    >
                      <span className="lp-line-inner">{line.text}</span>
                    </p>
                  );
                })}

                {/* Bottom spacer — lets last line reach center */}
                <span className="lp-spacer" style={{ height: spacerH, display: 'block' }} aria-hidden="true" />
              </div>
            </div>
          </>
        )}

        {/* ── Plain (unsynced) lyrics ── */}
        {status === 'plain' && (
          <div className="lp-plain">{plainLyrics}</div>
        )}

        {/* ── Not found ── */}
        {status === 'not_found' && (
          <div className="lp-state">
            <IconMusic />
            <span className="lp-state-title">No lyrics found</span>
            <span className="lp-state-sub">{currentSong?.name}</span>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div className="lp-state">
            <IconWarn />
            <span className="lp-state-title">Couldn't load lyrics</span>
            <span className="lp-state-sub">Check your connection and try again</span>
          </div>
        )}

        {/* ── Idle ── */}
        {status === 'idle' && (
          <div className="lp-state">
            <IconMusic />
            <span className="lp-state-title">Play a song</span>
            <span className="lp-state-sub">Lyrics will appear here</span>
          </div>
        )}

      </div>
    </>
  );
}