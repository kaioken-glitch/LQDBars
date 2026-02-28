# <img src="public/favicon.svg" width="40" style="vertical-align: middle; margin-right: 10px;"> Liquid Bars

<div align="center">
  <img src="public/og-image.png" alt="Liquid Bars Banner" width="800" style="border-radius: 20px; box-shadow: 0 20px 40px rgba(0,255,150,0.2);">
  <br>
  <h1 style="font-size: 4rem; background: linear-gradient(135deg, #10b981, #059669); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Liquid Bars</h1>
  <p><strong>A modern, glass‑like music player for the web</strong></p>
  <p>
    <a href="#features"><img src="https://img.shields.io/badge/✨-Features-emerald?style=for-the-badge"></a>
    <a href="#version-log"><img src="https://img.shields.io/badge/📦-Version%20Log-emerald?style=for-the-badge"></a>
    <a href="#roadmap"><img src="https://img.shields.io/badge/🚀-Roadmap-emerald?style=for-the-badge"></a>
    <a href="#api-integration"><img src="https://img.shields.io/badge/🔌-API%20Integration-emerald?style=for-the-badge"></a>
  </p>
</div>

---

## 🌟 The Vision

**Liquid Bars** isn't just another music player. It’s a sanctuary for your ears – a place where your local files, YouTube discoveries, and imported playlists coalesce under a silky‑smooth glass interface. Whether you're offline with your own collection or streaming the latest tracks, Liquid Bars adapts to you.

> *“Music should feel fluid, like water – clear, refreshing, and always moving.”*

---

## ✨ Features

| | |
|:---:|:---|
| **🎵 Play Anywhere** | Local files, YouTube streams, imported playlists – all in one place. |
| **📂 Import with Ease** | Drag folders, paste YouTube URLs, or create custom playlists on the fly. |
| **🎨 Liquid Glass Design** | Frosted panels, dynamic blurs, and a color‑adaptive expanded player. |
| **📱 Responsive to the Core** | Desktop sidebar, mobile bottom navigation, and a unified expanded view. |
| **🔁 Shuffle & Repeat** | Three repeat modes and true shuffle that respects your current track. |
| **🎚️ Queue Management** | Drag to reorder, see upcoming tracks, and jump to any song. |
| **💾 Persistent Library** | Your playlists, favorites, and history survive reloads (localStorage). |
| **🔍 Smart Search** | Finds songs in your library and suggests YouTube matches instantly. |
| **📈 Version Tracking** | Click the version badge in Settings to check for updates. |

---

## 🚀 Version Log

### v2.3.0 – *The Glass Expansion* (March 2025)
- Unified expanded player across desktop and mobile – click any cover art for a full‑screen immersive experience.
- Added togglable queue panel in desktop expanded view.
- Refined glassmorphism with enhanced backdrop blurs and gradient overlays.
- Fixed YouTube import duration parsing and playlist sync.

### v2.2.0 – *Playlist Renaissance* (February 2025)
- Completely redesigned Playlists, Library, and Favorites pages with consistent glass cards.
- Introduced grid/list view toggle in Playlists.
- Detail views now feature a full‑screen gradient background and sticky headers.
- Added `UpdatePopup` that checks `/version.json` and notifies users of new releases.

### v2.1.0 – *YouTube Unleashed* (January 2025)
- Import entire YouTube playlists via URL – fetches video IDs and durations.
- Playback now seamlessly switches between local audio and YouTube iframe.
- Debounced search and request cancellation to save API quota.

### v2.0.0 – *The Great Refactor* (December 2024)
- Migrated all pages to `src/pages/` for better organization.
- PlayerContext now handles shuffle, repeat, and media session API.
- Drag‑to‑reorder queue and “Continue Watching” section.
- First release of the Liquid Bars design system.

---

## 🛣️ Roadmap

| Quarter | Focus | Planned Features |
|:--------|:------|:-----------------|
| **Q2 2026** | **User Accounts** | AuthContext, login/signup, profile sync, cross‑device playlists |
| **Q3 2026** | **Smart Suggestions** | Personalized recommendations based on listening history, liked songs, and frequently played artists |
| **Q4 2026** | **Cloud Sync** | Playlist backup, offline availability, listening stats dashboard |
| **2027** | **Social & Sharing** | Share playlists, follow friends, collaborative queues |

---

## 🔌 API Integration

Liquid Bars is built to play nice with third‑party services. Here’s what’s currently integrated and what’s coming:

### ✅ Current
- **YouTube Data API v3** – Import public playlists, fetch video durations, search for tracks.
- **Last.fm API** – Top tracks, artist info (used for suggestions).
- **File System Access API** – Import local folders (desktop only).

### 🔜 In Development
- **Spotify Web API** – Import user playlists (requires OAuth).  
- **Apple Music API** – (Under consideration) would allow importing from Apple Music.
- **Deezer / Tidal** – If demand grows, we’ll add more sources.

### 💡 Planned
- **Lyrics API** – Fetch and display synced lyrics (e.g., Musixmatch).
- **Web Bluetooth** – Connect to Bluetooth devices for playback info.
- **Web Audio API** – 10‑band equalizer with presets.

---

## 🎨 Design Philosophy

Every pixel of Liquid Bars is crafted with intention. The design borrows from **Apple’s clarity** and **Spotify’s boldness**, fusing them into a unique liquid glass aesthetic.

- **Backdrop‑blur** creates depth without distraction.
- **Emerald gradients** guide the eye and indicate interactivity.
- **Consistent spacing** and rounded corners make the interface feel approachable.
- **Adaptive colors** – the expanded player picks the dominant hue from album art.

> *“The interface should fade into the background, letting the music take center stage.”*

---

## 🙌 Credits & Contributions

Built with ❤️ using React, Tailwind CSS, and a lot of caffeine. Special thanks to:

- The open‑source community for React, FontAwesome, and countless utilities.
- **You** – for using Liquid Bars and shaping its future.

Want to contribute? Check out the [GitHub repository](https://github.com/yourusername/liquid-bars) and open an issue or PR. Feedback and ideas are always welcome.

---

<div align="center">
  <img src="public/favicon.svg" width="60" style="opacity:0.5;">
  <br>
  <small>© 2026 Liquid Bars – Made with 🎵 for music lovers everywhere.</small>
</div>