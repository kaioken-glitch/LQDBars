export const setupMediaSession = ({
  song,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
}) => {
  if (!('mediaSession' in navigator)) return;

  if (!song) {
    navigator.mediaSession.playbackState = 'none';
    return;
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.name || 'Unknown Track',
    artist: song.artist || 'Unknown Artist',
    album: song.album || 'Unknown Album',
    artwork: song.cover ? [{ src: song.cover, sizes: '512x512', type: 'image/jpeg' }] : [],
  });

  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

  const actions = {
    play: onPlayPause,
    pause: onPlayPause,
    previoustrack: onPrev,
    nexttrack: onNext,
    seekbackward: (details) => onSeek?.(details.seekOffset || 10),
    seekforward: (details) => onSeek?.(details.seekOffset || 10),
  };

  Object.entries(actions).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (e) {
      console.warn(`MediaSession action ${action} not supported`);
    }
  });
};

export const updateMediaSessionPlaybackState = (isPlaying) => {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }
};