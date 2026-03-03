import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { notifyAll, LIBRARY_PLAYLIST_ID } from '../hooks/usePlaylists';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
        loadPlaylistsFromSupabase(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id);
          loadPlaylistsFromSupabase(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  };

  // Load playlists from Supabase and push into the usePlaylists hook cache.
  // This replaces whatever was in localStorage so the UI stays in sync.
  const loadPlaylistsFromSupabase = async (userId) => {
    const { data: pls } = await supabase
      .from('playlists')
      .select('*, playlist_songs(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!pls) return;

    const mapped = pls.map(pl => ({
      id:        pl.is_library ? LIBRARY_PLAYLIST_ID : pl.id,
      name:      pl.name,
      source:    pl.source,
      _hidden:   pl.is_library,
      createdAt: new Date(pl.created_at).getTime(),
      songs: (pl.playlist_songs || [])
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

  // Run once on first login to move localStorage playlists to Supabase
  const migrateLocalStorage = useCallback(async (userId) => {
    const local = JSON.parse(localStorage.getItem('lb:playlists') || '[]');
    if (!local.length) return;

    for (const pl of local) {
      const isLib = pl.id === LIBRARY_PLAYLIST_ID;
      const { data: newPl } = await supabase
        .from('playlists')
        .insert({
          user_id:    userId,
          name:       pl.name,
          source:     pl.source || 'manual',
          is_library: isLib,
        })
        .select()
        .single();

      if (!newPl || !pl.songs?.length) continue;

      const songs = pl.songs.map((s, i) => ({
        playlist_id: newPl.id,
        user_id:     userId,
        youtube_id:  s.youtubeId || s.id?.replace('yt_', '') || null,
        name:        s.name,
        artist:      s.artist,
        album:       s.album,
        cover:       s.cover,
        duration:    s.duration,
        source:      s.source || 'youtube',
        position:    i,
      }));

      await supabase.from('playlist_songs').insert(songs);
    }

    localStorage.removeItem('lb:playlists'); // clean up after migration
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
    if (data?.user) await migrateLocalStorage(data.user.id);
    return { data, error };
  };

  const signInWithGoogle = async () => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const value = { user, profile, loading, signUp, signIn, signInWithGoogle, signOut };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);