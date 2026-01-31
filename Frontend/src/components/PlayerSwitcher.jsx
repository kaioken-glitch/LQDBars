import React from 'react';
import PlayerControls from './PlayerControls';
import TinyPlayer from './TinyPlayer';
import useViewport from '../hooks/useViewport';
import { usePlayer } from '../context/PlayerContext';

export default function PlayerSwitcher() {
  const { isMobile } = useViewport();
  const { currentSong, isPlaying, setIsPlaying, playPrev, playNext, isMuted, toggleMute } = usePlayer();

  if (isMobile) {
    return (
      <div className="w-full flex justify-center mt-4">
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

  return <PlayerControls />;
}
