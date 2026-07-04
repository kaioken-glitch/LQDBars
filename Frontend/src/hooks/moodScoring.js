/**
 * moodScoring.js
 *
 * Score(u, s, t) = Alpha * (User_Vector • Song_Vector)
 *                + Beta  * Exp(-(Time_Distance)^2 / (2*Sigma^2)) * (1 - Repetition_Penalty)
 *                + Gamma * Diversity_Score
 *
 * Pure content/behavior scoring — no graph required, so it works from
 * a user's very first mood mix (cold-start safe). This is a rerank pass
 * over the candidate pool useMoodPlaylist.js already builds from
 * YouTube search; it doesn't touch resolution or playback.
 */

import { supabase } from '../lib/supabase';

const WEIGHTS = { alpha: 0.5, beta: 0.3, gamma: 0.2 };
const SIGMA_HOURS = 6;                          // recency kernel width
const RECENT_PLAY_LIMIT = 200;

/* ── text → sparse word-frequency vector ─────────────────────────── */
function textToVector(text = '') {
  const vec = {};
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .forEach(word => { vec[word] = (vec[word] || 0) + 1; });
  return vec;
}

function mergeVectors(vectors) {
  const merged = {};
  vectors.forEach(v => {
    Object.entries(v).forEach(([k, val]) => { merged[k] = (merged[k] || 0) + val; });
  });
  return merged;
}

function cosineSim(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  keys.forEach(k => {
    const va = a[k] || 0, vb = b[k] || 0;
    dot += va * vb; magA += va * va; magB += vb * vb;
  });
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/* ── User_Vector — from mood seeds (recent history rows) ─────────── */
export function buildUserVector(seeds = []) {
  const vectors = seeds
    .filter(s => s.name || s.artist || s.genre)
    .map(s => textToVector(`${s.artist || ''} ${s.genre || ''} ${s.name || ''}`));
  if (!vectors.length) return {};
  return mergeVectors(vectors);
}

/* ── Song_Vector — from a candidate track's title/artist ─────────── */
export function buildSongVector(candidate) {
  return textToVector(`${candidate.artist || candidate.channel || ''} ${candidate.title || candidate.name || ''}`);
}

/* ── Recent plays — recency + repetition inputs ───────────────────
   Map<youtubeId, { lastPlayedMs, playCount }>
   Anonymous users fall back to localStorage 'player:history'
   (same source useMoodPlaylist.js already reads for seeds).
─────────────────────────────────────────────────────────────── */
export async function getRecentPlayMap(userId) {
  const map = new Map();

  if (!userId) {
    try {
      const raw = localStorage.getItem('player:history');
      const parsed = raw ? JSON.parse(raw) : [];
      (Array.isArray(parsed) ? parsed : []).forEach(item => {
        const ytId = item.youtubeId || (item.id || '').replace(/^yt_/, '');
        if (!ytId) return;
        const playedAt = item.playedAt ? new Date(item.playedAt).getTime() : Date.now();
        const existing = map.get(ytId);
        map.set(ytId, {
          lastPlayedMs: existing ? Math.max(existing.lastPlayedMs, playedAt) : playedAt,
          playCount: (existing?.playCount || 0) + (item.playCount || 1),
        });
      });
    } catch { /* noop */ }
    return map;
  }

  try {
    const { data, error } = await supabase
      .from('listening_history')
      .select('youtube_id, played_at')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(RECENT_PLAY_LIMIT);
    if (error) throw error;
    (data || []).forEach(row => {
      if (!row.youtube_id) return;
      const playedAt = new Date(row.played_at).getTime();
      const existing = map.get(row.youtube_id);
      map.set(row.youtube_id, {
        lastPlayedMs: existing ? Math.max(existing.lastPlayedMs, playedAt) : playedAt,
        playCount: (existing?.playCount || 0) + 1,
      });
    });
  } catch (err) {
    console.warn('[moodScoring] recent play lookup failed', err);
  }
  return map;
}

/* ── Term 1: content affinity ─────────────────────────────────────── */
function contentScore(userVec, songVec) {
  return cosineSim(userVec, songVec);
}

/* ── Term 2: freshness — Gaussian recency decay * (1 - repetition) ──
   Never-played songs score max freshness (1). Recently/often-played
   songs get pushed down so the mix doesn't repeat itself.
─────────────────────────────────────────────────────────────── */
function freshnessScore(youtubeId, recentPlayMap) {
  const entry = recentPlayMap.get(youtubeId);
  if (!entry) return 1;
  const hoursSince = (Date.now() - entry.lastPlayedMs) / (1000 * 60 * 60);
  const gaussian = Math.exp(-(hoursSince ** 2) / (2 * SIGMA_HOURS ** 2));
  const recencyFreshness = 1 - gaussian;                          // far in past → ~1
  const repetitionPenalty = Math.min(1, (entry.playCount || 0) / 5);
  return recencyFreshness * (1 - repetitionPenalty);
}

/* ── Term 3: diversity vs. what's already been picked ─────────────── */
function diversityScore(songVec, chosenVectors) {
  if (!chosenVectors.length) return 1;
  const maxSim = Math.max(...chosenVectors.map(v => cosineSim(songVec, v)));
  return 1 - maxSim;
}

function scoreCandidate(candidate, userVec, recentPlayMap, chosenVectors, weights) {
  const songVec = buildSongVector(candidate);
  const a = contentScore(userVec, songVec);
  const b = freshnessScore(candidate.youtubeId, recentPlayMap);
  const g = diversityScore(songVec, chosenVectors);
  return { score: weights.alpha * a + weights.beta * b + weights.gamma * g, songVec };
}

/* ── Rerank — greedy MMR-style selection ──────────────────────────
   Picks the best-scoring candidate one at a time, recomputing
   diversity against everything already chosen. `seeds` = the user's
   mood-seed tracks (from getHistorySeeds); `candidates` = the raw
   pool gathered from YouTube search, BEFORE trimming to `limit`.
─────────────────────────────────────────────────────────────── */
export async function rerankCandidates(candidates, seeds, userId, limit, weights = WEIGHTS) {
  if (!candidates.length) return candidates;

  const userVec = buildUserVector(seeds);
  const recentPlayMap = await getRecentPlayMap(userId);

  const pool = candidates.map(c => ({ candidate: c }));
  const chosen = [];
  const chosenVectors = [];

  while (chosen.length < Math.min(limit, pool.length)) {
    let bestIdx = -1, bestScore = -Infinity, bestVec = null;

    pool.forEach((entry, idx) => {
      if (entry.picked) return;
      const { score, songVec } = scoreCandidate(entry.candidate, userVec, recentPlayMap, chosenVectors, weights);
      if (score > bestScore) { bestScore = score; bestIdx = idx; bestVec = songVec; }
    });

    if (bestIdx === -1) break;
    pool[bestIdx].picked = true;
    chosen.push(pool[bestIdx].candidate);
    chosenVectors.push(bestVec);
  }

  return chosen;
}