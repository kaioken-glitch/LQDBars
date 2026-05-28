/**
 * useMoodPlaylist.js
 *
 * Claude AI mood playlist generator. Sends mood/vibe description to backend,
 * gets back a curated list of YouTube songs matching that vibe.
 *
 * PATTERNS APPLIED:
 *   Memoization  — mood → songs cache in localStorage with 1h TTL
 *   Deep Clone   — results cloned before returning
 *   Error handling — graceful fallback if backend unavailable
 */

import { useState, useCallback, useRef } from 'react';

const BACKEND = (import.meta.env.VITE_YT_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
const CACHE_KEY = 'lb:mood_playlists';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/* ── Utilities ───────────────────────────────────────────────────────── */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
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

/* ── Fetch mood playlist from backend ──────────────────────────────────── */
const _fetchMoodPlaylistRaw = async (mood, limit = 20) => {
  try {
    const res = await fetch(`${BACKEND}/api/mood-playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood, limit }),
    });
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const data = await res.json();

    // Normalize response into song objects
    if (!Array.isArray(data)) throw new Error('Invalid response format');
    
    return data.map(item => ({
      id:        `yt_${item.youtubeId || item.id}`,
      name:      item.title || item.name || 'Untitled',
      artist:    item.artist || item.channelTitle || 'Unknown',
      cover:     item.thumbnail || '',
      source:    'youtube',
      youtubeId: item.youtubeId || item.id || '',
      audio:     item.youtubeId ? `https://www.youtube.com/watch?v=${item.youtubeId}` : '',
      duration:  item.duration || '',
    })).filter(s => s.youtubeId); // drop any without video ID
  } catch (err) {
    console.error('[useMoodPlaylist] fetch error:', err.message);
    // Try localStorage fallback if backend unavailable
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const all = JSON.parse(cached);
        return all[mood] || [];
      } catch {}
    }
    throw err;
  }
};

const _fetchMoodPlaylistMemoized = memoizeAsync(_fetchMoodPlaylistRaw, CACHE_TTL);

/* ═══════════════════════════════════════════════════════════════════════
   useMoodPlaylist — generate a playlist from a mood description.
═══════════════════════════════════════════════════════════════════════ */
export function useMoodPlaylist() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [songs, setSongs] = useState([]);
  const generatedRef = useRef(null);

  const generatePlaylist = useCallback(async (mood, limit = 20) => {
    if (!mood?.trim()) {
      setError('Please enter a mood or vibe');
      return null;
    }

    setLoading(true);
    setError(null);
    setSongs([]);

    try {
      const result = await _fetchMoodPlaylistMemoized(mood.trim(), limit);
      setSongs(result);
      generatedRef.current = { mood, songs: result, timestamp: Date.now() };
      return result;
    } catch (err) {
      const msg = err.message || 'Failed to generate playlist. Please try again.';
      setError(msg);
      setSongs([]);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getGenerated = useCallback(() => {
    if (!generatedRef.current) return null;
    return deepClone(generatedRef.current);
  }, []);

  return {
    generatePlaylist,
    getGenerated,
    songs,
    loading,
    error,
  };
}
