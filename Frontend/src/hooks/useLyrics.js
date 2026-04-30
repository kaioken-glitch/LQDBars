/**
 * useLyrics.js
 *
 * PATTERNS APPLIED:
 *   Memoization  — fetchLyrics results cached permanently for the session
 *                  (lyrics never change mid-session)
 *   Debounce     — active line finder debounced so it doesn't setState on
 *                  every single 500ms time tick when nothing changed
 *   Deep Clone   — parseLrc result cloned before returning so consumers
 *                  can't accidentally mutate the cached line objects
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const LRCLIB_BASE = 'https://lrclib.net/api';
const UA          = 'LiquidBars/1.0 (https://liquidbars.app)';

/* ── Deep Clone ─────────────────────────────────────────────────────────────
   Safe copy of parsed line objects — callers mutating their copy won't
   corrupt the module-level parsedLrcCache.
─────────────────────────────────────────────────────────────────────────── */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ── Debounce ───────────────────────────────────────────────────────────────
   The active-line finder runs on every currentTime change (every 500ms from
   the YT interval, or continuously from audio timeupdate). If the active line
   hasn't actually changed there's no point calling setState. Debouncing at
   80ms absorbs rapid-fire updates without adding perceptible lag to the
   karaoke highlight.
─────────────────────────────────────────────────────────────────────────── */
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

/* ── Memoize (async) ────────────────────────────────────────────────────────
   Wraps fetchLyrics. The same song never triggers two network requests even
   if the component re-mounts or currentSong?.id changes back to a song
   that was already fetched earlier in the session.
   TTL = Infinity — lyrics are stable for the entire session.
─────────────────────────────────────────────────────────────────────────── */
function memoizeAsync(func) {
  const cache = new Map();
  return async function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const value = await func.apply(this, args);
    cache.set(key, value);
    return value;
  };
}

/* ── LRC parser ─────────────────────────────────────────────────────────────
   "[01:23.45] Some lyric" → { time: 83.45, text: "Some lyric" }
─────────────────────────────────────────────────────────────────────────── */
// Module-level cache for parsed LRC so the same raw string is never re-parsed
const parsedLrcCache = new Map();

function parseLrc(lrc) {
  if (!lrc) return [];
  if (parsedLrcCache.has(lrc)) return deepClone(parsedLrcCache.get(lrc));

  const lines = [];
  for (const raw of lrc.split('\n')) {
    const match = raw.match(/^\[(\d{1,2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (!match) continue;
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const ms   = parseInt(match[3].padEnd(3, '0'), 10);
    const text = match[4].trim();
    if (!text) continue;
    lines.push({ time: mins * 60 + secs + ms / 1000, text });
  }
  lines.sort((a, b) => a.time - b.time);
  parsedLrcCache.set(lrc, lines);
  return deepClone(lines); // return a clone so callers can't mutate the cache
}

/* ── Memoized fetch ─────────────────────────────────────────────────────── */
const fetchLyrics = memoizeAsync(async function (artist, title, album) {
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  if (album) params.set('album_name', album);

  const res = await fetch(`${LRCLIB_BASE}/get?${params}`, {
    headers: { 'Lrclib-Client': UA },
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
  return res.json();
});

/* ── Hook ───────────────────────────────────────────────────────────────── */
export function useLyrics(currentSong, currentTime) {
  const [lines,       setLines]       = useState([]);
  const [plainLyrics, setPlainLyrics] = useState('');
  const [activeLine,  setActiveLine]  = useState(-1);
  const [status,      setStatus]      = useState('idle');
  const lastSongId  = useRef(null);
  const lastActive  = useRef(-1);

  // ── Fetch when song changes ──────────────────────────────────────────────
  useEffect(() => {
    const songId = currentSong?.id;
    if (!songId || !currentSong?.name) {
      setLines([]); setPlainLyrics(''); setActiveLine(-1); setStatus('idle');
      lastActive.current = -1;
      return;
    }
    if (songId === lastSongId.current) return;
    lastSongId.current = songId;
    lastActive.current = -1;

    setLines([]); setPlainLyrics(''); setActiveLine(-1); setStatus('loading');

    // memoizeAsync means this never makes a second network call for the same song
    fetchLyrics(currentSong.artist || '', currentSong.name, currentSong.album || '')
      .then(data => {
        if (!data) { setStatus('not_found'); return; }
        if (data.syncedLyrics) {
          setLines(parseLrc(data.syncedLyrics));
          setStatus('found');
        } else if (data.plainLyrics) {
          setPlainLyrics(data.plainLyrics);
          setStatus('plain');
        } else {
          setStatus('not_found');
        }
      })
      .catch(() => setStatus('error'));
  }, [currentSong?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced active-line finder ─────────────────────────────────────────
  // Wrapped in useCallback so the debounced function is stable across renders
  // and the debounce timer isn't reset on every re-render.
  const findActiveLine = useCallback(
    debounce((linesSnap, time) => {
      if (!linesSnap.length) return;
      let idx = -1;
      for (let i = 0; i < linesSnap.length; i++) {
        if (linesSnap[i].time <= time) idx = i;
        else break;
      }
      // Only setState if the active line actually changed — avoids
      // triggering a re-render on every time tick
      if (idx !== lastActive.current) {
        lastActive.current = idx;
        setActiveLine(idx);
      }
    }, 80),
    [] // stable — debounce wraps a pure computation
  );

  useEffect(() => {
    findActiveLine(lines, currentTime);
  }, [currentTime, lines, findActiveLine]);

  return { lines, plainLyrics, activeLine, status };
}