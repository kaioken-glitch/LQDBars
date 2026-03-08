/**
 * youtubeConverter.js  (Frontend utility)
 *
 * Handles all YouTube Data API v3 calls (search, metadata) and bridges to
 * the backend stream-URL service at VITE_YT_BACKEND_URL.
 *
 * QUOTA NOTES:
 *   - Each searchVideos() call costs 100 units (10,000/day free).
 *   - getAudioStream() costs 0 units — it hits our own backend.
 *   - videoCategoryId is intentionally OMITTED from search — it requires
 *     YouTube Partner API scope and causes 403 on standard Data API v3 keys.
 *   - getTrendingMusic() uses videos.list (chart=mostPopular) which correctly
 *     supports videoCategoryId.
 *
 * ENV:
 *   VITE_YOUTUBE_API_KEY   – YouTube Data API v3 key
 *   VITE_YT_BACKEND_URL    – backend URL (default: http://localhost:3001)
 */

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const YT_BACKEND_URL  = (import.meta.env.VITE_YT_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
const YT_BASE         = 'https://www.googleapis.com/youtube/v3';

// User-Agent to identify our app to LRCLIB (used in useLyrics hook)
export const LRCLIB_UA = 'LiquidBars/1.0 (https://liquidbars.app)';

class YouTubeConverter {
  constructor() {
    // audioUrl cache: videoId → { audioUrl, ts }
    this._cache    = new Map();
    this.CACHE_TTL = 60 * 60 * 1000; // 1h
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SEARCH
     Two-step: search → batch-fetch durations (1 extra quota unit for all).
     videoCategoryId intentionally omitted — causes 403 on standard keys.
  ═══════════════════════════════════════════════════════════════════════ */
  async searchVideos(query, maxResults = 20) {
    try {
      if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'your_youtube_api_key_here') {
        console.warn('[YTConverter] YouTube API key not configured');
        return [];
      }

      // Step 1: search
      const searchUrl = new URL(`${YT_BASE}/search`);
      searchUrl.searchParams.set('part',       'snippet');
      searchUrl.searchParams.set('type',       'video');
      searchUrl.searchParams.set('q',          query);
      searchUrl.searchParams.set('maxResults', String(maxResults));
      searchUrl.searchParams.set('key',        YOUTUBE_API_KEY);
      // ⚠️ DO NOT add videoCategoryId here — it requires YouTube Partner scope
      //    and returns 403 on standard Data API v3 keys.

      const searchRes = await fetch(searchUrl.toString());
      if (!searchRes.ok) {
        const err = await searchRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || `YouTube search API ${searchRes.status}`);
      }

      const searchData = await searchRes.json();
      const items      = searchData.items || [];
      if (!items.length) return [];

      // Step 2: batch-fetch durations — 1 quota unit for all IDs
      const ids       = items.map(i => i.id.videoId).join(',');
      const detailUrl = new URL(`${YT_BASE}/videos`);
      detailUrl.searchParams.set('part', 'contentDetails');
      detailUrl.searchParams.set('id',   ids);
      detailUrl.searchParams.set('key',  YOUTUBE_API_KEY);

      const detailRes  = await fetch(detailUrl.toString());
      const detailData = detailRes.ok ? await detailRes.json() : { items: [] };

      // Build duration map: videoId → seconds
      const durationMap = {};
      for (const d of (detailData.items || [])) {
        const iso = d.contentDetails?.duration || '';
        const h   = Number((iso.match(/(\d+)H/) || [0, 0])[1]);
        const m   = Number((iso.match(/(\d+)M/) || [0, 0])[1]);
        const s   = Number((iso.match(/(\d+)S/) || [0, 0])[1]);
        durationMap[d.id] = h * 3600 + m * 60 + s;
      }

      // Map results + attach duration
      return items.map(item => {
        const totalSecs = durationMap[item.id.videoId] ?? 0;
        const mm        = Math.floor(totalSecs / 60);
        const ss        = String(totalSecs % 60).padStart(2, '0');
        return {
          id:           item.id.videoId,
          title:        item.snippet.title,
          channel:      item.snippet.channelTitle,
          thumbnail:    item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          publishedAt:  item.snippet.publishedAt,
          youtubeUrl:   `https://www.youtube.com/watch?v=${item.id.videoId}`,
          duration:     totalSecs > 0 ? `${mm}:${ss}` : null,
          durationSecs: totalSecs,
        };
      });
    } catch (err) {
      console.error('[YTConverter] searchVideos:', err.message);
      return [];
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     VIDEO ID EXTRACTION
  ═══════════════════════════════════════════════════════════════════════ */
  extractVideoId(urlOrId) {
    if (!urlOrId) return null;
    const patterns = [
      /youtube\.com\/watch\?.*v=([^&#]+)/,
      /youtu\.be\/([^?&#]+)/,
      /youtube\.com\/embed\/([^?&#]+)/,
      /youtube\.com\/shorts\/([^?&#]+)/,
    ];
    for (const re of patterns) {
      const m = urlOrId.match(re);
      if (m) return m[1];
    }
    if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
    return null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     AUDIO STREAM
     Calls the backend — costs 0 quota units.
     Backend returns a direct CDN stream URL resolved via ytdl-core/yt-dlp.
     Result cached for 1h in-memory.
  ═══════════════════════════════════════════════════════════════════════ */
  async getAudioStream(videoIdOrUrl) {
    const videoId = this.extractVideoId(videoIdOrUrl) ?? videoIdOrUrl;
    if (!videoId) throw new Error('[YTConverter] Invalid YouTube video ID or URL');

    // Cache hit
    const cached = this._cache.get(videoId);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
      console.debug('[YTConverter] cache hit:', videoId);
      return cached.audioUrl;
    }

    // Backend call
    const endpoint = `${YT_BACKEND_URL}/api/youtube/audio/${videoId}`;
    console.debug('[YTConverter] fetching audio from backend:', endpoint);

    const res = await fetch(endpoint);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `Backend returned ${res.status} for video ${videoId}`);
    }

    const { audioUrl } = await res.json();
    if (!audioUrl) throw new Error('[YTConverter] Backend did not return an audioUrl');

    this._cache.set(videoId, { audioUrl, ts: Date.now() });
    return audioUrl;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     VIDEO DETAILS
  ═══════════════════════════════════════════════════════════════════════ */
  async getVideoDetails(videoId) {
    // Try backend first (no quota cost)
    try {
      const res = await fetch(`${YT_BACKEND_URL}/api/youtube/info/${videoId}`);
      if (res.ok) {
        const d = await res.json();
        return {
          id:         videoId,
          title:      d.title,
          channel:    d.author,
          duration:   this._secondsToTimecode(Number(d.duration) || 0),
          thumbnail:  d.thumbnail,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };
      }
    } catch (_) { /* fall through */ }

    // Fallback: YouTube Data API
    try {
      const url  = `${YT_BASE}/videos?part=contentDetails,snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.items?.length) throw new Error('Video not found');
      const video = data.items[0];
      return {
        id:         videoId,
        title:      video.snippet.title,
        channel:    video.snippet.channelTitle,
        duration:   this.parseDuration(video.contentDetails.duration),
        thumbnail:  video.snippet.thumbnails?.medium?.url,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    } catch (err) {
      console.error('[YTConverter] getVideoDetails:', err.message);
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PREPARE SONG FOR PLAYBACK
     Used by PlayerContext when it encounters a song with source === 'youtube'
     but no resolved audio URL.
  ═══════════════════════════════════════════════════════════════════════ */
  async prepareSongForPlayback(song) {
    // Already a local/backend stream URL
    if (song.audio && !song.audio.includes('youtube.com')) return song;
    if (song.streamUrl && !song.streamUrl.includes('youtube.com')) {
      return { ...song, audio: song.streamUrl, url: song.streamUrl, src: song.streamUrl };
    }

    try {
      const id = song.youtubeId || this.extractVideoId(song.audio || song.streamUrl || '');
      if (id) {
        const audioUrl = await this.getAudioStream(id);
        return { ...song, audio: audioUrl, url: audioUrl, src: audioUrl, streamUrl: audioUrl, source: 'youtube' };
      }
    } catch (err) {
      console.warn('[YTConverter] prepareSongForPlayback resolve failed:', err.message);
    }

    // Last resort: search by name + artist
    const results = await this.searchVideos(`${song.name} ${song.artist}`, 1);
    if (!results.length) throw new Error(`Could not find stream for "${song.name}"`);
    const audioUrl = await this.getAudioStream(results[0].id);
    return {
      ...song,
      audio: audioUrl, url: audioUrl, src: audioUrl, streamUrl: audioUrl,
      source: 'youtube', youtubeId: results[0].id,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TRENDING MUSIC
     Uses videos.list which correctly supports videoCategoryId.
  ═══════════════════════════════════════════════════════════════════════ */
  async getTrendingMusic(regionCode = 'US', maxResults = 50) {
    try {
      const url = new URL(`${YT_BASE}/videos`);
      url.searchParams.set('part',            'snippet');
      url.searchParams.set('chart',           'mostPopular');
      url.searchParams.set('videoCategoryId', '10'); // music — valid here (videos.list)
      url.searchParams.set('regionCode',      regionCode);
      url.searchParams.set('maxResults',      String(maxResults));
      url.searchParams.set('key',             YOUTUBE_API_KEY);

      const res  = await fetch(url.toString());
      const data = await res.json();

      return (data.items || []).map(item => ({
        id:         item.id,
        title:      item.snippet.title,
        channel:    item.snippet.channelTitle,
        thumbnail:  item.snippet.thumbnails?.medium?.url,
        youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`,
      }));
    } catch (err) {
      console.error('[YTConverter] getTrendingMusic:', err.message);
      return [];
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     UTILITIES
  ═══════════════════════════════════════════════════════════════════════ */

  /** Parse ISO 8601 duration (PT4M13S) → "4:13" */
  parseDuration(iso) {
    const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return '0:00';
    const h   = parseInt(m[1] || 0);
    const min = parseInt(m[2] || 0);
    const sec = parseInt(m[3] || 0);
    if (h) return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  _secondsToTimecode(totalSeconds) {
    const h   = Math.floor(totalSeconds / 3600);
    const min = Math.floor((totalSeconds % 3600) / 60);
    const sec = totalSeconds % 60;
    if (h) return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  isStreamableUrl(url) {
    if (!url) return false;
    return /\.(mp3|m4a|wav|ogg|webm|aac|opus)$/i.test(url) ||
           /localhost/.test(url) ||
           /127\.0\.0\.1/.test(url);
  }

  clearCache() { this._cache.clear(); }
}

export default new YouTubeConverter();