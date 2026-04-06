import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import HomeOnline from './pages/HomeOnline';
import Library from './pages/Library';
import Playlists from './pages/Playlists';
import Recent from './pages/Recent';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { LayerProvider, AppLayers, Layer, useLayer } from './context/LayerContext';
import MobilePlayer from './components/MobilePlayer';
import BottomNav from './components/BottomNav';
import TinyPlayer from './components/TinyPlayer';
import PlayerControls from './components/PlayerControls';
import SplashScreen from './utils/Splashscreen';
import './index.css';

/* ─── Mobile TinyPlayer pill ─────────────────────────────────── */
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

/* ─── Inner App ───────────────────────────────────────────────── */
function AppInner() {
  const [active, setActive]     = useState('Home');
  const { user, loading }       = useAuth();
  const { focus, unfocus }      = useLayer();
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  /* Connectivity check */
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

  /* Keep Render backend warm — ping every 10 minutes to prevent spin-down */
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL;
    if (!backendUrl) return;
    const id = setInterval(() => {
      fetch(`${backendUrl}/health`).catch(() => {});
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  function renderPage() {
    if (loading) return null;
    if (!user)   return <Login onSuccess={() => setActive('Home')} />;
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
    <AppLayers>

      {/* ── base: page content (sidebar + current page) ── */}
      <Layer name="base">
        <div style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'var(--lb-bg-base, #07080A)',
          overflow: 'hidden',
        }}>
          {/* Sidebar — desktop only, hidden when not logged in */}
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
      </Layer>

      {/* ── player: desktop compact bar + expanded player ── */}
      <Layer name="player">
        {user && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <PlayerControls
              onExpand={() => focus('overlay')}
              onCollapse={unfocus}
            />
          </div>
        )}
      </Layer>

      {/* ── nav: BottomNav + TinyPlayer pill — never blurs ── */}
      <Layer name="nav" noBlur>
        {user && (
          <>
            <div className="bottom-slot" style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
            }}>
              {active !== 'Home' && <MobilePlayer />}
              <BottomNav active={active} setActive={setActive} />
            </div>
            <MobileTinyPlayer active={active} />
          </>
        )}
      </Layer>

      {/* ── overlay: full-screen expanded player takeover ── */}
      <Layer name="overlay" />

      {/* ── toast: notifications, always on top, never blurs ── */}
      <Layer name="toast" noBlur />

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
            pointer-events: all;
            filter: drop-shadow(0 8px 24px rgba(0,0,0,0.7));
          }
        }
      `}</style>
    </AppLayers>
  );
}

/* ─── Root ────────────────────────────────────────────────────── */
function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <PlayerProvider>
          <LayerProvider>
            <AppInner />
          </LayerProvider>
        </PlayerProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;