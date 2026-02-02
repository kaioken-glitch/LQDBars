/**
 * Local Storage Handler
 * Manages local audio files, folder references, and file operations
 */

const SUPPORTED_AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'];
const DB_NAME = 'MusicPlayerDB';
const STORE_NAME = 'localSongs';
const FOLDERS_STORE = 'folderReferences';

/**
 * Initialize IndexedDB for storing local file references
 */
export const initializeDatabase = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const songStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        songStore.createIndex('filePath', 'filePath', { unique: true });
        songStore.createIndex('folderId', 'folderId', { unique: false });
      }

      if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
        db.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
      }
    };
  });
};

/**
 * Open file picker and get folder reference
 * Works with File System Access API (modern browsers)
 */
export const selectFolderForImport = async () => {
  try {
    // Check if File System Access API is available
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API not supported in this browser');
    }

    const dirHandle = await window.showDirectoryPicker();
    return dirHandle;
  } catch (error) {
    console.error('Error selecting folder:', error);
    throw error;
  }
};

/**
 * Load all audio files from a folder reference
 */
export const loadSongsFromFolder = async (dirHandle) => {
  const songs = [];
  const db = await initializeDatabase();

  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        
        // Check if file is audio format
        if (isAudioFile(file.name)) {
          const song = await createSongFromFile(file, dirHandle.name);
          songs.push(song);

          // Store in IndexedDB for persistence
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).add(song);
        }
      }
    }

    // Store folder reference
    await saveFolderReference(dirHandle);

    return songs;
  } catch (error) {
    console.error('Error loading songs from folder:', error);
    throw error;
  }
};

/**
 * Check if file is an audio format
 */
const isAudioFile = (fileName) => {
  const extension = fileName.split('.').pop().toLowerCase();
  return SUPPORTED_AUDIO_FORMATS.includes(extension);
};

/**
 * Create song object from file
 */
const createSongFromFile = async (file, folderName) => {
  const id = `local-${Date.now()}-${Math.random()}`;
  
  // Try to extract metadata using ID3 or basic file info
  const metadata = await extractFileMetadata(file);

  return {
    id,
    name: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
    artist: metadata.artist || 'Unknown Artist',
    album: metadata.album || folderName,
    duration: metadata.duration || '0:00',
    cover: metadata.cover || 'https://placehold.co/60x60?text=Local+Song',
    filePath: file.name,
    fileSize: file.size,
    fileType: file.type,
    fileHandle: null, // Will be set when needed
    isLocal: true,
    folderName,
    folderId: folderName,
    lastModified: file.lastModified,
    url: URL.createObjectURL(file) // Create blob URL for playback
  };
};

/**
 * Extract metadata from audio file
 * Note: This is a basic implementation. For production, use jsmediatags library
 */
const extractFileMetadata = async (file) => {
  const metadata = {
    title: file.name.replace(/\.[^/.]+$/, ''),
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    duration: null,
    cover: null
  };

  try {
    // Create audio element to get duration
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);

    return new Promise((resolve) => {
      audio.onloadedmetadata = () => {
        const minutes = Math.floor(audio.duration / 60);
        const seconds = Math.floor(audio.duration % 60);
        metadata.duration = `${minutes}:${String(seconds).padStart(2, '0')}`;
        URL.revokeObjectURL(audio.src);
        resolve(metadata);
      };

      // Timeout if metadata doesn't load
      setTimeout(() => resolve(metadata), 2000);
    });
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return metadata;
  }
};

/**
 * Save folder reference to IndexedDB for future access
 */
const saveFolderReference = async (dirHandle) => {
  const db = await initializeDatabase();
  const folderRef = {
    id: dirHandle.name,
    name: dirHandle.name,
    timestamp: Date.now(),
    handle: dirHandle // Note: File handles can be serialized with proper polyfills
  };

  const tx = db.transaction(FOLDERS_STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(FOLDERS_STORE).put(folderRef);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get all saved folder references
 */
export const getSavedFolders = async () => {
  const db = await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOLDERS_STORE, 'readonly');
    const request = tx.objectStore(FOLDERS_STORE).getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get all songs from a specific folder
 */
export const getSongsFromFolder = async (folderId) => {
  const db = await initializeDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('folderId');
    const request = index.getAll(folderId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Delete songs and folder reference
 */
export const deleteFolder = async (folderId) => {
  const db = await initializeDatabase();

  // Delete all songs from this folder
  const songTx = db.transaction(STORE_NAME, 'readwrite');
  const index = songTx.objectStore(STORE_NAME).index('folderId');
  const range = IDBKeyRange.only(folderId);
  const deleteRequest = index.openCursor(range);

  deleteRequest.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };

  // Delete folder reference
  const folderTx = db.transaction(FOLDERS_STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = folderTx.objectStore(FOLDERS_STORE).delete(folderId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get supported audio formats
 */
export const getSupportedFormats = () => {
  return SUPPORTED_AUDIO_FORMATS;
};

/**
 * Verify browser support for local file access
 */
export const checkLocalFileSupport = () => {
  return {
    fileSystemAccess: 'showDirectoryPicker' in window,
    indexedDB: !!window.indexedDB,
    blobUrl: !!window.URL.createObjectURL
  };
};