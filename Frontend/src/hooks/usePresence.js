// src/hooks/usePresence.js
//
// Global, ephemeral presence — who's online and what they're currently
// listening to — via Supabase Realtime Presence (no table, no polling).
// One shared channel for the whole app, module-level singleton + pub/sub
// listeners, same pattern usePlaylists.js already uses for its _cache.
//
// FIX (this version): channel.track() must not be called until the
// channel has actually finished joining (status === 'SUBSCRIBED').
// Calling track() earlier is silently dropped by Supabase, which was
// causing two symptoms:
//   1. Users showing "offline" even though they were logged in — their
//      very first track() call raced the subscribe handshake and lost.
//   2. "Now listening to X" never appearing — every song-change track()
//      call was subject to the same race.
//
// Fix: ensureChannel() now returns { channel, ready } where `ready` is a
// promise that resolves once SUBSCRIBED. All track() calls go through
// trackPresence(), which awaits `ready` first and queues writes so we
// never lose the latest state even if several updates fire in a row.

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const CHANNEL_NAME = 'lb:presence:global';

let _channel = null;
let _readyPromise = null;
let _resolveReady = null;
let _state = {};             // userId -> { online, song, updatedAt }
const _listeners = new Set();

function notify() {
  _listeners.forEach(fn => { try { fn({ ..._state }); } catch (_) { /* noop */ } });
}

function ensureChannel(userId) {
  if (_channel || !userId) return { channel: _channel, ready: _readyPromise };

  _readyPromise = new Promise(resolve => { _resolveReady = resolve; });

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
      _resolveReady?.();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      // Allow a future ensureChannel() call to rebuild the channel from
      // scratch instead of being permanently stuck on a dead one.
      _channel = null;
      _readyPromise = null;
      _resolveReady = null;
    }
  });

  return { channel: _channel, ready: _readyPromise };
}

/**
 * Safe track() wrapper — waits for the channel to actually be joined
 * before writing presence, and always writes the LATEST payload passed
 * (if called again before the previous write resolves, the newer call
 * wins).
 */
async function trackPresence(userId, payload) {
  const { channel, ready } = ensureChannel(userId);
  if (!channel || !ready) return;
  try {
    await ready;
    await channel.track(payload);
  } catch (_) {
    // best-effort — presence is non-critical, never throw into UI code
  }
}

/** Reactive presence for every user currently online. */
export function usePresenceMap() {
  const { user } = useAuth();
  const [state, setState] = useState(_state);

  useEffect(() => {
    if (!user?.id) return;
    ensureChannel(user.id);
    _listeners.add(setState);
    // Pick up whatever state already exists (e.g. channel was created by
    // another hook instance before this one mounted)
    setState({ ..._state });
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

    const song = (currentSong && isPlaying)
      ? { name: currentSong.name, artist: currentSong.artist, cover: currentSong.cover }
      : null;

    const key = JSON.stringify(song);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    trackPresence(user.id, { online: true, song, updatedAt: Date.now() });
  }, [user, currentSong?.id, currentSong?.name, currentSong?.artist, isPlaying]);
}