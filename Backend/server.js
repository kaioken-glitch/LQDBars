import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000; // Use cloud port if provided

app.use(cors());
app.use(bodyParser.json());

// Serve static audio files
app.use('/audio', express.static(path.join(__dirname, '../Frontend/audio')));
app.use('/images', express.static(path.join(__dirname, '../Frontend/images')));

// SQLite DB setup
let db;
(async () => {
  db = await open({
    filename: './db.sqlite',
    driver: sqlite3.Database
  });

  // Create songs table
  await db.run(`CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    artist TEXT,
    album TEXT,
    cover TEXT,
    audio TEXT,
    genre TEXT,
    duration TEXT,
    downloaded INTEGER DEFAULT 0,
    like INTEGER DEFAULT 0,
    dislike INTEGER DEFAULT 0,
    favorite INTEGER DEFAULT 0,
    liked INTEGER DEFAULT 0
  )`);

  // Migration: add liked column if not exists
  try {
    await db.run('ALTER TABLE songs ADD COLUMN liked INTEGER DEFAULT 0');
    console.log('Added liked column to songs table');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Error adding liked column:', err.message);
    }
  }

  console.log('SQLite database ready ✅');
})();

// Routes

// Get all songs
app.get('/songs', async (req, res) => {
  const songs = await db.all('SELECT * FROM songs');
  res.json(songs);
});

// Get single song
app.get('/songs/:id', async (req, res) => {
  const song = await db.get('SELECT * FROM songs WHERE id = ?', req.params.id);
  if (!song) return res.status(404).json({ error: 'Not found' });
  res.json(song);
});

// Add new song
app.post('/songs', async (req, res) => {
  const { name, artist, album, cover, audio, genre, duration, downloaded } = req.body;
  const result = await db.run(
    'INSERT INTO songs (name, artist, album, cover, audio, genre, duration, downloaded) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, artist, album, cover, audio, genre, duration, downloaded ? 1 : 0]
  );
  const song = await db.get('SELECT * FROM songs WHERE id = ?', result.lastID);
  res.status(201).json(song);
});

// Update a song
app.patch('/songs/:id', async (req, res) => {
  const fields = Object.keys(req.body);
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => req.body[f]);
  values.push(req.params.id);
  await db.run(`UPDATE songs SET ${sets} WHERE id = ?`, values);
  const song = await db.get('SELECT * FROM songs WHERE id = ?', req.params.id);
  res.json(song);
});

// Delete a song
app.delete('/songs/:id', async (req, res) => {
  await db.run('DELETE FROM songs WHERE id = ?', req.params.id);
  res.status(204).end();
});

// Optional: health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on ${process.env.NODE_ENV === 'production' ? 'cloud URL' : 'http://localhost:' + PORT}`);
});
