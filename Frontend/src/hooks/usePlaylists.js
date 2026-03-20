import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'lb:playlists';

const load = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
  catch { return []; }
};

const save = (data) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); }
  catch (_) {}
};

const listeners = new Set();

// _cache is the module-level singleton — always kept in sync with localStorage
let _cache = load();

export const LIBRARY_PLAYLIST_ID = '__library__';

function ensureLibraryPlaylist(list) {
  if (!Array.isArray(list)) list = [];
  if (list.some(p => p.id === LIBRARY_PLAYLIST_ID)) return list;
  return [...list, { id: LIBRARY_PLAYLIST_ID, name: 'Library', songs: [], createdAt: 0, _hidden: true }];
}

_cache = ensureLibraryPlaylist(_cache);

export function notifyAll(next) {
  if (!Array.isArray(next)) next = [];
  const withLib = ensureLibraryPlaylist(next);
  _cache = withLib;
  save(withLib);
  listeners.forEach(fn => { try { fn([...withLib]); } catch (_) {} });
}

export function usePlaylists() {
  // Always read from localStorage on init — never trust _cache alone
  // This handles Electron renderer reloads and Vite HMR module re-evaluation
  const [playlists, setPlaylists] = useState(() => {
    const fresh = ensureLibraryPlaylist(load());
    // Sync _cache with what's actually in storage
    _cache = fresh;
    return [...fresh];
  });

  useEffect(() => {
    const handler = (next) => setPlaylists([...next]);
    listeners.add(handler);

    // Re-sync on mount in case storage changed while this component was unmounted
    // (e.g. another tab wrote to it, or module was re-evaluated)
    const fresh = ensureLibraryPlaylist(load());
    const cacheStr = JSON.stringify(_cache);
    const freshStr = JSON.stringify(fresh);

    if (freshStr !== cacheStr) {
      // Storage has newer/different data — update _cache and notify everyone
      _cache = fresh;
      listeners.forEach(fn => { try { fn([...fresh]); } catch (_) {} });
    } else {
      // In sync — just make sure this component's state is current
      setPlaylists([..._cache]);
    }

    // Cross-tab sync
    const onStorage = (e) => {
      if (e.key !== LS_KEY) return;
      const cross = ensureLibraryPlaylist(load());
      _cache = cross;
      listeners.forEach(fn => { try { fn([...cross]); } catch (_) {} });
    };
    window.addEventListener('storage', onStorage);

    return () => {
      listeners.delete(handler);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const createPlaylist = useCallback((name) => {
    const pl = { id: `pl_${Date.now()}`, name, songs: [], createdAt: Date.now() };
    notifyAll([pl, ..._cache]);
    return pl;
  }, []);

  const addPlaylist = useCallback((pl) => {
    // Always read fresh from storage before prepending
    // This prevents stale _cache from overwriting playlists created elsewhere
    const current = ensureLibraryPlaylist(load());
    // Avoid duplicates
    if (current.some(p => p.id === pl.id)) return;
    notifyAll([pl, ...current]);
  }, []);

  const deletePlaylist = useCallback((id) => {
    notifyAll(_cache.filter(p => p.id !== id));
  }, []);

  const addSongToPlaylist = useCallback((playlistId, song) => {
    const next = _cache.map(p => {
      if (p.id !== playlistId) return p;
      if ((p.songs || []).some(s => s.id === song.id)) return p;
      return { ...p, songs: [...(p.songs || []), { ...song }] };
    });
    notifyAll(next);
  }, []);

  const removeSongFromPlaylist = useCallback((playlistId, songId) => {
    const next = _cache.map(p => {
      if (p.id !== playlistId) return p;
      return { ...p, songs: (p.songs || []).filter(s => s.id !== songId) };
    });
    notifyAll(next);
  }, []);

  const updatePlaylist = useCallback((id, updates) => {
    notifyAll(_cache.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  // Reads fresh from localStorage and notifies ALL subscribers
  // Safe to call on every mount
  const refreshFromStorage = useCallback(() => {
    const fresh = ensureLibraryPlaylist(load());
    _cache = fresh;
    // Use notifyAll so every subscriber (Settings, Library etc) gets updated
    listeners.forEach(fn => { try { fn([...fresh]); } catch (_) {} });
    setPlaylists([...fresh]);
  }, []);

  const addToLibrary = useCallback((song) => {
    if (!song) return false;
    const current = _cache;
    const libPl = current.find(p => p.id === LIBRARY_PLAYLIST_ID)
      || { id: LIBRARY_PLAYLIST_ID, name: 'Library', songs: [], createdAt: 0, _hidden: true };
    if ((libPl.songs || []).some(s => s.id === song.id)) return false;
    const updatedLib = { ...libPl, songs: [...(libPl.songs || []), { ...song, savedAt: Date.now() }] };
    const next = current.some(p => p.id === LIBRARY_PLAYLIST_ID)
      ? current.map(p => p.id === LIBRARY_PLAYLIST_ID ? updatedLib : p)
      : [...current, updatedLib];
    notifyAll(next);
    return true;
  }, []);

  const librarySongs = (playlists.find(p => p.id === LIBRARY_PLAYLIST_ID)?.songs) || [];

  return {
    playlists,
    createPlaylist,
    addPlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    updatePlaylist,
    refreshFromStorage,
    addToLibrary,
    librarySongs,
  };
}