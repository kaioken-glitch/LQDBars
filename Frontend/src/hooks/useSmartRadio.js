/**
 * useRadio.js — YouTube Mix-style infinite radio
 *
 * Quota strategy:
 *   - Uses YouTube's auto-generated RD{videoId} Mix playlist
 *   - /playlistItems costs 1 unit and returns 50 songs
 *   - /search (100 units) only called once if the seed has no youtubeId
 *   - Refill is debounced: only fires when queue genuinely low AND
 *     the current song has actually been playing for > 5 s (not cycling)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';

const YT_BASE    = 'https://www.googleapis.com/youtube/v3';
const BATCH_SIZE = 10;
const REFILL_AT  = 3;

/* ── Fetch YouTube Mix playlist (1 quota unit per call) ─────────── */
async function fetchMixPlaylist(videoId, ytKey, pageToken = null) {
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
}

/* ── Search for a videoId (100 quota units — called at most once) ── */
const searchCache = new Map();
async function searchVideoId(query, ytKey) {
  if (searchCache.has(query)) return searchCache.get(query);
  const url = new URL(`${YT_BASE}/search`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q',    query);
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('key', ytKey);
  const res  = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const vid  = data.items?.[0]?.id?.videoId || null;
  if (vid) searchCache.set(query, vid);
  return vid;
}

/* ── Map a playlist item to a song object ───────────────────────── */
function mapItem(item) {
  const s   = item.snippet;
  const vid = s?.resourceId?.videoId;
  if (!vid) return null;
  const url = `https://www.youtube.com/watch?v=${vid}`;
  return {
    id: `yt_${vid}`, name: s.title || 'Unknown',
    artist: s.videoOwnerChannelTitle || 'YouTube',
    youtubeId: vid, cover: s.thumbnails?.medium?.url || `https://img.youtube.com/vi/${vid}/mqdefault.jpg`,
    audio: url, url, src: url,
    album: '', source: 'radio', youtube: true,
  };
}

/* ── Build a batch from the Mix playlist (1 quota unit) ─────────── */
async function buildBatch(seedVideoId, ytKey, excludeIds, pageToken) {
  const { items, nextPageToken } = await fetchMixPlaylist(seedVideoId, ytKey, pageToken);
  const results = [];
  for (const item of items) {
    const song = mapItem(item);
    if (!song || song.youtubeId === seedVideoId) continue;
    if (excludeIds.has(song.id)) continue;
    excludeIds.add(song.id);
    results.push(song);
    if (results.length >= BATCH_SIZE) break;
  }
  return { songs: results, nextPageToken };
}

/* ── Hook ───────────────────────────────────────────────────────── */
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

  // Refill guard — only allow one refill per unique (index, songsLength) pair
  // This stops the refill from firing repeatedly while cycling
  const lastRefillKey   = useRef('');
  // Track how long the current index has been stable (don't refill mid-cycle)
  const indexStableAt   = useRef(Date.now());
  const prevIndex       = useRef(currentIndex);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Reset stability timer when index changes
  useEffect(() => {
    if (currentIndex !== prevIndex.current) {
      indexStableAt.current = Date.now();
      prevIndex.current = currentIndex;
    }
  }, [currentIndex]);

  /* ── Start radio ── */
  const startRadio = useCallback(async () => {
    if (!currentSong) { setRadioError('Play a song first.'); return; }
    const ytKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!ytKey)  { setRadioError('YouTube API key not configured.'); return; }

    setRadioLoading(true);
    setRadioError(null);
    seenIds.current = new Set(songs.map(s => s.id));

    try {
      // Get videoId — free if already on the song
      let videoId = currentSong.youtubeId;
      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        videoId = await searchVideoId(`${currentSong.name} ${currentSong.artist} audio`, ytKey);
      }
      if (!videoId) { setRadioError("Couldn't find this song on YouTube."); setRadioLoading(false); return; }

      // Fetch Mix playlist — 1 quota unit
      const { songs: batch, nextPageToken: npt } = await buildBatch(videoId, ytKey, seenIds.current, null);
      if (!alive.current) return;
      if (!batch.length)  { setRadioError('No radio tracks found for this song.'); setRadioLoading(false); return; }

      seedVideoId.current   = videoId;
      nextPageToken.current = npt;

      setPlayerSongs(prev => {
        const arr = Array.isArray(prev) ? prev : [];
        return [...arr.slice(0, currentIndex + 1), ...batch, ...arr.slice(currentIndex + 1)];
      });

      setRadioMode(true);
    } catch (e) {
      if (!alive.current) return;
      setRadioError(e.message || 'Failed to start radio.');
    } finally {
      if (alive.current) setRadioLoading(false);
    }
  }, [currentSong, currentIndex, songs, setPlayerSongs]);

  /* ── Stop radio ── */
  const stopRadio = useCallback(() => {
    setPlayerSongs(prev => (Array.isArray(prev) ? prev : []).filter(s => s.source !== 'radio'));
    setRadioMode(false);
    setRadioError(null);
    seedVideoId.current   = null;
    nextPageToken.current = null;
    seenIds.current.clear();
    lastRefillKey.current = '';
  }, [setPlayerSongs]);

  /* ── Auto-refill — guarded against cycling ── */
  useEffect(() => {
    if (!radioMode || radioLoading || !seedVideoId.current) return;

    // Only refill if the current index has been stable for at least 2 seconds
    // This prevents refill from firing while cycling through songs
    const stable = Date.now() - indexStableAt.current > 2000;
    if (!stable) return;

    const remaining = songs.slice(currentIndex + 1).filter(s => s.source === 'radio').length;
    if (remaining > REFILL_AT) return;

    // Unique key: only refill once per (index + songsLength) combination
    const key = `${currentIndex}-${songs.length}`;
    if (lastRefillKey.current === key) return;
    lastRefillKey.current = key;

    const ytKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!ytKey) return;

    setRadioLoading(true);
    buildBatch(seedVideoId.current, ytKey, seenIds.current, nextPageToken.current)
      .then(({ songs: batch, nextPageToken: npt }) => {
        if (!alive.current) return;
        nextPageToken.current = npt;
        if (batch.length) {
          setPlayerSongs(prev => [...(Array.isArray(prev) ? prev : []), ...batch]);
        }
      })
      .catch(e => console.warn('[useRadio] refill:', e.message))
      .finally(() => { if (alive.current) setRadioLoading(false); });

  }, [radioMode, radioLoading, currentIndex, songs.length, setPlayerSongs]);
  // songs.length instead of songs — avoids re-running every time radio appends

  return { radioMode, radioLoading, radioError, startRadio, stopRadio };
}