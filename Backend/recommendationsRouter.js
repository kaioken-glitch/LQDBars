/**
 * recommendationsRouter.js — Backend recommendation API
 *
 * Mount in server.js:
 *   import recommendationsRouter from './recommendationsRouter.js';
 *   app.use('/api/recommendations', recommendationsRouter);
 *
 * Endpoints:
 *   POST /api/recommendations/play          — log a play event
 *   GET  /api/recommendations/:userId       — get recommendations
 *   GET  /api/recommendations/trending      — global top songs (cold start)
 */

import { Router }    from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Server-side Supabase client — uses SERVICE ROLE key so it bypasses RLS
// when needed (e.g. reading all users' affinity for the recommendation query)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // NOT the anon key — never expose this
);

/* ════════════════════════════════════════════════════════════════
   POST /api/recommendations/play
   Body: { userId, youtubeId, title, artist, thumbnail, durationS }

   Called by frontend every time a song plays for > 10 seconds.
   Writes to listening_history → trigger updates user_song_affinity.
════════════════════════════════════════════════════════════════ */
router.post('/play', async (req, res) => {
  const { userId, youtubeId, title, artist, thumbnail, durationS } = req.body;

  if (!userId || !youtubeId) {
    return res.status(400).json({ error: 'userId and youtubeId are required' });
  }

  const { error } = await supabase
    .from('listening_history')
    .insert({
      user_id:    userId,
      youtube_id: youtubeId,
      title:      title     || null,
      artist:     artist    || null,
      thumbnail:  thumbnail || null,
      duration_s: durationS || 0,
      played_at:  new Date().toISOString(),
    });

  if (error) {
    console.error('[Recommendations] Failed to log play:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true });
});

/* ════════════════════════════════════════════════════════════════
   GET /api/recommendations/:userId
   ?limit=30  (optional)

   Returns personalised recommendations.
   Uses the Supabase get_recommendations() function which handles
   both collaborative filter and global fallback automatically.
════════════════════════════════════════════════════════════════ */
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  const limit = Math.min(parseInt(req.query.limit || '30'), 50);

  const { data, error } = await supabase.rpc('get_recommendations', {
    p_user_id: userId,
    p_limit:   limit,
  });

  if (error) {
    console.error('[Recommendations] RPC error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  // Attach YouTube URLs so frontend can play directly
  const songs = (data || []).map(row => ({
    id:          `yt_${row.youtube_id}`,
    youtubeId:   row.youtube_id,
    name:        row.title,
    artist:      row.artist   || 'Unknown',
    cover:       row.thumbnail || '',
    source:      'youtube',
    audio:       `https://www.youtube.com/watch?v=${row.youtube_id}`,
    relevance:   row.relevance,
    recommended: row.source,  // 'collaborative' | 'global_trending'
  }));

  res.json({ songs, source: data?.[0]?.source || 'global_trending' });
});

/* ════════════════════════════════════════════════════════════════
   GET /api/recommendations/trending
   ?limit=20

   Global top songs — used for cold start (new users with no history)
   and as a shelf on HomeOnline for everyone.
════════════════════════════════════════════════════════════════ */
router.get('/trending', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20'), 50);

  const { data, error } = await supabase
    .from('global_top_songs')
    .select('*')
    .limit(limit);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const songs = (data || []).map(row => ({
    id:        `yt_${row.youtube_id}`,
    youtubeId: row.youtube_id,
    name:      row.title,
    artist:    row.artist    || 'Unknown',
    cover:     row.thumbnail || '',
    source:    'youtube',
    audio:     `https://www.youtube.com/watch?v=${row.youtube_id}`,
    plays:     row.total_plays,
    listeners: row.listener_count,
  }));

  res.json({ songs });
});

export default router;