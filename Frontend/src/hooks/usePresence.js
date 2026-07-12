// src/hooks/usePresence.js
//
// Global, ephemeral presence — who's online and what they're currently
// listening to — via Supabase Realtime Presence (no table, no polling).
// One shared channel for the whole app, module-level singleton + pub/sub
// listeners, same pattern usePlaylists.js already uses for its _cache.
//
// Two things live here:
//   usePresence(userId) / usePresenceMap() — READ someone's presence
//   useBroadcastOwnPresence(song, isPlaying) — WRITE your own presence
//
// useBroadcastOwnPresence is meant to be called exactly once, from a
// small bridge component mounted near the app root (see
// src/components/PresenceSync.jsx) fed by PlayerContext's currentSong —
// so "now listening" updates automatically whenever the user changes
// songs, with zero changes needed inside PlayerContext.jsx itself.

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const CHANNEL_NAME = 'lb:presence:global';

let _channel = null;
let _state = {};             // userId -> { online, song, updatedAt }
const _listeners = new Set();

function notify() {
  _listeners.forEach(fn => { try { fn({ ..._state }); } catch (_) { /* noop */ } });
}

function ensureChannel(userId) {
  if (_channel || !userId) return _channel;

  _channel = supabase.channel(CHANNEL_NAME, { config: { presence: { key: userId } } });

  _channel.on('presence', { event: 'sync' }, () => {
    const raw = _channel.presenceState();
    const next = {};
    Object.entries(raw).forEach(([uid, metas]) => {
      const meta = metas[metas.length - 1]; // most recent tracked state for that key
      next[uid] = { online: true, song: meta?.song || null, updatedAt: meta?.updatedAt || null };
    });
    _state = next;
    notify();
  });

  _channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await _channel.track({ online: true, song: null, updatedAt: Date.now() });
    }
  });

  return _channel;
}

/** Reactive presence for every user currently online. */
export function usePresenceMap() {
  const { user } = useAuth();
  const [state, setState] = useState(_state);

  useEffect(() => {
    ensureChannel(user?.id);
    _listeners.add(setState);
    return () => { _listeners.delete(setState); };
  }, [user?.id]);

  return state;
}

/** Reactive presence for a single user. Offline/no song when not present. */
export function usePresence(userId) {
  const map = usePresenceMap();
  if (!userId) return { online: false, song: null };
  return map[userId] || { online: false, song: null };
}

/**
 * Broadcasts the CURRENT USER's own presence — call once, fed by
 * PlayerContext. Deliberately skips redundant track() calls when nothing
 * relevant changed (song id + play state), since Presence updates fan
 * out to every connected client.
 */
export function useBroadcastOwnPresence(currentSong, isPlaying) {
  const { user } = useAuth();
  const lastKeyRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const channel = ensureChannel(user.id);
    if (!channel) return;

    const song = (currentSong && isPlaying)
      ? { name: currentSong.name, artist: currentSong.artist, cover: currentSong.cover }
      : null;

    const key = JSON.stringify(song);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    channel.track({ online: true, song, updatedAt: Date.now() }).catch(() => {});
  }, [user, currentSong?.id, currentSong?.name, currentSong?.artist, isPlaying]);
}