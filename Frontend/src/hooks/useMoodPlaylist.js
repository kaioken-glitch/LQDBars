/**
 * useMoodPlaylist.js
 *
 * Builds a mood mix from the user's recent listening history and adds
 * related tracks. Candidates now come primarily from YouTube's own Mix
 * playlist (RD{videoId} via /playlistItems — 1 quota unit per 50 songs),
 * seeded from the user's deduped top history tracks, with a supplementary
 * text search using the daypart's mood prompt so genre actually gets
 * injected. The old parallel-/search sweep is kept only as a thin
 * fallback when the pool comes up short (e.g. no YouTube key, or Mix
 * playlists unavailable for the seed).
 *
 * Search-derived candidates are reranked via moodScoring.js (content
 * affinity + freshness + diversity, now mood-prompt-aware) before being
 * trimmed to the requested limit.
 */

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import youtubeConverter from '../utils/youtubeConverter';
import { buildMixBatch } from '../utils/ytMixPlaylists';
import { rerankCandidates } from './moodScoring';

const CACHE_PREFIX = 'lb:history_mood_mix';
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

/**
 * Scope the localStorage cache key by the actual mood/daypart prompt
 * instead of one hardcoded constant. Previously every daypart (morning/
 * noon/evening) shared a single CACHE_KEY, so whichever daypart mix
 * generated first within the 4h TTL got cached, and other dayparts could
 * silently be served its songs if HomeOnline's own per-daypart cache
 * happened to miss at the same time.
 */
function cacheKeyFor(mood) {
  const slug = normalizeText(mood || 'history').replace(/\s+/g, '_').slice(0, 48) || 'history';
  return `${CACHE_PREFIX}:${slug}`;
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
 * Dedupe a list of raw history rows by youtubeId, keeping the entry with
 * the most recent playedAt. Rows are assumed to already be roughly
 * recent-first (both the Supabase query and the localStorage list are
 * ordered that way), so the first occurrence of a given youtubeId is kept.
 */
function dedupeSeedRows(rows) {
  const seen = new Map(); // youtubeId -> row
  for (const row of rows) {
    const key = row.youtubeId || `noyt:${normalizeText(row.name)}|${normalizeText(row.artist)}`;
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, row);
  }
  return Array.from(seen.values());
}

/**
 * Pulls the user's recent listening history to seed mood mix generation.
 *
 * Fetches a wider pool (30 rows) before deduping — listening_history logs
 * one row PER PLAY EVENT (no upsert), so the raw top-6 previously handed
 * straight to the mix builder could easily contain the same song twice
 * if it had been replayed recently. We now dedupe by youtube_id across a
 * larger window, then take the top 6 unique tracks.
 *
 * NOTE: the listening_history table has no `thumbnail` column — schema is
 * (id, user_id, youtube_id, name, artist, genre, played_at, play_count).
 * Cover art is derived from youtube_id via YouTube's predictable
 * thumbnail URL instead.
 */
async function getHistorySeeds(userId) {
  if (!userId) {
    try {
      const raw = localStorage.getItem('player:history');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const rows = parsed.slice(0, 30).map(item => ({
        name: item.name || item.title || '',
        artist: item.artist || '',
        genre: item.genre || '',
        youtubeId: item.youtubeId || item.id?.replace(/^yt_/, '') || '',
        playedAt: item.playedAt || 0,
        cover: item.cover || '',
      }));

      return dedupeSeedRows(rows).slice(0, 6);
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
      .limit(30);

    if (error) throw error;

    const rows = (data || [])
      .map(row => ({
        name: row.name || '',
        artist: row.artist || '',
        genre: row.genre || '',
        youtubeId: row.youtube_id || '',
        playedAt: row.played_at || 0,
        cover: row.youtube_id ? `https://img.youtube.com/vi/${row.youtube_id}/mqdefault.jpg` : '',
      }))
      .filter(item => item.name || item.artist);

    return dedupeSeedRows(rows).slice(0, 6);
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
 * Primary candidate source: YouTube Mix playlists (1 quota unit per
 * fetch) seeded from the user's deduped top history tracks, via the
 * same buildMixBatch() util useSmartRadio.js uses — plus one
 * supplementary text search using the daypart's mood prompt so genre
 * flavor actually makes it into the mix (previously dead weight).
 */
async function gatherMixCandidates(seeds, moodPrompt, poolCap) {
  const ytKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  const excludeIds = new Set(seeds.map(s => s.youtubeId).filter(Boolean));
  const pool = [];

  if (ytKey) {
    const seededHistory = seeds.filter(s => s.youtubeId);
    for (const seed of seededHistory) {
      if (pool.length >= poolCap) break;
      const perSeedCap = Math.max(3, Math.ceil((poolCap - pool.length) / Math.max(1, seededHistory.length)));
      try {
        const { songs: batch } = await buildMixBatch(seed.youtubeId, ytKey, excludeIds, null, perSeedCap, 'mood-mix');
        pool.push(...batch.map(song => makeSongFromSeed({
          id: song.youtubeId, title: song.name, artist: song.artist,
          thumbnail: song.cover, youtubeId: song.youtubeId,
        })));
      } catch (err) {
        console.warn('[useMoodPlaylist] mix batch failed for seed', seed.name, err);
      }
    }

    // Supplementary: inject the daypart's mood/genre flavor directly —
    // this is what daypartConfig.prompt was for and previously never used.
    if (moodPrompt && pool.length < poolCap) {
      try {
        const videos = await youtubeConverter.searchVideos(moodPrompt, Math.min(8, poolCap - pool.length));
        for (const video of videos) {
          if (pool.length >= poolCap) break;
          if (!video.id || excludeIds.has(video.id)) continue;
          excludeIds.add(video.id);
          pool.push(makeSongFromSeed({
            id: video.id, title: video.title, artist: video.channel,
            thumbnail: video.thumbnail, duration: video.duration, youtubeId: video.id,
          }));
        }
      } catch (err) {
        console.warn('[useMoodPlaylist] mood-prompt search failed', err);
      }
    }
  }

  return { pool, excludeIds };
}

/**
 * Thin fallback — only runs if the Mix-playlist + mood-prompt pool above
 * came up short (no YouTube key, Mix unavailable for every seed, etc).
 * Capped much tighter than the old version (1 query per seed instead of
 * up to 4) since it's now a safety net, not the primary source.
 */
async function gatherFallbackSearchCandidates(seeds, excludeIds, poolCap, currentPoolSize) {
  const extra = [];
  const budget = poolCap - currentPoolSize;
  if (budget <= 0) return extra;

  for (const seed of seeds.slice(0, 3)) {
    if (extra.length >= budget) break;
    const artist = seed.artist?.trim();
    const title = seed.name?.trim();
    const query = artist && title ? `${artist} ${title} similar songs` : (artist ? `${artist} top tracks` : null);
    if (!query) continue;

    try {
      const videos = await youtubeConverter.searchVideos(query, 4);
      for (const video of videos) {
        if (extra.length >= budget) break;
        const headline = normalizeText(video.title);
        const seedTitle = normalizeText(title);
        if (!headline || (seedTitle && headline.includes(seedTitle))) continue;
        if (excludeIds.has(video.id)) continue;
        excludeIds.add(video.id);
        extra.push(makeSongFromSeed({
          id: video.id, title: video.title, artist: video.channel,
          thumbnail: video.thumbnail, duration: video.duration, youtubeId: video.id,
        }));
      }
    } catch (err) {
      console.warn('[useMoodPlaylist] fallback search failed', err);
    }
  }

  return extra;
}

/**
 * Builds the mix: seed tracks (kept as-is, they're the user's actual
 * recent listens, already deduped by getHistorySeeds) + a reranked pool
 * of candidates sourced primarily from YouTube Mix playlists.
 *
 * userId is passed through explicitly so moodScoring.js can pull the
 * signed-in user's real listening_history for the freshness term.
 * moodPrompt (the daypart's flavor text) is passed through so scoring
 * can nudge toward it too, not just candidate generation.
 */
async function buildHistoryMoodPlaylist(seeds, limit = 20, userId = null, moodPrompt = '') {
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

  // Collect a wider pool than `limit` so reranking has room to work.
  const poolCap = Math.max(limit * 2, limit + 10);

  const { pool: mixPool, excludeIds } = await gatherMixCandidates(seeds || [], moodPrompt, poolCap);

  let searchPool = mixPool.filter(song => {
    const key = keyOf(song);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  // Thin fallback only if the cheap sources didn't fill the pool.
  if (searchPool.length < Math.min(limit, poolCap)) {
    const extra = await gatherFallbackSearchCandidates(seeds || [], excludeIds, poolCap, searchPool.length);
    for (const song of extra) {
      const key = keyOf(song);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      searchPool.push(song);
    }
  }

  // Rerank the candidate pool using Score(u,s,t), now mood-prompt-aware.
  const remainingSlots = Math.max(0, limit - seedTracks.length);
  let rerankedPool = searchPool;
  if (remainingSlots > 0 && searchPool.length) {
    try {
      rerankedPool = await rerankCandidates(searchPool, seeds, userId, remainingSlots, moodPrompt);
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
  const moodText = mood?.mood || '';
  const cacheKey = cacheKeyFor(moodText);

  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - (parsed.ts || 0) < CACHE_TTL && Array.isArray(parsed.songs)) {
        return deepClone(parsed.songs);
      }
    } catch {}
  }

  const seeds = await getHistorySeeds(mood?.userId || null);
  const songs = await buildHistoryMoodPlaylist(seeds, limit, mood?.userId || null, moodText);

  if (songs.length) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ songs, ts: Date.now() }));
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