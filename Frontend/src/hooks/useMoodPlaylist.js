/**
 * useMoodPlaylist.js
 *
 * Builds a mood mix from the user's recent listening history and adds
 * related tracks from similar artists/genres. Search-derived candidates
 * are reranked via moodScoring.js (content affinity + freshness +
 * diversity) before being trimmed to the requested limit.
 */

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import youtubeConverter from '../utils/youtubeConverter';
import { rerankCandidates } from './moodScoring';

const CACHE_KEY = 'lb:history_mood_mix';
const CACHE_TTL = 4 * 60 * 60 * 1000;
const memCache = new Map();

const FALLBACK_TRACKS = [
  { id: 'yt_dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', youtubeId: 'dQw4w9WgXcQ', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg' },
  { id: 'yt_jNQXAC9IVRw', title: 'Me at the zoo', artist: 'Jawed', youtubeId: 'jNQXAC9IVRw', thumbnail: 'https://i.ytimg.com/vi/jNQXAC9IVRw/mqdefault.jpg' },
  { id: 'yt_2Vv-BfVoq4g', title: 'Perfect', artist: 'Ed Sheeran', youtubeId: '2Vv-BfVoq4g', thumbnail: 'https://i.ytimg.com/vi/2Vv-BfVoq4g/mqdefault.jpg' },
  { id: 'yt_fJ9rUzIMcZQ', title: 'Leave The Door Open', artist: 'Bruno Mars, Anderson .Paak', youtubeId: 'fJ9rUzIMcZQ', thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/mqdefault.jpg' },
  { id: 'yt_7wtfhZwyrcc', title: 'Blinding Lights', artist: 'The Weeknd', youtubeId: '7wtfhZwyrcc', thumbnail: 'https://i.ytimg.com/vi/7wtfhZwyrcc/mqdefault.jpg' },
  { id: 'yt_xpVfcZ0ZcFM', title: 'Snooze', artist: 'SZA', youtubeId: 'xpVfcZ0ZcFM', thumbnail: 'https://i.ytimg.com/vi/xpVfcZ0ZcFM/mqdefault.jpg' },
  { id: 'yt_rYEDA3JcQqw', title: 'Flowers', artist: 'Miley Cyrus', youtubeId: 'rYEDA3JcQqw', thumbnail: 'https://i.ytimg.com/vi/rYEDA3JcQqw/mqdefault.jpg' },
  { id: 'yt_3JZ_D3ELwOQ', title: 'As It Was', artist: 'Harry Styles', youtubeId: '3JZ_D3ELwOQ', thumbnail: 'https://i.ytimg.com/vi/3JZ_D3ELwOQ/mqdefault.jpg' },
];

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

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

function normalizeText(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function makeSongFromSeed(item, seed = false) {
  const youtubeId = item.youtubeId || item.id || '';
  return {
    id: `yt_${youtubeId || item.id || `${Date.now()}_${Math.random()}`}`,
    name: item.title || item.name || 'Untitled',
    artist: item.artist || item.channelTitle || 'Unknown',
    cover: item.thumbnail || item.cover || '',
    source: 'youtube',
    youtubeId,
    audio: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : '',
    duration: item.duration || '',
    fromHistory: seed,
  };
}

/**
 * Pulls the user's recent listening history to seed mood mix generation.
 *
 * NOTE: the listening_history table has no `thumbnail` column — schema is
 * (id, user_id, youtube_id, name, artist, genre, played_at, play_count).
 * Selecting a nonexistent column throws a Postgres error that gets caught
 * below, silently returning [] every time — which was causing every mix
 * to fall back to FALLBACK_TRACKS. Cover art is derived from youtube_id
 * via YouTube's predictable thumbnail URL instead.
 */
async function getHistorySeeds(userId) {
  if (!userId) {
    try {
      const raw = localStorage.getItem('player:history');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.slice(0, 5).map(item => ({
            name: item.name || item.title || '',
            artist: item.artist || '',
            genre: item.genre || '',
            youtubeId: item.youtubeId || item.id?.replace(/^yt_/, '') || '',
          }))
        : [];
    } catch {
      return [];
    }
  }

  try {
    const { data, error } = await supabase
      .from('listening_history')
      .select('name, artist, genre, youtube_id, played_at')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(6);

    if (error) throw error;

    return (data || []).map(row => ({
      name: row.name || '',
      artist: row.artist || '',
      genre: row.genre || '',
      youtubeId: row.youtube_id || '',
      cover: row.youtube_id ? `https://img.youtube.com/vi/${row.youtube_id}/mqdefault.jpg` : '',
    })).filter(item => item.name || item.artist);
  } catch (err) {
    console.warn('[useMoodPlaylist] history lookup failed', err);
    return [];
  }
}

function pickFallbackTracks(seeds = [], limit = 20) {
  const seedText = (seeds || []).map(s => `${s.artist || ''} ${s.genre || ''} ${s.name || ''}`).join(' ').toLowerCase();
  const genreBoosted = FALLBACK_TRACKS.filter(track => {
    if (!seedText) return true;
    const haystack = `${track.artist || ''} ${track.title || ''}`.toLowerCase();
    return seedText.split(/\s+/).some(word => word && haystack.includes(word));
  });

  const pool = genreBoosted.length ? genreBoosted : FALLBACK_TRACKS;
  return pool.slice(0, limit).map(track => makeSongFromSeed({
    id: track.youtubeId,
    title: track.title,
    artist: track.artist,
    thumbnail: track.thumbnail,
    youtubeId: track.youtubeId,
  }, false));
}

/**
 * Builds the mix: seed tracks (kept as-is, they're the user's actual
 * recent listens) + a reranked pool of YouTube search candidates.
 *
 * userId is passed through explicitly so moodScoring.js can pull the
 * signed-in user's real listening_history for the freshness term —
 * seeds themselves don't carry a userId field.
 */
async function buildHistoryMoodPlaylist(seeds, limit = 20, userId = null) {
  const seedTracks = (seeds || []).slice(0, 3).filter(item => item.name || item.artist).map(item => makeSongFromSeed({
    id: item.youtubeId || '',
    title: item.name,
    artist: item.artist,
    thumbnail: item.cover,
    youtubeId: item.youtubeId,
  }, true));

  const seenKeys = new Set();
  const keyOf = (song) => song.youtubeId ? `yt:${song.youtubeId}` : `id:${song.id}`;

  seedTracks.forEach(s => seenKeys.add(keyOf(s)));

  // Collect a wider pool than `limit` so reranking has room to work —
  // capped to avoid excessive YouTube quota use.
  const poolCap = Math.max(limit * 2, limit + 10);
  const searchPool = [];

  for (const seed of (seeds || []).slice(0, 3)) {
    if (searchPool.length >= poolCap) break;

    const artist = seed.artist?.trim();
    const genre = seed.genre?.trim();
    const title = seed.name?.trim();
    const queries = [];

    if (artist && title) queries.push(`${artist} ${title} similar songs`);
    if (genre && artist) queries.push(`${genre} songs similar to ${artist}`);
    if (artist) queries.push(`${artist} top tracks`);
    if (title) queries.push(`${title} official audio`);

    for (const query of queries) {
      if (!query || searchPool.length >= poolCap) break;
      try {
        const videos = await youtubeConverter.searchVideos(query, 4);
        for (const video of videos) {
          if (searchPool.length >= poolCap) break;
          const headline = normalizeText(video.title);
          const seedTitle = normalizeText(title);
          if (!headline) continue;
          if (seedTitle && headline.includes(seedTitle)) continue;

          const song = makeSongFromSeed({
            id: video.id,
            title: video.title,
            artist: video.channel,
            thumbnail: video.thumbnail,
            duration: video.duration,
            youtubeId: video.id,
          });
          const key = keyOf(song);
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          searchPool.push(song);
        }
      } catch (err) {
        console.warn('[useMoodPlaylist] search failed', err);
      }
    }
  }

  // Rerank the search-derived pool using Score(u,s,t).
  const remainingSlots = Math.max(0, limit - seedTracks.length);
  let rerankedPool = searchPool;
  if (remainingSlots > 0 && searchPool.length) {
    try {
      rerankedPool = await rerankCandidates(searchPool, seeds, userId, remainingSlots);
    } catch (err) {
      console.warn('[useMoodPlaylist] rerank failed, using raw order', err);
      rerankedPool = searchPool.slice(0, remainingSlots);
    }
  }

  const result = [...seedTracks, ...rerankedPool.slice(0, remainingSlots)];

  if (result.length < Math.min(4, limit)) {
    pickFallbackTracks(seeds, limit - result.length).forEach(song => {
      const key = keyOf(song);
      if (!seenKeys.has(key)) { seenKeys.add(key); result.push(song); }
    });
  }

  return result.slice(0, limit);
}

const _fetchMoodPlaylistRaw = async (mood, limit = 20) => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - (parsed.ts || 0) < CACHE_TTL && Array.isArray(parsed.songs)) {
        return deepClone(parsed.songs);
      }
    } catch {}
  }

  const seeds = await getHistorySeeds(mood?.userId || null);
  const songs = await buildHistoryMoodPlaylist(seeds, limit, mood?.userId || null);

  if (songs.length) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ songs, ts: Date.now() }));
    } catch {}
  }

  return songs;
};

const _fetchMoodPlaylistMemoized = memoizeAsync(_fetchMoodPlaylistRaw, CACHE_TTL);

export function useMoodPlaylist() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [songs, setSongs] = useState([]);
  const generatedRef = useRef(null);

  const generatePlaylist = useCallback(async (mood, limit = 20) => {
    setLoading(true);
    setError(null);
    setSongs([]);

    try {
      const result = await _fetchMoodPlaylistMemoized({ userId: user?.id, mood: mood?.trim() || 'history' }, limit);
      setSongs(result);
      generatedRef.current = { mood: mood?.trim() || 'recent listening', songs: result, timestamp: Date.now() };
      return result;
    } catch (err) {
      const msg = err.message || 'Failed to generate playlist. Please try again.';
      setError(msg);
      setSongs([]);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

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