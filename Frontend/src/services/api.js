// src/services/api.js
// Updated to work with JSON library (like mp3juices - metadata only, stream from external sources)
const SONGS_JSON_URL = '/src/dta/songs.json';
let cachedLibrary = null;

// Fetch the entire JSON library
async function fetchLibrary() {
  if (cachedLibrary) return cachedLibrary;
  
  try {
    const response = await fetch(SONGS_JSON_URL);
    if (!response.ok) throw new Error('Failed to fetch library');
    cachedLibrary = await response.json();
    return cachedLibrary;
  } catch (error) {
    console.error('Error fetching library:', error);
    return { songs: [], playlists: [], albums: [] };
  }
}

// Get user preferences from localStorage
function getUserPreferences() {
  try {
    return JSON.parse(localStorage.getItem('songPreferences') || '{}');
  } catch {
    return {};
  }
}

// Save user preferences to localStorage
function saveUserPreferences(prefs) {
  try {
    localStorage.setItem('songPreferences', JSON.stringify(prefs));
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
}

// Main function to fetch songs with user preferences applied
export async function fetchSongs() {
  try {
    const library = await fetchLibrary();
    const userPrefs = getUserPreferences();
    
    // Merge library songs with user preferences
    return library.songs.map(song => ({
      ...song,
      ...(userPrefs[song.id] || {})
    }));
  } catch (error) {
    console.error('Error in fetchSongs:', error);
    return [];
  }
}

// Get a single song by ID
export async function getSong(id) {
  try {
    const songs = await fetchSongs();
    const song = songs.find(s => s.id === id);
    if (!song) throw new Error(`Song ${id} not found`);
    return song;
  } catch (error) {
    console.error('Error getting song:', error);
    throw error;
  }
}

// Update song preferences (favorite, liked, etc.)
export async function patchSong(id, patch) {
  try {
    const prefs = getUserPreferences();
    prefs[id] = { ...(prefs[id] || {}), ...patch };
    saveUserPreferences(prefs);
    
    // Return updated song
    const song = await getSong(id);
    return { ...song, ...patch };
  } catch (error) {
    console.error('Error patching song:', error);
    throw error;
  }
}

// Search songs
export async function searchSongs(query) {
  try {
    const songs = await fetchSongs();
    const q = query.toLowerCase();
    
    return songs.filter(song =>
      song.name?.toLowerCase().includes(q) ||
      song.artist?.toLowerCase().includes(q) ||
      song.album?.toLowerCase().includes(q) ||
      song.genre?.toLowerCase().includes(q)
    );
  } catch (error) {
    console.error('Error searching songs:', error);
    return [];
  }
}

// Get songs by genre
export async function getSongsByGenre(genre) {
  try {
    const songs = await fetchSongs();
    return songs.filter(song => song.genre === genre);
  } catch (error) {
    console.error('Error getting songs by genre:', error);
    return [];
  }
}

// Get all playlists
export async function fetchPlaylists() {
  try {
    const library = await fetchLibrary();
    return library.playlists || [];
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return [];
  }
}

// Get all albums
export async function fetchAlbums() {
  try {
    const library = await fetchLibrary();
    return library.albums || [];
  } catch (error) {
    console.error('Error fetching albums:', error);
    return [];
  }
}

// Get playlist with full song details
export async function getPlaylistWithSongs(playlistId) {
  try {
    const library = await fetchLibrary();
    const playlist = library.playlists.find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found');
    
    const allSongs = await fetchSongs();
    const playlistSongs = playlist.songs
      .map(songId => allSongs.find(s => s.id === songId))
      .filter(Boolean);
    
    return { ...playlist, songs: playlistSongs };
  } catch (error) {
    console.error('Error getting playlist:', error);
    return null;
  }
}

// Get album with full song details
export async function getAlbumWithSongs(albumId) {
  try {
    const library = await fetchLibrary();
    const album = library.albums.find(a => a.id === albumId);
    if (!album) throw new Error('Album not found');
    
    const allSongs = await fetchSongs();
    const albumSongs = album.songs
      .map(songId => allSongs.find(s => s.id === songId))
      .filter(Boolean);
    
    return { ...album, songs: albumSongs };
  } catch (error) {
    console.error('Error getting album:', error);
    return null;
  }
}

// Legacy functions (not supported in JSON-only mode)
export async function addSong(song) {
  console.warn('addSong not supported in JSON library mode');
  return null;
}

export async function deleteSong(id) {
  console.warn('deleteSong not supported in JSON library mode');
  return false;
}

// Clear cache (useful for development)
export function clearLibraryCache() {
  cachedLibrary = null;
}