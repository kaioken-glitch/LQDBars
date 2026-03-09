import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'lb:playlists';
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } };
const save = (data) => { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {} };

const listeners = new Set();
let _cache = load();

/* ── Reserved playlist ID for the Library tab ── */
export const LIBRARY_PLAYLIST_ID = '__library__';

function ensureLibraryPlaylist(list) {
  if (!Array.isArray(list)) list = [];
  if (list.some(p => p.id === LIBRARY_PLAYLIST_ID)) return list;
  return [...list, { id: LIBRARY_PLAYLIST_ID, name: 'Library', songs: [], createdAt: 0, _hidden: true }];
}

// Always make sure __library__ exists in the cache on load
_cache = ensureLibraryPlaylist(_cache);

export function notifyAll(next) {
  if (!Array.isArray(next)) next = [];
  const withLib = ensureLibraryPlaylist(next);
  _cache = withLib;
  save(withLib);                                  // persist immediately
  listeners.forEach(fn => { try { fn([...withLib]); } catch (_) {} });
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState(() => [..._cache]);

  useEffect(() => {
    const handler = (next) => setPlaylists([...next]);
    listeners.add(handler);

    // Sync once on mount — picks up any writes that happened before this component mounted
    const fresh = ensureLibraryPlaylist(load());
    if (JSON.stringify(fresh) !== JSON.stringify(_cache)) {
      _cache = fresh;
      // Notify ALL listeners (including this one via handler)
      listeners.forEach(fn => { try { fn([...fresh]); } catch (_) {} });
    } else {
      // Still update local state so this component reflects current _cache
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

  const refreshFromStorage = useCallback(() => {
    const fresh = ensureLibraryPlaylist(load());
    _cache = fresh;
    setPlaylists([...fresh]);
  }, []);

  // Add a song to the hidden Library playlist.
  // Returns false if already present, true if added.
  const addToLibrary = useCallback((song) => {
    if (!song) return false;
    // Always read _cache fresh — avoids stale closure
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
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    updatePlaylist,
    refreshFromStorage,
    addToLibrary,
    librarySongs,
  };
}