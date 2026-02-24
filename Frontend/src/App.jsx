import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Main from './pages/Main';
import Home from './pages/Home';
import HomeOnline from './pages/HomeOnline';
import Library from './pages/Library';
import Playlists from './pages/Playlists';
import Favorites from './pages/Favorites';
import Recent from './pages/Recent';
import Settings from './pages/Settings';
import { PlayerProvider } from './context/PlayerContext';
import MobilePlayer from './components/MobilePlayer';
import BottomNav from './components/BottomNav';
import SplashScreen from '../src/utils/Splashscreen';
import UpdatePopup from './components/updatePopup';



function App() {
  const [active, setActive] = useState('Home');
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    let mounted = true;

    const checkConnectivity = async () => {
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          mounted && setIsOnline(false);
          return;
        }

        // Try a small same-origin request with a short timeout to confirm connectivity
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const url = `${window.location.origin}/favicon.svg`;
        const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
        clearTimeout(timeout);

        // Treat any successful response as online; fall back to navigator.onLine
        const ok = res && (res.ok || res.type === 'opaque' || res.status === 200);
        mounted && setIsOnline(Boolean(ok || (typeof navigator !== 'undefined' && navigator.onLine)));
      } catch (err) {
        mounted && setIsOnline(false);
      }
    };

    const handleOnline = () => { checkConnectivity(); };
    const handleOffline = () => { setIsOnline(false); };

    checkConnectivity();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  function renderPage() {
    switch (active) {
      case 'Home':
        return isOnline ? <HomeOnline /> : <Home />;
      case 'Library': return <Library />;
      case 'Playlists': return <Playlists />;
      case 'Favorites': return <Favorites />;
      case 'Recently Played': return <Recent />;
      case 'Settings': return <Settings />;
      default: return isOnline ? <HomeOnline /> : <Home />;
    }
  }

   const [showSplash, setShowSplash] = useState(true);
  return showSplash ? (
  <SplashScreen onComplete={() => setShowSplash(false)} />
) : (
  <PlayerProvider>
    <div className="app flex flex-row items-stretch w-screen h-screen">
      {/* Sidebar visible on medium+ screens */}
      <div className="hidden md:flex">
        <Sidebar active={active} setActive={setActive} />
      </div>

      <Main>
        {renderPage()}
      </Main>

      {/* Mobile player (only show on pages other than Home) */}
      {active !== 'Home' && <MobilePlayer />}
      <BottomNav active={active} setActive={setActive} />
    </div>
  </PlayerProvider>
);
}

export default App
