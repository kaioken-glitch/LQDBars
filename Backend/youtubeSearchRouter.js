/**
 * youtubeSearchRouter.js  — Backend YouTube search proxy
 *
 * Mount this in server.js:
 *   import youtubeSearchRouter from './youtubeSearchRouter.js';
 *   app.use('/api/youtube', youtubeSearchRouter);
 *
 * Then in .env (server-side, NOT prefixed with VITE_):
 *
 *   Single key (what you have now):
 *     YT_API_KEY=AIzaSy...
 *
 *   Multiple keys if you get more later (optional):
 *     YT_KEY_1=AIzaSy...
 *     YT_KEY_2=AIzaSy...
 *     YT_KEY_3=AIzaSy...
 *
 * Frontend calls:
 *   GET /api/youtube/search?q=kendrick+lamar&maxResults=20
 *   GET /api/youtube/trending?regionCode=US&maxResults=20
 *   GET /api/youtube/details?id=dQw4w9WgXcQ
 */

import { Router } from 'express';

const router  = Router();
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

/* ── Key pool — loaded once at startup ── */
const KEY_POOL = (() => {
  const keys = [];
  // Single key — what most setups use
  if (process.env.YT_API_KEY?.trim()) keys.push(process.env.YT_API_KEY.trim());
  // Multiple keys — add more as YT_KEY_1, YT_KEY_2 etc if you get extra quota
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`YT_KEY_${i}`];
    if (k?.trim() && !keys.includes(k.trim())) keys.push(k.trim());
  }
  if (keys.length === 0) console.warn('[YT Router] No API key found. Set YT_API_KEY in backend .env');
  else console.log(`[YT Router] ${keys.length} API key(s) loaded`);
  return keys;
})();

/* ── In-memory exhaustion tracker ── */
const exhausted = new Map(); // key → exhaustedAtMs
const COOLDOWN  = 24 * 60 * 60 * 1000; // 24h

function getKey() {
  const now = Date.now();
  for (const [k, ts] of exhausted) {
    if (now - ts >= COOLDOWN) exhausted.delete(k);
  }
  return KEY_POOL.find(k => !exhausted.has(k)) ?? null;
}

function markExhausted(key) {
  exhausted.set(key, Date.now());
  console.warn(`[YT Router] Key exhausted (${KEY_POOL.indexOf(key)+1}/${KEY_POOL.length}), marked 24h cooldown`);
}

/* ── Generic fetch with auto-rotate on quota error ── */
async function ytFetch(buildUrl) {
  for (let attempt = 0; attempt < KEY_POOL.length + 1; attempt++) {
    const key = getKey();
    if (!key) {
      return { error: 'All YouTube API keys exhausted. Resets in ~24h.', status: 429 };
    }

    const url = buildUrl(key);
    const res = await fetch(url);

    if (res.status === 403 || res.status === 429) {
      markExhausted(key);
      continue; // try next key
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body?.error?.message || `YouTube API ${res.status}`, status: res.status };
    }

    return { data: await res.json(), status: 200 };
  }
  return { error: 'All keys exhausted after retry.', status: 429 };
}

/* ════════════════════════════════════════════
   GET /api/youtube/search
   ?q=           search query (required)
   ?maxResults=  default 20
   ?type=        video|channel|playlist (default: video)
════════════════════════════════════════════ */
router.get('/search', async (req, res) => {
  const { q, maxResults = '20', type = 'video' } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  const { data, error, status } = await ytFetch(key => {
    const url = new URL(`${YT_BASE}/search`);
    url.searchParams.set('part',       'snippet');
    url.searchParams.set('type',       type);
    url.searchParams.set('q',          q);
    url.searchParams.set('maxResults', maxResults);
    url.searchParams.set('key',        key);
    return url.toString();
  });

  if (error) return res.status(status).json({ error });

  // Batch-fetch durations
  const ids = (data.items || []).map(i => i.id?.videoId).filter(Boolean);
  const durMap = {};
  if (ids.length) {
    const { data: detData } = await ytFetch(key => {
      const url = new URL(`${YT_BASE}/videos`);
      url.searchParams.set('part', 'contentDetails,snippet');
      url.searchParams.set('id',   ids.join(','));
      url.searchParams.set('key',  key);
      return url.toString();
    });
    (detData?.items || []).forEach(v => {
      durMap[v.id] = v.contentDetails?.duration || '';
    });
  }

  const videos = (data.items || [])
    .filter(i => i.id?.videoId)
    .map(i => ({
      id:        i.id.videoId,
      title:     i.snippet?.title || '',
      channel:   i.snippet?.channelTitle || '',
      thumbnail: i.snippet?.thumbnails?.high?.url || i.snippet?.thumbnails?.default?.url || '',
      duration:  durMap[i.id.videoId] || '',
    }));

  res.json({ videos, total: videos.length });
});

/* ════════════════════════════════════════════
   GET /api/youtube/trending
   ?regionCode=  default US
   ?maxResults=  default 20
════════════════════════════════════════════ */
router.get('/trending', async (req, res) => {
  const { regionCode = 'US', maxResults = '20' } = req.query;

  const { data, error, status } = await ytFetch(key => {
    const url = new URL(`${YT_BASE}/videos`);
    url.searchParams.set('part',            'snippet,contentDetails');
    url.searchParams.set('chart',           'mostPopular');
    url.searchParams.set('videoCategoryId', '10'); // Music
    url.searchParams.set('regionCode',      regionCode);
    url.searchParams.set('maxResults',      maxResults);
    url.searchParams.set('key',             key);
    return url.toString();
  });

  if (error) return res.status(status).json({ error });

  const videos = (data.items || []).map(i => ({
    id:        i.id,
    title:     i.snippet?.title || '',
    channel:   i.snippet?.channelTitle || '',
    thumbnail: i.snippet?.thumbnails?.high?.url || '',
    duration:  i.contentDetails?.duration || '',
  }));

  res.json({ videos, total: videos.length });
});

/* ════════════════════════════════════════════
   GET /api/youtube/details
   ?id=  videoId (required)
════════════════════════════════════════════ */
router.get('/details', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  const { data, error, status } = await ytFetch(key =>
    `${YT_BASE}/videos?part=snippet,contentDetails&id=${id}&key=${key}`
  );

  if (error) return res.status(status).json({ error });

  const item = data?.items?.[0];
  if (!item) return res.status(404).json({ error: 'Video not found' });

  res.json({
    id:        item.id,
    title:     item.snippet?.title || '',
    channel:   item.snippet?.channelTitle || '',
    thumbnail: item.snippet?.thumbnails?.high?.url || '',
    duration:  item.contentDetails?.duration || '',
  });
});

/* ── Key status (dev/debug only) ── */
router.get('/keys/status', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  res.json({
    total:     KEY_POOL.length,
    available: KEY_POOL.filter(k => !exhausted.has(k)).length,
    exhausted: KEY_POOL.filter(k => exhausted.has(k)).length,
  });
});

export default router;