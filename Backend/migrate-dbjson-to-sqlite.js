// Script to migrate db.json songs to SQLite
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

(async () => {
  const dbjson = JSON.parse(fs.readFileSync('../Frontend/db.json', 'utf-8'));
  const songs = dbjson.songs || dbjson || [];
  const db = await open({ filename: './db.sqlite', driver: sqlite3.Database });
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
    favorite INTEGER DEFAULT 0
  )`);
  for (const song of songs) {
    // Upsert by name+artist+album
    const exists = await db.get('SELECT id FROM songs WHERE name = ? AND artist = ? AND album = ?', [song.name, song.artist, song.album]);
    if (!exists) {
      await db.run(
        'INSERT INTO songs (name, artist, album, cover, audio, genre, duration, downloaded, like, dislike, favorite) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          song.name,
          song.artist,
          song.album,
          song.cover,
          song.audio,
          song.genre,
          song.duration,
          song.downloaded ? 1 : 0,
          song.like ? 1 : 0,
          song.dislike ? 1 : 0,
          song.favorite ? 1 : 0
        ]
      );
    }
  }
  console.log('Migration complete.');
  await db.close();
})();
