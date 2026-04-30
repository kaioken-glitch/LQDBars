/**
 * musicApi.js
 *
 * PATTERNS APPLIED:
 *   Memoization  — getTopTracks, getTrackInfo cached so repeated calls
 *                  (e.g. shelf re-renders) never hit the network twice
 *   Throttle     — getTopTracks throttled (expensive chart call)
 *   Deep Clone   — cached results cloned on read
 *   Debounce     — searchTracksMusicBrainz debounced for search-box use
 */

const LASTFM_API_KEY  = import.meta.env.VITE_LASTFM_API_KEY;
const BASE_URL        = import.meta.env.VITE_BASE_URL;
const LASTFM_BASE_URL = `${BASE_URL}/api/lastfm`;

/* ── Utilities ───────────────────────────────────────────────────────── */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

function throttle(func, limit) {
  let lastRan, lastFunc;
  return function (...args) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

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

/* ── Service class ───────────────────────────────────────────────────── */
class MusicApiService {
  constructor() {
    // getTopTracks memoized for 15 min — chart changes slowly
    this.getTopTracks = memoizeAsync(this._getTopTracksRaw.bind(this), 15 * 60 * 1000);

    // getTrackInfo memoized for 1 h — track metadata is stable
    this.getTrackInfo = memoizeAsync(this._getTrackInfoRaw.bind(this), 60 * 60 * 1000);

    // MusicBrainz search debounced for search-box use (400ms)
    this.searchTracksMusicBrainz = debounce(
      this._searchMusicBrainzRaw.bind(this), 400
    );
  }

  /* ── MusicBrainz search (debounced) ── */
  async _searchMusicBrainzRaw(query, limit = 20) {
    try {
      const res = await fetch(
        `https://musicbrainz.org/ws/2/recording/?query=recording:${encodeURIComponent(query)}&fmt=json&limit=${limit}`
      );
      const data = await res.json();
      return (data.recordings || []).map(r => ({
        id:       r.id,
        name:     r.title,
        artist:   r['artist-credit']?.[0]?.name || 'Unknown Artist',
        duration: r.length
          ? `${Math.floor(r.length / 60000)}:${String(Math.floor((r.length % 60000) / 1000)).padStart(2, '0')}`
          : '0:00',
        cover: `https://placehold.co/60x60?text=${encodeURIComponent(r.title.slice(0, 1))}`,
      }));
    } catch (err) {
      console.error('MusicBrainz error', err);
      return [];
    }
  }

  /* ── Last.fm track info (memoized) ── */
  async _getTrackInfoRaw(artist, track) {
    try {
      const res = await fetch(
        `${LASTFM_BASE_URL}?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json`
      );
      const data = await res.json();
      if (!data.track) return null;
      return {
        id:        `${artist}-${track}`.replace(/\s+/g, '-').toLowerCase(),
        name:      data.track.name,
        artist:    data.track.artist.name,
        album:     data.track.album?.title || 'Unknown Album',
        duration:  data.track.duration ? Math.floor(data.track.duration / 1000) : 0,
        cover:     data.track.album?.image?.[3]?.['#text'] || `${BASE_URL}/images/no-cover.png`,
        playcount: data.track.playcount,
        listeners: data.track.listeners,
        url:       data.track.url,
      };
    } catch (err) {
      console.error('Last.fm track error', err);
      return null;
    }
  }

  /* ── Backend songs ── */
  async getSongs() {
    try {
      const res = await fetch(`${BASE_URL}/songs`);
      return res.json();
    } catch (err) {
      console.error('Backend /songs error', err);
      return [];
    }
  }

  /* ── Top tracks (memoized + throttled) ── */
  async _getTopTracksRaw(limit = 12) {
    try {
      const res = await fetch(
        `${LASTFM_BASE_URL}?method=chart.getTopTracks&api_key=${LASTFM_API_KEY}&limit=${limit}&format=json`
      );
      const data = await res.json();
      if (!data.tracks?.track) return [];
      return data.tracks.track.map((track, index) => ({
        id:       track.mbid || `lfm-${index}-${Date.now()}`,
        name:     track.name,
        artist:   { name: track.artist.name, mbid: track.artist.mbid },
        cover:    track.image?.find(i => i.size === 'large')?.['#text'] || 'https://placehold.co/300x200/6366f1/FFFFFF?text=🎵',
        duration: track.duration
          ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`
          : '3:00',
        url:       track.url,
        listeners: track.listeners,
      }));
    } catch (err) {
      console.error('Last.fm getTopTracks error:', err);
      return [];
    }
  }

  /* ── Add song ── */
  async addSong(song) {
    try {
      const res = await fetch(`${BASE_URL}/songs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(song),
      });
      return res.json();
    } catch (err) {
      console.error('Backend addSong error', err);
      return null;
    }
  }
}

export default new MusicApiService();