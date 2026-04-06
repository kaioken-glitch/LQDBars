/**
 * useSmartRadio.js
 *
 * History-aware smart radio that builds a personalised mix from the
 * user's listening history, then progressively expands into similar
 * artists and genre-adjacent discovery tracks.
 *
 * ─── Algorithm overview ────────────────────────────────────────────
 *
 *  Phase 1 — History analysis (runs once on start)
 *    • Read localStorage player:history (written by Recent.jsx)
 *    • Score every artist and genre by weighted play count
 *      (recent plays worth more than old ones via time-decay)
 *    • Extract top-N artists and genres as the "taste profile"
 *
 *  Phase 2 — Seed selection
 *    • Pick 3 seed tracks from history: top played, most recent, and
 *      one random from the long tail (prevents echo chamber)
 *    • If no history, fall back to currentSong as the sole seed
 *
 *  Phase 3 — Batch building (runs repeatedly as queue drains)
 *    Each batch is a MIX of three slot types in a fixed ratio:
 *      • 50 % familiar  — Last.fm similar to a history seed
 *      • 30 % expanding — Last.fm similar to the last queued radio track
 *                         (the "chain" that drifts the sound gradually)
 *      • 20 % discovery — Last.fm tag search on a top genre to surface
 *                         completely new artists never heard before
 *
 *  Phase 4 — Dedup + quality filter
 *    • Strip anything already in seenIds
 *    • Strip mixes, playlists, and livestreams (title heuristic)
 *    • Shuffle the batch so slot types interleave naturally
 *
 *  Phase 5 — Progressive refill
 *    • When ≤ REFILL_AT tracks remain after current, trigger next batch
 *    • Chain seed for the next batch rotates:
 *        even batches → seed from history profile
 *        odd  batches → seed from last radio track (keeps drifting)
 *    • Every 3rd batch adds an extra discovery slot (introduces new genres)
 *
 * ─── Exports ────────────────────────────────────────────────────────
 *   useSmartRadio()  →  { radioMode, radioLoading, radioError,
 *                         tasteProfile, batchCount,
 *                         startSmartRadio, stopRadio }
 *
 * ─── Requires ───────────────────────────────────────────────────────
 *   VITE_LASTFM_API_KEY   — last.fm Data API key (free)
 *   VITE_YOUTUBE_API_KEY  — YouTube Data API v3 key
 *
 * ─── localStorage keys read ─────────────────────────────────────────
 *   player:history   — array written by Recent.jsx
 *   lb:track_states  — { [songId]: { fav, liked } } written by HomeOnline
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════ */

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0';
const YT_BASE     = 'https://www.googleapis.com/youtube/v3';

const BATCH_SIZE  = 18;   // total tracks per batch
const REFILL_AT   = 3;    // refill when this many tracks remain after current
const MAX_SEEDS   = 5;    // top history seeds to rotate through
const MAX_HISTORY = 60;   // cap history we analyse (most recent N)

// Slot ratios within each batch
const RATIO_FAMILIAR  = 0.50;   // similar to history seeds
const RATIO_EXPANDING = 0.30;   // similar to last radio track (drift)
const RATIO_DISCOVERY = 0.20;   // genre tag search (new artists)

// Time-decay half-life for play score weighting (7 days in ms)
const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

/* ═══════════════════════════════════════════════════════════════════
   QUALITY FILTER — same heuristics as HomeOnline
═══════════════════════════════════════════════════════════════════ */

const BAD_TITLE_WORDS = [
  'playlist','mix','mixed by','megamix','nonstop','non-stop','continuous',
  'extended set','dj set','mashup','medley','compilation','collection',
  'all songs','full album','album mix','full ep','best of','greatest hits',
  'top 10','top 20','1 hour','2 hour','hours of','karaoke','cover version',
  'slowed reverb','sped up','nightcore','8d audio','bass boosted',
  '#shorts','#short','reaction','reacts','interview','instrumental',
  'backing track','lyrics video','lyric video','fan made','fan video',
];

const BAD_CHANNEL_PATTERNS = [
  ' - topic','auto-generated','shorts','lyrics channel','music lyrics',
  'slowed','reverb nation','nightcore','8d music','karaoke','sing king',
  'bass nation','backing tracks','fan channel','fan made',
];

function isLikelySingleTrack(video) {
  const title   = (video.title   || '').toLowerCase();
  const channel = (video.channel || '').toLowerCase();
  if (BAD_TITLE_WORDS.some(kw => title.includes(kw)))         return false;
  if (BAD_CHANNEL_PATTERNS.some(p => channel.includes(p)))    return false;
  if (video.durationSecs) {
    if (video.durationSecs < 60)  return false;  // too short
    if (video.durationSecs > 660) return false;  // longer than 11 min → likely mix
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════
   HISTORY ANALYSIS
═══════════════════════════════════════════════════════════════════ */

/**
 * Reads player:history from localStorage and returns a taste profile:
 *   {
 *     seeds:   [{ artist, title, score }]   top tracks to use as seeds
 *     artists: [{ name, score }]            weighted artist ranking
 *     genres:  [{ name, score }]            inferred genre ranking
 *   }
 *
 * Score = sum of (playCount × timeDecayFactor) across all plays.
 * timeDecayFactor = 0.5 ^ (ageInMs / DECAY_HALF_LIFE_MS)
 * so a play from 7 days ago is worth half a play from today.
 */
function analyseHistory() {
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem('player:history') || '[]');
  } catch {
    return { seeds: [], artists: [], genres: [] };
  }

  // Also pull liked/fav flags to boost loved tracks
  let flags = {};
  try {
    flags = JSON.parse(localStorage.getItem('lb:track_states') || '{}');
  } catch {}

  // Cap to most recent MAX_HISTORY entries
  const recent = history.slice(0, MAX_HISTORY);

  const now = Date.now();
  const artistMap = {};
  const seedMap   = {};

  for (const entry of recent) {
    if (!entry.artist || !entry.name) continue;

    const ageMs   = now - new Date(entry.playedAt || 0).getTime();
    const decay   = Math.pow(0.5, ageMs / DECAY_HALF_LIFE_MS);
    const plays   = entry.playCount || 1;

    // Extra weight if user liked or faved the track
    const songId  = entry.id || `yt_${entry.youtubeId}`;
    const loveBump = (flags[songId]?.liked || flags[songId]?.fav) ? 1.5 : 1;

    const score = plays * decay * loveBump;

    // Artist scores
    const aKey = entry.artist.toLowerCase();
    if (!artistMap[aKey]) artistMap[aKey] = { name: entry.artist, score: 0 };
    artistMap[aKey].score += score;

    // Seed scores (per track)
    const sKey = `${aKey}||${entry.name.toLowerCase()}`;
    if (!seedMap[sKey]) seedMap[sKey] = { artist: entry.artist, title: entry.name, score: 0 };
    seedMap[sKey].score += score;
  }

  const artists = Object.values(artistMap)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const seeds = Object.values(seedMap)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SEEDS);

  // Infer genres from Last.fm top tags — we can't do this without an API call
  // so we store genre hints from the history entries themselves if present,
  // otherwise fall back to empty (discovery batches will use artist tags instead)
  const genreMap = {};
  for (const entry of recent) {
    const g = entry.genre;
    if (!g) continue;
    if (!genreMap[g]) genreMap[g] = { name: g, score: 0 };
    genreMap[g].score += 1;
  }
  const genres = Object.values(genreMap)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return { seeds, artists, genres };
}

/* ═══════════════════════════════════════════════════════════════════
   LAST.FM API CALLS
═══════════════════════════════════════════════════════════════════ */

/** Fetch similar tracks for a given artist + title */
async function lastfmSimilar(artist, title, limit = 20) {
  const key = import.meta.env.VITE_LASTFM_API_KEY;
  if (!key) return [];

  const url = new URL(`${LASTFM_BASE}/`);
  url.searchParams.set('method',      'track.getSimilar');
  url.searchParams.set('track',       title);
  url.searchParams.set('artist',      artist);
  url.searchParams.set('api_key',     key);
  url.searchParams.set('format',      'json');
  url.searchParams.set('limit',       String(limit));
  url.searchParams.set('autocorrect', '1');

  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) return [];

  return (data.similartracks?.track || []).map(t => ({
    title:  t.name,
    artist: typeof t.artist === 'string' ? t.artist : t.artist?.name || '',
    match:  parseFloat(t.match || '0'),
  }));
}

/**
 * Fetch top tracks for a Last.fm tag (genre discovery).
 * Used for the discovery slot in each batch.
 */
async function lastfmTagTopTracks(tag, limit = 20) {
  const key = import.meta.env.VITE_LASTFM_API_KEY;
  if (!key) return [];

  const url = new URL(`${LASTFM_BASE}/`);
  url.searchParams.set('method',  'tag.getTopTracks');
  url.searchParams.set('tag',     tag);
  url.searchParams.set('api_key', key);
  url.searchParams.set('format',  'json');
  url.searchParams.set('limit',   String(limit));

  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) return [];

  return (data.tracks?.track || []).map(t => ({
    title:  t.name,
    artist: typeof t.artist === 'string' ? t.artist : t.artist?.name || '',
    match:  0.5,  // neutral match score for discovery
  }));
}

/**
 * Fetch top tags for an artist so we can use them as genre seeds
 * when the history has no genre metadata.
 */
async function lastfmArtistTags(artist) {
  const key = import.meta.env.VITE_LASTFM_API_KEY;
  if (!key) return [];

  const url = new URL(`${LASTFM_BASE}/`);
  url.searchParams.set('method',      'artist.getTopTags');
  url.searchParams.set('artist',      artist);
  url.searchParams.set('api_key',     key);
  url.searchParams.set('format',      'json');
  url.searchParams.set('autocorrect', '1');

  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) return [];

  return (data.toptags?.tag || [])
    .slice(0, 5)
    .map(t => t.name.toLowerCase())
    .filter(t => !['seen live','under 2000 listeners','spotify','youtube','music'].includes(t));
}

/* ═══════════════════════════════════════════════════════════════════
   YOUTUBE SEARCH
═══════════════════════════════════════════════════════════════════ */

/** Search YouTube for a single track and return a song object */
async function ytSearch(artist, title) {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!key) return null;

  const q   = `${artist} ${title} official audio`;
  const url = new URL(`${YT_BASE}/search`);
  url.searchParams.set('part',       'snippet');
  url.searchParams.set('q',          q);
  url.searchParams.set('type',       'video');
  url.searchParams.set('maxResults', '3');
  url.searchParams.set('key',        key);

  const res  = await fetch(url.toString());
  const data = await res.json();
  if (!data.items?.length) return null;

  // Pick the first result that passes the quality filter
  for (const item of data.items) {
    const videoId = item.id?.videoId;
    if (!videoId) continue;
    const candidate = {
      title:       item.snippet?.title        || title,
      channel:     item.snippet?.channelTitle || artist,
      durationSecs: 0,  // unknown without an extra API call — filter by title only
    };
    if (!isLikelySingleTrack(candidate)) continue;
    return makeSong(videoId, item.snippet?.title || title, item.snippet?.channelTitle || artist);
  }
  return null;
}

function makeSong(videoId, title, channel) {
  return {
    id:         `yt_${videoId}`,
    name:       title,
    artist:     channel,
    cover:      `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    audio:      `https://www.youtube.com/watch?v=${videoId}`,
    url:        `https://www.youtube.com/watch?v=${videoId}`,
    src:        `https://www.youtube.com/watch?v=${videoId}`,
    youtubeId:  videoId,
    source:     'radio',
    _radioMeta: { title, channel },
  };
}

/* ═══════════════════════════════════════════════════════════════════
   BATCH BUILDER
   Assembles one batch from three slot types:
     familiar  → similar to a rotating history seed
     expanding → similar to the last radio track (drift chain)
     discovery → tag top-tracks for a genre the user likes
═══════════════════════════════════════════════════════════════════ */

/**
 * @param {object} opts
 * @param {object} opts.historySeed   { artist, title }  — for familiar slot
 * @param {object|null} opts.chainSeed    { artist, title }  — for expanding slot
 * @param {string|null} opts.discoveryTag last.fm tag string — for discovery slot
 * @param {Set}   opts.seenIds        already-queued video IDs
 * @param {number} opts.batchIndex    which batch number this is (0-based)
 * @returns {Promise<Array>} resolved song objects, shuffled
 */
async function buildSmartBatch({ historySeed, chainSeed, discoveryTag, seenIds, batchIndex }) {
  const familiarCount  = Math.round(BATCH_SIZE * RATIO_FAMILIAR);
  // Every 3rd batch gets an extra discovery slot to widen the sound
  const discoveryBonus = batchIndex > 0 && batchIndex % 3 === 0 ? 2 : 0;
  const discoveryCount = Math.round(BATCH_SIZE * RATIO_DISCOVERY) + discoveryBonus;
  const expandingCount = BATCH_SIZE - familiarCount - discoveryCount;

  const slots = {
    familiar:  [],
    expanding: [],
    discovery: [],
  };

  // ── Familiar slot ─────────────────────────────────────────────────
  if (historySeed) {
    try {
      const similar = await lastfmSimilar(historySeed.artist, historySeed.title, familiarCount + 6);
      for (const track of similar) {
        if (slots.familiar.length >= familiarCount) break;
        const song = await ytSearch(track.artist, track.title);
        if (song && !seenIds.has(song.youtubeId)) {
          seenIds.add(song.youtubeId);
          song._slotType = 'familiar';
          song._matchScore = track.match;
          slots.familiar.push(song);
        }
      }
    } catch (e) {
      console.warn('[SmartRadio] familiar slot failed:', e.message);
    }
  }

  // ── Expanding slot (drift chain) ──────────────────────────────────
  const expandSeed = chainSeed || historySeed;
  if (expandSeed) {
    try {
      const similar = await lastfmSimilar(expandSeed.artist, expandSeed.title, expandingCount + 6);
      // Skip the top results (they overlap with familiar) — take from the mid-range
      const offset  = Math.min(4, Math.floor(similar.length * 0.25));
      for (const track of similar.slice(offset)) {
        if (slots.expanding.length >= expandingCount) break;
        const song = await ytSearch(track.artist, track.title);
        if (song && !seenIds.has(song.youtubeId)) {
          seenIds.add(song.youtubeId);
          song._slotType = 'expanding';
          song._matchScore = track.match * 0.8;
          slots.expanding.push(song);
        }
      }
    } catch (e) {
      console.warn('[SmartRadio] expanding slot failed:', e.message);
    }
  }

  // ── Discovery slot (genre tag search) ────────────────────────────
  if (discoveryTag) {
    try {
      const tagTracks = await lastfmTagTopTracks(discoveryTag, discoveryCount + 10);
      // Shuffle so we don't always get the same top tracks
      const shuffled = tagTracks.sort(() => Math.random() - 0.5);
      for (const track of shuffled) {
        if (slots.discovery.length >= discoveryCount) break;
        const song = await ytSearch(track.artist, track.title);
        if (song && !seenIds.has(song.youtubeId)) {
          seenIds.add(song.youtubeId);
          song._slotType = 'discovery';
          song._matchScore = 0.3 + Math.random() * 0.3;
          slots.discovery.push(song);
        }
      }
    } catch (e) {
      console.warn('[SmartRadio] discovery slot failed:', e.message);
    }
  }

  // ── Interleave slots so types alternate naturally ─────────────────
  // Pattern: familiar, expanding, familiar, discovery, familiar, expanding, …
  const all  = [];
  const f    = [...slots.familiar];
  const e    = [...slots.expanding];
  const d    = [...slots.discovery];
  const maxLen = Math.max(f.length, e.length, d.length);

  for (let i = 0; i < maxLen; i++) {
    if (f[i]) all.push(f[i]);
    if (e[i]) all.push(e[i]);
    if (d[i]) all.push(d[i]);
  }

  return all;
}

/* ═══════════════════════════════════════════════════════════════════
   HOOK
═══════════════════════════════════════════════════════════════════ */

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
  const [tasteProfile, setTasteProfile] = useState(null);
  const [batchCount,   setBatchCount]   = useState(0);

  // Refs persist across renders without triggering re-renders
  const seenIds       = useRef(new Set());
  const seedRotation  = useRef(0);    // which history seed to use next for familiar slot
  const chainSeedRef  = useRef(null); // last radio track (for expanding slot)
  const batchCountRef = useRef(0);    // mirrors batchCount state without stale closure issues
  const lastRefillAt  = useRef(-1);   // which currentIndex triggered the last refill
  const genreTagsRef  = useRef([]);   // resolved genre tags for discovery slot

  /* ── Derive a discovery tag, rotating through known genres ── */
  function nextDiscoveryTag(genres, profile) {
    // Use stored genre tags from history if available
    if (genres.length) {
      const idx = batchCountRef.current % genres.length;
      return genres[idx].name;
    }
    // Fall back to artist-derived tags (resolved async in startSmartRadio)
    if (genreTagsRef.current.length) {
      const idx = batchCountRef.current % genreTagsRef.current.length;
      return genreTagsRef.current[idx];
    }
    return null;
  }

  /* ── START ── */
  const startSmartRadio = useCallback(async () => {
    setRadioLoading(true);
    setRadioError(null);
    seenIds.current.clear();
    seedRotation.current  = 0;
    batchCountRef.current = 0;
    lastRefillAt.current  = -1;
    chainSeedRef.current  = null;

    try {
      // 1. Analyse history
      const profile = analyseHistory();
      setTasteProfile(profile);

      // 2. Determine seeds
      //    If we have history seeds use them; otherwise fall back to currentSong
      const seeds = profile.seeds.length
        ? profile.seeds
        : currentSong
          ? [{ artist: currentSong.artist || '', title: currentSong.name }]
          : [];

      if (!seeds.length) {
        setRadioError('Play a song first so the radio has a starting point.');
        setRadioLoading(false);
        return;
      }

      // 3. Resolve genre tags from the top artist if history has no genre data
      if (!profile.genres.length && profile.artists.length) {
        try {
          const tags = await lastfmArtistTags(profile.artists[0].name);
          genreTagsRef.current = tags;
        } catch { /* non-critical */ }
      }

      // 4. Seed seen IDs from current queue to avoid duplicates
      songs.forEach(s => { if (s.youtubeId) seenIds.current.add(s.youtubeId); });

      // 5. Build the first batch
      const historySeed  = seeds[0];
      const discoveryTag = nextDiscoveryTag(profile.genres, profile);

      const batch = await buildSmartBatch({
        historySeed,
        chainSeed:    null,           // no chain yet on batch 0
        discoveryTag,
        seenIds:      seenIds.current,
        batchIndex:   0,
      });

      if (!batch.length) {
        setRadioError('Could not find tracks matching your taste. Try playing a song first.');
        setRadioLoading(false);
        return;
      }

      // 6. Inject batch after current song
      const insertAt = currentIndex + 1;
      setPlayerSongs(prev => {
        const updated = Array.isArray(prev) ? [...prev] : [];
        updated.splice(insertAt, 0, ...batch);
        return updated;
      });

      // Update chain seed to the last track in the batch
      const lastTrack = batch[batch.length - 1];
      if (lastTrack) {
        chainSeedRef.current = {
          artist: lastTrack._radioMeta?.channel || lastTrack.artist,
          title:  lastTrack._radioMeta?.title   || lastTrack.name,
        };
      }

      batchCountRef.current = 1;
      setBatchCount(1);
      setRadioMode(true);
    } catch (e) {
      console.error('[SmartRadio] startSmartRadio failed:', e);
      setRadioError(e.message || 'Radio failed to start.');
    } finally {
      setRadioLoading(false);
    }
  }, [currentSong, currentIndex, songs, setPlayerSongs]);

  /* ── STOP ── */
  const stopRadio = useCallback(() => {
    // Remove all radio-sourced songs from the queue
    setPlayerSongs(prev =>
      Array.isArray(prev) ? prev.filter(s => s.source !== 'radio') : []
    );
    setRadioMode(false);
    setRadioError(null);
    setBatchCount(0);
    seenIds.current.clear();
    seedRotation.current  = 0;
    batchCountRef.current = 0;
    lastRefillAt.current  = -1;
    chainSeedRef.current  = null;
    genreTagsRef.current  = [];
  }, [setPlayerSongs]);

  /* ── AUTO-REFILL when queue runs low ── */
  useEffect(() => {
    if (!radioMode || radioLoading) return;

    const songsAfterCurrent = songs.length - 1 - currentIndex;
    if (songsAfterCurrent > REFILL_AT) return;
    if (lastRefillAt.current === currentIndex) return; // already triggered for this position

    lastRefillAt.current = currentIndex;

    const profile      = tasteProfile || analyseHistory();
    const seeds        = profile.seeds.length
      ? profile.seeds
      : currentSong ? [{ artist: currentSong.artist, title: currentSong.name }] : [];

    if (!seeds.length) return;

    // Rotate history seed so successive familiar slots use different tracks
    const seedIdx = seedRotation.current % seeds.length;
    seedRotation.current += 1;
    const historySeed = seeds[seedIdx];

    // Alternate chain seeding: even batches use history seed, odd use chain
    const useChain     = batchCountRef.current % 2 === 1 && chainSeedRef.current;
    const chainSeed    = useChain ? chainSeedRef.current : null;
    const discoveryTag = nextDiscoveryTag(profile.genres, profile);

    setRadioLoading(true);

    buildSmartBatch({
      historySeed,
      chainSeed,
      discoveryTag,
      seenIds:    seenIds.current,
      batchIndex: batchCountRef.current,
    })
      .then(batch => {
        if (!batch.length) return;

        setPlayerSongs(prev =>
          Array.isArray(prev) ? [...prev, ...batch] : batch
        );

        // Advance the chain seed
        const lastTrack = batch[batch.length - 1];
        if (lastTrack) {
          chainSeedRef.current = {
            artist: lastTrack._radioMeta?.channel || lastTrack.artist,
            title:  lastTrack._radioMeta?.title   || lastTrack.name,
          };
        }

        batchCountRef.current += 1;
        setBatchCount(n => n + 1);
      })
      .catch(e => {
        console.warn('[SmartRadio] refill failed:', e.message);
      })
      .finally(() => {
        setRadioLoading(false);
      });
  }, [radioMode, radioLoading, currentIndex, songs.length, tasteProfile, currentSong, setPlayerSongs]);

  /* ── Auto-stop if user manually leaves radio context ── */
  useEffect(() => {
    if (!radioMode) return;
    // If user plays a non-radio song, keep the radio in standby
    // (don't hard-stop — just let the queue drain naturally)
  }, [currentSong, radioMode]);

  return {
    radioMode,
    radioLoading,
    radioError,
    tasteProfile,   // expose so UI can show "Based on your taste for X"
    batchCount,     // how many batches have been fetched (for debug / UI)
    startSmartRadio,
    stopRadio,
  };
}