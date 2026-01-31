import React from 'react'
import TinyPlayer from './TinyPlayer'
import { usePlayer } from '../context/PlayerContext'

export default function MobilePlayer() {
  const { currentSong, isPlaying, setIsPlaying, playPrev, playNext, isMuted, toggleMute } = usePlayer();

  if (!currentSong) return null;

  return (
    <div className="md:hidden fixed bottom-16 left-4 right-4 z-40 flex justify-center">
      <TinyPlayer
        song={currentSong}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onPrev={playPrev}
        onNext={playNext}
        isMuted={isMuted}
        onMuteToggle={toggleMute}
      />
    </div>
  )
}
