/**
 * youtube-converter.js  (Backend)
 *
 * YouTube audio service with three-tier fallback:
 *
 *   Tier 1: @distube/ytdl-core  (fast, in-process, may fail on some videos)
 *   Tier 2: yt-dlp binary       (most reliable, updated daily, handles bot detection)
 *   Tier 3: ytdl with cookies   (uses exported browser cookies to bypass auth walls)
 *
 * WHY THE ERROR HAPPENS:
 *   YouTube regularly rotates its player JS and signatures. When ytdl-core's
 *   extractor is stale it throws "Failed to find any playable formats" or
 *   "Sign in to confirm your age". yt-dlp is maintained daily and almost
 *   always works. We try ytdl first (fast/no binary needed), fall back to
 *   yt-dlp if it fails.
 *
 * SETUP:
 *   1. Install yt-dlp:
 *      - Mac:    brew install yt-dlp
 *      - Linux:  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp
 *      - Win:    winget install yt-dlp  (or download .exe from GitHub releases)
 *   2. npm install  (in Backend/)
 *   3. node youtube-converter.js
 *
 * ENV vars (root .env):
 *   CONVERTER_PORT   default 3001
 *   AUDIO_DIR        default ./temp_audio
 *   FRONTEND_URL     default http://localhost:5173
 *   YTDLP_PATH       default "yt-dlp" (full path if not in PATH, e.g. /usr/local/bin/yt-dlp)
 *   COOKIES_FILE     optional — path to cookies.txt in Netscape format for age-gated videos
 */

import express           from 'express';
import cors              from 'cors';
import ytdl              from '@distube/ytdl-core';
import path              from 'path';
import fs                from 'fs';
import { spawn }         from 'child_process';
import { fileURLToPath } from 'url';
import { dirname }       from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

/* ─── Config ──────────────────────────────────────────────────────────────── */
const PORT         = parseInt(process.env.CONVERTER_PORT || '3001', 10);
const AUDIO_DIR    = process.env.AUDIO_DIR               || path.join(__dirname, 'temp_audio');
const FRONTEND_URL = process.env.FRONTEND_URL            || 'http://localhost:5173';
const YTDLP_PATH   = process.env.YTDLP_PATH              || 'yt-dlp';
const COOKIES_FILE = process.env.COOKIES_FILE            || null;

fs.mkdirSync(AUDIO_DIR, { recursive: true });

/* ─── Express ─────────────────────────────────────────────────────────────── */
const app = express();
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'HEAD', 'OPTIONS'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}));
app.use(express.json());

// Serve audio files with range support (needed for <audio> seeking)
app.use('/audio', (req, res, next) => {
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static(AUDIO_DIR, { dotfiles: 'deny' }));

/* ─── In-flight dedup ─────────────────────────────────────────────────────── */
const inFlight = new Map();

/* ═══════════════════════════════════════════════════════════════════════════
   TIER 1: @distube/ytdl-core
═══════════════════════════════════════════════════════════════════════════ */
function downloadWithYtdl(videoId, audioPath) {
  return new Promise((resolve, reject) => {
    const tmpPath = `${audioPath}.tmp`;

    ytdl.getInfo(videoId)
      .then(info => {
        const stream = ytdl(videoId, { quality: 'highestaudio', filter: 'audioonly' });
        const writer = fs.createWriteStream(tmpPath);
        stream.pipe(writer);

        stream.on('progress', (_, dl, total) => {
          if (total > 0) process.stdout.write(`\r[ytdl] ${videoId} ${Math.round(dl/total*100)}%  `);
        });

        writer.on('finish', () => {
          process.stdout.write('\n');
          try { fs.renameSync(tmpPath, audioPath); } catch (e) { return reject(e); }
          resolve({ title: info.videoDetails.title, duration: info.videoDetails.lengthSeconds });
        });

        const onErr = (e) => { try { fs.unlinkSync(tmpPath); } catch (_) {} reject(e); };
        writer.on('error', onErr);
        stream.on('error', onErr);
      })
      .catch(reject);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIER 2: yt-dlp binary
   Outputs a single .webm or .opus — we normalise to .webm filename.
═══════════════════════════════════════════════════════════════════════════ */
function downloadWithYtdlp(videoId, audioPath) {
  return new Promise((resolve, reject) => {
    const tmpTemplate = `${audioPath}.tmp.%(ext)s`;

    const args = [
      `https://www.youtube.com/watch?v=${videoId}`,
      '-x',
      '--audio-format', 'webm',
      '--audio-quality', '0',
      '--no-playlist',
      '--no-warnings',
      '--no-progress',
      '--print', 'after_move:filepath',
      '-o', tmpTemplate,
    ];

    if (COOKIES_FILE && fs.existsSync(COOKIES_FILE)) {
      args.push('--cookies', COOKIES_FILE);
    }

    args.push('--extractor-args', 'youtube:player_client=web');

    console.log(`[yt-dlp] starting: ${videoId}`);
    const proc = spawn(YTDLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('error', (e) => {
      if (e.code === 'ENOENT') {
        reject(new Error(
          `yt-dlp not found at "${YTDLP_PATH}". ` +
          `Install: brew install yt-dlp  (Mac) or  ` +
          `sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp  (Linux)`
        ));
      } else {
        reject(e);
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        try {
          fs.readdirSync(AUDIO_DIR)
            .filter(f => f.startsWith(`${videoId}.tmp`))
            .forEach(f => fs.unlinkSync(path.join(AUDIO_DIR, f)));
        } catch (_) {}
        return reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 300)}`));
      }

      const tmpFiles = fs.readdirSync(AUDIO_DIR)
        .filter(f => f.startsWith(`${videoId}.tmp`));

      if (tmpFiles.length > 0) {
        const tmpFull = path.join(AUDIO_DIR, tmpFiles[0]);
        try { fs.renameSync(tmpFull, audioPath); } catch (e) { return reject(e); }
      } else if (!fs.existsSync(audioPath)) {
        return reject(new Error('yt-dlp finished but output file not found'));
      }

      console.log(`[yt-dlp] done: ${videoId}`);
      resolve({ title: videoId, duration: 0 });
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN convertVideo — tries Tier 1 then Tier 2
═══════════════════════════════════════════════════════════════════════════ */
function convertVideo(videoId) {
  if (inFlight.has(videoId)) {
    console.log(`[ytd] joining in-flight: ${videoId}`);
    return inFlight.get(videoId);
  }
  const promise = _convert(videoId);
  inFlight.set(videoId, promise);
  promise.finally(() => inFlight.delete(videoId));
  return promise;
}

async function _convert(videoId) {
  const audioPath = path.join(AUDIO_DIR, `${videoId}.webm`);
  const audioUrl  = `http://localhost:${PORT}/audio/${videoId}.webm`;

  // Already on disk and non-empty — serve from cache
  if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 4096) {
    console.log(`[ytd] cache hit: ${videoId}`);
    return { audioUrl, fromCache: true };
  }

  if (!ytdl.validateID(videoId)) {
    throw new Error(`Invalid YouTube video ID: ${videoId}`);
  }

  // Tier 1: ytdl-core
  try {
    console.log(`[ytd] tier1 (ytdl-core): ${videoId}`);
    const meta = await downloadWithYtdl(videoId, audioPath);
    return { audioUrl, title: meta.title, duration: meta.duration, fromCache: false };
  } catch (err) {
    console.warn(`[ytd] tier1 failed: ${err.message} — trying yt-dlp...`);
  }

  // Tier 2: yt-dlp
  try {
    console.log(`[ytd] tier2 (yt-dlp): ${videoId}`);
    const meta = await downloadWithYtdlp(videoId, audioPath);
    return { audioUrl, title: meta.title, duration: meta.duration, fromCache: false };
  } catch (err) {
    throw new Error(
      `All download methods failed for ${videoId}.\n` +
      `Last error: ${err.message}\n` +
      `Try: yt-dlp -U  to update yt-dlp`
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════════════════════ */
app.get('/health', (_req, res) => {
  const files = fs.readdirSync(AUDIO_DIR).filter(f => f.endsWith('.webm'));

  const ytdlpCheck = new Promise(resolve => {
    const p = spawn(YTDLP_PATH, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let v = '';
    p.stdout.on('data', d => v += d);
    p.on('close', code => resolve(code === 0 ? v.trim() : null));
    p.on('error', () => resolve(null));
  });

  ytdlpCheck.then(ytdlpVersion => {
    res.json({
      status:       'ok',
      port:         PORT,
      cached:       files.length,
      converting:   inFlight.size,
      ytdlpVersion: ytdlpVersion || 'not found — install yt-dlp for best results',
      audioDir:     AUDIO_DIR,
      timestamp:    Date.now(),
    });
  });
});

app.get('/api/youtube/audio/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid YouTube video ID' });
  }
  try {
    const result = await convertVideo(videoId);
    res.json({
      audioUrl:  result.audioUrl,
      title:     result.title    ?? null,
      duration:  result.duration ?? null,
      fromCache: result.fromCache,
    });
  } catch (err) {
    console.error(`[ytd] /audio/${videoId} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youtube/status/:videoId', (req, res) => {
  const { videoId } = req.params;
  const audioPath   = path.join(AUDIO_DIR, `${videoId}.webm`);
  const ready       = fs.existsSync(audioPath) && fs.statSync(audioPath).size > 4096;
  res.json({
    ready,
    converting: inFlight.has(videoId),
    audioUrl:   ready ? `http://localhost:${PORT}/audio/${videoId}.webm` : null,
  });
});

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

/* ─── Cleanup: remove cached files older than 24h ────────────────────────── */
function cleanup() {
  const maxAge = 24 * 60 * 60 * 1000;
  const now    = Date.now();
  try {
    let n = 0;
    for (const f of fs.readdirSync(AUDIO_DIR)) {
      if (f.endsWith('.tmp')) continue;
      const fp = path.join(AUDIO_DIR, f);
      if (now - fs.statSync(fp).mtimeMs > maxAge) { fs.unlinkSync(fp); n++; }
    }
    if (n) console.log(`[ytd] cleanup: removed ${n} file(s)`);
  } catch (e) { console.error('[ytd] cleanup error:', e.message); }
}
setInterval(cleanup, 60 * 60 * 1000);

/* ─── Start ───────────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n┌──────────────────────────────────────────────┐`);
  console.log(`│  🎵 YouTube Audio Converter  :${PORT}             │`);
  console.log(`│  Tier 1: @distube/ytdl-core                  │`);
  console.log(`│  Tier 2: yt-dlp                              │`);
  console.log(`│  Cache:  ${AUDIO_DIR.slice(-34).padEnd(34)}  │`);
  console.log(`└──────────────────────────────────────────────┘\n`);

  const p = spawn(YTDLP_PATH, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
  let v = '';
  p.stdout.on('data', d => v += d);
  p.on('close', code => {
    if (code === 0) console.log(`  ✓ yt-dlp ${v.trim()} found`);
    else console.warn(`  ⚠  yt-dlp not found — ytdl-core only (some videos may fail)`);
  });
  p.on('error', () => console.warn(`  ⚠  yt-dlp not found — install: brew install yt-dlp`));
});

export default app;