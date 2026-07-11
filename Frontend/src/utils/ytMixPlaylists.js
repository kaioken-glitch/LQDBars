/**
 * ytMixPlaylist.js
 *
 * Shared YouTube "Mix" (RD{videoId}) playlist fetcher — YouTube's own
 * recommendation graph, at 1 quota unit per fetch (up to 50 songs) vs.
 * 100 units PER SONG for /search. Extracted out of useSmartRadio.js so
 * useMoodPlaylist.js can use the exact same cheap, high-quality "similar
 * songs" source instead of duplicating this logic or falling back to
 * expensive parallel text search to find new-but-similar tracks.
 */

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function memoizeAsync(func, ttl = Infinity) {
  const cache = new Map();
  return async function (...args) {
    const key = JSON.stringify(args);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < ttl) return deepClone(hit.value);
    const value = await func.apply(this, args);
    cache.set(key, { value, ts: Date.now() });
    return deepClone(value);
  };
}

/* ── Raw Mix playlist page — 1 quota unit, memoized 30min (mix content
   is stable enough that re-fetching within a window is wasted quota) ── */
export const fetchYouTubeMixPage = memoizeAsync(async function (videoId, ytKey, pageToken) {
  const url = new URL(`${YT_BASE}/playlistItems`);
  url.searchParams.set('part',       'snippet');
  url.searchParams.set('playlistId', `RD${videoId}`);
  url.searchParams.set('maxResults', '50');
  url.searchParams.set('key',        ytKey);
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`YT playlistItems ${res.status}`);
  const data = await res.json();
  return { items: data.items || [], nextPageToken: data.nextPageToken || null };
}, 30 * 60 * 1000);

/* ── Raw playlist item → the app's song shape ─────────────────────────
   `tag` records provenance (source: 'radio' | 'mood-mix' | ...) so
   callers can tell candidates apart without a separate mapper each. ── */
export function mapMixItem(item, tag = 'mix') {
  const s   = item.snippet;
  const vid = s?.resourceId?.videoId;
  if (!vid) return null;
  const url = `https://www.youtube.com/watch?v=${vid}`;
  return {
    id: `yt_${vid}`,
    name: s.title || 'Unknown',
    artist: s.videoOwnerChannelTitle || 'YouTube',
    youtubeId: vid,
    cover: s.thumbnails?.medium?.url || `https://img.youtube.com/vi/${vid}/mqdefault.jpg`,
    audio: url, url, src: url,
    album: '', source: tag, youtube: true,
  };
}

/**
 * Build a batch of NEW (not-yet-seen) songs from a seed video's Mix
 * playlist. `excludeIds` is a Set of youtubeIds — mutated in place so
 * repeated calls across multiple seeds naturally dedupe against each other.
 */
export async function buildMixBatch(seedVideoId, ytKey, excludeIds, pageToken, batchSize = 10, tag = 'mix') {
  const { items, nextPageToken } = await fetchYouTubeMixPage(seedVideoId, ytKey, pageToken || null);
  const results = [];
  for (const item of items) {
    const song = mapMixItem(item, tag);
    if (!song || song.youtubeId === seedVideoId || excludeIds.has(song.youtubeId)) continue;
    excludeIds.add(song.youtubeId);
    results.push(song);
    if (results.length >= batchSize) break;
  }
  return { songs: results, nextPageToken };
}