/**
 * useMoodPlaylist.js
 *
 * Builds a mood mix from the user's recent listening history and adds
 * related tracks from similar artists/genres.
 */

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import youtubeConverter from '../utils/youtubeConverter';

const CACHE_KEY = 'lb:history_mood_mix';
const CACHE_TTL = 4 * 60 * 60 * 1000;
const memCache = new Map();

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
      .select('name, artist, genre, youtube_id, thumbnail, played_at')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(6);

    if (error) throw error;

    return (data || []).map(row => ({
      name: row.name || '',
      artist: row.artist || '',
      genre: row.genre || '',
      youtubeId: row.youtube_id || '',
      cover: row.thumbnail || '',
    })).filter(item => item.name || item.artist);
  } catch (err) {
    console.warn('[useMoodPlaylist] history lookup failed', err);
    return [];
  }
}

async function buildHistoryMoodPlaylist(seeds, limit = 20) {
  const seedTracks = (seeds || []).slice(0, 3).filter(item => item.name || item.artist).map(item => makeSongFromSeed({
    id: item.youtubeId || '',
    title: item.name,
    artist: item.artist,
    thumbnail: item.cover,
    youtubeId: item.youtubeId,
  }, true));

  const seenKeys = new Set();
  const result = [];

  const addSong = (song) => {
    if (!song) return;
    const key = song.youtubeId ? `yt:${song.youtubeId}` : `id:${song.id}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    result.push(song);
  };

  seedTracks.forEach(addSong);

  for (const seed of (seeds || []).slice(0, 3)) {
    if (result.length >= limit) break;

    const artist = seed.artist?.trim();
    const genre = seed.genre?.trim();
    const title = seed.name?.trim();
    const queries = [];

    if (artist && title) queries.push(`${artist} ${title} similar songs`);
    if (genre && artist) queries.push(`${genre} songs similar to ${artist}`);
    if (artist) queries.push(`${artist} top tracks`);
    if (title) queries.push(`${title} official audio`);

    for (const query of queries) {
      if (!query || result.length >= limit) break;
      try {
        const videos = await youtubeConverter.searchVideos(query, 4);
        for (const video of videos) {
          if (result.length >= limit) break;
          const headline = normalizeText(video.title);
          const seedTitle = normalizeText(title);
          if (!headline) continue;
          if (seedTitle && headline.includes(seedTitle)) continue;
          addSong(makeSongFromSeed({
            id: video.id,
            title: video.title,
            artist: video.channel,
            thumbnail: video.thumbnail,
            duration: video.duration,
            youtubeId: video.id,
          }));
        }
      } catch (err) {
        console.warn('[useMoodPlaylist] search failed', err);
      }
    }
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
  const songs = await buildHistoryMoodPlaylist(seeds, limit);

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ songs, ts: Date.now() }));
  } catch {}

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
