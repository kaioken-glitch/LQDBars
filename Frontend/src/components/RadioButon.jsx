/**
 * RadioButton.jsx
 *
 * Drop anywhere inside a PlayerProvider.
 * Shows an ∞ button that starts/stops the radio mix.
 *
 * Usage:
 *   <RadioButton />
 *
 * Sizes: 'sm' | 'md' | 'lg'
 */

import React, { useEffect, useRef } from 'react';
import { useRadio } from '../hooks/useRadio';

const CSS = `
  .rb-root {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: 'DM Sans', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Button ── */
  .rb-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    border-radius: 9999px;
    transition:
      background   0.22s cubic-bezier(0.22,1,0.36,1),
      transform    0.18s cubic-bezier(0.22,1,0.36,1),
      box-shadow   0.22s ease;
    flex-shrink: 0;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .rb-btn:active { transform: scale(0.88) !important; }
  .rb-btn:disabled { cursor: not-allowed; opacity: 0.55; }

  /* sizes */
  .rb-btn.sm { width: 30px; height: 30px; font-size: 13px; }
  .rb-btn.md { width: 38px; height: 38px; font-size: 17px; }
  .rb-btn.lg { width: 48px; height: 48px; font-size: 22px; }

  /* ── Off state ── */
  .rb-btn.off {
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.45);
    border: 1px solid rgba(255,255,255,0.1);
  }
  .rb-btn.off:hover:not(:disabled) {
    background: rgba(255,255,255,0.12);
    color: #fff;
    transform: scale(1.08);
  }

  /* ── On state ── */
  .rb-btn.on {
    background: #1DB954;
    color: #000;
    border: 1px solid transparent;
    box-shadow: 0 4px 20px rgba(29,185,84,0.45);
  }
  .rb-btn.on:hover:not(:disabled) {
    background: #23E065;
    transform: scale(1.08);
    box-shadow: 0 6px 28px rgba(29,185,84,0.55);
  }

  /* ── Loading state ── */
  .rb-btn.loading {
    background: rgba(29,185,84,0.15);
    color: #1DB954;
    border: 1px solid rgba(29,185,84,0.3);
  }

  /* ── Pulse ring — only when radio is on ── */
  .rb-pulse {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 1.5px solid rgba(29,185,84,0.5);
    animation: rbPulse 2s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes rbPulse {
    0%, 100% { transform: scale(1);    opacity: 0.6; }
    50%       { transform: scale(1.18); opacity: 0;   }
  }

  /* ── Spinner ── */
  .rb-spinner {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: #1DB954;
    animation: rbSpin 0.7s linear infinite;
    pointer-events: none;
  }
  @keyframes rbSpin { to { transform: rotate(360deg); } }

  /* ── Label (optional, shows next to button) ── */
  .rb-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.45);
    white-space: nowrap;
    transition: color 0.2s;
    letter-spacing: 0.02em;
  }
  .rb-label.on      { color: #1DB954; }
  .rb-label.loading { color: rgba(29,185,84,0.6); }

  /* ── Error tooltip ── */
  .rb-error {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255,68,102,0.15);
    border: 1px solid rgba(255,68,102,0.3);
    color: #FCA5A5;
    font-size: 11px;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: 8px;
    white-space: nowrap;
    pointer-events: none;
    animation: rbErrIn 0.2s ease both;
    z-index: 10;
  }
  @keyframes rbErrIn {
    from { opacity: 0; transform: translateX(-50%) translateY(4px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0);   }
  }

  /* ── Infinity symbol styling ── */
  .rb-icon {
    line-height: 1;
    font-style: normal;
    letter-spacing: -0.02em;
  }
`;

export default function RadioButton({ size = 'md', showLabel = false }) {
  const { radioMode, radioLoading, radioError, startRadio, stopRadio } = useRadio();
  const errorTimer = useRef(null);

  // Auto-clear error after 3s
  useEffect(() => {
    if (!radioError) return;
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => {}, 3000);
    return () => clearTimeout(errorTimer.current);
  }, [radioError]);

  const state    = radioLoading ? 'loading' : radioMode ? 'on' : 'off';
  const handleClick = () => {
    if (radioLoading) return;
    if (radioMode) stopRadio();
    else startRadio();
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="rb-root">
        <button
          className={`rb-btn ${size} ${state}`}
          onClick={handleClick}
          disabled={radioLoading}
          title={radioMode ? 'Stop radio' : 'Start radio mix'}
          aria-label={radioMode ? 'Stop radio mix' : 'Start radio mix based on current song'}
          aria-pressed={radioMode}
        >
          {/* Pulse ring — only when active */}
          {radioMode && !radioLoading && <span className="rb-pulse" aria-hidden="true" />}

          {/* Spinner overlay — only when loading */}
          {radioLoading && <span className="rb-spinner" aria-hidden="true" />}

          {/* Icon — ∞ symbol */}
          <span className="rb-icon" aria-hidden="true">
            {radioLoading ? '∞' : '∞'}
          </span>

          {/* Error tooltip */}
          {radioError && (
            <span className="rb-error" role="alert">{radioError}</span>
          )}
        </button>

        {showLabel && (
          <span className={`rb-label ${state}`}>
            {radioLoading ? 'Building mix…' : radioMode ? 'Radio on' : 'Radio'}
          </span>
        )}
      </div>
    </>
  );
}