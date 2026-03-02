import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'lb:playlists';
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } };
const save = (data) => { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {} };

const listeners = new Set();
let _cache = load();

export function notifyAll(next) {
  const withLib = ensureLibraryPlaylist(next);
  _cache = withLib;
  save(withLib);
  listeners.forEach(fn => fn([...withLib]));
}

/* ── Reserved playlist ID for the Library tab ── */
export const LIBRARY_PLAYLIST_ID = '__library__';

function ensureLibraryPlaylist(list) {
  if (list.some(p => p.id === '__library__')) return list;
  return [...list, { id: '__library__', name: 'Library', songs: [], createdAt: 0, _hidden: true }];
}

// Always make sure __library__ exists in the cache on load
_cache = ensureLibraryPlaylist(_cache);

export function usePlaylists() {
  const [playlists, setPlaylists] = useState(() => [..._cache]);

  useEffect(() => {
    // Sync from in-process notifyAll calls (e.g. AddToPlaylistBtn)
    const handler = (next) => setPlaylists(next);
    listeners.add(handler);

    // ALSO sync from cross-component localStorage writes (Playlists.jsx uses savePL directly).
    // The 'storage' event fires when another JS context writes the same key,
    // but within the same tab we supplement with a polling re-read on mount.
    const syncFromStorage = () => {
      const fresh = ensureLibraryPlaylist(load());
      _cache = fresh;
      setPlaylists([...fresh]);
      listeners.forEach(fn => fn !== handler && fn([...fresh]));
    };

    // Re-read once on mount in case Playlists.jsx wrote before this hook mounted
    syncFromStorage();

    // Listen for writes from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === LS_KEY) syncFromStorage();
    });

    return () => {
      listeners.delete(handler);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const createPlaylist = useCallback((name) => {
    const pl = { id: `pl_${Date.now()}`, name, songs: [], createdAt: Date.now() };
    notifyAll([pl, ..._cache]);
    return pl;
  }, []);

  const deletePlaylist = useCallback((id) => {
    notifyAll(_cache.filter(p => p.id !== id));
  }, []);

  const addSongToPlaylist = useCallback((playlistId, song) => {
    const next = _cache.map(p => {
      if (p.id !== playlistId) return p;
      if (p.songs.some(s => s.id === song.id)) return p;
      return { ...p, songs: [...p.songs, { ...song }] };
    });
    notifyAll(next);
  }, []);

  const removeSongFromPlaylist = useCallback((playlistId, songId) => {
    const next = _cache.map(p => {
      if (p.id !== playlistId) return p;
      return { ...p, songs: p.songs.filter(s => s.id !== songId) };
    });
    notifyAll(next);
  }, []);

  const updatePlaylist = useCallback((id, updates) => {
    notifyAll(_cache.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const refreshFromStorage = useCallback(() => {
    const fresh = ensureLibraryPlaylist(load());
    _cache = fresh;
    setPlaylists([...fresh]);
  }, []);

  // Convenience: add a song to the hidden Library playlist.
  // Returns false if the song is already in the library (duplicate), true if added.
  const addToLibrary = useCallback((song) => {
    if (!song) return false;
    const current = _cache;
    const libPl = current.find(p => p.id === LIBRARY_PLAYLIST_ID)
      || { id: LIBRARY_PLAYLIST_ID, name: 'Library', songs: [], createdAt: 0, _hidden: true };
    if (libPl.songs.some(s => s.id === song.id)) return false; // already exists
    const updatedLib = { ...libPl, songs: [...libPl.songs, { ...song, savedAt: Date.now() }] };
    const next = current.some(p => p.id === LIBRARY_PLAYLIST_ID)
      ? current.map(p => p.id === LIBRARY_PLAYLIST_ID ? updatedLib : p)
      : [...current, updatedLib];
    notifyAll(next);
    return true;
  }, []);

  // Get just the library songs
  const librarySongs = (playlists.find(p => p.id === LIBRARY_PLAYLIST_ID)?.songs) || [];

  return { playlists, createPlaylist, deletePlaylist, addSongToPlaylist, removeSongFromPlaylist, updatePlaylist, refreshFromStorage, addToLibrary, librarySongs };
}