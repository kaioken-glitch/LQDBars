
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePlaylists } from './usePlaylists';

export function useSupabasePlaylistSync() {
  const { user } = useAuth();
  const { addSongToPlaylist, removeSongFromPlaylist, createPlaylist, deletePlaylist } = usePlaylists();

  const syncedAddSong = async (playlistId, song) => {
    addSongToPlaylist(playlistId, song); // local update — instant
    if (!user) return;
    await supabase.from('playlist_songs').insert({
      playlist_id: playlistId,
      user_id:     user.id,
      youtube_id:  song.youtubeId,
      name:        song.name,
      artist:      song.artist,
      cover:       song.cover,
      duration:    song.duration,
    });
  };

  const syncedRemoveSong = async (playlistId, songId) => {
    removeSongFromPlaylist(playlistId, songId); // local — instant
    if (!user) return;
    await supabase.from('playlist_songs')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('youtube_id', songId.replace('yt_', ''));
  };

  return { syncedAddSong, syncedRemoveSong };
}