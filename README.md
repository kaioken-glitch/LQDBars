<div align="center">

<br>

<img src="public/favicon.svg" width="72" alt="Liquid Bars Logo">

<br><br>

# LIQUID BARS

### *A music player that doesn't feel like software*

<br>

[![Version](https://img.shields.io/badge/version-2.3.0-1DB954?style=flat-square&labelColor=0a0a0a)](./CHANGELOG.md)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white&labelColor=0a0a0a)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white&labelColor=0a0a0a)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white&labelColor=0a0a0a)](https://supabase.com)
[![License](https://img.shields.io/badge/license-MIT-white?style=flat-square&labelColor=0a0a0a)](./LICENSE)

<br>

<img src="public/og-image.png" alt="Liquid Bars — full-screen player" width="860">

<br><br>

> *Stream anything. Own everything. No compromises.*

<br>

</div>

---

<br>

## What is Liquid Bars?

Liquid Bars is a full-featured music player built entirely in the browser. It plays your **local files**, streams from **YouTube**, imports **playlists**, and displays **live synced lyrics** — all wrapped in a dark glass interface that reacts to your album art in real time.

No Electron. No native app. Just React, a Node.js backend, and an obsessive attention to detail.

<br>

---

<br>

## Features

<br>

**Playback**

- Local file playback — drag a folder or pick individual tracks
- YouTube streaming via `yt-dlp` — no API key needed for playback, instant start
- Gapless and crossfade modes, shuffle, three repeat modes
- Media Session API — OS-level controls and lock screen artwork

<br>

**Library & Playlists**

- Persistent library via `localStorage` — survives reloads, no account required
- Import YouTube playlists by URL (Piped API — zero quota cost)
- Create, rename, and reorder playlists; drag-to-sort queue
- Favorites, recently played, and auto-generated library playlist

<br>

**Now Playing**

- Full-screen expanded player on desktop and mobile
- Album art–derived accent color — the UI changes hue with every track
- WebGL iridescence shader background (OGL) — reacts to mouse movement
- Synced karaoke-style lyrics via [LRCLIB](https://lrclib.net) — green fill sweep animation
- Mobile fullscreen lyrics with playback controls pinned at the bottom

<br>

**Search**

- Instant local library search
- Live YouTube search with debounce — results appear as you type
- Quality filter strips mixes, compilations, Shorts, and lyric-farm channels automatically

<br>

**Settings & Profile**

- Spotify-style profile hero with avatar upload (Supabase Storage or local preview)
- Social stats row (Playlists · Following · Followers) — wired for future social features
- Playlist tiles on the profile tab — your music, your identity
- Playback: crossfade slider, gapless toggle, EQ presets
- Storage: cache control, export/import settings as JSON

<br>

---

<br>

## Tech Stack

<br>

| Layer | Technology |
|:------|:-----------|
| **Frontend** | React 18, Vite 5 |
| **Styling** | Scoped CSS-in-JS · Syne + DM Sans (Google Fonts) |
| **WebGL** | OGL — lightweight iridescence shader |
| **Backend** | Node.js + Express |
| **YouTube** | `yt-dlp` for audio streams · Piped API for playlist import |
| **Lyrics** | LRCLIB — free, no key, synced + plain text |
| **Auth & DB** | Supabase — Auth · Postgres profiles · Storage |
| **Icons** | React Icons (FA6), FontAwesome |

<br>

---

<br>

## Getting Started

<br>

### Prerequisites

- Node.js 18+
- `yt-dlp` installed and on your `PATH` — [install guide](https://github.com/yt-dlp/yt-dlp#installation)
- A Supabase project (free tier works) — optional, the app runs fully offline without it

<br>

### Installation

```bash
# 1. Clone
git clone https://github.com/yourusername/liquid-bars.git
cd liquid-bars

# 2. Install
cd Frontend && npm install
cd ../Backend && npm install

# 3. Configure
cp Frontend/.env.example Frontend/.env
# Add your Supabase URL and anon key (optional)

# 4. Run
cd Backend && npm run dev      # :3001
cd Frontend && npm run dev     # :5173
```

Open [localhost:5173](http://localhost:5173) and drop in some music.

<br>

### Environment Variables

```env
# Frontend/.env

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Without these the app works in local-only mode — no account needed
```

<br>

---

<br>

## Project Structure

```
liquid-bars/
├── Frontend/
│   ├── src/
│   │   ├── components/       # PlayerControls, Toast, Sidebar
│   │   ├── context/          # PlayerContext, AuthContext
│   │   ├── hooks/            # usePlaylists
│   │   ├── pages/            # Home, HomeOnline, Library,
│   │   │                     # Playlists, Settings, RecentlyPlayed
│   │   ├── services/         # api.js (backend calls)
│   │   └── utils/            # youtubeConverter, Splashscreen
│   └── public/
├── Backend/
│   ├── server.js             # Express API + yt-dlp bridge
│   └── routes/               # /api/songs  /api/stream  /api/search
└── docker-compose.yml
```

<br>

---

<br>

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
│                                                 │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│   │  Pages   │   │ Player   │   │Playlists │   │
│   │ (React)  │   │ Context  │   │  Hook    │   │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘   │
│        └──────────────┴──────────────┘          │
│                        │                         │
│                ┌───────▼───────┐                 │
│                │   Supabase    │                 │
│                │  Auth · DB    │                 │
│                └───────────────┘                 │
└────────────────────────┬────────────────────────┘
                         │ HTTP
┌────────────────────────▼────────────────────────┐
│                Node.js Backend                   │
│                                                 │
│  /api/stream  →  yt-dlp  →  audio byte stream  │
│  /api/search  →  YouTube Data API               │
│  /api/songs   →  local file index               │
└─────────────────────────────────────────────────┘
```

<br>

---

<br>

## Roadmap

```
2026 Q2 ── User Accounts      AuthContext ✓   Profile sync   Cross-device playlists
     Q3 ── Smart Discovery    Personalised sections from listening history
     Q4 ── Cloud Sync         Playlist backup   Listening stats dashboard
2027     ── Social            Follow friends   Shared queues   Playlist sharing
```

<br>

| Status | Feature |
|:------:|:--------|
| ✅ | Local file playback |
| ✅ | YouTube streaming via yt-dlp |
| ✅ | Synced karaoke lyrics (LRCLIB) |
| ✅ | Supabase auth + profile |
| ✅ | Mobile fullscreen player + lyrics |
| ✅ | WebGL animated background (OGL) |
| ✅ | Horizontal shelf HomeOnline (Apple Music–style) |
| 🔄 | Followers / following system |
| 🔄 | Listening history + play count stats |
| 📋 | Spotify playlist import (OAuth) |
| 📋 | 10-band Web Audio EQ |
| 📋 | Collaborative queues |
| 📋 | Verified artist badges |

<br>

---

<br>

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

```bash
# Fork → clone → branch
git checkout -b feat/your-feature

# Commit
git commit -m "feat: describe your change"
git push origin feat/your-feature
# Open a PR
```

Keep PRs focused — one feature or fix per request. Match the existing style: scoped CSS-in-JS, functional components, hooks over class components.

<br>

---

<br>

## License

MIT © 2026 Liquid Bars — see [LICENSE](./LICENSE).

You're free to use, modify, and distribute this. If you build something with it, a star goes a long way. ⭐

<br>

---

<br>

<div align="center">

<img src="public/favicon.svg" width="36" alt="Liquid Bars">

<br><br>

**[⬆ back to top](#liquid-bars)**

<br>

*Built for people who care how their music sounds **and** looks.*

</div>