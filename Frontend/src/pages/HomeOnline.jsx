import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { usePlaylists, LIBRARY_PLAYLIST_ID } from '../hooks/usePlaylists';
import { useToast } from '../components/Toast';
import {
  FaSearch, FaStar, FaHeart, FaPlay, FaRandom, FaPause,
  FaPlus, FaDownload, FaShareAlt, FaListUl, FaChevronRight, FaTimes,
} from 'react-icons/fa';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleArrowDown, faChevronLeft, faEllipsisH,
  faCompactDisc, faBolt,
} from '@fortawesome/free-solid-svg-icons';
import { fetchSongs, patchSong as apiPatchSong } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import PlayerControls from '../components/PlayerControls';
import youtubeConverter from '../utils/youtubeConverter';
import Loader from '../utils/Splashscreen';
import RadioTile, { RadioDetailView } from '../components/Radiotile';
import PeopleRow from '../components/PeopleRow';
import { useMoodPlaylist } from '../hooks/useMoodPlaylist';
import ProfileDetailView from '../components/ProfileDetailView';
import { useFollows } from '../hooks/useFollows';
import { getSuggestionsVisibility, setSuggestionsVisibility } from '../utils/suggestionsVisibility';

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────────────── */

const GENRES = ['All', 'Hip-Hop', 'Pop', 'Rock', 'Jazz', 'Electronic', 'Classical', 'R&B', 'Blues'];

/* ─────────────────────────────────────────────────────────────────────────────
   GREETING LOGIC
───────────────────────────────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

/* Extract first name from a full name / email / display_name */
function getFirstName(profile, user) {
  // 1. Supabase profile display_name
  const dn = profile?.display_name || profile?.full_name;
  if (dn) return dn.split(' ')[0];
  // 2. Google OAuth user_metadata
  const gn = user?.user_metadata?.full_name || user?.user_metadata?.name;
  if (gn) return gn.split(' ')[0];
  // 3. Nothing — return null so we show greeting only
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   QUALITY FILTER
───────────────────────────────────────────────────────────────────────────── */
const MIX_TITLE_WORDS = [
  'playlist',' mix','mixed by','megamix','nonstop','non-stop','back to back',
  'continuous','extended set','dj set','mashup','medley','compilation','collection',
  'all songs','full album','album mix','full ep','full lp','full tape','mixtape',
  'full project','best of','greatest hits','top 10','top 20','top 50','top 100',
  'most played','chart hits','hit songs','all hits','1 hour','2 hour','3 hour',
  '4 hour','hour mix','hours of','reacts','reacting','reaction','interview',
  'behind the scenes','making of','documentary','explained','breakdown','analysis',
  'listening to','first time hearing','commentary','karaoke','sing along','sing-along',
  'cover version','covers of','instrumental version','backing track','piano cover',
  'guitar cover','violin cover','cello cover','acoustic cover','fan made','fan video',
  'lyric video','lyrics video','unofficial video','unofficial audio','unofficial music',
  'slowed reverb','slowed + reverb','sped up','nightcore','reverb only','8d audio',
  'bass boosted','#shorts','#short','youtube shorts',
];

const BAD_CHANNEL_PATTERNS = [
  ' - topic','topic channel','auto-generated','shorts','repost','reposts',
  'lyrics channel','lyrics world','lyric world','lyrics hub','music lyrics',
  'song lyrics','lyric video','lyrics official','music world','music zone',
  'music box','music hub','music nation','music hits','music vibes','hit music',
  'fan channel','fan made','fan page','fanmade','slowed','reverb nation',
  'bass nation','nightcore','8d music','karaoke','sing king','backing tracks',
];

function isSingleTrack(video) {
  const title   = (video.title   || '').toLowerCase();
  const channel = (video.channel || '').toLowerCase();
  if (MIX_TITLE_WORDS.some(kw => title.includes(kw)))       return false;
  if (BAD_CHANNEL_PATTERNS.some(p => channel.includes(p)))  return false;
  if (video.durationSecs) {
    if (video.durationSecs < 62)  return false;
    if (video.durationSecs > 720) return false;
  }
  const letters = title.replace(/[^a-z]/gi, '');
  if (letters.length > 10) {
    const upperRatio = (video.title.replace(/[^A-Za-z]/g,'').match(/[A-Z]/g)||[]).length / letters.length;
    if (upperRatio > 0.7 && !title.includes(' - ')) return false;
  }
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   YOUTUBE REQUEST CACHE / DEDUPE (module scope)
   ───────────────────────────────────────────────────────────────────────────
   All youtubeConverter.searchVideos() calls in this file go through
   cachedSearchVideos() instead of calling the converter directly. This:
     - Reuses an in-flight request if the exact same (query, maxResults) is
       requested again before the first one resolves (React StrictMode double
       effects, rapid remounts, etc. no longer double the upstream hit).
     - Reuses a recently-resolved result for a short window so retyping the
       same search text, or revisiting a page that just fetched the same
       section, doesn't re-hit YouTube.
   This is intentionally a short TTL (in-memory, cleared on full reload) —
   the longer-lived section cache below (12h, localStorage) is what actually
   avoids repeat fetches across sessions.
───────────────────────────────────────────────────────────────────────────── */
const YT_REQUEST_CACHE = new Map(); // `${query}|${maxResults}` -> { ts, promise }
const YT_REQUEST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cachedSearchVideos(query, maxResults = 10) {
  const key = `${(query || '').trim().toLowerCase()}|${maxResults}`;
  const hit = YT_REQUEST_CACHE.get(key);
  if (hit && Date.now() - hit.ts < YT_REQUEST_CACHE_TTL) {
    return hit.promise;
  }
  const promise = youtubeConverter.searchVideos(query, maxResults).catch(err => {
    // Don't cache failures — a transient error shouldn't block retries
    YT_REQUEST_CACHE.delete(key);
    throw err;
  });
  YT_REQUEST_CACHE.set(key, { ts: Date.now(), promise });
  return promise;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION DEFINITIONS
   Each section has a pool of queries. We pick MULTIPLE queries per load and
   merge results so each section shows diverse tracks, not duplicates.
───────────────────────────────────────────────────────────────────────────── */
const SECTION_DEFINITIONS = [
  {
    id: 'hip-hop', genre: 'Hip-Hop', title: 'Hip-Hop & Rap', badge: null,
    pool: [
      'kendrick lamar humble official audio','j cole love yourz official audio',
      'drake gods plan official audio','travis scott antidote official audio',
      'kanye west stronger official audio','lil baby emotionally scarred official audio',
      'future mask off official audio','roddy ricch the box official audio',
      'juice wrld lucid dreams official audio','meek mill going bad official audio',
      'polo g pop out official audio','dababy suge official audio',
      'gunna fukumean official audio','lil durk all my life official audio',
      'central cee band4band official audio','tyler the creator noid official audio',
      '21 savage a lot official audio','big sean bounce back official audio',
    ],
  },
  {
    id: 'pop', genre: 'Pop', title: 'Pop Hits', badge: null,
    pool: [
      'harry styles as it was official video','olivia rodrigo vampire official video',
      'taylor swift anti hero official music video','dua lipa levitating official video',
      'the weeknd blinding lights official video','ariana grande positions official video',
      'billie eilish bad guy official audio','post malone circles official audio',
      'ed sheeran shape of you official video','lana del rey summertime sadness official video',
      'doja cat say so official audio','halsey without me official audio',
      'camila cabello havana official video','lizzo juice official video',
      'sabrina carpenter espresso official video','charlie puth attention official video',
      'selena gomez lose you to love me official video','sia chandelier official video',
    ],
  },
  {
    id: 'rock', genre: 'Rock', title: 'Rock', badge: null,
    pool: [
      'arctic monkeys do i wanna know official video','foo fighters best of you official video',
      'red hot chili peppers under the bridge official video','nirvana smells like teen spirit official video',
      'queens of the stone age no one knows official video','the strokes last nite official video',
      'radiohead karma police official video','tame impala the less i know the better official video',
      'pearl jam black official audio','soundgarden black hole sun official video',
      'green day boulevard of broken dreams official video','linkin park in the end official video',
      'muse uprising official video','the killers mr brightside official video',
      'interpol obstacle 1 official audio','the national bloodbuzz ohio official audio',
      'pixies where is my mind official audio','alice in chains would official audio',
    ],
  },
  {
    id: 'jazz', genre: 'Jazz', title: 'Jazz', badge: null,
    pool: [
      'miles davis kind of blue so what official audio','john coltrane a love supreme official audio',
      'chet baker almost blue official audio','dave brubeck take five official audio',
      'bill evans waltz for debby official audio','thelonious monk round midnight official audio',
      'nina simone feeling good official audio','ella fitzgerald summertime official audio',
      'louis armstrong what a wonderful world official audio','herbie hancock cantaloupe island official audio',
      'stan getz girl from ipanema official audio','oscar peterson autumn leaves official audio',
      'wes montgomery bumpin on sunset official audio','kamasi washington the magnificent 7 official audio',
      'norah jones come away with me official audio','gregory porter liquid spirit official video',
    ],
  },
  {
    id: 'electronic', genre: 'Electronic', title: 'Electronic & Dance', badge: null,
    pool: [
      'daft punk get lucky official audio','aphex twin windowlicker official video',
      'deadmau5 strobe official audio','caribou cant do without you official audio',
      'four tet baby official audio','bicep glue official audio',
      'burial archangel official audio','jamie xx loud places official audio',
      'moderat bad kingdom official video','disclosure latch official audio',
      'bonobo kong official video','skrillex bangarang official video',
      'flume never be like you official audio','fred again bleu official audio',
      'fisher losing it official audio','peggy gou i go official audio',
    ],
  },
  {
    id: 'classical', genre: 'Classical', title: 'Classical', badge: null,
    pool: [
      'beethoven moonlight sonata official audio','chopin nocturne op 9 no 2 official audio',
      'mozart piano sonata no 11 official audio','bach cello suite no 1 official audio',
      'debussy clair de lune official audio','vivaldi four seasons spring official audio',
      'tchaikovsky swan lake official audio','satie gymnopédie no 1 official audio',
      'pachelbel canon in d official audio','ravel bolero official audio',
      'grieg in the hall of the mountain king official audio','liszt liebestraum official audio',
    ],
  },
  {
    id: 'rnb', genre: 'R&B', title: 'R&B & Soul', badge: null,
    pool: [
      'brent faiyaz dead man walking official audio','sza kill bill official audio',
      'frank ocean nights official audio','daniel caesar get you official audio',
      'giveon heartbreak anniversary official audio','bryson tiller exchange official audio',
      'the weeknd save your tears official audio','h.e.r focus official audio',
      'summer walker over it official audio','usher confessions part ii official audio',
      'alicia keys if i aint got you official audio','lauryn hill ex factor official audio',
      'erykah badu on and on official audio','anderson paak come down official audio',
      'lucky daye roll some mo official audio','jorja smith blue lights official video',
    ],
  },
  {
    id: 'blues', genre: 'Blues', title: 'Blues', badge: null,
    pool: [
      'bb king the thrill is gone official audio','muddy waters hoochie coochie man official audio',
      'stevie ray vaughan pride and joy official audio','eric clapton crossroads official audio',
      'albert king born under a bad sign official audio','buddy guy damn right ive got the blues official audio',
      'gary moore still got the blues official audio','joe bonamassa slow train official audio',
      'chris stapleton tennessee whiskey official video','gary clark jr when my train pulls in official video',
    ],
  },
  {
    id: 'trending', genre: null, title: 'Trending Now', badge: 'HOT',
    pool: [
      'kendrick lamar not like us official audio','sabrina carpenter espresso official video',
      'billie eilish birds of a feather official','doja cat paint the town red official audio',
      'travis scott fe!n official audio','burna boy city boys official video',
      'sza snooze official audio','tyler the creator chromakopia official audio',
      'olivia rodrigo good 4 u official video','lil nas x montero official video',
      'nicki minaj super freaky girl official audio','future wait for u official audio',
      'jack harlow first class official audio','lizzo about damn time official video',
      'bad bunny moscow mule official audio','metro boomin superhero official audio',
    ],
  },
  {
    id: 'new-releases', genre: null, title: 'New Releases', badge: 'NEW',
    pool: [
      'kendrick lamar tv off official audio','tyler the creator noid official audio',
      'the weeknd hurry up tomorrow official audio','don toliver lose my mind official audio',
      'central cee official audio 2025','asake official audio 2025',
      'rema official audio 2025','ayra starr official audio 2025',
      'omah lay official audio 2025','tems official audio 2025',
    ],
  },
  {
    id: 'afrobeats', genre: null, title: 'Afrobeats', badge: '🔥',
    pool: [
      'burna boy last last official video','wizkid essence official video',
      'davido fall official video','rema calm down official audio',
      'asake organise official audio','omah lay understand official audio',
      'fireboy dml peru official audio','ckay love nwantiti official audio',
      'tems free mind official audio','ayra starr rush official audio',
      'kizz daniel buga official video','oxlade ku lo sa official audio',
      'olamide rock official audio','victony official audio',
    ],
  },
];


/* ─────────────────────────────────────────────────────────────────────────────
   DETERMINISTIC SECTION SELECTION
   ───────────────────────────────────────────────────────────────────────────
   Previously "All" picked its 4 sections (and each section's query subset)
   with Math.random() on every mount. That meant every time HomeOnline
   remounted — switching tabs and back, navigating away and returning, a
   StrictMode double-mount in dev — there was a good chance a *different*
   random combination of sections/queries got picked, which missed the 12h
   localStorage cache and fired a fresh batch of YouTube searches even though
   an equivalent batch had just been fetched minutes earlier.

   Seeding the "random" pick from the current date makes it stable for the
   whole day: same sections, same queries, same cache key → the localStorage
   cache (getSectionCache/setSectionCache below) actually gets hit on repeat
   visits instead of being bypassed by chance.
───────────────────────────────────────────────────────────────────────────── */
function daySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed || 1;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Pick sections for the active genre. For each section, pick MULTIPLE queries
   from the pool so results are diverse — but deterministically per day so
   repeat visits reuse the same cache instead of re-rolling new combinations. */
function getSectionsForGenre(genre) {
  const seed = daySeed();
  if (genre === 'All') {
    const bonus  = SECTION_DEFINITIONS.filter(s => s.genre === null);
    const genre_ = SECTION_DEFINITIONS.filter(s => s.genre !== null);
    const picked = [
      ...seededShuffle(bonus, seed).slice(0, 2),
      ...seededShuffle(genre_, seed + 7).slice(0, 2),
    ];
    return picked.map((sec, i) => ({ ...sec, queries: pickQueries(sec.pool, 4, seed + i + 1) }));
  }
  const match = SECTION_DEFINITIONS.find(s => s.genre?.toLowerCase() === genre.toLowerCase());
  if (!match) return [];
  return [{ ...match, queries: pickQueries(match.pool, 6, seed) }];
}

/* Pick N distinct queries deterministically from the pool */
function pickQueries(pool, n, seed) {
  return seededShuffle(pool, seed).slice(0, Math.min(n, pool.length));
}

/* ─────────────────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────────────────── */
const STYLES = `
  .ho-root *, .ho-root *::before, .ho-root *::after { box-sizing: border-box; }
  .ho-root {
    font-family: 'DM Sans', sans-serif;
    color: var(--lb-text-1);
    -webkit-font-smoothing: antialiased;
  }
  .ho-root h1,.ho-root h2,.ho-root h3,.ho-root .syne { font-family: 'Syne', sans-serif; }

  /* Scrollbar */
  .ho-root ::-webkit-scrollbar { width: 4px; height: 4px; }
  .ho-root ::-webkit-scrollbar-track { background: transparent; }
  .ho-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 2px; }

  /* ── Single scroll region for the entire page (hero → shelves) ── */
  .ho-scroll-all {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 100px;
    -ms-overflow-style: none;
  }

  /* ── Header row: big bold greeting + search icon + own-avatar, Apple-Music-Home style ── */
  .ho-hero {
    padding: 30px 28px 8px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-shrink: 0;
  }
  .ho-hero-text { min-width: 0; }
  .ho-greeting {
    font-family: 'Syne', sans-serif;
    font-size: clamp(30px, 4.4vw, 46px);
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.05;
    color: #fff;
    margin-bottom: 4px;
  }
  .ho-greeting-sub {
    font-size: 13px;
    color: rgba(255,255,255,0.38);
    font-weight: 400;
  }
  .ho-hero-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    margin-top: 4px;
  }
  .ho-search-icon-btn {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.55);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.15s;
    flex-shrink: 0;
  }
  .ho-search-icon-btn:hover { background: rgba(255,255,255,0.12); color: #fff; transform: scale(1.05); }
  .ho-avatar-btn {
    flex-shrink: 0;
    width: 44px; height: 44px;
    border-radius: 50%;
    overflow: hidden;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.14);
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.4);
    font-family: 'Syne', sans-serif; font-weight: 800; font-size: 15px;
  }
  .ho-avatar-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }

  /* ── Hero "Top Picks" cards — mirrors Apple Music's Home hero row ── */
  .ho-hero-cards {
    display: flex; gap: 14px;
    overflow-x: auto;
    padding: 6px 28px 26px;
    flex-shrink: 0;
    -ms-overflow-style: none; scrollbar-width: none;
  }
  .ho-hero-cards::-webkit-scrollbar { display: none; }
  .ho-hero-card {
    position: relative;
    flex-shrink: 0;
    width: 220px; height: 276px;
    border-radius: 22px;
    overflow: hidden;
    cursor: pointer;
    background: linear-gradient(135deg, rgba(29,185,84,0.35) 0%, rgba(0,0,0,0.45) 100%);
    transition: transform 0.2s cubic-bezier(0.22,1,0.36,1);
  }
  .ho-hero-card:hover { transform: translateY(-3px); }
  .ho-hero-card-img {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  }
  .ho-hero-card-scrim {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.20) 45%, rgba(0,0,0,0.82) 100%);
  }
  .ho-hero-card-badge {
    position: absolute; top: 12px; right: 12px;
    background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
    color: #fff; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 4px 9px; border-radius: 9999px;
  }
  .ho-hero-card-text { position: absolute; left: 16px; right: 16px; bottom: 16px; }
  .ho-hero-card-sub {
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: rgba(255,255,255,0.75); margin-bottom: 4px;
  }
  .ho-hero-card-title {
    font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;
    color: #fff; line-height: 1.15;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .ho-hero-card.loading { background: rgba(255,255,255,0.04); cursor: default; }

  /* ── Search overlay — full-screen, opened from the icon button ── */
  .ho-search-overlay {
    position: fixed; inset: 0; z-index: 300;
    background: rgba(5,6,8,0.94);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    display: flex; flex-direction: column;
    animation: ho-fadeup 0.16s ease both;
  }
  .ho-search-overlay-top {
    flex-shrink: 0;
    display: flex; align-items: center; gap: 12px;
    padding: 20px 20px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .ho-search-overlay-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    font-size: 17px;
    font-family: 'DM Sans', sans-serif;
  }
  .ho-search-overlay-input::placeholder { color: rgba(255,255,255,0.32); }
  .ho-search-overlay-close {
    width: 34px; height: 34px; border-radius: 50%;
    background: rgba(255,255,255,0.08); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.6); flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .ho-search-overlay-close:hover { background: rgba(255,255,255,0.14); color: #fff; }
  .ho-search-overlay-body { flex: 1; overflow-y: auto; padding: 8px; }
  .ho-search-overlay-empty {
    text-align: center; padding: 60px 20px;
    color: rgba(255,255,255,0.3); font-size: 13px;
  }

  /* ── Genre chips ── */
  .ho-chips-row {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 0 28px 20px;
    flex-shrink: 0;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .ho-chips-row::-webkit-scrollbar { display: none; }
  .ho-chip {
    padding: 7px 16px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.55);
    white-space: nowrap;
    font-family: 'DM Sans', sans-serif;
    letter-spacing: 0.01em;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }
  .ho-chip:hover { background: rgba(255,255,255,0.09); color: #fff; }
  .ho-chip.active {
    background: var(--lb-green);
    color: #fff;
    border-color: transparent;
  }

  /* ── Section heading ── */
  .ho-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 28px;
    margin-bottom: 16px;
  }
  .ho-section-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ho-section-title h2 {
    font-family: 'Syne', sans-serif;
    font-size: 19px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #fff;
  }
  .ho-section-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--lb-green);
    flex-shrink: 0;
  }
  /* Icon-only "see all" — Apple Music's Home just uses a plain chevron
     after the section title, not a labeled pill button. */
  .ho-see-all {
    width: 26px; height: 26px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.45);
    border: none; cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .ho-see-all:hover { background: rgba(255,255,255,0.11); color: #fff; }

  /* ── Horizontal shelf ── */
  .ho-shelf {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    padding: 0 28px 4px;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .ho-shelf::-webkit-scrollbar { display: none; }

  /* ── TiltedCard (UNCHANGED — tile style stays exactly as-is) ── */
  .ho-tcard {
    flex-shrink: 0;
    width: 160px;
    height: 186px;           /* image 160 + name pill ~26 */
    cursor: pointer;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    perspective: 800px;
    border: none;
    background: none;
  }
  .ho-tcard-inner {
    position: relative;
    width: 160px;
    height: 160px;
    transform-style: preserve-3d;
    border-radius: 15px;
    overflow: hidden;
  }
  .ho-tcard-img {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    border-radius: 15px;
    display: block;
    will-change: transform;
  }
  /* Overlay content floats above image in Z */
  .ho-tcard-overlay-content {
    position: absolute; inset: 0;
    border-radius: 15px;
    pointer-events: none;
  }
  /* Badge top-left */
  .ho-tcard-badge-wrap {
    position: absolute; top: 8px; left: 8px; z-index: 2;
  }
  /* Song name pill pinned at bottom */
  .ho-tcard-name-pill {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 28px 10px 10px;
    background: linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 100%);
    border-radius: 0 0 15px 15px;
  }
  .ho-tcard-name {
    font-family: 'Syne', sans-serif;
    font-size: 12px; font-weight: 700;
    color: rgba(255,255,255,0.92);
    display: block;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ho-tcard-name.active { color: var(--lb-green); }

  /* Wave badge */
  .ho-now-playing-badge {
    position: absolute; bottom: 10px; left: 10px;
    background: rgba(0,0,0,0.68); backdrop-filter: blur(10px);
    border-radius: 8px; padding: 5px 8px; z-index: 4;
    display: flex; align-items: center;
  }
  .ho-tcard-wave { bottom: 40px !important; }

  /* Play button — slides up on hover */
  .ho-tcard-play-wrap {
    position: absolute;
    bottom: 10px; right: 10px;
    z-index: 4;
    opacity: 0;
    transform: translateY(6px) scale(0.88);
    transition: opacity 0.2s, transform 0.2s;
    pointer-events: none;
  }
  .ho-tcard:hover .ho-tcard-play-wrap,
  .ho-tcard:focus-within .ho-tcard-play-wrap {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }
  .ho-tcard-play {
    width: 38px; height: 38px; border-radius: 50%;
    background: #fff; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(0,0,0,0.5);
    transition: background 0.15s, transform 0.15s;
  }
  .ho-tcard-play:hover  { background: var(--lb-green-bright); transform: scale(1.1); }
  .ho-tcard-play:active { transform: scale(0.92); }
  .ho-tcard-play.loading { background: rgba(255,255,255,0.7); cursor: wait; }

  /* Tooltip */
  .ho-tcard-tooltip {
    pointer-events: none;
    position: absolute;
    left: 0; top: 0;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(8px);
    border-radius: 5px;
    padding: 4px 10px;
    font-size: 11px; font-weight: 600;
    color: #1a1a1a;
    white-space: nowrap;
    z-index: 10;
    box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    opacity: 0;
    display: none;
  }
  @media (min-width: 640px) { .ho-tcard-tooltip { display: block; } }

  /* Artist name below card */
  .ho-tcard-artist-row {
    width: 160px; margin-top: 8px;
    font-size: 11px; color: rgba(255,255,255,0.4);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    text-align: left;
    font-family: 'DM Sans', sans-serif;
  }

  /* Badge pills */
  .ho-badge-new {
    background: linear-gradient(135deg,#FF4B4B,#FF2D55);
    color: #fff; font-size: 9px; font-weight: 800;
    padding: 2px 7px; border-radius: 6px; letter-spacing: .05em;
  }
  .ho-badge-hot {
    background: linear-gradient(135deg,#FF6B00,#FF4500);
    color: #fff; font-size: 9px; font-weight: 800;
    padding: 2px 7px; border-radius: 6px; letter-spacing: .05em;
  }

  /* ── Downloaded tile — flattened toward the reference's plain style ── */
  .ho-dl-tile {
    flex-shrink: 0;
    width: 190px;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(29,185,84,0.07);
    border: 1px solid rgba(29,185,84,0.15);
    cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), border-color 0.18s;
    position: relative;
  }
  .ho-dl-tile:hover {
    transform: translateY(-2px);
    border-color: rgba(29,185,84,0.32);
  }
  .ho-dl-mosaic {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    aspect-ratio: 1;
    gap: 2px;
    background: #111;
  }
  .ho-dl-mosaic img {
    width: 100%; height: 100%;
    object-fit: cover;
  }
  .ho-dl-info { padding: 12px 14px 44px; }
  .ho-dl-name {
    font-family: 'Syne', sans-serif;
    font-size: 14px; font-weight: 700;
    color: #fff; margin-bottom: 2px;
  }
  .ho-dl-count { font-size: 12px; color: rgba(255,255,255,0.42); }
  .ho-dl-play {
    position: absolute;
    bottom: 12px; right: 12px;
    width: 36px; height: 36px; border-radius: 50%;
    background: var(--lb-green); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(29,185,84,0.45);
    transition: background 0.15s, transform 0.15s;
  }
  .ho-dl-play:hover { background: var(--lb-green-bright); transform: scale(1.1); }

  /* ── Shimmer cards ── */
  .ho-shimmer-card {
    flex-shrink: 0;
    width: 160px;
    height: 186px;
    border-radius: 15px;
    overflow: hidden;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .ho-shimmer {
    background: linear-gradient(
      90deg,
      rgba(255,255,255,.04) 25%,
      rgba(255,255,255,.08) 50%,
      rgba(255,255,255,.04) 75%
    );
    background-size: 800px 100%;
    animation: ho-shimmer 1.4s infinite linear;
  }
  @keyframes ho-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }

  /* ── Search dropdown (reused for overlay result rows) ── */
  .ho-dropdown {
    background: #141416;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 16px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.75);
    overflow: hidden;
  }
  .ho-search-row {
    padding: 10px 16px;
    display: flex; align-items: center; gap: 12px;
    cursor: pointer; transition: background 0.15s;
    border-radius: 12px;
  }
  .ho-search-row:hover { background: rgba(255,255,255,0.06); }

  /* ── Dropdown menus ── */
  .lb-dropdown {
    position: absolute; right: 0; top: calc(100% + 6px);
    z-index: 200; min-width: 200px;
    background: #111416;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px; padding: 6px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.85);
    animation: lb-drop-in 0.18s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes lb-drop-in {
    from { opacity:0; transform: translateY(-6px) scale(0.97); }
    to   { opacity:1; transform: none; }
  }
  .lb-dropdown-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 9px;
    font-size: 13px; font-weight: 500;
    color: rgba(255,255,255,0.75);
    cursor: pointer; border: none; background: transparent;
    width: 100%; text-align: left;
    transition: background 0.12s, color 0.12s;
    font-family: 'DM Sans', sans-serif;
  }
  .lb-dropdown-item:hover { background: rgba(255,255,255,0.07); color: #fff; }
  .lb-dropdown-sep { height: 1px; background: rgba(255,255,255,0.07); margin: 4px 0; }
  .lb-dropdown-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: rgba(255,255,255,0.28);
    padding: 6px 12px 4px;
  }
  .lb-dropdown-icon {
    width: 26px; height: 26px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; flex-shrink: 0;
    background: rgba(255,255,255,0.06);
  }

  /* ── Wave bars ── */
  /* Wave SVG renders inline — no extra CSS needed */

  /* ── Spin ── */
  @keyframes ho-spin { to { transform:rotate(360deg); } }
  .ho-spin { animation: ho-spin .7s linear infinite; }

  /* ── Fade up ── */
  @keyframes ho-fadeup { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  .ho-fadeup { animation: ho-fadeup .32s ease both; }

  /* ── Error banner ── */
  .ho-error-banner {
    margin: 0 28px 16px;
    background: rgba(255,100,0,.10);
    border: 1px solid rgba(255,100,0,.22);
    border-radius: 10px; padding: 10px 14px;
    font-size: 13px; color: #FF9944;
    display: flex; align-items: center; gap: 8px;
    flex-shrink: 0;
  }

  /* ── Section accent underline — small colored rule under a section
     title, so scrolling past Rock/Classical/etc. actually reads as
     distinct sections instead of identical green-dot rows. ── */
  .ho-section-accent-bar {
    width: 26px; height: 3px; border-radius: 2px;
    margin-top: 6px;
  }

  /* ── Spotlight card — the top track of a badge section (Trending,
     New Releases, Afrobeats, For You) gets one big featured card;
     the rest of that section's items still render in the normal
     shelf below it. Breaks up the "every section is a uniform row
     of same-size tiles" monotony without touching tile style itself. ── */
  .ho-spotlight {
    position: relative;
    margin: 0 28px 18px;
    height: 156px;
    border-radius: 20px;
    overflow: hidden;
    cursor: pointer;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
  }
  .ho-spotlight-img {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
    filter: brightness(0.55);
    transition: transform 0.35s ease, filter 0.25s ease;
  }
  .ho-spotlight:hover .ho-spotlight-img { transform: scale(1.045); filter: brightness(0.62); }
  .ho-spotlight-scrim {
    position: absolute; inset: 0;
    background: linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 55%, transparent 100%);
  }
  .ho-spotlight-badge {
    position: absolute; top: 14px; left: 18px; z-index: 2;
    font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 9999px; color: #fff;
  }
  .ho-spotlight-text { position: absolute; left: 18px; bottom: 16px; right: 90px; z-index: 2; }
  .ho-spotlight-eyebrow {
    font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(255,255,255,0.65); margin-bottom: 4px;
  }
  .ho-spotlight-title {
    font-family: 'Syne', sans-serif; font-size: 21px; font-weight: 800; letter-spacing: -0.02em;
    color: #fff; line-height: 1.15;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ho-spotlight-sub {
    font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 2px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ho-spotlight-play {
    position: absolute; right: 18px; bottom: 18px; z-index: 2;
    width: 44px; height: 44px; border-radius: 50%;
    background: #fff; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    transition: transform 0.15s, background 0.15s;
  }
  .ho-spotlight-play:hover { background: var(--lb-green-bright); transform: scale(1.08); }
  .ho-spotlight-play:active { transform: scale(0.92); }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   DETAIL VIEW — canonical hero treatment
   ───────────────────────────────────────────────────────────────────────────
   This is the SAME "art-color-mutated hero" detail view used by
   Library.jsx's AlbumDetailView and Playlists.jsx's DetailView — same
   dominant-color extraction, same `.lib-detail-*` class names and CSS.
   Don't fork this: if the hero needs to change, change it in all three
   places identically.
───────────────────────────────────────────────────────────────────────────── */
const ACCENT_FALLBACK = '29, 185, 84'; // brand green — used until real color resolves
const ACCENT_CACHE = new Map();

function extractAccentRGB(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    if (ACCENT_CACHE.has(src)) { resolve(ACCENT_CACHE.get(src)); return; }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let bestR = 0, bestG = 0, bestB = 0, bestScore = -1;
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          const score = sat * 1.5 + (1 - Math.abs(lum - 0.45));
          if (score > bestScore) { bestScore = score; bestR = r; bestG = g; bestB = b; }
        }
        const result = `${bestR}, ${bestG}, ${bestB}`;
        ACCENT_CACHE.set(src, result);
        resolve(result);
      } catch (_) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* Copied verbatim from Library.jsx's CSS (the `.lib-root` variable scope +
   every `.lib-detail-*` / `.lib-tracks*` rule, incl. the mobile overrides).
   Two small additive blocks are appended at the end — clearly marked —
   for things Library's plain AlbumDetailView doesn't need: per-track
   favorite/like/add-to-playlist actions, and styling the existing DotsMenu
   trigger to sit in the nav row like a second `.lib-detail-nav-btn`. */
const DETAIL_CSS = `
.lib-root {
  --g:      #1DB954;
  --g2:     #23E065;
  --gdim:   rgba(29,185,84,0.14);
  --gglow:  rgba(29,185,84,0.28);
  --s1:     rgba(255,255,255,0.04);
  --s2:     rgba(255,255,255,0.07);
  --sh:     rgba(255,255,255,0.09);
  --b1:     rgba(255,255,255,0.07);
  --b2:     rgba(255,255,255,0.13);
  --t1:     #fff;
  --t2:     rgba(255,255,255,0.55);
  --t3:     rgba(255,255,255,0.28);
  --ease:   cubic-bezier(0.4,0,0.2,1);
  --spring: cubic-bezier(0.22,1,0.36,1);
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
  color: var(--t1);
}
.lib-root *, .lib-root *::before, .lib-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.lib-root button { font-family: inherit; cursor: pointer; border: none; background: none; }

.lib-detail { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; overflow: hidden; background: #07080A; animation: libDetailFadeIn .3s var(--ease) both; }
@keyframes libDetailFadeIn { from{opacity:0} to{opacity:1} }

.lib-detail-tint { position: absolute; inset: 0; z-index: 1; pointer-events: none; transition: background 0.7s ease; }
.lib-detail-tint-scrim { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: linear-gradient(180deg, transparent 0%, rgba(7,8,10,.35) 55%, #07080A 100%); }

.lib-detail-nav { position: relative; z-index: 10; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 4px; }
.lib-detail-nav-btn { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.10); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.14); color: var(--t1); font-size: 14px; display: flex; align-items: center; justify-content: center; transition: background .15s, transform .15s; }
.lib-detail-nav-btn:hover { background: rgba(255,255,255,.18); }
.lib-detail-nav-btn:active { transform: scale(.9); }

.lib-detail-hero { position: relative; z-index: 10; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px 24px 4px; gap: 5px; }
.lib-detail-art-wrap { position: relative; width: min(260px, 58vw); height: min(260px, 58vw); flex-shrink: 0; margin-bottom: 6px; }
.lib-detail-art-glow { position: absolute; inset: -16px; border-radius: 32px; background: radial-gradient(circle, var(--gglow) 0%, transparent 70%); filter: blur(20px); animation: libDetailGlow 3.5s ease-in-out infinite; }
@keyframes libDetailGlow { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.9;transform:scale(1.05)} }
.lib-detail-art { position: relative; z-index: 1; width: 100%; height: 100%; border-radius: 22px; overflow: hidden; box-shadow: 0 32px 80px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.08); }
.lib-detail-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lib-detail-art-empty { width: 100%; height: 100%; background: linear-gradient(135deg,rgba(29,185,84,.18),rgba(0,0,0,.35)); display: flex; align-items: center; justify-content: center; font-size: 52px; color: rgba(29,185,84,.3); }

.lib-detail-name { font-family: 'Syne', sans-serif; font-size: clamp(22px,4.5vw,32px); font-weight: 800; letter-spacing: -.03em; color: #fff; line-height: 1.1; max-width: 480px; }
.lib-detail-subtitle { font-size: 14px; color: rgba(255,255,255,.6); }
.lib-detail-metaline { font-size: 12px; color: rgba(255,255,255,.38); margin-bottom: 4px; }

.lib-detail-actions { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 14px; width: 100%; max-width: 340px; }
.lib-detail-circle-btn { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.15); color: #fff; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: background .15s, transform .15s; }
.lib-detail-circle-btn:hover { background: rgba(255,255,255,.17); transform: scale(1.06); }
.lib-detail-circle-btn:active { transform: scale(.92); }
.lib-detail-play-pill { flex: 1; display: flex; align-items: center; justify-content: center; gap: 9px; padding: 14px 0; border-radius: 9999px; background: #fff; color: #000; font-family: 'Syne', sans-serif; font-weight: 800; font-size: 15px; box-shadow: 0 10px 32px rgba(0,0,0,.45); transition: background .15s, transform .15s var(--spring), box-shadow .15s; }
.lib-detail-play-pill:hover { transform: translateY(-1px) scale(1.015); box-shadow: 0 14px 40px rgba(0,0,0,.55); }
.lib-detail-play-pill:active { transform: scale(.97); }

.lib-detail-divider { position: relative; z-index: 10; height: 1px; background: rgba(255,255,255,.07); margin: 24px 24px 2px; flex-shrink: 0; }

.lib-tracks { position: relative; z-index: 10; flex: 1; overflow-y: auto; padding: 0 20px 48px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent; }
.lib-tracks::-webkit-scrollbar { width: 4px; }
.lib-tracks::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 3px; }
.lib-tracks-label { font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--t3); padding: 14px 12px 12px; }
.lib-track-row { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,.05); transition: background .14s; position: relative; }
.lib-track-row:last-child { border-bottom: none; }
.lib-track-row:hover { background: var(--s2); }
.lib-track-row.active { background: rgba(29,185,84,.09); }
.lib-track-num { width: 22px; text-align: center; font-size: 13px; color: var(--t3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.lib-track-row.active .lib-track-num { color: var(--g); }
.lib-track-thumb { width: 40px; height: 40px; border-radius: 8px; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,.35); }
.lib-track-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lib-track-meta { flex: 1; min-width: 0; }
.lib-track-name { font-size: 13.5px; font-weight: 600; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; transition: color .14s; }
.lib-track-row:hover .lib-track-name, .lib-track-row.active .lib-track-name { color: var(--g); }
.lib-track-artist { font-size: 11px; color: var(--t3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lib-track-dur { font-size: 11px; color: var(--t3); font-variant-numeric: tabular-nums; flex-shrink: 0; }

@media (max-width: 767px) {
  .lib-detail-nav { padding: 14px 16px 2px; }
  .lib-detail-hero { padding: 12px 18px 2px; }
  .lib-detail-actions { max-width: 300px; gap: 10px; }
  .lib-detail-circle-btn { width: 44px; height: 44px; }
  .lib-detail-play-pill { padding: 12px 0; font-size: 14px; }
  .lib-detail-divider { margin: 18px 16px 2px; }

  .lib-tracks { padding: 0 12px 28px; }
  .lib-tracks-label { padding: 0 8px 10px; }
  .lib-track-row { padding: 9px 8px; gap: 10px; }
  .lib-track-thumb { width: 36px; height: 36px; }
  .lib-track-name { font-size: 12px; }
  .lib-track-artist { font-size: 10px; }
  .lib-track-dur { font-size: 10px; }
}

/* ── Additive, HomeOnline-only: per-track social actions (fav/like/add-to-
   playlist) that Library's plain track rows don't have, plus fitting the
   existing DotsMenu trigger into the nav row next to the back button. ── */
.lib-track-actions { display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .15s; flex-shrink: 0; }
.lib-track-row:hover .lib-track-actions,
.lib-track-row:focus-within .lib-track-actions { opacity: 1; }
.lib-detail-nav .lb-icon-btn {
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255,255,255,.10); backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,.14); color: var(--t1);
  display: flex; align-items: center; justify-content: center;
  transition: background .15s, transform .15s;
}
.lib-detail-nav .lb-icon-btn:hover { background: rgba(255,255,255,.18); }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function makeYtSong(video) {
  const ytUrl = `https://www.youtube.com/watch?v=${video.id}`;
  return {
    id: `yt_${video.id}`,
    name: video.title || 'Unknown',
    artist: video.channel || 'YouTube',
    album: '',
    duration: video.duration || '0:00',
    cover: video.thumbnail || '/default-cover.png',
    audio: ytUrl, url: ytUrl, src: ytUrl,
    youtube: true, youtubeId: video.id, source: 'youtube',
  };
}

function cleanTitle(title) {
  return title
    .replace(/\s*[\(\[](official\s*(audio|video|music video|lyric video|visualizer)|lyrics?|hd|4k|explicit)[\)\]]/gi, '')
    .replace(/\s*[-–]\s*(official\s*(audio|video|music video)|lyrics?)\s*$/gi, '')
    .trim();
}

/* ── Per-genre accent color — gives each genre section a distinct
   identity instead of every section header using the same green dot.
   Badge sections (Trending/New/Afrobeats) keep their own badge colors
   and aren't affected by this map. ── */
const GENRE_ACCENTS = {
  'hip-hop':    '#FF6B4A',
  'pop':        '#FF4FA3',
  'rock':       '#FF3B3B',
  'jazz':       '#FFC24A',
  'electronic': '#7C4DFF',
  'classical':  '#4AD9FF',
  'r&b':        '#FF8A4A',
  'blues':      '#4A90FF',
};
function getGenreAccent(genre) {
  return GENRE_ACCENTS[genre?.toLowerCase()] || '#1DB954';
}

/* Solid color for a badge pill, independent of the ho-badge-* gradient classes */
function getBadgeAccent(badge) {
  if (badge === 'HOT') return '#FF6B00';
  if (badge === 'NEW') return '#FF2D55';
  return '#1DB954';
}

/* ── Spotlight — one big featured card for a section's top track.
   Reuses whatever item data the section already fetched; no new
   fetches introduced. ── */
const Spotlight = memo(({ item, eyebrow, badge, accent, onPlay }) => {
  if (!item) return null;
  return (
    <div className="ho-spotlight ho-fadeup" onClick={onPlay}>
      <img
        src={item.cover}
        alt={item.name}
        className="ho-spotlight-img"
        onError={e => { e.target.style.opacity = 0; }}
      />
      <div className="ho-spotlight-scrim" />
      {badge && (
        <span className="ho-spotlight-badge" style={{ background: accent }}>{badge}</span>
      )}
      <div className="ho-spotlight-text">
        <p className="ho-spotlight-eyebrow">{eyebrow}</p>
        <p className="ho-spotlight-title">{item.name}</p>
        <p className="ho-spotlight-sub">{item.artist}</p>
      </div>
      <button className="ho-spotlight-play" onClick={e => { e.stopPropagation(); onPlay(); }} aria-label={`Play ${item.name}`}>
        <FaPlay style={{ color: '#000', fontSize: 15, marginLeft: 2 }} />
      </button>
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────────────────────── */
const WaveIcon = () => (
  <svg width="18" height="14" viewBox="0 0 18 14" fill="none"
    style={{ display:'block', flexShrink:0 }} aria-hidden="true">
    {[
      { x:0,  y1:6,  y2:1,  y3:11, dur:'0.55s', delay:'0s'    },
      { x:4,  y1:9,  y2:1,  y3:13, dur:'0.7s',  delay:'0.1s'  },
      { x:8,  y1:3,  y2:0,  y3:12, dur:'0.5s',  delay:'0.05s' },
      { x:12, y1:7,  y2:2,  y3:12, dur:'0.65s', delay:'0.15s' },
    ].map((b, i) => (
      <rect key={i} x={b.x} y={b.y1} width="2.5" height={14-b.y1} rx="1.2" fill="#1DB954">
        <animate attributeName="y"
          values={`${b.y1};${b.y2};${b.y3};${b.y1}`}
          dur={b.dur} repeatCount="indefinite" begin={b.delay} />
        <animate attributeName="height"
          values={`${14-b.y1};${14-b.y2};${14-b.y3};${14-b.y1}`}
          dur={b.dur} repeatCount="indefinite" begin={b.delay} />
      </rect>
    ))}
  </svg>
);

const SpinIcon = () => (
  <svg className="ho-spin" width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

/* ─── TiltedCard — 3D hover card (UNCHANGED) ─────────────────────────────────── */
const SPRING = { damping: 30, stiffness: 100, mass: 2 };

function TiltedCard({ imageSrc, altText, captionText, onPlay, isActive, isPlaying, isLoading, badge }) {
  const ref        = useRef(null);
  const x          = useMotionValue(0);
  const y          = useMotionValue(0);
  const rotateX    = useSpring(useMotionValue(0), SPRING);
  const rotateY    = useSpring(useMotionValue(0), SPRING);
  const scale      = useSpring(1, SPRING);
  const opacity    = useSpring(0);
  const rotateFig  = useSpring(0, { stiffness: 350, damping: 30, mass: 1 });
  const [lastY, setLastY] = useState(0);
  const showPause = isActive && isPlaying && !isLoading;

  function handleMouse(e) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const ox = e.clientX - rect.left - rect.width  / 2;
    const oy = e.clientY - rect.top  - rect.height / 2;
    rotateX.set((oy / (rect.height / 2)) * -12);
    rotateY.set((ox / (rect.width  / 2)) *  12);
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
    rotateFig.set(-(oy - lastY) * 0.6);
    setLastY(oy);
  }
  function handleEnter() { scale.set(1.05); opacity.set(1); }
  function handleLeave() {
    opacity.set(0); scale.set(1);
    rotateX.set(0); rotateY.set(0); rotateFig.set(0);
  }

  return (
    <figure
      ref={ref}
      className="ho-tcard ho-fadeup"
      onMouseMove={handleMouse}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={e => { e.stopPropagation(); if (!isLoading) onPlay(); }}
    >
      <motion.div
        className="ho-tcard-inner"
        style={{ rotateX, rotateY, scale }}
      >
        {/* Cover image */}
        <motion.img
          src={imageSrc}
          alt={altText}
          className="ho-tcard-img"
          onError={e => { e.target.src = `https://placehold.co/300x300/1a1a1a/333?text=${encodeURIComponent((altText||'?')[0])}`; }}
          style={{ transform: 'translateZ(0)' }}
        />

        {/* Overlay: song name floats above */}
        <motion.div
          className="ho-tcard-overlay-content"
          style={{ transform: 'translateZ(30px)' }}
        >
          {/* Badge top-left */}
          {badge && (
            <div className="ho-tcard-badge-wrap">
              <span className={badge==='HOT' ? 'ho-badge-hot' : badge==='NEW' ? 'ho-badge-new' : undefined}
                style={!['HOT','NEW'].includes(badge) ? {fontSize:14} : undefined}>
                {badge}
              </span>
            </div>
          )}

          {/* Active wave bottom-left */}
          {isActive && isPlaying && !isLoading && (
            <div className="ho-now-playing-badge ho-tcard-wave"><WaveIcon /></div>
          )}

          {/* Song name pill — always visible at bottom */}
          <div className="ho-tcard-name-pill">
            <span className={`ho-tcard-name${isActive ? ' active' : ''}`}>{altText}</span>
          </div>
        </motion.div>

        {/* Play/pause button — shows on hover via CSS */}
        <div className="ho-tcard-play-wrap">
          <button
            className={`ho-tcard-play${isLoading ? ' loading' : ''}`}
            onClick={e => { e.stopPropagation(); if (!isLoading) onPlay(); }}
            aria-label={`Play ${altText}`}
            disabled={isLoading}
          >
            {isLoading  ? <SpinIcon /> :
             showPause  ? <FaPause  style={{ color:'#000', fontSize:14 }} /> :
                          <FaPlay   style={{ color:'#000', fontSize:14, marginLeft:2 }} />}
          </button>
        </div>
      </motion.div>

      {/* Tooltip caption that follows cursor */}
      <motion.figcaption
        className="ho-tcard-tooltip"
        style={{ x, y, opacity, rotate: rotateFig }}
      >
        {captionText}
      </motion.figcaption>
    </figure>
  );
}

/* Song card — wraps TiltedCard with item data (UNCHANGED) */
const SongCard = memo(({ item, isActive, isPlaying, onPlay, loadingId }) => {
  const isLoading = loadingId === item.id;
  return (
    <TiltedCard
      imageSrc={item.cover}
      altText={item.name}
      captionText={`${item.name} · ${item.artist}`}
      onPlay={onPlay}
      isActive={isActive}
      isPlaying={isPlaying}
      isLoading={isLoading}
      badge={item.badge}
    />
  );
});

/* Shimmer shelf */
const ShimmerShelf = ({ count = 6 }) => (
  <div className="ho-shelf">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="ho-shimmer-card">
        <div className="ho-shimmer" style={{ height:160, borderRadius:15 }} />
        <div style={{ padding:'8px 0 0', background:'transparent' }}>
          <div className="ho-shimmer" style={{ height:11, width:'80%', borderRadius:6 }} />
        </div>
      </div>
    ))}
  </div>
);

/* ─── HeroCard — the new "Top Picks for You" style featured card ─────────────
   Built purely from data already fetched elsewhere in this component (mood
   mix, For You, trending sections) — no new data sources introduced. ─── */
const HeroCard = memo(({ title, subtitle, cover, badgeText, onClick, loading }) => {
  if (loading) return <div className="ho-hero-card loading" />;
  return (
    <div className="ho-hero-card" onClick={onClick}>
      {cover && (
        <img
          src={cover}
          alt={title}
          className="ho-hero-card-img"
          onError={e => { e.target.style.display = 'none'; }}
        />
      )}
      <div className="ho-hero-card-scrim" />
      {badgeText && <span className="ho-hero-card-badge">{badgeText}</span>}
      <div className="ho-hero-card-text">
        <p className="ho-hero-card-sub">{subtitle}</p>
        <p className="ho-hero-card-title">{title}</p>
      </div>
    </div>
  );
});

function useOutsideClick(ref, handler) {
  useEffect(() => {
    const l = e => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener('mousedown', l);
    return () => document.removeEventListener('mousedown', l);
  }, [ref, handler]);
}

const DotsMenu = memo(({ song, songList, onAddToQueue }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { show: showToast } = useToast();
  const { user, profile: authProfile } = useAuth();
  const { addToLibrary } = usePlaylists();
  const BACKEND = import.meta.env.VITE_YT_BACKEND_URL || 'http://localhost:3001';
  useOutsideClick(ref, () => setOpen(false));

  const handleShare = useCallback(() => {
    const ytId = song?.youtubeId || song?.id?.replace('yt_','');
    const url = ytId
      ? `https://www.youtube.com/watch?v=${ytId}`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent((song?.name||'')+' '+(song?.artist||''))}`;
    navigator.clipboard.writeText(url)
      .then(() => showToast('YouTube link copied!','info'))
      .catch(() => showToast('Could not copy link','error'));
    setOpen(false);
  }, [song, showToast]);

  const handleAddToLibrary = useCallback(() => {
    try {
      const targets = (songList?.length > 0) ? songList : (song ? [song] : []);
      if (!targets.length) { setOpen(false); return; }
      let added = 0;
      targets.forEach(s => {
        const ytId = s.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(s.youtubeId) ? s.youtubeId : null;
        const ytUrl = ytId ? 'https://www.youtube.com/watch?v='+ytId : null;
        const r = addToLibrary({ ...s, source: ytId?'youtube':s.source, youtubeId: ytId||s.youtubeId, audio: ytUrl||s.audio, url: ytUrl||s.url, src: ytUrl||s.src, album: s.album||s.artist||'YouTube' });
        if (r !== false) added++;
      });
      showToast(added === 0 ? 'Already in Library' : `${added} song${added>1?'s':''} added to Library ✓`, added===0?'info':'success');
    } catch { showToast('Could not save to Library','error'); }
    setOpen(false);
  }, [song, songList, addToLibrary, showToast]);

  const handleQueue = useCallback(() => { onAddToQueue?.(); showToast('Added to queue ✓','success'); setOpen(false); }, [onAddToQueue, showToast]);

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button className="lb-icon-btn" onClick={() => setOpen(o => !o)}>
        <FontAwesomeIcon icon={faEllipsisH} style={{ fontSize:14 }} />
      </button>
      {open && (
        <div className="lb-dropdown">
          <button className="lb-dropdown-item" onClick={handleQueue}><span className="lb-dropdown-icon"><FaListUl /></span>Add to Queue</button>
          <button className="lb-dropdown-item" onClick={handleAddToLibrary}><span className="lb-dropdown-icon"><FaDownload /></span>Add to Library</button>
          <div className="lb-dropdown-sep" />
          <button className="lb-dropdown-item" onClick={handleShare}><span className="lb-dropdown-icon"><FaShareAlt /></span>Copy YouTube Link</button>
        </div>
      )}
    </div>
  );
});

const AddToPlaylistBtn = memo(({ song }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { playlists: allPlaylists, addSongToPlaylist } = usePlaylists();
  const playlists = allPlaylists.filter(p => !p._hidden);
  const { show: showToast } = useToast();
  const { user, profile: authProfile } = useAuth();
  useOutsideClick(ref, () => setOpen(false));
  const handle = useCallback((pl) => { addSongToPlaylist(pl.id, song); showToast(`Added to ${pl.name} ✓`,'success'); setOpen(false); }, [song, addSongToPlaylist, showToast]);
  return (
    <div ref={ref} style={{ position:'relative', flexShrink:0 }}>
      <button onClick={e => { e.stopPropagation(); setOpen(o=>!o); }}
        style={{ width:28, height:28, borderRadius:'50%', border:'none', background: open?'rgba(29,185,84,0.15)':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color: open?'var(--lb-green)':'var(--lb-text-3)', transition:'background 0.15s, color 0.15s' }}
        title="Add to playlist">
        <FaPlus style={{ fontSize:10 }} />
      </button>
      {open && (
        <div className="lb-dropdown">
          {playlists.length === 0
            ? <div style={{ padding:'10px 14px', fontSize:12, color:'rgba(255,255,255,0.35)', textAlign:'center' }}>No playlists yet</div>
            : (<><div className="lb-dropdown-label">Add to playlist</div>
               {playlists.map(pl => (
                 <button key={pl.id} className="lb-dropdown-item" onClick={() => handle(pl)}>
                   <span className="lb-dropdown-icon"><FaListUl /></span>
                   <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pl.name}</span>
                 </button>
               ))}</>)
          }
        </div>
      )}
    </div>
  );
});

const TrackRow = memo(({ song, index, isActive, isPlaying, onPlay, isFav, isLiked, onFav, onLike }) => (
  <div className={`lib-track-row${isActive ? ' active' : ''}`} onClick={onPlay} role="button" aria-label={`Play ${song.name}`}>
    <span className="lib-track-num">
      {isActive && isPlaying ? <WaveIcon /> : index + 1}
    </span>
    <div className="lib-track-thumb">
      <img src={song.cover} alt={song.name} onError={e => { e.target.src = '/default-cover.png'; }} />
    </div>
    <div className="lib-track-meta">
      <div className="lib-track-name">{song.name}</div>
      <div className="lib-track-artist">{song.artist || 'Unknown'}</div>
    </div>
    <span className="lib-track-dur">{song.formattedDuration || song.duration || ''}</span>
    <div className="lib-track-actions">
      <button onClick={e => { e.stopPropagation(); onFav(); }} style={{ width:28, height:28, borderRadius:'50%', border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <FaStar style={{ fontSize:11, color:isFav?'#FFD600':'var(--t3)' }} />
      </button>
      <button onClick={e => { e.stopPropagation(); onLike(); }} style={{ width:28, height:28, borderRadius:'50%', border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <FaHeart style={{ fontSize:11, color:isLiked?'#FF4455':'var(--t3)' }} />
      </button>
      <AddToPlaylistBtn song={song} />
    </div>
  </div>
));

/* ─────────────────────────────────────────────────────────────────────────────
   CACHE HELPERS
───────────────────────────────────────────────────────────────────────────── */
const CACHE_TTL = 12 * 60 * 60 * 1000;

function getSectionCache(genre, secId) {
  try {
    const raw = localStorage.getItem(`lb_sec2_${genre}_${secId}`);
    if (!raw) return null;
    const { items, expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(`lb_sec2_${genre}_${secId}`); return null; }
    return items;
  } catch { return null; }
}

function setSectionCache(genre, secId, items) {
  try {
    localStorage.setItem(`lb_sec2_${genre}_${secId}`, JSON.stringify({ items, expires: Date.now() + CACHE_TTL }));
  } catch {}
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export default function HomeOnline() {
  const [query,           setQuery]           = useState('');
  const [debouncedQ,      setDebouncedQ]      = useState('');
  const [localResults,    setLocalResults]    = useState([]);
  const [ytResults,       setYtResults]       = useState([]);
  const [ytSearching,     setYtSearching]     = useState(false);
  const [selectedGenre,   setSelectedGenre]   = useState('All');
  const [sections,        setSections]        = useState([]);
  const [forYou,          setForYou]          = useState([]);
  const [forYouLoading,   setForYouLoading]   = useState(false);
  const [showDetail,      setShowDetail]      = useState(false);
  const [selectedItem,    setSelectedItem]    = useState(null);
  const [trackStates, setTrackStates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lb:track_states') || '{}'); }
    catch { return {}; }
  });
  const [loadingId, setLoadingId] = useState(null);

  // Persist track interaction states across sessions
  useEffect(() => {
    try { localStorage.setItem('lb:track_states', JSON.stringify(trackStates)); }
    catch (_) {}
  }, [trackStates]);
  const [loading,         setLoading]         = useState(true);
  const [errorMsg,        setErrorMsg]        = useState(null);
  // Dominant-color accent for the detail view hero — same extraction Library.jsx
  // and Playlists.jsx use, so the tinted background behaves identically everywhere.
  const [detailAccentRGB, setDetailAccentRGB] = useState(ACCENT_FALLBACK);
  // Search now lives in a full‑screen overlay
  const [searchOpen,      setSearchOpen]      = useState(false);
  const [suggestionsVisible, setSuggestionsVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    return getSuggestionsVisibility(window.localStorage).isVisible;
  });
  const [suggestionsDisabledUntil, setSuggestionsDisabledUntil] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return Number(window.localStorage.getItem('lb:suggestionsDisabledUntil') || 0);
  });
  const [showCompactTransient, setShowCompactTransient] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth <= 640));

  const { show: showToast } = useToast();
  const { user, profile: authProfile } = useAuth();
  const ytSongRef   = useRef(null);
  const searchCache = useRef({});
  // Section fetches already issued this session (survives selectedGenre
  // toggling back and forth without re-triggering fetchSections' network
  // calls when the localStorage cache is still fresh — see fetchSections).
  const sectionFetchInFlight = useRef(new Set());
  const [openProfileId, setOpenProfileId] = useState(null);
  const { suggested, loadingSuggested, isFollowing, toggleFollow, getCounts } = useFollows();
  const {
    songs,
    setPlayerSongs,
    currentIndex,
    setCurrentIndex,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    downloadedSongs,
    currentSong,
  } = usePlayer();

  const playProfilePlaylist = useCallback((songs) => {
    if (!songs?.length) return;
    setPlayerSongs(songs, 0);
    setTimeout(() => setIsPlaying(true), 50);
    setOpenProfileId(null);
  }, [setPlayerSongs, setIsPlaying]);

  // downloadedSongs is the persisted library — never overwritten by queue changes
  // songs is the current playback queue — can include YouTube tracks
  const activeSong = currentSong ?? songs[currentIndex];

  // Greeting + username
  const greeting  = useMemo(() => getGreeting(), []);
  const firstName = useMemo(() => getFirstName(authProfile, user), [authProfile, user]);
  const avatarInitial = (firstName || authProfile?.username || user?.email || '?')[0]?.toUpperCase() || '?';

  /* ── Initial load ── */
  useEffect(() => { if (volume === 1) setVolume(0.2); }, []); // eslint-disable-line

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const visibility = getSuggestionsVisibility(window.localStorage);
      setSuggestionsVisible(visibility.isVisible);
      setSuggestionsDisabledUntil(visibility.disabledUntil || 0);
    }
  }, []);

  const { generatePlaylist: generateMood } = useMoodPlaylist();
  const { addPlaylist } = usePlaylists();
  const [moodSongs, setMoodSongs] = useState([]);
  const [moodLoading, setMoodLoading] = useState(false);
  const hour = (typeof window === 'undefined') ? new Date().getHours() : new Date().getHours();
  let moodSlot = null;
  let moodTitle = null;
  if (hour >= 5 && hour < 12) { moodSlot = 'morning'; moodTitle = 'Your Morning Mix'; }
  else if (hour >= 12 && hour < 17) { moodSlot = 'noon'; moodTitle = 'Your Noon Mix'; }
  else if (hour >= 17 && hour < 24) { moodSlot = 'evening'; moodTitle = 'Your Evening Mix'; }

  const daypartConfig = {
    morning: { prompt: 'bright upbeat tracks warm acoustic mellow hip-hop optimistic', cacheKey: 'lb:history_mood_morning' },
    noon: { prompt: 'chilled laid back downtempo soft grooves relaxed', cacheKey: 'lb:history_mood_noon' },
    evening: { prompt: 'warm electronic rnb smooth grooves evening energy', cacheKey: 'lb:history_mood_evening' },
  };

  // Track which daypart slot we've already resolved (from cache or a fresh
  // fetch) this mount, so a re-render — or generateMood's identity changing
  // between renders if the hook doesn't memoize it — can't trigger a second
  // network call for the same slot.
  const moodFetchedSlot = useRef(null);

  useEffect(() => {
    if (!moodSlot) return;
    if (moodFetchedSlot.current === moodSlot) return; // already resolved this slot this mount
    let mounted = true;
    async function ensureMood() {
      const config = daypartConfig[moodSlot];
      if (!config) return;
      const dismissedKey = `lb:history_mood_dismissed_until_${moodSlot}`;
      const dismissedUntil = Number(localStorage.getItem(dismissedKey) || 0);
      if (dismissedUntil > Date.now()) {
        setMoodSongs([]);
        setMoodLoading(false);
        moodFetchedSlot.current = moodSlot;
        return;
      }

      const cacheKey = config.cacheKey;
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - (parsed.ts || 0) < 4 * 60 * 60 * 1000 && Array.isArray(parsed.songs) && parsed.songs.length) {
            setMoodSongs(parsed.songs);
            setMoodLoading(false);
            moodFetchedSlot.current = moodSlot;
            return;
          }
        }

        setMoodLoading(true);
        const result = await generateMood(config.prompt, 20);
        if (!mounted) return;
        if (result && result.length) {
          setMoodSongs(result);
          try { localStorage.setItem(cacheKey, JSON.stringify({ songs: result, ts: Date.now() })); } catch (_) {}
        } else {
          setMoodSongs([]);
        }
        moodFetchedSlot.current = moodSlot;
      } catch (err) {
        console.error(`Mood mix generation failed for ${moodSlot}:`, err);
        setMoodSongs([]);
        moodFetchedSlot.current = moodSlot;
      } finally {
        if (mounted) setMoodLoading(false);
      }
    }
    ensureMood();
    return () => { mounted = false; };
  }, [moodSlot, generateMood]);

  function dismissMoodMix() {
    try {
      const key = `lb:history_mood_dismissed_until_${moodSlot}`;
      const until = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem(key, String(until));
      setMoodSongs([]);
    } catch (_) {}
  }

  // Auto-hide the small compact suggestions banner after 5 seconds, but only
  // show it when the cooldown window has elapsed (i.e. disabledUntil <= now).
  useEffect(() => {
    let id;
    const now = Date.now();
    const compactAllowed = !suggestionsVisible && (suggestionsDisabledUntil || 0) <= now;
    if (compactAllowed) {
      setShowCompactTransient(true);
      id = setTimeout(() => setShowCompactTransient(false), 5000);
    } else {
      setShowCompactTransient(false);
    }
    return () => clearTimeout(id);
  }, [suggestionsVisible, suggestionsDisabledUntil]);

  // Track small/mobile viewports for responsive tweaks
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    function onResize() { setIsMobileViewport(window.innerWidth <= 640); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (songs.length > 0) { setLoading(false); return; }
    fetchSongs()
      .then(data => {
        const all = Array.isArray(data) ? data : (data?.songs ?? []);
        setPlayerSongs(all);
      })
      .catch(() => {
        setPlayerSongs(downloadedSongs ?? []);
        setErrorMsg('Offline mode — showing downloaded songs only.');
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  /* ── Debounce ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  /* ── Search — ONLY searches, never touches the player queue.
     Routed through cachedSearchVideos so retyping/re-focusing the same
     query within a few minutes reuses the previous response instead of
     hitting YouTube again. ── */
  useEffect(() => {
    if (!debouncedQ.trim()) { setLocalResults([]); setYtResults([]); return; }
    let cancelled = false;
    const q = debouncedQ.toLowerCase();
    // Search in downloadedSongs (the persisted list), not songs (the queue)
    const base = (downloadedSongs && downloadedSongs.length > 0) ? downloadedSongs : songs;
    setLocalResults(base.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.artist?.toLowerCase().includes(q) ||
      s.album?.toLowerCase().includes(q)
    ));
    setYtSearching(true);
    cachedSearchVideos(debouncedQ, 10)
      .then(res => { if (!cancelled) setYtResults(res); })
      .catch(() => { if (!cancelled) setYtResults([]); })
      .finally(() => { if (!cancelled) setYtSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQ]); // eslint-disable-line

  /* ── Patch local song ── */
  const patchSong = useCallback(async (id, patch) => {
    // Always update the player queue in memory
    setPlayerSongs(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    // Only hit the SQLite API for local songs (not YouTube streams)
    if (id && !String(id).startsWith('yt_') && !String(id).startsWith('local_')) {
      try { await apiPatchSong(id, patch); }
      catch (e) { console.error('patchSong API:', e); }
    }
  }, [setPlayerSongs]);

  /* ── Play YouTube video (direct, no backend call) ── */
  const playYoutubeVideo = useCallback((video, itemId) => {
    setLoadingId(itemId ?? video.id);
    try {
      const ytSong = makeYtSong(video);
      ytSongRef.current = ytSong;
      const updatedQueue = [ytSong, ...(downloadedSongs && downloadedSongs.length > 0 ? downloadedSongs : songs).filter(s => !s.youtube)];
      setPlayerSongs(updatedQueue, 0);
      setTimeout(() => { setIsPlaying(true); setLoadingId(null); }, 80);
    } catch (err) {
      console.error('playYoutubeVideo failed:', err);
      setErrorMsg(`Couldn't play "${video.title}". Try another track.`);
      setTimeout(() => setErrorMsg(null), 4000);
      setLoadingId(null);
    }
  }, [downloadedSongs, songs, setPlayerSongs, setIsPlaying]);

  /* ── Play streaming song (uses youtubeId directly, cached search as fallback) ── */
  const playStreamingSong = useCallback(async (item) => {
    const knownId = item.youtubeId || (item.id?.startsWith('yt_') ? item.id.replace('yt_','') : null);
    if (knownId && /^[A-Za-z0-9_-]{11}$/.test(knownId)) {
      playYoutubeVideo({ id: knownId, title: item.name, channel: item.artist, thumbnail: item.cover, duration: item.duration }, item.id);
    } else {
      setLoadingId(item.id);
      try {
        const q = `${item.name} ${item.artist ?? ''} official audio`.trim();
        const cached = searchCache.current[q];
        if (cached) {
          playYoutubeVideo({ id: cached, title: item.name, channel: item.artist }, item.id);
        } else {
          const vids = await cachedSearchVideos(q, 1);
          if (!vids?.length) throw new Error('No results');
          searchCache.current[q] = vids[0].id;
          playYoutubeVideo(vids[0], item.id);
        }
      } catch (err) {
        console.error('playStreamingSong:', err);
        setErrorMsg(`Couldn't find "${item.name}" on YouTube.`);
        setTimeout(() => setErrorMsg(null), 4000);
        setLoadingId(null);
      }
    }
  }, [playYoutubeVideo]);

  /* ── Detail view (only for Downloaded and future album tiles) ── */
  const openDetail = useCallback((item) => {
    setSelectedItem(item);
    setShowDetail(true);
  }, []);

  const closeDetail = useCallback(() => {
    setShowDetail(false);
    setTimeout(() => setSelectedItem(null), 300);
  }, []);

  // Extract the hero tint from whatever's showing — same technique Library.jsx's
  // AlbumDetailView and Playlists.jsx's DetailView use, kept in sync here so all
  // three feel like one continuous UI rather than three reimplementations.
  useEffect(() => {
    let cancelled = false;
    const cover = selectedItem?.cover || selectedItem?.songs?.[0]?.cover || null;
    if (!cover) { setDetailAccentRGB(ACCENT_FALLBACK); return; }
    extractAccentRGB(cover).then(rgb => {
      if (!cancelled && rgb) setDetailAccentRGB(rgb);
    });
    return () => { cancelled = true; };
  }, [selectedItem]);

  const addToQueue = useCallback((song) => {
    if (!song) return;
    setPlayerSongs(prev => {
      const without = (Array.isArray(prev) ? prev : []).filter(s => s.id !== song.id);
      const idx = Math.max(0, (currentIndex ?? 0) + 1);
      const next = [...without];
      next.splice(idx, 0, { ...song });
      return next;
    });
  }, [setPlayerSongs, currentIndex]);

  const toggleFav = useCallback((id, current) => {
    const next = !current;
    setTrackStates(p => ({ ...p, [id]: { ...p[id], fav: next } }));
    patchSong(id, { favorite: next });
  }, [patchSong]);

  const toggleLiked = useCallback((id, current) => {
    const next = !current;
    setTrackStates(p => ({ ...p, [id]: { ...p[id], liked: next } }));
    patchSong(id, { liked: next });
  }, [patchSong]);

  /* ── Fetch sections — multiple queries per section for diversity.
     getSectionsForGenre() is now deterministic per day (see daySeed above),
     so the same genre reliably resolves to the same section ids + query
     subset. Combined with:
       - the 12h localStorage cache (getSectionCache/setSectionCache), and
       - the sectionFetchInFlight ref guard below, which skips kicking off a
         fetch for a genre+section that's already mid-flight this mount
         (covers React StrictMode's double-invoked effects in dev, and rapid
         genre-chip toggling back to a genre that's still loading)
     this only ever calls out to YouTube when there truly is no usable
     cached data yet. ── */
  const fetchSections = useCallback((genre) => {
    const chosen = getSectionsForGenre(genre);

    setSections(chosen.map(s => {
      const cached = getSectionCache(genre, s.id);
      return { ...s, items: cached || [], loading: !cached };
    }));

    chosen.forEach((sec, idx) => {
      if (getSectionCache(genre, sec.id)) return;

      const flightKey = `${genre}:${sec.id}`;
      if (sectionFetchInFlight.current.has(flightKey)) return; // already fetching this section
      sectionFetchInFlight.current.add(flightKey);

      // Fire multiple queries in parallel (deduped/cached via cachedSearchVideos),
      // merge + dedupe results
      const queryPromises = sec.queries.map(q =>
        cachedSearchVideos(q, 6).catch(() => [])
      );

      Promise.all(queryPromises).then(allResults => {
        const seen = new Set();
        const items = allResults
          .flat()
          .filter(v => {
            if (!isSingleTrack(v)) return false;
            if (seen.has(v.id)) return false;
            seen.add(v.id);
            return true;
          })
          .slice(0, 14)
          .map(v => ({
            id:        `yt_${v.id}`,
            name:      cleanTitle(v.title),
            artist:    v.channel,
            cover:     v.thumbnail || '/default-cover.png',
            accent:    '#1DB954',
            type:      'suggestion',
            genre:     sec.genre?.toLowerCase() || null,
            youtube:   true,
            youtubeId: v.id,
            duration:  v.duration || '0:00',
            badge:     sec.badge || null,
          }));

        setSectionCache(genre, sec.id, items);
        setSections(prev => prev.map((s, i) =>
          i === idx ? { ...s, items, loading: false } : s
        ));
      }).finally(() => {
        sectionFetchInFlight.current.delete(flightKey);
      });
    });
  }, []); // eslint-disable-line

  useEffect(() => { fetchSections(selectedGenre); }, [selectedGenre, fetchSections]); // eslint-disable-line

  /* ── Is card active ── */
  const isCardActive = useCallback((item) => {
    if (!activeSong) return false;
    if (activeSong.youtube && activeSong.youtubeId)
      return `yt_${activeSong.youtubeId}` === item.id || activeSong.name?.toLowerCase() === item.name?.toLowerCase();
    return activeSong.name?.toLowerCase() === item.name?.toLowerCase();
  }, [activeSong]);

  /* ── Fetch personalised "For You" recommendations ── */
  useEffect(() => {
    if (!user?.id) return;
    setForYouLoading(true);
    const BACKEND_URL = import.meta.env.VITE_YT_BACKEND_URL || 'http://localhost:3001';
    fetch(`${BACKEND_URL}/api/recommendations/${user.id}?limit=20`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.songs?.length) setForYou(data.songs); })
      .catch(() => {})
      .finally(() => setForYouLoading(false));
  }, [user?.id]); // eslint-disable-line

  // The downloaded list to show — always from downloadedSongs, never the queue
  const dlSongs = (downloadedSongs && downloadedSongs.length > 0) ? downloadedSongs : songs.filter(s => !s.youtube);

  /* ── "Top Picks for You" hero row — built entirely from data already
     fetched elsewhere in this component (mood mix + For You + trending
     fallback). No new fetches introduced. ── */
  const heroCards = useMemo(() => {
    const cards = [];

    if (moodSlot && (moodLoading || moodSongs.length > 0)) {
      cards.push({
        key: 'mood',
        loading: moodLoading,
        title: moodTitle,
        subtitle: 'Mix for you',
        cover: moodSongs[0]?.cover,
        onClick: () => moodSongs.length && openDetail({
          type: 'mood', name: moodTitle, cover: moodSongs[0]?.cover,
          accent: '#1DB954', songCount: moodSongs.length, songs: moodSongs,
        }),
      });
    }

    if (forYouLoading || forYou.length > 0) {
      cards.push({
        key: 'for-you',
        loading: forYouLoading,
        title: 'For You',
        subtitle: 'Based on your taste',
        cover: forYou[0]?.cover,
        badgeText: null,
        onClick: () => forYou[0] && playStreamingSong(forYou[0]),
      });
    } else if (sections[0]?.items?.length) {
      const sec = sections[0];
      cards.push({
        key: 'trending-fallback',
        loading: false,
        title: sec.title,
        subtitle: sec.items[0]?.artist ? `Featuring ${sec.items[0].artist}` : 'Trending now',
        cover: sec.items[0]?.cover,
        badgeText: sec.badge,
        onClick: () => sec.items[0] && playStreamingSong(sec.items[0]),
      });
    }

    return cards;
  }, [moodSlot, moodLoading, moodSongs, moodTitle, forYouLoading, forYou, sections, openDetail, playStreamingSong]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
  }, []);

  /* ─────────────────────────────────────────────────────────────────────
     DETAIL VIEW (Downloaded / future album tiles)
  ───────────────────────────────────────────────────────── */
  const renderDetail = () => {
    if (!selectedItem) return null;

    // Radio station detail view
    if (selectedItem.type === 'radio') {
      return <RadioDetailView onClose={closeDetail} />;
    }

    const songList = selectedItem.songs ?? [];
    const cover    = selectedItem.cover || songList[0]?.cover;
    const title    = selectedItem.name || 'Playlist';
    const subtitle = selectedItem.artist || songList[0]?.artist || 'Various Artists';

    const totalSeconds = songList.reduce((sum, s) => {
      const raw = s.durationSeconds ?? null;
      if (raw != null) return sum + raw;
      const parts = String(s.duration || s.formattedDuration || '').split(':').map(Number);
      if (parts.length === 2 && !parts.some(Number.isNaN)) return sum + parts[0] * 60 + parts[1];
      return sum;
    }, 0);
    const durationLabel = totalSeconds
      ? (totalSeconds >= 3600
          ? `${Math.floor(totalSeconds / 3600)} hr ${Math.round((totalSeconds % 3600) / 60)} min`
          : `${Math.round(totalSeconds / 60)} min`)
      : null;

    const playFromStart = () => {
      if (!songList.length) return;
      setPlayerSongs(songList, 0);
      setTimeout(() => setIsPlaying(true), 50);
    };
    const shuffleList = () => {
      if (!songList.length) return;
      setPlayerSongs([...songList].sort(() => Math.random() - 0.5), 0);
      setTimeout(() => setIsPlaying(true), 50);
    };

    return (
      <div className="lib-root" style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <style>{DETAIL_CSS}</style>
        <div className="lib-detail">

          <div
            className="lib-detail-tint"
            style={{
              background: `
                radial-gradient(ellipse 70% 42% at 50% 0%, rgba(${detailAccentRGB},0.38) 0%, transparent 62%),
                linear-gradient(180deg, rgba(${detailAccentRGB},0.30) 0%, rgba(${detailAccentRGB},0.10) 32%, #07080A 76%)
              `,
            }}
          />
          <div className="lib-detail-tint-scrim" />

          <div className="lib-detail-nav">
            <button className="lib-detail-nav-btn" onClick={closeDetail} aria-label="Back">
              <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 13 }} />
            </button>
            <DotsMenu song={selectedItem} songList={songList} onAddToQueue={() => addToQueue(selectedItem)} />
          </div>

          <div className="lib-detail-hero">
            <div className="lib-detail-art-wrap">
              <div className="lib-detail-art-glow" />
              <div className="lib-detail-art">
                {cover
                  ? <img src={cover} alt={title} onError={e => { e.target.src = '/default-cover.png'; }} />
                  : <div className="lib-detail-art-empty"><FaListUl /></div>
                }
              </div>
            </div>

            <h1 className="lib-detail-name">{title}</h1>
            <p className="lib-detail-subtitle">{subtitle}</p>
            <p className="lib-detail-metaline">
              {songList.length} song{songList.length !== 1 ? 's' : ''}{durationLabel ? ` · ${durationLabel}` : ''}
            </p>

            <div className="lib-detail-actions">
              <button className="lib-detail-circle-btn" onClick={shuffleList} title="Shuffle" aria-label="Shuffle play">
                <FaRandom />
              </button>
              <button className="lib-detail-play-pill" onClick={playFromStart}>
                <FaPlay style={{ fontSize: 13, marginLeft: 1 }} /> Play
              </button>
            </div>
          </div>

          <div className="lib-detail-divider" />

          <div className="lib-tracks">
            <div className="lib-tracks-label">Tracks · {songList.length}</div>
            {songList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t3)' }}>
                <FontAwesomeIcon icon={faCompactDisc} style={{ fontSize: 36, marginBottom: 14, display: 'block', margin: '0 auto 14px' }} />
                <p style={{ fontSize: 15 }}>No tracks available</p>
              </div>
            ) : songList.map((song, idx) => {
              const sId = song.id ?? `song-${idx}`;
              const globalIdx = songs.findIndex(s => s.id === song.id);
              const isActive = globalIdx === currentIndex;
              const ts = trackStates[sId] ?? {};
              return (
                <TrackRow key={sId} song={song} index={idx}
                  isActive={isActive} isPlaying={isPlaying}
                  isFav={ts.fav ?? song.favorite ?? false}
                  isLiked={ts.liked ?? song.liked ?? false}
                  onPlay={() => { if (globalIdx !== -1) { setCurrentIndex(globalIdx); setTimeout(() => setIsPlaying(true), 50); } }}
                  onFav={() => toggleFav(sId, ts.fav ?? song.favorite ?? false)}
                  onLike={() => toggleLiked(sId, ts.liked ?? song.liked ?? false)}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────────────
     SEARCH OVERLAY — full‑screen, opened via the header icon button.
     Reuses the same query/localResults/ytResults state the old inline
     search bar used, so behavior is identical — only presentation moved.
  ───────────────────────────────────────────────────────── */
  const renderSearchOverlay = () => {
    if (!searchOpen) return null;
    const hasAnyResults = localResults.length > 0 || ytResults.length > 0 || ytSearching;

    return (
      <div className="ho-search-overlay">
        <div className="ho-search-overlay-top">
          <FaSearch style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, flexShrink: 0 }} />
          <input
            autoFocus
            className="ho-search-overlay-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Artists, songs, albums…"
          />
          <button className="ho-search-overlay-close" onClick={closeSearch} aria-label="Close search">
            <FaTimes />
          </button>
        </div>

        <div className="ho-search-overlay-body">
          {!query.trim() && (
            <div className="ho-search-overlay-empty">
              Start typing to search your library and YouTube.
            </div>
          )}

          {localResults.length > 0 && (
            <>
              <div style={{ padding:'8px 16px 4px', fontSize:11, fontWeight:700, color:'rgba(255,255,255,.35)', letterSpacing:'.1em', textTransform:'uppercase' }}>Library</div>
              {localResults.slice(0,8).map((song,i) => (
                <div key={song.id??i} className="ho-search-row" onClick={() => {
                  // Play from the downloaded list, not the current queue
                  const baseList = (downloadedSongs?.length>0) ? downloadedSongs : songs;
                  const idx = baseList.findIndex(s => s.id === song.id);
                  if (idx !== -1) {
                    setPlayerSongs(baseList, idx);
                    setTimeout(() => setIsPlaying(true), 50);
                  }
                  closeSearch();
                }}>
                  <img src={song.cover} alt={song.name} style={{ width:44, height:44, borderRadius:8, objectFit:'cover', flexShrink:0 }}
                    onError={e => { e.target.src='/default-cover.png'; }} />
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:14, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.name}</p>
                    <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.artist}</p>
                  </div>
                </div>
              ))}
            </>
          )}

          {ytSearching && (
            <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:10, color:'rgba(255,255,255,.5)', fontSize:13 }}>
              <div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid rgba(255,255,255,.15)', borderTopColor:'var(--lb-green)', animation:'ho-spin .7s linear infinite' }} />
              Searching YouTube…
            </div>
          )}

          {ytResults.length > 0 && (
            <>
              <div style={{ padding:'8px 16px 4px', display:'flex', alignItems:'center', gap:8, fontSize:11, fontWeight:700, color:'rgba(255,255,255,.35)', letterSpacing:'.1em', textTransform:'uppercase' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF4444"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                YouTube
              </div>
              {ytResults.slice(0,8).map(v => (
                <div key={v.id} className="ho-search-row" onClick={() => { playYoutubeVideo(v, v.id); closeSearch(); }}>
                  <img src={v.thumbnail} alt={v.title} style={{ width:44, height:44, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:14, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.title}</p>
                    <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.channel}</p>
                  </div>
                </div>
              ))}
            </>
          )}

          {query.trim() && !hasAnyResults && (
            <div className="ho-search-overlay-empty">No results found.</div>
          )}
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────────────
     MAIN HOME RENDER
  ───────────────────────────────────────────────────────── */
  return (
    <>
      <style>{STYLES}</style>
      <div className="ho-root" style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {loading && songs.length === 0 && <Loader />}

        {showDetail ? renderDetail() : (
          /* Single scroll region — greeting, hero cards, chips, and every
             shelf below now scroll together as one page instead of the
             header staying pinned above a separately‑scrolling body. */
          <div className="ho-scroll-all">

            {/* ── HEADER: big bold greeting + search icon + own-avatar ── */}
            <div className="ho-hero">
              <div className="ho-hero-text">
                <h1 className="ho-greeting">
                  {firstName ? <>{greeting}, {firstName}</> : greeting}
                </h1>
                <p className="ho-greeting-sub">Stream millions of songs · Discover new music daily</p>
              </div>
              <div className="ho-hero-actions">
                <button
                  className="ho-search-icon-btn"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                >
                  <FaSearch style={{ fontSize: 15 }} />
                </button>
                <div className="ho-avatar-btn" aria-hidden="true">
                  {authProfile?.avatar_url
                    ? <img src={authProfile.avatar_url} alt="" onError={e => { e.target.style.display = 'none'; }} />
                    : avatarInitial}
                </div>
              </div>
            </div>

            {/* ── TOP PICKS FOR YOU — hero card row ── */}
            {heroCards.length > 0 && (
              <div className="ho-hero-cards">
                {heroCards.map(card => (
                  <HeroCard
                    key={card.key}
                    title={card.title}
                    subtitle={card.subtitle}
                    cover={card.cover}
                    badgeText={card.badgeText}
                    loading={card.loading}
                    onClick={card.onClick}
                  />
                ))}
              </div>
            )}

            {/* ── GENRE CHIPS ── */}
            <div className="ho-chips-row">
              {GENRES.map(g => (
                <button key={g} className={`ho-chip${selectedGenre===g?' active':''}`} onClick={() => setSelectedGenre(g)}>{g}</button>
              ))}
            </div>

            {/* ── ERROR BANNER ── */}
            {errorMsg && (
              <div className="ho-error-banner">
                <FontAwesomeIcon icon={faBolt} style={{ fontSize:12 }} />
                {errorMsg}
              </div>
            )}

            {/* ── PEOPLE TO FOLLOW ── */}
            {suggestionsVisible ? (
              <PeopleRow
                people={suggested}
                loading={loadingSuggested}
                isFollowing={isFollowing}
                onToggleFollow={toggleFollow}
                onOpenProfile={(person) => setOpenProfileId(person.id)}
                onDismiss={() => {
                  setSuggestionsVisible(false);
                  const nextState = setSuggestionsVisibility(false, window.localStorage);
                  setSuggestionsDisabledUntil(nextState.disabledUntil);
                }}
                onToggleVisibility={() => {
                  const nextState = setSuggestionsVisibility(!suggestionsVisible, window.localStorage);
                  setSuggestionsVisible(nextState.isVisible);
                  setSuggestionsDisabledUntil(nextState.disabledUntil);
                }}
                visible={suggestionsVisible}
                disabledUntil={suggestionsDisabledUntil}
              />
            ) : (
              showCompactTransient && (
                <section
                  style={{
                    marginBottom: 12,
                    padding: isMobileViewport ? '8px 12px' : '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    margin: '0 28px 12px',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 8, background: 'var(--lb-green, #1DB954)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '.12em' }}>Suggestions</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Hidden for a short cooldown. Bring them back anytime.</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = setSuggestionsVisibility(true, window.localStorage);
                        setSuggestionsVisible(nextState.isVisible);
                        setSuggestionsDisabledUntil(nextState.disabledUntil);
                      }}
                      style={{ padding: '6px 10px', borderRadius: 999, background: 'var(--lb-green, #1DB954)', color: '#000', fontWeight: 700, border: 'none', fontSize: 13 }}
                    >
                      Show
                    </button>
                  </div>
                </section>
              )
            )}

            {/* ── FOR YOU — spotlight top track, shelf for the rest ── */}
            {(forYou.length > 0 || forYouLoading) && (
              <section style={{ marginBottom:32 }}>
                <div className="ho-section-head">
                  <div className="ho-section-title">
                    <span className="ho-section-dot" />
                    <span className="ho-section-name">For You</span>
                  </div>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>
                    Based on your taste
                  </span>
                </div>
                {!forYouLoading && forYou.length > 0 && (
                  <Spotlight
                    item={forYou[0]}
                    eyebrow="Top pick for you"
                    badge={null}
                    accent="#1DB954"
                    onPlay={() => playStreamingSong(forYou[0])}
                  />
                )}
                <div className="ho-shelf">
                  {forYouLoading
                    ? Array.from({ length: 6 }).map((_,i) => (
                        <div key={i} className="ho-shimmer-card">
                          <div className="ho-shimmer" style={{ height:160, borderRadius:15 }} />
                          <div style={{ padding:'8px 0 0' }}>
                            <div className="ho-shimmer" style={{ height:11, width:'80%', borderRadius:6 }} />
                          </div>
                        </div>
                      ))
                    : forYou.slice(1).map(item => {
                        const isActive = currentSong?.id === item.id || currentSong?.youtubeId === item.youtubeId;
                        return (
                          <SongCard
                            key={item.id}
                            item={item}
                            isActive={isActive}
                            isPlaying={isPlaying}
                            onPlay={() => playStreamingSong(item)}
                            loadingId={loadingId}
                          />
                        );
                      })
                  }
                </div>
              </section>
            )}

            {/* Dynamic sections — spotlight for badge sections, colored
                accent per genre for plain sections, so scrolling past
                Rock/Classical/etc. reads as distinct blocks rather than
                identical rows repeated. */}
            {sections.map(sec => {
              const accent = sec.badge ? getBadgeAccent(sec.badge) : getGenreAccent(sec.genre);
              const hasSpotlight = !!sec.badge && !sec.loading && sec.items.length > 0;
              const shelfItems = hasSpotlight ? sec.items.slice(1) : sec.items;

              return (
                <section key={sec.id} style={{ marginBottom:32 }}>
                  <div className="ho-section-head">
                    <div className="ho-section-title">
                      <span className="ho-section-dot" style={{ background: accent }} />
                      <div>
                        <h2>{sec.title}</h2>
                        {!sec.badge && (
                          <div className="ho-section-accent-bar" style={{ background: accent }} />
                        )}
                      </div>
                      {sec.badge === 'NEW'  && <span className="ho-badge-new">{sec.badge}</span>}
                      {sec.badge === 'HOT'  && <span className="ho-badge-hot">{sec.badge}</span>}
                      {sec.badge && !['NEW','HOT'].includes(sec.badge) && <span style={{ fontSize:14 }}>{sec.badge}</span>}
                      {!sec.loading && sec.items.length > 0 && (
                        <span style={{ fontSize:12, color:'var(--lb-text-3)', fontWeight:500 }}>{sec.items.length}</span>
                      )}
                    </div>
                  </div>

                  {sec.loading ? (
                    <ShimmerShelf count={6} />
                  ) : sec.items.length === 0 ? null : (
                    <>
                      {hasSpotlight && (
                        <Spotlight
                          item={sec.items[0]}
                          eyebrow={sec.title}
                          badge={sec.badge}
                          accent={accent}
                          onPlay={() => playStreamingSong(sec.items[0])}
                        />
                      )}
                      {shelfItems.length > 0 && (
                        <div className="ho-shelf">
                          {shelfItems.map(item => (
                            <SongCard
                              key={item.id}
                              item={item}
                              isActive={isCardActive(item)}
                              isPlaying={isPlaying}
                              loadingId={loadingId}
                              onPlay={() => playStreamingSong(item)}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </section>
              );
            })}

            {/* ── DOWNLOADED SECTION ── */}
            <section style={{ marginBottom:32 }}>
              <div className="ho-section-head">
                <div className="ho-section-title">
                  <span className="ho-section-dot" style={{ background:'rgba(29,185,84,0.6)' }} />
                  <h2>Downloaded</h2>
                  {dlSongs.length > 0 && (
                    <span style={{ fontSize:12, color:'var(--lb-text-3)', fontWeight:500 }}>{dlSongs.length}</span>
                  )}
                </div>
                {dlSongs.length > 0 && (
                  <button
                    className="ho-see-all"
                    aria-label="See all downloaded songs"
                    onClick={() => openDetail({
                      type:'downloaded', name:'Downloaded Songs',
                      cover:dlSongs[0]?.cover, accent:'#1DB954',
                      songCount:dlSongs.length, songs:dlSongs,
                    })}
                  >
                    <FaChevronRight style={{ fontSize:10 }} />
                  </button>
                )}
              </div>

              {dlSongs.length > 0 ? (
                <div className="ho-shelf">
                  {/* Smart Radio tile — always first in the Downloaded shelf */}
                  <RadioTile
                    songs={dlSongs}
                    onShowDetail={() => openDetail({ type: 'radio' })}
                  />

                  {/* Summary mosaic tile */}
                  <div className="ho-dl-tile" onClick={() => openDetail({
                    type:'downloaded', name:'Downloaded Songs',
                    cover:dlSongs[0]?.cover, accent:'#1DB954',
                    songCount:dlSongs.length, songs:dlSongs,
                  })}>
                    <div className="ho-dl-mosaic">
                      {[0,1,2,3].map(i => (
                        <img key={i}
                          src={dlSongs[i]?.cover ?? dlSongs[0]?.cover ?? '/default-cover.png'}
                          alt=""
                          onError={e => { e.target.src='/default-cover.png'; }}
                        />
                      ))}
                    </div>
                    <div className="ho-dl-info">
                      <p className="ho-dl-name">Downloaded</p>
                      <p className="ho-dl-count">{dlSongs.length} songs</p>
                    </div>
                    <button className="ho-dl-play" onClick={e => {
                      e.stopPropagation();
                      setPlayerSongs(dlSongs, 0);
                      setTimeout(() => setIsPlaying(true), 50);
                    }}>
                      <FaPlay style={{ color:'#fff', fontSize:12, marginLeft:2 }} />
                    </button>
                  </div>

                  {/* Individual song tiles (first 8) */}
                  {dlSongs.slice(0,8).map(song => {
                    const isActive = activeSong?.id === song.id;
                    return (
                      <SongCard
                        key={song.id}
                        item={{ ...song, badge: null }}
                        isActive={isActive}
                        isPlaying={isPlaying}
                        loadingId={loadingId}
                        onPlay={() => {
                          const idx = dlSongs.findIndex(s => s.id === song.id);
                          if (idx !== -1) {
                            setPlayerSongs(dlSongs, idx);
                            setTimeout(() => setIsPlaying(true), 50);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div style={{ margin:'0 28px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'40px 24px', textAlign:'center' }}>
                  <FontAwesomeIcon icon={faCircleArrowDown} style={{ fontSize:28, color:'var(--lb-text-3)', marginBottom:12, display:'block', margin:'0 auto 12px' }} />
                  <p style={{ fontSize:15, color:'var(--lb-text-2)', marginBottom:4 }}>No downloads yet</p>
                  <p style={{ fontSize:13, color:'var(--lb-text-3)' }}>Download songs for offline listening</p>
                </div>
              )}
            </section>
          </div>
        )}

        {renderSearchOverlay()}

        {openProfileId && (
          <ProfileDetailView
            profileId={openProfileId}
            isFollowing={isFollowing}
            onToggleFollow={toggleFollow}
            getCounts={getCounts}
            onClose={() => setOpenProfileId(null)}
            onPlayPlaylist={playProfilePlaylist}
          />
        )}

        <PlayerControls />
      </div>
    </>
  );
}