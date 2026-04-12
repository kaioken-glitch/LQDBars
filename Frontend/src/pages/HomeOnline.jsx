import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { usePlaylists, LIBRARY_PLAYLIST_ID } from '../hooks/usePlaylists';
import { useToast } from '../components/Toast';
import {
  FaSearch, FaStar, FaHeart, FaPlay, FaRandom, FaPause,
  FaPlus, FaDownload, FaShareAlt, FaListUl, FaChevronRight,
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

/* Pick sections for the active genre. For each section, pick MULTIPLE queries
   from the pool so results are diverse. */
function getSectionsForGenre(genre) {
  if (genre === 'All') {
    const bonus  = SECTION_DEFINITIONS.filter(s => s.genre === null);
    const genre_ = SECTION_DEFINITIONS.filter(s => s.genre !== null);
    const picked = [
      ...bonus.sort(() => Math.random() - 0.5).slice(0, 2),
      ...genre_.sort(() => Math.random() - 0.5).slice(0, 2),
    ];
    return picked.map(sec => ({ ...sec, queries: pickQueries(sec.pool, 4) }));
  }
  const match = SECTION_DEFINITIONS.find(s => s.genre?.toLowerCase() === genre.toLowerCase());
  if (!match) return [];
  return [{ ...match, queries: pickQueries(match.pool, 6) }];
}

/* Pick N distinct queries at random from the pool */
function pickQueries(pool, n) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, pool.length));
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

  /* ── Greeting hero ── */
  .ho-hero {
    padding: 32px 28px 24px;
    position: relative;
    flex-shrink: 0;
  }
  .ho-greeting {
    font-family: 'Syne', sans-serif;
    font-size: clamp(26px, 3.5vw, 40px);
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.1;
    color: #fff;
    margin-bottom: 4px;
  }
  .ho-greeting-sub {
    font-size: 13px;
    color: rgba(255,255,255,0.38);
    font-weight: 400;
  }

  /* ── Search bar ── */
  .ho-search-wrap {
    padding: 0 28px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .ho-search-box {
    position: relative;
    flex: 1;
    max-width: 400px;
  }
  .ho-search-input {
    width: 100%;
    padding: 10px 16px 10px 40px;
    border-radius: 12px;
    font-size: 14px;
    color: var(--lb-text-1);
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.09);
    transition: border-color 0.2s, background 0.2s;
    font-family: 'DM Sans', sans-serif;
  }
  .ho-search-input:focus {
    outline: none;
    border-color: rgba(29,185,84,0.5);
    background: rgba(255,255,255,0.09);
    box-shadow: 0 0 0 3px rgba(29,185,84,0.10);
  }
  .ho-search-icon {
    position: absolute;
    left: 13px; top: 50%;
    transform: translateY(-50%);
    color: rgba(255,255,255,0.3);
    font-size: 13px;
    pointer-events: none;
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
    font-size: 18px;
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
  .ho-see-all {
    font-size: 12px;
    font-weight: 600;
    color: var(--lb-green);
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0.8;
    transition: opacity 0.15s;
    font-family: 'DM Sans', sans-serif;
  }
  .ho-see-all:hover { opacity: 1; }

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

  /* ── TiltedCard ── */
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

  /* ── Downloaded tile ── */
  .ho-dl-tile {
    flex-shrink: 0;
    width: 190px;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(29,185,84,0.08);
    border: 1px solid rgba(29,185,84,0.18);
    cursor: pointer;
    transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1),
                border-color 0.22s, box-shadow 0.22s;
    position: relative;
  }
  .ho-dl-tile:hover {
    transform: translateY(-3px) scale(1.02);
    border-color: rgba(29,185,84,0.4);
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
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

  /* ── Search dropdown ── */
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
  }
  .ho-search-row:hover { background: rgba(255,255,255,0.06); }

  /* ── Track row (detail view) ── */
  .ho-track {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px; border-radius: 10px;
    cursor: pointer; transition: background 0.15s; position: relative;
  }
  .ho-track:hover { background: rgba(255,255,255,0.06); }
  .ho-track.active { background: rgba(29,185,84,0.10); }
  .ho-track .ho-track-actions { display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity 0.15s; }
  .ho-track:hover .ho-track-actions { opacity: 1; }

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

/* ─── TiltedCard — 3D hover card ─────────────────────────────────── */
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

/* Song card — wraps TiltedCard with item data */
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
  <div className={`ho-track${isActive?' active':''}`} onClick={onPlay}>
    <span style={{ width:28, textAlign:'center', fontSize:12, color:'var(--lb-text-3)', flexShrink:0 }}>
      {isActive && isPlaying ? <WaveIcon /> : String(index+1).padStart(2,'0')}
    </span>
    <div style={{ width:40, height:40, borderRadius:8, overflow:'hidden', flexShrink:0 }}>
      <img src={song.cover} alt={song.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}
        onError={e => { e.target.src='/default-cover.png'; }} />
    </div>
    <div style={{ flex:1, minWidth:0 }}>
      <p style={{ fontSize:14, fontWeight:600, color:isActive?'var(--lb-green)':'var(--lb-text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.name}</p>
      <p style={{ fontSize:12, color:'var(--lb-text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.artist}</p>
    </div>
    <div className="ho-track-actions">
      <button onClick={e=>{e.stopPropagation();onFav();}} style={{ width:28, height:28, borderRadius:'50%', border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <FaStar style={{ fontSize:11, color:isFav?'#FFD600':'var(--lb-text-3)' }} />
      </button>
      <button onClick={e=>{e.stopPropagation();onLike();}} style={{ width:28, height:28, borderRadius:'50%', border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <FaHeart style={{ fontSize:11, color:isLiked?'#FF4455':'var(--lb-text-3)' }} />
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
  const [detailBg,        setDetailBg]        = useState('#1a1a1a');
  const [searchFocused,   setSearchFocused]   = useState(false);

  const { show: showToast } = useToast();
  const { user, profile: authProfile } = useAuth();
  const ytSongRef   = useRef(null);
  const searchCache = useRef({});

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

  // downloadedSongs is the persisted library — never overwritten by queue changes
  // songs is the current playback queue — can include YouTube tracks
  const activeSong = currentSong ?? songs[currentIndex];

  // Greeting + username
  const greeting  = useMemo(() => getGreeting(), []);
  const firstName = useMemo(() => getFirstName(authProfile, user), [authProfile, user]);

  /* ── Initial load ── */
  useEffect(() => { if (volume === 1) setVolume(0.2); }, []); // eslint-disable-line

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

  /* ── Search — ONLY searches, never touches the player queue ── */
  useEffect(() => {
    if (!debouncedQ.trim()) { setLocalResults([]); setYtResults([]); return; }
    const q = debouncedQ.toLowerCase();
    // Search in downloadedSongs (the persisted list), not songs (the queue)
    const base = (downloadedSongs && downloadedSongs.length > 0) ? downloadedSongs : songs;
    setLocalResults(base.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.artist?.toLowerCase().includes(q) ||
      s.album?.toLowerCase().includes(q)
    ));
    setYtSearching(true);
    youtubeConverter.searchVideos(debouncedQ, 10)
      .then(setYtResults)
      .catch(() => setYtResults([]))
      .finally(() => setYtSearching(false));
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

  /* ── Play streaming song (uses youtubeId directly, search as fallback) ── */
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
          const vids = await youtubeConverter.searchVideos(q, 1);
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
    setDetailBg(item.accent || '#1a2a1a');
    setShowDetail(true);
  }, []);

  const closeDetail = useCallback(() => {
    setShowDetail(false);
    setTimeout(() => setSelectedItem(null), 300);
  }, []);

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

  /* ── Fetch sections — multiple queries per section for diversity ── */
  const fetchSections = useCallback((genre) => {
    const chosen = getSectionsForGenre(genre);

    setSections(chosen.map(s => {
      const cached = getSectionCache(genre, s.id);
      return { ...s, items: cached || [], loading: !cached };
    }));

    chosen.forEach((sec, idx) => {
      if (getSectionCache(genre, sec.id)) return;

      // Fire multiple queries in parallel, merge + dedupe results
      const queryPromises = sec.queries.map(q =>
        youtubeConverter.searchVideos(q, 6).catch(() => [])
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

  const showDropdown = searchFocused && query.trim() && (localResults.length > 0 || ytResults.length > 0 || ytSearching);

  // The downloaded list to show — always from downloadedSongs, never the queue
  const dlSongs = (downloadedSongs && downloadedSongs.length > 0) ? downloadedSongs : songs.filter(s => !s.youtube);

  /* ─────────────────────────────────────────────────────────────────────
     DETAIL VIEW (Downloaded / future album tiles)
  ───────────────────────────────────────────────────────── */
  const renderDetail = () => {
    if (!selectedItem) return null;
    const songList  = selectedItem.songs ?? [];
    const cover     = selectedItem.cover || songList[0]?.cover;
    const title     = selectedItem.name || 'Downloaded';
    const subtitle  = selectedItem.songCount ? `${selectedItem.songCount} songs` : (selectedItem.artist || '');
    const typeLabel = selectedItem.type === 'downloaded' ? 'LOCAL LIBRARY' : (selectedItem.type?.replace('-',' ').toUpperCase() || 'PLAYLIST');

    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', inset:0, zIndex:0, background:`linear-gradient(160deg,${detailBg}55 0%,#0A0A0A 45%)`, pointerEvents:'none' }} />

        {/* Header */}
        <div style={{ position:'sticky', top:0, zIndex:20, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(10,10,10,.7)', backdropFilter:'blur(24px)', borderBottom:'1px solid var(--lb-border-1)', flexShrink:0 }}>
          <button onClick={closeDetail} className="lb-icon-btn">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize:14 }} />
          </button>
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15 }}>{title}</span>
          <div style={{ display:'flex', gap:8, alignItems:'center', position:'relative' }}>
            <button className="lb-icon-btn"><FaHeart style={{ fontSize:14 }} /></button>
            <DotsMenu song={selectedItem} songList={songList} onAddToQueue={() => addToQueue(selectedItem)} />
          </div>
        </div>

        {/* Hero */}
        <div style={{ position:'relative', zIndex:1, padding:'20px 24px 16px', display:'flex', gap:20, alignItems:'center', flexShrink:0 }}>
          <div style={{ position:'relative', flexShrink:0 }}>
            <div style={{ position:'absolute', inset:-6, borderRadius:20, background:`radial-gradient(circle,${detailBg}60 0%,transparent 70%)`, filter:'blur(16px)', zIndex:0 }} />
            <img src={cover||'/default-cover.png'} alt={title}
              style={{ position:'relative', zIndex:1, width:130, height:130, borderRadius:14, objectFit:'cover', boxShadow:'0 20px 60px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.1)' }}
              onError={e => { e.target.src='/default-cover.png'; }} />
            <div style={{ position:'absolute', top:-6, right:-6, zIndex:2, width:24, height:24, borderRadius:'50%', background:'var(--lb-green)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(29,185,84,.5)' }}>
              <FontAwesomeIcon icon={faCircleArrowDown} style={{ color:'#fff', fontSize:10 }} />
            </div>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:10, fontWeight:700, color:'var(--lb-green)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:5 }}>{typeLabel}</p>
            <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(18px,3.5vw,32px)', fontWeight:800, letterSpacing:'-0.03em', lineHeight:1.1, color:'#fff', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</h1>
            <p style={{ fontSize:13, color:'var(--lb-text-2)', marginBottom:14 }}>{subtitle}</p>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              <button onClick={() => { if (songList.length) { setPlayerSongs(songList); setCurrentIndex(0); setTimeout(() => setIsPlaying(true), 50); } }}
                className="lb-btn-primary" style={{ width:52, height:52, padding:0, borderRadius:'50%' }}>
                <FaPlay style={{ fontSize:18, marginLeft:3 }} />
              </button>
              <button className="lb-btn-ghost" style={{ height:40, padding:'0 18px', fontSize:13 }}>
                <FaRandom style={{ fontSize:12 }} /> Shuffle
              </button>
            </div>
          </div>
        </div>

        <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'0 20px', flexShrink:0 }} />

        {/* Track list */}
        <div style={{ position:'relative', zIndex:1, flex:1, overflowY:'auto', padding:'12px 16px 24px' }}>
          {songList.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--lb-text-3)' }}>
              <FontAwesomeIcon icon={faCompactDisc} style={{ fontSize:36, marginBottom:14, display:'block', margin:'0 auto 14px' }} />
              <p style={{ fontSize:15 }}>No tracks available</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--lb-text-3)', letterSpacing:'.1em', textTransform:'uppercase', padding:'0 12px 10px' }}>
                Tracks · {songList.length}
              </p>
              {songList.map((song, idx) => {
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
            </>
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
          <>
            {/* ── GREETING HERO ── */}
            <div className="ho-hero">
              <h1 className="ho-greeting">
                {firstName ? <>{greeting}, {firstName}</> : greeting}
              </h1>
              <p className="ho-greeting-sub">Stream millions of songs · Discover new music daily</p>
            </div>

            {/* ── SEARCH + GENRE CHIPS ── */}
            <div className="ho-search-wrap">
              <div className="ho-search-box" style={{ position:'relative' }}>
                <FaSearch className="ho-search-icon" />
                <input
                  className="ho-search-input"
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  placeholder="Artists, songs, albums…"
                />
                {showDropdown && (
                  <div className="ho-dropdown" style={{ position:'absolute', top:'calc(100% + 8px)', left:0, right:0, zIndex:100 }}>
                    {localResults.length > 0 && (
                      <>
                        <div style={{ padding:'8px 16px 4px', fontSize:11, fontWeight:700, color:'var(--lb-text-3)', letterSpacing:'.1em', textTransform:'uppercase' }}>Library</div>
                        {localResults.slice(0,4).map((song,i) => (
                          <div key={song.id??i} className="ho-search-row" onClick={() => {
                            setQuery(song.name);
                            // Play from the downloaded list, not the current queue
                            const baseList = (downloadedSongs?.length>0) ? downloadedSongs : songs;
                            const idx = baseList.findIndex(s => s.id === song.id);
                            if (idx !== -1) {
                              setPlayerSongs(baseList);
                              setCurrentIndex(idx);
                              setTimeout(() => setIsPlaying(true), 50);
                            }
                          }}>
                            <img src={song.cover} alt={song.name} style={{ width:38, height:38, borderRadius:7, objectFit:'cover', flexShrink:0 }} />
                            <div style={{ minWidth:0 }}>
                              <p style={{ fontSize:14, fontWeight:600, color:'var(--lb-text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.name}</p>
                              <p style={{ fontSize:12, color:'var(--lb-text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.artist}</p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {ytSearching && (
                      <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:10, color:'var(--lb-text-2)', fontSize:13 }}>
                        <div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid rgba(255,255,255,.15)', borderTopColor:'var(--lb-green)', animation:'ho-spin .7s linear infinite' }} />
                        Searching YouTube…
                      </div>
                    )}
                    {ytResults.length > 0 && (
                      <>
                        <div style={{ padding:'8px 16px 4px', display:'flex', alignItems:'center', gap:8, fontSize:11, fontWeight:700, color:'var(--lb-text-3)', letterSpacing:'.1em', textTransform:'uppercase' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF4444"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                          YouTube
                        </div>
                        {ytResults.slice(0,5).map(v => (
                          <div key={v.id} className="ho-search-row" onClick={() => { setQuery(''); playYoutubeVideo(v, v.id); }}>
                            <img src={v.thumbnail} alt={v.title} style={{ width:38, height:38, borderRadius:7, objectFit:'cover', flexShrink:0 }} />
                            <div style={{ minWidth:0 }}>
                              <p style={{ fontSize:14, fontWeight:600, color:'var(--lb-text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.title}</p>
                              <p style={{ fontSize:12, color:'var(--lb-text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.channel}</p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

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

            {/* ── SCROLLABLE CONTENT ── */}
            <div style={{ flex:1, overflowY:'auto', paddingBottom:100 }}>

              {/* ── FOR YOU shelf — personalised recommendations ── */}
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
                      : forYou.map(item => {
                          const isActive = currentSong?.id === item.id || currentSong?.youtubeId === item.youtubeId;
                          return (
                            <SongCard
                              key={item.id}
                              item={item}
                              isActive={isActive}
                              isPlaying={isPlaying}
                              onPlay={() => handlePlay(item)}
                              loadingId={loadingId}
                            />
                          );
                        })
                    }
                  </div>
                </section>
              )}

              {/* Dynamic sections — horizontal shelves */}
              {sections.map(sec => (
                <section key={sec.id} style={{ marginBottom:32 }}>
                  <div className="ho-section-head">
                    <div className="ho-section-title">
                      <span className="ho-section-dot" />
                      <h2>{sec.title}</h2>
                      {sec.badge === 'NEW'  && <span className="ho-badge-new">{sec.badge}</span>}
                      {sec.badge === 'HOT'  && <span className="ho-badge-hot">{sec.badge}</span>}
                      {sec.badge && !['NEW','HOT'].includes(sec.badge) && <span style={{ fontSize:14 }}>{sec.badge}</span>}
                      {!sec.loading && sec.items.length > 0 && (
                        <span style={{ fontSize:12, color:'var(--lb-text-3)', fontWeight:500 }}>{sec.items.length}</span>
                      )}
                    </div>
                  </div>

                  {sec.loading
                    ? <ShimmerShelf count={6} />
                    : sec.items.length === 0
                    ? null
                    : (
                      <div className="ho-shelf">
                        {sec.items.map(item => (
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
                    )
                  }
                </section>
              ))}

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
                    <button className="ho-see-all" onClick={() => openDetail({
                      type:'downloaded', name:'Downloaded Songs',
                      cover:dlSongs[0]?.cover, accent:'#1DB954',
                      songCount:dlSongs.length, songs:dlSongs,
                    })}>
                      See all <FaChevronRight style={{ fontSize:9 }} />
                    </button>
                  )}
                </div>

                {dlSongs.length > 0 ? (
                  <div className="ho-shelf">
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
                        setPlayerSongs(dlSongs);
                        setCurrentIndex(0);
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
                              setPlayerSongs(dlSongs);
                              setCurrentIndex(idx);
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
          </>
        )}
      </div>
    </>
  );
}