// src/hooks/usePlaylists.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

/* ═══════════════════════════════════════════════════════════════════
   SUPABASE SYNC LAYER

   Every mutation below updates local state + localStorage FIRST (so
   the UI is instant and works fully offline / logged-out), then fires
   one of these helpers in the background to mirror the change to
   Supabase when a user is signed in. Sync failures are logged but
   never roll back the local change — localStorage stays the source
   of truth the UI reads from; Supabase is just where it gets backed
   up to and restored from on the next login.

   NOTE: local file imports (source: 'local', blob: URLs) can't be
   persisted this way — there's no actual audio data to upload, only
   a session-scoped blob URL — so they're intentionally skipped. They
   still work fine for the current tab/session, same as before.
═══════════════════════════════════════════════════════════════════ */

async function getCurrentUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// Patches a single playlist (by local id) in the cache — used to stamp
// a freshly-created Supabase row id onto the local playlist record so
// future song syncs know which server row to write to.
function patchLocalPlaylist(localId, patch) {
  const next = _cache.map(p => p.id === localId ? { ...p, ...patch } : p);
  notifyAll(next);
}

function extractYoutubeId(song) {
  if (!song) return null;
  if (song.youtubeId) return song.youtubeId;
  if (typeof song.id === 'string' && song.id.startsWith('yt_')) return song.id.replace('yt_', '');
  return null;
}

function songToRow(song, supabasePlaylistId, userId, position = 0) {
  const youtubeId = extractYoutubeId(song);
  if (!youtubeId) return null; // local file import etc. — nothing we can restore later
  return {
    playlist_id: supabasePlaylistId,
    user_id:     userId,
    youtube_id:  youtubeId,
    name:        song.name,
    artist:      song.artist,
    album:       song.album,
    cover:       song.cover,
    duration:    song.duration,
    source:      song.source || 'youtube',
    position,
  };
}

// Dedupes concurrent "create this playlist on Supabase" calls for the
// same local playlist id, so rapid double-clicks (e.g. adding several
// songs to Library before the first insert resolves) can't create
// duplicate playlist rows server-side.
const _ensureSyncInFlight = new Map();

async function ensurePlaylistSynced(pl, userId) {
  if (!pl) return null;
  if (pl.supabaseId) return pl.supabaseId;
  if (_ensureSyncInFlight.has(pl.id)) return _ensureSyncInFlight.get(pl.id);

  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({
          user_id:    userId,
          name:       pl.name,
          source:     pl.source || 'manual',
          is_library: pl.id === LIBRARY_PLAYLIST_ID,
        })
        .select()
        .single();
      if (error || !data) {
        console.warn('[usePlaylists] could not create playlist on Supabase:', error?.message);
        return null;
      }
      patchLocalPlaylist(pl.id, { supabaseId: data.id });
      return data.id;
    } catch (e) {
      console.warn('[usePlaylists] playlist sync error:', e.message);
      return null;
    } finally {
      _ensureSyncInFlight.delete(pl.id);
    }
  })();

  _ensureSyncInFlight.set(pl.id, promise);
  return promise;
}

async function syncCreatePlaylist(pl) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await ensurePlaylistSynced(pl, userId);
}

async function syncAddPlaylist(pl) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const supabaseId = await ensurePlaylistSynced(pl, userId);
  if (!supabaseId) return;
  const rows = (pl.songs || [])
    .map((s, i) => songToRow(s, supabaseId, userId, i))
    .filter(Boolean);
  if (!rows.length) return;
  const { error } = await supabase.from('playlist_songs').insert(rows);
  if (error) console.warn('[usePlaylists] could not sync playlist songs:', error.message);
}

async function syncDeletePlaylist(pl) {
  const userId = await getCurrentUserId();
  if (!userId || !pl?.supabaseId) return;
  await supabase.from('playlist_songs').delete().eq('playlist_id', pl.supabaseId);
  await supabase.from('playlists').delete().eq('id', pl.supabaseId);
}

async function syncAddSong(playlistId, song, position = 0) {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const pl = _cache.find(p => p.id === playlistId);
  const supabaseId = pl?.supabaseId || await ensurePlaylistSynced(pl, userId);
  if (!supabaseId) return;
  const row = songToRow(song, supabaseId, userId, position);
  if (!row) return; // e.g. local file import — nothing to persist
  const { error } = await supabase.from('playlist_songs').insert(row);
  if (error) console.warn('[usePlaylists] could not sync song add:', error.message);
}

async function syncRemoveSong(playlistId, songId, song) {
  const youtubeId = extractYoutubeId(song) ||
    (typeof songId === 'string' && songId.startsWith('yt_') ? songId.replace('yt_', '') : null);
  if (!youtubeId) return; // was never synced server-side (e.g. local file) — nothing to remove
  const userId = await getCurrentUserId();
  if (!userId) return;
  const pl = _cache.find(p => p.id === playlistId);
  if (!pl?.supabaseId) return;
  const { error } = await supabase
    .from('playlist_songs')
    .delete()
    .eq('playlist_id', pl.supabaseId)
    .eq('youtube_id', youtubeId);
  if (error) console.warn('[usePlaylists] could not sync song removal:', error.message);
}

/* ═══════════════════════════════════════════════════════════════════ */

export function usePlaylists() {
  // Always read from localStorage on init — never trust _cache alone
  // This handles Electron renderer reloads and Vite HMR module re-evaluation
  const [playlists, setPlaylists] = useState(() => {
    const fresh = ensureLibraryPlaylist(load());
    _cache = fresh;
    return [...fresh];
  });

  useEffect(() => {
    const handler = (next) => setPlaylists([...next]);
    listeners.add(handler);

    const fresh = ensureLibraryPlaylist(load());
    const cacheStr = JSON.stringify(_cache);
    const freshStr = JSON.stringify(fresh);

    if (freshStr !== cacheStr) {
      _cache = fresh;
      listeners.forEach(fn => { try { fn([...fresh]); } catch (_) {} });
    } else {
      setPlaylists([..._cache]);
    }

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
    syncCreatePlaylist(pl);
    return pl;
  }, []);

  const addPlaylist = useCallback((pl) => {
    const current = ensureLibraryPlaylist(load());
    if (current.some(p => p.id === pl.id)) return;
    notifyAll([pl, ...current]);
    syncAddPlaylist(pl);
  }, []);

  const deletePlaylist = useCallback((id) => {
    const pl = _cache.find(p => p.id === id);
    notifyAll(_cache.filter(p => p.id !== id));
    syncDeletePlaylist(pl);
  }, []);

  const addSongToPlaylist = useCallback((playlistId, song) => {
    const pl = _cache.find(p => p.id === playlistId);
    if (pl && (pl.songs || []).some(s => s.id === song.id)) return;
    const position = (pl?.songs || []).length;
    const next = _cache.map(p => {
      if (p.id !== playlistId) return p;
      if ((p.songs || []).some(s => s.id === song.id)) return p;
      return { ...p, songs: [...(p.songs || []), { ...song }] };
    });
    notifyAll(next);
    syncAddSong(playlistId, song, position);
  }, []);

  const removeSongFromPlaylist = useCallback((playlistId, songId) => {
    const pl = _cache.find(p => p.id === playlistId);
    const removedSong = pl?.songs?.find(s => s.id === songId);
    const next = _cache.map(p => {
      if (p.id !== playlistId) return p;
      return { ...p, songs: (p.songs || []).filter(s => s.id !== songId) };
    });
    notifyAll(next);
    syncRemoveSong(playlistId, songId, removedSong);
  }, []);

  const updatePlaylist = useCallback((id, updates) => {
    notifyAll(_cache.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const refreshFromStorage = useCallback(() => {
    const fresh = ensureLibraryPlaylist(load());
    _cache = fresh;
    listeners.forEach(fn => { try { fn([...fresh]); } catch (_) {} });
    setPlaylists([...fresh]);
  }, []);

  const addToLibrary = useCallback((song) => {
    if (!song) return false;
    const current = _cache;
    const libPl = current.find(p => p.id === LIBRARY_PLAYLIST_ID)
      || { id: LIBRARY_PLAYLIST_ID, name: 'Library', songs: [], createdAt: 0, _hidden: true };
    if ((libPl.songs || []).some(s => s.id === song.id)) return false;
    const position = (libPl.songs || []).length;
    const updatedLib = { ...libPl, songs: [...(libPl.songs || []), { ...song, savedAt: Date.now() }] };
    const next = current.some(p => p.id === LIBRARY_PLAYLIST_ID)
      ? current.map(p => p.id === LIBRARY_PLAYLIST_ID ? updatedLib : p)
      : [...current, updatedLib];
    notifyAll(next);
    syncAddSong(LIBRARY_PLAYLIST_ID, song, position);
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