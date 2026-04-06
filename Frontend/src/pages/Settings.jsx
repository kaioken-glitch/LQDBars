import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaUser, FaCamera, FaSave, FaDownload, FaSlidersH,
  FaMoon, FaShieldAlt, FaCheckCircle, FaExclamationCircle,
  FaClipboard, FaFileImport, FaRedoAlt, FaSignOutAlt, FaTimes,
  FaSearch,
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
    'Settings page — editorial repository redesign',
    'HomeOnline — Apple Music-style horizontal shelves, greeting hero',
  ]},
  { version: '1.3.0', date: '2026-03-04', tag: 'Stable', changes: [
    'YouTube streaming via yt-dlp backend — instant playback',
    'HomeOnline localStorage cache — preserves daily API quota',
    'LRCLIB synced lyrics with karaoke-style green fill sweep',
    'Playlists: single source of truth via usePlaylists hook',
  ]},
  { version: '1.2.0', date: '2026-02-28', tag: null, changes: [
    'YouTube playlist import via Piped API',
    'Local file import to playlists',
    'Queue management and shuffle/repeat controls',
    'Mobile mini-player with expand to full-screen',
  ]},
];

function Counter({ to, duration = 800 }) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (to === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = now => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration]);
  return <>{val.toLocaleString()}</>;
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
          <div><div className="sup-eyebrow">Release Notes</div><div className="sup-title">What's New</div></div>
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

.sr{width:100%;height:100%;display:flex;flex-direction:column;--g:#1DB954;--g2:#23E065;--r:#FF4466;--a:#F59E0B;--p:#A78BFA;--bl:#60A5FA;--t1:#FFFFFF;--t2:rgba(255,255,255,0.55);--t3:rgba(255,255,255,0.28);--s1:rgba(255,255,255,0.03);--s2:rgba(255,255,255,0.06);--b1:rgba(255,255,255,0.07);--b2:rgba(255,255,255,0.11);--bg:#07080A;--sp:cubic-bezier(0.22,1,0.36,1);font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;background:var(--bg);color:var(--t1);}
.sr *,.sr *::before,.sr *::after{box-sizing:border-box;margin:0;padding:0;}
.sr-shell{width:100%;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;}
.sr-scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.06) transparent;}
.sr-scroll::-webkit-scrollbar{width:3px;}
.sr-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.06);border-radius:2px;}

/* Hero */
.sr-hero{position:relative;height:200px;overflow:hidden;flex-shrink:0;background:#07080A;}
.sr-hero-bg{position:absolute;inset:-40px;background-size:cover;background-position:center top;filter:blur(48px) saturate(1.2) brightness(0.32);transform:scale(1.15);transition:background-image .9s ease;}
.sr-hero-scrim{position:absolute;inset:0;background:linear-gradient(to top,#07080A 0%,rgba(7,8,10,.45) 60%,transparent 100%);}

/* Identity */
.sr-identity{display:flex;align-items:flex-end;gap:20px;padding:0 32px;margin-top:-60px;position:relative;z-index:2;flex-shrink:0;}
.sr-av-wrap{position:relative;flex-shrink:0;width:100px;height:100px;}
.sr-av{width:100px;height:100px;border-radius:50%;overflow:hidden;border:3px solid #07080A;background:linear-gradient(135deg,rgba(29,185,84,.2),rgba(0,0,0,.4));display:flex;align-items:center;justify-content:center;transition:transform .3s var(--sp);}
.sr-av:hover{transform:scale(1.04);}
.sr-av img{width:100%;height:100%;object-fit:cover;}
.sr-av-placeholder{color:rgba(255,255,255,.18);font-size:34px;}
.sr-av-cam{position:absolute;bottom:2px;right:2px;width:28px;height:28px;border-radius:50%;background:var(--g);border:2.5px solid #07080A;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .15s var(--sp),background .15s;}
.sr-av-cam:hover{transform:scale(1.12);background:var(--g2);}
.sr-av-cam input{display:none;}
.sr-itext{flex:1;min-width:0;padding-bottom:10px;}
.sr-role{font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--g);margin-bottom:3px;}
.sr-name{font-family:'Syne',sans-serif;font-size:clamp(20px,3vw,34px);font-weight:800;letter-spacing:-.04em;color:#fff;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;}
.sr-email{font-size:12px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:8px;}
.sr-badges{display:flex;flex-wrap:wrap;gap:5px;}
.sr-badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:9999px;font-size:10px;font-weight:600;border:1px solid;}
.sr-badge-g{background:rgba(29,185,84,.1);color:var(--g);border-color:rgba(29,185,84,.22);}
.sr-badge-d{background:var(--s1);color:var(--t3);border-color:var(--b1);}
.sr-iactions{display:flex;gap:8px;align-items:center;flex-shrink:0;padding-bottom:10px;}
.sr-btn-save{display:inline-flex;align-items:center;gap:6px;padding:9px 20px;border-radius:9999px;background:var(--g);color:#000;border:none;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s var(--sp);box-shadow:0 2px 12px rgba(29,185,84,.28);}
.sr-btn-save:hover{background:var(--g2);transform:scale(1.04);}
.sr-btn-save.saved{background:rgba(29,185,84,.1);color:var(--g);border:1px solid rgba(29,185,84,.22);box-shadow:none;}
.sr-btn-out{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:9999px;cursor:pointer;background:transparent;border:1px solid var(--b1);color:var(--t3);font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;transition:border-color .15s,color .15s,background .15s;}
.sr-btn-out:hover{border-color:rgba(255,68,102,.4);color:var(--r);background:rgba(255,68,102,.06);}
.sr-btn-out:disabled{opacity:.5;cursor:not-allowed;}

/* Stats */
.sr-stats{display:flex;align-items:stretch;padding:0 32px;border-bottom:1px solid var(--b1);flex-shrink:0;position:relative;z-index:2;}
.sr-stat{display:flex;flex-direction:column;gap:1px;padding:16px 28px 16px 0;margin-right:28px;border-right:1px solid var(--b1);}
.sr-stat:last-child{border-right:none;}
.sr-stat-n{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#fff;letter-spacing:-.03em;}
.sr-stat-l{font-size:11px;color:var(--t3);font-weight:500;margin-top:1px;}

/* Tabs */
.sr-tabs{display:flex;gap:0;padding:0 32px;border-bottom:1px solid var(--b1);flex-shrink:0;position:relative;z-index:2;}
.sr-tab{padding:13px 0;margin-right:24px;font-size:13px;font-weight:600;color:var(--t3);background:none;border:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .15s,border-color .15s;font-family:'DM Sans',sans-serif;white-space:nowrap;}
.sr-tab:hover{color:var(--t2);}
.sr-tab.active{color:#fff;border-bottom-color:var(--g);}

/* Content */
.sr-content{padding:28px 32px 120px;position:relative;z-index:2;max-width:800px;}

/* Playlist grid */
.sr-pl-head{margin-bottom:18px;}
.sr-pl-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;letter-spacing:-.025em;color:#fff;margin-bottom:2px;}
.sr-pl-sub{font-size:12px;color:var(--t3);}
.sr-pl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:6px;margin-bottom:32px;}
.sr-pl-tile{padding:10px;border-radius:8px;cursor:pointer;background:transparent;transition:background .15s;}
.sr-pl-tile:hover{background:rgba(255,255,255,.06);}
.sr-pl-cover{width:100%;aspect-ratio:1;border-radius:5px;overflow:hidden;margin-bottom:10px;background:#111;}
.sr-pl-mosaic{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;height:100%;gap:1px;}
.sr-pl-mosaic img,.sr-pl-cover-single img{width:100%;height:100%;object-fit:cover;display:block;}
.sr-pl-cover-single{width:100%;height:100%;}
.sr-pl-cover-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--s2);font-size:28px;color:rgba(29,185,84,.2);}
.sr-pl-tile-name{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px;}
.sr-pl-tile-count{font-size:11px;color:var(--t2);}
.sr-pl-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:140px;gap:10px;text-align:center;border:1px dashed var(--b1);border-radius:10px;padding:32px 24px;margin-bottom:32px;}
.sr-pl-empty-icon{font-size:26px;color:var(--t3);}
.sr-pl-empty-title{font-size:13px;font-weight:600;color:var(--t2);}
.sr-pl-empty-sub{font-size:12px;color:var(--t3);}

/* Social */
.sr-social{display:flex;gap:8px;flex-wrap:wrap;}
.sr-social-card{flex:1;min-width:100px;padding:14px 16px;border-radius:10px;border:1px solid var(--b1);background:var(--s1);}
.sr-social-n{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.04em;}
.sr-social-l{font-size:11px;color:var(--t3);margin-top:2px;}
.sr-social-note{font-size:10px;color:var(--t3);opacity:.5;margin-top:2px;}

/* Settings tab */
.sr-search-wrap{position:relative;margin-bottom:24px;}
.sr-search-ico{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:12px;pointer-events:none;}
.sr-search{width:100%;padding:10px 14px 10px 38px;background:var(--s1);border:1px solid var(--b1);border-radius:9px;color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:border-color .15s,background .15s;}
.sr-search:focus{border-color:rgba(29,185,84,.4);background:var(--s2);}
.sr-search::placeholder{color:var(--t3);}

/* Section label */
.sr-section{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--t3);padding:22px 0 10px;}
.sr-section:first-child{padding-top:0;}

/* Repository rows — the core primitive */
.sr-rows{border:1px solid var(--b1);border-radius:10px;overflow:hidden;margin-bottom:6px;}
.sr-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;gap:16px;border-bottom:1px solid var(--b1);min-height:50px;transition:background .12s;}
.sr-row:last-child{border-bottom:none;}
.sr-row:hover{background:rgba(255,255,255,.022);}
.sr-row.no-hover:hover{background:transparent;}
.sr-row-left{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}
.sr-row-label{font-size:13px;font-weight:500;color:var(--t1);}
.sr-row-desc{font-size:11px;color:var(--t3);line-height:1.4;}
.sr-row-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.sr-row-input{background:var(--s2);border:1px solid var(--b1);border-radius:8px;color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;padding:7px 11px;outline:none;width:100%;transition:border-color .15s;}
.sr-row-input:focus{border-color:rgba(29,185,84,.4);}
.sr-row-input::placeholder{color:var(--t3);}
.sr-row-input[readonly]{opacity:.4;cursor:not-allowed;}
.sr-row-textarea{resize:vertical;min-height:68px;}

/* Full input rows */
.sr-field{display:flex;flex-direction:column;gap:6px;padding:12px 16px;border-bottom:1px solid var(--b1);}
.sr-field:last-child{border-bottom:none;}
.sr-field-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);}

/* Toggle */
.sr-switch{position:relative;width:40px;height:22px;border-radius:11px;border:none;cursor:pointer;flex-shrink:0;transition:background .22s;}
.sr-switch.on{background:var(--g);}
.sr-switch.off{background:rgba(255,255,255,.13);}
.sr-switch-t{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.28);transition:transform .22s var(--sp);}
.sr-switch.on .sr-switch-t{transform:translateX(18px);}

/* Slider */
.sr-slider-wrap{display:flex;flex-direction:column;gap:10px;width:100%;}
.sr-slider-top{display:flex;align-items:center;justify-content:space-between;}
.sr-slider-label{font-size:13px;font-weight:500;color:var(--t1);}
.sr-slider-desc{font-size:11px;color:var(--t3);}
.sr-slider-val{font-size:12px;font-weight:700;color:var(--g);font-family:'Syne',sans-serif;}
.sr-track{position:relative;height:3px;background:rgba(255,255,255,.08);border-radius:2px;}
.sr-fill{position:absolute;left:0;top:0;height:100%;background:var(--g);border-radius:inherit;pointer-events:none;}
.sr-thumb-dot{position:absolute;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid var(--g);box-shadow:0 1px 5px rgba(0,0,0,.28);pointer-events:none;}
.sr-range{position:absolute;inset:-8px 0;width:100%;opacity:0;cursor:pointer;height:calc(100% + 16px);}

/* Select */
.sr-select{background:var(--s2);border:1px solid var(--b1);color:var(--t1);font-family:'DM Sans',sans-serif;font-size:12px;padding:6px 26px 6px 10px;border-radius:8px;outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(255,255,255,0.35)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;min-width:95px;}
.sr-select:focus{border-color:rgba(29,185,84,.4);}
.sr-select option{background:#111315;}

/* Number */
.sr-num{display:flex;align-items:center;gap:6px;}
.sr-num-btn{width:26px;height:26px;border-radius:7px;background:var(--s2);border:1px solid var(--b1);color:var(--t1);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .12s;}
.sr-num-btn:hover{background:rgba(255,255,255,.1);}
.sr-num-val{font-size:13px;font-weight:600;color:var(--t1);min-width:24px;text-align:center;}

/* Info */
.sr-info-val{font-size:12px;font-family:'Syne',sans-serif;color:var(--t2);}
.sr-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.sr-dot.on{background:var(--g);animation:srPulse 2s ease-in-out infinite;}
.sr-dot.off{background:var(--r);}
@keyframes srPulse{0%,100%{opacity:1}50%{opacity:.4}}
.sr-status{font-size:12px;font-weight:600;}
.sr-status.on{color:var(--g);}
.sr-status.off{color:var(--r);}
.sr-clear-btn{padding:4px 9px;border-radius:6px;cursor:pointer;background:transparent;border:1px solid rgba(255,68,102,.22);color:var(--r);font-size:11px;font-weight:600;transition:background .12s;}
.sr-clear-btn:hover{background:rgba(255,68,102,.08);}

/* Actions */
.sr-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:12px 16px;}
.sr-action{display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 8px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;transition:background .12s,transform .1s var(--sp);border:1px solid;}
.sr-action:active{transform:scale(.96);}
.sr-action-d{background:transparent;border-color:var(--b1);color:var(--t2);}
.sr-action-d:hover{background:var(--s2);color:var(--t1);}
.sr-action-r{background:transparent;border-color:rgba(255,68,102,.2);color:var(--r);}
.sr-action-r:hover{background:rgba(255,68,102,.08);}

/* Button row inside rows */
.sr-btn-row{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--b1);}

/* FAB */
.sr-fab{position:fixed;bottom:90px;right:20px;z-index:50;display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:9999px;background:rgba(8,10,12,.9);border:1px solid var(--b1);cursor:pointer;color:var(--t3);font-size:11px;font-family:'DM Sans',sans-serif;transition:border-color .15s,color .15s;}
.sr-fab:hover{border-color:rgba(29,185,84,.35);color:var(--g);}

/* Update popup */
.sup-overlay{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.7);backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;animation:supFade .2s ease both;}
@keyframes supFade{from{opacity:0}to{opacity:1}}
.sup-box{width:min(460px,93vw);background:#0C0E10;border:1px solid rgba(255,255,255,.1);border-radius:20px;overflow:hidden;max-height:82vh;display:flex;flex-direction:column;animation:supScale .28s var(--sp) both;}
@keyframes supScale{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
.sup-header{display:flex;align-items:flex-start;justify-content:space-between;padding:22px 22px 18px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;}
.sup-eyebrow{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#1DB954;margin-bottom:4px;}
.sup-title{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;letter-spacing:-.03em;color:#fff;}
.sup-close{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.45);font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .12s;}
.sup-close:hover{background:rgba(255,255,255,.1);color:#fff;}
.sup-body{overflow-y:auto;padding:18px 22px 24px;display:flex;flex-direction:column;gap:20px;scrollbar-width:thin;}
.sup-entry{border-bottom:1px solid rgba(255,255,255,.05);padding-bottom:18px;}
.sup-entry:last-child{border-bottom:none;padding-bottom:0;}
.sup-entry-header{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
.sup-version{font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:#fff;}
.sup-tag{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:9999px;}
.sup-tag.latest{background:rgba(29,185,84,.15);color:#1DB954;border:1px solid rgba(29,185,84,.28);}
.sup-tag.stable{background:rgba(96,165,250,.1);color:#60A5FA;border:1px solid rgba(96,165,250,.22);}
.sup-date{font-size:11px;color:rgba(255,255,255,.25);margin-left:auto;}
.sup-list{list-style:none;display:flex;flex-direction:column;gap:7px;}
.sup-item{display:flex;align-items:flex-start;gap:9px;font-size:12px;color:rgba(255,255,255,.55);line-height:1.55;}
.sup-bullet{width:4px;height:4px;border-radius:50%;background:#1DB954;flex-shrink:0;margin-top:7px;}

/* Toast */
.sr-toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:200;padding:9px 16px;border-radius:9999px;font-size:12px;font-weight:600;white-space:nowrap;border:1px solid;animation:srToast .22s var(--sp) both;display:flex;align-items:center;gap:7px;cursor:pointer;}
.sr-toast.success{background:rgba(29,185,84,.12);border-color:rgba(29,185,84,.28);color:#6EE7A0;}
.sr-toast.error{background:rgba(255,68,102,.1);border-color:rgba(255,68,102,.22);color:#FCA5A5;}
@keyframes srToast{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

/* Mobile */
@media(max-width:640px){
  .sr-identity{padding:0 16px;margin-top:-50px;gap:12px;flex-wrap:wrap;}
  .sr-av-wrap,.sr-av{width:84px;height:84px;}
  .sr-iactions{width:100%;}
  .sr-stats{padding:0 16px;}
  .sr-tabs{padding:0 16px;}
  .sr-content{padding:20px 16px 120px;}
  .sr-pl-grid{grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:5px;}
  .sr-hero{height:148px;}
  .sr-fab{bottom:80px;right:12px;}
  .sr-actions{grid-template-columns:1fr 1fr;}
}
`;

/* ── Primitives ── */
function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)} className={`sr-switch ${checked ? 'on' : 'off'}`}>
      <div className="sr-switch-t" />
    </button>
  );
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="sr-row">
      <div className="sr-row-left">
        <span className="sr-row-label">{label}</span>
        {desc && <span className="sr-row-desc">{desc}</span>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function SelectRow({ label, desc, value, onChange, options }) {
  return (
    <div className="sr-row">
      <div className="sr-row-left">
        <span className="sr-row-label">{label}</span>
        {desc && <span className="sr-row-desc">{desc}</span>}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} className="sr-select">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function NumberRow({ label, desc, value, onChange, min, max }) {
  return (
    <div className="sr-row">
      <div className="sr-row-left">
        <span className="sr-row-label">{label}</span>
        {desc && <span className="sr-row-desc">{desc}</span>}
      </div>
      <div className="sr-num">
        <button className="sr-num-btn" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <span className="sr-num-val">{value}</span>
        <button className="sr-num-btn" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

function SliderRow({ label, desc, value, onChange, min = 0, max = 100, unit = '' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="sr-row no-hover" style={{ flexDirection:'column', alignItems:'stretch', gap:10, paddingTop:14, paddingBottom:14 }}>
      <div className="sr-slider-wrap">
        <div className="sr-slider-top">
          <div>
            <div className="sr-slider-label">{label}</div>
            {desc && <div className="sr-slider-desc">{desc}</div>}
          </div>
          <span className="sr-slider-val">{value}{unit}</span>
        </div>
        <div className="sr-track">
          <div className="sr-fill" style={{ width:`${pct}%` }} />
          <div className="sr-thumb-dot" style={{ left:`${pct}%` }} />
          <input type="range" min={min} max={max} value={value}
            onChange={e => onChange(Number(e.target.value))} className="sr-range" />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, desc, right }) {
  return (
    <div className="sr-row">
      <div className="sr-row-left">
        <span className="sr-row-label">{label}</span>
        {desc && <span className="sr-row-desc">{desc}</span>}
      </div>
      <div className="sr-row-right">{right}</div>
    </div>
  );
}

export default function Settings() {
  const [tab,           setTab]           = useState('profile');
  const [toast,         setToast]         = useState(null);
  const [saved,         setSaved]         = useState(false);
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
  const [isOnline,        setIsOnline]        = useState(() => navigator.onLine);

  useEffect(() => { localStorage.setItem('lb:darkMode', darkMode); darkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark'); }, [darkMode]);
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

  const saveProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed)           { showToast('Display name cannot be empty', 'error'); return; }
    if (trimmed.length < 2) { showToast('Name must be at least 2 characters', 'error'); return; }
    if (trimmed.length > 40){ showToast('Name must be 40 characters or less', 'error'); return; }
    localStorage.setItem('lb:profileName', trimmed);
    localStorage.setItem('lb:profileEmail', email);
    localStorage.setItem('lb:profilePhone', phone);
    localStorage.setItem('lb:profileLocation', location);
    localStorage.setItem('lb:profileBio', bio);
    localStorage.setItem('lb:profileAvatar', avatar);
    if (user) {
      const { data: existing } = await supabase.from('profiles').select('id').eq('display_name', trimmed).neq('id', user.id).maybeSingle();
      if (existing) { showToast('That username is already taken', 'error'); return; }
      const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: trimmed, avatar_url: avatar, phone, location, bio, updated_at: new Date().toISOString() });
      if (error) { showToast('Save failed: ' + error.message, 'error'); return; }
      setName(trimmed);
    }
    setSaved(true); setTimeout(() => setSaved(false), 2200); showToast('Profile saved!');
  };

  const handleAvatar = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (user) {
      const ext = f.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, f, { upsert: true });
      if (upErr) { const r = new FileReader(); r.onload = ev => setAvatar(ev.target.result); r.readAsDataURL(f); showToast('Upload failed — using local preview', 'error'); return; }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatar(data.publicUrl);
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: data.publicUrl, updated_at: new Date().toISOString() });
      showToast('Avatar updated!');
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
    const raw = prompt('Paste settings JSON:'); if (!raw) return;
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
  const q = settingsQuery.toLowerCase();
  const show = (...words) => !q || words.some(w => w.includes(q));

  return (
    <div className="sr" style={{ minHeight:0 }}>
      <style>{CSS}</style>
      {showUpdate && <UpdatePopup onClose={() => setShowUpdate(false)} />}

      <button className="sr-fab" onClick={() => setShowUpdate(true)}>
        <span>v{VERSION}</span>
        <span style={{ opacity:.3 }}>·</span>
        <span style={{ color:'var(--g)', fontSize:10 }}>What's new</span>
      </button>

      <div className="sr-shell">
        <div className="sr-scroll">

          {/* Hero */}
          <div className="sr-hero">
            {avatar && <div className="sr-hero-bg" style={{ backgroundImage:`url(${avatar})` }} />}
            <div className="sr-hero-scrim" />
          </div>

          {/* Identity */}
          <div className="sr-identity">
            <div className="sr-av-wrap">
              <div className="sr-av">
                {avatar ? <img src={avatar} alt={name} /> : <FaUser className="sr-av-placeholder" />}
              </div>
              <label className="sr-av-cam">
                <FaCamera style={{ fontSize:11, color:'#000' }} />
                <input type="file" accept="image/*" onChange={handleAvatar} />
              </label>
            </div>
            <div className="sr-itext">
              <div className="sr-role">{user ? 'Listener' : 'Local Mode'}</div>
              <h1 className="sr-name">{name || 'Music Lover'}</h1>
              <p className="sr-email">{user?.email || email || 'No email set'}</p>
              <div className="sr-badges">
                {user ? (
                  <>
                    <span className="sr-badge sr-badge-g">Signed In</span>
                    {user.app_metadata?.provider && (
                      <span className="sr-badge sr-badge-d" style={{ textTransform:'capitalize' }}>via {user.app_metadata.provider}</span>
                    )}
                  </>
                ) : <span className="sr-badge sr-badge-d">Local Mode</span>}
              </div>
            </div>
            <div className="sr-iactions">
              <button onClick={saveProfile} className={`sr-btn-save ${saved ? 'saved' : ''}`}>
                {saved ? <FaCheckCircle /> : <FaSave />} {saved ? 'Saved' : 'Save'}
              </button>
              {user && (
                <button onClick={handleSignOut} disabled={signingOut} className="sr-btn-out">
                  <FaSignOutAlt style={{ fontSize:10 }} /> {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="sr-stats">
            {[{ n: plCount, l: 'Playlists' }, { n: 0, l: 'Following' }, { n: 0, l: 'Followers' }].map(({ n, l }) => (
              <div key={l} className="sr-stat">
                <span className="sr-stat-n"><Counter to={n} /></span>
                <span className="sr-stat-l">{l}</span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="sr-tabs">
            {[['profile','Profile'],['app','Settings']].map(([key, label]) => (
              <button key={key} className={`sr-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          <div className="sr-content">

            {/* ── Profile ── */}
            {tab === 'profile' && (
              <>
                <div className="sr-pl-head">
                  <h2 className="sr-pl-title">Your Playlists</h2>
                  <p className="sr-pl-sub">{plCount} playlist{plCount !== 1 ? 's' : ''}</p>
                </div>

                {plCount === 0 ? (
                  <div className="sr-pl-empty">
                    <div className="sr-pl-empty-icon">🎵</div>
                    <p className="sr-pl-empty-title">No playlists yet</p>
                    <p className="sr-pl-empty-sub">Head to Playlists to create your first one</p>
                  </div>
                ) : (
                  <div className="sr-pl-grid">
                    {playlists.filter(p => !p._hidden).map((pl, i) => {
                      const covers = (pl.songs || []).slice(0, 4).map(s => s.cover).filter(Boolean);
                      return (
                        <div key={pl.id} className="sr-pl-tile">
                          <div className="sr-pl-cover">
                            {covers.length === 0 ? (
                              <div className="sr-pl-cover-empty">🎵</div>
                            ) : covers.length >= 4 ? (
                              <div className="sr-pl-mosaic">
                                {covers.map((c, j) => <img key={j} src={c} alt="" onError={e => { e.target.style.display = 'none'; }} />)}
                              </div>
                            ) : (
                              <div className="sr-pl-cover-single">
                                <img src={covers[0]} alt={pl.name} onError={e => { e.target.style.display = 'none'; }} />
                              </div>
                            )}
                          </div>
                          <div className="sr-pl-tile-name">{pl.name}</div>
                          <div className="sr-pl-tile-count">{(pl.songs || []).length} songs</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="sr-social">
                  {[['0','Following'],['0','Followers']].map(([n, l]) => (
                    <div key={l} className="sr-social-card">
                      <div className="sr-social-n">{n}</div>
                      <div className="sr-social-l">{l}</div>
                      <div className="sr-social-note">Coming soon</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Settings ── */}
            {tab === 'app' && (
              <>
                <div className="sr-search-wrap">
                  <FaSearch className="sr-search-ico" />
                  <input className="sr-search" type="text" value={settingsQuery}
                    onChange={e => setSettingsQuery(e.target.value)} placeholder="Search settings…" />
                </div>

                {show('account','name','email','bio','location') && (<>
                  <div className="sr-section">Account</div>
                  <div className="sr-rows">
                    <div className="sr-field">
                      <div className="sr-field-label">Display Name</div>
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="sr-row-input" />
                    </div>
                    <div className="sr-field">
                      <div className="sr-field-label">Email {user && <span style={{ color:'var(--t3)',fontWeight:400,fontSize:10,textTransform:'none',letterSpacing:0,marginLeft:5 }}>managed by provider</span>}</div>
                      <input type="email" value={user?.email||email} onChange={e => !user && setEmail(e.target.value)} placeholder="you@example.com" className="sr-row-input" readOnly={!!user} />
                    </div>
                    <div className="sr-field">
                      <div className="sr-field-label">Location</div>
                      <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" className="sr-row-input" />
                    </div>
                    <div className="sr-field">
                      <div className="sr-field-label">Bio</div>
                      <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself…" className="sr-row-input sr-row-textarea" />
                    </div>
                    <div className="sr-btn-row">
                      <button onClick={saveProfile} className={`sr-btn-save ${saved ? 'saved' : ''}`}>{saved ? <FaCheckCircle /> : <FaSave />} {saved ? 'Saved' : 'Save profile'}</button>
                      {user && <button onClick={handleSignOut} disabled={signingOut} className="sr-btn-out"><FaSignOutAlt style={{ fontSize:10 }} /> {signingOut ? 'Signing out…' : 'Sign out'}</button>}
                    </div>
                  </div>
                </>)}

                {show('audio','crossfade','gapless','equalizer','playback') && (<>
                  <div className="sr-section">Audio &amp; Playback</div>
                  <div className="sr-rows">
                    <SliderRow label="Crossfade" desc="Blend between tracks" value={crossfade} onChange={setCrossfade} min={0} max={12} unit="s" />
                    <ToggleRow label="Gapless Playback" desc="No silence between tracks" checked={gapless} onChange={setGapless} />
                    <ToggleRow label="Equalizer" desc="Apply EQ to audio output" checked={equalizer} onChange={setEqualizer} />
                    {equalizer && <SelectRow label="EQ Preset" value={eqPreset} onChange={setEqPreset} options={[{value:'flat',label:'Flat'},{value:'bass',label:'Bass Boost'},{value:'vocal',label:'Vocal'},{value:'treble',label:'Treble'}]} />}
                  </div>
                </>)}

                {show('download','wifi','quality') && (<>
                  <div className="sr-section">Downloads</div>
                  <div className="sr-rows">
                    <ToggleRow label="Auto-download" desc="Download favorited tracks automatically" checked={autoDownload} onChange={setAutoDownload} />
                    <ToggleRow label="Wi-Fi only" desc="Don't download on mobile data" checked={onlyWifi} onChange={setOnlyWifi} />
                    <SelectRow label="Quality" desc="Higher quality uses more storage" value={downloadQuality} onChange={setDownloadQuality} options={[{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]} />
                    <NumberRow label="Max concurrent downloads" desc="Downloads running at once" value={maxDownloads} onChange={setMaxDownloads} min={1} max={10} />
                  </div>
                </>)}

                {show('dark','notifications','general') && (<>
                  <div className="sr-section">General</div>
                  <div className="sr-rows">
                    <ToggleRow label="Dark mode" desc="Use dark color scheme" checked={darkMode} onChange={setDarkMode} />
                    <ToggleRow label="Notifications" desc="Show playback notifications" checked={notifications} onChange={setNotifications} />
                    {notifications && <SliderRow label="Notification volume" value={notifVolume} onChange={setNotifVolume} unit="%" />}
                  </div>
                </>)}

                {show('privacy','analytics','remote') && (<>
                  <div className="sr-section">Privacy</div>
                  <div className="sr-rows">
                    <ToggleRow label="Usage analytics" desc="Help improve the app anonymously" checked={analytics} onChange={setAnalytics} />
                    <ToggleRow label="Remote control" desc="Allow controlling from other devices" checked={remoteControl} onChange={setRemoteControl} />
                  </div>
                </>)}

                {show('storage','cache','version') && (<>
                  <div className="sr-section">Storage &amp; App</div>
                  <div className="sr-rows">
                    <InfoRow label="Cache" desc="Temporary files" right={<div style={{display:'flex',alignItems:'center',gap:8}}><span className="sr-info-val">{cacheSize}</span><button className="sr-clear-btn" onClick={() => showToast('Cache cleared')}>Clear</button></div>} />
                    <SliderRow label="Max cache size" desc="Storage limit for offline content" value={maxCache} onChange={setMaxCache} min={50} max={5000} unit=" MB" />
                    <InfoRow label="Connection" desc="Current network status" right={<div style={{display:'flex',alignItems:'center',gap:6}}><div className={`sr-dot ${isOnline?'on':'off'}`} /><span className={`sr-status ${isOnline?'on':'off'}`}>{isOnline?'Online':'Offline'}</span></div>} />
                    <InfoRow label="App version" desc={`Built on ${BUILD_DATE}`} right={<span className="sr-info-val">v{VERSION}</span>} />
                  </div>
                  <div className="sr-section">Advanced</div>
                  <div className="sr-rows">
                    <div className="sr-actions">
                      <button onClick={exportSettings} className="sr-action sr-action-d"><FaClipboard style={{fontSize:10}} /> Export</button>
                      <button onClick={importSettings} className="sr-action sr-action-d"><FaFileImport style={{fontSize:10}} /> Import</button>
                      <button onClick={resetDefaults}  className="sr-action sr-action-r"><FaRedoAlt   style={{fontSize:10}} /> Reset</button>
                    </div>
                  </div>
                </>)}
              </>
            )}

          </div>
        </div>

        {toast && (
          <div className={`sr-toast ${toast.type}`} onClick={() => setToast(null)}>
            {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}