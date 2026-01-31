-- SQL to initialize the songs table (run automatically by server.js)
CREATE TABLE IF NOT EXISTS songs (
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
);
