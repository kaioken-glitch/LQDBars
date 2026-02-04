/**
 * Audio Loader
 * Handles loading and playing local audio files
 */

// Store active blob URLs
const activeBlobUrls = new Map();

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
    
    // Store it to prevent garbage collection
    const fileKey = `${audioFile.name}-${audioFile.size}-${audioFile.lastModified}`;
    activeBlobUrls.set(fileKey, blobUrl);
    
    // Set cleanup timeout
    setTimeout(() => {
      if (activeBlobUrls.has(fileKey) && activeBlobUrls.get(fileKey) === blobUrl) {
        URL.revokeObjectURL(blobUrl);
        activeBlobUrls.delete(fileKey);
      }
    }, 30 * 60 * 1000); // 30 minutes

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
      URL.revokeObjectURL(audioUrl); // Clean up temp URL
      resolve({
        seconds: audio.duration,
        formatted: formatDuration(audio.duration)
      });
    };

    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl); // Clean up temp URL
      reject(new Error('Error loading audio duration'));
    };

    // Timeout
    setTimeout(() => {
      URL.revokeObjectURL(audioUrl); // Clean up temp URL
      reject(new Error('Audio loading timeout'));
    }, 5000);
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
  const validFormats = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma', 'opus'];
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
export const createPlaylistFromFiles = async (files, playlistName, playlistDesc = '') => {
  const formattedSongs = [];
  let totalDuration = 0;

  for (const file of files) {
    try {
      let audioUrl;
      
      // Check if file already has a blob URL or needs one
      if (file.audioUrl && file.audioUrl.startsWith('blob:')) {
        audioUrl = file.audioUrl;
      } else if (file.file instanceof File) {
        audioUrl = await loadAudioFile(file.file);
      } else if (file instanceof File) {
        audioUrl = await loadAudioFile(file);
      } else if (file.url && file.url.startsWith('blob:')) {
        audioUrl = file.url;
      } else {
        console.warn('No valid audio source found for file:', file.name);
        continue;
      }

      // Get or use existing duration
      let duration = file.duration;
      let formattedDuration = file.formattedDuration;
      
      if (!duration && audioUrl) {
        try {
          const durationInfo = await getAudioDuration(audioUrl);
          duration = durationInfo.seconds;
          formattedDuration = durationInfo.formatted;
        } catch (e) {
          console.warn('Could not get duration for file:', file.name);
          duration = 0;
          formattedDuration = '0:00';
        }
      } else if (duration && !formattedDuration) {
        formattedDuration = formatDuration(duration);
      }

      const formattedSong = {
        ...file,
        id: file.id || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name || 'Unknown Track',
        artist: file.artist || 'Unknown Artist',
        cover: file.cover || 'https://placehold.co/300x300?text=Local+Track',
        audio: audioUrl,
        audioUrl: audioUrl,
        url: audioUrl,
        src: audioUrl,
        duration: duration,
        formattedDuration: formattedDuration,
        isLocal: true,
      };

      formattedSongs.push(formattedSong);
      totalDuration += duration || 0;
    } catch (error) {
      console.error('Error processing song:', file.name, error);
    }
  }

  return {
    id: `local-${Date.now()}`,
    name: playlistName || 'Local Playlist',
    description: playlistDesc || 'Imported local songs',
    cover: formattedSongs[0]?.cover || 'https://placehold.co/300x300?text=Local+Songs',
    songs: formattedSongs,
    songCount: formattedSongs.length,
    duration: calculateTotalDuration(formattedSongs),
    isLocal: true,
    isCustom: true
  };
};

/**
 * Calculate total duration from formatted songs
 */
const calculateTotalDuration = (songs) => {
  const totalSeconds = songs.reduce((acc, song) => acc + (song.duration || 0), 0);
  
  if (totalSeconds === 0) return '0 min';
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  return `${minutes} min`;
};

/**
 * Cleanup all blob URLs
 */
export const cleanupAllBlobUrls = () => {
  activeBlobUrls.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  activeBlobUrls.clear();
};