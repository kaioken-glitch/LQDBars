import React, { useState, useEffect, useCallback } from 'react';
import {
  FaUser, FaCamera, FaSave, FaDownload, FaWifi, FaSlidersH,
  FaBell, FaMoon, FaShieldAlt, FaCheckCircle, FaExclamationCircle,
  FaClipboard, FaFileImport, FaRedoAlt, FaTrash, FaEnvelope,
  FaPhone, FaMapMarkerAlt, FaChartLine, FaSignOutAlt, FaTimes,
} from 'react-icons/fa';
import { VERSION, BUILD_DATE } from '../version';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

/* ─── Changelog data ────────────────────────────────────────────── */
const CHANGELOG = [
  {
    version: VERSION,
    date: BUILD_DATE,
    tag: 'Latest',
    changes: [
      'Pixelify Sans lyrics — bold active line with green fill sweep animation',
      'Mobile player: full-width art card expands to show lyrics side-by-side',
      'Lyrics overlay: blurred cover art + dark panel animates in on toggle',
      'Active lyric fill colour is now always green (never accent colour)',
      'Darker mobile expanded player background',
      'Playlist persistence — import handlers now read fresh from localStorage',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-03-04',
    tag: 'Stable',
    changes: [
      'YouTube streaming via yt-dlp backend — instant playback, no downloads',
      'HomeOnline localStorage cache — preserves daily API quota across reloads',
      'LRCLIB synced lyrics with karaoke-style left-to-right green fill sweep',
      'Playlists: single source of truth via usePlaylists hook',
      'Settings overflow fix — scroll container properly bounded',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-02-28',
    tag: null,
    changes: [
      'YouTube playlist import via Piped API (no API key required)',
      'Local file import to playlists',
      'Queue management and shuffle/repeat controls',
      'Mobile mini-player with expand to full-screen',
    ],
  },
];

/* ─── Update popup ──────────────────────────────────────────────── */
function UpdatePopup({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="sup-overlay" onClick={onClose}>
      <div className="sup-box" onClick={e => e.stopPropagation()}>
        <div className="sup-header">
          <div>
            <div className="sup-eyebrow">Release Notes</div>
            <div className="sup-title">What&apos;s New</div>
          </div>
          <button className="sup-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="sup-body">
          {CHANGELOG.map((entry, ei) => (
            <div key={ei} className="sup-entry">
              <div className="sup-entry-header">
                <span className="sup-version">v{entry.version}</span>
                {entry.tag && (
                  <span className={`sup-tag ${entry.tag === 'Latest' ? 'latest' : 'stable'}`}>
                    {entry.tag}
                  </span>
                )}
                <span className="sup-date">{entry.date}</span>
              </div>
              <ul className="sup-list">
                {entry.changes.map((c, ci) => (
                  <li key={ci} className="sup-item">
                    <span className="sup-bullet" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── scoped CSS ────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

.set-root {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  --s-green:        #1DB954;
  --s-green-bright: #23E065;
  --s-green-dim:    rgba(29,185,84,0.12);
  --s-red:          #FF4466;
  --s-amber:        #F59E0B;
  --s-purple:       #A78BFA;
  --s-blue:         #60A5FA;
  --s-t1:           #FFFFFF;
  --s-t2:           rgba(255,255,255,0.55);
  --s-t3:           rgba(255,255,255,0.28);
  --s-s1:           rgba(255,255,255,0.04);
  --s-s2:           rgba(255,255,255,0.07);
  --s-sh:           rgba(255,255,255,0.09);
  --s-b1:           rgba(255,255,255,0.07);
  --s-b2:           rgba(255,255,255,0.12);
  --s-ease:         cubic-bezier(0.4,0,0.2,1);
  --s-spring:       cubic-bezier(0.22,1,0.36,1);
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
}
.set-root *, .set-root *::before, .set-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.set-shell { width: 100%; flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.set-ambient { position: absolute; top: 0; left: 0; right: 0; height: 260px; background: linear-gradient(180deg, rgba(29,185,84,0.07) 0%, transparent 100%); pointer-events: none; z-index: 0; }
.set-scroll { flex: 1; overflow-y: auto; position: relative; z-index: 1; padding: 32px 28px 40px; }
.set-scroll::-webkit-scrollbar { width: 4px; }
.set-scroll::-webkit-scrollbar-track { background: transparent; }
.set-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
.set-inner { max-width: 720px; margin: 0 auto; }

/* header */
.set-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
.set-title { font-family: 'Syne', sans-serif; font-size: clamp(32px,5vw,48px); font-weight: 800; letter-spacing: -0.04em; color: var(--s-t1); line-height: 1; }
.set-title span { background: linear-gradient(135deg, #fff 0%, var(--s-green-bright) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.set-version-btn { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 10px; background: var(--s-s1); border: 1px solid var(--s-b1); cursor: pointer; transition: background 0.15s, border-color 0.15s; color: var(--s-t3); font-size: 11px; font-family: 'DM Sans', sans-serif; }
.set-version-btn:hover { background: var(--s-s2); border-color: rgba(29,185,84,0.3); color: var(--s-green); }
.set-version-dot { opacity: 0.4; }

/* tabs */
.set-tabs { display: flex; gap: 2px; background: var(--s-s1); border: 1px solid var(--s-b1); border-radius: 14px; padding: 4px; margin-bottom: 28px; max-width: 320px; }
.set-tab { flex: 1; padding: 10px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s var(--s-ease); color: var(--s-t3); background: none; border: none; white-space: nowrap; }
.set-tab:hover { color: var(--s-t2); }
.set-tab.active { background: #fff; color: #000; box-shadow: 0 2px 12px rgba(0,0,0,0.3); }

/* card */
.set-card { background: var(--s-s1); border: 1px solid var(--s-b1); border-radius: 20px; overflow: hidden; margin-bottom: 14px; }
.set-card-header { display: flex; align-items: center; gap: 10px; padding: 14px 20px 12px; border-bottom: 1px solid var(--s-b1); }
.set-card-icon { font-size: 14px; }
.set-card-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--s-t1); }
.set-card-body { padding: 20px; display: flex; flex-direction: column; gap: 18px; }
.set-card.emerald .set-card-icon { color: var(--s-green); }
.set-card.purple  .set-card-icon { color: var(--s-purple); }
.set-card.blue    .set-card-icon { color: var(--s-blue); }
.set-card.red     .set-card-icon { color: var(--s-red); }
.set-card.amber   .set-card-icon { color: var(--s-amber); }

/* profile hero */
.set-profile-hero { background: var(--s-s1); border: 1px solid var(--s-b1); border-radius: 20px; padding: 24px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 20px; }
@media (min-width: 520px) { .set-profile-hero { flex-direction: row; align-items: center; } }
.set-avatar-wrap { position: relative; flex-shrink: 0; width: 80px; height: 80px; }
.set-avatar { width: 80px; height: 80px; border-radius: 18px; overflow: hidden; background: linear-gradient(135deg, rgba(29,185,84,0.2), rgba(35,224,101,0.1)); border: 2px solid var(--s-b2); box-shadow: 0 8px 30px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; }
.set-avatar img { width: 100%; height: 100%; object-fit: cover; }
.set-avatar-placeholder { color: rgba(255,255,255,0.2); font-size: 28px; }
.set-avatar-upload { position: absolute; bottom: -4px; right: -4px; width: 28px; height: 28px; border-radius: 9px; background: var(--s-green); display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(29,185,84,0.5); transition: transform 0.15s var(--s-spring), background 0.15s; }
.set-avatar-upload:hover { transform: scale(1.12); background: var(--s-green-bright); }
.set-avatar-upload input { display: none; }
.set-profile-info { flex: 1; min-width: 0; }
.set-profile-name { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -0.03em; color: var(--s-t1); margin-bottom: 3px; }
.set-profile-email { font-size: 13px; color: var(--s-t2); margin-bottom: 10px; }
.set-profile-badges { display: flex; flex-wrap: wrap; gap: 6px; }
.set-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; border: 1px solid; }
.set-badge-premium { background: rgba(29,185,84,0.12); color: var(--s-green); border-color: rgba(29,185,84,0.25); }
.set-badge-member  { background: var(--s-s1); color: var(--s-t3); border-color: var(--s-b1); }
.set-profile-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; flex-shrink: 0; }
.set-save-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s var(--s-spring); flex-shrink: 0; }
.set-save-btn.unsaved { background: var(--s-green); color: #000; border: none; box-shadow: 0 4px 18px rgba(29,185,84,0.35); }
.set-save-btn.unsaved:hover { background: var(--s-green-bright); transform: translateY(-1px); }
.set-save-btn.unsaved:active { transform: scale(0.96); }
.set-save-btn.saved { background: rgba(29,185,84,0.12); color: var(--s-green); border: 1px solid rgba(29,185,84,0.25); }
.set-signout-btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 10px; cursor: pointer; background: rgba(255,68,102,0.08); border: 1px solid rgba(255,68,102,0.2); color: var(--s-red); font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; transition: background 0.15s; }
.set-signout-btn:hover { background: rgba(255,68,102,0.16); }
.set-signout-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* form */
.set-form-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
@media (min-width: 520px) { .set-form-grid { grid-template-columns: 1fr 1fr; } .set-form-grid .set-span-2 { grid-column: span 2; } }
.set-field-label { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--s-t3); margin-bottom: 7px; }
.set-input { width: 100%; padding: 11px 14px; background: var(--s-s2); border: 1px solid var(--s-b1); border-radius: 12px; color: var(--s-t1); font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; transition: border-color 0.15s, background 0.15s; }
.set-input:focus { border-color: rgba(29,185,84,0.4); background: var(--s-sh); }
.set-input::placeholder { color: var(--s-t3); }
.set-input[readonly] { opacity: 0.5; cursor: not-allowed; }
.set-textarea { resize: none; }

/* toggle */
.set-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.set-toggle-text { flex: 1; min-width: 0; }
.set-toggle-label { font-size: 14px; font-weight: 500; color: var(--s-t1); margin-bottom: 2px; }
.set-toggle-desc { font-size: 12px; color: var(--s-t3); }
.set-switch { position: relative; width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer; flex-shrink: 0; transition: background 0.25s; }
.set-switch.on  { background: var(--s-green); box-shadow: 0 0 12px rgba(29,185,84,0.35); }
.set-switch.off { background: rgba(255,255,255,0.12); }
.set-switch-thumb { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.35); transition: transform 0.25s var(--s-spring); }
.set-switch.on .set-switch-thumb { transform: translateX(20px); }

/* slider */
.set-slider-row { display: flex; flex-direction: column; gap: 10px; }
.set-slider-top { display: flex; align-items: center; justify-content: space-between; }
.set-slider-meta { display: flex; flex-direction: column; gap: 2px; }
.set-slider-label { font-size: 14px; font-weight: 500; color: var(--s-t1); }
.set-slider-desc { font-size: 12px; color: var(--s-t3); }
.set-slider-value { font-size: 13px; font-weight: 700; color: var(--s-green); font-variant-numeric: tabular-nums; font-family: 'Syne', sans-serif; }
.set-slider-track { position: relative; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; }
.set-slider-fill { position: absolute; left: 0; top: 0; height: 100%; background: linear-gradient(to right, var(--s-green), var(--s-green-bright)); border-radius: inherit; pointer-events: none; }
.set-slider-thumb-dot { position: absolute; top: 50%; transform: translate(-50%,-50%); width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 2px solid var(--s-green); box-shadow: 0 2px 8px rgba(0,0,0,0.35); pointer-events: none; }
.set-slider-input { position: absolute; inset: -8px 0; width: 100%; opacity: 0; cursor: pointer; height: calc(100% + 16px); }

/* select */
.set-select-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.set-select { background: var(--s-s2); border: 1px solid var(--s-b1); color: var(--s-t1); font-family: 'DM Sans', sans-serif; font-size: 13px; padding: 8px 32px 8px 12px; border-radius: 10px; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; min-width: 110px; }
.set-select:focus { border-color: rgba(29,185,84,0.4); }
.set-select option { background: #111315; }

/* number input */
.set-num-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.set-num-controls { display: flex; align-items: center; gap: 8px; }
.set-num-btn { width: 28px; height: 28px; border-radius: 8px; background: var(--s-s2); border: 1px solid var(--s-b1); color: var(--s-t1); font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; }
.set-num-btn:hover { background: var(--s-sh); }
.set-num-val { font-size: 14px; font-weight: 600; color: var(--s-t1); font-variant-numeric: tabular-nums; min-width: 28px; text-align: center; }

/* info row */
.set-info-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: rgba(255,255,255,0.025); border-radius: 12px; border: 1px solid var(--s-b1); }
.set-info-label { font-size: 14px; font-weight: 500; color: var(--s-t1); margin-bottom: 2px; }
.set-info-sub { font-size: 12px; color: var(--s-t3); }
.set-info-val { font-size: 13px; font-family: 'Syne', sans-serif; color: var(--s-t2); }
.set-online-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.set-online-dot.on  { background: var(--s-green); box-shadow: 0 0 8px rgba(29,185,84,0.6); animation: setOnlinePulse 2s ease-in-out infinite; }
.set-online-dot.off { background: var(--s-red); }
@keyframes setOnlinePulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
.set-status-text { font-size: 13px; font-weight: 600; }
.set-status-text.on  { color: var(--s-green); }
.set-status-text.off { color: var(--s-red); }
.set-clear-btn { padding: 6px 12px; border-radius: 8px; cursor: pointer; background: rgba(255,68,102,0.08); border: 1px solid rgba(255,68,102,0.2); color: var(--s-red); font-size: 12px; font-weight: 600; transition: background 0.15s; }
.set-clear-btn:hover { background: rgba(255,68,102,0.16); }

/* action buttons */
.set-actions-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.set-action-btn { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 12px 8px; border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; transition: background 0.15s, transform 0.12s var(--s-spring); border: 1px solid; }
.set-action-btn:hover  { transform: translateY(-1px); }
.set-action-btn:active { transform: scale(0.96); }
.set-action-default { background: var(--s-s1); border-color: var(--s-b1); color: var(--s-t2); }
.set-action-default:hover { background: var(--s-s2); color: var(--s-t1); }
.set-action-danger  { background: rgba(255,68,102,0.08); border-color: rgba(255,68,102,0.2); color: var(--s-red); }
.set-action-danger:hover { background: rgba(255,68,102,0.15); }
.set-action-note { font-size: 12px; color: var(--s-t3); line-height: 1.5; margin-bottom: 6px; }

/* toast */
.set-toast { position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); z-index: 200; padding: 11px 20px; border-radius: 9999px; font-size: 13px; font-weight: 600; white-space: nowrap; border: 1px solid; backdrop-filter: blur(20px); animation: setToastIn 0.25s var(--s-spring) both; box-shadow: 0 8px 32px rgba(0,0,0,0.45); display: flex; align-items: center; gap: 8px; }
.set-toast.success { background: rgba(29,185,84,0.15); border-color: rgba(29,185,84,0.3); color: #6EE7A0; }
.set-toast.error   { background: rgba(255,68,102,0.12); border-color: rgba(255,68,102,0.25); color: #FCA5A5; }
@keyframes setToastIn { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

/* ─── Update popup ─── */
.sup-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,0.72); backdrop-filter: blur(18px);
  display: flex; align-items: center; justify-content: center;
  animation: supFadeIn 0.22s ease both;
}
@keyframes supFadeIn { from{opacity:0} to{opacity:1} }
.sup-box {
  width: min(480px, 94vw);
  background: #0C0E10;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 40px 100px rgba(0,0,0,0.85);
  animation: supScaleIn 0.3s cubic-bezier(0.22,1,0.36,1) both;
  max-height: 85vh;
  display: flex; flex-direction: column;
}
@keyframes supScaleIn { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:none} }
.sup-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 24px 24px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: linear-gradient(135deg, rgba(29,185,84,0.09), transparent);
  flex-shrink: 0;
}
.sup-eyebrow {
  font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: #1DB954; margin-bottom: 4px;
}
.sup-title {
  font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800;
  letter-spacing: -0.03em; color: #fff;
}
.sup-close {
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.5); font-size: 12px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.15s, color 0.15s; flex-shrink: 0;
}
.sup-close:hover { background: rgba(255,255,255,0.12); color: #fff; }
.sup-body {
  overflow-y: auto; padding: 20px 24px 28px;
  display: flex; flex-direction: column; gap: 24px;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent;
}
.sup-body::-webkit-scrollbar { width: 4px; }
.sup-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 3px; }
.sup-entry { border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 20px; }
.sup-entry:last-child { border-bottom: none; padding-bottom: 0; }
.sup-entry-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.sup-version { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
.sup-tag { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 8px; border-radius: 9999px; }
.sup-tag.latest { background: rgba(29,185,84,0.18); color: #1DB954; border: 1px solid rgba(29,185,84,0.3); }
.sup-tag.stable { background: rgba(96,165,250,0.12); color: #60A5FA; border: 1px solid rgba(96,165,250,0.25); }
.sup-date { font-size: 12px; color: rgba(255,255,255,0.28); margin-left: auto; }
.sup-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.sup-item { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.55; }
.sup-bullet { width: 5px; height: 5px; border-radius: 50%; background: #1DB954; flex-shrink: 0; margin-top: 6px; }
`;

/* ─── primitives ────────────────────────────────────────────────── */

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="set-toggle-row">
      {(label || description) && (
        <div className="set-toggle-text">
          {label && <p className="set-toggle-label">{label}</p>}
          {description && <p className="set-toggle-desc">{description}</p>}
        </div>
      )}
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`set-switch ${checked ? 'on' : 'off'}`}>
        <div className="set-switch-thumb" />
      </button>
    </div>
  );
}

function Slider({ value, onChange, min = 0, max = 100, label, unit = '', description }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="set-slider-row">
      <div className="set-slider-top">
        <div className="set-slider-meta">
          <span className="set-slider-label">{label}</span>
          {description && <span className="set-slider-desc">{description}</span>}
        </div>
        <span className="set-slider-value">{value}{unit}</span>
      </div>
      <div className="set-slider-track">
        <div className="set-slider-fill" style={{ width: `${pct}%` }} />
        <div className="set-slider-thumb-dot" style={{ left: `${pct}%` }} />
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="set-slider-input" />
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options, description }) {
  return (
    <div className="set-select-row">
      <div className="set-toggle-text">
        <p className="set-toggle-label">{label}</p>
        {description && <p className="set-toggle-desc">{description}</p>}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} className="set-select">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, description }) {
  return (
    <div className="set-num-row">
      <div className="set-toggle-text">
        <p className="set-toggle-label">{label}</p>
        {description && <p className="set-toggle-desc">{description}</p>}
      </div>
      <div className="set-num-controls">
        <button className="set-num-btn" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <span className="set-num-val">{value}</span>
        <button className="set-num-btn" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

function Card({ title, icon, accent = 'emerald', children, note }) {
  return (
    <div className={`set-card ${accent}`}>
      <div className="set-card-header">
        <span className="set-card-icon">{icon}</span>
        <h3 className="set-card-title">{title}</h3>
      </div>
      <div className="set-card-body">
        {note && <p className="set-action-note">{note}</p>}
        {children}
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`set-toast ${type}`}>
      {type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}
      {message}
    </div>
  );
}

/* ─── main ──────────────────────────────────────────────────────── */
export default function Settings() {
  const [tab,         setTab]         = useState('profile');
  const [toast,       setToast]       = useState(null);
  const [saved,       setSaved]       = useState(false);
  const [showUpdate,  setShowUpdate]  = useState(false);
  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  /* Listen for the update popup event dispatched by the version button */
  useEffect(() => {
    const handler = () => setShowUpdate(true);
    window.addEventListener('open-update-popup', handler);
    return () => window.removeEventListener('open-update-popup', handler);
  }, []);

  /* ── Auth ── */
  const { user, profile: authProfile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  /* profile */
  const [name,     setName]     = useState(() => localStorage.getItem('lb:profileName')     || 'Music Lover');
  const [email,    setEmail]    = useState(() => localStorage.getItem('lb:profileEmail')    || '');
  const [phone,    setPhone]    = useState(() => localStorage.getItem('lb:profilePhone')    || '');
  const [location, setLocation] = useState(() => localStorage.getItem('lb:profileLocation') || '');
  const [bio,      setBio]      = useState(() => localStorage.getItem('lb:profileBio')      || '');
  const [avatar,   setAvatar]   = useState(() => localStorage.getItem('lb:profileAvatar')   || '');

  useEffect(() => {
    if (!authProfile) return;
    if (authProfile.display_name) setName(authProfile.display_name);
    if (authProfile.avatar_url)   setAvatar(authProfile.avatar_url);
    if (authProfile.phone)        setPhone(authProfile.phone || '');
    if (authProfile.location)     setLocation(authProfile.location || '');
    if (authProfile.bio)          setBio(authProfile.bio || '');
  }, [authProfile]);

  useEffect(() => { if (user?.email) setEmail(user.email); }, [user]);

  /* playback */
  const [crossfade,       setCrossfade]       = useState(() => Number(localStorage.getItem('lb:crossfade') || 0));
  const [gapless,         setGapless]         = useState(() => localStorage.getItem('lb:gapless')    === 'true');
  const [equalizer,       setEqualizer]       = useState(() => localStorage.getItem('lb:equalizer')  === 'true');
  const [eqPreset,        setEqPreset]        = useState(() => localStorage.getItem('lb:eqPreset')   || 'flat');

  /* downloads */
  const [autoDownload,    setAutoDownload]    = useState(() => localStorage.getItem('lb:autoDownload')    === 'true');
  const [downloadQuality, setDownloadQuality] = useState(() => localStorage.getItem('lb:downloadQuality') || 'high');
  const [onlyWifi,        setOnlyWifi]        = useState(() => localStorage.getItem('lb:onlyWifi')        === 'true');
  const [maxDownloads,    setMaxDownloads]    = useState(() => Number(localStorage.getItem('lb:maxConcurrentDownloads') || 3));

  /* general */
  const [darkMode,        setDarkMode]        = useState(() => localStorage.getItem('lb:darkMode')        === 'true');
  const [notifications,   setNotifications]   = useState(() => localStorage.getItem('lb:notifications')   === 'true');
  const [notifVolume,     setNotifVolume]     = useState(() => Number(localStorage.getItem('lb:notificationVolume') || 80));

  /* privacy */
  const [analytics,       setAnalytics]       = useState(() => localStorage.getItem('lb:privacyAnalytics')   === 'true');
  const [remoteControl,   setRemoteControl]   = useState(() => localStorage.getItem('lb:allowRemoteControl') === 'true');

  /* storage */
  const [maxCache,        setMaxCache]        = useState(() => Number(localStorage.getItem('lb:maxCacheMB') || 200));
  const [cacheSize]       = useState('12.4 MB');
  const [isOnline,        setIsOnline]        = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  /* persist */
  useEffect(() => { localStorage.setItem('lb:darkMode', darkMode); if (darkMode) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }, [darkMode]);
  useEffect(() => { localStorage.setItem('lb:notifications',          notifications);    }, [notifications]);
  useEffect(() => { localStorage.setItem('lb:autoDownload',           autoDownload);     }, [autoDownload]);
  useEffect(() => { localStorage.setItem('lb:onlyWifi',               onlyWifi);         }, [onlyWifi]);
  useEffect(() => { localStorage.setItem('lb:crossfade',              String(crossfade));}, [crossfade]);
  useEffect(() => { localStorage.setItem('lb:gapless',                gapless);          }, [gapless]);
  useEffect(() => { localStorage.setItem('lb:equalizer',              equalizer);        }, [equalizer]);
  useEffect(() => { localStorage.setItem('lb:eqPreset',               eqPreset);         }, [eqPreset]);
  useEffect(() => { localStorage.setItem('lb:maxConcurrentDownloads', String(maxDownloads)); }, [maxDownloads]);
  useEffect(() => { localStorage.setItem('lb:notificationVolume',     String(notifVolume)); }, [notifVolume]);
  useEffect(() => { localStorage.setItem('lb:privacyAnalytics',       analytics);        }, [analytics]);
  useEffect(() => { localStorage.setItem('lb:allowRemoteControl',     remoteControl);    }, [remoteControl]);
  useEffect(() => { localStorage.setItem('lb:maxCacheMB',             String(maxCache)); }, [maxCache]);
  useEffect(() => { localStorage.setItem('lb:downloadQuality',        downloadQuality);  }, [downloadQuality]);

  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* ── Save profile ── */
  const saveProfile = async () => {
    localStorage.setItem('lb:profileName',     name);
    localStorage.setItem('lb:profileEmail',    email);
    localStorage.setItem('lb:profilePhone',    phone);
    localStorage.setItem('lb:profileLocation', location);
    localStorage.setItem('lb:profileBio',      bio);
    localStorage.setItem('lb:profileAvatar',   avatar);

    if (user) {
      const { error } = await supabase.from('profiles').upsert({
        id:           user.id,
        display_name: name,
        avatar_url:   avatar,
        phone,
        location,
        bio,
        updated_at:   new Date().toISOString(),
      });
      if (error) { showToast('Save failed: ' + error.message, 'error'); return; }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    showToast('Profile saved!');
  };

  /* ── Avatar upload ── */
  const handleAvatar = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (user) {
      const ext  = f.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, f, { upsert: true });
      if (upErr) {
        const r = new FileReader(); r.onload = ev => setAvatar(ev.target.result); r.readAsDataURL(f);
        showToast('Upload failed — using local preview', 'error');
        return;
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatar(data.publicUrl);
      showToast('Avatar updated!');
    } else {
      const r = new FileReader(); r.onload = ev => setAvatar(ev.target.result); r.readAsDataURL(f);
    }
  };

  /* ── Sign out ── */
  const handleSignOut = async () => {
    if (!window.confirm('Sign out of Liquid Bars?')) return;
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  const exportSettings = () => {
    const keys = ['lb:darkMode','lb:notifications','lb:autoDownload','lb:downloadQuality','lb:onlyWifi',
      'lb:crossfade','lb:gapless','lb:maxCacheMB','lb:equalizer','lb:maxConcurrentDownloads',
      'lb:notificationVolume','lb:privacyAnalytics','lb:allowRemoteControl','lb:eqPreset'];
    const data = Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]));
    try { navigator.clipboard.writeText(JSON.stringify(data, null, 2)); showToast('Settings copied to clipboard!'); }
    catch { showToast('Copy failed', 'error'); }
  };

  const importSettings = () => {
    const raw = prompt('Paste settings JSON:');
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, v));
      showToast('Imported — refreshing…');
      setTimeout(() => window.location.reload(), 1500);
    } catch { showToast('Invalid JSON', 'error'); }
  };

  const resetDefaults = () => {
    if (!window.confirm('Reset all settings to defaults?')) return;
    setCrossfade(0); setGapless(false); setEqualizer(false); setEqPreset('flat');
    setAutoDownload(false); setDownloadQuality('high'); setOnlyWifi(true); setMaxDownloads(3);
    setDarkMode(false); setNotifications(true); setNotifVolume(80);
    setAnalytics(false); setRemoteControl(false); setMaxCache(200);
    showToast('Settings reset to defaults');
  };

  const tabs = [
    { key: 'profile',  label: 'Profile'  },
    { key: 'playback', label: 'Playback' },
    { key: 'storage',  label: 'Storage'  },
  ];

  return (
    <div className="set-root" style={{ minHeight: 0 }}>
      <style>{CSS}</style>

      {/* Update popup — rendered at root level so it's always on top */}
      {showUpdate && <UpdatePopup onClose={() => setShowUpdate(false)} />}

      <div className="set-shell">
        <div className="set-ambient" />
        <div className="set-scroll">
          <div className="set-inner">

            {/* header */}
            <div className="set-header">
              <h1 className="set-title">Sett<span>ings</span></h1>
              <button
                className="set-version-btn"
                onClick={() => setShowUpdate(true)}
                title="View release notes"
              >
                <span>v{VERSION}</span>
                <span className="set-version-dot">·</span>
                <span style={{ color: '#1DB954', fontSize: 10 }}>What&apos;s new</span>
              </button>
            </div>

            {/* tabs */}
            <div className="set-tabs">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} className={`set-tab ${tab === t.key ? 'active' : ''}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Profile ── */}
            {tab === 'profile' && (
              <div>
                <div className="set-profile-hero">
                  <div className="set-avatar-wrap">
                    <div className="set-avatar">
                      {avatar
                        ? <img src={avatar} alt="avatar" />
                        : <FaUser className="set-avatar-placeholder" />}
                    </div>
                    <label className="set-avatar-upload">
                      <FaCamera />
                      <input type="file" accept="image/*" onChange={handleAvatar} />
                    </label>
                  </div>

                  <div className="set-profile-info">
                    <div className="set-profile-name">{name || 'Music Lover'}</div>
                    <div className="set-profile-email">{user?.email || email || 'No email set'}</div>
                    <div className="set-profile-badges">
                      {user ? (
                        <>
                          <span className="set-badge set-badge-premium">Signed In</span>
                          {user.app_metadata?.provider && (
                            <span className="set-badge set-badge-member" style={{ textTransform: 'capitalize' }}>
                              via {user.app_metadata.provider}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="set-badge set-badge-member">Local Mode</span>
                      )}
                    </div>
                  </div>

                  <div className="set-profile-actions">
                    <button onClick={saveProfile} className={`set-save-btn ${saved ? 'saved' : 'unsaved'}`}>
                      {saved ? <FaCheckCircle /> : <FaSave />}
                      {saved ? 'Saved!' : 'Save'}
                    </button>
                    {user && (
                      <button onClick={handleSignOut} disabled={signingOut} className="set-signout-btn">
                        <FaSignOutAlt style={{ fontSize: 11 }} />
                        {signingOut ? 'Signing out…' : 'Sign Out'}
                      </button>
                    )}
                  </div>
                </div>

                <Card title="Personal Information" icon={<FaUser />} accent="emerald">
                  <div className="set-form-grid">
                    <div>
                      <label className="set-field-label">Display Name</label>
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="set-input" />
                    </div>
                    <div>
                      <label className="set-field-label">
                        Email {user && <span style={{ color: 'var(--s-t3)', fontWeight: 400, fontSize: 10, letterSpacing: 0, textTransform: 'none' }}>— managed by provider</span>}
                      </label>
                      <input
                        type="email"
                        value={user?.email || email}
                        onChange={e => !user && setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="set-input"
                        readOnly={!!user}
                        title={user ? 'Email is managed by your sign-in provider' : ''}
                      />
                    </div>
                    <div>
                      <label className="set-field-label">Phone</label>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900" className="set-input" />
                    </div>
                    <div>
                      <label className="set-field-label">Location</label>
                      <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" className="set-input" />
                    </div>
                    <div className="set-span-2">
                      <label className="set-field-label">Bio</label>
                      <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself…" className="set-input set-textarea" />
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ── Playback ── */}
            {tab === 'playback' && (
              <div>
                <Card title="Audio" icon={<FaSlidersH />} accent="emerald">
                  <Slider label="Crossfade" value={crossfade} onChange={setCrossfade} min={0} max={12} unit="s" description="Blend between tracks" />
                  <Toggle label="Gapless Playback" description="No silence between tracks" checked={gapless} onChange={setGapless} />
                  <Toggle label="Equalizer" description="Apply EQ to audio output" checked={equalizer} onChange={setEqualizer} />
                  {equalizer && (
                    <Select label="EQ Preset" value={eqPreset} onChange={setEqPreset}
                      options={[
                        { value: 'flat',   label: 'Flat'       },
                        { value: 'bass',   label: 'Bass Boost' },
                        { value: 'vocal',  label: 'Vocal'      },
                        { value: 'treble', label: 'Treble'     },
                      ]}
                    />
                  )}
                </Card>

                <Card title="Downloads" icon={<FaDownload />} accent="purple">
                  <Toggle label="Auto-download" description="Download favorited tracks automatically" checked={autoDownload} onChange={setAutoDownload} />
                  <Toggle label="Wi-Fi only" description="Don't download on mobile data" checked={onlyWifi} onChange={setOnlyWifi} />
                  <Select label="Quality" value={downloadQuality} onChange={setDownloadQuality} description="Higher quality uses more storage"
                    options={[
                      { value: 'low',    label: 'Low'    },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high',   label: 'High'   },
                    ]}
                  />
                  <NumberInput label="Max concurrent" value={maxDownloads} onChange={setMaxDownloads} min={1} max={10} description="Downloads running at once" />
                </Card>

                <Card title="General" icon={<FaMoon />} accent="blue">
                  <Toggle label="Dark mode" description="Use dark color scheme" checked={darkMode} onChange={setDarkMode} />
                  <Toggle label="Notifications" description="Show playback notifications" checked={notifications} onChange={setNotifications} />
                  {notifications && <Slider label="Notification volume" value={notifVolume} onChange={setNotifVolume} unit="%" />}
                </Card>

                <Card title="Privacy" icon={<FaShieldAlt />} accent="red">
                  <Toggle label="Usage analytics" description="Help improve the app anonymously" checked={analytics} onChange={setAnalytics} />
                  <Toggle label="Remote control" description="Allow controlling from other devices" checked={remoteControl} onChange={setRemoteControl} />
                </Card>
              </div>
            )}

            {/* ── Storage ── */}
            {tab === 'storage' && (
              <div>
                <Card title="Storage" icon={<FaDownload />} accent="emerald">
                  <div className="set-info-row">
                    <div>
                      <p className="set-info-label">Cache Size</p>
                      <p className="set-info-sub">Temporary files</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="set-info-val">{cacheSize}</span>
                      <button className="set-clear-btn" onClick={() => showToast('Cache cleared')}>Clear</button>
                    </div>
                  </div>

                  <Slider label="Max cache size" value={maxCache} onChange={setMaxCache} min={50} max={5000} unit=" MB" description="Storage limit for offline content" />

                  <div className="set-info-row">
                    <div>
                      <p className="set-info-label">Connection</p>
                      <p className="set-info-sub">Current network status</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className={`set-online-dot ${isOnline ? 'on' : 'off'}`} />
                      <span className={`set-status-text ${isOnline ? 'on' : 'off'}`}>{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>

                  <div className="set-info-row">
                    <div>
                      <p className="set-info-label">App Version</p>
                      <p className="set-info-sub">Built on {BUILD_DATE}</p>
                    </div>
                    <span className="set-info-val">v{VERSION}</span>
                  </div>

                  {user && (
                    <div className="set-info-row">
                      <div>
                        <p className="set-info-label">Account</p>
                        <p className="set-info-sub">{user.email}</p>
                      </div>
                      <button onClick={handleSignOut} disabled={signingOut} className="set-clear-btn">
                        {signingOut ? '…' : 'Sign Out'}
                      </button>
                    </div>
                  )}
                </Card>

                <Card title="Advanced" icon={<FaSlidersH />} accent="amber" note="Export your settings to back them up, or import from another device.">
                  <div className="set-actions-grid">
                    <button onClick={exportSettings} className="set-action-btn set-action-default">
                      <FaClipboard style={{ fontSize: 11 }} /> Export
                    </button>
                    <button onClick={importSettings} className="set-action-btn set-action-default">
                      <FaFileImport style={{ fontSize: 11 }} /> Import
                    </button>
                    <button onClick={resetDefaults} className="set-action-btn set-action-danger">
                      <FaRedoAlt style={{ fontSize: 11 }} /> Reset
                    </button>
                  </div>
                </Card>
              </div>
            )}

          </div>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
}