import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { usePlaylists, LIBRARY_PLAYLIST_ID } from '../hooks/usePlaylists';
import { useToast } from '../components/Toast';
import { FaSearch, FaStar, FaHeart, FaPlay, FaRandom, FaPause, FaSpinner, FaPlus, FaDownload, FaShareAlt, FaListUl } from 'react-icons/fa';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleArrowDown, faChevronLeft, faEllipsisH, faCompactDisc, faBolt } from '@fortawesome/free-solid-svg-icons';
import { fetchSongs, patchSong as apiPatchSong } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import PlayerControls from '../components/PlayerControls';
import youtubeConverter from '../utils/youtubeConverter';
import Loader from '../utils/Splashscreen';

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────────────── */

const GENRES = ['All', 'Hip-Hop', 'Pop', 'Rock', 'Jazz', 'Electronic', 'Classical', 'R&B', 'Blues'];

/* ─────────────────────────────────────────────────────────────────────────────
   DYNAMIC SECTION SYSTEM
   ─────────────────────────────────────────────────────────────────────────────
   Instead of hardcoded cards, each section holds a POOL of search queries.
   On every load we pick a random subset, fetch real YouTube results, and
   render those. Zero placeholders, always fresh content.

   PERSONALISATION HOOK (Phase 2):
   ─────────────────────────────────────────────────────────────────────────────
   When the user has enough listening history (tracked in PlayerContext →
   Supabase listening_history), call buildPersonalisedSections(prefs) instead
   of SECTION_DEFINITIONS to get queries like:
     "kendrick lamar type beat"  ← from top artist
     "hip-hop playlist 2024"     ← from top genre
     "songs like luther"         ← from most replayed song
   The fetch logic below is identical — only the queries change.
────────────────────────────────────────────────────────────────────────────── */

// Each section: id, title, badge label, number of results to show, query pool.
// On load we pick ONE query at random from the pool — different every session.
// ── Song-level query filter ─────────────────────────────────────────────────
// ── Song-level quality filter ─────────────────────────────────────────────────
// Three layers: title keywords, channel name patterns, duration guard.
const MIX_TITLE_WORDS = [
  // playlists / mixes
  'playlist', ' mix', 'mixed by', 'megamix', 'nonstop', 'non-stop',
  'back to back', 'continuous', 'extended set', 'dj set', 'mashup', 'medley',
  // compilations
  'compilation', 'collection', 'all songs', 'full album', 'album mix',
  'full ep', 'full lp', 'full tape', 'mixtape', 'full project',
  // "best of" / chart roundups
  'best of', 'greatest hits', 'top 10', 'top 20', 'top 50', 'top 100',
  'most played', 'chart hits', 'hit songs', 'all hits',
  // duration giveaways
  '1 hour', '2 hour', '3 hour', '4 hour', 'hour mix', 'hours of',
  // reaction / interview / non-music
  'reacts', 'reacting', 'reaction', 'interview', 'behind the scenes',
  'making of', 'documentary', 'explained', 'breakdown', 'analysis',
  'listening to', 'first time hearing', 'commentary',
  // karaoke / instrumental covers
  'karaoke', 'sing along', 'sing-along', 'cover version', 'covers of',
  'instrumental version', 'backing track', 'piano cover', 'guitar cover',
  'violin cover', 'cello cover', 'acoustic cover',
  // lyric / fan-made
  'fan made', 'fan video', 'lyric video', 'lyrics video',
  'unofficial video', 'unofficial audio', 'unofficial music',
  // slowed / sped up / reverb spam
  'slowed reverb', 'slowed + reverb', 'sped up', 'nightcore',
  'reverb only', '8d audio', 'bass boosted',
  // shorts giveaways in title
  '#shorts', '#short', 'youtube shorts',
];

// Channel name suffixes/patterns that signal auto-generated or repost channels
const BAD_CHANNEL_PATTERNS = [
  ' - topic',        // YouTube auto-generated "Artist - Topic" channels
  'topic channel',
  'auto-generated',
  // shorts / repost spam
  'shorts',
  'repost',
  'reposts',
  // generic lyric / cover farms
  'lyrics channel',
  'lyrics world',
  'lyric world',
  'lyrics hub',
  'music lyrics',
  'song lyrics',
  'lyric video',
  'lyrics official',
  // music world / various artists farms
  'music world',
  'music zone',
  'music box',
  'music hub',
  'music nation',
  'music hits',
  'music vibes',
  'hit music',
  // fan / unofficial
  'fan channel',
  'fan made',
  'fan page',
  'fanmade',
  // slowed / edit spam farms
  'slowed',
  'reverb nation',
  'bass nation',
  'nightcore',
  '8d music',
  // karaoke farms
  'karaoke',
  'sing king',
  'backing tracks',
];

function isSingleTrack(video) {
  const title   = (video.title   || '').toLowerCase();
  const channel = (video.channel || '').toLowerCase();

  // 1. Title keyword filter
  if (MIX_TITLE_WORDS.some(kw => title.includes(kw))) return false;

  // 2. Channel name filter — Topic channels, lyric farms, karaoke, shorts spam
  if (BAD_CHANNEL_PATTERNS.some(p => channel.includes(p))) return false;

  // 3. Duration filter using real seconds from videos.list contentDetails
  //    Shorts = under 62s. Mixes/compilations = over 12 min.
  //    Both are now caught reliably since we batch-fetch durations.
  if (video.durationSecs) {
    if (video.durationSecs < 62)  return false; // YouTube Short
    if (video.durationSecs > 720) return false; // Mix or compilation
  }

  // 4. All-caps heuristic — "SAD SONGS 2025 😭" style clickbait
  const letters = title.replace(/[^a-z]/gi, '');
  if (letters.length > 10) {
    const upperRatio = (video.title.replace(/[^A-Za-z]/g, '').match(/[A-Z]/g) || []).length / letters.length;
    if (upperRatio > 0.7 && !title.includes(' - ')) return false;
  }

  return true;
}

// ── GENRE-MAPPED SECTIONS ────────────────────────────────────────────────────
// Each section id matches a GENRES pill. 'all' shows all sections.
// pool = specific "Artist - Song official audio" queries → always returns the
//        exact track as top result, never a playlist or mix.
// Phase 2: swap pool entries for personalised queries from listening_history.
// ─────────────────────────────────────────────────────────────────────────────
const SECTION_DEFINITIONS = [
  {
    id:     'hip-hop',
    genre:  'Hip-Hop',
    title:  'Hip-Hop & Rap',
    badge:  null,
    pool: [
      'kendrick lamar humble official audio',
      'j cole love yourz official audio',
      'drake gods plan official audio',
      'travis scott antidote official audio',
      'kanye west stronger official audio',
      'lil baby emotionally scarred official audio',
      'future mask off official audio',
      'roddy ricch the box official audio',
      'juice wrld lucid dreams official audio',
      'meek mill going bad official audio',
      'polo g pop out official audio',
      'nba youngboy outside today official audio',
      'dababy suge official audio',
      'gunna fukumean official audio',
      'lil durk all my life official audio',
      'central cee band4band official audio',
      'tyler the creator noid official audio',
      '21 savage a lot official audio',
      'big sean bounce back official audio',
      'chance the rapper no problem official audio',
    ],
  },
  {
    id:     'pop',
    genre:  'Pop',
    title:  'Pop Hits',
    badge:  null,
    pool: [
      'harry styles as it was official video',
      'olivia rodrigo vampire official video',
      'taylor swift anti hero official music video',
      'dua lipa levitating official video',
      'the weeknd blinding lights official video',
      'ariana grande positions official video',
      'billie eilish bad guy official audio',
      'post malone circles official audio',
      'ed sheeran shape of you official video',
      'lana del rey summertime sadness official video',
      'doja cat say so official audio',
      'halsey without me official audio',
      'camila cabello havana official video',
      'lizzo juice official video',
      'sabrina carpenter espresso official video',
      'charlie puth attention official video',
      'selena gomez lose you to love me official video',
      'shawn mendes stitches official video',
      'meghan trainor all about that bass official video',
      'sia chandelier official video',
    ],
  },
  {
    id:     'rock',
    genre:  'Rock',
    title:  'Rock',
    badge:  null,
    pool: [
      'arctic monkeys do i wanna know official video',
      'foo fighters best of you official video',
      'red hot chili peppers under the bridge official video',
      'nirvana smells like teen spirit official video',
      'queens of the stone age no one knows official video',
      'the strokes last nite official video',
      'radiohead karma police official video',
      'tame impala the less i know the better official video',
      'pearl jam black official audio',
      'soundgarden black hole sun official video',
      'green day boulevard of broken dreams official video',
      'linkin park in the end official video',
      'system of a down chop suey official video',
      'muse uprising official video',
      'the killers mr brightside official video',
      'interpol obstacle 1 official audio',
      'the national bloodbuzz ohio official audio',
      'pixies where is my mind official audio',
      'nine inch nails hurt official audio',
      'alice in chains would official audio',
    ],
  },
  {
    id:     'jazz',
    genre:  'Jazz',
    title:  'Jazz',
    badge:  null,
    pool: [
      'miles davis kind of blue so what official audio',
      'john coltrane a love supreme official audio',
      'chet baker almost blue official audio',
      'dave brubeck take five official audio',
      'bill evans waltz for debby official audio',
      'thelonious monk round midnight official audio',
      'nina simone feeling good official audio',
      'ella fitzgerald summertime official audio',
      'louis armstrong what a wonderful world official audio',
      'charles mingus goodbye pork pie hat official audio',
      'herbie hancock cantaloupe island official audio',
      'stan getz girl from ipanema official audio',
      'oscar peterson autumn leaves official audio',
      'cannonball adderley mercy mercy mercy official audio',
      'wes montgomery bumpin on sunset official audio',
      'pat metheny bright size life official audio',
      'kamasi washington the magnificent 7 official audio',
      'esperanza spalding i know you know official audio',
      'norah jones come away with me official audio',
      'gregory porter liquid spirit official video',
    ],
  },
  {
    id:     'electronic',
    genre:  'Electronic',
    title:  'Electronic & Dance',
    badge:  null,
    pool: [
      'daft punk get lucky official audio',
      'aphex twin windowlicker official video',
      'boards of canada roygbiv official audio',
      'deadmau5 strobe official audio',
      'caribou cant do without you official audio',
      'four tet baby official audio',
      'bicep glue official audio',
      'burial archangel official audio',
      'jamie xx loud places official audio',
      'moderat bad kingdom official video',
      'disclosure latch official audio',
      'solomun home official audio',
      'bonobo kong official video',
      'richie hawtin official audio',
      'skrillex bangarang official video',
      'flume never be like you official audio',
      'fred again bleu official audio',
      'fisher losing it official audio',
      'john summit la danza official audio',
      'peggy gou i go official audio',
    ],
  },
  {
    id:     'classical',
    genre:  'Classical',
    title:  'Classical',
    badge:  null,
    pool: [
      'beethoven moonlight sonata official audio',
      'chopin nocturne op 9 no 2 official audio',
      'mozart piano sonata no 11 official audio',
      'bach cello suite no 1 official audio',
      'debussy clair de lune official audio',
      'vivaldi four seasons spring official audio',
      'tchaikovsky swan lake official audio',
      'brahms hungarian dance no 5 official audio',
      'satie gymnopédie no 1 official audio',
      'handel hallelujah chorus official audio',
      'schubert ave maria official audio',
      'liszt liebestraum official audio',
      'ravel bolero official audio',
      'pachelbel canon in d official audio',
      'grieg in the hall of the mountain king official audio',
      'saint saens carnival of the animals official audio',
      'mahler symphony no 5 adagietto official audio',
      'sibelius finlandia official audio',
      'stravinsky rite of spring official audio',
      'prokofiev romeo and juliet dance of the knights official audio',
    ],
  },
  {
    id:     'rnb',
    genre:  'R&B',
    title:  'R&B & Soul',
    badge:  null,
    pool: [
      'brent faiyaz dead man walking official audio',
      'sza kill bill official audio',
      'frank ocean nights official audio',
      'daniel caesar get you official audio',
      'giveon heartbreak anniversary official audio',
      'bryson tiller exchange official audio',
      'the weeknd save your tears official audio',
      'h.e.r focus official audio',
      'summer walker over it official audio',
      'partynextdoor loyal official audio',
      'jhene aiko while were young official audio',
      'usher confessions part ii official audio',
      'alicia keys if i aint got you official audio',
      'mary j blige be without you official audio',
      'lauryn hill ex factor official audio',
      'erykah badu on and on official audio',
      'anderson paak come down official audio',
      'lucky daye roll some mo official audio',
      'khalid young dumb broke official audio',
      'jorja smith blue lights official video',
    ],
  },
  {
    id:     'blues',
    genre:  'Blues',
    title:  'Blues',
    badge:  null,
    pool: [
      'bb king the thrill is gone official audio',
      'muddy waters hoochie coochie man official audio',
      'robert johnson cross road blues official audio',
      'howlin wolf smokestack lightning official audio',
      'stevie ray vaughan pride and joy official audio',
      'john lee hooker boom boom official audio',
      'buddy guy damn right ive got the blues official audio',
      'eric clapton crossroads official audio',
      'albert king born under a bad sign official audio',
      'freddie king hide away official audio',
      'elmore james dust my broom official audio',
      'sonny boy williamson help me official audio',
      'junior wells messin with the kid official audio',
      'little walter my babe official audio',
      'lightning hopkins mojo hand official audio',
      'gary moore still got the blues official audio',
      'joe bonamassa slow train official audio',
      'chris stapleton tennessee whiskey official video',
      'gary clark jr when my train pulls in official video',
      'susan tedeschi it hurt so bad official audio',
    ],
  },
  // ── "All" bonus sections (shown when no genre filter active) ──────────────
  {
    id:     'trending',
    genre:  null, // null = only shown in 'All' view
    title:  'Trending Now',
    badge:  'HOT',
    pool: [
      'kendrick lamar not like us official audio',
      'sabrina carpenter espresso official video',
      'billie eilish birds of a feather official',
      'doja cat paint the town red official audio',
      'drake push ups official audio',
      'travis scott fe!n official audio',
      'burna boy city boys official video',
      'sza snooze official audio',
      'tyler the creator chromakopia official audio',
      'olivia rodrigo good 4 u official video',
      'lil nas x montero official video',
      'cardi b wap official audio',
      'nicki minaj super freaky girl official audio',
      '21 savage mr. international official audio',
      'future wait for u official audio',
      'metro boomin superhero official audio',
      'gunna pushin p official audio',
      'jack harlow first class official audio',
      'lizzo about damn time official video',
      'bad bunny un verano sin ti moscow mule official audio',
    ],
  },
  {
    id:     'new-releases',
    genre:  null,
    title:  'New Releases',
    badge:  'NEW',
    pool: [
      'kendrick lamar tv off official audio',
      'tyler the creator noid official audio',
      'frank ocean official audio 2025',
      'the weeknd hurry up tomorrow official audio',
      'sza sos snooze official audio',
      'don toliver lose my mind official audio',
      'playboi carti official audio 2025',
      'future mixtape pluto official audio 2025',
      'lil baby official audio 2025',
      'rod wave official audio 2025',
      'nba youngboy official audio 2025',
      'polo g official audio 2025',
      'key glock official audio 2025',
      'yeat official audio 2025',
      'destroy lonely official audio 2025',
      'central cee official audio 2025',
      'asake official audio 2025',
      'rema official audio 2025',
      'ayra starr official audio 2025',
      'omah lay official audio 2025',
    ],
  },
  {
    id:     'afrobeats',
    genre:  null,
    title:  'Afrobeats',
    badge:  '🔥',
    pool: [
      'burna boy last last official video',
      'wizkid essence official video',
      'davido fall official video',
      'rema calm down official audio',
      'asake organise official audio',
      'omah lay understand official audio',
      'fireboy dml peru official audio',
      'ckay love nwantiti official audio',
      'tems free mind official audio',
      'ayra starr rush official audio',
      'kizz daniel buga official video',
      'lucky daye over official audio',
      'joeboy alcohol official audio',
      'pheelz electricity official audio',
      'zinoleesky official audio',
      'victony official audio',
      'ruger dior official audio',
      'oxlade ku lo sa official audio',
      'olamide rock official audio',
      'naira marley official audio',
    ],
  },
];

// ── Genre → section mapping ───────────────────────────────────────────────────
// When a genre pill is active, show ONLY that genre's section.
// When 'All', pick 4 random sections (mix of genre + bonus null-genre sections).
function getSectionsForGenre(genre) {
  if (genre === 'All') {
    // Show 2 bonus sections (trending/new/afrobeats) + 2 random genre sections
    const bonusSections = SECTION_DEFINITIONS.filter(s => s.genre === null);
    const genreSections = SECTION_DEFINITIONS.filter(s => s.genre !== null);
    const pickedBonus  = bonusSections.sort(() => Math.random() - 0.5).slice(0, 2);
    const pickedGenre  = genreSections.sort(() => Math.random() - 0.5).slice(0, 2);
    return [...pickedBonus, ...pickedGenre].map(sec => ({
      ...sec,
      query: sec.pool[Math.floor(Math.random() * sec.pool.length)],
    }));
  }
  // Single genre — find its section and show all songs
  const match = SECTION_DEFINITIONS.find(
    s => s.genre?.toLowerCase() === genre.toLowerCase()
  );
  if (!match) return [];
  return [{ ...match, query: match.pool[Math.floor(Math.random() * match.pool.length)] }];
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCOPED STYLES  (no conflicts with index.css — all under .ho-root)
───────────────────────────────────────────────────────────────────────────── */

const STYLES = `
  .ho-root *, .ho-root *::before, .ho-root *::after { box-sizing: border-box; }
  .ho-root { font-family: 'DM Sans', sans-serif; color: var(--lb-text-1); -webkit-font-smoothing: antialiased; }
  .ho-root h1,.ho-root h2,.ho-root h3,.ho-root .syne { font-family: 'Syne', sans-serif; }

  /* Scrollbar */
  .ho-root ::-webkit-scrollbar { width: 4px; height: 4px; }
  .ho-root ::-webkit-scrollbar-track { background: transparent; }
  .ho-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

  /* Card */
  .ho-card {
    background: var(--lb-surface-1);
    border: 1px solid var(--lb-border-1);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    position: relative;
    transition: transform 0.25s var(--lb-ease-spring), box-shadow 0.25s var(--lb-ease), border-color 0.25s var(--lb-ease);
  }
  .ho-card:hover {
    transform: translateY(-4px) scale(1.01);
    border-color: rgba(29,185,84,0.30);
    box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(29,185,84,0.08);
  }
  .ho-card .ho-play-btn {
    position: absolute; bottom: 14px; right: 14px;
    width: 40px; height: 40px; border-radius: 50%;
    background: var(--lb-green); border: none;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transform: translateY(8px);
    transition: opacity 0.2s, transform 0.2s, background 0.15s, box-shadow 0.2s;
    cursor: pointer; z-index: 2;
    box-shadow: 0 8px 24px rgba(29,185,84,0.4);
  }
  .ho-card:hover .ho-play-btn { opacity: 1; transform: translateY(0); }
  .ho-card .ho-play-btn:hover { background: var(--lb-green-bright); transform: scale(1.1); box-shadow: 0 12px 32px rgba(29,185,84,0.6); }
  .ho-card .ho-play-btn.loading { background: rgba(29,185,84,0.7); cursor: wait; }
  .ho-card .ho-cover-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%);
    opacity: 0; transition: opacity 0.25s;
  }
  .ho-card:hover .ho-cover-overlay { opacity: 1; }
  .ho-card .ho-card-glow {
    position: absolute; inset: 0; border-radius: 16px; pointer-events: none; opacity: 0; transition: opacity 0.3s;
  }
  .ho-card:hover .ho-card-glow { opacity: 1; }

  /* Search dropdown */
  .ho-dropdown {
    background: #141414; border: 1px solid var(--lb-border-1);
    border-radius: 16px; box-shadow: 0 32px 80px rgba(0,0,0,0.7); overflow: hidden;
  }
  .ho-search-row {
    padding: 10px 16px; display: flex; align-items: center; gap: 12px;
    cursor: pointer; transition: background 0.15s;
  }
  .ho-search-row:hover { background: rgba(255,255,255,0.06); }

  /* Filter tabs */
  .ho-tabs { display: flex; gap: 8px; padding: 4px; background: var(--lb-surface-1); border: 1px solid var(--lb-border-1); border-radius: 9999px; }
  .ho-tab { padding: 7px 20px; border-radius: 9999px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: transparent; color: var(--lb-text-2); font-family: 'DM Sans', sans-serif; transition: background 0.15s, color 0.15s; }
  .ho-tab.active { background: var(--lb-green); color: #fff; }

  /* Genre chip */
  .ho-genre { padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--lb-border-1); background: var(--lb-surface-1); color: var(--lb-text-2); white-space: nowrap; font-family: 'DM Sans', sans-serif; letter-spacing: 0.02em; transition: background 0.15s, color 0.15s, border-color 0.15s; }
  .ho-genre:hover,.ho-genre.active { background: var(--lb-green-dim); color: var(--lb-green-bright); border-color: rgba(29,185,84,0.4); }

  /* Track row */
  .ho-track { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer; transition: background 0.15s; position: relative; }
  .ho-track:hover { background: rgba(255,255,255,0.06); }
  .ho-track.active { background: rgba(29,185,84,0.12); }
  .ho-track .ho-track-actions { display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity 0.15s; }
  .ho-track:hover .ho-track-actions { opacity: 1; }

  /* Section heading */
  .ho-sh { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .ho-sh h2 { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: var(--lb-text-1); }
  .ho-sh .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--lb-green); flex-shrink: 0; }

  /* Cards grid */
  .ho-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px,1fr)); gap: 16px; }
  @media (min-width:640px)  { .ho-grid { grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); } }
  @media (min-width:1024px) { .ho-grid { grid-template-columns: repeat(auto-fill, minmax(175px,1fr)); } }
  @media (min-width:1280px) { .ho-grid { grid-template-columns: repeat(auto-fill, minmax(190px,1fr)); } }

  /* Badges */
  .ho-badge-new { background: linear-gradient(135deg,#FF4B4B,#FF2D55); color:#fff; font-size:9px; font-weight:800; padding:2px 7px; border-radius:6px; letter-spacing:.05em; }
  .ho-badge-hot { background: linear-gradient(135deg,#FF6B00,#FF4500); color:#fff; font-size:9px; font-weight:800; padding:2px 7px; border-radius:6px; letter-spacing:.05em; }

  /* Shimmer */
  .ho-shimmer { background: linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%); background-size:800px 100%; animation: ho-shimmer 1.4s infinite linear; border-radius:8px; }
  @keyframes ho-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }

  /* Wave bars */
  .ho-wave { display:inline-flex; align-items:flex-end; height:16px; gap:1px; }
  .ho-wave span { display:inline-block; width:3px; border-radius:2px; background:var(--lb-green); }
  .ho-wave span:nth-child(1) { animation: ho-b1 .8s ease-in-out infinite; }
  .ho-wave span:nth-child(2) { animation: ho-b2 .8s ease-in-out infinite .1s; }
  .ho-wave span:nth-child(3) { animation: ho-b3 .8s ease-in-out infinite .2s; }
  @keyframes ho-b1 { 0%,100%{height:4px}  50%{height:14px} }
  @keyframes ho-b2 { 0%,100%{height:10px} 50%{height:4px}  }
  @keyframes ho-b3 { 0%,100%{height:7px}  50%{height:16px} }

  /* Spin */
  @keyframes ho-spin { to { transform:rotate(360deg); } }
  .ho-spin { animation: ho-spin .7s linear infinite; }

  /* Fade up */
  @keyframes ho-fadeup { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  .ho-fadeup { animation: ho-fadeup .35s ease both; }

  /* Gradient text */
  .ho-gtext { background: linear-gradient(135deg,#fff 0%,rgba(29,185,84,.9) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }

  /* Search input override */
  .ho-search:focus { outline:none; border-color: rgba(29,185,84,.5) !important; box-shadow: 0 0 0 3px rgba(29,185,84,.12); }

/* ── Song action dropdowns ── */
.lb-dropdown {
  position: absolute;
  right: 0; top: calc(100% + 6px);
  z-index: 200;
  min-width: 200px;
  background: #111416;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  padding: 6px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.8);
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
`;

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */

/**
 * Build a normalised song object that PlayerContext can always play.
 *
 * PlayerContext typically looks for: song.audio || song.url || song.src
 * We populate all three so it works regardless of which field the context reads.
 */
function makeYtSong(video, audioUrl) {
  return {
    id:         `yt_${video.id}`,
    name:       video.title,
    artist:     video.channel,
    album:      '',
    duration:   video.duration || '0:00',
    cover:      video.thumbnail || '/default-cover.png',
    // ↓ three aliases — PlayerContext will find whichever it checks
    audio:      audioUrl,
    url:        audioUrl,
    src:        audioUrl,
    youtube:    true,
    youtubeId:  video.id,
    source:     'youtube',
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────────────────────── */

const WaveIcon = () => (
  <span className="ho-wave">
    <span /><span /><span />
  </span>
);

const SpinIcon = () => (
  <svg className="ho-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

const MusicCard = memo(({ item, isActive, isPlaying, onPlay, onClick, loadingId }) => {
  const accent = item.accent || '#1DB954';
  const isLoading = loadingId === item.id;
  const showPause = isActive && isPlaying && !isLoading;

  return (
    <div className="ho-card ho-fadeup" onClick={onClick}>
      <div className="ho-card-glow" style={{ boxShadow: `inset 0 0 60px ${accent}18, 0 0 40px ${accent}12` }} />

      {/* Cover */}
      <div style={{ position: 'relative', paddingTop: '100%', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
        <img
          src={item.cover}
          alt={item.name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
          onError={e => { e.target.src = `https://placehold.co/400x400/1a1a1a/333?text=${encodeURIComponent(item.name)}`; }}
        />
        <div className="ho-cover-overlay" />

        {item.badge && (
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
            <span className={item.badge === 'HOT' ? 'ho-badge-hot' : 'ho-badge-new'}>{item.badge}</span>
          </div>
        )}

        {isActive && isPlaying && !isLoading && (
          <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 2, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', borderRadius: 6, padding: '4px 8px' }}>
            <WaveIcon />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px 52px' }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: isActive ? 'var(--lb-green)' : 'var(--lb-text-1)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </p>
        <p style={{ fontSize: 12, color: 'var(--lb-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.artist || item.description}
        </p>
      </div>

      {/* Play button */}
      <button
        className={`ho-play-btn${isLoading ? ' loading' : ''}`}
        onClick={e => { e.stopPropagation(); if (!isLoading) onPlay(); }}
        aria-label={`Play ${item.name}`}
        disabled={isLoading}
      >
        {isLoading   ? <SpinIcon /> :
         showPause   ? <FaPause style={{ color: '#fff', fontSize: 13 }} /> :
                       <FaPlay  style={{ color: '#fff', fontSize: 13, marginLeft: 2 }} />}
      </button>
    </div>
  );
});

/* ── Outside-click hook ── */
function useOutsideClick(ref, handler) {
  useEffect(() => {
    const listener = (e) => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

/* ── Dots menu for detail header ── */
const DotsMenu = memo(({ song, songList, onAddToQueue }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { show: showToast } = useToast();
  const { addToLibrary } = usePlaylists();

  useOutsideClick(ref, () => setOpen(false));

  const handleShare = useCallback(() => {
    const ytId = song?.youtubeId || song?.id?.replace('yt_', '');
    const url = ytId
      ? `https://www.youtube.com/watch?v=${ytId}`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent((song?.name||'') + ' ' + (song?.artist||''))}`;
    navigator.clipboard.writeText(url)
      .then(() => showToast('YouTube link copied!', 'info'))
      .catch(() => showToast('Could not copy link', 'error'));
    setOpen(false);
  }, [song, showToast]);

  const toLibrarySong = (s) => {
    const ytId = s.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(s.youtubeId) ? s.youtubeId : null;
    const ytUrl = ytId ? 'https://www.youtube.com/watch?v=' + ytId : null;
    return {
      ...s,
      source:    ytId ? 'youtube' : s.source,
      youtubeId: ytId || s.youtubeId,
      audio:     ytUrl || s.audio,
      url:       ytUrl || s.url,
      src:       ytUrl || s.src,
      streamUrl: ytUrl || s.streamUrl,
      album:     s.album || s.artist || 'YouTube',
    };
  };

  const handleAddToLibrary = useCallback(() => {
    try {
      // If a songList is provided (detail view), add all songs in the list.
      // Otherwise fall back to the single header song.
      const targets = (songList && songList.length > 0) ? songList : (song ? [song] : []);
      if (!targets.length) { setOpen(false); return; }

      let added = 0;
      targets.forEach(s => {
        const result = addToLibrary(toLibrarySong(s));
        if (result !== false) added++;
      });

      if (added === 0) {
        showToast(targets.length === 1 ? 'Already in Library' : 'All songs already in Library', 'info');
      } else if (added < targets.length) {
        showToast(`${added} of ${targets.length} added to Library ✓`, 'success');
      } else {
        showToast(targets.length === 1 ? 'Added to Library ✓' : `${added} songs added to Library ✓`, 'success');
      }
    } catch { showToast('Could not save to Library', 'error'); }
    setOpen(false);
  }, [song, songList, addToLibrary, showToast]);

  const handleQueue = useCallback(() => {
    onAddToQueue?.();
    showToast('Added to queue ✓', 'success');
    setOpen(false);
  }, [onAddToQueue, showToast]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="lb-icon-btn" onClick={() => setOpen(o => !o)}>
        <FontAwesomeIcon icon={faEllipsisH} style={{ fontSize: 14 }} />
      </button>
      {open && (
        <div className="lb-dropdown">
          <button className="lb-dropdown-item" onClick={handleQueue}>
            <span className="lb-dropdown-icon"><FaListUl /></span> Add to Queue
          </button>
          <button className="lb-dropdown-item" onClick={handleAddToLibrary}>
            <span className="lb-dropdown-icon"><FaDownload /></span> Add to Library
          </button>
          <div className="lb-dropdown-sep" />
          <button className="lb-dropdown-item" onClick={handleShare}>
            <span className="lb-dropdown-icon"><FaShareAlt /></span> Copy YouTube Link
          </button>
        </div>
      )}
    </div>
  );
});

/* ── Plus button on track row — add to playlist ── */
const AddToPlaylistBtn = memo(({ song }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { playlists: allPlaylists, addSongToPlaylist } = usePlaylists();
  // Never show the hidden __library__ playlist in the add-to-playlist dropdown
  const playlists = allPlaylists.filter(p => !p._hidden);
  const { show: showToast } = useToast();
  useOutsideClick(ref, () => setOpen(false));

  const handle = useCallback((pl) => {
    addSongToPlaylist(pl.id, song);
    showToast(`Added to ${pl.name} ✓`, 'success');
    setOpen(false);
  }, [song, addSongToPlaylist, showToast]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: open ? 'rgba(29,185,84,0.15)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: open ? 'var(--lb-green)' : 'var(--lb-text-3)', transition: 'background 0.15s, color 0.15s' }}
        title="Add to playlist"
      >
        <FaPlus style={{ fontSize: 10 }} />
      </button>
      {open && (
        <div className="lb-dropdown">
          {playlists.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>No playlists yet</div>
          ) : (
            <>
              <div className="lb-dropdown-label">Add to playlist</div>
              {playlists.map(pl => (
                <button key={pl.id} className="lb-dropdown-item" onClick={() => handle(pl)}>
                  <span className="lb-dropdown-icon"><FaListUl /></span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
});

const TrackRow = memo(({ song, index, isActive, isPlaying, onPlay, isFav, isLiked, onFav, onLike }) => (
  <div className={`ho-track${isActive ? ' active' : ''}`} onClick={onPlay}>
    <span style={{ width: 28, textAlign: 'center', fontSize: 12, color: 'var(--lb-text-3)', flexShrink: 0 }}>
      {isActive && isPlaying ? <WaveIcon /> : String(index + 1).padStart(2, '0')}
    </span>

    <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <img src={song.cover} alt={song.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={e => { e.target.src = '/default-cover.png'; }} />
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: isActive ? 'var(--lb-green)' : 'var(--lb-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.name}</p>
      <p style={{ fontSize: 12, color: 'var(--lb-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</p>
    </div>

    <div className="ho-track-actions">
      <button onClick={e => { e.stopPropagation(); onFav(); }}
        style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FaStar style={{ fontSize: 11, color: isFav ? '#FFD600' : 'var(--lb-text-3)' }} />
      </button>
      <button onClick={e => { e.stopPropagation(); onLike(); }}
        style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FaHeart style={{ fontSize: 11, color: isLiked ? '#FF4455' : 'var(--lb-text-3)' }} />
      </button>
      <AddToPlaylistBtn song={song} />
    </div>
  </div>
));

const SectionHeader = ({ title, count, badge }) => (
  <div className="ho-sh">
    <span className="dot" />
    <h2>{title}</h2>
    {badge === 'NEW'  && <span className="ho-badge-new">{badge}</span>}
    {badge === 'HOT'  && <span className="ho-badge-hot">{badge}</span>}
    {badge === 'FOR YOU' && <span className="ho-badge-new" style={{ background: 'linear-gradient(135deg,#1DB954,#17a349)' }}>{badge}</span>}
    {badge && badge !== 'NEW' && badge !== 'HOT' && badge !== 'FOR YOU' && (
      <span style={{ fontSize: 13 }}>{badge}</span>
    )}
    {count != null && <span style={{ fontSize: 12, color: 'var(--lb-text-3)', fontWeight: 500, marginLeft: 2 }}>{count}</span>}
  </div>
);

const ShimmerCards = ({ count = 6 }) => (
  <div className="ho-grid">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div className="ho-shimmer" style={{ paddingTop: '100%' }} />
        <div style={{ padding: '12px 14px 16px', background: 'var(--lb-surface-1)' }}>
          <div className="ho-shimmer" style={{ height: 14, width: '70%', marginBottom: 8 }} />
          <div className="ho-shimmer" style={{ height: 11, width: '50%' }} />
        </div>
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */

export default function HomeOnline() {
  const [query, setQuery]                   = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [localResults, setLocalResults]     = useState([]);
  const [ytResults, setYtResults]           = useState([]);
  const [ytSearching, setYtSearching]       = useState(false);
  const [activeFilter, setActiveFilter]     = useState('Albums');
  const [selectedGenre, setSelectedGenre]   = useState('All');
  const [showDetail, setShowDetail]         = useState(false);
  const [selectedItem, setSelectedItem]     = useState(null);
  const [trackStates, setTrackStates]       = useState({});
  const [loading, setLoading]               = useState(true);
  const [errorMsg, setErrorMsg]             = useState(null);
  const [detailBg, setDetailBg]             = useState('#1a1a1a');
  const [searchFocused, setSearchFocused]   = useState(false);

  /**
   * loadingId — tracks which card item is currently resolving its audio stream.
   * Gives the user immediate visual feedback that a click was registered.
   */
  const [loadingId, setLoadingId]           = useState(null);
  const { show: showToast } = useToast();

  /**
   * ytSongRef — holds the current YouTube song while it plays.
   * We keep a ref so detail-view TrackRow can check isActive without
   * the entire library being replaced.
   */
  const ytSongRef   = useRef(null);
  const searchRef   = useRef(null);
  const searchCache = useRef({}); // "Song Artist" → videoId, avoids repeat quota burns

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
    currentSong,   // ← read directly from context if available; fall back below
  } = usePlayer();

  // Some PlayerContext implementations expose currentSong, some don't.
  // Fall back to songs[currentIndex] if needed.
  const activeSong = currentSong ?? songs[currentIndex];

  /* ── Initial load ── */
  useEffect(() => {
    if (volume === 1) setVolume(0.2);
  }, []); // eslint-disable-line

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
    const t = setTimeout(() => setDebouncedQuery(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  /* ── Search ── */
  useEffect(() => {
    if (!debouncedQuery.trim()) { setLocalResults([]); setYtResults([]); return; }
    const q = debouncedQuery.toLowerCase();
    setLocalResults(songs.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.artist?.toLowerCase().includes(q) ||
      s.album?.toLowerCase().includes(q)
    ));
    setYtSearching(true);
    youtubeConverter.searchVideos(debouncedQuery, 10)
      .then(setYtResults)
      .catch(() => setYtResults([]))
      .finally(() => setYtSearching(false));
  }, [debouncedQuery, songs]);

  /* ── Patch local song ── */
  const patchSong = useCallback(async (id, patch) => {
    try {
      await apiPatchSong(id, patch);
      // Only update the matching song — leave the rest of the array untouched.
      setPlayerSongs(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
    } catch (e) { console.error('patchSong:', e); }
  }, [setPlayerSongs]);

  /* ─────────────────────────────────────────────────────────────────────
     CORE FIX: playYoutubeVideo
     ─────────────────────────────────────────────────────────────────────
     PROBLEMS in the original:
       1. setPlayerSongs([ytSong]) REPLACED the entire library — after one
          YT play, all downloaded songs vanished from the player queue.
       2. The song object used `audio` as the key. PlayerContext may look
          for `url` or `src`; we now populate all three aliases.
       3. setCurrentIndex(0) was called synchronously after setPlayerSongs —
          React batches these, so PlayerContext saw them as one update, but the
          index was always hardcoded 0. Now we pass the index inline.
       4. No loading state — the user saw no feedback while getAudioStream resolved.
       5. No error toast / recovery — silent failures left nothing playing.
  ───────────────────────────────────────────────────────────────────── */
  const playYoutubeVideo = useCallback(async (video, itemId) => {
    // Show spinner on the card that was clicked.
    setLoadingId(itemId ?? video.id);
    try {
      const audioUrl = await youtubeConverter.getAudioStream(video.id);

      if (!audioUrl) throw new Error('No audio URL returned');

      const ytSong = makeYtSong(video, audioUrl);
      ytSongRef.current = ytSong;

      /*
       * CRITICAL: insert the YT song at the START of the existing songs array
       * rather than replacing it. This means:
       *   - The player can still navigate to downloaded songs after playing YT
       *   - The existing queue is preserved
       *   - We always play index 0 which is the freshly inserted YT track
       *
       * If your PlayerContext's setPlayerSongs accepts (songs, startIndex),
       * pass 0 as the second argument. If not, we set index separately.
       */
      const updatedQueue = [ytSong, ...songs.filter(s => !s.youtube)];
      setPlayerSongs(updatedQueue);
      setCurrentIndex(0);
      // Small delay ensures the context has processed the new queue
      // before we flip isPlaying to true.
      setTimeout(() => setIsPlaying(true), 50);
    } catch (err) {
      console.error('playYoutubeVideo failed:', err);
      setErrorMsg(`Couldn't stream "${video.title}". Try another track.`);
      // Clear the error after 4 s so it doesn't linger
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setLoadingId(null);
    }
  }, [songs, setPlayerSongs, setCurrentIndex, setIsPlaying]);

  /* ── Play a card item — uses known youtubeId if available, searches only as fallback ── */
  const playStreamingSong = useCallback(async (item) => {
    setLoadingId(item.id);
    try {
      // If the card already has a YouTube ID (all section cards do), skip search entirely.
      // Search costs 100 quota units — only use it when we have no ID.
      const knownId = item.youtubeId || (item.id?.startsWith('yt_') ? item.id.replace('yt_', '') : null);

      if (knownId && /^[A-Za-z0-9_-]{11}$/.test(knownId)) {
        // Use ID directly — zero quota cost
        await playYoutubeVideo({ id: knownId, title: item.name, channel: item.artist }, item.id);
      } else {
        // Fallback: search only when we genuinely have no ID (local songs, manual entries)
        const searchQuery = `${item.name} ${item.artist ?? ''} audio`.trim();
        // Check cache first — don't re-search something we've already looked up
        const cachedId = searchCache.current[searchQuery];
        if (cachedId) {
          await playYoutubeVideo({ id: cachedId, title: item.name, channel: item.artist }, item.id);
        } else {
          const vids = await youtubeConverter.searchVideos(searchQuery, 1);
          if (!vids?.length) throw new Error('No results');
          searchCache.current[searchQuery] = vids[0].id; // cache for next time
          await playYoutubeVideo(vids[0], item.id);
        }
      }
    } catch (err) {
      console.error('playStreamingSong:', err);
      setErrorMsg(`Couldn't find "${item.name}" on YouTube.`);
      setTimeout(() => setErrorMsg(null), 4000);
      setLoadingId(null);
    }
  }, [playYoutubeVideo]);

  /* ── Play an album/playlist card (searches for a representative track) ── */
  const playOnlineItem = useCallback(async (item) => {
    setLoadingId(item.id);
    try {
      // More specific query gives better results than generic "full album"
      const searchQuery = item.type === 'playlist'
        ? `${item.name} ${item.description ?? ''} mix`
        : `${item.artist} ${item.name} best songs`;
      const vids = await youtubeConverter.searchVideos(searchQuery, 1);
      if (!vids?.length) throw new Error('No results');
      await playYoutubeVideo(vids[0], item.id);
    } catch (err) {
      console.error('playOnlineItem:', err);
      setErrorMsg(`Couldn't play "${item.name}".`);
      setTimeout(() => setErrorMsg(null), 4000);
      setLoadingId(null);
    }
  }, [playYoutubeVideo]);

  /* ── Detail view ── */
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

  /* ── Track meta ── */
  const toggleFav = useCallback((id, current) => {
    setTrackStates(p => ({ ...p, [id]: { ...p[id], fav: !current } }));
    patchSong(id, { favorite: !current });
  }, [patchSong]);

  const toggleLiked = useCallback((id, current) => {
    setTrackStates(p => ({ ...p, [id]: { ...p[id], liked: !current } }));
    patchSong(id, { liked: !current });
  }, [patchSong]);

  // Dynamic sections — re-fetched whenever genre pill changes
  const [sections,    setSections]    = useState([]);
  const [sectionsKey, setSectionsKey] = useState(0); // bump to force re-fetch

  // ── Section result cache (localStorage) ────────────────────────────────
  // Saves API quota — 10,000 units/day, each search costs 100.
  // Cache TTL: 12 hours. Key: "lb_section_{genre}_{sectionId}".
  const SECTION_CACHE_TTL = 12 * 60 * 60 * 1000;

  function getSectionCache(genre, secId) {
    try {
      const raw = localStorage.getItem(`lb_section_${genre}_${secId}`);
      if (!raw) return null;
      const { items, expires } = JSON.parse(raw);
      if (Date.now() > expires) { localStorage.removeItem(`lb_section_${genre}_${secId}`); return null; }
      return items;
    } catch { return null; }
  }

  function setSectionCache(genre, secId, items) {
    try {
      localStorage.setItem(`lb_section_${genre}_${secId}`, JSON.stringify({
        items,
        expires: Date.now() + SECTION_CACHE_TTL,
      }));
    } catch { /* storage full — skip caching */ }
  }

  const fetchSections = useCallback((genre) => {
    const chosen = getSectionsForGenre(genre);

    // For each section, check cache first — only show shimmer for uncached ones
    setSections(chosen.map(s => {
      const cached = getSectionCache(genre, s.id);
      return { ...s, items: cached || [], loading: !cached };
    }));

    chosen.forEach((sec, idx) => {
      // If we have a valid cache hit, skip the API call entirely
      const cached = getSectionCache(genre, sec.id);
      if (cached) return;

      youtubeConverter.searchVideos(sec.query, 16)
        .then(videos => {
          const items = (videos || [])
            .filter(isSingleTrack)
            .slice(0, 10)
            .map(v => ({
              id:        `yt_${v.id}`,
              name:      v.title
                .replace(/\s*[\(\[](official\s*(audio|video|music video|lyric video|visualizer)|lyrics?|hd|4k|explicit)[\)\]]/gi, '')
                .replace(/\s*[-–]\s*(official\s*(audio|video|music video)|lyrics?)\s*$/gi, '')
                .trim(),
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
          setSectionCache(genre, sec.id, items); // save for next 12h
          setSections(prev => prev.map((s, i) =>
            i === idx ? { ...s, items, loading: false } : s
          ));
        })
        .catch(() => setSections(prev => prev.map((s, i) =>
          i === idx ? { ...s, items: [], loading: false } : s
        )));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch on mount (All) and whenever genre changes
  useEffect(() => {
    fetchSections(selectedGenre);
  }, [selectedGenre, fetchSections]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Search dropdown visibility ── */
  const showDropdown = searchFocused && query.trim() && (localResults.length > 0 || ytResults.length > 0 || ytSearching);

  /* ── Is a card currently "active" (playing)? ── */
  const isCardActive = useCallback((item) => {
    if (!activeSong) return false;
    // YouTube song match
    if (activeSong.youtube && activeSong.youtubeId) {
      return `yt_${activeSong.youtubeId}` === `yt_${item.id}` ||
             activeSong.name?.toLowerCase() === item.name?.toLowerCase();
    }
    // Local song match
    return activeSong.name?.toLowerCase() === item.name?.toLowerCase();
  }, [activeSong]);

  /* ─────────────────────────────────────────────────────────────────────
     RENDER: DETAIL VIEW
  ───────────────────────────────────────────────────────── */
  const renderDetail = () => {
    if (!selectedItem) return null;
    const isLocal   = selectedItem.type === 'downloaded';
    const cover     = isLocal ? selectedItem.songs?.[0]?.cover : selectedItem.cover;
    const title     = isLocal ? 'Downloaded' : selectedItem.name;
    const subtitle  = isLocal ? `${selectedItem.songCount} songs` : (selectedItem.artist || selectedItem.description);
    const songList  = selectedItem.songs ?? [];
    const typeLabel = isLocal ? 'LOCAL LIBRARY' : selectedItem.type?.replace('-', ' ').toUpperCase();

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
        {/* Ambient bg */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: `linear-gradient(160deg, ${detailBg}55 0%, #0A0A0A 45%)`, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, background: `radial-gradient(circle, ${detailBg}30 0%, transparent 70%)`, borderRadius: '50%', pointerEvents: 'none' }} />
        </div>

        {/* Sticky header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,10,10,.7)', backdropFilter: 'blur(24px)', borderBottom: '1px solid var(--lb-border-1)' }}>
          <button onClick={closeDetail} className="lb-icon-btn">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 14 }} />
          </button>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15 }}>{title}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
            <button className="lb-icon-btn"><FaHeart style={{ fontSize: 14 }} /></button>
            <DotsMenu song={selectedItem} songList={songList} onAddToQueue={() => addToQueue(selectedItem)} />
          </div>
        </div>

        {/* Hero */}
        <div style={{ position: 'relative', zIndex: 1, padding: '20px 24px 16px', display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: -6, borderRadius: 20, background: `radial-gradient(circle, ${detailBg}60 0%, transparent 70%)`, filter: 'blur(16px)', zIndex: 0 }} />
            <img src={cover || '/default-cover.png'} alt={title}
              style={{ position: 'relative', zIndex: 1, width: 130, height: 130, borderRadius: 14, objectFit: 'cover', boxShadow: '0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.1)' }}
              onError={e => { e.target.src = '/default-cover.png'; }} />
            {isLocal && (
              <div style={{ position: 'absolute', top: -6, right: -6, zIndex: 2, width: 24, height: 24, borderRadius: '50%', background: 'var(--lb-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(29,185,84,.5)' }}>
                <FontAwesomeIcon icon={faCircleArrowDown} style={{ color: '#fff', fontSize: 10 }} />
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--lb-green)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 5 }}>{typeLabel}</p>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(18px,3.5vw,36px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
            <p style={{ fontSize: 13, color: 'var(--lb-text-2)', marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</p>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Play all */}
              <button
                onClick={() => {
                  if (isLocal && songList.length) {
                    setPlayerSongs(songList);
                    setCurrentIndex(0);
                    setTimeout(() => setIsPlaying(true), 50);
                  } else {
                    playOnlineItem(selectedItem);
                  }
                }}
                className="lb-btn-primary"
                style={{ width: 52, height: 52, padding: 0, borderRadius: '50%' }}
              >
                {loadingId === selectedItem.id ? <SpinIcon /> : <FaPlay style={{ fontSize: 18, marginLeft: 3 }} />}
              </button>

              <button className="lb-btn-ghost" style={{ height: 40, padding: '0 18px', fontSize: 13 }}>
                <FaRandom style={{ fontSize: 12 }} /> Shuffle
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ position: 'relative', zIndex: 1, height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 20px', flexShrink: 0 }} />

        {/* Track list */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
          {songList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--lb-text-3)' }}>
              <FontAwesomeIcon icon={faCompactDisc} style={{ fontSize: 36, marginBottom: 14, display: 'block', margin: '0 auto 14px' }} />
              <p style={{ fontSize: 15 }}>No tracks available</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--lb-text-3)', letterSpacing: '.1em', textTransform: 'uppercase', padding: '0 12px 10px' }}>
                Tracks · {songList.length}
              </p>
              {songList.map((song, idx) => {
                const sId = song.id ?? `song-${idx}`;
                const globalIdx = songs.findIndex(s => s.id === song.id);
                const isActive = isLocal ? globalIdx === currentIndex : (activeSong?.id === sId);
                const ts = trackStates[sId] ?? {};
                return (
                  <TrackRow
                    key={sId}
                    song={song} index={idx}
                    isActive={isActive} isPlaying={isPlaying}
                    isFav={ts.fav ?? song.favorite ?? false}
                    isLiked={ts.liked ?? song.liked ?? false}
                    onPlay={() => {
                      if (isLocal && globalIdx !== -1) {
                        setCurrentIndex(globalIdx);
                        setTimeout(() => setIsPlaying(true), 50);
                      } else {
                        playStreamingSong(song);
                      }
                    }}
                    onFav={()   => toggleFav(sId,   ts.fav   ?? song.favorite ?? false)}
                    onLike={()  => toggleLiked(sId, ts.liked ?? song.liked    ?? false)}
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
     RENDER: MAIN HOME
  ───────────────────────────────────────────────────────── */
  return (
    <>
      <style>{STYLES}</style>

      <div className="ho-root" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading && songs.length === 0 && <Loader />}

        {showDetail ? renderDetail() : (
          <>
            {/* ── TOP BAR ── */}
            <div style={{ flexShrink: 0, padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Search + filter tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }} ref={searchRef}>
                  <FaSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--lb-text-3)', fontSize: 13, pointerEvents: 'none', zIndex: 1 }} />
                  <input
                    className="ho-search"
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    placeholder="Artists, songs, albums…"
                    style={{ width: '100%', padding: '10px 16px 10px 38px', borderRadius: 9999, fontSize: 14, color: 'var(--lb-text-1)', background: 'var(--lb-surface-1)', border: '1px solid var(--lb-border-1)', transition: 'border-color 0.2s' }}
                  />

                  {/* Dropdown */}
                  {showDropdown && (
                    <div className="ho-dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 100 }}>
                      {/* Local results */}
                      {localResults.length > 0 && (
                        <>
                          <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--lb-text-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Library</div>
                          {localResults.slice(0, 4).map((song, i) => (
                            <div key={song.id ?? i} className="ho-search-row" onClick={() => {
                              setQuery(song.name);
                              const idx = songs.findIndex(s => s.id === song.id);
                              if (idx !== -1) { setCurrentIndex(idx); setTimeout(() => setIsPlaying(true), 50); }
                            }}>
                              <img src={song.cover} alt={song.name} style={{ width: 38, height: 38, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--lb-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.name}</p>
                                <p style={{ fontSize: 12, color: 'var(--lb-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</p>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {/* YT spinner */}
                      {ytSearching && (
                        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--lb-text-2)', fontSize: 13 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,.15)', borderTopColor: 'var(--lb-green)', animation: 'ho-spin .7s linear infinite' }} />
                          Searching YouTube…
                        </div>
                      )}

                      {/* YT results */}
                      {ytResults.length > 0 && (
                        <>
                          <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--lb-text-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF4444"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            YouTube
                          </div>
                          {ytResults.slice(0, 5).map(v => (
                            <div key={v.id} className="ho-search-row" onClick={() => { setQuery(''); playYoutubeVideo(v, v.id); }}>
                              <img src={v.thumbnail} alt={v.title} style={{ width: 38, height: 38, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--lb-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</p>
                                <p style={{ fontSize: 12, color: 'var(--lb-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.channel}</p>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Filter tabs */}
                <div className="ho-tabs">
                  {['Albums', 'Songs'].map(tab => (
                    <button key={tab} className={`ho-tab${activeFilter === tab ? ' active' : ''}`} onClick={() => setActiveFilter(tab)}>{tab}</button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6 }}>
                  <span className="ho-gtext">Discover</span>
                </h1>
                <p style={{ fontSize: 13, color: 'var(--lb-text-3)' }}>Stream millions of songs · Explore new music</p>
              </div>

              {/* Genre chips */}
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                {GENRES.map(g => (
                  <button key={g} className={`ho-genre${selectedGenre === g ? ' active' : ''}`} onClick={() => setSelectedGenre(g)}>{g}</button>
                ))}
              </div>

              {/* Error banner */}
              {errorMsg && (
                <div style={{ background: 'rgba(255,100,0,.12)', border: '1px solid rgba(255,100,0,.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FF9944', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FontAwesomeIcon icon={faBolt} style={{ fontSize: 12 }} />
                  {errorMsg}
                </div>
              )}
            </div>

            {/* ── CONTENT ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 8px' }}>

              {/* ── Dynamic sections — each fetched independently ── */}
              {sections.map(sec => (
                <section key={sec.id} style={{ marginBottom: 36 }}>
                  <SectionHeader
                    title={sec.title}
                    count={sec.loading ? undefined : sec.items.length}
                    badge={sec.badge}
                  />
                  {sec.loading ? <ShimmerCards count={sec.count} /> : (
                    sec.items.length === 0 ? null : (
                      <div className="ho-grid">
                        {sec.items.map(item => (
                          <MusicCard key={item.id} item={item}
                            isActive={isCardActive(item)} isPlaying={isPlaying}
                            loadingId={loadingId}
                            onPlay={() => playStreamingSong(item)}
                            onClick={() => openDetail({ ...item, songs: [] })}
                          />
                        ))}
                      </div>
                    )
                  )}
                </section>
              ))}

              {/* Downloaded */}
              <section style={{ marginBottom: 36 }}>
                <SectionHeader title="Downloaded" count={songs.length || undefined} />
                {songs.length > 0 ? (
                  <div className="ho-grid">
                    <div className="ho-card" onClick={() => openDetail({
                      type: 'downloaded', name: 'Downloaded Songs',
                      cover: songs[0]?.cover, accent: '#1DB954',
                      songCount: songs.length, songs,
                    })}>
                      {/* 2×2 mosaic */}
                      <div style={{ position: 'relative', paddingTop: '100%', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
                        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, background: '#111' }}>
                          {[0, 1, 2, 3].map(i => (
                            <img key={i} src={songs[i]?.cover ?? songs[0]?.cover ?? '/default-cover.png'} alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ))}
                        </div>
                        <div style={{ position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: '50%', background: 'var(--lb-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(29,185,84,.5)' }}>
                          <FontAwesomeIcon icon={faCircleArrowDown} style={{ color: '#fff', fontSize: 10 }} />
                        </div>
                      </div>
                      <div style={{ padding: '12px 14px 52px' }}>
                        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--lb-text-1)', marginBottom: 3 }}>Downloaded</p>
                        <p style={{ fontSize: 12, color: 'var(--lb-text-2)' }}>{songs.length} songs</p>
                      </div>
                      <button className="ho-play-btn" onClick={e => { e.stopPropagation(); setCurrentIndex(0); setTimeout(() => setIsPlaying(true), 50); }}>
                        <FaPlay style={{ color: '#fff', fontSize: 13, marginLeft: 2 }} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'var(--lb-surface-1)', border: '1px solid var(--lb-border-1)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                    <FontAwesomeIcon icon={faCircleArrowDown} style={{ fontSize: 28, color: 'var(--lb-text-3)', marginBottom: 12, display: 'block' }} />
                    <p style={{ fontSize: 15, color: 'var(--lb-text-2)', marginBottom: 4 }}>No downloads yet</p>
                    <p style={{ fontSize: 13, color: 'var(--lb-text-3)' }}>Download songs for offline listening</p>
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        <PlayerControls />
      </div>
    </>
  );
}