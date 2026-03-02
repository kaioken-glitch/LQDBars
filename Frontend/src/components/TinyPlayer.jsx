/**
 * TinyPlayer.jsx — Floating mini-player for the Playlists page (desktop sidebar)
 *
 * Design: "Liquid Chrome" — a glass capsule that breathes with the music.
 * Album art bleeds its color into the pill border. Animated frequency dots
 * pulse when playing. Button press has spring micro-physics. Scoped CSS only.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  FaPlay, FaPause,
  FaStepBackward, FaStepForward,
  FaVolumeMute, FaVolumeUp,
} from 'react-icons/fa';

/* ─── Scoped styles ─────────────────────────────────────────────────── */
const CSS = `
  .tp-root *, .tp-root *::before, .tp-root *::after {
    box-sizing: border-box; margin: 0; padding: 0;
  }

  /* Outer wrapper — NEVER fixed. Parent controls placement. */
  .tp-root {
    display: inline-flex;
    position: static !important;
    font-family: 'DM Sans', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* ── The pill ── */
  .tp-pill {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px 6px 6px;
    border-radius: 9999px;
    /* Layered glass */
    background:
      linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%),
      rgba(10, 12, 14, 0.82);
    backdrop-filter: blur(28px) saturate(160%);
    -webkit-backdrop-filter: blur(28px) saturate(160%);
    /* Border: static base + dynamic accent via box-shadow */
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow:
      0 0 0 1px rgba(29,185,84,0.0),        /* accent ring — animated via JS */
      0 8px 40px rgba(0,0,0,0.6),
      0 2px 8px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.08);
    cursor: default;
    /* Entrance */
    animation: tp-arrive 0.45s cubic-bezier(0.22,1,0.36,1) both;
    overflow: hidden;
  }

  @keyframes tp-arrive {
    from { opacity: 0; transform: translateY(8px) scale(0.95); }
    to   { opacity: 1; transform: translateY(0)   scale(1);    }
  }

  /* Album color bleed — a radial halo behind cover art */
  .tp-bleed {
    position: absolute;
    left: -20px; top: 50%;
    transform: translateY(-50%);
    width: 90px; height: 90px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--tp-accent, rgba(29,185,84,0.4)) 0%, transparent 70%);
    filter: blur(18px);
    pointer-events: none;
    opacity: 0.55;
    transition: background 0.8s ease;
  }

  /* ── Cover art ── */
  .tp-cover-wrap {
    position: relative;
    flex-shrink: 0;
    width: 40px; height: 40px;
    border-radius: 50%;
    overflow: hidden;
    box-shadow:
      0 0 0 1.5px rgba(255,255,255,0.12),
      0 4px 14px rgba(0,0,0,0.5);
  }

  .tp-cover {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 50%;
  }

  /* Spinning vinyl ring when playing */
  .tp-cover-wrap::after {
    content: '';
    position: absolute; inset: 0;
    border-radius: 50%;
    background: conic-gradient(
      transparent 0deg,
      rgba(29,185,84,0.15) 60deg,
      transparent 120deg,
      transparent 360deg
    );
    animation: tp-spin 4s linear infinite;
    opacity: 0;
    transition: opacity 0.3s;
  }
  .tp-root.playing .tp-cover-wrap::after { opacity: 1; }
  @keyframes tp-spin { to { transform: rotate(360deg); } }

  /* ── Song info ── */
  .tp-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: 108px;
  }

  .tp-name {
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  .tp-artist {
    font-size: 10px;
    color: rgba(255,255,255,0.42);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
    margin-top: 1px;
  }

  /* ── Waveform dots — replaces static divider ── */
  .tp-wave {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 14px;
    flex-shrink: 0;
    padding: 0 2px;
  }

  .tp-bar {
    width: 2.5px;
    background: #1DB954;
    border-radius: 2px;
    min-height: 3px;
    transform-origin: bottom;
  }

  .tp-root.playing  .tp-bar { animation: tp-wave-anim var(--d, 0.7s) ease-in-out infinite alternate; }
  .tp-root:not(.playing) .tp-bar { height: 3px !important; animation: none; }

  .tp-bar:nth-child(1) { --d: 0.55s; }
  .tp-bar:nth-child(2) { --d: 0.72s; animation-delay: 0.08s; }
  .tp-bar:nth-child(3) { --d: 0.61s; animation-delay: 0.16s; }
  .tp-bar:nth-child(4) { --d: 0.78s; animation-delay: 0.04s; }
  .tp-bar:nth-child(5) { --d: 0.50s; animation-delay: 0.20s; }

  @keyframes tp-wave-anim {
    from { height: 3px;  opacity: 0.5; }
    to   { height: 13px; opacity: 1;   }
  }

  /* ── Controls ── */
  .tp-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .tp-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px; height: 30px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.65);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    /* Spring press */
    transform: scale(1);
    transition: transform 0.12s cubic-bezier(0.34,1.56,0.64,1), color 0.15s, background 0.15s;
  }

  .tp-btn:hover  { color: #fff; background: rgba(255,255,255,0.08); }
  .tp-btn:active { transform: scale(0.82); }

  /* Play/Pause — the hero button */
  /* Play/Pause — the hero button */
.tp-play {
  width: 36px; height: 36px;
  background: rgba(255,255,255,0.12);
  color: #fff;
  box-shadow:
    0 4px 16px rgba(0,0,0,0.35),
    0 0 0 1px rgba(255,255,255,0.12);
  transition:
    transform 0.12s cubic-bezier(0.34,1.56,0.64,1),
    background 0.15s,
    box-shadow 0.2s,
    color 0.15s;
}
.tp-play:hover {
  background: #1DB954;
  color: #000;
  box-shadow: 0 6px 22px rgba(29,185,84,0.6), 0 0 0 4px rgba(29,185,84,0.15);
}
.tp-play:active {
  background: #23E065;
  color: #000;
  transform: scale(0.86);
}

/* Playing pulse on the play button */
.tp-root.playing .tp-play {
  background: rgba(255,255,255,0.15);
  animation: tp-play-pulse 2.4s ease-in-out infinite;
}
@keyframes tp-play-pulse {
  0%,100% { box-shadow: 0 4px 16px rgba(0,0,0,0.35), 0 0 0 0   rgba(255,255,255,0.1); }
  50%      { box-shadow: 0 4px 20px rgba(0,0,0,0.4),  0 0 0 5px rgba(255,255,255,0);  }
}

  /* Separator dot */
  .tp-sep {
    width: 3px; height: 3px; border-radius: 50%;
    background: rgba(255,255,255,0.15);
    flex-shrink: 0;
    margin: 0 2px;
  }

  /* Icon sizes */
  .tp-btn svg { font-size: 11px; }
  .tp-play svg { font-size: 13px; }

  /* No-song dim */
  .tp-root.nosong .tp-pill {
    opacity: 0.55;
    pointer-events: none;
  }
`;

/* ─── Waveform bars ─────────────────────────────────────────────────── */
function WaveBars() {
  return (
    <div className="tp-wave" aria-hidden="true">
      {[14, 8, 12, 6, 10].map((h, i) => (
        <div
          key={i}
          className="tp-bar"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────────────── */
export default function TinyPlayer({
  song,
  isPlaying,
  onPlayPause,
  onPrev,
  onNext,
  isMuted,
  onMuteToggle,
}) {
  const pillRef  = useRef(null);
  const canvasRef = useRef(null);

  /* Extract album accent color from cover image for the bleed effect */
  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    if (!song?.cover) {
      pill.style.setProperty('--tp-accent', 'rgba(29,185,84,0.4)');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = song.cover;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 8;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 8, 8);
        const d = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i]; g += d[i+1]; b += d[i+2]; n++;
        }
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        // Boost saturation slightly
        pill.style.setProperty('--tp-accent', `rgba(${r},${g},${b},0.6)`);
      } catch {
        pill.style.setProperty('--tp-accent', 'rgba(29,185,84,0.4)');
      }
    };
    img.onerror = () => {
      pill.style.setProperty('--tp-accent', 'rgba(29,185,84,0.4)');
    };
  }, [song?.cover]);

  const hasSong = !!song;
  const rootCls = [
    'tp-root',
    isPlaying && hasSong ? 'playing' : '',
    !hasSong ? 'nosong' : '',
  ].filter(Boolean).join(' ');

  const cover = song?.cover || 'https://placehold.co/80x80/0a0c0e/1a2a1a?text=♪';

  return (
    <>
      <style>{CSS}</style>
      <div className={rootCls}>
        <div className="tp-pill" ref={pillRef}>
          {/* Album color bleed halo */}
          <div className="tp-bleed" aria-hidden="true" />

          {/* Cover art */}
          <div className="tp-cover-wrap">
            <img
              className="tp-cover"
              src={cover}
              alt={song?.name || 'cover'}
              onError={e => { e.target.src = 'https://placehold.co/80x80/0a0c0e/1a2a1a?text=♪'; }}
            />
          </div>

          {/* Song info */}
          <div className="tp-info">
            <span className="tp-name">{song?.name || 'Nothing playing'}</span>
            <span className="tp-artist">{song?.artist || '—'}</span>
          </div>

          {/* Animated waveform — visible & animated when playing */}
          <WaveBars />

          {/* Controls */}
          <div className="tp-controls">
            <button
              className="tp-btn"
              onClick={onPrev}
              aria-label="Previous"
              title="Previous"
            >
              <FaStepBackward />
            </button>

            <button
              className="tp-btn tp-play"
              onClick={onPlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying
                ? <FaPause  style={{ fontSize: 12 }} />
                : <FaPlay   style={{ fontSize: 12, marginLeft: 1 }} />}
            </button>

            <button
              className="tp-btn"
              onClick={onNext}
              aria-label="Next"
              title="Next"
            >
              <FaStepForward />
            </button>

            <div className="tp-sep" aria-hidden="true" />

            <button
              className="tp-btn"
              onClick={onMuteToggle}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              title={isMuted ? 'Unmute' : 'Mute'}
              style={{ color: isMuted ? 'rgba(255,255,255,0.35)' : undefined }}
            >
              {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}