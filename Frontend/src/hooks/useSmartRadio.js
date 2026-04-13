/**
 * useRadio.js
 *
 * YouTube Mix–style infinite radio.
 *
 * Flow:
 *   1. Seed song → Last.fm track.getSimilar → up to 20 similar tracks
 *   2. Each similar track → YouTube Data API search → videoId
 *   3. Inject into PlayerContext queue after current position
 *   4. When queue runs low (≤2 songs left) → auto-fetch next batch
 *      seeded from the last track in the current queue
 *
 * Requires:
 *   VITE_LASTFM_API_KEY   — free at last.fm/api
 *   VITE_YOUTUBE_API_KEY  — already in your .env
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';

const LASTFM_BASE  = 'https://ws.audioscrobbler.com/2.0';
const YT_BASE      = 'https://www.googleapis.com/youtube/v3';
const BATCH_SIZE   = 15;   // tracks to fetch per refill
const REFILL_AT    = 2;    // refill when this many songs remain after current

/* ─── Last.fm: similar tracks ────────────────────────────────── */
async function fetchSimilar(artist, title, limit = BATCH_SIZE) {
  const key = import.meta.env.VITE_LASTFM_API_KEY;
  if (!key) throw new Error('VITE_LASTFM_API_KEY not set');

  const url = new URL(`${LASTFM_BASE}/`);
  url.searchParams.set('method',     'track.getSimilar');
  url.searchParams.set('track',      title);
  url.searchParams.set('artist',     artist);
  url.searchParams.set('api_key',    key);
  url.searchParams.set('format',     'json');
  url.searchParams.set('limit',      String(limit));
  url.searchParams.set('autocorrect','1');

  const res  = await fetch(url.toString());
  const data = await res.json();

  if (data.error) throw new Error(`Last.fm: ${data.message}`);
  return (data.similartracks?.track || []).map(t => ({
    title:  t.name,
    artist: typeof t.artist === 'string' ? t.artist : t.artist?.name || '',
  }));
}

/* ─── YouTube: search for videoId ───────────────────────────── */
async function searchYouTube(artist, title) {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!key) throw new Error('VITE_YOUTUBE_API_KEY not set');

  const q   = `${artist} ${title} official audio`;
  const url = new URL(`${YT_BASE}/search`);
  url.searchParams.set('part',       'snippet');
  url.searchParams.set('q',          q);
  url.searchParams.set('type',       'video');
  url.searchParams.set('videoCategoryId', '10'); // Music category
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('key',        key);

  const res  = await fetch(url.toString());
  const data = await res.json();

  const item = data.items?.[0];
  if (!item) return null;

  const videoId = item.id?.videoId;
  if (!videoId) return null;

  return {
    id:        videoId,
    name:      item.snippet?.title    || title,
    artist:    item.snippet?.channelTitle || artist,
    youtubeId: videoId,
    cover:     `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    album:     '',
    source:    'radio',
    _radioMeta: { originalArtist: artist, originalTitle: title },
  };
}

/* ─── Build a batch of resolved songs ───────────────────────── */
async function buildBatch(seedArtist, seedTitle, excludeIds = new Set()) {
  let similar;
  try {
    similar = await fetchSimilar(seedArtist, seedTitle, BATCH_SIZE + 5);
  } catch (e) {
    console.warn('[useRadio] Last.fm failed:', e.message);
    return [];
  }

  // Resolve in parallel, cap concurrency via chunking
  const results = [];
  for (let i = 0; i < similar.length && results.length < BATCH_SIZE; i++) {
    const { artist, title } = similar[i];
    try {
      const song = await searchYouTube(artist, title);
      if (song && !excludeIds.has(song.id)) {
        excludeIds.add(song.id);
        results.push(song);
      }
    } catch (e) {
      console.warn(`[useRadio] YT search failed for "${title}":`, e.message);
    }
  }

  return results;
}

/* ─── Hook ───────────────────────────────────────────────────── */
export function useRadio() {
  const {
    currentSong,
    currentIndex,
    songs,
    setPlayerSongs,   // setSongs doesn't exist — use setPlayerSongs
    setCurrentIndex,
    setIsPlaying,
  } = usePlayer();

  const [radioMode,    setRadioMode]    = useState(false);
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioError,   setRadioError]   = useState(null);

  // Track IDs already in queue to avoid duplicates
  const seenIds   = useRef(new Set());
  // Which song index triggered the last refill (avoid double-fetching)
  const lastRefillAt = useRef(-1);

  /* ── Start radio from current song ── */
  const startRadio = useCallback(async () => {
    if (!currentSong) return;
    setRadioLoading(true);
    setRadioError(null);

    try {
      // Seed seen IDs from existing queue
      seenIds.current = new Set(songs.map(s => s.id));

      const batch = await buildBatch(
        currentSong.artist || '',
        currentSong.name,
        seenIds.current,
      );

      if (!batch.length) {
        setRadioError('No similar tracks found');
        setRadioLoading(false);
        return;
      }

      // Inject after current position
      setPlayerSongs(prev => [
        ...prev.slice(0, currentIndex + 1),
        ...batch,
        ...prev.slice(currentIndex + 1),
      ]);

      setRadioMode(true);
    } catch (e) {
      setRadioError(e.message);
      console.error('[useRadio] startRadio failed:', e);
    } finally {
      setRadioLoading(false);
    }
  }, [currentSong, currentIndex, songs, setPlayerSongs, setCurrentIndex, setIsPlaying]);

  /* ── Stop radio — clear radio songs from queue ── */
  const stopRadio = useCallback(() => {
    setPlayerSongs(prev => prev.filter(s => s.source !== 'radio'));
    setRadioMode(false);
    setRadioError(null);
    seenIds.current.clear();
    lastRefillAt.current = -1;
  }, [setPlayerSongs]);

  /* ── Auto-refill when queue runs low ── */
  useEffect(() => {
    if (!radioMode || radioLoading) return;

    const songsAfterCurrent = songs.length - 1 - currentIndex;
    if (songsAfterCurrent > REFILL_AT) return;
    if (lastRefillAt.current === currentIndex) return; // already fetching for this position

    lastRefillAt.current = currentIndex;

    // Seed next batch from the last song in queue
    const lastSong = songs[songs.length - 1];
    if (!lastSong) return;

    setRadioLoading(true);
    buildBatch(
      lastSong._radioMeta?.originalArtist || lastSong.artist || '',
      lastSong._radioMeta?.originalTitle  || lastSong.name,
      seenIds.current,
    ).then(batch => {
      if (batch.length) {
        setPlayerSongs(prev => [...prev, ...batch]);
      }
    }).catch(e => {
      console.warn('[useRadio] refill failed:', e.message);
    }).finally(() => {
      setRadioLoading(false);
    });
  }, [radioMode, radioLoading, currentIndex, songs, setPlayerSongs]);

  /* ── Clear radio state when song manually changed outside radio ── */
  useEffect(() => {
    if (!radioMode) return;
    if (currentSong?.source !== 'radio' && currentSong?.source !== undefined) {
      // User navigated to a non-radio song — keep radio but don't auto-stop
      // (debatable UX — change to stopRadio() if you prefer hard stop)
    }
  }, [currentSong, radioMode]);

  return {
    radioMode,
    radioLoading,
    radioError,
    startRadio,
    stopRadio,
  };
}