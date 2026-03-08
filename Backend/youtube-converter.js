/**
 * youtube-converter.js  (Backend)
 *
 * Strategy: resolve a direct CDN stream URL (~1-2s) and return it immediately.
 * No full file download, no 45-second wait.
 * The frontend <audio> element streams directly from YouTube's CDN.
 *
 * Tier 1: @distube/ytdl-core  getInfo() → pick best audioonly format URL  (~0.5s)
 * Tier 2: yt-dlp --get-url                                                 (~1-2s)
 *
 * URLs cached in-memory for 4 hours (YouTube CDN URLs expire ~6h).
 * Cache hit = response in <5ms.
 *
 * SETUP:
 *   npm install            (in Backend/)
 *   brew install yt-dlp    (Mac)
 *   yt-dlp -U              (update existing install)
 *
 * ENV:
 *   CONVERTER_PORT   default 3001
 *   FRONTEND_URL     default http://localhost:5173
 *   YTDLP_PATH       default "yt-dlp"
 *   COOKIES_FILE     optional — Netscape cookies.txt for age-gated videos
 */

import express           from 'express';
import cors              from 'cors';
import ytdl              from '@distube/ytdl-core';
import { spawn }         from 'child_process';
import { fileURLToPath } from 'url';
import { dirname }       from 'path';
import fs                from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const PORT         = parseInt(process.env.CONVERTER_PORT || '3001', 10);
const FRONTEND_URL = process.env.FRONTEND_URL            || 'http://localhost:5173';
const YTDLP_PATH   = process.env.YTDLP_PATH              || 'yt-dlp';
const COOKIES_FILE = process.env.COOKIES_FILE            || null;

/* ─── In-memory URL cache ─────────────────────────────────────────────────── */
// videoId → { url, title, expires }
const urlCache  = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4h — YouTube CDN URLs expire ~6h

function getCached(videoId) {
  const entry = urlCache.get(videoId);
  if (entry && entry.expires > Date.now()) return entry;
  urlCache.delete(videoId);
  return null;
}

function setCache(videoId, url, title = '') {
  urlCache.set(videoId, { url, title, expires: Date.now() + CACHE_TTL });
}

/* ─── In-flight dedup ─────────────────────────────────────────────────────── */
const inFlight = new Map();

/* ─── Express ─────────────────────────────────────────────────────────────── */
const app = express();
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
    ];
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'HEAD', 'OPTIONS'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}));
app.use(express.json());

/* ═══════════════════════════════════════════════════════════════════════════
   TIER 1 — @distube/ytdl-core
   Calls getInfo() to get the direct CDN audio URL — no download, ~0.5s.
═══════════════════════════════════════════════════════════════════════════ */
async function getUrlWithYtdl(videoId) {
  const info    = await ytdl.getInfo(videoId);
  const formats = ytdl.filterFormats(info.formats, 'audioonly');
  // Highest bitrate first
  const best    = formats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
  if (!best?.url) throw new Error('ytdl-core: no audioonly format found');
  return { url: best.url, title: info.videoDetails.title };
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIER 2 — yt-dlp --get-url
   Prints the direct CDN URL to stdout, ~1-2s. Handles bot detection and
   signature rotation that breaks ytdl-core.
   NOTE: --get-url does NOT download anything — it only resolves the URL.
═══════════════════════════════════════════════════════════════════════════ */
function getUrlWithYtdlp(videoId) {
  return new Promise((resolve, reject) => {
    const args = [
      `https://www.youtube.com/watch?v=${videoId}`,
      '--get-url',
      '-f', 'bestaudio',
      '--no-playlist',
      '--no-warnings',
    ];

    if (COOKIES_FILE && fs.existsSync(COOKIES_FILE)) {
      args.push('--cookies', COOKIES_FILE);
    }

    const proc = spawn(YTDLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('error', e => {
      if (e.code === 'ENOENT') {
        reject(new Error(
          `yt-dlp not found at "${YTDLP_PATH}". ` +
          `Install: brew install yt-dlp  OR  yt-dlp -U to update`
        ));
      } else {
        reject(e);
      }
    });

    proc.on('close', code => {
      const url = stdout.trim().split('\n')[0];
      if (code !== 0 || !url) {
        return reject(new Error(`yt-dlp failed (exit ${code}): ${stderr.slice(0, 300)}`));
      }
      resolve({ url, title: videoId });
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN — getStreamUrl
   Tries Tier 1 then Tier 2. Caches result. Deduplicates concurrent requests.
═══════════════════════════════════════════════════════════════════════════ */
function getStreamUrl(videoId) {
  const cached = getCached(videoId);
  if (cached) {
    console.log(`[ytd] cache hit: ${videoId}`);
    return Promise.resolve({ ...cached, fromCache: true });
  }

  if (inFlight.has(videoId)) {
    console.log(`[ytd] joining in-flight: ${videoId}`);
    return inFlight.get(videoId);
  }

  const promise = _getStreamUrl(videoId);
  inFlight.set(videoId, promise);
  promise.finally(() => inFlight.delete(videoId));
  return promise;
}

async function _getStreamUrl(videoId) {
  if (!ytdl.validateID(videoId)) throw new Error(`Invalid YouTube video ID: ${videoId}`);

  // Tier 1
  try {
    console.log(`[ytd] tier1 (ytdl-core): ${videoId}`);
    const result = await getUrlWithYtdl(videoId);
    setCache(videoId, result.url, result.title);
    console.log(`[ytd] tier1 ok: ${videoId}`);
    return { url: result.url, title: result.title, fromCache: false };
  } catch (err) {
    console.warn(`[ytd] tier1 failed: ${err.message} — trying yt-dlp...`);
  }

  // Tier 2
  try {
    console.log(`[ytd] tier2 (yt-dlp --get-url): ${videoId}`);
    const result = await getUrlWithYtdlp(videoId);
    setCache(videoId, result.url, result.title);
    console.log(`[ytd] tier2 ok: ${videoId}`);
    return { url: result.url, title: result.title, fromCache: false };
  } catch (err) {
    throw new Error(`All methods failed for ${videoId}. Last error: ${err.message}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════════════════════ */

// Main — resolve and return a direct CDN stream URL
app.get('/api/youtube/audio/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid YouTube video ID' });
  }
  try {
    const result = await getStreamUrl(videoId);
    res.json({
      audioUrl:  result.url,
      title:     result.title   ?? null,
      fromCache: result.fromCache,
    });
  } catch (err) {
    console.error(`[ytd] /audio/${videoId} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Preload — warm the cache for the next track while the current one plays
app.get('/api/youtube/preload/:videoId', (req, res) => {
  const { videoId } = req.params;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).end();
  const alreadyCached = !!getCached(videoId);
  res.status(202).json({ queued: !alreadyCached, cached: alreadyCached });
  if (!alreadyCached) {
    getStreamUrl(videoId).catch(err =>
      console.warn(`[preload] failed for ${videoId}:`, err.message)
    );
  }
});

// Status — is this video URL already resolved?
app.get('/api/youtube/status/:videoId', (req, res) => {
  const { videoId } = req.params;
  const cached      = getCached(videoId);
  res.json({
    ready:      !!cached,
    converting: inFlight.has(videoId),
    audioUrl:   cached?.url ?? null,
  });
});

// Info — video metadata only (no audio resolution)
app.get('/api/youtube/info/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });
  try {
    const info = await ytdl.getInfo(videoId);
    res.json({
      id:        videoId,
      title:     info.videoDetails.title,
      author:    info.videoDetails.author?.name ?? 'Unknown',
      duration:  info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails?.at(-1)?.url ?? null,
      viewCount: info.videoDetails.viewCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (_req, res) => {
  const ytdlpCheck = new Promise(resolve => {
    const p = spawn(YTDLP_PATH, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let v = '';
    p.stdout.on('data', d => v += d);
    p.on('close', code => resolve(code === 0 ? v.trim() : null));
    p.on('error', () => resolve(null));
  });
  ytdlpCheck.then(ver => res.json({
    status:    'ok',
    port:      PORT,
    cached:    urlCache.size,
    inFlight:  inFlight.size,
    yt_dlp:    ver || 'not found — install with: brew install yt-dlp',
    timestamp: Date.now(),
  }));
});

/* ─── Start ───────────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n┌──────────────────────────────────────────────┐`);
  console.log(`│  🎵 YouTube Stream Server  :${PORT}               │`);
  console.log(`│  Mode: URL extraction (no download, ~1-2s)   │`);
  console.log(`│  Tier 1: @distube/ytdl-core                  │`);
  console.log(`│  Tier 2: yt-dlp --get-url                    │`);
  console.log(`└──────────────────────────────────────────────┘\n`);

  const p = spawn(YTDLP_PATH, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
  let v = '';
  p.stdout.on('data', d => v += d);
  p.on('close', code => {
    if (code === 0) console.log(`  ✓ yt-dlp ${v.trim()} found`);
    else            console.warn(`  ⚠  yt-dlp not found — tier 2 unavailable. Run: brew install yt-dlp`);
  });
  p.on('error', () => console.warn(`  ⚠  yt-dlp not found. Run: brew install yt-dlp`));
});

export default app;