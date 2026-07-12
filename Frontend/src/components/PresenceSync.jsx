// src/components/PresenceSync.jsx
//
// Mount ONCE, anywhere inside <PlayerProvider>...</PlayerProvider> (e.g.
// alongside <AppInner /> in App.jsx). Reads the live currentSong/isPlaying
// from PlayerContext and pushes it into presence — this is the entire
// integration point for "now listening" updating automatically when the
// user changes songs. Renders nothing.

import { usePlayer } from '../context/PlayerContext';
import { useBroadcastOwnPresence } from '../hooks/usePresence';

export default function PresenceSync() {
  const { currentSong, isPlaying } = usePlayer();
  useBroadcastOwnPresence(currentSong, isPlaying);
  return null;
}