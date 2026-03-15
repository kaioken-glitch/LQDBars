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
  --r:#FF4466;--a:#F59E0B;--p:#A78BFA;--b:#60A5FA;
  --t1:#FFFFFF;--t2:rgba(255,255,255,0.50);--t3:rgba(255,255,255,0.22);
  --s1:rgba(255,255,255,0.035);--s2:rgba(255,255,255,0.065);--sh:rgba(255,255,255,0.09);
  --b1:rgba(255,255,255,0.07);--b2:rgba(255,255,255,0.12);
  --bg:#07080A;--sp:cubic-bezier(0.22,1,0.36,1);--ease:cubic-bezier(0.4,0,0.2,1);
  font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;
  background:var(--bg);color:var(--t1);
}
.set-root *,.set-root *::before,.set-root *::after{box-sizing:border-box;margin:0;padding:0;}

.set-shell{display:flex;flex-direction:row;width:100%;flex:1;min-height:0;overflow:hidden;}

/* SIDEBAR */
.set-sidebar{
  width:200px;flex-shrink:0;display:flex;flex-direction:column;
  border-right:1px solid var(--b1);background:rgba(4,5,7,0.75);
  backdrop-filter:blur(20px);padding:0 0 24px;overflow-y:auto;
}
.set-sidebar-logo{
  padding:24px 20px 20px;font-family:'Syne',sans-serif;
  font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;
  color:var(--t3);border-bottom:1px solid var(--b1);margin-bottom:8px;
}
.set-nav-section{padding:10px 12px 4px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--t3);}
.set-nav-item{
  display:flex;align-items:center;gap:11px;padding:10px 20px;cursor:pointer;
  font-size:13px;font-weight:500;color:var(--t2);
  background:none;border:none;border-left:2px solid transparent;
  width:100%;text-align:left;font-family:'DM Sans',sans-serif;
  transition:color 0.15s,background 0.15s,border-color 0.15s;
}
.set-nav-item:hover{color:var(--t1);background:var(--s1);}
.set-nav-item.active{color:var(--t1);background:var(--s2);border-left-color:var(--g);}
.set-nav-item.active .set-nav-icon{color:var(--g);}
.set-nav-icon{font-size:13px;flex-shrink:0;color:var(--t3);transition:color 0.15s;}
.set-nav-divider{height:1px;background:var(--b1);margin:8px 20px;}
.set-sidebar-version{margin-top:auto;padding:16px 20px 0;border-top:1px solid var(--b1);}
.set-sidebar-version-btn{
  width:100%;display:flex;align-items:center;justify-content:space-between;
  padding:8px 10px;border-radius:8px;background:var(--s1);border:1px solid var(--b1);
  cursor:pointer;transition:background 0.15s,border-color 0.15s;font-family:'DM Sans',sans-serif;
}
.set-sidebar-version-btn:hover{background:var(--s2);border-color:rgba(29,185,84,0.25);}
.set-sidebar-version-num{font-size:11px;font-weight:600;color:var(--t2);}
.set-sidebar-version-tag{font-size:9px;font-weight:700;color:var(--g);letter-spacing:0.08em;text-transform:uppercase;}

/* SCROLL */
.set-scroll{flex:1;overflow-y:auto;min-height:0;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.06) transparent;}
.set-scroll::-webkit-scrollbar{width:4px;}
.set-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:3px;}

/* HERO */
.set-hero{position:relative;height:240px;overflow:hidden;flex-shrink:0;background:#07080A;}
.set-hero-bg{
  position:absolute;inset:-24px;background-size:cover;background-position:center;
  filter:blur(44px) saturate(0.55) brightness(0.28);transform:scale(1.12);
  transition:background-image 1.4s ease;
}
.set-hero-grain{
  position:absolute;inset:0;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  background-size:200px;mix-blend-mode:overlay;pointer-events:none;opacity:0.6;
}
.set-hero-scrim{position:absolute;bottom:0;left:0;right:0;height:190px;background:linear-gradient(to top,#07080A 0%,rgba(7,8,10,0.8) 45%,transparent 100%);pointer-events:none;}
.set-hero-scrim-top{position:absolute;top:0;left:0;right:0;height:70px;background:linear-gradient(to bottom,rgba(7,8,10,0.5) 0%,transparent 100%);pointer-events:none;}

/* IDENTITY */
.set-identity{
  position:relative;z-index:2;display:flex;align-items:flex-end;gap:24px;
  padding:0 32px;margin-top:-88px;flex-shrink:0;
}
.set-avatar-wrap{position:relative;flex-shrink:0;}
.set-avatar{
  width:120px;height:120px;border-radius:50%;overflow:hidden;
  background:linear-gradient(135deg,rgba(29,185,84,0.18),rgba(0,0,0,0.5));
  border:3px solid #07080A;
  box-shadow:0 12px 48px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.08);
  display:flex;align-items:center;justify-content:center;
  transition:transform 0.35s var(--sp),box-shadow 0.35s;
}
.set-avatar:hover{transform:scale(1.03);box-shadow:0 16px 56px rgba(0,0,0,0.7),0 0 0 1px rgba(29,185,84,0.2);}
.set-avatar img{width:100%;height:100%;object-fit:cover;display:block;}
.set-avatar-placeholder{color:rgba(255,255,255,0.15);font-size:44px;}
.set-avatar-cam{
  position:absolute;bottom:4px;right:4px;width:32px;height:32px;border-radius:50%;
  background:var(--g);border:2px solid #07080A;
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;box-shadow:0 4px 16px rgba(29,185,84,0.5);
  transition:transform 0.2s var(--sp),background 0.15s;
}
.set-avatar-cam:hover{transform:scale(1.16);background:var(--g2);}
.set-avatar-cam input{display:none;}
.set-identity-text{flex:1;min-width:0;padding-bottom:8px;}
.set-identity-role{
  font-size:10px;font-weight:700;letter-spacing:0.18em;
  text-transform:uppercase;color:var(--g);margin-bottom:6px;
  display:flex;align-items:center;gap:8px;
}
.set-identity-role::before{content:'';display:block;width:20px;height:1px;background:var(--g);opacity:0.6;}
.set-identity-name{
  font-family:'Syne',sans-serif;font-size:clamp(28px,3.8vw,46px);
  font-weight:800;letter-spacing:-0.04em;color:#fff;line-height:1;
  margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-shadow:0 4px 32px rgba(0,0,0,0.6);
}
.set-identity-email{font-size:13px;color:var(--t2);font-style:italic;}
.set-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
.set-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:600;border:1px solid;letter-spacing:0.01em;}
.set-badge-green{background:rgba(29,185,84,0.10);color:var(--g);border-color:rgba(29,185,84,0.22);}
.set-badge-dim{background:var(--s1);color:var(--t3);border-color:var(--b1);}
.set-identity-actions{display:flex;gap:10px;align-items:flex-end;padding-bottom:10px;flex-shrink:0;}
.set-btn-primary{
  display:inline-flex;align-items:center;gap:8px;padding:11px 24px;border-radius:9999px;
  font-size:13px;font-weight:700;font-family:'DM Sans',sans-serif;
  cursor:pointer;border:none;background:var(--g);color:#000;
  box-shadow:0 4px 24px rgba(29,185,84,0.35);
  transition:background 0.2s,transform 0.2s var(--sp),box-shadow 0.2s;
}
.set-btn-primary:hover{background:var(--g2);transform:scale(1.04);}
.set-btn-primary:active{transform:scale(0.96);}
.set-btn-primary.saved{background:rgba(29,185,84,0.12);color:var(--g);border:1px solid rgba(29,185,84,0.25);box-shadow:none;}
.set-btn-ghost{
  display:inline-flex;align-items:center;gap:8px;padding:11px 20px;border-radius:9999px;
  font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;
  background:rgba(255,68,102,0.07);border:1px solid rgba(255,68,102,0.18);color:var(--r);
  transition:background 0.15s;
}
.set-btn-ghost:hover{background:rgba(255,68,102,0.14);}
.set-btn-ghost:disabled{opacity:0.5;cursor:not-allowed;}

/* STATS */
.set-stats{display:flex;align-items:center;padding:20px 32px 0;gap:0;border-bottom:1px solid var(--b1);}
.set-stat{display:flex;flex-direction:column;padding:0 32px 20px 0;position:relative;cursor:default;}
.set-stat:not(:last-child)::after{content:'';position:absolute;right:16px;top:4px;height:30px;width:1px;background:var(--b1);}
.set-stat-n{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.04em;line-height:1;margin-bottom:4px;}
.set-stat-l{font-size:11px;font-weight:500;color:var(--t3);letter-spacing:0.04em;text-transform:uppercase;}

/* PAGE HEADER */
.set-page-header{padding:28px 32px 20px;border-bottom:1px solid var(--b1);}
.set-page-title{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.03em;color:#fff;margin-bottom:4px;}
.set-page-sub{font-size:13px;color:var(--t3);}

/* PLAYLISTS */
.set-pl-wrap{padding:24px 32px 40px;}
.set-pl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;}
.set-pl-tile{border-radius:14px;overflow:hidden;background:var(--s1);border:1px solid var(--b1);cursor:pointer;transition:transform 0.22s var(--sp),border-color 0.22s,box-shadow 0.22s;animation:tileIn 0.32s var(--sp) both;}
.set-pl-tile:hover{transform:translateY(-4px) scale(1.02);border-color:rgba(29,185,84,0.28);box-shadow:0 16px 40px rgba(0,0,0,0.5);}
@keyframes tileIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
.set-pl-cover{position:relative;aspect-ratio:1;overflow:hidden;}
.set-pl-cover img{width:100%;height:100%;object-fit:cover;transition:transform 0.35s ease;}
.set-pl-tile:hover .set-pl-cover img{transform:scale(1.05);}
.set-pl-mosaic{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;aspect-ratio:1;gap:1px;background:#111;}
.set-pl-mosaic img{width:100%;height:100%;object-fit:cover;}
.set-pl-info{padding:12px 14px 14px;}
.set-pl-name{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px;}
.set-pl-count{font-size:11px;color:var(--t3);}
.set-pl-empty{grid-column:1/-1;padding:56px 24px;text-align:center;border:1px dashed var(--b1);border-radius:16px;background:var(--s1);}
.set-pl-empty-icon{font-size:32px;margin-bottom:14px;opacity:0.4;}
.set-pl-empty-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--t2);margin-bottom:6px;}
.set-pl-empty-sub{font-size:13px;color:var(--t3);}

/* FORM */
.set-form-wrap{padding:8px 32px 40px;}
.set-form-section{margin-bottom:32px;}
.set-form-section-title{
  font-family:'Syne',sans-serif;font-size:11px;font-weight:700;
  letter-spacing:0.12em;text-transform:uppercase;color:var(--t3);
  margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--b1);
  display:flex;align-items:center;gap:10px;
}
.set-form-section-title::before{content:'';display:block;width:3px;height:14px;background:var(--g);border-radius:2px;}
.set-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.set-grid-2 .set-span-2{grid-column:span 2;}
.set-field{display:flex;flex-direction:column;gap:7px;}
.set-label{font-size:11px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;color:var(--t3);}
.set-label span{font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;color:var(--t3);opacity:0.7;}
.set-input{
  width:100%;padding:12px 16px;background:var(--s1);border:1px solid var(--b1);
  border-radius:12px;color:var(--t1);font-family:'DM Sans',sans-serif;font-size:14px;
  outline:none;transition:border-color 0.18s,background 0.18s,box-shadow 0.18s;
}
.set-input:focus{border-color:rgba(29,185,84,0.45);background:var(--s2);box-shadow:0 0 0 3px rgba(29,185,84,0.08);}
.set-input::placeholder{color:var(--t3);}
.set-input[readonly]{opacity:0.45;cursor:not-allowed;}
.set-textarea{resize:none;line-height:1.6;}

/* CARDS */
.set-settings-wrap{padding:8px 32px 40px;display:flex;flex-direction:column;gap:12px;}
.set-card{background:var(--s1);border:1px solid var(--b1);border-radius:18px;overflow:hidden;transition:border-color 0.2s;}
.set-card:hover{border-color:rgba(255,255,255,0.10);}
.set-card-hd{display:flex;align-items:center;gap:12px;padding:16px 20px 14px;border-bottom:1px solid var(--b1);}
.set-card-hd-icon{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
.set-card-hd-icon.green{background:rgba(29,185,84,0.12);color:var(--g);}
.set-card-hd-icon.purple{background:rgba(167,139,250,0.12);color:var(--p);}
.set-card-hd-icon.blue{background:rgba(96,165,250,0.12);color:var(--b);}
.set-card-hd-icon.red{background:rgba(255,68,102,0.12);color:var(--r);}
.set-card-hd-icon.amber{background:rgba(245,158,11,0.12);color:var(--a);}
.set-card-hd-text{flex:1;}
.set-card-hd-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#fff;letter-spacing:-0.01em;}
.set-card-hd-sub{font-size:11px;color:var(--t3);margin-top:1px;}
.set-card-bd{padding:6px 0;}

/* ROWS */
.set-row{display:flex;align-items:center;justify-content:space-between;padding:13px 20px;gap:16px;transition:background 0.12s;}
.set-row:hover{background:rgba(255,255,255,0.02);}
.set-row-text{flex:1;min-width:0;}
.set-row-label{font-size:14px;font-weight:500;color:var(--t1);margin-bottom:2px;}
.set-row-desc{font-size:12px;color:var(--t3);}
.set-row-divider{height:1px;background:var(--b1);margin:0 20px;}

/* TOGGLE */
.set-toggle{position:relative;width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;flex-shrink:0;transition:background 0.22s;}
.set-toggle.on{background:var(--g);box-shadow:0 0 10px rgba(29,185,84,0.3);}
.set-toggle.off{background:rgba(255,255,255,0.12);}
.set-toggle-thumb{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);transition:transform 0.22s var(--sp);}
.set-toggle.on .set-toggle-thumb{transform:translateX(20px);}

/* SLIDER */
.set-slider-wrap{display:flex;flex-direction:column;gap:10px;width:100%;padding:4px 20px 14px;}
.set-slider-top{display:flex;align-items:center;justify-content:space-between;}
.set-slider-title{font-size:14px;font-weight:500;color:var(--t1);}
.set-slider-desc{font-size:12px;color:var(--t3);margin-top:1px;}
.set-slider-val{font-size:13px;font-weight:700;color:var(--g);font-variant-numeric:tabular-nums;font-family:'Syne',sans-serif;}
.set-track{position:relative;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;}
.set-track-fill{position:absolute;left:0;top:0;height:100%;background:linear-gradient(to right,var(--g),var(--g2));border-radius:inherit;pointer-events:none;}
.set-track-thumb{position:absolute;top:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--g);box-shadow:0 2px 8px rgba(0,0,0,0.3);pointer-events:none;}
.set-track-input{position:absolute;inset:-8px 0;width:100%;opacity:0;cursor:pointer;height:calc(100% + 16px);}

/* SELECT */
.set-select{background:var(--s2);border:1px solid var(--b1);color:var(--t1);font-family:'DM Sans',sans-serif;font-size:13px;padding:8px 32px 8px 12px;border-radius:10px;outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(255,255,255,0.35)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;min-width:120px;}
.set-select:focus{border-color:rgba(29,185,84,0.4);}
.set-select option{background:#111315;}

/* NUMBER */
.set-num{display:flex;align-items:center;gap:10px;}
.set-num-btn{width:28px;height:28px;border-radius:8px;background:var(--s2);border:1px solid var(--b1);color:var(--t1);font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.12s;}
.set-num-btn:hover{background:var(--sh);}
.set-num-val{font-size:14px;font-weight:600;color:var(--t1);min-width:28px;text-align:center;font-variant-numeric:tabular-nums;}

/* INFO */
.set-info-row{display:flex;align-items:center;justify-content:space-between;padding:13px 20px;gap:16px;}
.set-info-row:hover{background:rgba(255,255,255,0.02);}
.set-info-label{font-size:14px;font-weight:500;color:var(--t1);margin-bottom:2px;}
.set-info-sub{font-size:12px;color:var(--t3);}
.set-info-val{font-size:13px;font-family:'Syne',sans-serif;color:var(--t2);flex-shrink:0;}
.set-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.set-dot.on{background:var(--g);box-shadow:0 0 7px rgba(29,185,84,0.6);animation:pulse 2s ease-in-out infinite;}
.set-dot.off{background:var(--r);}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
.set-status{font-size:13px;font-weight:600;}
.set-status.on{color:var(--g);}
.set-status.off{color:var(--r);}
.set-btn-danger{padding:6px 14px;border-radius:8px;cursor:pointer;background:rgba(255,68,102,0.07);border:1px solid rgba(255,68,102,0.18);color:var(--r);font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;transition:background 0.12s;}
.set-btn-danger:hover{background:rgba(255,68,102,0.14);}

/* ACTIONS */
.set-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:4px 20px 16px;}
.set-action{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px 8px;border-radius:12px;cursor:pointer;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;border:1px solid;transition:background 0.12s,transform 0.12s var(--sp);}
.set-action:hover{transform:translateY(-1px);}
.set-action:active{transform:scale(0.95);}
.set-action-def{background:var(--s1);border-color:var(--b1);color:var(--t2);}
.set-action-def:hover{background:var(--s2);color:var(--t1);}
.set-action-red{background:rgba(255,68,102,0.07);border-color:rgba(255,68,102,0.18);color:var(--r);}
.set-action-red:hover{background:rgba(255,68,102,0.14);}
.set-action-note{font-size:12px;color:var(--t3);line-height:1.55;padding:0 20px 10px;}

/* TOAST */
.set-toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:200;padding:12px 22px;border-radius:9999px;font-size:13px;font-weight:600;white-space:nowrap;border:1px solid;backdrop-filter:blur(24px);animation:toastIn 0.28s var(--sp) both;box-shadow:0 8px 40px rgba(0,0,0,0.5);display:flex;align-items:center;gap:9px;}
.set-toast.success{background:rgba(29,185,84,0.14);border-color:rgba(29,185,84,0.28);color:#7EE9A8;}
.set-toast.error{background:rgba(255,68,102,0.12);border-color:rgba(255,68,102,0.24);color:#FCA5A5;}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

/* UPDATE POPUP */
.sup-overlay{position:fixed;inset:0;z-index:400;background:rgba(0,0,0,0.75);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease both;}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.sup-box{width:min(500px,94vw);background:#0A0C0E;border:1px solid rgba(255,255,255,0.10);border-radius:24px;overflow:hidden;box-shadow:0 48px 120px rgba(0,0,0,0.9);animation:scaleIn 0.32s cubic-bezier(0.22,1,0.36,1) both;max-height:88vh;display:flex;flex-direction:column;}
@keyframes scaleIn{from{opacity:0;transform:scale(0.90)}to{opacity:1;transform:none}}
.sup-header{display:flex;align-items:flex-start;justify-content:space-between;padding:26px 26px 22px;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;}
.sup-eyebrow{font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#1DB954;margin-bottom:5px;}
.sup-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;letter-spacing:-0.03em;color:#fff;}
.sup-close{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);color:rgba(255,255,255,0.45);font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s,color 0.15s;flex-shrink:0;}
.sup-close:hover{background:rgba(255,255,255,0.12);color:#fff;}
.sup-body{overflow-y:auto;padding:22px 26px 30px;display:flex;flex-direction:column;gap:26px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.07) transparent;}
.sup-body::-webkit-scrollbar{width:4px;}
.sup-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07);border-radius:3px;}
.sup-entry{border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:22px;}
.sup-entry:last-child{border-bottom:none;padding-bottom:0;}
.sup-entry-header{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;}
.sup-version{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:#fff;letter-spacing:-0.02em;}
.sup-tag{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:3px 9px;border-radius:9999px;}
.sup-tag.latest{background:rgba(29,185,84,0.16);color:#1DB954;border:1px solid rgba(29,185,84,0.28);}
.sup-tag.stable{background:rgba(96,165,250,0.12);color:#60A5FA;border:1px solid rgba(96,165,250,0.24);}
.sup-date{font-size:12px;color:rgba(255,255,255,0.26);margin-left:auto;}
.sup-list{list-style:none;display:flex;flex-direction:column;gap:9px;}
.sup-item{display:flex;align-items:flex-start;gap:11px;font-size:13px;color:rgba(255,255,255,0.58);line-height:1.55;}
.sup-bullet{width:5px;height:5px;border-radius:50%;background:#1DB954;flex-shrink:0;margin-top:7px;}

/* MOBILE */
@media(max-width:640px){
  .set-shell{flex-direction:column;}
  .set-sidebar{width:100%;flex-direction:row;flex-wrap:nowrap;padding:0;border-right:none;border-bottom:1px solid var(--b1);overflow-x:auto;overflow-y:hidden;background:rgba(4,5,7,0.95);}
  .set-sidebar-logo,.set-nav-section,.set-sidebar-version,.set-nav-divider{display:none;}
  .set-nav-item{flex-shrink:0;flex-direction:column;gap:4px;padding:12px 16px;border-left:none;border-bottom:2px solid transparent;font-size:11px;align-items:center;}
  .set-nav-item.active{border-bottom-color:var(--g);border-left-color:transparent;background:none;}
  .set-nav-icon{font-size:16px;}
  .set-hero{height:160px;}
  .set-identity{padding:0 16px;margin-top:-68px;gap:14px;}
  .set-avatar{width:84px;height:84px;}
  .set-avatar-placeholder{font-size:30px;}
  .set-identity-name{font-size:24px;}
  .set-identity-actions{display:none;}
  .set-stats{padding:14px 16px 0;gap:0;flex-wrap:wrap;}
  .set-stat{padding:0 20px 14px 0;}
  .set-stat-n{font-size:20px;}
  .set-page-header{padding:18px 16px 14px;}
  .set-pl-wrap{padding:16px 16px 80px;}
  .set-pl-grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;}
  .set-form-wrap{padding:8px 16px 80px;}
  .set-grid-2{grid-template-columns:1fr;}
  .set-grid-2 .set-span-2{grid-column:span 1;}
  .set-settings-wrap{padding:8px 16px 80px;}
  .set-actions{grid-template-columns:1fr 1fr;}
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
  const [showUpdate, setShowUpdate] = useState(false);
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

      <div className="set-shell">
        {/* SIDEBAR */}
        <aside className="set-sidebar">
          <div className="set-sidebar-logo">Liquid Bars</div>
          <div className="set-nav-section">Me</div>
          {NAV.filter(n => n.group === 'me').map(n => (
            <button key={n.key} className={`set-nav-item ${tab === n.key ? 'active' : ''}`} onClick={() => setTab(n.key)}>
              <span className="set-nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
          <div className="set-nav-divider" />
          <div className="set-nav-section">App</div>
          {NAV.filter(n => n.group === 'app').map(n => (
            <button key={n.key} className={`set-nav-item ${tab === n.key ? 'active' : ''}`} onClick={() => setTab(n.key)}>
              <span className="set-nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
          <div className="set-sidebar-version">
            <button className="set-sidebar-version-btn" onClick={() => setShowUpdate(true)}>
              <span className="set-sidebar-version-num">v{VERSION}</span>
              <span className="set-sidebar-version-tag">What&apos;s new</span>
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="set-scroll">
          {/* Hero */}
          <div className="set-hero">
            {avatar && <div className="set-hero-bg" style={{ backgroundImage: `url(${avatar})` }} />}
            <div className="set-hero-grain" />
            <div className="set-hero-scrim-top" />
            <div className="set-hero-scrim" />
          </div>

          {/* Identity */}
          <div className="set-identity">
            <div className="set-avatar-wrap">
              <div className="set-avatar">
                {avatar ? <img src={avatar} alt={name} /> : <FaUser className="set-avatar-placeholder" />}
              </div>
              <label className="set-avatar-cam">
                <FaCamera style={{ fontSize: 12, color: '#000' }} />
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
                      <span className="set-badge set-badge-dim" style={{ textTransform: 'capitalize' }}>via {user.app_metadata.provider}</span>
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
                  <FaSignOutAlt style={{ fontSize: 11 }} />{signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
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

          {/* TAB CONTENT */}

          {/* PROFILE */}
          {tab === 'profile' && (
            <>
              <div className="set-page-header">
                <h2 className="set-page-title">Profile</h2>
                <p className="set-page-sub">Your public presence on Liquid Bars</p>
              </div>
              <div className="set-form-wrap">
                <div className="set-form-section">
                  <div className="set-form-section-title">About</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    <div className="set-field">
                      <label className="set-label">Display Name</label>
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="set-input" />
                    </div>
                    <div className="set-field">
                      <label className="set-label">Bio</label>
                      <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} placeholder="Tell your story…" className="set-input set-textarea" />
                    </div>
                    <div className="set-field">
                      <label className="set-label">Location</label>
                      <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" className="set-input" />
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:12, marginTop:8 }}>
                  <button onClick={saveProfile} className={`set-btn-primary ${saved ? 'saved' : ''}`} style={{ alignSelf:'flex-start' }}>
                    {saved ? <FaCheckCircle /> : <FaSave />}{saved ? 'Saved!' : 'Save Profile'}
                  </button>
                  {user && (
                    <button onClick={handleSignOut} disabled={signingOut} className="set-btn-ghost" style={{ alignSelf:'flex-start' }}>
                      <FaSignOutAlt style={{ fontSize:11 }} />{signingOut ? 'Signing out…' : 'Sign Out'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* PLAYLISTS */}
          {tab === 'playlists' && (
            <>
              <div className="set-page-header">
                <h2 className="set-page-title">Your Playlists</h2>
                <p className="set-page-sub">{plCount} playlist{plCount !== 1 ? 's' : ''} created</p>
              </div>
              <div className="set-pl-wrap">
                {plCount === 0 ? (
                  <div className="set-pl-grid">
                    <div className="set-pl-empty">
                      <div className="set-pl-empty-icon">🎵</div>
                      <p className="set-pl-empty-title">No playlists yet</p>
                      <p className="set-pl-empty-sub">Head to Playlists to create your first one</p>
                    </div>
                  </div>
                ) : (
                  <div className="set-pl-grid">
                    {playlists.filter(p => !p._hidden).map((pl, idx) => {
                      const covers = (pl.songs || []).slice(0,4).map(s => s.cover).filter(Boolean);
                      return (
                        <div key={pl.id} className="set-pl-tile" style={{ animationDelay:`${idx * 0.04}s` }}>
                          <div className="set-pl-cover">
                            {covers.length >= 4 ? (
                              <div className="set-pl-mosaic">
                                {covers.map((c,i) => <img key={i} src={c} alt="" onError={e => { e.target.src='/default-cover.png'; }} />)}
                              </div>
                            ) : (
                              <img src={covers[0]||'/default-cover.png'} alt={pl.name}
                                style={{ width:'100%',height:'100%',objectFit:'cover' }}
                                onError={e => { e.target.src='/default-cover.png'; }} />
                            )}
                          </div>
                          <div className="set-pl-info">
                            <p className="set-pl-name">{pl.name}</p>
                            <p className="set-pl-count">{(pl.songs||[]).length} songs</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ACCOUNT */}
          {tab === 'account' && (
            <>
              <div className="set-page-header">
                <h2 className="set-page-title">Account</h2>
                <p className="set-page-sub">Manage your personal information</p>
              </div>
              <div className="set-form-wrap">
                <div className="set-form-section">
                  <div className="set-form-section-title">Personal Information</div>
                  <div className="set-grid-2">
                    <div className="set-field">
                      <label className="set-label">Display Name</label>
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="set-input" />
                    </div>
                    <div className="set-field">
                      <label className="set-label">Email {user && <span>— managed by provider</span>}</label>
                      <input type="email" value={user?.email||email} onChange={e => !user && setEmail(e.target.value)} placeholder="you@example.com" className="set-input" readOnly={!!user} />
                    </div>
                    <div className="set-field">
                      <label className="set-label">Phone</label>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900" className="set-input" />
                    </div>
                    <div className="set-field">
                      <label className="set-label">Location</label>
                      <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" className="set-input" />
                    </div>
                    <div className="set-field set-span-2">
                      <label className="set-label">Bio</label>
                      <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself…" className="set-input set-textarea" />
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:12, marginTop:8 }}>
                  <button onClick={saveProfile} className={`set-btn-primary ${saved ? 'saved' : ''}`} style={{ alignSelf:'flex-start' }}>
                    {saved ? <FaCheckCircle /> : <FaSave />}{saved ? 'Saved!' : 'Save Changes'}
                  </button>
                  {user && (
                    <button onClick={handleSignOut} disabled={signingOut} className="set-btn-ghost" style={{ alignSelf:'flex-start' }}>
                      <FaSignOutAlt style={{ fontSize:11 }} />{signingOut ? 'Signing out…' : 'Sign Out'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* PLAYBACK */}
          {tab === 'playback' && (
            <>
              <div className="set-page-header">
                <h2 className="set-page-title">Playback</h2>
                <p className="set-page-sub">Audio, downloads, and notifications</p>
              </div>
              <div className="set-settings-wrap">
                <Card icon={<FaSlidersH />} iconStyle="green" title="Audio" subtitle="Crossfade, equalizer, and gapless playback">
                  <Slider label="Crossfade" value={crossfade} onChange={setCrossfade} min={0} max={12} unit="s" description="Blend between tracks" />
                  <div className="set-row-divider" />
                  <Toggle label="Gapless Playback" description="No silence between tracks" checked={gapless} onChange={setGapless} />
                  <div className="set-row-divider" />
                  <Toggle label="Equalizer" description="Apply EQ to audio output" checked={equalizer} onChange={setEqualizer} />
                  {equalizer && (<><div className="set-row-divider" /><SelectRow label="EQ Preset" value={eqPreset} onChange={setEqPreset} options={[{value:'flat',label:'Flat'},{value:'bass',label:'Bass Boost'},{value:'vocal',label:'Vocal'},{value:'treble',label:'Treble'}]} /></>)}
                </Card>
                <Card icon={<FaDownload />} iconStyle="purple" title="Downloads" subtitle="Auto-download, quality, and limits">
                  <Toggle label="Auto-download" description="Download favorited tracks automatically" checked={autoDownload} onChange={setAutoDownload} />
                  <div className="set-row-divider" />
                  <Toggle label="Wi-Fi only" description="Don't download on mobile data" checked={onlyWifi} onChange={setOnlyWifi} />
                  <div className="set-row-divider" />
                  <SelectRow label="Quality" value={downloadQuality} onChange={setDownloadQuality} description="Higher quality uses more storage" options={[{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]} />
                  <div className="set-row-divider" />
                  <NumberRow label="Max concurrent" value={maxDownloads} onChange={setMaxDownloads} min={1} max={10} description="Downloads running at once" />
                </Card>
                <Card icon={<FaMoon />} iconStyle="blue" title="General" subtitle="Theme, notifications, and interface">
                  <Toggle label="Dark mode" description="Use dark color scheme" checked={darkMode} onChange={setDarkMode} />
                  <div className="set-row-divider" />
                  <Toggle label="Notifications" description="Show playback notifications" checked={notifications} onChange={setNotifications} />
                  {notifications && (<><div className="set-row-divider" /><Slider label="Notification volume" value={notifVolume} onChange={setNotifVolume} unit="%" /></>)}
                </Card>
                <Card icon={<FaShieldAlt />} iconStyle="red" title="Privacy" subtitle="Analytics and remote control">
                  <Toggle label="Usage analytics" description="Help improve the app anonymously" checked={analytics} onChange={setAnalytics} />
                  <div className="set-row-divider" />
                  <Toggle label="Remote control" description="Allow controlling from other devices" checked={remoteControl} onChange={setRemoteControl} />
                </Card>
              </div>
            </>
          )}

          {/* STORAGE */}
          {tab === 'storage' && (
            <>
              <div className="set-page-header">
                <h2 className="set-page-title">Storage</h2>
                <p className="set-page-sub">Cache, connection, and app data</p>
              </div>
              <div className="set-settings-wrap">
                <Card icon={<FaDownload />} iconStyle="green" title="Storage" subtitle="Cache and offline content">
                  <div className="set-info-row">
                    <div><p className="set-info-label">Cache Size</p><p className="set-info-sub">Temporary files</p></div>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span className="set-info-val">{cacheSize}</span>
                      <button className="set-btn-danger" onClick={() => showToast('Cache cleared')}>Clear</button>
                    </div>
                  </div>
                  <div className="set-row-divider" />
                  <Slider label="Max cache size" value={maxCache} onChange={setMaxCache} min={50} max={5000} unit=" MB" description="Storage limit for offline content" />
                </Card>
                <Card icon={<FaCog />} iconStyle="blue" title="System" subtitle="Connection and version info">
                  <div className="set-info-row">
                    <div><p className="set-info-label">Connection</p><p className="set-info-sub">Current network status</p></div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div className={`set-dot ${isOnline ? 'on' : 'off'}`} />
                      <span className={`set-status ${isOnline ? 'on' : 'off'}`}>{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                  <div className="set-row-divider" />
                  <div className="set-info-row">
                    <div><p className="set-info-label">App Version</p><p className="set-info-sub">Built {BUILD_DATE}</p></div>
                    <span className="set-info-val">v{VERSION}</span>
                  </div>
                  {user && (<><div className="set-row-divider" /><div className="set-info-row"><div><p className="set-info-label">Account</p><p className="set-info-sub">{user.email}</p></div><button onClick={handleSignOut} disabled={signingOut} className="set-btn-danger">{signingOut ? '…' : 'Sign Out'}</button></div></>)}
                </Card>
                <Card icon={<FaSlidersH />} iconStyle="amber" title="Advanced" subtitle="Export, import, and reset" note="Export your settings to back them up or transfer to another device.">
                  <div className="set-actions">
                    <button onClick={exportSettings} className="set-action set-action-def"><FaClipboard style={{ fontSize:11 }} /> Export</button>
                    <button onClick={importSettings} className="set-action set-action-def"><FaFileImport style={{ fontSize:11 }} /> Import</button>
                    <button onClick={resetDefaults} className="set-action set-action-red"><FaRedoAlt style={{ fontSize:11 }} /> Reset</button>
                  </div>
                </Card>
              </div>
            </>
          )}

        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}