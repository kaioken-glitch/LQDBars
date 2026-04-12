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
import RadioStation from './components/RadioStation';
import BottomNav from './components/BottomNav';
import PlayerControls from './components/PlayerControls';
import SplashScreen from './utils/Splashscreen';
import './index.css';

/* ─── Inner App ───────────────────────────────────────────────── */
function AppInner() {
  const [active, setActive]     = useState('Home');
  const { user, loading }       = useAuth();
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

  /* Keep Render backend warm */
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

        {/* Bottom nav — hidden when not logged in */}
        {user && (
          <div className="bottom-slot" style={{ flexShrink: 0 }}>
            <BottomNav active={active} setActive={setActive} />
          </div>
        )}
      </div>

      {/* Global player — handles both desktop bar and mobile mini bar */}
      {user && <PlayerControls />}

      {/* Radio station pill — fixed above BottomNav */}
      {user && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(70px + env(safe-area-inset-bottom) + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
        }}>
          <RadioStation />
        </div>
      )}

      <style>{`
        /* Desktop */
        @media (min-width: 768px) {
          .sidebar-slot                 { display: flex !important; }
          .bottom-slot .bottom-nav-root { display: none !important; }
        }

        /* Mobile */
        @media (max-width: 767px) {
          .sidebar-slot { display: none !important; }
        }
      `}</style>
    </>
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
          <AppInner />
        </PlayerProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;