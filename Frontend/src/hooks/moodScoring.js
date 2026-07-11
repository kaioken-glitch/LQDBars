/**
 * moodScoring.js
 *
 * Score(u, s, t) = Alpha * (User_Vector • Song_Vector)
 *                + Beta  * Exp(-(Time_Distance)^2 / (2*Sigma^2)) * (1 - Repetition_Penalty)
 *                + Gamma * Diversity_Score
 *
 * Pure content/behavior scoring — no graph required, so it works from
 * a user's very first mood mix (cold-start safe). This is a rerank pass
 * over the candidate pool useMoodPlaylist.js builds (primarily from
 * YouTube Mix playlists now, plus a mood-prompt search); it doesn't
 * touch resolution or playback.
 *
 * moodPrompt (the daypart's flavor text, e.g. "bright upbeat tracks warm
 * acoustic mellow hip-hop optimistic") now feeds into User_Vector at a
 * lighter weight than real listening history, and genre is now an
 * explicit term in Diversity_Score rather than only entering indirectly
 * through text-cosine similarity.
 */

import { supabase } from '../lib/supabase';

const WEIGHTS = { alpha: 0.5, beta: 0.3, gamma: 0.2 };
const SIGMA_HOURS = 6;                          // recency kernel width
const RECENT_PLAY_LIMIT = 200;

// How much the daypart mood prompt counts toward User_Vector, relative
// to real listening history (weight 1). Kept deliberately light — the
// prompt is a *flavor* nudge, not a replacement for actual taste signal.
const MOOD_PROMPT_WEIGHT = 0.35;

// Blend between the existing text-cosine diversity term and the new
// explicit genre-repetition term inside Diversity_Score.
const TEXT_DIVERSITY_WEIGHT  = 0.6;
const GENRE_DIVERSITY_WEIGHT = 0.4;

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

function scaleVector(vec, factor) {
  const out = {};
  Object.entries(vec).forEach(([k, v]) => { out[k] = v * factor; });
  return out;
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

/**
 * User_Vector — from mood seeds (recent history rows), optionally
 * blended with the daypart's mood prompt text at MOOD_PROMPT_WEIGHT.
 * Called with just `seeds` behaves exactly as before (moodPrompt
 * defaults to '', contributing nothing) — existing callers unaffected.
 */
export function buildUserVector(seeds = [], moodPrompt = '') {
  const historyVectors = seeds
    .filter(s => s.name || s.artist || s.genre)
    .map(s => textToVector(`${s.artist || ''} ${s.genre || ''} ${s.name || ''}`));

  const historyVec = historyVectors.length ? mergeVectors(historyVectors) : {};

  if (!moodPrompt || !moodPrompt.trim()) return historyVec;

  const promptVec = scaleVector(textToVector(moodPrompt), MOOD_PROMPT_WEIGHT);
  return mergeVectors([historyVec, promptVec]);
}

/* ── Song_Vector — from a candidate track's title/artist ─────────── */
export function buildSongVector(candidate) {
  return textToVector(`${candidate.artist || candidate.channel || ''} ${candidate.title || candidate.name || ''}`);
}

/**
 * Best-effort genre match for a candidate against the distinct genres
 * present in the user's seeds. Candidates (YouTube search/Mix results)
 * don't carry a genre field, so this is necessarily a weak heuristic —
 * cosine similarity between the candidate's text vector and each single
 * genre term. Returns null when nothing matches (which will be most of
 * the time), which is an honest reflection of missing metadata rather
 * than a bug: genre only becomes a usable diversity signal for
 * candidates whose title/artist text actually names or implies it.
 */
function matchSeedGenre(candidate, seedGenres, songVec) {
  if (!seedGenres.length) return null;
  let best = null, bestSim = 0;
  seedGenres.forEach(genre => {
    const sim = cosineSim(songVec, textToVector(genre));
    if (sim > bestSim) { bestSim = sim; best = genre; }
  });
  return bestSim > 0 ? best : null;
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

/* ── Term 3: diversity vs. what's already been picked ───────────────
   Now two sub-terms blended together:
     - textDiv:  1 - max cosine sim vs. already-chosen song vectors
                 (unchanged from before)
     - genreDiv: explicit penalty for repeating the same matched seed
                 genre, independent of whether that shows up in the
                 text vectors (e.g. two candidates in the same genre
                 with completely different-sounding titles/artists
                 would previously score as "diverse" — this catches
                 that case when a genre match is available)
─────────────────────────────────────────────────────────────── */
function diversityScore(songVec, chosenVectors, candidateGenre, chosenGenres) {
  const textDiv = chosenVectors.length
    ? 1 - Math.max(...chosenVectors.map(v => cosineSim(songVec, v)))
    : 1;

  let genreDiv = 1;
  if (candidateGenre) {
    const sameGenreCount = chosenGenres.filter(g => g === candidateGenre).length;
    // Diminishing penalty: 1st repeat -> 0.5, 2nd -> 0.33, etc.
    genreDiv = 1 / (1 + sameGenreCount);
  }

  return TEXT_DIVERSITY_WEIGHT * textDiv + GENRE_DIVERSITY_WEIGHT * genreDiv;
}

function scoreCandidate(candidate, userVec, recentPlayMap, chosenVectors, chosenGenres, seedGenres, weights) {
  const songVec = buildSongVector(candidate);
  const candidateGenre = matchSeedGenre(candidate, seedGenres, songVec);
  const a = contentScore(userVec, songVec);
  const b = freshnessScore(candidate.youtubeId, recentPlayMap);
  const g = diversityScore(songVec, chosenVectors, candidateGenre, chosenGenres);
  return {
    score: weights.alpha * a + weights.beta * b + weights.gamma * g,
    songVec,
    candidateGenre,
  };
}

/* ── Rerank — greedy MMR-style selection ──────────────────────────
   Picks the best-scoring candidate one at a time, recomputing
   diversity (text + genre) against everything already chosen.
   `seeds` = the user's mood-seed tracks (from getHistorySeeds);
   `candidates` = the raw pool gathered in useMoodPlaylist.js, BEFORE
   trimming to `limit`. `moodPrompt` = the daypart's flavor text,
   blended lightly into User_Vector.
─────────────────────────────────────────────────────────────── */
export async function rerankCandidates(candidates, seeds, userId, limit, moodPrompt = '', weights = WEIGHTS) {
  if (!candidates.length) return candidates;

  const userVec = buildUserVector(seeds, moodPrompt);
  const recentPlayMap = await getRecentPlayMap(userId);
  const seedGenres = [...new Set(
    (seeds || []).map(s => s.genre).filter(Boolean).map(g => g.toLowerCase().trim())
  )];

  const pool = candidates.map(c => ({ candidate: c }));
  const chosen = [];
  const chosenVectors = [];
  const chosenGenres = [];

  while (chosen.length < Math.min(limit, pool.length)) {
    let bestIdx = -1, bestScore = -Infinity, bestVec = null, bestGenre = null;

    pool.forEach((entry, idx) => {
      if (entry.picked) return;
      const { score, songVec, candidateGenre } = scoreCandidate(
        entry.candidate, userVec, recentPlayMap, chosenVectors, chosenGenres, seedGenres, weights
      );
      if (score > bestScore) { bestScore = score; bestIdx = idx; bestVec = songVec; bestGenre = candidateGenre; }
    });

    if (bestIdx === -1) break;
    pool[bestIdx].picked = true;
    chosen.push(pool[bestIdx].candidate);
    chosenVectors.push(bestVec);
    chosenGenres.push(bestGenre);
  }

  return chosen;
}