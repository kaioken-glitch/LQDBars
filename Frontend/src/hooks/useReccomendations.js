/**
 * useRecommendations.js
 *
 * PATTERNS APPLIED:
 *   Memoization  — fetchRecs results cached in localStorage with 30min TTL
 *                  AND in a module-level Map so same-session calls are instant
 *   Throttle     — logPlay throttled to fire at most once per 10s per song
 *                  (prevents hammering the backend on every time tick)
 *   Debounce     — the listen-threshold check debounced so it only fires
 *                  once the user has continuously listened (not on skip)
 *   Deep Clone   — recommendation results cloned before returning
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const BACKEND     = (import.meta.env.VITE_YT_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
const MIN_LISTEN  = 10;   // seconds before a play is logged
const CACHE_KEY   = 'lb:recommendations';
const CACHE_TTL   = 30 * 60 * 1000;

/* ── Utilities ───────────────────────────────────────────────────────── */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

function throttle(func, limit) {
  let lastRan, lastFunc;
  return function (...args) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

// Module-level in-memory cache — survives component unmount/remount
const memCache = new Map();

function memoizeAsync(func, ttl = Infinity) {
  return async function (...args) {
    const key = JSON.stringify(args);
    const hit = memCache.get(key);
    if (hit && Date.now() - hit.ts < ttl) return deepClone(hit.value);
    const value = await func.apply(this, args);
    memCache.set(key, { value, ts: Date.now() });
    return deepClone(value);
  };
}

/* ── Throttled fire-and-forget play logger ───────────────────────────── */
// Throttled to once per 10s — time tracking fires very frequently
const _logPlayRaw = async (userId, youtubeId, title, artist, thumbnail, durationS) => {
  try {
    await fetch(`${BACKEND}/api/recommendations/play`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, youtubeId, title, artist, thumbnail, durationS }),
    });
  } catch { /* silent — logging is non-critical */ }
};
const _logPlayThrottled = throttle(_logPlayRaw, 10_000);

/* ═══════════════════════════════════════════════════════════════════════
   usePlayLogger — drop into PlayerContext or a layout component.
   Logs a play event once the user has listened for MIN_LISTEN seconds.
   Debounced so skipping through songs quickly doesn't log partial plays.
═══════════════════════════════════════════════════════════════════════ */
export function usePlayLogger(currentSong, currentTime, isPlaying) {
  const { user }       = useAuth();
  const loggedRef      = useRef(null);
  const listenRef      = useRef(0);
  const prevSongRef    = useRef(null);

  // Accumulate real listen time (only while playing)
  useEffect(() => {
    if (!currentSong || !isPlaying) return;
    const id = setInterval(() => { listenRef.current += 1; }, 1000);
    return () => clearInterval(id);
  }, [currentSong?.id, isPlaying]);

  // Debounced check — fires 2s after currentTime stops changing rapidly
  // This means skipping through songs won't log false plays
  const checkAndLog = useCallback(
    debounce((songId, ytId, secs) => {
      if (!user || !ytId || loggedRef.current === songId) return;
      if (secs < MIN_LISTEN) return;
      loggedRef.current = songId;
      _logPlayThrottled(
        user.id, ytId,
        currentSong?.name || null,
        currentSong?.artist || null,
        currentSong?.cover || null,
        secs,
      );
    }, 2000),
    [user, currentSong]
  );

  useEffect(() => {
    if (!currentSong?.id) return;

    // Song changed — log previous song's time if threshold met
    if (prevSongRef.current && prevSongRef.current !== currentSong.id) {
      const prevTime = listenRef.current;
      if (prevTime >= MIN_LISTEN && user) {
        _logPlayThrottled(user.id, prevSongRef.current, null, null, null, prevTime);
      }
      listenRef.current = 0;
      loggedRef.current = null;
    }
    prevSongRef.current = currentSong.id;

    const ytId = currentSong.youtubeId
      || (currentSong.id?.startsWith('yt_') ? currentSong.id.replace('yt_', '') : null);

    checkAndLog(currentSong.id, ytId, listenRef.current);
  }, [currentTime, currentSong?.id, user, checkAndLog]);
}

/* ═══════════════════════════════════════════════════════════════════════
   useRecommendations — personalised shelf for HomeOnline.
   Results memoized in memory + localStorage — component remounts are free.
═══════════════════════════════════════════════════════════════════════ */
const fetchRecs = memoizeAsync(async function(userId, limit) {
  // Check localStorage first (survives page refresh)
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached.userId === userId && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
      }
    }
  } catch (_) {}

  const res = await fetch(`${BACKEND}/api/recommendations/${userId}?limit=${limit}`);
  if (!res.ok) throw new Error(`Recommendations API ${res.status}`);
  const { songs, source } = await res.json();

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      userId, ts: Date.now(), data: { songs: songs || [], source },
    }));
  } catch (_) {}

  return { songs: songs || [], source };
}, CACHE_TTL);

export function useRecommendations(limit = 30) {
  const { user }              = useAuth();
  const [songs,   setSongs]   = useState([]);
  const [source,  setSource]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const load = useCallback(async (userId) => {
    setLoading(true);
    setError(null);
    try {
      const { songs: data, source: src } = await fetchRecs(userId, limit);
      setSongs(data);
      setSource(src);
    } catch (err) {
      setError(err.message);
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (user?.id) load(user.id);
  }, [user?.id, load]);

  return {
    songs, source, loading, error,
    refresh: () => {
      // Clear mem cache for this user so next call re-fetches
      memCache.forEach((_, k) => { if (k.includes(user?.id)) memCache.delete(k); });
      localStorage.removeItem(CACHE_KEY);
      if (user?.id) load(user.id);
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   useGlobalTrending — cold-start fallback shelf
═══════════════════════════════════════════════════════════════════════ */
const fetchTrending = memoizeAsync(async function(limit) {
  const res = await fetch(`${BACKEND}/api/recommendations/trending?limit=${limit}`);
  if (!res.ok) return { songs: [] };
  return res.json();
}, 15 * 60 * 1000); // 15 min TTL

export function useGlobalTrending(limit = 20) {
  const [songs,   setSongs]   = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchTrending(limit)
      .then(({ songs: data }) => setSongs(data || []))
      .catch(() => setSongs([]))
      .finally(() => setLoading(false));
  }, [limit]);

  return { songs, loading };
}