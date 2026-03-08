/**
 * useLyrics.js
 *
 * Fetches synced (LRC) lyrics from LRCLIB for the currently playing song.
 * Falls back to plain lyrics if no synced version exists.
 *
 * Returns:
 *   lines        — parsed array of { time: number (secs), text: string }
 *   plainLyrics  — raw string fallback (no timestamps)
 *   activeLine   — index of the currently singing line
 *   status       — 'idle' | 'loading' | 'found' | 'plain' | 'not_found' | 'error'
 */

import { useState, useEffect, useRef } from 'react';

const LRCLIB_BASE = 'https://lrclib.net/api';
const UA          = 'LiquidBars/1.0 (https://github.com/your-repo)';

// ── LRC parser ────────────────────────────────────────────────────────────────
// Turns "[01:23.45] Some lyric line" into { time: 83.45, text: "Some lyric line" }
function parseLrc(lrc) {
  if (!lrc) return [];
  const lines = [];
  for (const raw of lrc.split('\n')) {
    const match = raw.match(/^\[(\d{1,2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (!match) continue;
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const ms   = parseInt(match[3].padEnd(3, '0'), 10); // normalise 2 or 3 digit ms
    const text = match[4].trim();
    if (!text) continue; // skip blank timing markers
    lines.push({ time: mins * 60 + secs + ms / 1000, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

// ── Cache: "artist||title" → result (lives for the session) ──────────────────
const lyricsCache = new Map();

async function fetchLyrics(artist, title, album) {
  const key = `${artist}||${title}`.toLowerCase();
  if (lyricsCache.has(key)) return lyricsCache.get(key);

  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  if (album) params.set('album_name', album);

  const res = await fetch(`${LRCLIB_BASE}/get?${params}`, {
    headers: { 'Lrclib-Client': UA },
  });

  if (res.status === 404) {
    lyricsCache.set(key, null);
    return null;
  }
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`);

  const data = await res.json();
  lyricsCache.set(key, data);
  return data;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useLyrics(currentSong, currentTime) {
  const [lines,       setLines]       = useState([]);
  const [plainLyrics, setPlainLyrics] = useState('');
  const [activeLine,  setActiveLine]  = useState(-1);
  const [status,      setStatus]      = useState('idle');
  const lastSongId = useRef(null);

  // Fetch when song changes
  useEffect(() => {
    const songId = currentSong?.id;
    if (!songId || !currentSong?.name) {
      setLines([]); setPlainLyrics(''); setActiveLine(-1); setStatus('idle');
      return;
    }
    if (songId === lastSongId.current) return; // same song, no re-fetch
    lastSongId.current = songId;

    setLines([]); setPlainLyrics(''); setActiveLine(-1); setStatus('loading');

    fetchLyrics(
      currentSong.artist || '',
      currentSong.name,
      currentSong.album  || '',
    )
      .then(data => {
        if (!data) { setStatus('not_found'); return; }

        if (data.syncedLyrics) {
          setLines(parseLrc(data.syncedLyrics));
          setStatus('found');
        } else if (data.plainLyrics) {
          setPlainLyrics(data.plainLyrics);
          setStatus('plain');
        } else {
          setStatus('not_found');
        }
      })
      .catch(() => setStatus('error'));
  }, [currentSong?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track active line as time progresses
  useEffect(() => {
    if (!lines.length) return;
    // Find the last line whose timestamp is <= currentTime
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime) idx = i;
      else break;
    }
    setActiveLine(idx);
  }, [currentTime, lines]);

  return { lines, plainLyrics, activeLine, status };
}