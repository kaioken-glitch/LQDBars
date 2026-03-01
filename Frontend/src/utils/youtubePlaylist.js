/**
 * youtubePlaylist.js
 *
 * Fetches full YouTube playlist contents and enriches them with
 * video durations via the YouTube Data API v3.
 */

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const YT_BASE         = 'https://www.googleapis.com/youtube/v3';

/* ─────────────────────────────────────────────────────────────────────────────
   fetchYouTubePlaylist
   Paginates through all items in a YouTube playlist.
   Returns an array of lightweight video objects.
───────────────────────────────────────────────────────────────────────────── */
export async function fetchYouTubePlaylist(playlistId) {
  if (!playlistId) throw new Error('fetchYouTubePlaylist: playlistId is required');

  const videos        = [];
  let   nextPageToken = null;

  do {
    const url = new URL(`${YT_BASE}/playlistItems`);
    url.searchParams.set('part',       'snippet');
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('key',        YOUTUBE_API_KEY);
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `YouTube API ${res.status}`);
    }

    const data = await res.json();

    const items = (data.items || [])
      // Skip deleted / private videos (they appear with empty snippet entries)
      .filter(item => item.snippet?.resourceId?.videoId &&
                      item.snippet.title !== 'Deleted video' &&
                      item.snippet.title !== 'Private video')
      .map(item => ({
        id:          item.snippet.resourceId.videoId,
        title:       item.snippet.title,
        channel:     item.snippet.videoOwnerChannelTitle || 'YouTube',
        thumbnail:   item.snippet.thumbnails?.medium?.url ||
                     item.snippet.thumbnails?.default?.url ||
                     null,
        publishedAt: item.snippet.publishedAt,
        youtubeUrl:  `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
      }));

    videos.push(...items);
    nextPageToken = data.nextPageToken || null;
  } while (nextPageToken);

  return videos;
}

/* ─────────────────────────────────────────────────────────────────────────────
   fetchVideoDurations
   Accepts an array of video IDs, batches them into groups of 50,
   and returns a { [videoId]: durationInSeconds } map.
───────────────────────────────────────────────────────────────────────────── */
export async function fetchVideoDurations(videoIds) {
  if (!videoIds?.length) return {};

  // Split into chunks of 50 (API limit per request)
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const durationMap = {};

  await Promise.all(chunks.map(async chunk => {
    try {
      const url = new URL(`${YT_BASE}/videos`);
      url.searchParams.set('part', 'contentDetails');
      url.searchParams.set('id',   chunk.join(','));
      url.searchParams.set('key',  YOUTUBE_API_KEY);

      const res = await fetch(url.toString());
      if (!res.ok) {
        console.error('[fetchVideoDurations] API error', res.status);
        return;
      }

      const data = await res.json();
      (data.items || []).forEach(item => {
        durationMap[item.id] = parseISODuration(item.contentDetails.duration);
      });
    } catch (err) {
      console.error('[fetchVideoDurations] chunk failed:', err.message);
    }
  }));

  return durationMap;
}

/* ─────────────────────────────────────────────────────────────────────────────
   fetchPlaylistWithDurations
   Convenience wrapper: fetches a playlist then enriches every video
   with its duration in seconds AND a formatted timecode string.
───────────────────────────────────────────────────────────────────────────── */
export async function fetchPlaylistWithDurations(playlistId) {
  const videos    = await fetchYouTubePlaylist(playlistId);
  const ids       = videos.map(v => v.id);
  const durations = await fetchVideoDurations(ids);

  return videos.map(v => ({
    ...v,
    durationSeconds: durations[v.id] ?? 0,
    duration:        secondsToTimecode(durations[v.id] ?? 0),
  }));
}

/* ─────────────────────────────────────────────────────────────────────────────
   INTERNAL HELPERS
───────────────────────────────────────────────────────────────────────────── */

/**
 * Parse ISO 8601 duration string to total seconds.
 * e.g. "PT3M25S" → 205
 */
function parseISODuration(isoDuration) {
  if (!isoDuration) return 0;
  const m = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) +
         (parseInt(m[2] || 0) * 60)   +
          parseInt(m[3] || 0);
}

/**
 * Convert total seconds → "m:ss" or "h:mm:ss"
 */
function secondsToTimecode(totalSeconds) {
  const h   = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  if (h) return `${h}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${min}:${String(sec).padStart(2,'0')}`;
}