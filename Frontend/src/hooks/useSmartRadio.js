/**
 * useRadio.js  — YouTube Mix-style infinite radio
 *
 * Fixes vs original:
 *  - Uses setPlayerSongs (not setSongs which doesn't exist in PlayerContext)
 *  - Drops videoCategoryId from YT search (causes 403 on standard API keys)
 *  - Parallel YT searches instead of sequential (8x faster)
 *  - Last.fm fallback: if no key / no results, falls back to YT-only queries
 *  - Proper error messages surfaced to the UI
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0';
const YT_BASE     = 'https://www.googleapis.com/youtube/v3';
const BATCH_SIZE  = 8;   // songs per batch
const REFILL_AT   = 3;   // refill when this many radio songs remain

/* ─── Last.fm similar tracks ─────────────────────────────────────── */
async function fetchSimilar(artist, title, limit = BATCH_SIZE + 4) {
  const key = import.meta.env.VITE_LASTFM_API_KEY;
  if (!key) return [];
  try {
    const url = new URL(`${LASTFM_BASE}/`);
    url.searchParams.set('method',      'track.getSimilar');
    url.searchParams.set('track',       title);
    url.searchParams.set('artist',      artist);
    url.searchParams.set('api_key',     key);
    url.searchParams.set('format',      'json');
    url.searchParams.set('limit',       String(limit));
    url.searchParams.set('autocorrect', '1');
    const res  = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    if (data.error) return [];
    return (data.similartracks?.track || []).map(t => ({
      title:  t.name,
      artist: typeof t.artist === 'string' ? t.artist : (t.artist?.name || ''),
    }));
  } catch {
    return [];
  }
}

/* ─── Single YouTube search ──────────────────────────────────────── */
async function searchYT(query, key) {
  try {
    const url = new URL(`${YT_BASE}/search`);
    url.searchParams.set('part',       'snippet');
    url.searchParams.set('type',       'video');
    url.searchParams.set('q',          query);
    url.searchParams.set('maxResults', '1');
    url.searchParams.set('key',        key);
    // NOTE: no videoCategoryId — causes 403 on standard Data API v3 keys

    const res  = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.items?.[0];
    if (!item?.id?.videoId) return null;
    const vid = item.id.videoId;
    const ytUrl = `https://www.youtube.com/watch?v=${vid}`;
    return {
      id:        `yt_${vid}`,
      name:      item.snippet.title        || query,
      artist:    item.snippet.channelTitle || 'YouTube',
      youtubeId: vid,
      cover:     `https://img.youtube.com/vi/${vid}/mqdefault.jpg`,
      audio: ytUrl, url: ytUrl, src: ytUrl,
      album:   '',
      source:  'radio',
      youtube: true,
    };
  } catch {
    return null;
  }
}

/* ─── Build a batch of radio songs ───────────────────────────────── */
async function buildBatch(seedArtist, seedTitle, excludeIds = new Set()) {
  const ytKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!ytKey) return [];

  // Try Last.fm first
  const similar = await fetchSimilar(seedArtist, seedTitle);

  // Build query list — either from Last.fm or YT-only fallback
  const queries = similar.length > 0
    ? similar.slice(0, BATCH_SIZE + 4).map(t => `${t.artist} ${t.title} official audio`)
    : [
        `${seedArtist} best songs`,
        `${seedArtist} top tracks playlist`,
        `songs similar to ${seedTitle}`,
        `${seedArtist} mix`,
        `${seedTitle} ${seedArtist} audio`,
        `${seedArtist} greatest hits`,
      ];

  // Parallel searches
  const settled = await Promise.allSettled(queries.map(q => searchYT(q, ytKey)));

  const results = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    const song = r.value;
    if (excludeIds.has(song.id)) continue;
    excludeIds.add(song.id);
    results.push(song);
    if (results.length >= BATCH_SIZE) break;
  }

  return results;
}

/* ─── Hook ───────────────────────────────────────────────────────── */
export function useSmartRadio() {
  const {
    currentSong,
    currentIndex,
    songs,
    setPlayerSongs,
    setCurrentIndex,
    setIsPlaying,
  } = usePlayer();

  const [radioMode,    setRadioMode]    = useState(false);
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioError,   setRadioError]   = useState(null);

  const seenIds      = useRef(new Set());
  const lastRefill   = useRef(-1);
  const alive        = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /* ── Start radio ── */
  const startRadio = useCallback(async () => {
    if (!currentSong) {
      setRadioError('Play a song first to seed the radio mix.');
      return;
    }
    setRadioLoading(true);
    setRadioError(null);
    seenIds.current = new Set(songs.map(s => s.id));

    try {
      const batch = await buildBatch(
        currentSong.artist || '',
        currentSong.name   || '',
        seenIds.current,
      );

      if (!alive.current) return;

      if (!batch.length) {
        setRadioError('No similar tracks found. Try a different song.');
        setRadioLoading(false);
        return;
      }

      // Inject batch right after current song
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
      setRadioError('Failed to build mix. Check your API keys.');
    } finally {
      if (alive.current) setRadioLoading(false);
    }
  }, [currentSong, currentIndex, songs, setPlayerSongs]);

  /* ── Stop radio ── */
  const stopRadio = useCallback(() => {
    setPlayerSongs(prev =>
      (Array.isArray(prev) ? prev : []).filter(s => s.source !== 'radio')
    );
    setRadioMode(false);
    setRadioError(null);
    seenIds.current.clear();
    lastRefill.current = -1;
  }, [setPlayerSongs]);

  /* ── Auto-refill ── */
  useEffect(() => {
    if (!radioMode || radioLoading) return;

    const remaining = songs
      .slice(currentIndex + 1)
      .filter(s => s.source === 'radio').length;

    if (remaining > REFILL_AT) return;
    if (lastRefill.current === currentIndex) return;
    lastRefill.current = currentIndex;

    const seed = [...songs].reverse().find(s => s.source === 'radio') || currentSong;
    if (!seed) return;

    setRadioLoading(true);
    buildBatch(
      seed.artist || '',
      seed.name   || '',
      seenIds.current,
    ).then(batch => {
      if (!alive.current) return;
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
  }, [radioMode, radioLoading, currentIndex, songs, currentSong, setPlayerSongs]);

  return { radioMode, radioLoading, radioError, startRadio, stopRadio };
}