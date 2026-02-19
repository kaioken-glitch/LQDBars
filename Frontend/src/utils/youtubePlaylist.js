// src/utils/youtubePlaylist.js
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export async function fetchYouTubePlaylist(playlistId) {
  const videos = [];
  let nextPageToken = '';

  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch playlist');
    }

    const data = await response.json();
    
    const items = data.items.map(item => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      channel: item.snippet.videoOwnerChannelTitle || 'YouTube',
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      publishedAt: item.snippet.publishedAt,
    }));

    videos.push(...items);
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return videos;
}

/**
 * Fetch durations for multiple video IDs
 * @param {Array<string>} videoIds - Array of YouTube video IDs
 * @returns {Promise<Object>} Map of videoId -> duration in seconds
 */
export async function fetchVideoDurations(videoIds) {
  if (videoIds.length === 0) return {};
  
  // YouTube API allows up to 50 IDs per request
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const durationMap = {};

  for (const chunk of chunks) {
    const idsParam = chunk.join(',');
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${idsParam}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Failed to fetch video durations');
      continue;
    }

    const data = await response.json();
    
    data.items.forEach(item => {
      // Parse ISO 8601 duration (e.g., PT3M25S)
      const durationStr = item.contentDetails.duration;
      const seconds = parseISODuration(durationStr);
      durationMap[item.id] = seconds;
    });
  }

  return durationMap;
}

/**
 * Parse ISO 8601 duration string to seconds
 * @param {string} isoDuration - e.g., PT3M25S
 * @returns {number} seconds
 */
function parseISODuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}