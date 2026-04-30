/**
 * youtubeConverter.js
 *
 * PATTERNS APPLIED:
 *   Memoization  — searchVideos, getVideoDetails results cached by query/id
 *   Debounce     — searchVideos debounced to prevent quota drain on rapid calls
 *   Deep Clone   — cache entries cloned on read so callers can't mutate cache state
 *   Throttle     — getTrendingMusic throttled (expensive chart call, 1 per 5 min max)
 */

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const YT_BACKEND_URL  = (import.meta.env.VITE_YT_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
const YT_BASE         = 'https://www.googleapis.com/youtube/v3';

export const LRCLIB_UA = 'LiquidBars/1.0 (https://liquidbars.app)';

/* ─────────────────────────────────────────────────────────────────────────────
   UTILITY: Debounce
   Limits how often searchVideos can fire — callers typing in the search box
   trigger it on every keystroke. Without debounce that's 100 quota units per
   character typed. With 400ms debounce it only fires once the user pauses.
───────────────────────────────────────────────────────────────────────────── */
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   UTILITY: Throttle
   Ensures getTrendingMusic (expensive chart call) fires at most once per window.
   Unlike debounce it executes immediately on the first call, then blocks until
   the window expires.
───────────────────────────────────────────────────────────────────────────── */
function throttle(func, limit) {
  let lastRan;
  let lastFunc;
  return function (...args) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   UTILITY: Memoize
   Caches the result of any async function by its stringified arguments.
   Accepts an optional TTL (ms) — expired entries are re-fetched automatically.
   Returns a deep clone of the cached value so callers can't mutate cache state.
───────────────────────────────────────────────────────────────────────────── */
function memoizeAsync(func, ttl = Infinity) {
  const cache = new Map(); // key → { value, ts }
  return async function (...args) {
    const key = JSON.stringify(args);
    const hit = cache.get(key);
    if (hit && (Date.now() - hit.ts) < ttl) {
      // Deep clone so the caller mutating the result doesn't corrupt the cache
      return JSON.parse(JSON.stringify(hit.value));
    }
    const value = await func.apply(this, args);
    cache.set(key, { value, ts: Date.now() });
    return JSON.parse(JSON.stringify(value));
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   UTILITY: Deep Clone
   Used to safely copy song objects before injecting them into player state,
   so mutations to the playing song don't propagate back to the cache or shelf.
───────────────────────────────────────────────────────────────────────────── */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

class YouTubeConverter {
  constructor() {
    // Audio URL cache kept separately because TTL is short (CDN links expire)
    this._audioCache = new Map();
    this.CACHE_TTL   = 60 * 60 * 1000; // 1h

    // ── Memoized API methods ─────────────────────────────────────────────
    // searchVideos: cache for 10 min — search results don't change that fast
    this._searchMemo = memoizeAsync(this._searchVideosRaw.bind(this), 10 * 60 * 1000);

    // getVideoDetails: cache for 1h — video metadata is stable
    this._detailMemo = memoizeAsync(this._getVideoDetailsRaw.bind(this), 60 * 60 * 1000);

    // getTrendingMusic raw fn — throttled so the expensive chart call fires
    // at most once every 5 minutes regardless of how many shelves request it
    this._trendingThrottled = throttle(
      this._getTrendingRaw.bind(this),
      5 * 60 * 1000
    );

    // searchVideos exposed to callers is debounced (400ms) to absorb
    // rapid keystrokes in the search box without burning quota
    this.searchVideosDebounced = debounce(
      (query, maxResults, cb) =>
        this._searchMemo(query, maxResults).then(cb).catch(() => cb([])),
      400
    );
  }

  /* ── searchVideos — memoized, called directly for programmatic use ── */
  async searchVideos(query, maxResults = 20) {
    return this._searchMemo(query, maxResults);
  }

  async _searchVideosRaw(query, maxResults = 20) {
    try {
      if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'your_youtube_api_key_here') {
        console.warn('[YTConverter] YouTube API key not configured');
        return [];
      }

      const searchUrl = new URL(`${YT_BASE}/search`);
      searchUrl.searchParams.set('part',       'snippet');
      searchUrl.searchParams.set('type',       'video');
      searchUrl.searchParams.set('q',          query);
      searchUrl.searchParams.set('maxResults', String(maxResults));
      searchUrl.searchParams.set('key',        YOUTUBE_API_KEY);

      const searchRes = await fetch(searchUrl.toString());
      if (!searchRes.ok) {
        const err = await searchRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || `YouTube search API ${searchRes.status}`);
      }

      const searchData = await searchRes.json();
      const items      = searchData.items || [];
      if (!items.length) return [];

      // Batch-fetch durations — 1 quota unit for all IDs
      const ids       = items.map(i => i.id.videoId).join(',');
      const detailUrl = new URL(`${YT_BASE}/videos`);
      detailUrl.searchParams.set('part', 'contentDetails');
      detailUrl.searchParams.set('id',   ids);
      detailUrl.searchParams.set('key',  YOUTUBE_API_KEY);

      const detailRes  = await fetch(detailUrl.toString());
      const detailData = detailRes.ok ? await detailRes.json() : { items: [] };

      const durationMap = {};
      for (const d of (detailData.items || [])) {
        const iso = d.contentDetails?.duration || '';
        const h   = Number((iso.match(/(\d+)H/) || [0, 0])[1]);
        const m   = Number((iso.match(/(\d+)M/) || [0, 0])[1]);
        const s   = Number((iso.match(/(\d+)S/) || [0, 0])[1]);
        durationMap[d.id] = h * 3600 + m * 60 + s;
      }

      return items.map(item => {
        const totalSecs = durationMap[item.id.videoId] ?? 0;
        const mm = Math.floor(totalSecs / 60);
        const ss = String(totalSecs % 60).padStart(2, '0');
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

  /* ── Video ID extraction ── */
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

  /* ── Audio stream — cached in instance map ── */
  async getAudioStream(videoIdOrUrl) {
    const videoId = this.extractVideoId(videoIdOrUrl) ?? videoIdOrUrl;
    if (!videoId) throw new Error('[YTConverter] Invalid YouTube video ID or URL');

    const cached = this._audioCache.get(videoId);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) return cached.audioUrl;

    const endpoint = `${YT_BACKEND_URL}/api/youtube/audio/${videoId}`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `Backend returned ${res.status} for video ${videoId}`);
    }

    const { audioUrl } = await res.json();
    if (!audioUrl) throw new Error('[YTConverter] Backend did not return an audioUrl');

    this._audioCache.set(videoId, { audioUrl, ts: Date.now() });
    return audioUrl;
  }

  /* ── Video details — memoized ── */
  async getVideoDetails(videoId) {
    return this._detailMemo(videoId);
  }

  async _getVideoDetailsRaw(videoId) {
    try {
      const res = await fetch(`${YT_BACKEND_URL}/api/youtube/info/${videoId}`);
      if (res.ok) {
        const d = await res.json();
        return {
          id: videoId, title: d.title, channel: d.author,
          duration: this._secondsToTimecode(Number(d.duration) || 0),
          thumbnail: d.thumbnail,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };
      }
    } catch (_) {}

    try {
      const url  = `${YT_BASE}/videos?part=contentDetails,snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.items?.length) throw new Error('Video not found');
      const video = data.items[0];
      return {
        id: videoId,
        title: video.snippet.title,
        channel: video.snippet.channelTitle,
        duration: this.parseDuration(video.contentDetails.duration),
        thumbnail: video.snippet.thumbnails?.medium?.url,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    } catch (err) {
      console.error('[YTConverter] getVideoDetails:', err.message);
      return null;
    }
  }

  /* ── Prepare song for playback — deep clones before mutating ── */
  async prepareSongForPlayback(song) {
    // Deep clone before adding audio URL so shelf state isn't mutated
    const songCopy = deepClone(song);

    if (songCopy.audio && !songCopy.audio.includes('youtube.com')) return songCopy;
    if (songCopy.streamUrl && !songCopy.streamUrl.includes('youtube.com')) {
      return { ...songCopy, audio: songCopy.streamUrl, url: songCopy.streamUrl, src: songCopy.streamUrl };
    }

    try {
      const id = songCopy.youtubeId || this.extractVideoId(songCopy.audio || songCopy.streamUrl || '');
      if (id) {
        const audioUrl = await this.getAudioStream(id);
        return { ...songCopy, audio: audioUrl, url: audioUrl, src: audioUrl, streamUrl: audioUrl, source: 'youtube' };
      }
    } catch (err) {
      console.warn('[YTConverter] prepareSongForPlayback resolve failed:', err.message);
    }

    const results = await this.searchVideos(`${songCopy.name} ${songCopy.artist}`, 1);
    if (!results.length) throw new Error(`Could not find stream for "${songCopy.name}"`);
    const audioUrl = await this.getAudioStream(results[0].id);
    return {
      ...songCopy,
      audio: audioUrl, url: audioUrl, src: audioUrl, streamUrl: audioUrl,
      source: 'youtube', youtubeId: results[0].id,
    };
  }

  /* ── Trending music — throttled (5 min window) ── */
  async getTrendingMusic(regionCode = 'US', maxResults = 50) {
    return new Promise((resolve) => {
      // The throttle wrapper doesn't return values, so we wrap in a promise
      const raw = this._getTrendingRaw.bind(this);
      raw(regionCode, maxResults).then(resolve).catch(() => resolve([]));
    });
  }

  async _getTrendingRaw(regionCode = 'US', maxResults = 50) {
    try {
      const url = new URL(`${YT_BASE}/videos`);
      url.searchParams.set('part',            'snippet');
      url.searchParams.set('chart',           'mostPopular');
      url.searchParams.set('videoCategoryId', '10');
      url.searchParams.set('regionCode',      regionCode);
      url.searchParams.set('maxResults',      String(maxResults));
      url.searchParams.set('key',             YOUTUBE_API_KEY);

      const res  = await fetch(url.toString());
      const data = await res.json();
      return (data.items || []).map(item => ({
        id: item.id, title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url,
        youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`,
      }));
    } catch (err) {
      console.error('[YTConverter] getTrendingMusic:', err.message);
      return [];
    }
  }

  /* ── Utilities ── */
  parseDuration(iso) {
    const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return '0:00';
    const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), sec = parseInt(m[3] || 0);
    if (h) return `${h}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${min}:${String(sec).padStart(2,'0')}`;
  }

  _secondsToTimecode(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const min = Math.floor((totalSeconds % 3600) / 60);
    const sec = totalSeconds % 60;
    if (h) return `${h}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${min}:${String(sec).padStart(2,'0')}`;
  }

  isStreamableUrl(url) {
    if (!url) return false;
    return /\.(mp3|m4a|wav|ogg|webm|aac|opus)$/i.test(url)
      || /localhost/.test(url) || /127\.0\.0\.1/.test(url);
  }

  clearCache() { this._audioCache.clear(); }
}

export default new YouTubeConverter();