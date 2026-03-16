import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaUser, FaCamera, FaSave, FaDownload, FaSlidersH,
  FaMoon, FaShieldAlt, FaCheckCircle, FaExclamationCircle,
  FaClipboard, FaFileImport, FaRedoAlt, FaSignOutAlt, FaTimes,
  FaListUl, FaCog, FaIdCard, FaMusic,
} from 'react-icons/fa';
import { VERSION, BUILD_DATE } from '../version';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { usePlaylists } from '../hooks/usePlaylists';

const CHANGELOG = [
  { version: VERSION, date: BUILD_DATE, tag: 'Latest', changes: [
    'Syne font lyrics — bold active line with green fill sweep animation',
    'Mobile fullscreen lyrics overlay with shader background',
    'Desktop expanded player: full-width transparent lyrics, controls footer',
    'Settings page — editorial luxury redesign with sidebar navigation',
    'HomeOnline — Apple Music-style horizontal shelves, greeting hero',
  ]},
  { version: '1.3.0', date: '2026-03-04', tag: 'Stable', changes: [
    'YouTube streaming via yt-dlp backend — instant playback, no downloads',
    'HomeOnline localStorage cache — preserves daily API quota',
    'LRCLIB synced lyrics with karaoke-style green fill sweep',
    'Playlists: single source of truth via usePlaylists hook',
  ]},
  { version: '1.2.0', date: '2026-02-28', tag: null, changes: [
    'YouTube playlist import via Piped API (no API key required)',
    'Local file import to playlists',
    'Queue management and shuffle/repeat controls',
    'Mobile mini-player with expand to full-screen',
  ]},
];

function Counter({ to, duration = 900 }) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (to === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setVal(Math.round(ease * to));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration]);
  return React.createElement(React.Fragment, null, val.toLocaleString());
}

function UpdatePopup({ onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="sup-overlay" onClick={onClose}>
      <div className="sup-box" onClick={e => e.stopPropagation()}>
        <div className="sup-header">
          <div><div className="sup-eyebrow">Release Notes</div><div className="sup-title">What&apos;s New</div></div>
          <button className="sup-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="sup-body">
          {CHANGELOG.map((entry, ei) => (
            <div key={ei} className="sup-entry">
              <div className="sup-entry-header">
                <span className="sup-version">v{entry.version}</span>
                {entry.tag && <span className={`sup-tag ${entry.tag === 'Latest' ? 'latest' : 'stable'}`}>{entry.tag}</span>}
                <span className="sup-date">{entry.date}</span>
              </div>
              <ul className="sup-list">
                {entry.changes.map((c, ci) => (
                  <li key={ci} className="sup-item"><span className="sup-bullet" />{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

.set-root {
  width:100%;height:100%;display:flex;flex-direction:column;
  --g:#1DB954;--g2:#23E065;--gd:rgba(29,185,84,0.10);
  --r:#FF4466;--a:#F59E0B;--p:#A78BFA;--b2c:#60A5FA;
  --t1:#FFFFFF;--t2:rgba(255,255,255,0.50);--t3:rgba(255,255,255,0.22);
  --s1:rgba(255,255,255,0.035);--s2:rgba(255,255,255,0.065);--sh:rgba(255,255,255,0.09);
  --b1:rgba(255,255,255,0.07);--b2:rgba(255,255,255,0.12);
  --bg:#07080A;--sp:cubic-bezier(0.22,1,0.36,1);--ease:cubic-bezier(0.4,0,0.2,1);
  font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;
  background:var(--bg);color:var(--t1);
}
.set-root *,.set-root *::before,.set-root *::after{box-sizing:border-box;margin:0;padding:0;}

/* ── Shell ── */
.set-shell{width:100%;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;}

/* ── Scrollable content ── */
.set-scroll{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.07) transparent;}
.set-scroll::-webkit-scrollbar{width:4px;}
.set-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:3px;}

/* ════ HERO — full bleed cover-art background ════ */
.set-hero{
  position:relative;height:220px;overflow:hidden;flex-shrink:0;
  background:#07080A;
}
.set-hero-bg{
  position:absolute;inset:-30px;
  background-size:cover;background-position:center top;
  filter:blur(40px) saturate(1.3) brightness(0.45);
  transform:scale(1.1);
  transition:background-image .8s ease;
}
.set-hero-grain{
  position:absolute;inset:0;pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size:200px;opacity:.025;mix-blend-mode:screen;
}
.set-hero-scrim{position:absolute;bottom:0;left:0;right:0;height:160px;background:linear-gradient(to top,#07080A 0%,rgba(7,8,10,.7) 55%,transparent 100%);pointer-events:none;}

/* ════ IDENTITY STRIP ════ */
.set-identity{
  display:flex;align-items:flex-end;gap:18px;
  padding:0 28px 0;margin-top:-68px;
  position:relative;z-index:2;flex-shrink:0;
}
.set-avatar-wrap{position:relative;flex-shrink:0;width:106px;height:106px;}
.set-avatar{
  width:106px;height:106px;border-radius:50%;overflow:hidden;
  border:3.5px solid #07080A;
  background:linear-gradient(135deg,rgba(29,185,84,.25),rgba(35,224,101,.07));
  box-shadow:0 8px 32px rgba(0,0,0,.6);
  display:flex;align-items:center;justify-content:center;
  transition:transform .3s var(--sp);
}
.set-avatar:hover{transform:scale(1.03);}
.set-avatar img{width:100%;height:100%;object-fit:cover;}
.set-avatar-placeholder{color:rgba(255,255,255,.18);font-size:36px;}
.set-avatar-cam{
  position:absolute;bottom:3px;right:3px;
  width:30px;height:30px;border-radius:50%;
  background:var(--g);border:2px solid #07080A;
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;box-shadow:0 3px 12px rgba(29,185,84,.5);
  transition:transform .15s var(--sp),background .15s;
}
.set-avatar-cam:hover{transform:scale(1.14);background:var(--g2);}
.set-avatar-cam input{display:none;}

.set-identity-text{flex:1;min-width:0;padding-bottom:8px;}
.set-identity-role{font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--g);margin-bottom:3px;}
.set-identity-name{
  font-family:'Syne',sans-serif;font-size:clamp(22px,3.5vw,38px);
  font-weight:800;letter-spacing:-.04em;color:#fff;line-height:1.05;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  margin-bottom:4px;text-shadow:0 2px 18px rgba(0,0,0,.5);
}
.set-identity-email{font-size:13px;color:var(--t2);margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.set-badges{display:flex;flex-wrap:wrap;gap:6px;}
.set-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600;border:1px solid;}
.set-badge-green{background:rgba(29,185,84,.12);color:var(--g);border-color:rgba(29,185,84,.25);}
.set-badge-dim{background:var(--s1);color:var(--t3);border-color:var(--b1);}

.set-identity-actions{display:flex;gap:8px;align-items:center;flex-shrink:0;padding-bottom:8px;}
.set-btn-primary{
  display:inline-flex;align-items:center;gap:7px;
  padding:10px 22px;border-radius:9999px;
  background:var(--g);color:#000;border:none;
  font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;
  box-shadow:0 4px 18px rgba(29,185,84,.38);
  cursor:pointer;transition:all .2s var(--sp);
}
.set-btn-primary:hover{background:var(--g2);transform:scale(1.04);}
.set-btn-primary.saved{background:rgba(29,185,84,.12);color:var(--g);border:1px solid rgba(29,185,84,.25);box-shadow:none;}
.set-btn-ghost{
  display:inline-flex;align-items:center;gap:7px;
  padding:10px 18px;border-radius:9999px;cursor:pointer;
  background:rgba(255,68,102,.08);border:1px solid rgba(255,68,102,.2);
  color:var(--r);font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;
  transition:background .15s;
}
.set-btn-ghost:hover{background:rgba(255,68,102,.16);}
.set-btn-ghost:disabled{opacity:.6;cursor:not-allowed;}

/* ════ STATS ROW ════ */
.set-stats{
  display:flex;align-items:center;gap:0;
  padding:18px 28px 0;
  border-bottom:1px solid var(--b1);
  position:relative;z-index:2;flex-shrink:0;
}
.set-stat{display:flex;flex-direction:column;gap:1px;padding-right:28px;margin-right:28px;border-right:1px solid var(--b1);}
.set-stat:last-child{border-right:none;}
.set-stat-n{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.03em;padding-bottom:6px;}
.set-stat-l{font-size:11px;color:var(--t3);font-weight:500;padding-bottom:14px;}

/* ════ TOP TABS — just two ════ */
.set-tabs{
  display:flex;gap:0;
  border-bottom:1px solid var(--b1);
  padding:0 28px;
  flex-shrink:0;
  position:relative;z-index:2;
}
.set-tab{
  padding:14px 4px;margin-right:28px;
  font-size:14px;font-weight:600;color:var(--t3);
  background:none;border:none;cursor:pointer;
  border-bottom:2px solid transparent;
  transition:color .15s,border-color .15s;
  font-family:'DM Sans',sans-serif;
  white-space:nowrap;
}
.set-tab:hover{color:var(--t2);}
.set-tab.active{color:#fff;border-bottom-color:var(--g);}

/* ════ CONTENT ════ */
.set-content{padding:28px 28px 100px;position:relative;z-index:2;}

/* ════ SPOTIFY-STYLE PLAYLIST GRID ════ */
.set-pl-section{margin-bottom:40px;}
.set-pl-section-title{
  font-family:'Syne',sans-serif;font-size:20px;font-weight:800;
  letter-spacing:-.025em;color:#fff;margin-bottom:4px;
}
.set-pl-section-sub{font-size:13px;color:var(--t3);margin-bottom:18px;}

.set-pl-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(160px,1fr));
  gap:16px;
}
@media(min-width:900px){.set-pl-grid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr));}}

/* Each tile — clean Spotify style, no container box */
.set-pl-tile{
  cursor:pointer;border-radius:8px;padding:12px;
  background:transparent;
  transition:background .18s;
  animation:setTileIn .35s var(--sp) both;
}
.set-pl-tile:hover{background:rgba(255,255,255,.07);}
@keyframes setTileIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}

.set-pl-cover{
  width:100%;aspect-ratio:1;border-radius:6px;
  overflow:hidden;margin-bottom:10px;
  background:#111;
  box-shadow:0 8px 24px rgba(0,0,0,.5);
}
.set-pl-mosaic{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;height:100%;gap:1px;}
.set-pl-mosaic img,.set-pl-cover-single img{width:100%;height:100%;object-fit:cover;display:block;}
.set-pl-cover-single{width:100%;height:100%;}
.set-pl-cover-empty{
  width:100%;height:100%;
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,rgba(29,185,84,.12),rgba(0,0,0,.3));
  font-size:32px;color:rgba(29,185,84,.3);
}
.set-pl-tile-name{
  font-family:'Syne',sans-serif;font-size:14px;font-weight:700;
  color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  margin-bottom:3px;
}
.set-pl-tile-count{font-size:12px;color:var(--t2);}

.set-pl-empty-state{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:200px;gap:12px;text-align:center;
  background:var(--s1);border:1px solid var(--b1);border-radius:14px;
  padding:40px 24px;
}
.set-pl-empty-icon{font-size:32px;color:var(--t3);}
.set-pl-empty-title{font-size:15px;font-weight:600;color:var(--t2);}
.set-pl-empty-sub{font-size:12px;color:var(--t3);}

/* Social section */
.set-social{
  display:flex;gap:24px;flex-wrap:wrap;
  padding:24px 0;border-top:1px solid var(--b1);margin-top:4px;
}
.set-social-item{
  display:flex;flex-direction:column;align-items:flex-start;gap:2px;
  padding:16px 20px;border-radius:12px;
  background:var(--s1);border:1px solid var(--b1);
  min-width:120px;flex:1;
}
.set-social-num{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#fff;letter-spacing:-.04em;}
.set-social-label{font-size:12px;color:var(--t3);}
.set-social-sub{font-size:11px;color:var(--t3);opacity:.6;margin-top:2px;}

/* ════ SETTINGS TAB ════ */
.set-search-wrap{position:relative;margin-bottom:24px;}
.set-search-ico{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:13px;pointer-events:none;}
.set-search-input{
  width:100%;padding:11px 16px 11px 40px;
  background:var(--s1);border:1px solid var(--b1);border-radius:12px;
  color:#fff;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;
  transition:border-color .15s,background .15s;
}
.set-search-input:focus{border-color:rgba(29,185,84,.45);background:var(--s2);}
.set-search-input::placeholder{color:var(--t3);}

/* Section headings inside settings tab */
.set-section-head{
  font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:var(--t3);padding:20px 0 10px;
  border-top:1px solid var(--b1);margin-top:8px;
}
.set-section-head:first-child{border-top:none;margin-top:0;padding-top:0;}

/* ════ CARD / ROW PRIMITIVES ════ */
.set-card{background:var(--s1);border:1px solid var(--b1);border-radius:16px;overflow:hidden;margin-bottom:10px;}
.set-card-header{display:flex;align-items:center;gap:10px;padding:13px 18px;border-bottom:1px solid var(--b1);}
.set-card-icon{font-size:13px;color:var(--g);}
.set-card-title{font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--t1);}
.set-card-body{padding:18px;display:flex;flex-direction:column;gap:16px;}
.set-card.purple .set-card-icon{color:var(--p);}
.set-card.blue   .set-card-icon{color:var(--b2c);}
.set-card.red    .set-card-icon{color:var(--r);}
.set-card.amber  .set-card-icon{color:var(--a);}

.set-row{display:flex;align-items:center;justify-content:space-between;gap:16px;}
.set-row-text{flex:1;min-width:0;}
.set-row-label{font-size:14px;font-weight:500;color:var(--t1);margin-bottom:2px;}
.set-row-desc{font-size:12px;color:var(--t3);}

/* Toggle */
.set-switch{position:relative;width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;flex-shrink:0;transition:background .25s;}
.set-switch.on{background:var(--g);box-shadow:0 0 10px rgba(29,185,84,.3);}
.set-switch.off{background:rgba(255,255,255,.12);}
.set-switch-thumb{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.35);transition:transform .25s var(--sp);}
.set-switch.on .set-switch-thumb{transform:translateX(20px);}

/* Slider */
.set-slider-row{display:flex;flex-direction:column;gap:10px;}
.set-slider-top{display:flex;align-items:center;justify-content:space-between;}
.set-slider-meta{display:flex;flex-direction:column;gap:2px;}
.set-slider-label{font-size:14px;font-weight:500;color:var(--t1);}
.set-slider-desc{font-size:12px;color:var(--t3);}
.set-slider-val{font-size:13px;font-weight:700;color:var(--g);font-family:'Syne',sans-serif;}
.set-track{position:relative;height:5px;background:rgba(255,255,255,.08);border-radius:3px;}
.set-fill{position:absolute;left:0;top:0;height:100%;background:linear-gradient(to right,var(--g),var(--g2));border-radius:inherit;pointer-events:none;}
.set-thumb{position:absolute;top:50%;transform:translate(-50%,-50%);width:15px;height:15px;border-radius:50%;background:#fff;border:2px solid var(--g);box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none;}
.set-range{position:absolute;inset:-8px 0;width:100%;opacity:0;cursor:pointer;height:calc(100% + 16px);}

/* Select */
.set-select-row{display:flex;align-items:center;justify-content:space-between;gap:16px;}
.set-select{background:var(--s2);border:1px solid var(--b1);color:var(--t1);font-family:'DM Sans',sans-serif;font-size:13px;padding:8px 30px 8px 12px;border-radius:10px;outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;min-width:110px;}
.set-select:focus{border-color:rgba(29,185,84,.4);}

/* NumberInput */
.set-num-row{display:flex;align-items:center;justify-content:space-between;gap:16px;}
.set-num-controls{display:flex;align-items:center;gap:8px;}
.set-num-btn{width:28px;height:28px;border-radius:8px;background:var(--s2);border:1px solid var(--b1);color:var(--t1);font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;}
.set-num-btn:hover{background:var(--sh);}
.set-num-val{font-size:14px;font-weight:600;color:var(--t1);min-width:28px;text-align:center;}

/* Info row */
.set-info-row{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(255,255,255,.025);border-radius:10px;border:1px solid var(--b1);}
.set-info-label{font-size:14px;font-weight:500;color:var(--t1);margin-bottom:2px;}
.set-info-sub{font-size:12px;color:var(--t3);}
.set-info-val{font-size:13px;font-family:'Syne',sans-serif;color:var(--t2);}
.set-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.set-dot.on{background:var(--g);box-shadow:0 0 8px rgba(29,185,84,.6);animation:setPulse 2s ease-in-out infinite;}
.set-dot.off{background:var(--r);}
@keyframes setPulse{0%,100%{opacity:1}50%{opacity:.5}}
.set-status{font-size:13px;font-weight:600;}
.set-status.on{color:var(--g);}
.set-status.off{color:var(--r);}

/* Actions */
.set-actions-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
.set-action-btn{display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 8px;border-radius:11px;cursor:pointer;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;transition:background .15s,transform .12s var(--sp);border:1px solid;}
.set-action-btn:hover{transform:translateY(-1px);}
.set-action-btn:active{transform:scale(.96);}
.set-action-default{background:var(--s1);border-color:var(--b1);color:var(--t2);}
.set-action-default:hover{background:var(--s2);color:var(--t1);}
.set-action-danger{background:rgba(255,68,102,.08);border-color:rgba(255,68,102,.2);color:var(--r);}
.set-action-danger:hover{background:rgba(255,68,102,.15);}
.set-note{font-size:12px;color:var(--t3);line-height:1.5;margin-bottom:6px;}

/* Input field */
.set-field{display:flex;flex-direction:column;gap:7px;}
.set-label{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);}
.set-input{width:100%;padding:11px 14px;background:var(--s1);border:1px solid var(--b1);border-radius:12px;color:var(--t1);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:border-color .15s,background .15s;}
.set-input:focus{border-color:rgba(29,185,84,.4);background:var(--s2);}
.set-input::placeholder{color:var(--t3);}
.set-input[readonly]{opacity:.5;cursor:not-allowed;}
.set-textarea{resize:none;}

/* Toast */
.set-toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:200;padding:10px 18px;border-radius:9999px;font-size:13px;font-weight:600;white-space:nowrap;border:1px solid;backdrop-filter:blur(20px);animation:toastIn .25s var(--sp) both;box-shadow:0 8px 32px rgba(0,0,0,.45);display:flex;align-items:center;gap:8px;}
.set-toast.success{background:rgba(29,185,84,.15);border-color:rgba(29,185,84,.3);color:#6EE7A0;}
.set-toast.error{background:rgba(255,68,102,.12);border-color:rgba(255,68,102,.25);color:#FCA5A5;}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

/* Version FAB */
.set-version-fab{
  position:fixed;bottom:90px;right:20px;z-index:50;
  display:flex;align-items:center;gap:7px;padding:8px 14px;border-radius:9999px;
  background:rgba(10,12,14,.85);border:1px solid var(--b2);backdrop-filter:blur(20px);
  cursor:pointer;color:var(--t3);font-size:11px;font-family:'DM Sans',sans-serif;
  transition:background .15s,border-color .15s,color .15s;box-shadow:0 4px 20px rgba(0,0,0,.4);
}
.set-version-fab:hover{background:rgba(29,185,84,.12);border-color:rgba(29,185,84,.35);color:var(--g);}

/* Update popup */
.sup-overlay{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.72);backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:center;animation:supFade .22s ease both;}
@keyframes supFade{from{opacity:0}to{opacity:1}}
.sup-box{width:min(480px,94vw);background:#0C0E10;border:1px solid rgba(255,255,255,.12);border-radius:24px;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,.85);animation:supScale .3s var(--sp) both;max-height:85vh;display:flex;flex-direction:column;}
@keyframes supScale{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}
.sup-header{display:flex;align-items:flex-start;justify-content:space-between;padding:24px 24px 20px;border-bottom:1px solid rgba(255,255,255,.07);background:linear-gradient(135deg,rgba(29,185,84,.09),transparent);flex-shrink:0;}
.sup-eyebrow{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#1DB954;margin-bottom:4px;}
.sup-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;letter-spacing:-.03em;color:#fff;}
.sup-close{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.5);font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,color .15s;}
.sup-close:hover{background:rgba(255,255,255,.12);color:#fff;}
.sup-body{overflow-y:auto;padding:20px 24px 28px;display:flex;flex-direction:column;gap:24px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.07) transparent;}
.sup-body::-webkit-scrollbar{width:4px;}
.sup-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:3px;}
.sup-entry{border-bottom:1px solid rgba(255,255,255,.05);padding-bottom:20px;}
.sup-entry:last-child{border-bottom:none;padding-bottom:0;}
.sup-entry-header{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;}
.sup-version{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#fff;letter-spacing:-.02em;}
.sup-tag{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 8px;border-radius:9999px;}
.sup-tag.latest{background:rgba(29,185,84,.18);color:#1DB954;border:1px solid rgba(29,185,84,.3);}
.sup-tag.stable{background:rgba(96,165,250,.12);color:#60A5FA;border:1px solid rgba(96,165,250,.25);}
.sup-date{font-size:12px;color:rgba(255,255,255,.28);margin-left:auto;}
.sup-list{list-style:none;display:flex;flex-direction:column;gap:8px;}
.sup-item{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:rgba(255,255,255,.6);line-height:1.55;}
.sup-bullet{width:5px;height:5px;border-radius:50%;background:#1DB954;flex-shrink:0;margin-top:6px;}

/* Mobile */
@media(max-width:640px){
  .set-identity{padding:0 16px 0;margin-top:-52px;gap:12px;flex-wrap:wrap;}
  .set-avatar-wrap{width:88px;height:88px;}
  .set-avatar{width:88px;height:88px;}
  .set-identity-name{font-size:22px;}
  .set-identity-actions{width:100%;padding:0 16px;}
  .set-stats{padding:14px 16px 0;flex-wrap:wrap;}
  .set-tabs{padding:0 16px;}
  .set-content{padding:20px 16px 100px;}
  .set-pl-grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;}
  .set-version-fab{bottom:80px;right:14px;}
  .set-actions-grid{grid-template-columns:1fr 1fr;}
  .set-hero{height:160px;}
}
`;


function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        {label && <p className="set-row-label">{label}</p>}
        {description && <p className="set-row-desc">{description}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`set-toggle ${checked ? 'on' : 'off'}`}>
        <div className="set-toggle-thumb" />
      </button>
    </div>
  );
}

function Slider({ value, onChange, min = 0, max = 100, label, unit = '', description }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="set-slider-wrap">
      <div className="set-slider-top">
        <div><p className="set-slider-title">{label}</p>{description && <p className="set-slider-desc">{description}</p>}</div>
        <span className="set-slider-val">{value}{unit}</span>
      </div>
      <div className="set-track">
        <div className="set-track-fill" style={{ width: `${pct}%` }} />
        <div className="set-track-thumb" style={{ left: `${pct}%` }} />
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="set-track-input" />
      </div>
    </div>
  );
}

function SelectRow({ label, value, onChange, options, description }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <p className="set-row-label">{label}</p>
        {description && <p className="set-row-desc">{description}</p>}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} className="set-select">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function NumberRow({ label, value, onChange, min, max, description }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <p className="set-row-label">{label}</p>
        {description && <p className="set-row-desc">{description}</p>}
      </div>
      <div className="set-num">
        <button className="set-num-btn" onClick={() => onChange(Math.max(min, value - 1))}>-</button>
        <span className="set-num-val">{value}</span>
        <button className="set-num-btn" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

function Card({ icon, iconStyle = 'green', title, subtitle, children, note }) {
  return (
    <div className="set-card">
      <div className="set-card-hd">
        <div className={`set-card-hd-icon ${iconStyle}`}>{icon}</div>
        <div className="set-card-hd-text">
          <div className="set-card-hd-title">{title}</div>
          {subtitle && <div className="set-card-hd-sub">{subtitle}</div>}
        </div>
      </div>
      <div className="set-card-bd">
        {note && <p className="set-action-note" style={{ padding: '10px 20px 4px' }}>{note}</p>}
        {children}
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`set-toast ${type}`}>
      {type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}
      {message}
    </div>
  );
}

const NAV = [
  { key: 'profile',   label: 'Profile',   icon: <FaUser />,     group: 'me' },
  { key: 'playlists', label: 'Playlists', icon: <FaListUl />,   group: 'me' },
  { key: 'account',   label: 'Account',   icon: <FaIdCard />,   group: 'me' },
  { key: 'playback',  label: 'Playback',  icon: <FaMusic />,    group: 'app' },
  { key: 'storage',   label: 'Storage',   icon: <FaDownload />, group: 'app' },
];


export default function Settings() {
  const [tab,        setTab]        = useState('profile');
  const [toast,      setToast]      = useState(null);
  const [saved,      setSaved]      = useState(false);
  const [showUpdate,    setShowUpdate]    = useState(false);
  const [settingsQuery, setSettingsQuery] = useState('');
  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  useEffect(() => {
    const h = () => setShowUpdate(true);
    window.addEventListener('open-update-popup', h);
    return () => window.removeEventListener('open-update-popup', h);
  }, []);

  const { user, profile: authProfile, signOut } = useAuth();
  const { playlists } = usePlaylists();
  const [signingOut, setSigningOut] = useState(false);

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

  const [crossfade,       setCrossfade]       = useState(() => Number(localStorage.getItem('lb:crossfade') || 0));
  const [gapless,         setGapless]         = useState(() => localStorage.getItem('lb:gapless')   === 'true');
  const [equalizer,       setEqualizer]       = useState(() => localStorage.getItem('lb:equalizer') === 'true');
  const [eqPreset,        setEqPreset]        = useState(() => localStorage.getItem('lb:eqPreset')  || 'flat');
  const [autoDownload,    setAutoDownload]    = useState(() => localStorage.getItem('lb:autoDownload')    === 'true');
  const [downloadQuality, setDownloadQuality] = useState(() => localStorage.getItem('lb:downloadQuality') || 'high');
  const [onlyWifi,        setOnlyWifi]        = useState(() => localStorage.getItem('lb:onlyWifi')        === 'true');
  const [maxDownloads,    setMaxDownloads]    = useState(() => Number(localStorage.getItem('lb:maxConcurrentDownloads') || 3));
  const [darkMode,        setDarkMode]        = useState(() => localStorage.getItem('lb:darkMode')        === 'true');
  const [notifications,   setNotifications]   = useState(() => localStorage.getItem('lb:notifications')   === 'true');
  const [notifVolume,     setNotifVolume]     = useState(() => Number(localStorage.getItem('lb:notificationVolume') || 80));
  const [analytics,       setAnalytics]       = useState(() => localStorage.getItem('lb:privacyAnalytics')   === 'true');
  const [remoteControl,   setRemoteControl]   = useState(() => localStorage.getItem('lb:allowRemoteControl') === 'true');
  const [maxCache,        setMaxCache]        = useState(() => Number(localStorage.getItem('lb:maxCacheMB') || 200));
  const [cacheSize]                           = useState('12.4 MB');
  const [isOnline,        setIsOnline]        = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => { localStorage.setItem('lb:darkMode', darkMode); darkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark'); }, [darkMode]);
  useEffect(() => { localStorage.setItem('lb:notifications', notifications); }, [notifications]);
  useEffect(() => { localStorage.setItem('lb:autoDownload', autoDownload); }, [autoDownload]);
  useEffect(() => { localStorage.setItem('lb:onlyWifi', onlyWifi); }, [onlyWifi]);
  useEffect(() => { localStorage.setItem('lb:crossfade', String(crossfade)); }, [crossfade]);
  useEffect(() => { localStorage.setItem('lb:gapless', gapless); }, [gapless]);
  useEffect(() => { localStorage.setItem('lb:equalizer', equalizer); }, [equalizer]);
  useEffect(() => { localStorage.setItem('lb:eqPreset', eqPreset); }, [eqPreset]);
  useEffect(() => { localStorage.setItem('lb:maxConcurrentDownloads', String(maxDownloads)); }, [maxDownloads]);
  useEffect(() => { localStorage.setItem('lb:notificationVolume', String(notifVolume)); }, [notifVolume]);
  useEffect(() => { localStorage.setItem('lb:privacyAnalytics', analytics); }, [analytics]);
  useEffect(() => { localStorage.setItem('lb:allowRemoteControl', remoteControl); }, [remoteControl]);
  useEffect(() => { localStorage.setItem('lb:maxCacheMB', String(maxCache)); }, [maxCache]);
  useEffect(() => { localStorage.setItem('lb:downloadQuality', downloadQuality); }, [downloadQuality]);
  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const saveProfile = async () => {
    localStorage.setItem('lb:profileName', name);
    localStorage.setItem('lb:profileEmail', email);
    localStorage.setItem('lb:profilePhone', phone);
    localStorage.setItem('lb:profileLocation', location);
    localStorage.setItem('lb:profileBio', bio);
    localStorage.setItem('lb:profileAvatar', avatar);
    if (user) {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id, display_name: name, avatar_url: avatar,
        phone, location, bio, updated_at: new Date().toISOString(),
      });
      if (error) { showToast('Save failed: ' + error.message, 'error'); return; }
    }
    setSaved(true); setTimeout(() => setSaved(false), 2200); showToast('Profile saved!');
  };

  const handleAvatar = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (user) {
      const ext = f.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, f, { upsert: true });
      if (upErr) {
        const r = new FileReader(); r.onload = ev => setAvatar(ev.target.result); r.readAsDataURL(f);
        showToast('Upload failed — using local preview', 'error'); return;
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatar(data.publicUrl); showToast('Avatar updated!');
    } else {
      const r = new FileReader(); r.onload = ev => setAvatar(ev.target.result); r.readAsDataURL(f);
    }
  };

  const handleSignOut = async () => {
    if (!window.confirm('Sign out of Liquid Bars?')) return;
    setSigningOut(true); await signOut(); setSigningOut(false);
  };

  const exportSettings = () => {
    const keys = ['lb:darkMode','lb:notifications','lb:autoDownload','lb:downloadQuality','lb:onlyWifi','lb:crossfade','lb:gapless','lb:maxCacheMB','lb:equalizer','lb:maxConcurrentDownloads','lb:notificationVolume','lb:privacyAnalytics','lb:allowRemoteControl','lb:eqPreset'];
    const data = Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]));
    try { navigator.clipboard.writeText(JSON.stringify(data, null, 2)); showToast('Settings copied to clipboard!'); }
    catch { showToast('Copy failed', 'error'); }
  };
  const importSettings = () => {
    const raw = prompt('Paste settings JSON:');
    if (!raw) return;
    try { const obj = JSON.parse(raw); Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, v)); showToast('Imported — refreshing…'); setTimeout(() => window.location.reload(), 1500); }
    catch { showToast('Invalid JSON', 'error'); }
  };
  const resetDefaults = () => {
    if (!window.confirm('Reset all settings to defaults?')) return;
    setCrossfade(0); setGapless(false); setEqualizer(false); setEqPreset('flat');
    setAutoDownload(false); setDownloadQuality('high'); setOnlyWifi(true); setMaxDownloads(3);
    setDarkMode(false); setNotifications(true); setNotifVolume(80);
    setAnalytics(false); setRemoteControl(false); setMaxCache(200);
    showToast('Settings reset to defaults');
  };

  const plCount = playlists.filter(p => !p._hidden).length;

  return (
    <div className="set-root" style={{ minHeight: 0 }}>
      <style>{CSS}</style>
      {showUpdate && <UpdatePopup onClose={() => setShowUpdate(false)} />}

      {/* Floating version FAB */}
      <button className="set-version-fab" onClick={() => setShowUpdate(true)}>
        <span>v{VERSION}</span>
        <span style={{ opacity:.35 }}>·</span>
        <span style={{ color:'var(--g)', fontSize:10 }}>What's new</span>
      </button>

      <div className="set-shell">
        <div className="set-scroll">

          {/* ── HERO ── */}
          <div className="set-hero">
            {avatar && <div className="set-hero-bg" style={{ backgroundImage:`url(${avatar})` }} />}
            <div className="set-hero-grain" />
            <div className="set-hero-scrim" />
          </div>

          {/* ── IDENTITY STRIP ── */}
          <div className="set-identity">
            <div className="set-avatar-wrap">
              <div className="set-avatar">
                {avatar ? <img src={avatar} alt={name} /> : <FaUser className="set-avatar-placeholder" />}
              </div>
              <label className="set-avatar-cam">
                <FaCamera style={{ fontSize:12, color:'#000' }} />
                <input type="file" accept="image/*" onChange={handleAvatar} />
              </label>
            </div>
            <div className="set-identity-text">
              <div className="set-identity-role">{user ? 'Listener' : 'Local Mode'}</div>
              <h1 className="set-identity-name">{name || 'Music Lover'}</h1>
              <p className="set-identity-email">{user?.email || email || 'No email set'}</p>
              <div className="set-badges">
                {user ? (
                  <>
                    <span className="set-badge set-badge-green">Signed In</span>
                    {user.app_metadata?.provider && (
                      <span className="set-badge set-badge-dim" style={{ textTransform:'capitalize' }}>
                        via {user.app_metadata.provider}
                      </span>
                    )}
                  </>
                ) : <span className="set-badge set-badge-dim">Local Mode</span>}
              </div>
            </div>
            <div className="set-identity-actions">
              <button onClick={saveProfile} className={`set-btn-primary ${saved ? 'saved' : ''}`}>
                {saved ? <FaCheckCircle /> : <FaSave />}{saved ? 'Saved!' : 'Save'}
              </button>
              {user && (
                <button onClick={handleSignOut} disabled={signingOut} className="set-btn-ghost">
                  <FaSignOutAlt style={{ fontSize:11 }} />
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              )}
            </div>
          </div>

          {/* ── STATS ROW ── */}
          <div className="set-stats">
            <div className="set-stat">
              <span className="set-stat-n"><Counter to={plCount} /></span>
              <span className="set-stat-l">Playlists</span>
            </div>
            <div className="set-stat">
              <span className="set-stat-n"><Counter to={0} /></span>
              <span className="set-stat-l">Following</span>
            </div>
            <div className="set-stat">
              <span className="set-stat-n"><Counter to={0} /></span>
              <span className="set-stat-l">Followers</span>
            </div>
          </div>

          {/* ── TWO TABS ── */}
          <div className="set-tabs">
            {[['profile','Profile'],['app','Settings']].map(([key,label]) => (
              <button key={key}
                className={`set-tab ${tab === key ? 'active' : ''}`}
                onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          <div className="set-content">

            {/* ════ PROFILE TAB ════ */}
            {tab === 'profile' && (
              <div>
                {/* Playlists section */}
                <div className="set-pl-section">
                  <h2 className="set-pl-section-title">Your Playlists</h2>
                  <p className="set-pl-section-sub">{plCount} playlist{plCount !== 1 ? 's' : ''} created</p>

                  {plCount === 0 ? (
                    <div className="set-pl-empty-state">
                      <div className="set-pl-empty-icon">🎵</div>
                      <p className="set-pl-empty-title">No playlists yet</p>
                      <p className="set-pl-empty-sub">Head to Playlists to create your first one</p>
                    </div>
                  ) : (
                    <div className="set-pl-grid">
                      {playlists.filter(p => !p._hidden).map((pl, i) => {
                        const covers = (pl.songs || []).slice(0,4).map(s => s.cover).filter(Boolean);
                        return (
                          <div key={pl.id} className="set-pl-tile" style={{ animationDelay:`${i*0.04}s` }}>
                            <div className="set-pl-cover">
                              {covers.length === 0 ? (
                                <div className="set-pl-cover-empty">🎵</div>
                              ) : covers.length >= 4 ? (
                                <div className="set-pl-mosaic">
                                  {covers.map((c,j) => <img key={j} src={c} alt="" onError={e=>{e.target.style.display='none';}} />)}
                                </div>
                              ) : (
                                <div className="set-pl-cover-single">
                                  <img src={covers[0]} alt={pl.name} onError={e=>{e.target.style.display='none';}} />
                                </div>
                              )}
                            </div>
                            <div className="set-pl-tile-name">{pl.name}</div>
                            <div className="set-pl-tile-count">{(pl.songs||[]).length} songs</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Following / Followers */}
                <div className="set-social">
                  <div className="set-social-item">
                    <span className="set-social-num">0</span>
                    <span className="set-social-label">Following</span>
                    <span className="set-social-sub">Coming soon</span>
                  </div>
                  <div className="set-social-item">
                    <span className="set-social-num">0</span>
                    <span className="set-social-label">Followers</span>
                    <span className="set-social-sub">Coming soon</span>
                  </div>
                </div>
              </div>
            )}

            {/* ════ SETTINGS TAB ════ */}
            {tab === 'app' && (
              <div>
                {/* Search */}
                <div className="set-search-wrap">
                  <FaSearch className="set-search-ico" />
                  <input
                    className="set-search-input"
                    type="text" value={settingsQuery}
                    onChange={e => setSettingsQuery(e.target.value)}
                    placeholder="Search settings…"
                  />
                </div>

                {/* Account */}
                {(!settingsQuery || 'account name email bio location'.includes(settingsQuery.toLowerCase())) && (
                  <>
                    <div className="set-section-head">Account</div>
                    <div className="set-card">
                      <div className="set-card-header"><span className="set-card-icon"><FaUser /></span><h3 className="set-card-title">Personal Information</h3></div>
                      <div className="set-card-body">
                        <div className="set-field">
                          <label className="set-label">Display Name</label>
                          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="set-input" />
                        </div>
                        <div className="set-field">
                          <label className="set-label">Email {user && <span style={{color:'var(--t3)',fontWeight:400,fontSize:10,textTransform:'none',letterSpacing:0}}>— managed by provider</span>}</label>
                          <input type="email" value={user?.email||email} onChange={e => !user && setEmail(e.target.value)}
                            placeholder="you@example.com" className="set-input" readOnly={!!user} />
                        </div>
                        <div className="set-field">
                          <label className="set-label">Location</label>
                          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" className="set-input" />
                        </div>
                        <div className="set-field">
                          <label className="set-label">Bio</label>
                          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself…" className="set-input set-textarea" />
                        </div>
                        <div style={{ display:'flex', gap:10 }}>
                          <button onClick={saveProfile} className={`set-btn-primary ${saved ? 'saved' : ''}`} style={{ alignSelf:'flex-start' }}>
                            {saved ? <FaCheckCircle /> : <FaSave />}{saved ? 'Saved!' : 'Save'}
                          </button>
                          {user && (
                            <button onClick={handleSignOut} disabled={signingOut} className="set-btn-ghost" style={{ alignSelf:'flex-start' }}>
                              <FaSignOutAlt style={{ fontSize:11 }} />{signingOut ? 'Signing out…' : 'Sign Out'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Audio */}
                {(!settingsQuery || 'audio crossfade gapless equalizer eq playback'.includes(settingsQuery.toLowerCase())) && (
                  <>
                    <div className="set-section-head">Audio &amp; Playback</div>
                    <div className="set-card">
                      <div className="set-card-header"><span className="set-card-icon"><FaSlidersH /></span><h3 className="set-card-title">Audio</h3></div>
                      <div className="set-card-body">
                        <Slider label="Crossfade" value={crossfade} onChange={setCrossfade} min={0} max={12} unit="s" description="Blend between tracks" />
                        <Toggle label="Gapless Playback" description="No silence between tracks" checked={gapless} onChange={setGapless} />
                        <Toggle label="Equalizer" description="Apply EQ to audio output" checked={equalizer} onChange={setEqualizer} />
                        {equalizer && (
                          <Select label="EQ Preset" value={eqPreset} onChange={setEqPreset}
                            options={[{value:'flat',label:'Flat'},{value:'bass',label:'Bass Boost'},{value:'vocal',label:'Vocal'},{value:'treble',label:'Treble'}]} />
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Downloads */}
                {(!settingsQuery || 'download wifi quality'.includes(settingsQuery.toLowerCase())) && (
                  <>
                    <div className="set-section-head">Downloads</div>
                    <div className="set-card purple">
                      <div className="set-card-header"><span className="set-card-icon"><FaDownload /></span><h3 className="set-card-title">Downloads</h3></div>
                      <div className="set-card-body">
                        <Toggle label="Auto-download" description="Download favorited tracks automatically" checked={autoDownload} onChange={setAutoDownload} />
                        <Toggle label="Wi-Fi only" description="Don't download on mobile data" checked={onlyWifi} onChange={setOnlyWifi} />
                        <Select label="Quality" value={downloadQuality} onChange={setDownloadQuality} description="Higher quality uses more storage"
                          options={[{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]} />
                        <NumberInput label="Max concurrent" value={maxDownloads} onChange={setMaxDownloads} min={1} max={10} description="Downloads running at once" />
                      </div>
                    </div>
                  </>
                )}

                {/* General */}
                {(!settingsQuery || 'dark mode notifications general'.includes(settingsQuery.toLowerCase())) && (
                  <>
                    <div className="set-section-head">General</div>
                    <div className="set-card blue">
                      <div className="set-card-header"><span className="set-card-icon"><FaMoon /></span><h3 className="set-card-title">General</h3></div>
                      <div className="set-card-body">
                        <Toggle label="Dark mode" description="Use dark color scheme" checked={darkMode} onChange={setDarkMode} />
                        <Toggle label="Notifications" description="Show playback notifications" checked={notifications} onChange={setNotifications} />
                        {notifications && <Slider label="Notification volume" value={notifVolume} onChange={setNotifVolume} unit="%" />}
                      </div>
                    </div>
                  </>
                )}

                {/* Privacy */}
                {(!settingsQuery || 'privacy analytics remote'.includes(settingsQuery.toLowerCase())) && (
                  <>
                    <div className="set-section-head">Privacy</div>
                    <div className="set-card red">
                      <div className="set-card-header"><span className="set-card-icon"><FaShieldAlt /></span><h3 className="set-card-title">Privacy</h3></div>
                      <div className="set-card-body">
                        <Toggle label="Usage analytics" description="Help improve the app anonymously" checked={analytics} onChange={setAnalytics} />
                        <Toggle label="Remote control" description="Allow controlling from other devices" checked={remoteControl} onChange={setRemoteControl} />
                      </div>
                    </div>
                  </>
                )}

                {/* Storage */}
                {(!settingsQuery || 'storage cache version app'.includes(settingsQuery.toLowerCase())) && (
                  <>
                    <div className="set-section-head">Storage &amp; App</div>
                    <div className="set-card">
                      <div className="set-card-header"><span className="set-card-icon"><FaDownload /></span><h3 className="set-card-title">Storage</h3></div>
                      <div className="set-card-body">
                        <div className="set-info-row">
                          <div><p className="set-info-label">Cache Size</p><p className="set-info-sub">Temporary files</p></div>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <span className="set-info-val">{cacheSize}</span>
                            <button style={{padding:'5px 11px',borderRadius:8,cursor:'pointer',background:'rgba(255,68,102,.08)',border:'1px solid rgba(255,68,102,.2)',color:'var(--r)',fontSize:12,fontWeight:600}} onClick={() => showToast('Cache cleared')}>Clear</button>
                          </div>
                        </div>
                        <Slider label="Max cache size" value={maxCache} onChange={setMaxCache} min={50} max={5000} unit=" MB" description="Storage limit for offline content" />
                        <div className="set-info-row">
                          <div><p className="set-info-label">Connection</p><p className="set-info-sub">Network status</p></div>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div className={`set-dot ${isOnline?'on':'off'}`} />
                            <span className={`set-status ${isOnline?'on':'off'}`}>{isOnline?'Online':'Offline'}</span>
                          </div>
                        </div>
                        <div className="set-info-row">
                          <div><p className="set-info-label">App Version</p><p className="set-info-sub">Built on {BUILD_DATE}</p></div>
                          <span className="set-info-val">v{VERSION}</span>
                        </div>
                      </div>
                    </div>
                    <div className="set-card amber">
                      <div className="set-card-header"><span className="set-card-icon"><FaSlidersH /></span><h3 className="set-card-title">Advanced</h3></div>
                      <div className="set-card-body">
                        <p className="set-note">Export your settings to back them up, or import from another device.</p>
                        <div className="set-actions-grid">
                          <button onClick={exportSettings} className="set-action-btn set-action-default"><FaClipboard style={{fontSize:11}} /> Export</button>
                          <button onClick={importSettings} className="set-action-btn set-action-default"><FaFileImport style={{fontSize:11}} /> Import</button>
                          <button onClick={resetDefaults} className="set-action-btn set-action-danger"><FaRedoAlt style={{fontSize:11}} /> Reset</button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              </div>
            )}

          </div>{/* end set-content */}
        </div>{/* end set-scroll */}

        {toast && (
          <div className={`set-toast ${toast.type}`}>
            {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}