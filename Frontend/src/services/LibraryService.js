import { supabase } from '../lib/supabase';

export const LibraryService = {
  // Fetches songs frequently finished entirely by lookalike users
  getMoodTwinPlaylist: async (userId) => {
    const { data, error } = await supabase
      .from('user_listening_behavior')
      .select('track_id')
      .eq('was_looped', true)
      .not('user_id', 'eq', userId) // Find strangers
      .limit(20);

    if (error) throw error;
    return data.map(item => item.track_id);
  }
};
