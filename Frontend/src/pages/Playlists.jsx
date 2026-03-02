import React, { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faEllipsisH } from '@fortawesome/free-solid-svg-icons';
import {
  FaSearch, FaPlay, FaRandom, FaPlus, FaListUl, FaTrash, FaTimes,
  FaYoutube, FaFolder, FaChevronDown, FaSpinner, FaExclamationTriangle,
  FaLink, FaStar, FaHeart,
} from 'react-icons/fa';
import TinyPlayer from '../components/TinyPlayer';
import { usePlayer } from '../context/PlayerContext';

/* ── STORAGE ── */
const LS     = 'lb:playlists';
const loadPL = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } };
const savePL = d => { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (_) {} };

/* ══════════════════════════════════════════════════════════════════════════
   YOUTUBE PLAYLIST IMPORT
   Strategy:
     Tier 1 — YouTube Data API v3 (uses VITE_YOUTUBE_API_KEY, fast & reliable)
     Tier 2 — Race 8 Piped community mirrors in parallel (no API key needed)
   kavin.rocks excluded from Piped list — consistently unreliable in 2025/26.
══════════════════════════════════════════════════════════════════════════ */
function extractPlaylistId(input) {
  if (!input) return null;
  const m = input.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  if (/^PL[A-Za-z0-9_-]{10,}$/.test(input.trim())) return input.trim();
  if (/^[A-Za-z0-9_-]{24,}$/.test(input.trim())) return input.trim();
  return null;
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ── Tier 1: YouTube Data API v3 ────────────────────────────────────────── */
async function fetchViaYouTubeAPI(playlistId) {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY || '';
  if (!key) throw new Error('NO_API_KEY');

  const songs     = [];
  let   pageToken = '';
  let   fetched   = 0;
  const MAX_ITEMS = 200;

  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part',       'snippet,contentDetails');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('key',        key);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString());
    if (res.status === 404) throw new Error('Playlist not found or is private.');
    if (res.status === 403) throw new Error('API quota exceeded or the playlist is private.');
    if (!res.ok)            throw new Error(`YouTube API error ${res.status}`);

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'YouTube API error');

    for (const item of data.items || []) {
      const snip    = item.snippet || {};
      const videoId = snip.resourceId?.videoId || item.contentDetails?.videoId;
      if (!videoId) continue;
      if (snip.title === 'Private video' || snip.title === 'Deleted video') continue;

      const thumb = snip.thumbnails?.high?.url
                 || snip.thumbnails?.medium?.url
                 || snip.thumbnails?.default?.url
                 || '';
      songs.push({
        id:        `yt_${videoId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name:      snip.title || 'Untitled',
        artist:    snip.videoOwnerChannelTitle || snip.channelTitle || 'YouTube',
        cover:     thumb,
        source:    'youtube',
        youtubeId: videoId,
        audio:     `https://www.youtube.com/watch?v=${videoId}`,
        duration:  '',
      });
    }

    pageToken = data.nextPageToken || '';
    fetched  += (data.items || []).length;
  } while (pageToken && fetched < MAX_ITEMS);

  if (!songs.length) throw new Error('Playlist is empty or all videos are private/deleted.');
  return songs;
}

/* ── Tier 2: Race Piped mirrors ─────────────────────────────────────────── */
async function fetchViaPiped(playlistId) {
  // Working instances early 2026 — kavin.rocks omitted (unreliable/down)
  const INSTANCES = [
    'https://pipedapi.moomoo.me',
    'https://pipedapi.syncpundit.io',
    'https://piped-api.garudalinux.org',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.adminforge.de',
    'https://piped-api.privacy.com.de',
    'https://pipedapi.tokhmi.xyz',
    'https://api.piped.yt',
  ];

  const tryInstance = (base) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    return fetch(`${base}/playlists/${playlistId}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).then(res => {
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }).then(data => {
      clearTimeout(timer);
      const streams = data.relatedStreams || [];
      if (!streams.length) throw new Error('empty');
      return streams.map(v => {
        const videoId = v.url?.split('v=')[1]?.split('&')[0] || '';
        return {
          id:        `yt_${videoId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name:      v.title || 'Untitled',
          artist:    v.uploaderName || 'YouTube',
          cover:     v.thumbnail || '',
          source:    'youtube',
          youtubeId: videoId,
          audio:     `https://www.youtube.com/watch?v=${videoId}`,
          duration:  v.duration > 0 ? formatDuration(v.duration) : '',
        };
      }).filter(s => s.youtubeId);
    }).catch(e => { clearTimeout(timer); throw e; });
  };

  // Stagger requests 300ms apart so we don't slam all instances simultaneously
  return new Promise((resolve, reject) => {
    let settled  = false;
    let failures = 0;
    const total  = INSTANCES.length;

    INSTANCES.forEach((base, i) => {
      setTimeout(() => {
        if (settled) return;
        tryInstance(base)
          .then(songs => { if (!settled) { settled = true; resolve(songs); } })
          .catch(() => {
            failures++;
            if (failures === total && !settled) {
              settled = true;
              reject(new Error(
                'All Piped instances failed. The playlist may be private, or check your internet connection and try again.'
              ));
            }
          });
      }, i * 300);
    });
  });
}

/* ── Main fetch (Tier 1 → Tier 2) ─────────────────────────────────────── */
async function fetchYTPlaylist(playlistId) {
  try {
    const songs = await fetchViaYouTubeAPI(playlistId);
    console.log(`[Playlists] YouTube API v3: imported ${songs.length} tracks`);
    return songs;
  } catch (e) {
    // Surface hard errors immediately — don't bother trying Piped
    if (e.message !== 'NO_API_KEY' && (
      e.message.includes('private') ||
      e.message.includes('not found') ||
      e.message.includes('quota') ||
      e.message.includes('empty')
    )) throw e;

    if (e.message !== 'NO_API_KEY') {
      console.warn('[Playlists] YouTube API failed, falling back to Piped:', e.message);
    } else {
      console.info('[Playlists] No API key — using Piped mirrors');
    }
  }

  const songs = await fetchViaPiped(playlistId);
  console.log(`[Playlists] Piped: imported ${songs.length} tracks`);
  return songs;
}

/* ── CSS ── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');

.pl-root {
  --g:      #1DB954;
  --g2:     #23E065;
  --gdim:   rgba(29,185,84,0.14);
  --gglow:  rgba(29,185,84,0.28);
  --yt:     #FF0000;
  --yt-dim: rgba(255,0,0,0.12);
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
.pl-root *, .pl-root *::before, .pl-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.pl-root button { font-family: inherit; cursor: pointer; border: none; background: none; }
.pl-shell { width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.pl-header { flex-shrink: 0; padding: 28px 28px 0; background: linear-gradient(180deg, rgba(29,185,84,0.06) 0%, transparent 100%); }
.pl-header-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
.pl-title-block { flex: 1; min-width: 0; }
.pl-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--g); display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.pl-eyebrow-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--g); }
.pl-title { font-family: 'Syne', sans-serif; font-size: clamp(34px,5vw,58px); font-weight: 800; letter-spacing: -.045em; line-height: 1; background: linear-gradient(135deg, #fff 35%, var(--g2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.pl-subtitle { font-size: 12px; color: var(--t3); margin-top: 5px; }
.pl-header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pl-search-wrap { position: relative; }
.pl-search-ico { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--t3); font-size: 12px; pointer-events: none; }
.pl-search { padding: 9px 14px 9px 36px; width: 200px; background: var(--s1); border: 1px solid var(--b1); border-radius: 9999px; color: var(--t1); font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; transition: border-color .18s var(--ease), background .18s var(--ease), box-shadow .18s var(--ease); }
.pl-search::placeholder { color: var(--t3); }
.pl-search:focus { border-color: rgba(29,185,84,.5); background: var(--s2); box-shadow: 0 0 0 3px rgba(29,185,84,.10); }
.pl-import-wrap { position: relative; }
.pl-import-btn { display: flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 9999px; background: var(--s1); border: 1px solid var(--b1); color: var(--t2); font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 13px; transition: background .15s var(--ease), color .15s var(--ease), border-color .15s; }
.pl-import-btn:hover { background: var(--s2); color: var(--t1); border-color: var(--b2); }
.pl-import-btn svg { transition: transform .2s var(--spring); }
.pl-import-btn.open svg.chevron { transform: rotate(180deg); }
.pl-import-menu { position: absolute; top: calc(100% + 8px); right: 0; z-index: 60; width: 220px; background: #0D0F11; border: 1px solid var(--b2); border-radius: 16px; padding: 6px; box-shadow: 0 20px 60px rgba(0,0,0,.7); animation: plDropIn .2s var(--spring) both; }
@keyframes plDropIn { from{opacity:0;transform:translateY(-8px) scale(.97)} to{opacity:1;transform:none} }
.pl-import-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; font-size: 13px; color: var(--t2); transition: background .14s, color .14s; width: 100%; text-align: left; }
.pl-import-item:hover { background: var(--s2); color: var(--t1); }
.pl-import-item .icon-wrap { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.pl-import-item.local .icon-wrap { background: rgba(96,165,250,.12); color: #60A5FA; }
.pl-import-item.youtube .icon-wrap { background: var(--yt-dim); color: var(--yt); }
.pl-import-item-label { font-size: 13px; font-weight: 500; }
.pl-import-item-sub { font-size: 10px; color: var(--t3); margin-top: 1px; }
.pl-import-sep { height: 1px; background: var(--b1); margin: 4px 0; }
.pl-new-btn { display: flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: 9999px; background: var(--g); color: #000; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; box-shadow: 0 4px 18px rgba(29,185,84,.35); transition: background .15s var(--ease), transform .15s var(--spring), box-shadow .15s var(--ease); }
.pl-new-btn:hover { background: var(--g2); transform: translateY(-1px); box-shadow: 0 6px 24px rgba(29,185,84,.5); }
.pl-new-btn:active { transform: scale(.96); }
.pl-divider { height: 1px; background: var(--b1); margin: 18px 0 0; }
.pl-content { flex: 1; overflow-y: auto; padding: 24px 28px 40px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.07) transparent; }
.pl-content::-webkit-scrollbar { width: 4px; }
.pl-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 3px; }
.pl-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(148px,1fr)); gap: 16px; }
@media(min-width:500px)  { .pl-grid { grid-template-columns:repeat(auto-fill,minmax(158px,1fr)); gap:18px; } }
@media(min-width:768px)  { .pl-grid { grid-template-columns:repeat(auto-fill,minmax(168px,1fr)); gap:20px; } }
@media(min-width:1024px) { .pl-grid { grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:24px; } }
.pl-card { position: relative; background: var(--s1); border: 1px solid var(--b1); border-radius: 18px; overflow: hidden; cursor: pointer; transition: transform .24s var(--spring), border-color .22s var(--ease), box-shadow .22s var(--ease); animation: plUp .38s var(--spring) both; }
@keyframes plUp { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:none} }
.pl-card:hover { transform: translateY(-6px) scale(1.025); border-color: rgba(29,185,84,.28); box-shadow: 0 24px 56px rgba(0,0,0,.55), 0 0 32px rgba(29,185,84,.07); }
.pl-card:nth-child(1){animation-delay:.03s} .pl-card:nth-child(2){animation-delay:.06s} .pl-card:nth-child(3){animation-delay:.09s} .pl-card:nth-child(n+4){animation-delay:.12s}
.pl-source-badge { position: absolute; top: 8px; left: 8px; z-index: 3; display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 9999px; font-size: 9px; font-weight: 700; letter-spacing: .06em; backdrop-filter: blur(8px); }
.pl-source-badge.yt { background: rgba(0,0,0,.6); color: var(--yt); border: 1px solid rgba(255,0,0,.2); }
.pl-art { position: relative; width: 100%; padding-top: 100%; background: var(--gdim); }
.pl-art-mosaic { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; }
.pl-art-single { position: absolute; inset: 0; overflow: hidden; }
.pl-art-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 34px; color: rgba(29,185,84,.3); background: linear-gradient(135deg, rgba(29,185,84,.1), rgba(0,0,0,.2)); }
.pl-art-mosaic img, .pl-art-single img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .55s var(--ease); }
.pl-card:hover .pl-art-mosaic img, .pl-card:hover .pl-art-single img { transform: scale(1.07); }
.pl-art-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.72) 0%, transparent 55%); opacity: 0; transition: opacity .22s var(--ease); display: flex; align-items: center; justify-content: center; }
.pl-card:hover .pl-art-overlay { opacity: 1; }
.pl-art-play { width: 46px; height: 46px; border-radius: 50%; background: var(--g); color: #000; font-size: 15px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 22px rgba(29,185,84,.5); transform: scale(.82) translateY(4px); transition: transform .22s var(--spring), background .15s var(--ease); }
.pl-card:hover .pl-art-play { transform: scale(1) translateY(0); }
.pl-art-play:hover { background: var(--g2); }
.pl-del-badge { position: absolute; top: 8px; right: 8px; z-index: 3; width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,.55); backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,.1); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--t2); opacity: 0; transition: opacity .18s var(--ease), background .15s var(--ease); }
.pl-card:hover .pl-del-badge { opacity: 1; }
.pl-del-badge:hover { background: rgba(220,40,40,.7); color: #fff; }
.pl-card-info { padding: 13px 15px 15px; }
.pl-card-name { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.pl-card-count { font-size: 11px; color: var(--t3); }
.pl-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 55vh; gap: 16px; text-align: center; }
.pl-empty-icon { width: 80px; height: 80px; border-radius: 50%; background: var(--s1); border: 1px solid var(--b1); display: flex; align-items: center; justify-content: center; font-size: 30px; color: var(--t3); }
.pl-empty h3 { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800; color: var(--t1); letter-spacing: -.025em; }
.pl-empty p { font-size: 14px; color: var(--t3); max-width: 290px; line-height: 1.6; }
.pl-create-overlay { position: fixed; inset: 0; z-index: 70; background: rgba(0,0,0,.65); backdrop-filter: blur(14px); display: flex; align-items: center; justify-content: center; animation: plFadeIn .22s var(--ease); }
@keyframes plFadeIn { from{opacity:0} to{opacity:1} }
.pl-create-box { width: min(420px,93vw); background: #0D0F11; border: 1px solid var(--b2); border-radius: 24px; padding: 30px; box-shadow: 0 36px 90px rgba(0,0,0,.75); animation: plScaleIn .3s var(--spring); }
@keyframes plScaleIn { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:none} }
.pl-create-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.pl-create-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; color: var(--t1); letter-spacing: -.02em; }
.pl-create-close { width: 32px; height: 32px; border-radius: 50%; background: var(--s1); border: 1px solid var(--b1); color: var(--t2); font-size: 12px; display: flex; align-items: center; justify-content: center; transition: background .15s, color .15s; }
.pl-create-close:hover { background: var(--sh); color: var(--t1); }
.pl-create-label { font-size: 11px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase; color: var(--t3); margin-bottom: 9px; }
.pl-create-input { width: 100%; padding: 13px 16px; background: var(--s1); border: 1px solid var(--b1); border-radius: 13px; color: var(--t1); font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color .18s, background .18s; margin-bottom: 24px; }
.pl-create-input::placeholder { color: var(--t3); }
.pl-create-input:focus { border-color: rgba(29,185,84,.5); background: var(--s2); }
.pl-create-submit { width: 100%; padding: 14px; background: var(--g); border-radius: 13px; color: #000; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; box-shadow: 0 4px 18px rgba(29,185,84,.35); transition: background .15s, transform .15s var(--spring); }
.pl-create-submit:hover:not(:disabled) { background: var(--g2); transform: translateY(-1px); }
.pl-create-submit:active { transform: scale(.97); }
.pl-create-submit:disabled { opacity: .4; cursor: not-allowed; }
.pl-yt-modal-overlay { position: fixed; inset: 0; z-index: 75; background: rgba(0,0,0,.7); backdrop-filter: blur(18px); display: flex; align-items: center; justify-content: center; animation: plFadeIn .22s var(--ease); }
.pl-yt-modal { width: min(480px,95vw); background: #0D0F11; border: 1px solid var(--b2); border-radius: 24px; padding: 0; box-shadow: 0 40px 100px rgba(0,0,0,.8); overflow: hidden; animation: plScaleIn .3s var(--spring); }
.pl-yt-modal-top { padding: 24px 28px 20px; background: linear-gradient(135deg, rgba(255,0,0,.08), transparent); border-bottom: 1px solid var(--b1); }
.pl-yt-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.pl-yt-modal-title-wrap { display: flex; align-items: center; gap: 10px; }
.pl-yt-modal-icon { width: 36px; height: 36px; border-radius: 10px; background: var(--yt-dim); display: flex; align-items: center; justify-content: center; color: var(--yt); font-size: 16px; }
.pl-yt-modal-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; color: var(--t1); letter-spacing: -.02em; }
.pl-yt-close { width: 32px; height: 32px; border-radius: 50%; background: var(--s1); border: 1px solid var(--b1); color: var(--t2); display: flex; align-items: center; justify-content: center; font-size: 12px; transition: background .15s, color .15s; }
.pl-yt-close:hover { background: var(--sh); color: var(--t1); }
.pl-yt-field { margin-bottom: 14px; }
.pl-yt-label { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); margin-bottom: 8px; }
.pl-yt-input-wrap { position: relative; }
.pl-yt-input-ico { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--t3); font-size: 13px; pointer-events: none; }
.pl-yt-input { width: 100%; padding: 12px 14px 12px 40px; background: var(--s1); border: 1px solid var(--b1); border-radius: 12px; color: var(--t1); font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color .18s, background .18s; }
.pl-yt-input::placeholder { color: var(--t3); }
.pl-yt-input:focus { border-color: rgba(255,0,0,.4); background: var(--s2); }
.pl-yt-body { padding: 20px 28px 24px; }
.pl-yt-info-note { font-size: 12px; color: var(--t3); line-height: 1.6; padding: 10px 14px; background: rgba(255,255,255,.02); border: 1px solid var(--b1); border-radius: 10px; margin-bottom: 16px; }
.pl-yt-progress { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(255,0,0,.06); border: 1px solid rgba(255,0,0,.15); border-radius: 12px; margin-bottom: 14px; font-size: 13px; color: var(--t2); animation: plFadeIn .2s var(--ease); }
@keyframes spin { to { transform: rotate(360deg); } }
.pl-yt-spinner { animation: spin .8s linear infinite; color: var(--yt); font-size: 14px; }
.pl-yt-error { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; background: rgba(255,60,60,.07); border: 1px solid rgba(255,60,60,.2); border-radius: 12px; margin-bottom: 14px; font-size: 12px; color: rgba(255,120,120,0.9); line-height: 1.6; animation: plFadeIn .2s var(--ease); }
.pl-yt-error-icon { flex-shrink: 0; margin-top: 2px; }
.pl-yt-import-btn { width: 100%; padding: 14px; background: var(--yt); border-radius: 12px; color: #fff; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; box-shadow: 0 4px 18px rgba(255,0,0,.25); transition: background .15s, transform .15s var(--spring), opacity .15s; }
.pl-yt-import-btn:hover:not(:disabled) { background: #cc0000; transform: translateY(-1px); }
.pl-yt-import-btn:active { transform: scale(.97); }
.pl-yt-import-btn:disabled { opacity: .45; cursor: not-allowed; }
.pl-modal { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; overflow: hidden; animation: plFadeIn .28s var(--spring) both; }
.pl-modal-bg { position: absolute; inset: 0; background: radial-gradient(ellipse 70% 50% at 20% -10%, rgba(29,185,84,.22) 0%, transparent 60%), linear-gradient(180deg, rgba(4,28,16,.95) 0%, #07080A 50%); }
.pl-modal-grain { position: absolute; inset: 0; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); background-size: 200px; opacity: .022; mix-blend-mode: screen; }
.pl-modal-bar { position: relative; z-index: 2; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px 22px; border-bottom: 1px solid var(--b1); background: rgba(0,0,0,.22); backdrop-filter: blur(24px); }
.pl-modal-btn { width: 38px; height: 38px; border-radius: 50%; background: var(--s1); border: 1px solid var(--b1); color: var(--t1); font-size: 14px; display: flex; align-items: center; justify-content: center; transition: background .15s, transform .15s; }
.pl-modal-btn:hover { background: var(--sh); }
.pl-modal-btn:active { transform: scale(.9); }
.pl-hero { position: relative; z-index: 2; flex-shrink: 0; display: flex; flex-direction: column; gap: 20px; padding: 28px 30px 20px; }
@media(min-width:560px) { .pl-hero { flex-direction: row; align-items: flex-end; padding: 32px 40px 24px; } }
.pl-hero-art { position: relative; flex-shrink: 0; width: 148px; height: 148px; border-radius: 20px; overflow: hidden; box-shadow: 0 28px 64px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08); }
@media(min-width:560px) { .pl-hero-art { width: 185px; height: 185px; } }
.pl-hero-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pl-hero-art-empty { width: 100%; height: 100%; background: linear-gradient(135deg, rgba(29,185,84,.18), rgba(0,0,0,.35)); display: flex; align-items: center; justify-content: center; font-size: 52px; color: rgba(29,185,84,.3); }
.pl-hero-glow { position: absolute; inset: -14px; border-radius: 30px; background: radial-gradient(circle, var(--gglow) 0%, transparent 70%); filter: blur(14px); animation: heroGlowPL 3.5s ease-in-out infinite; }
@keyframes heroGlowPL { 0%,100%{opacity:.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
.pl-hero-info { flex: 1; min-width: 0; }
.pl-hero-tag { display: flex; align-items: center; gap: 7px; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--g); margin-bottom: 9px; }
.pl-hero-tag-bar { width: 3px; height: 18px; border-radius: 2px; background: var(--g); }
.pl-hero-title { font-family: 'Syne', sans-serif; font-size: clamp(26px,4.5vw,50px); font-weight: 800; letter-spacing: -.04em; color: var(--t1); line-height: 1.04; margin-bottom: 5px; }
.pl-hero-count { font-size: 12px; color: var(--t3); margin-bottom: 22px; }
.pl-hero-actions { display: flex; align-items: center; gap: 12px; }
.pl-hero-play { width: 56px; height: 56px; border-radius: 50%; background: var(--g); color: #000; font-size: 19px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 28px rgba(29,185,84,.45); transition: transform .18s var(--spring), background .15s; }
.pl-hero-play:hover { background: var(--g2); transform: scale(1.09); }
.pl-hero-play:active { transform: scale(.93); }
.pl-hero-shuffle { width: 42px; height: 42px; border-radius: 50%; background: var(--s1); border: 1px solid var(--b1); color: var(--t2); font-size: 14px; display: flex; align-items: center; justify-content: center; transition: background .15s, color .15s; }
.pl-hero-shuffle:hover { background: var(--sh); color: var(--t1); }
.pl-tracks { position: relative; z-index: 2; flex: 1; overflow-y: auto; padding: 0 22px 36px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.07) transparent; }
.pl-tracks::-webkit-scrollbar { width: 4px; }
.pl-tracks::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 3px; }
.pl-tracks-label { font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--t3); padding: 0 12px 14px; }
.pl-track-row { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: 12px; cursor: pointer; border: 1px solid transparent; transition: background .14s, border-color .14s; }
.pl-track-row:hover { background: var(--s2); border-color: var(--b1); }
.pl-track-row.active { background: rgba(29,185,84,.09); border-color: rgba(29,185,84,.2); }
.pl-track-num { width: 24px; text-align: center; font-size: 11px; color: var(--t3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.pl-track-row.active .pl-track-num { color: var(--g); }
.pl-track-thumb { width: 40px; height: 40px; border-radius: 8px; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,.35); }
.pl-track-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pl-track-meta { flex: 1; min-width: 0; }
.pl-track-name { font-size: 13px; font-weight: 600; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; transition: color .14s; }
.pl-track-row:hover .pl-track-name, .pl-track-row.active .pl-track-name { color: var(--g); }
.pl-track-artist { font-size: 11px; color: var(--t3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl-track-dur { font-size: 11px; color: var(--t3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.pl-tracks-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; gap: 10px; color: var(--t3); font-size: 14px; text-align: center; }
.pl-track-row:hover .pl-track-actions { opacity: 1 !important; }
.pl-track-row.active .pl-track-actions { opacity: 1 !important; }
`;

const FB = 'https://placehold.co/200x200/061408/112208?text=\u266a';

/* ── PLAYLIST CARD ── */
const PlaylistCard = memo(({ pl, onOpen, onPlay, onDelete }) => {
  const covers   = (pl.songs || []).slice(0, 4).map(s => s.cover || FB);
  const hasCover = covers.length > 0;
  const isYT     = pl.source === 'youtube';
  return (
    <div className="pl-card" onClick={() => onOpen(pl)}>
      {isYT && (
        <div className="pl-source-badge yt">
          <FaYoutube style={{ fontSize: 10 }} /> YT
        </div>
      )}
      <div className="pl-art">
        {!hasCover
          ? <div className="pl-art-empty"><FaListUl /></div>
          : covers.length === 1
            ? <div className="pl-art-single"><img src={covers[0]} alt={pl.name} onError={e => { e.target.src = FB; }} /></div>
            : <div className="pl-art-mosaic">{covers.map((c, i) => <img key={i} src={c} alt="" onError={e => { e.target.src = FB; }} />)}</div>
        }
        <div className="pl-art-overlay">
          <button className="pl-art-play" onClick={e => { e.stopPropagation(); if ((pl.songs || []).length) onPlay(pl.songs); }} aria-label={`Play ${pl.name}`}>
            <FaPlay style={{ marginLeft: 2 }} />
          </button>
        </div>
        <button className="pl-del-badge" onClick={e => { e.stopPropagation(); onDelete(pl.id); }} aria-label="Delete playlist">
          <FaTrash />
        </button>
      </div>
      <div className="pl-card-info">
        <div className="pl-card-name">{pl.name}</div>
        <div className="pl-card-count">{(pl.songs || []).length} songs</div>
      </div>
    </div>
  );
});

/* ── CREATE MODAL ── */
const CreateModal = memo(({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const submit = useCallback(() => {
    const t = name.trim();
    if (!t) return;
    onCreate(t); onClose();
  }, [name, onCreate, onClose]);

  return (
    <div className="pl-root" style={{ position: 'fixed', inset: 0, zIndex: 70 }}>
      <div className="pl-create-overlay" onClick={onClose}>
        <div className="pl-create-box" onClick={e => e.stopPropagation()}>
          <div className="pl-create-header">
            <span className="pl-create-title">New Playlist</span>
            <button className="pl-create-close" onClick={onClose}><FaTimes /></button>
          </div>
          <div className="pl-create-label">Playlist Name</div>
          <input
            className="pl-create-input" type="text" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
            placeholder="My Playlist…" autoFocus maxLength={60}
          />
          <button className="pl-create-submit" onClick={submit} disabled={!name.trim()}>
            Create Playlist
          </button>
        </div>
      </div>
    </div>
  );
});

/* ── YOUTUBE IMPORT MODAL ── */
const YouTubeImportModal = memo(({ onClose, onImport }) => {
  const [url,     setUrl]     = useState('');
  const [plName,  setPlName]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [status,  setStatus]  = useState('');

  const handleImport = useCallback(async () => {
    const plId = extractPlaylistId(url.trim());
    if (!plId) { setError('Paste a valid YouTube playlist URL or ID (starts with PL…).'); return; }
    setLoading(true);
    setError('');
    setStatus('Connecting…');
    try {
      // Show which tier is being used
      const hasKey = !!import.meta.env.VITE_YOUTUBE_API_KEY;
      setStatus(hasKey ? 'Fetching via YouTube API…' : 'Fetching via Piped mirrors…');
      const songs = await fetchYTPlaylist(plId);
      setStatus(`Got ${songs.length} tracks — saving…`);
      const name  = plName.trim() || `YouTube Playlist (${songs.length} tracks)`;
      onImport(name, songs);
      onClose();
    } catch (e) {
      setError(e.message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  }, [url, plName, onImport, onClose]);

  const hasKey = !!import.meta.env.VITE_YOUTUBE_API_KEY;

  return (
    <div className="pl-root" style={{ position: 'fixed', inset: 0, zIndex: 75 }}>
      <div className="pl-yt-modal-overlay" onClick={onClose}>
        <div className="pl-yt-modal" onClick={e => e.stopPropagation()}>
          <div className="pl-yt-modal-top">
            <div className="pl-yt-modal-header">
              <div className="pl-yt-modal-title-wrap">
                <div className="pl-yt-modal-icon"><FaYoutube /></div>
                <span className="pl-yt-modal-title">Import from YouTube</span>
              </div>
              <button className="pl-yt-close" onClick={onClose}><FaTimes /></button>
            </div>
            <div className="pl-yt-field">
              <div className="pl-yt-label">Playlist URL or ID</div>
              <div className="pl-yt-input-wrap">
                <FaLink className="pl-yt-input-ico" />
                <input
                  className="pl-yt-input"
                  type="text" value={url}
                  onChange={e => { setUrl(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleImport(); if (e.key === 'Escape') onClose(); }}
                  placeholder="https://youtube.com/playlist?list=PL…"
                  autoFocus
                />
              </div>
            </div>
            <div className="pl-yt-field">
              <div className="pl-yt-label">Playlist Name (optional)</div>
              <div className="pl-yt-input-wrap">
                <FaListUl className="pl-yt-input-ico" style={{ fontSize: 11 }} />
                <input
                  className="pl-yt-input"
                  type="text" value={plName}
                  onChange={e => setPlName(e.target.value)}
                  placeholder="Leave blank to auto-name"
                  maxLength={60}
                />
              </div>
            </div>
          </div>
          <div className="pl-yt-body">
            <div className="pl-yt-info-note">
              {hasKey
                ? '✓ YouTube API key detected — imports will be fast and reliable.'
                : 'No API key found — will use community Piped mirrors (may be slower). Add VITE_YOUTUBE_API_KEY to your .env for best results.'}
              {' '}Playlist must be public.
            </div>
            {loading && (
              <div className="pl-yt-progress">
                <FaSpinner className="pl-yt-spinner" />
                <span>{status || 'Fetching playlist tracks…'}</span>
              </div>
            )}
            {error && (
              <div className="pl-yt-error">
                <FaExclamationTriangle className="pl-yt-error-icon" />
                <span>{error}</span>
              </div>
            )}
            <button
              className="pl-yt-import-btn"
              onClick={handleImport}
              disabled={loading || !url.trim()}
            >
              {loading ? 'Importing…' : 'Import Playlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ── IMPORT DROPDOWN ── */
const ImportDropdown = memo(({ onLocalImport, onYouTubeImport }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="pl-import-wrap" ref={ref}>
      <button
        className={`pl-import-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <FaPlus style={{ fontSize: 11 }} />
        Import
        <FaChevronDown className="chevron" style={{ fontSize: 10 }} />
      </button>
      {open && (
        <div className="pl-import-menu">
          <button className="pl-import-item local" onClick={() => { setOpen(false); onLocalImport(); }}>
            <div className="icon-wrap"><FaFolder /></div>
            <div>
              <div className="pl-import-item-label">From Device</div>
              <div className="pl-import-item-sub">Select local audio files</div>
            </div>
          </button>
          <div className="pl-import-sep" />
          <button className="pl-import-item youtube" onClick={() => { setOpen(false); onYouTubeImport(); }}>
            <div className="icon-wrap"><FaYoutube /></div>
            <div>
              <div className="pl-import-item-label">YouTube Playlist</div>
              <div className="pl-import-item-sub">Import via playlist URL</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
});

/* ── MAIN ── */
export default function Playlists() {
  const {
    currentSong, isPlaying, playNext, playPrev, setIsPlaying,
    isMuted, toggleMute, setPlayerSongs,
  } = usePlayer();

  const [mockSongStates, setMockSongStates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lb:mock_states') || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem('lb:mock_states', JSON.stringify(mockSongStates)); } catch (_) {}
  }, [mockSongStates]);
  const updateMockSongState = useCallback((songId, updates) => {
    setMockSongStates(prev => ({ ...prev, [songId]: { ...prev[songId], ...updates } }));
  }, []);

  const [playlists,    setPlaylists]    = useState(loadPL);
  const [query,        setQuery]        = useState('');
  const [showCreate,   setShowCreate]   = useState(false);
  const [showYTImport, setShowYTImport] = useState(false);
  const [selected,     setSelected]     = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { savePL(playlists); }, [playlists]);

  const filtered = useMemo(() => {
    if (!query.trim()) return playlists;
    const q = query.toLowerCase();
    return playlists.filter(p => p.name?.toLowerCase().includes(q));
  }, [playlists, query]);

  const createPlaylist = useCallback((name) => {
    setPlaylists(prev => [{ id: `pl_${Date.now()}`, name, songs: [], createdAt: Date.now() }, ...prev]);
  }, []);

  const deletePlaylist = useCallback((id) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    setSelected(s => s?.id === id ? null : s);
  }, []);

  const playList = useCallback((songs, idx = 0) => {
    if (!songs?.length) return;
    const valid = songs.filter(s => s.audio || s.url || s.audioUrl || s.src || s.youtubeId);
    if (!valid.length) return;
    const i = valid.findIndex(s => s.id === songs[idx]?.id);
    setPlayerSongs(valid, i < 0 ? 0 : i);
    setTimeout(() => setIsPlaying(true), 100);
  }, [setPlayerSongs, setIsPlaying]);

  const shuffleList = useCallback((songs) => {
    playList([...songs].sort(() => Math.random() - 0.5));
  }, [playList]);

  const handleLocalImport = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleFilesChosen = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const supported = files.filter(f => f.type.startsWith('audio/') || /\.(mp3|flac|wav|aac|ogg|m4a|opus)$/i.test(f.name));
    if (!supported.length) return;
    const songs = supported.map(f => ({
      id:     `local_${Date.now()}_${Math.random()}`,
      name:   f.name.replace(/\.[^/.]+$/, ''),
      artist: 'Local File',
      cover:  '',
      audio:  URL.createObjectURL(f),
      source: 'local',
    }));
    setPlaylists(prev => [{
      id: `pl_${Date.now()}`, name: `Local Import (${songs.length} tracks)`,
      songs, source: 'local', createdAt: Date.now(),
    }, ...prev]);
    e.target.value = '';
  }, []);

  const handleYTImport = useCallback((name, songs) => {
    setPlaylists(prev => [{
      id: `pl_${Date.now()}`, name, songs, source: 'youtube', createdAt: Date.now(),
    }, ...prev]);
  }, []);

  return (
    <div className="pl-root" style={{ width: '100%', height: '100%' }}>
      <style>{CSS}</style>
      <input
        ref={fileInputRef} type="file" multiple
        accept="audio/*,.mp3,.flac,.wav,.aac,.ogg,.m4a,.opus"
        style={{ display: 'none' }}
        onChange={handleFilesChosen}
      />
      <div className="pl-shell">
        <div className="pl-header">
          <div className="pl-header-top">
            <div className="pl-title-block">
              <div className="pl-eyebrow"><span className="pl-eyebrow-dot" /> Your Music</div>
              <h1 className="pl-title">Playlists</h1>
              <p className="pl-subtitle">{playlists.length} playlist{playlists.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="pl-header-actions">
              <div className="pl-search-wrap">
                <FaSearch className="pl-search-ico" />
                <input
                  className="pl-search" type="text" value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search playlists…"
                />
              </div>
              <div style={{ display: 'none' }} className="pl-tiny">
                <TinyPlayer song={currentSong} isPlaying={isPlaying}
                  onPlayPause={() => setIsPlaying(p => !p)}
                  onPrev={playPrev} onNext={playNext}
                  isMuted={isMuted} onMuteToggle={toggleMute} />
              </div>
              <ImportDropdown onLocalImport={handleLocalImport} onYouTubeImport={() => setShowYTImport(true)} />
              <button className="pl-new-btn" onClick={() => setShowCreate(true)}>
                <FaPlus style={{ fontSize: 11 }} /> New Playlist
              </button>
            </div>
          </div>
          <div className="pl-divider" />
        </div>
        <style>{`@media(min-width:768px){.pl-tiny{display:block !important}}`}</style>
        <div className="pl-content">
          {filtered.length === 0 ? (
            <div className="pl-empty">
              <div className="pl-empty-icon"><FaListUl /></div>
              <h3>{playlists.length === 0 ? 'No playlists yet' : 'No results'}</h3>
              <p>{playlists.length === 0 ? 'Create a new playlist or import from YouTube.' : 'Try a different search term.'}</p>
            </div>
          ) : (
            <div className="pl-grid">
              {filtered.map(pl => (
                <PlaylistCard key={pl.id} pl={pl} onOpen={setSelected} onPlay={playList} onDelete={deletePlaylist} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate   && <CreateModal onClose={() => setShowCreate(false)} onCreate={createPlaylist} />}
      {showYTImport && <YouTubeImportModal onClose={() => setShowYTImport(false)} onImport={handleYTImport} />}

      {selected && (
        <div className="pl-root" style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div className="pl-modal">
            <div className="pl-modal-bg" />
            <div className="pl-modal-grain" />
            <div className="pl-modal-bar">
              <button className="pl-modal-btn" onClick={() => setSelected(null)}>
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <button className="pl-modal-btn">
                <FontAwesomeIcon icon={faEllipsisH} />
              </button>
            </div>
            <div className="pl-hero">
              <div className="pl-hero-art">
                <div className="pl-hero-glow" />
                {selected.songs?.length > 0
                  ? <img src={selected.songs[0]?.cover || FB} alt={selected.name} onError={e => { e.target.src = FB; }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <div className="pl-hero-art-empty"><FaListUl /></div>
                }
              </div>
              <div className="pl-hero-info">
                <div className="pl-hero-tag"><span className="pl-hero-tag-bar" /> Playlist</div>
                <h1 className="pl-hero-title">{selected.name}</h1>
                <p className="pl-hero-count">{(selected.songs || []).length} songs</p>
                <div className="pl-hero-actions">
                  {(selected.songs || []).length > 0 && (
                    <>
                      <button className="pl-hero-play" onClick={() => playList(selected.songs)}>
                        <FaPlay style={{ marginLeft: 2 }} />
                      </button>
                      <button className="pl-hero-shuffle" onClick={() => shuffleList(selected.songs)}>
                        <FaRandom />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="pl-tracks">
              {!(selected.songs || []).length ? (
                <div className="pl-tracks-empty">
                  <FaListUl style={{ fontSize: 30, color: 'rgba(255,255,255,.15)', marginBottom: 6 }} />
                  <p>This playlist is empty</p>
                </div>
              ) : (
                <>
                  <div className="pl-tracks-label">Tracks · {selected.songs.length}</div>
                  {selected.songs.map((song, i) => {
                    const songId  = song.id || `song-${i}`;
                    const isFav   = mockSongStates[songId]?.favorite || false;
                    const isLiked = mockSongStates[songId]?.liked || false;
                    return (
                      <div
                        key={songId}
                        className={`pl-track-row${currentSong?.id === song.id ? ' active' : ''}`}
                        onClick={() => playList(selected.songs, i)}
                      >
                        <span className="pl-track-num">{String(i + 1).padStart(2, '0')}</span>
                        <div className="pl-track-thumb">
                          <img src={song.cover || FB} alt={song.name} onError={e => { e.target.src = FB; }} />
                        </div>
                        <div className="pl-track-meta">
                          <div className="pl-track-name">{song.name}</div>
                          <div className="pl-track-artist">{song.artist || 'Unknown'}</div>
                        </div>
                        <span className="pl-track-dur">{song.formattedDuration || song.duration || ''}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6, opacity: 0 }} className="pl-track-actions">
                          <button
                            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'transparent' }}
                            onClick={e => { e.stopPropagation(); updateMockSongState(songId, { favorite: !isFav }); }}
                          >
                            <FaStar style={{ fontSize: 11, color: isFav ? '#facc15' : 'rgba(255,255,255,.3)' }} />
                          </button>
                          <button
                            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'transparent' }}
                            onClick={e => { e.stopPropagation(); updateMockSongState(songId, { liked: !isLiked }); }}
                          >
                            <FaHeart style={{ fontSize: 11, color: isLiked ? '#ef4444' : 'rgba(255,255,255,.3)' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}