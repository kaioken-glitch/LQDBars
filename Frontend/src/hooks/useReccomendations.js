/**
 * useRecommendations.js
 *
 * Two responsibilities:
 *  1. Silently logs every play event to the backend (fires after 10s of listening)
 *  2. Fetches personalised recommendations for HomeOnline shelves
 *
 * Usage in PlayerContext — log plays:
 *   import { usePlayLogger } from '../hooks/useRecommendations';
 *   usePlayLogger(currentSong, currentTime, isPlaying);
 *
 * Usage in HomeOnline — get recommendations:
 *   import { useRecommendations } from '../hooks/useRecommendations';
 *   const { songs, source, loading } = useRecommendations();
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const BACKEND = (import.meta.env.VITE_YT_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');

// Minimum seconds a song must play before we log it
// (avoids polluting history with accidental clicks)
const MIN_LISTEN_S = 10;

/* ════════════════════════════════════════════════════════════════
   usePlayLogger — drop into PlayerContext
   Fires once when currentTime crosses MIN_LISTEN_S, then again
   when the song changes (to capture final listen duration).
════════════════════════════════════════════════════════════════ */
export function usePlayLogger(currentSong, currentTime, isPlaying) {
  const { user }        = useAuth();
  const loggedRef       = useRef(null);  // last youtubeId we logged
  const startTimeRef    = useRef(null);  // when this song's listen session started
  const listenSecsRef   = useRef(0);     // accumulated seconds this session

  // Track actual listen time (only counts when isPlaying)
  useEffect(() => {
    if (!currentSong || !isPlaying) return;
    const interval = setInterval(() => {
      listenSecsRef.current += 1;
    }, 1000);
    return () => clearInterval(interval);
  }, [currentSong?.id, isPlaying]);

  // Log when threshold crossed or song changes
  useEffect(() => {
    if (!user || !currentSong) return;

    const ytId = currentSong.youtubeId ||
      (currentSong.id?.startsWith('yt_') ? currentSong.id.replace('yt_', '') : null);

    if (!ytId) return;

    // Song changed — log previous song's final duration
    if (loggedRef.current && loggedRef.current !== ytId) {
      const prevSecs = listenSecsRef.current;
      if (prevSecs >= MIN_LISTEN_S) {
        logPlay(user.id, loggedRef.current, null, null, null, prevSecs);
      }
      listenSecsRef.current = 0;
      loggedRef.current     = null;
    }

    // Log current song once threshold is crossed
    if (loggedRef.current !== ytId && listenSecsRef.current >= MIN_LISTEN_S) {
      loggedRef.current = ytId;
      logPlay(
        user.id, ytId,
        currentSong.name   || currentSong.title || null,
        currentSong.artist || null,
        currentSong.cover  || currentSong.thumbnail || null,
        listenSecsRef.current
      );
    }
  }, [currentTime, currentSong?.id, user?.id]);
}

/* Fire-and-forget — never blocks playback */
async function logPlay(userId, youtubeId, title, artist, thumbnail, durationS) {
  try {
    await fetch(`${BACKEND}/api/recommendations/play`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, youtubeId, title, artist, thumbnail, durationS }),
    });
  } catch {
    // Silent fail — logging is non-critical, never interrupt playback
  }
}

/* ════════════════════════════════════════════════════════════════
   useRecommendations — use in HomeOnline
   Returns a shelf of personalised song recommendations.
   Caches in localStorage for 30 minutes to avoid hammering the DB.
════════════════════════════════════════════════════════════════ */
const CACHE_KEY = 'lb:recommendations';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function useRecommendations(limit = 30) {
  const { user }              = useAuth();
  const [songs,   setSongs]   = useState([]);
  const [source,  setSource]  = useState(null); // 'collaborative' | 'global_trending'
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fetchRecs = useCallback(async (userId) => {
    // Check cache first
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && cached.userId === userId && Date.now() - cached.ts < CACHE_TTL) {
        setSongs(cached.songs);
        setSource(cached.source);
        return;
      }
    } catch {}

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/recommendations/${userId}?limit=${limit}`);
      if (!res.ok) throw new Error(`Recommendations API ${res.status}`);
      const { songs: data, source: src } = await res.json();

      setSongs(data || []);
      setSource(src);

      // Cache it
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        userId, songs: data, source: src, ts: Date.now(),
      }));
    } catch (err) {
      setError(err.message);
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (user?.id) fetchRecs(user.id);
  }, [user?.id, fetchRecs]);

  return { songs, source, loading, error, refresh: () => user && fetchRecs(user.id) };
}

/* ════════════════════════════════════════════════════════════════
   useGlobalTrending — cold start fallback, also a shelf
════════════════════════════════════════════════════════════════ */
export function useGlobalTrending(limit = 20) {
  const [songs,   setSongs]   = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND}/api/recommendations/trending?limit=${limit}`)
      .then(r => r.ok ? r.json() : { songs: [] })
      .then(({ songs: data }) => setSongs(data || []))
      .catch(() => setSongs([]))
      .finally(() => setLoading(false));
  }, [limit]);

  return { songs, loading };
}