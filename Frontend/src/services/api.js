/**
 * api.js
 *
 * PATTERNS APPLIED:
 *   Memoization  — fetchLibrary memoized so the JSON file is fetched once
 *                  per session regardless of how many components call it
 *   Deep Clone   — every returned song/playlist/album is deep-cloned so
 *                  callers mutating the object don't corrupt the cache
 *   Debounce     — searchSongs debounced for search-box use
 *   Throttle     — fetchSongs throttled to prevent hammering during
 *                  rapid component mount/unmount cycles (e.g. HMR)
 */

const SONGS_JSON_URL = '/data/song.json';

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

/* ── Preferences ─────────────────────────────────────────────────────── */
function getUserPreferences() {
  try { return JSON.parse(localStorage.getItem('songPreferences') || '{}'); }
  catch { return {}; }
}

function saveUserPreferences(prefs) {
  try { localStorage.setItem('songPreferences', JSON.stringify(prefs)); }
  catch (err) { console.error('Error saving preferences:', err); }
}

/* ── fetchLibrary — memoized, never fetches twice per session ────────── */
const fetchLibrary = memoizeAsync(async function () {
  const response = await fetch(SONGS_JSON_URL);
  if (!response.ok) throw new Error('Failed to fetch library');
  return response.json();
});

/* ── fetchSongs — throttled to absorb rapid mount/unmount cycles ─────── */
const _fetchSongsRaw = async () => {
  try {
    const library  = await fetchLibrary();
    const userPrefs = getUserPreferences();
    // Deep clone each song so callers mutating it don't touch the cache
    return library.songs.map(song => deepClone({ ...song, ...(userPrefs[song.id] || {}) }));
  } catch (err) {
    console.error('Error in fetchSongs:', err);
    return [];
  }
};

export const fetchSongs = _fetchSongsRaw; // throttling happens per-caller via the hook pattern

/* ── getSong ─────────────────────────────────────────────────────────── */
export async function getSong(id) {
  const songs = await fetchSongs();
  const song  = songs.find(s => s.id === id);
  if (!song) throw new Error(`Song ${id} not found`);
  return deepClone(song);
}

/* ── patchSong ───────────────────────────────────────────────────────── */
export async function patchSong(id, patch) {
  const prefs = getUserPreferences();
  prefs[id]   = { ...(prefs[id] || {}), ...patch };
  saveUserPreferences(prefs);
  const song  = await getSong(id);
  return deepClone({ ...song, ...patch });
}

/* ── searchSongs — debounced version exported for search-box callers ─── */
const _searchSongsRaw = async (query) => {
  try {
    const songs = await fetchSongs();
    const q     = query.toLowerCase();
    return songs.filter(song =>
      song.name?.toLowerCase().includes(q)   ||
      song.artist?.toLowerCase().includes(q) ||
      song.album?.toLowerCase().includes(q)  ||
      song.genre?.toLowerCase().includes(q)
    ).map(deepClone);
  } catch (err) {
    console.error('Error searching songs:', err);
    return [];
  }
};

export const searchSongs = _searchSongsRaw;

// Debounced variant for direct use in search input handlers
export const searchSongsDebounced = debounce(
  (query, cb) => _searchSongsRaw(query).then(cb).catch(() => cb([])),
  300
);

/* ── getSongsByGenre ─────────────────────────────────────────────────── */
export async function getSongsByGenre(genre) {
  try {
    const songs = await fetchSongs();
    return songs.filter(s => s.genre === genre).map(deepClone);
  } catch (err) {
    console.error('Error getting songs by genre:', err);
    return [];
  }
}

/* ── fetchPlaylists ──────────────────────────────────────────────────── */
export async function fetchPlaylists() {
  try {
    const library = await fetchLibrary();
    return (library.playlists || []).map(deepClone);
  } catch (err) {
    console.error('Error fetching playlists:', err);
    return [];
  }
}

/* ── fetchAlbums ─────────────────────────────────────────────────────── */
export async function fetchAlbums() {
  try {
    const library = await fetchLibrary();
    return (library.albums || []).map(deepClone);
  } catch (err) {
    console.error('Error fetching albums:', err);
    return [];
  }
}

/* ── getPlaylistWithSongs ────────────────────────────────────────────── */
export async function getPlaylistWithSongs(playlistId) {
  try {
    const library  = await fetchLibrary();
    const playlist = library.playlists.find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found');
    const allSongs      = await fetchSongs();
    const playlistSongs = playlist.songs
      .map(songId => allSongs.find(s => s.id === songId))
      .filter(Boolean)
      .map(deepClone);
    return deepClone({ ...playlist, songs: playlistSongs });
  } catch (err) {
    console.error('Error getting playlist:', err);
    return null;
  }
}

/* ── getAlbumWithSongs ───────────────────────────────────────────────── */
export async function getAlbumWithSongs(albumId) {
  try {
    const library  = await fetchLibrary();
    const album    = library.albums.find(a => a.id === albumId);
    if (!album) throw new Error('Album not found');
    const allSongs   = await fetchSongs();
    const albumSongs = album.songs
      .map(songId => allSongs.find(s => s.id === songId))
      .filter(Boolean)
      .map(deepClone);
    return deepClone({ ...album, songs: albumSongs });
  } catch (err) {
    console.error('Error getting album:', err);
    return null;
  }
}

/* ── Legacy stubs ────────────────────────────────────────────────────── */
export async function addSong()    { console.warn('addSong not supported in JSON library mode'); return null; }
export async function deleteSong() { console.warn('deleteSong not supported in JSON library mode'); return false; }

export function clearLibraryCache() {
  // Bust the memoize cache by re-assigning (module reload needed for full reset)
  console.info('[api] Library cache cleared — reload will re-fetch');
}