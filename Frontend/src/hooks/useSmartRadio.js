/**
 * useRadio.js — YouTube Mix-style infinite radio
 *
 * PATTERNS APPLIED:
 *   Memoization  — Mix playlist responses cached by videoId+pageToken so
 *                  refills never re-fetch pages already seen (now lives in
 *                  ytMixPlaylist.js, shared with useMoodPlaylist.js)
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
 *
 * NOTE: the Mix-playlist fetch/map/batch logic that used to live here
 * (fetchMixPage, mapItem, buildBatch) has been extracted to
 * src/utils/ytMixPlaylist.js so useMoodPlaylist.js can use the identical
 * cheap "similar songs" source instead of duplicating it or falling back
 * to expensive parallel /search calls.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { buildMixBatch, deepClone, memoizeAsync } from '../utils/ytMixPlaylist';

const YT_BASE    = 'https://www.googleapis.com/youtube/v3';
const BATCH_SIZE = 10;
const REFILL_AT  = 3;
const REFILL_THROTTLE_MS = 8000; // min 8s between refill fetches

/* ── Debounce ───────────────────────────────────────────────────────── */
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

/* ── Single search (100 quota units) — memoized, called at most once ── */
const searchOneVideo = memoizeAsync(async function (query, ytKey) {
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
    // seenIds tracks youtubeIds (not `yt_`-prefixed song ids) — matches
    // buildMixBatch's excludeIds contract in ytMixPlaylist.js
    seenIds.current = new Set(
      songs.map(s => s.youtubeId || (s.id || '').replace(/^yt_/, '')).filter(Boolean)
    );

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
        await buildMixBatch(videoId, ytKey, seenIds.current, null, BATCH_SIZE, 'radio');

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
    buildMixBatch(seedVideoId.current, ytKey, seenIds.current, nextPageToken.current, BATCH_SIZE, 'radio')
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