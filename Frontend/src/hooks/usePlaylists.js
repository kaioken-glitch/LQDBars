import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'lb:playlists';
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } };
const save = (data) => { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {} };

const listeners = new Set();
let _cache = load();

function notifyAll(next) {
  _cache = next;
  save(next);
  listeners.forEach(fn => fn([...next]));
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState(() => [..._cache]);

  useEffect(() => {
    const handler = (next) => setPlaylists(next);
    listeners.add(handler);
    return () => listeners.delete(handler);
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

  return { playlists, createPlaylist, deletePlaylist, addSongToPlaylist, removeSongFromPlaylist, updatePlaylist };
}