/**
 * useRadio.js — YouTube Mix-style infinite radio
 *
 * QUOTA-EFFICIENT STRATEGY
 * ─────────────────────────────────────────────────────────────────────
 * OLD approach (broken):  8 × /search calls = 800 quota units per batch
 * NEW approach:           1 × /playlistItems call = 1 quota unit per 50 songs
 *
 * How it works:
 *  1. We already have the current song's youtubeId from PlayerContext.
 *     If not, one /search call (100 units) finds it — done once, cached.
 *  2. YouTube auto-generates a Mix playlist for every video:
 *       list = "RD" + videoId   (e.g. RDdQw4w9WgXcQ)
 *     Fetching it with /playlistItems costs 1 unit and returns 50 songs.
 *  3. We map those items directly to playable songs — no further API calls.
 *  4. Last.fm is used optionally to get artist metadata for display only,
 *     it costs 0 YT quota.
 *
 * Result: entire radio session costs ~2–3 quota units total vs 800+ before.
 * ─────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';

const YT_BASE    = 'https://www.googleapis.com/youtube/v3';
const BATCH_SIZE = 10;  // songs to inject per batch from the Mix playlist
const REFILL_AT  = 3;   // refill when this many radio songs remain after current

/* ─────────────────────────────────────────────────────────────────────
   fetchMixPlaylist
   Fetches YouTube's auto-generated Mix playlist for a given videoId.
   Cost: 1 quota unit per call (returns up to 50 items).
   The Mix playlist ID is always "RD" + videoId.
───────────────────────────────────────────────────────────────────── */
async function fetchMixPlaylist(videoId, ytKey, pageToken = null) {
  const mixPlaylistId = `RD${videoId}`;
  const url = new URL(`${YT_BASE}/playlistItems`);
  url.searchParams.set('part',       'snippet');
  url.searchParams.set('playlistId', mixPlaylistId);
  url.searchParams.set('maxResults', '50');
  url.searchParams.set('key',        ytKey);
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `YT playlistItems ${res.status}`);
  }
  const data = await res.json();
  return {
    items:         data.items || [],
    nextPageToken: data.nextPageToken || null,
  };
}

/* ─────────────────────────────────────────────────────────────────────
   searchOneVideo
   One /search call to find a videoId by name+artist.
   Cost: 100 quota units — only called if we don't already have a videoId.
   Result is cached in memory so it's never called twice for the same song.
───────────────────────────────────────────────────────────────────── */
const searchCache = new Map();

async function searchOneVideo(query, ytKey) {
  if (searchCache.has(query)) return searchCache.get(query);
  const url = new URL(`${YT_BASE}/search`);
  url.searchParams.set('part',       'snippet');
  url.searchParams.set('type',       'video');
  url.searchParams.set('q',          query);
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('key',        ytKey);
  // no videoCategoryId — causes 403 on standard Data API v3 keys
  const res  = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const vid  = data.items?.[0]?.id?.videoId || null;
  if (vid) searchCache.set(query, vid);
  return vid;
}

/* ─────────────────────────────────────────────────────────────────────
   mapPlaylistItem → song object
───────────────────────────────────────────────────────────────────── */
function mapItem(item) {
  const snip    = item.snippet;
  const videoId = snip?.resourceId?.videoId;
  if (!videoId) return null;

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return {
    id:        `yt_${videoId}`,
    name:      snip.title          || 'Unknown',
    artist:    snip.videoOwnerChannelTitle || 'YouTube',
    youtubeId: videoId,
    cover:     snip.thumbnails?.medium?.url
               || snip.thumbnails?.default?.url
               || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    audio: ytUrl, url: ytUrl, src: ytUrl,
    album:   '',
    source:  'radio',
    youtube: true,
  };
}

/* ─────────────────────────────────────────────────────────────────────
   buildBatch
   Fetches a slice of the YT Mix playlist and returns BATCH_SIZE songs,
   skipping any already in excludeIds.
   Total cost: 1 quota unit.
───────────────────────────────────────────────────────────────────── */
async function buildBatch(seedVideoId, ytKey, excludeIds = new Set(), pageToken = null) {
  const { items, nextPageToken } = await fetchMixPlaylist(seedVideoId, ytKey, pageToken);

  const results = [];
  for (const item of items) {
    const song = mapItem(item);
    if (!song) continue;
    if (excludeIds.has(song.id)) continue;
    // Skip the seed itself
    if (song.youtubeId === seedVideoId) continue;
    excludeIds.add(song.id);
    results.push(song);
    if (results.length >= BATCH_SIZE) break;
  }

  return { songs: results, nextPageToken };
}

/* ─────────────────────────────────────────────────────────────────────
   useRadio hook
───────────────────────────────────────────────────────────────────── */
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

  // The videoId of the song that seeded the current Mix playlist
  const seedVideoIdRef   = useRef(null);
  // Next page token for paginating the Mix playlist
  const nextPageTokenRef = useRef(null);
  // IDs already added to queue
  const seenIds          = useRef(new Set());
  // Debounce: don't refill twice for same index
  const lastRefill       = useRef(-1);
  const alive            = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /* ── Resolve a videoId for the current song ── */
  const resolveVideoId = useCallback(async (song, ytKey) => {
    // Already have it — free
    if (song.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(song.youtubeId)) {
      return song.youtubeId;
    }
    // Need one search call (100 units) — only happens if song has no youtubeId
    const query = `${song.name} ${song.artist} official audio`;
    return searchOneVideo(query, ytKey);
  }, []);

  /* ── Start radio ── */
  const startRadio = useCallback(async () => {
    if (!currentSong) {
      setRadioError('Play a song first to seed the radio mix.');
      return;
    }

    const ytKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!ytKey) {
      setRadioError('YouTube API key not configured.');
      return;
    }

    setRadioLoading(true);
    setRadioError(null);
    seenIds.current = new Set(songs.map(s => s.id));

    try {
      // Step 1: get a videoId for the seed song (usually free)
      const videoId = await resolveVideoId(currentSong, ytKey);
      if (!videoId) {
        setRadioError('Could not find this song on YouTube.');
        setRadioLoading(false);
        return;
      }

      // Step 2: fetch the YT Mix playlist — 1 quota unit
      const { songs: batch, nextPageToken } = await buildBatch(
        videoId, ytKey, seenIds.current
      );

      if (!alive.current) return;

      if (!batch.length) {
        setRadioError('No radio tracks found for this song.');
        setRadioLoading(false);
        return;
      }

      seedVideoIdRef.current   = videoId;
      nextPageTokenRef.current = nextPageToken;

      // Inject right after current position
      setPlayerSongs(prev => {
        const arr = Array.isArray(prev) ? prev : [];
        return [
          ...arr.slice(0, currentIndex + 1),
          ...batch,
          ...arr.slice(currentIndex + 1),
        ];
      });

      setRadioMode(true);

    } catch (e) {
      if (!alive.current) return;
      console.error('[useRadio] startRadio:', e);
      setRadioError(e.message || 'Failed to start radio. Try again.');
    } finally {
      if (alive.current) setRadioLoading(false);
    }
  }, [currentSong, currentIndex, songs, setPlayerSongs, resolveVideoId]);

  /* ── Stop radio ── */
  const stopRadio = useCallback(() => {
    setPlayerSongs(prev =>
      (Array.isArray(prev) ? prev : []).filter(s => s.source !== 'radio')
    );
    setRadioMode(false);
    setRadioError(null);
    seedVideoIdRef.current   = null;
    nextPageTokenRef.current = null;
    seenIds.current.clear();
    lastRefill.current = -1;
  }, [setPlayerSongs]);

  /* ── Auto-refill when queue runs low ── */
  useEffect(() => {
    if (!radioMode || radioLoading) return;
    if (!seedVideoIdRef.current) return;

    const remaining = songs
      .slice(currentIndex + 1)
      .filter(s => s.source === 'radio').length;

    if (remaining > REFILL_AT) return;
    if (lastRefill.current === currentIndex) return;
    lastRefill.current = currentIndex;

    const ytKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!ytKey) return;

    setRadioLoading(true);

    buildBatch(
      seedVideoIdRef.current,
      ytKey,
      seenIds.current,
      nextPageTokenRef.current,   // paginate — never re-fetches same songs
    ).then(({ songs: batch, nextPageToken }) => {
      if (!alive.current) return;
      nextPageTokenRef.current = nextPageToken;
      if (batch.length) {
        setPlayerSongs(prev => [
          ...(Array.isArray(prev) ? prev : []),
          ...batch,
        ]);
      }
    }).catch(e => {
      console.warn('[useRadio] refill:', e.message);
    }).finally(() => {
      if (alive.current) setRadioLoading(false);
    });

  }, [radioMode, radioLoading, currentIndex, songs, setPlayerSongs]);

  return { radioMode, radioLoading, radioError, startRadio, stopRadio };
}