// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { notifyAll, LIBRARY_PLAYLIST_ID } from '../hooks/usePlaylists';

const AuthContext = createContext();

function extractYoutubeId(song) {
  if (!song) return null;
  if (song.youtubeId) return song.youtubeId;
  if (typeof song.id === 'string' && song.id.startsWith('yt_')) return song.id.replace('yt_', '');
  return null;
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      setProfile(data);
    } else {
      // Profile doesn't exist yet — create one with default values
      const { data: user } = await supabase.auth.getUser();
      const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Music Lover';
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          display_name: displayName,
          avatar_url: `https://placehold.co/80x80/1a1a1a/333?text=${encodeURIComponent(displayName[0])}`,
        })
        .select()
        .single();
      if (newProfile) setProfile(newProfile);
    }
  };

  /**
   * Single source of truth for writing to `profiles` after initial load.
   * Components (e.g. Settings.jsx) should call this instead of writing to
   * Supabase directly — a direct write leaves this context's `profile`
   * state stale until the next full sign-in, so anything reading
   * useAuth().profile elsewhere in the app (greeting text, avatar, etc.)
   * keeps showing the old value even though the DB row is correct.
   */
  const updateProfile = useCallback(async (updates) => {
    if (!user) return { data: null, error: new Error('Not signed in') };
    const payload = { id: user.id, updated_at: new Date().toISOString(), ...updates };
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload)
      .select()
      .single();
    if (error) return { data: null, error };
    setProfile(prev => ({ ...(prev || {}), ...data }));
    return { data, error: null };
  }, [user]);

  // Pulls the canonical playlist/library state down from Supabase and
  // replaces the local cache with it. Never wipes local data on a
  // network/RLS error — if the fetch fails we leave whatever is already
  // in localStorage alone instead of overwriting it with [].
  const loadPlaylistsFromSupabase = async (userId) => {
    const { data: pls, error } = await supabase
      .from('playlists')
      .select('*, playlist_songs(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Auth] could not load playlists from Supabase — keeping local copy:', error.message);
      return;
    }

    const mapped = (pls || []).map(pl => ({
      id:         pl.is_library ? LIBRARY_PLAYLIST_ID : pl.id,
      supabaseId: pl.id,
      name:       pl.name,
      source:     pl.source,
      _hidden:    pl.is_library,
      createdAt:  new Date(pl.created_at).getTime(),
      songs: (pl.playlist_songs || [])
        .filter(s => s.youtube_id) // defensive — skip rows we can't reconstruct a playable song from
        .sort((a, b) => a.position - b.position)
        .map(s => ({
          id:        `yt_${s.youtube_id}`,
          name:      s.name,
          artist:    s.artist,
          album:     s.album,
          cover:     s.cover,
          duration:  s.duration,
          source:    'youtube',
          youtubeId: s.youtube_id,
          audio:     `https://www.youtube.com/watch?v=${s.youtube_id}`,
        })),
    }));

    notifyAll(mapped); // pushes into every usePlaylists() consumer instantly
  };

  // Pushes any LOCAL-ONLY playlists/songs (ones never written to Supabase,
  // i.e. missing a `supabaseId`) up to the server. Safe to call on every
  // login — anything already tagged with a `supabaseId` is skipped, so
  // repeated calls never create duplicates.
  const migrateLocalStorage = async (userId) => {
    let local;
    try { local = JSON.parse(localStorage.getItem('lb:playlists') || '[]'); }
    catch { local = []; }

    const toMigrate = local.filter(pl => {
      if (pl.supabaseId) return false;
      if (pl.id === LIBRARY_PLAYLIST_ID && (pl.songs || []).length === 0) return false;
      return true;
    });
    if (!toMigrate.length) return;

    for (const pl of toMigrate) {
      const isLib = pl.id === LIBRARY_PLAYLIST_ID;
      const { data: newPl, error } = await supabase
        .from('playlists')
        .insert({
          user_id:    userId,
          name:       pl.name,
          source:     pl.source || 'manual',
          is_library: isLib,
        })
        .select()
        .single();

      if (error || !newPl) {
        console.warn('[Auth] migration failed for playlist', pl.name, error?.message);
        continue;
      }

      const songs = (pl.songs || [])
        .map((s, i) => {
          const youtubeId = extractYoutubeId(s);
          if (!youtubeId) return null; // local file import — nothing to restore later
          return {
            playlist_id: newPl.id,
            user_id:     userId,
            youtube_id:  youtubeId,
            name:        s.name,
            artist:      s.artist,
            album:       s.album,
            cover:       s.cover,
            duration:    s.duration,
            source:      s.source || 'youtube',
            position:    i,
          };
        })
        .filter(Boolean);

      if (songs.length) {
        const { error: songsErr } = await supabase.from('playlist_songs').insert(songs);
        if (songsErr) console.warn('[Auth] migration: failed to insert songs for', pl.name, songsErr.message);
      }
    }
    // We deliberately don't touch localStorage here — loadPlaylistsFromSupabase
    // (called right after this) replaces the cache with the freshly-synced
    // server copy, tagging every playlist with its real supabaseId so this
    // becomes a no-op on every future login.
  };

  // Runs on every login (any provider) and on session restore: pushes up
  // anything local-only, then pulls down the canonical server copy.
  const syncPlaylistsForUser = async (userId) => {
    try {
      await migrateLocalStorage(userId);
    } catch (e) {
      console.warn('[Auth] migration step failed, will still try to load:', e.message);
    }
    await loadPlaylistsFromSupabase(userId);
  };

  // On mount: restore existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
        syncPlaylistsForUser(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id);
          syncPlaylistsForUser(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    });
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // Migration + playlist load now happens automatically via the
    // onAuthStateChange listener above once the session is established.
    return { data, error };
  };

  const signInWithGoogle = async () => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signInWithDiscord = async () => {
    return supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const value = { user, profile, loading, signUp, signIn, signInWithGoogle, signInWithDiscord, signOut, updateProfile };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);