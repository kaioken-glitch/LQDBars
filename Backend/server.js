import express      from 'express';
import cors         from 'cors';
import bodyParser   from 'body-parser';
import sqlite3      from 'sqlite3';
import { open }     from 'sqlite';
import path         from 'path';
import { fileURLToPath } from 'url';
import dotenv       from 'dotenv';
import recommendationsRouter from './recommendationsRouter.js';
import youtubeSearchRouter   from './youtubeSearchRouter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

/* ── Routers ── */
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/youtube',         youtubeSearchRouter);   // search, trending, details

/* ── Static files ── */
app.use('/audio',  express.static(path.join(__dirname, '../Frontend/audio')));
app.use('/images', express.static(path.join(__dirname, '../Frontend/images')));

/* ── SQLite setup ── */
let db;
(async () => {
  db = await open({
    filename: './db.sqlite',
    driver:   sqlite3.Database,
  });

  await db.run(`CREATE TABLE IF NOT EXISTS songs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT,
    artist     TEXT,
    album      TEXT,
    cover      TEXT,
    audio      TEXT,
    genre      TEXT,
    duration   TEXT,
    downloaded INTEGER DEFAULT 0,
    like       INTEGER DEFAULT 0,
    dislike    INTEGER DEFAULT 0,
    favorite   INTEGER DEFAULT 0,
    liked      INTEGER DEFAULT 0
  )`);

  /* resolved_urls — skip yt-dlp on repeat plays */
  await db.run(`CREATE TABLE IF NOT EXISTS resolved_urls (
    youtube_id   TEXT PRIMARY KEY,
    audio_url    TEXT NOT NULL,
    title        TEXT,
    resolved_at  INTEGER NOT NULL
  )`);

  /* Migration: add liked column if missing */
  try {
    await db.run('ALTER TABLE songs ADD COLUMN liked INTEGER DEFAULT 0');
    console.log('Added liked column to songs table');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Migration error:', err.message);
    }
  }

  console.log('SQLite database ready ✅');
})();

/* ── Songs routes (unchanged) ── */

app.get('/songs', async (req, res) => {
  const songs = await db.all('SELECT * FROM songs');
  res.json(songs);
});

app.get('/songs/:id', async (req, res) => {
  const song = await db.get('SELECT * FROM songs WHERE id = ?', req.params.id);
  if (!song) return res.status(404).json({ error: 'Not found' });
  res.json(song);
});

app.post('/songs', async (req, res) => {
  const { name, artist, album, cover, audio, genre, duration, downloaded } = req.body;
  const result = await db.run(
    'INSERT INTO songs (name, artist, album, cover, audio, genre, duration, downloaded) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, artist, album, cover, audio, genre, duration, downloaded ? 1 : 0]
  );
  const song = await db.get('SELECT * FROM songs WHERE id = ?', result.lastID);
  res.status(201).json(song);
});

app.patch('/songs/:id', async (req, res) => {
  const fields = Object.keys(req.body);
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  const sets   = fields.map(f => `${f} = ?`).join(', ');
  const values = [...fields.map(f => req.body[f]), req.params.id];
  await db.run(`UPDATE songs SET ${sets} WHERE id = ?`, values);
  const song = await db.get('SELECT * FROM songs WHERE id = ?', req.params.id);
  res.json(song);
});

app.delete('/songs/:id', async (req, res) => {
  await db.run('DELETE FROM songs WHERE id = ?', req.params.id);
  res.status(204).end();
});

/* ── Resolved URL cache routes ──
   youtube-converter.js writes here after yt-dlp resolves a URL.
   Next play checks here first — cache hit = instant playback, no yt-dlp wait.
── */
const CACHE_TTL_MS = 5 * 60 * 60 * 1000; // 5h (YouTube CDN URLs expire ~6h)

app.get('/cache/:youtubeId', async (req, res) => {
  const row = await db.get(
    'SELECT * FROM resolved_urls WHERE youtube_id = ?',
    req.params.youtubeId
  );
  if (!row) return res.status(404).json({ cached: false });

  if (Date.now() - row.resolved_at > CACHE_TTL_MS) {
    await db.run('DELETE FROM resolved_urls WHERE youtube_id = ?', req.params.youtubeId);
    return res.status(404).json({ cached: false, reason: 'stale' });
  }

  res.json({ cached: true, audioUrl: row.audio_url, title: row.title });
});

app.post('/cache', async (req, res) => {
  const { youtubeId, audioUrl, title } = req.body;
  if (!youtubeId || !audioUrl) {
    return res.status(400).json({ error: 'youtubeId and audioUrl required' });
  }
  await db.run(
    `INSERT INTO resolved_urls (youtube_id, audio_url, title, resolved_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(youtube_id) DO UPDATE SET
       audio_url   = excluded.audio_url,
       title       = excluded.title,
       resolved_at = excluded.resolved_at`,
    [youtubeId, audioUrl, title || null, Date.now()]
  );
  res.json({ ok: true });
});

/* ── Health check ── */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`Backend running on ${
    process.env.NODE_ENV === 'production' ? 'cloud URL' : `http://localhost:${PORT}`
  }`);
});