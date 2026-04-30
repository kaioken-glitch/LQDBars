/**
 * useRadio.js — YouTube Mix-style infinite radio
 *
 * PATTERNS APPLIED:
 *   Memoization  — Mix playlist responses cached by videoId+pageToken so
 *                  refills never re-fetch pages already seen
 *   Throttle     — refill is throttled so rapid currentIndex changes
 *                  (e.g. during skip sprees) don't stack up multiple fetches
 *   Deep Clone   — playlist items deep-cloned before injecting into queue
 *                  so cache entries aren't mutated by player state changes
 *   Debounce     — startRadio debounced so double-tapping the button
 *                  doesn't fire two simultaneous builds
 *
 * Quota strategy:
 *   /playlistItems = 1 unit per 50 songs  (vs /search = 100 units per song)
 *   /search used ONLY if seed song has no youtubeId (at most 1 time)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';

const YT_BASE    = 'https://www.googleapis.com/youtube/v3';
const BATCH_SIZE = 10;
const REFILL_AT  = 3;
const REFILL_THROTTLE_MS = 8000; // min 8s between refill fetches

/* ── Deep Clone ─────────────────────────────────────────────────────── */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ── Debounce ───────────────────────────────────────────────────────── */
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

/* ── Memoize (async) ────────────────────────────────────────────────── */
function memoizeAsync(func, ttl = Infinity) {
  const cache = new Map();
  return async function (...args) {
    const key = JSON.stringify(args);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < ttl) return deepClone(hit.value);
    const value = await func.apply(this, args);
    cache.set(key, { value, ts: Date.now() });
    return deepClone(value);
  };
}

/* ── YT Mix playlist fetch (1 quota unit) — memoized ────────────────── */
const fetchMixPage = memoizeAsync(async function(videoId, ytKey, pageToken) {
  const url = new URL(`${YT_BASE}/playlistItems`);
  url.searchParams.set('part',       'snippet');
  url.searchParams.set('playlistId', `RD${videoId}`);
  url.searchParams.set('maxResults', '50');
  url.searchParams.set('key',        ytKey);
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`YT playlistItems ${res.status}`);
  const data = await res.json();
  return { items: data.items || [], nextPageToken: data.nextPageToken || null };
}, 30 * 60 * 1000); // 30min TTL — mix playlist content is stable

/* ── Single search (100 quota units) — memoized, called at most once ── */
const searchOneVideo = memoizeAsync(async function(query, ytKey) {
  const url = new URL(`${YT_BASE}/search`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q',    query);
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('key', ytKey);
  const res  = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  return data.items?.[0]?.id?.videoId || null;
}, 60 * 60 * 1000); // 1h TTL

/* ── Map playlist item → song object ─────────────────────────────────── */
function mapItem(item) {
  const s   = item.snippet;
  const vid = s?.resourceId?.videoId;
  if (!vid) return null;
  const url = `https://www.youtube.com/watch?v=${vid}`;
  return {
    id: `yt_${vid}`, name: s.title || 'Unknown',
    artist: s.videoOwnerChannelTitle || 'YouTube',
    youtubeId: vid,
    cover: s.thumbnails?.medium?.url || `https://img.youtube.com/vi/${vid}/mqdefault.jpg`,
    audio: url, url, src: url,
    album: '', source: 'radio', youtube: true,
  };
}

/* ── Build a batch (1 quota unit via memoized fetch) ─────────────────── */
async function buildBatch(seedVideoId, ytKey, excludeIds, pageToken) {
  const { items, nextPageToken } = await fetchMixPage(seedVideoId, ytKey, pageToken || null);
  const results = [];
  for (const item of items) {
    const song = mapItem(item);
    if (!song || song.youtubeId === seedVideoId || excludeIds.has(song.id)) continue;
    excludeIds.add(song.id);
    results.push(song);
    if (results.length >= BATCH_SIZE) break;
  }
  return { songs: results, nextPageToken };
}

/* ── Hook ─────────────────────────────────────────────────────────────── */
export function useSmartRadio() {
  const {
    currentSong,
    currentIndex,
    songs,
    setPlayerSongs,
    setIsPlaying,
  } = usePlayer();

  const [radioMode,    setRadioMode]    = useState(false);
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioError,   setRadioError]   = useState(null);

  const seedVideoId     = useRef(null);
  const nextPageToken   = useRef(null);
  const seenIds         = useRef(new Set());
  const alive           = useRef(true);
  const lastRefillTime  = useRef(0);    // throttle: timestamp of last refill
  const lastRefillIdx   = useRef(-1);   // dedupe: don't refill twice at same index

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /* ── startRadio — debounced so double-tap doesn't double-build ── */
  const _startRadioCore = useCallback(async () => {
    if (!currentSong) { setRadioError('Play a song first.'); return; }
    const ytKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!ytKey)  { setRadioError('YouTube API key not configured.'); return; }

    setRadioLoading(true);
    setRadioError(null);
    seenIds.current = new Set(songs.map(s => s.id));

    try {
      // Resolve videoId — free if already on the song object
      let videoId = currentSong.youtubeId;
      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        // One /search call (100 units), memoized so second call is free
        videoId = await searchOneVideo(
          `${currentSong.name} ${currentSong.artist} audio`, ytKey
        );
      }
      if (!videoId) { setRadioError("Couldn't find this song on YouTube."); setRadioLoading(false); return; }

      // Fetch Mix playlist — 1 quota unit, result memoized
      const { songs: batch, nextPageToken: npt } =
        await buildBatch(videoId, ytKey, seenIds.current, null);

      if (!alive.current) return;
      if (!batch.length) { setRadioError('No radio tracks found.'); setRadioLoading(false); return; }

      seedVideoId.current   = videoId;
      nextPageToken.current = npt;

      // Deep clone before injecting — player state can't corrupt the cache
      setPlayerSongs(prev => {
        const arr = Array.isArray(prev) ? prev : [];
        return [
          ...arr.slice(0, currentIndex + 1),
          ...batch.map(deepClone),
          ...arr.slice(currentIndex + 1),
        ];
      });

      setRadioMode(true);
    } catch (e) {
      if (!alive.current) return;
      setRadioError(e.message || 'Failed to start radio.');
    } finally {
      if (alive.current) setRadioLoading(false);
    }
  }, [currentSong, currentIndex, songs, setPlayerSongs]);

  // Debounced wrapper — absorbs double-taps with 500ms window
  const startRadio = useCallback(
    debounce((...args) => _startRadioCore(...args), 500),
    [_startRadioCore]
  );

  /* ── Stop radio ── */
  const stopRadio = useCallback(() => {
    setPlayerSongs(prev => (Array.isArray(prev) ? prev : []).filter(s => s.source !== 'radio'));
    setRadioMode(false);
    setRadioError(null);
    seedVideoId.current   = null;
    nextPageToken.current = null;
    seenIds.current.clear();
    lastRefillTime.current = 0;
    lastRefillIdx.current  = -1;
  }, [setPlayerSongs]);

  /* ── Auto-refill — throttled so rapid skipping doesn't burn quota ── */
  useEffect(() => {
    if (!radioMode || radioLoading || !seedVideoId.current) return;

    const remaining = songs.slice(currentIndex + 1).filter(s => s.source === 'radio').length;
    if (remaining > REFILL_AT) return;

    // Throttle: don't refill more often than REFILL_THROTTLE_MS
    const now = Date.now();
    if (now - lastRefillTime.current < REFILL_THROTTLE_MS) return;

    // Dedupe: don't refill twice for the same index
    if (lastRefillIdx.current === currentIndex) return;

    lastRefillTime.current = now;
    lastRefillIdx.current  = currentIndex;

    const ytKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!ytKey) return;

    setRadioLoading(true);
    buildBatch(seedVideoId.current, ytKey, seenIds.current, nextPageToken.current)
      .then(({ songs: batch, nextPageToken: npt }) => {
        if (!alive.current) return;
        nextPageToken.current = npt;
        if (batch.length) {
          setPlayerSongs(prev => [
            ...(Array.isArray(prev) ? prev : []),
            ...batch.map(deepClone),
          ]);
        }
      })
      .catch(e => console.warn('[useRadio] refill:', e.message))
      .finally(() => { if (alive.current) setRadioLoading(false); });

  }, [radioMode, radioLoading, currentIndex, songs.length, setPlayerSongs]);

  return { radioMode, radioLoading, radioError, startRadio, stopRadio };
}