import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import HomeOnline from './pages/HomeOnline';
import Library from './pages/Library';
import Playlists from './pages/Playlists';
import Recent from './pages/Recent';
import Settings from './pages/Settings';
import { PlayerProvider } from './context/PlayerContext';
import MobilePlayer from './components/MobilePlayer';
import BottomNav from './components/BottomNav';
import SplashScreen from './utils/Splashscreen';
import './index.css';

function App() {
  const [active, setActive] = useState('Home');
  const [showSplash, setShowSplash] = useState(true);
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    let mounted = true;
    const checkConnectivity = async () => {
      try {
        if (!navigator.onLine) { mounted && setIsOnline(false); return; }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${window.location.origin}/favicon.svg`, {
          method: 'GET', cache: 'no-store', signal: controller.signal,
        });
        clearTimeout(timeout);
        mounted && setIsOnline(res.ok || res.type === 'opaque' || navigator.onLine);
      } catch {
        mounted && setIsOnline(false);
      }
    };
    checkConnectivity();
    window.addEventListener('online',  checkConnectivity);
    window.addEventListener('offline', () => mounted && setIsOnline(false));
    return () => {
      mounted = false;
      window.removeEventListener('online',  checkConnectivity);
      window.removeEventListener('offline', () => {});
    };
  }, []);

  function renderPage() {
    switch (active) {
      case 'Home':            return isOnline ? <HomeOnline /> : <Home />;
      case 'Library':         return <Library />;
      case 'Playlists':       return <Playlists />;
      case 'Recently Played': return <Recent />;
      case 'Settings':        return <Settings />;
      default:                return isOnline ? <HomeOnline /> : <Home />;
    }
  }

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <PlayerProvider>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--lb-bg-base, #07080A)',
      }}>

        {/* ── Content row: [Sidebar] + [Page] ── */}
        <div style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* Sidebar — desktop only */}
          <div className="sidebar-slot" style={{ display: 'none', flexShrink: 0 }}>
            <Sidebar active={active} setActive={setActive} />
          </div>

          {/* Page content */}
          <div style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {renderPage()}
          </div>
        </div>

        {/* ── Bottom bar: MobilePlayer + BottomNav ── */}
        <div className="bottom-slot" style={{ flexShrink: 0 }}>
          {active !== 'Home' && <MobilePlayer />}
          <BottomNav active={active} setActive={setActive} />
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .sidebar-slot { display: flex !important; }
          .bottom-slot .bottom-nav-root { display: none !important; }
        }
        @media (max-width: 767px) {
          .sidebar-slot { display: none !important; }
        }
      `}</style>
    </PlayerProvider>
  );
}

export default App;