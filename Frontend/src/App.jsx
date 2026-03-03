import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import HomeOnline from './pages/HomeOnline';
import Library from './pages/Library';
import Playlists from './pages/Playlists';
import Recent from './pages/Recent';
import Settings from './pages/Settings';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import MobilePlayer from './components/MobilePlayer';
import BottomNav from './components/BottomNav';
import TinyPlayer from './components/TinyPlayer';
import SplashScreen from './utils/Splashscreen';
import Login from './pages/Login';           // you'll create this
import './index.css';

/* ─── Mobile floating TinyPlayer ─────────────────────────────────────────
   Fixed pill that floats above BottomNav on mobile.
   Must be INSIDE <PlayerProvider> to access usePlayer().
   Hidden on desktop via CSS.
─────────────────────────────────────────────────────────────────────── */
function MobileTinyPlayer({ active }) {
  const {
    currentSong, isPlaying, setIsPlaying,
    playNext, playPrev, isMuted, toggleMute,
  } = usePlayer();

  if (!currentSong || active === 'Home') return null;

  return (
    <div className="mobile-tiny-pill">
      <TinyPlayer
        song={currentSong}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(p => !p)}
        onPrev={playPrev}
        onNext={playNext}
        isMuted={isMuted}
        onMuteToggle={toggleMute}
      />
    </div>
  );
}

/* ─── Inner app (needs PlayerProvider + AuthProvider context) ────────── */
function AppInner() {
  const [active, setActive] = useState('Home');
  const { user, loading } = useAuth();
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        if (!navigator.onLine) { mounted && setIsOnline(false); return; }
        const ctl = new AbortController();
        const t   = setTimeout(() => ctl.abort(), 3000);
        const res = await fetch(`${window.location.origin}/favicon.svg`, {
          method: 'GET', cache: 'no-store', signal: ctl.signal,
        });
        clearTimeout(t);
        mounted && setIsOnline(res.ok || res.type === 'opaque' || navigator.onLine);
      } catch {
        mounted && setIsOnline(false);
      }
    };
    check();
    window.addEventListener('online',  check);
    window.addEventListener('offline', () => mounted && setIsOnline(false));
    return () => {
      mounted = false;
      window.removeEventListener('online',  check);
      window.removeEventListener('offline', () => {});
    };
  }, []);

  // Keep Render backend warm — ping every 10 minutes to prevent spin-down
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL;
    if (!backendUrl) return;
    const id = setInterval(() => {
      fetch(`${backendUrl}/health`).catch(() => {});
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  function renderPage() {
    // Auth loading — show nothing (AuthProvider already blocks children until ready)
    if (loading) return null;

    // Not logged in — show Login page regardless of which tab is active
    if (!user) return <Login onSuccess={() => setActive('Home')} />;

    // Logged in — render normally
    switch (active) {
      case 'Home':            return isOnline ? <HomeOnline /> : <Home />;
      case 'Library':         return <Library />;
      case 'Playlists':       return <Playlists />;
      case 'Recently Played': return <Recent />;
      case 'Settings':        return <Settings />;
      default:                return isOnline ? <HomeOnline /> : <Home />;
    }
  }

  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--lb-bg-base, #07080A)',
      }}>
        {/* Content row: Sidebar + Page */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* Sidebar — desktop only, hide when not logged in */}
          {user && (
            <div className="sidebar-slot" style={{ display: 'none', flexShrink: 0 }}>
              <Sidebar active={active} setActive={setActive} />
            </div>
          )}

          {/* Page */}
          <div style={{
            flex: 1, minWidth: 0, height: '100%',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            {renderPage()}
          </div>
        </div>

        {/* Bottom bar — hide when not logged in */}
        {user && (
          <div className="bottom-slot" style={{ flexShrink: 0 }}>
            {active !== 'Home' && <MobilePlayer />}
            <BottomNav active={active} setActive={setActive} />
          </div>
        )}
      </div>

      {/* ── Mobile TinyPlayer — fixed above BottomNav, mobile only ── */}
      {user && <MobileTinyPlayer active={active} />}

      <style>{`
        /* Desktop */
        @media (min-width: 768px) {
          .sidebar-slot                  { display: flex !important; }
          .bottom-slot .bottom-nav-root  { display: none  !important; }
          .mobile-tiny-pill              { display: none  !important; }
        }

        /* Mobile */
        @media (max-width: 767px) {
          .sidebar-slot { display: none !important; }
          .mobile-tiny-pill {
            position: fixed;
            bottom: calc(70px + env(safe-area-inset-bottom, 0px) + 14px);
            left: 50%;
            transform: translateX(-50%);
            z-index: 200;
            pointer-events: all;
            filter: drop-shadow(0 8px 24px rgba(0,0,0,0.7));
          }
        }
      `}</style>
    </>
  );
}

/* ─── Root ── */
function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <PlayerProvider>
          <AppInner />
        </PlayerProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;