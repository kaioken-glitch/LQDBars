/**
 * Audio Loader
 * Handles loading and playing local audio files
 */

/**
 * Load audio file from local storage
 * @param {File|Blob} audioFile - The audio file to load
 * @returns {Promise<string>} - Returns a blob URL for playback
 */
export const loadAudioFile = async (audioFile) => {
  try {
    if (!audioFile) {
      throw new Error('No audio file provided');
    }

    // Create a blob URL for the file
    const blobUrl = URL.createObjectURL(audioFile);
    return blobUrl;
  } catch (error) {
    console.error('Error loading audio file:', error);
    throw error;
  }
};

/**
 * Load audio file from a FileHandle (File System Access API)
 */
export const loadAudioFromFileHandle = async (fileHandle) => {
  try {
    const file = await fileHandle.getFile();
    return loadAudioFile(file);
  } catch (error) {
    console.error('Error loading audio from file handle:', error);
    throw error;
  }
};

/**
 * Create audio context for advanced audio processing
 */
export const createAudioContext = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    throw new Error('Web Audio API not supported');
  }
  return new AudioContext();
};

/**
 * Get audio duration
 */
export const getAudioDuration = (audioUrl) => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = audioUrl;

    audio.onloadedmetadata = () => {
      const minutes = Math.floor(audio.duration / 60);
      const seconds = Math.floor(audio.duration % 60);
      resolve({
        seconds: audio.duration,
        formatted: `${minutes}:${String(seconds).padStart(2, '0')}`
      });
    };

    audio.onerror = () => {
      reject(new Error('Error loading audio duration'));
    };

    // Timeout
    setTimeout(() => reject(new Error('Audio loading timeout')), 5000);
  });
};

/**
 * Format duration to MM:SS
 */
export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

/**
 * Validate audio file format
 */
export const isValidAudioFormat = (fileName) => {
  const validFormats = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'];
  const extension = fileName.split('.').pop().toLowerCase();
  return validFormats.includes(extension);
};

/**
 * Revoke object URL to free memory
 */
export const revokeAudioUrl = (url) => {
  try {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error revoking URL:', error);
  }
};

/**
 * Get file size formatted
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Create playlist from local files
 */
export const createPlaylistFromFiles = (files, playlistName, playlistDesc = '') => {
  return {
    id: `local-playlist-${Date.now()}`,
    name: playlistName,
    description: playlistDesc,
    cover: 'https://placehold.co/300x300?text=Local+Playlist',
    songCount: files.length,
    duration: calculateTotalDuration(files),
    songs: files,
    isLocal: true,
    isCustom: true
  };
};

/**
 * Calculate total duration
 */
const calculateTotalDuration = (files) => {
  // Parse duration strings and sum them
  const total = files.reduce((acc, file) => {
    if (file.duration) {
      const parts = file.duration.split(':');
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseInt(parts[1]) || 0;
      return acc + (minutes * 60) + seconds;
    }
    return acc;
  }, 0);

  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${minutes}m`;
};